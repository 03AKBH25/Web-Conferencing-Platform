from django.utils import timezone
from django.db.models import Q
from django.contrib.auth.models import User
from rest_framework import status, views, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from config.exceptions import CustomAPIException
from meetings.models import Meeting, MeetingParticipant, MeetingMessage, MeetingEvent
from meetings.serializers import (
    MeetingSerializer, 
    MeetingParticipantSerializer, 
    MeetingMessageSerializer
)
from meetings.permissions import IsMeetingHost
from meetings import services

class InstantMeetingView(views.APIView):
    """
    POST /api/meetings/instant/
    Creates a new instant meeting.
    """
    def post(self, request, *args, **kwargs):
        title = request.data.get('title', 'Instant Meeting')
        description = request.data.get('description', '')
        
        # Ensure we have a host (current user, fallback to seeded user)
        host = request.user
        if not host or not host.is_authenticated:
            host, _ = User.objects.get_or_create(
                username='alex',
                defaults={
                    'email': 'alex@example.com',
                    'first_name': 'Alex',
                    'last_name': 'Johnson'
                }
            )

        meeting = services.create_instant_meeting(
            host=host, 
            title=title, 
            description=description
        )
        
        serializer = MeetingSerializer(meeting)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MeetingListCreateView(views.APIView):
    """
    GET /api/meetings/
    POST /api/meetings/
    Lists meetings or creates a scheduled meeting.
    """
    def get(self, request, *args, **kwargs):
        queryset = Meeting.objects.all()

        # Query filters
        meeting_type = request.query_params.get('type')
        if meeting_type:
            queryset = queryset.filter(meeting_type=meeting_type)

        meeting_status = request.query_params.get('status')
        if meeting_status:
            queryset = queryset.filter(status=meeting_status)

        search_query = request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(
                Q(title__icontains=search_query) |
                Q(meeting_id__icontains=search_query) |
                Q(description__icontains=search_query)
            )

        upcoming = request.query_params.get('upcoming')
        if upcoming == 'true':
            queryset = queryset.filter(
                meeting_type=Meeting.TYPE_SCHEDULED,
                scheduled_at__gt=timezone.now(),
                status__in=[Meeting.STATUS_SCHEDULED, Meeting.STATUS_ACTIVE]
            ).order_by('scheduled_at')

        recent = request.query_params.get('recent')
        if recent == 'true':
            queryset = queryset.order_by('-created_at')[:10]

        serializer = MeetingSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request, *args, **kwargs):
        title = request.data.get('title')
        description = request.data.get('description', '')
        scheduled_at_str = request.data.get('scheduled_at')
        duration_minutes = request.data.get('duration_minutes', 60)

        # Parse duration
        try:
            duration_minutes = int(duration_minutes)
        except (ValueError, TypeError):
            raise CustomAPIException(
                message="Duration must be a valid integer.",
                code="INVALID_DURATION",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Parse scheduled_at datetime
        if not scheduled_at_str:
            raise CustomAPIException(
                message="Scheduled time is required.",
                code="VALIDATION_ERROR",
                status_code=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Parse ISO datetime
            scheduled_at = timezone.datetime.fromisoformat(scheduled_at_str.replace('Z', '+00:00'))
            # Ensure it is timezone-aware
            if timezone.is_naive(scheduled_at):
                scheduled_at = timezone.make_aware(scheduled_at)
        except (ValueError, TypeError):
            raise CustomAPIException(
                message="Scheduled time is invalid or malformed. Use ISO format (e.g. YYYY-MM-DDTHH:MM:SSZ).",
                code="VALIDATION_ERROR",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Resolve host
        host = request.user
        if not host or not host.is_authenticated:
            host, _ = User.objects.get_or_create(
                username='alex',
                defaults={
                    'email': 'alex@example.com',
                    'first_name': 'Alex',
                    'last_name': 'Johnson'
                }
            )

        meeting = services.create_scheduled_meeting(
            host=host,
            title=title,
            description=description,
            scheduled_at=scheduled_at,
            duration_minutes=duration_minutes
        )

        serializer = MeetingSerializer(meeting)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UpcomingMeetingsView(views.APIView):
    """
    GET /api/meetings/upcoming/
    Returns future scheduled meetings hosted by the default user, sorted ascending.
    """
    def get(self, request, *args, **kwargs):
        host = request.user
        if not host or not host.is_authenticated:
            # Fallback to default user
            host = User.objects.filter(username='alex').first()
            if not host:
                return Response([])

        queryset = Meeting.objects.filter(
            host=host,
            meeting_type=Meeting.TYPE_SCHEDULED,
            scheduled_at__gt=timezone.now()
        ).exclude(status__in=[Meeting.STATUS_ENDED, Meeting.STATUS_CANCELLED]).order_by('scheduled_at')

        serializer = MeetingSerializer(queryset, many=True)
        return Response(serializer.data)


class RecentMeetingsView(views.APIView):
    """
    GET /api/meetings/recent/
    Returns recently created/ended meetings, newest first. Limit: 10.
    """
    def get(self, request, *args, **kwargs):
        queryset = Meeting.objects.all().order_by('-created_at')[:10]
        serializer = MeetingSerializer(queryset, many=True)
        return Response(serializer.data)


class MeetingSearchView(views.APIView):
    """
    GET /api/meetings/search/?q=...
    Search title, meeting ID, description.
    """
    def get(self, request, *args, **kwargs):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response([])

        queryset = Meeting.objects.filter(
            Q(title__icontains=q) |
            Q(meeting_id__icontains=q) |
            Q(description__icontains=q)
        )
        serializer = MeetingSerializer(queryset, many=True)
        return Response(serializer.data)


class MeetingDetailView(views.APIView):
    """
    GET /api/meetings/{meeting_id}/
    """
    def get(self, request, meeting_id, *args, **kwargs):
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        serializer = MeetingSerializer(meeting)
        return Response(serializer.data)


class MeetingValidateView(views.APIView):
    """
    GET /api/meetings/{meeting_id}/validate/
    Checks meeting existence and joinability.
    """
    def get(self, request, meeting_id, *args, **kwargs):
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        
        # Check if meeting is joinable
        joinable = meeting.status in [Meeting.STATUS_SCHEDULED, Meeting.STATUS_ACTIVE]
        
        return Response({
            "valid": joinable,
            "meeting_id": meeting.meeting_id,
            "title": meeting.title,
            "status": meeting.status
        })


class JoinMeetingView(views.APIView):
    """
    POST /api/meetings/{meeting_id}/join/
    Creates a participant record.
    """
    def post(self, request, meeting_id, *args, **kwargs):
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        
        display_name = request.data.get('display_name')
        session_id = request.data.get('session_id')

        participant = services.join_meeting(
            meeting=meeting,
            display_name=display_name,
            session_id=session_id,
            user=request.user
        )

        return Response({
            "participant_id": participant.id,
            "meeting_id": meeting.meeting_id,
            "display_name": participant.display_name,
            "is_host": participant.is_host,
            "audio_enabled": participant.audio_enabled,
            "video_enabled": participant.video_enabled,
            "is_active": participant.is_active
        }, status=status.HTTP_201_CREATED)


class LeaveMeetingView(views.APIView):
    """
    POST /api/meetings/{meeting_id}/leave/
    Marks a participant as inactive.
    """
    def post(self, request, meeting_id, *args, **kwargs):
        # We need the meeting and participant_id to mark inactive
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        
        participant_id = request.data.get('participant_id')
        if not participant_id:
            raise CustomAPIException(
                message="Participant ID is required.",
                code="VALIDATION_ERROR",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            participant = MeetingParticipant.objects.get(id=participant_id, meeting=meeting)
        except MeetingParticipant.DoesNotExist:
            raise CustomAPIException(
                message="Participant not found in this meeting.",
                code="PARTICIPANT_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND
            )

        services.leave_meeting(participant)
        return Response({"message": "Successfully left the meeting."}, status=status.HTTP_200_OK)


class ParticipantListView(views.APIView):
    """
    GET /api/meetings/{meeting_id}/participants/
    Lists active participants.
    """
    def get(self, request, meeting_id, *args, **kwargs):
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        active_participants = meeting.participants.filter(is_active=True)
        serializer = MeetingParticipantSerializer(active_participants, many=True)
        return Response(serializer.data)


class ParticipantDetailView(views.APIView):
    """
    PATCH /api/meetings/{meeting_id}/participants/{participant_id}/
    Updates participant media state.
    DELETE /api/meetings/{meeting_id}/participants/{participant_id}/
    Host removes a participant.
    """
    def get_permissions(self):
        # Delete action (remove participant) is host-only
        if self.request.method == 'DELETE':
            return [IsMeetingHost()]
        return []

    def patch(self, request, meeting_id, participant_id, *args, **kwargs):
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        
        try:
            participant = MeetingParticipant.objects.get(id=participant_id, meeting=meeting)
        except MeetingParticipant.DoesNotExist:
            raise CustomAPIException(
                message="Participant not found in this meeting.",
                code="PARTICIPANT_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND
            )

        audio_enabled = request.data.get('audio_enabled')
        video_enabled = request.data.get('video_enabled')

        # Track event log details
        if audio_enabled is not None:
            audio_val = bool(audio_enabled)
            if participant.audio_enabled != audio_val:
                participant.audio_enabled = audio_val
                event_type = MeetingEvent.EVENT_PARTICIPANT_MUTED if not audio_val else MeetingEvent.EVENT_PARTICIPANT_UNMUTED
                MeetingEvent.objects.create(
                    meeting=meeting,
                    participant=participant,
                    event_type=event_type
                )
        
        if video_enabled is not None:
            video_val = bool(video_enabled)
            if participant.video_enabled != video_val:
                participant.video_enabled = video_val
                event_type = MeetingEvent.EVENT_CAMERA_DISABLED if not video_val else MeetingEvent.EVENT_CAMERA_ENABLED
                MeetingEvent.objects.create(
                    meeting=meeting,
                    participant=participant,
                    event_type=event_type
                )

        participant.save()
        serializer = MeetingParticipantSerializer(participant)
        return Response(serializer.data)

    def delete(self, request, meeting_id, participant_id, *args, **kwargs):
        # Host permission is verified by IsMeetingHost in get_permissions()
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        
        try:
            participant = MeetingParticipant.objects.get(id=participant_id, meeting=meeting)
        except MeetingParticipant.DoesNotExist:
            raise CustomAPIException(
                message="Participant not found in this meeting.",
                code="PARTICIPANT_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND
            )

        # Deactivate participant
        participant.is_active = False
        participant.left_at = timezone.now()
        participant.save()

        # Log event
        MeetingEvent.objects.create(
            meeting=meeting,
            participant=participant,
            event_type=MeetingEvent.EVENT_PARTICIPANT_LEFT,
            metadata={"removed_by_host": True}
        )

        # Check if meeting has active participants left, if not end it
        if not meeting.participants.filter(is_active=True).exists():
            services.end_meeting(meeting)

        return Response(status=status.HTTP_204_NO_CONTENT)


class MuteAllParticipantsView(views.APIView):
    """
    POST /api/meetings/{meeting_id}/mute-all/
    Requires host authentication. Mutes all active participants.
    """
    permission_classes = [IsMeetingHost]

    def post(self, request, meeting_id, *args, **kwargs):
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        active_participants = meeting.participants.filter(is_active=True)

        for participant in active_participants:
            if participant.audio_enabled:
                participant.audio_enabled = False
                participant.save()

                MeetingEvent.objects.create(
                    meeting=meeting,
                    participant=participant,
                    event_type=MeetingEvent.EVENT_PARTICIPANT_MUTED,
                    metadata={"muted_by_host": True}
                )

        return Response({"message": "All participants have been muted."}, status=status.HTTP_200_OK)


class MeetingMessageView(views.APIView):
    """
    GET /api/meetings/{meeting_id}/messages/
    POST /api/meetings/{meeting_id}/messages/
    """
    def get(self, request, meeting_id, *args, **kwargs):
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        messages = meeting.messages.all()
        serializer = MeetingMessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request, meeting_id, *args, **kwargs):
        meeting = services.get_meeting_by_meeting_id(meeting_id)
        
        participant_id = request.data.get('participant_id')
        message_text = request.data.get('message')

        if not participant_id:
            raise CustomAPIException(
                message="Participant ID is required to send a message.",
                code="VALIDATION_ERROR",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            participant = MeetingParticipant.objects.get(id=participant_id, meeting=meeting)
        except MeetingParticipant.DoesNotExist:
            raise CustomAPIException(
                message="Participant not found in this meeting.",
                code="PARTICIPANT_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND
            )

        if not participant.is_active:
            raise CustomAPIException(
                message="Inactive participants cannot send messages.",
                code="PERMISSION_DENIED",
                status_code=status.HTTP_403_FORBIDDEN
            )

        # Let the serializer handle validation of the message text
        serializer = MeetingMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Save the message
        message = serializer.save(meeting=meeting)
        
        return Response(MeetingMessageSerializer(message).data, status=status.HTTP_201_CREATED)
