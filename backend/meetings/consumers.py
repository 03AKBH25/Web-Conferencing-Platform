import json
import logging
import asyncio
from urllib.parse import parse_qs
from django.utils import timezone
from django.conf import settings
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

from meetings.models import Meeting, MeetingParticipant, MeetingMessage, MeetingEvent
from meetings import services

logger = logging.getLogger(__name__)

class MeetingRoomConsumer(AsyncJsonWebsocketConsumer):
    # Class-level dictionary to map session_id -> channel_name for WebRTC signaling routing
    active_connections = {}

    async def connect(self):
        self.meeting_id = self.scope['url_route']['kwargs']['meeting_id']
        
        # Parse query parameters
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        
        self.session_id = query_params.get('session_id', [None])[0]
        self.participant_id_str = query_params.get('participant_id', [None])[0]

        logger.info(f"WebSocket Connect attempt: meeting={self.meeting_id}, session={self.session_id}, participant={self.participant_id_str}")

        # Accept connection first so we can send clean error messages if validation fails
        await self.accept()

        if not self.session_id or not self.participant_id_str:
            await self.send_error("VALIDATION_ERROR", "Missing session_id or participant_id query parameters.")
            await self.close()
            return

        try:
            self.participant_id = int(self.participant_id_str)
        except ValueError:
            await self.send_error("VALIDATION_ERROR", "Invalid participant_id format.")
            await self.close()
            return

        # Validate meeting and participant via DB
        participant, error_code = await self.validate_participant_db()
        if error_code:
            await self.send_error(error_code, f"Connection rejected: {error_code.replace('_', ' ').title()}")
            await self.close()
            return

        # Set attributes from DB record
        self.is_host = participant.is_host
        self.display_name = participant.display_name
        self.room_group_name = f"meeting_{self.meeting_id}"

        # Register this connection
        self.active_connections[self.session_id] = self.channel_name

        # Join the channels group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # Set participant active in database
        await self.set_participant_active(True)

        # Fetch current state (active participants in the meeting)
        state = await self.get_meeting_state_db()

        # Send initial state to the newly connected participant
        await self.send_json({
            "type": "meeting_state",
            "payload": state
        })

        # Broadcast participant_joined to the rest of the group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_joined",
                "session_id": self.session_id,
                "payload": {
                    "participant": {
                        "id": self.participant_id,
                        "session_id": self.session_id,
                        "display_name": self.display_name,
                        "is_host": self.is_host,
                        "audio_enabled": participant.audio_enabled,
                        "video_enabled": participant.video_enabled
                    }
                }
            }
        )

        logger.info(f"WebSocket Connect successful: session={self.session_id}")

    async def disconnect(self, close_code):
        logger.info(f"WebSocket Disconnect: session={self.session_id if hasattr(self, 'session_id') else 'unknown'} close_code={close_code}")
        
        if hasattr(self, 'session_id'):
            if self.active_connections.get(self.session_id) == self.channel_name:
                self.active_connections.pop(self.session_id, None)

        if hasattr(self, 'room_group_name'):
            # Leave group immediately
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

            # Check if this was an intentional leave or end-meeting
            is_still_active_and_meeting_open = await self.check_participant_active_and_meeting_open_db()

            if not is_still_active_and_meeting_open:
                # Immediate disconnect cleanup
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "broadcast_left",
                        "session_id": self.session_id,
                        "payload": {
                            "participant_id": self.participant_id,
                            "session_id": self.session_id
                        }
                    }
                )
            else:
                # Temporary disconnect. Schedule a grace period to check for reconnection.
                asyncio.create_task(self.handle_temporary_disconnect_grace_period())

    async def handle_temporary_disconnect_grace_period(self):
        grace_period = getattr(settings, 'WEBSOCKET_GRACE_PERIOD', 5)
        await asyncio.sleep(grace_period)

        # Check if the session_id is back in active_connections (meaning they reconnected)
        if self.session_id in self.active_connections:
            logger.info(f"Participant {self.session_id} successfully reconnected within grace period.")
            return

        # Check if the meeting or participant state changed in the DB during sleep
        is_still_active_and_meeting_open = await self.check_participant_active_and_meeting_open_db()
        if not is_still_active_and_meeting_open:
            return

        # They did not reconnect. Mark them inactive and auto-end meeting if last participant.
        logger.info(f"Participant {self.session_id} did not reconnect. Marking inactive.")
        await self.set_participant_active(False)

        # Broadcast participant_left to the group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "broadcast_left",
                "session_id": self.session_id,
                "payload": {
                    "participant_id": self.participant_id,
                    "session_id": self.session_id
                }
            }
        )

    async def receive_json(self, content, **kwargs):
        msg_type = content.get('type')
        payload = content.get('payload', {})

        if not msg_type:
            await self.send_error("INVALID_MESSAGE", "Missing message type.")
            return

        # Direct WebRTC signalling (Point-to-Point routing)
        if msg_type in ["webrtc_offer", "webrtc_answer", "webrtc_ice_candidate"]:
            target_session_id = payload.get('target')
            if not target_session_id:
                await self.send_error("INVALID_SIGNAL", "Signaling message requires a target session_id.")
                return

            target_channel = self.active_connections.get(target_session_id)
            if target_channel:
                # Forward signaling directly to the target participant
                await self.channel_layer.send(
                    target_channel,
                    {
                        "type": "route_signaling",
                        "sender_session_id": self.session_id,
                        "msg_type": msg_type,
                        "payload": payload
                    }
                )
            return

        # Media states changes
        if msg_type in ["audio_state_changed", "video_state_changed"]:
            enabled = payload.get('enabled', False)
            # Update database state
            await self.update_media_state_db(msg_type, enabled)
            # Broadcast state update to group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_state_change",
                    "session_id": self.session_id,
                    "payload": {
                        "participant_id": self.participant_id,
                        "session_id": self.session_id,
                        "type": msg_type,
                        "enabled": enabled
                    }
                }
            )
            return

        # Screen sharing states changes
        if msg_type in ["screen_share_started", "screen_share_stopped"]:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_screen_share",
                    "session_id": self.session_id,
                    "payload": {
                        "participant_id": self.participant_id,
                        "session_id": self.session_id,
                        "type": msg_type
                    }
                }
            )
            return

        # Chat message
        if msg_type == "chat_message":
            message_text = payload.get('message', '').strip()
            if not message_text:
                await self.send_error("INVALID_MESSAGE", "Message text cannot be empty.")
                return
            
            # Persist chat message in database
            msg_data = await self.save_chat_message_db(message_text)
            # Broadcast message to group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_chat",
                    "payload": msg_data
                }
            )
            return

        # Host Controls (Authorized)
        if msg_type in ["mute_all", "participant_removed", "meeting_ended"]:
            if not self.is_host:
                await self.send_error("NOT_AUTHORIZED", "Only the host can execute control commands.")
                return

            if msg_type == "mute_all":
                # Update DB and broadcast
                await self.mute_all_participants_db()
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "broadcast_mute_all",
                        "payload": {"initiated_by": self.session_id}
                    }
                )
            
            elif msg_type == "participant_removed":
                target_session_id = payload.get('session_id')
                target_participant_id = payload.get('participant_id')
                
                if not target_session_id or not target_participant_id:
                    await self.send_error("INVALID_MESSAGE", "Remove action requires target session_id and participant_id.")
                    return

                # Deactivate in database
                await self.kick_participant_db(target_participant_id, target_session_id)
                
                # Broadcast kick to group
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "broadcast_kick",
                        "payload": {
                            "participant_id": target_participant_id,
                            "session_id": target_session_id
                        }
                    }
                )

            elif msg_type == "meeting_ended":
                # End meeting in DB
                await self.end_meeting_db()
                # Broadcast ending
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "broadcast_meeting_ended",
                        "payload": {}
                    }
                )
            return

    # Broadcast event handler helpers

    async def broadcast_joined(self, event):
        # Notify clients about a newly joined participant (excluding sender if needed,
        # but let's send to all so they synchronize peer setup)
        if event["session_id"] != self.session_id:
            await self.send_json({
                "type": "participant_joined",
                "payload": event["payload"]
            })

    async def broadcast_left(self, event):
        if event["session_id"] != self.session_id:
            await self.send_json({
                "type": "participant_left",
                "payload": event["payload"]
            })

    async def route_signaling(self, event):
        # Send WebRTC signaling directly to recipient
        payload = event["payload"]
        # Ensure sender is correctly identified by server state
        payload["from"] = event["sender_session_id"]
        
        await self.send_json({
            "type": event["msg_type"],
            "payload": payload
        })

    async def broadcast_state_change(self, event):
        await self.send_json({
            "type": event["payload"]["type"],
            "payload": event["payload"]
        })

    async def broadcast_screen_share(self, event):
        await self.send_json({
            "type": event["payload"]["type"],
            "payload": event["payload"]
        })

    async def broadcast_chat(self, event):
        await self.send_json({
            "type": "chat_message",
            "payload": event["payload"]
        })

    async def broadcast_mute_all(self, event):
        # Mute outgoing audio track locally if not the host
        if not self.is_host:
            await self.send_json({
                "type": "mute_all",
                "payload": event["payload"]
            })

    async def broadcast_kick(self, event):
        # Force kick the target participant if matches current session
        target_session_id = event["payload"]["session_id"]
        if self.session_id == target_session_id:
            await self.send_json({
                "type": "participant_removed",
                "payload": event["payload"]
            })
            await self.close()
        else:
            await self.send_json({
                "type": "participant_left",
                "payload": event["payload"]
            })

    async def broadcast_meeting_ended(self, event):
        await self.send_json({
            "type": "meeting_ended",
            "payload": {}
        })
        await self.close()

    async def send_error(self, code, message):
        await self.send_json({
            "type": "error",
            "payload": {
                "code": code,
                "message": message
            }
        })

    # Database sync methods

    @database_sync_to_async
    def validate_participant_db(self):
        try:
            meeting = Meeting.objects.get(meeting_id=self.meeting_id)
            if meeting.status in [Meeting.STATUS_ENDED, Meeting.STATUS_CANCELLED]:
                return None, "MEETING_ENDED"

            participant = MeetingParticipant.objects.get(
                id=self.participant_id,
                meeting=meeting,
                session_id=self.session_id
            )
            return participant, None
        except Meeting.DoesNotExist:
            return None, "MEETING_NOT_FOUND"
        except MeetingParticipant.DoesNotExist:
            return None, "PARTICIPANT_NOT_FOUND"

    @database_sync_to_async
    def check_participant_active_and_meeting_open_db(self):
        try:
            meeting = Meeting.objects.get(meeting_id=self.meeting_id)
            if meeting.status in [Meeting.STATUS_ENDED, Meeting.STATUS_CANCELLED]:
                return False
            
            participant = MeetingParticipant.objects.get(id=self.participant_id)
            return participant.is_active
        except (Meeting.DoesNotExist, MeetingParticipant.DoesNotExist):
            return False

    @database_sync_to_async
    def set_participant_active(self, is_active):
        try:
            participant = MeetingParticipant.objects.get(id=self.participant_id)
            participant.is_active = is_active
            if not is_active:
                participant.left_at = timezone.now()
            participant.save()

            # Record Event log
            event_type = MeetingEvent.EVENT_PARTICIPANT_JOINED if is_active else MeetingEvent.EVENT_PARTICIPANT_LEFT
            MeetingEvent.objects.create(
                meeting=participant.meeting,
                participant=participant,
                event_type=event_type,
                metadata={"session_id": self.session_id, "websocket_disconnect": not is_active}
            )

            # Auto-end meeting if no active participants left
            if not is_active:
                meeting = participant.meeting
                if not meeting.participants.filter(is_active=True).exists():
                    services.end_meeting(meeting)

        except MeetingParticipant.DoesNotExist:
            pass

    @database_sync_to_async
    def get_meeting_state_db(self):
        meeting = Meeting.objects.get(meeting_id=self.meeting_id)
        active_participants = meeting.participants.filter(is_active=True).exclude(id=self.participant_id)
        
        participants_data = []
        for p in active_participants:
            participants_data.append({
                "id": p.id,
                "session_id": p.session_id,
                "display_name": p.display_name,
                "is_host": p.is_host,
                "audio_enabled": p.audio_enabled,
                "video_enabled": p.video_enabled
            })

        return {
            "meeting_id": meeting.meeting_id,
            "title": meeting.title,
            "status": meeting.status,
            "participants": participants_data
        }

    @database_sync_to_async
    def update_media_state_db(self, state_type, enabled):
        try:
            participant = MeetingParticipant.objects.get(id=self.participant_id)
            if state_type == "audio_state_changed":
                participant.audio_enabled = enabled
                event_type = MeetingEvent.EVENT_PARTICIPANT_UNMUTED if enabled else MeetingEvent.EVENT_PARTICIPANT_MUTED
            else:
                participant.video_enabled = enabled
                event_type = MeetingEvent.EVENT_CAMERA_ENABLED if enabled else MeetingEvent.EVENT_CAMERA_DISABLED
            
            participant.save()

            MeetingEvent.objects.create(
                meeting=participant.meeting,
                participant=participant,
                event_type=event_type
            )
        except MeetingParticipant.DoesNotExist:
            pass

    @database_sync_to_async
    def save_chat_message_db(self, message_text):
        participant = MeetingParticipant.objects.get(id=self.participant_id)
        msg = MeetingMessage.objects.create(
            meeting=participant.meeting,
            participant=participant,
            message=message_text
        )
        return {
            "id": msg.id,
            "participant_id": participant.id,
            "session_id": self.session_id,
            "display_name": participant.display_name,
            "is_host": participant.is_host,
            "message": msg.message,
            "created_at": msg.created_at.isoformat()
        }

    @database_sync_to_async
    def mute_all_participants_db(self):
        meeting = Meeting.objects.get(meeting_id=self.meeting_id)
        active_participants = meeting.participants.filter(is_active=True).exclude(id=self.participant_id)
        for p in active_participants:
            p.audio_enabled = False
            p.save()
            MeetingEvent.objects.create(
                meeting=meeting,
                participant=p,
                event_type=MeetingEvent.EVENT_PARTICIPANT_MUTED,
                metadata={"muted_by_host": True}
            )

    @database_sync_to_async
    def kick_participant_db(self, participant_id, session_id):
        try:
            participant = MeetingParticipant.objects.get(
                id=participant_id, 
                meeting__meeting_id=self.meeting_id,
                session_id=session_id
            )
            participant.is_active = False
            participant.left_at = timezone.now()
            participant.save()

            MeetingEvent.objects.create(
                meeting=participant.meeting,
                participant=participant,
                event_type=MeetingEvent.EVENT_PARTICIPANT_LEFT,
                metadata={"removed_by_host": True}
            )

            # Auto end meeting if no active participants left
            meeting = participant.meeting
            if not meeting.participants.filter(is_active=True).exists():
                services.end_meeting(meeting)
        except MeetingParticipant.DoesNotExist:
            pass

    @database_sync_to_async
    def end_meeting_db(self):
        try:
            meeting = Meeting.objects.get(meeting_id=self.meeting_id)
            services.end_meeting(meeting)
        except Meeting.DoesNotExist:
            pass
