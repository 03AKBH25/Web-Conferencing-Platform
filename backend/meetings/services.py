import random
from django.utils import timezone
from django.conf import settings
from django.contrib.auth.models import User
from config.exceptions import CustomAPIException
from rest_framework import status
from meetings.models import Meeting, MeetingParticipant, MeetingEvent, MeetingMessage
from notifications.models import Notification

def generate_meeting_id():
    """
    Generates a unique, human-readable meeting ID in format '123-456-789'.
    Verifies uniqueness in the database.
    """
    while True:
        part1 = random.randint(100, 999)
        part2 = random.randint(100, 999)
        part3 = random.randint(100, 999)
        meeting_id = f"{part1}-{part2}-{part3}"
        if not Meeting.objects.filter(meeting_id=meeting_id).exists():
            return meeting_id

def generate_invite_link(meeting_id):
    """
    Generates an invite link using FRONTEND_URL from settings.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    frontend_url = frontend_url.rstrip('/')
    return f"{frontend_url}/meeting/{meeting_id}"

def get_meeting_by_meeting_id(meeting_id):
    """
    Retrieves a meeting by its meeting_id, raising a CustomAPIException if not found.
    """
    try:
        return Meeting.objects.get(meeting_id=meeting_id)
    except Meeting.DoesNotExist:
        raise CustomAPIException(
            message="The requested meeting could not be found.",
            code="MEETING_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND
        )

def create_instant_meeting(host, title="Instant Meeting", description=""):
    """
    Creates an instant meeting. It starts in 'scheduled' state and becomes
    'active' when the first participant joins.
    """
    meeting_id = generate_meeting_id()
    invite_link = generate_invite_link(meeting_id)

    meeting = Meeting.objects.create(
        meeting_id=meeting_id,
        title=title or "Instant Meeting",
        description=description,
        host=host,
        scheduled_at=timezone.now(),
        duration_minutes=60,
        status=Meeting.STATUS_SCHEDULED,
        meeting_type=Meeting.TYPE_INSTANT,
        invite_link=invite_link
    )

    # Log meeting created event
    MeetingEvent.objects.create(
        meeting=meeting,
        event_type=MeetingEvent.EVENT_MEETING_CREATED,
        metadata={"created_by": host.username, "type": "instant"}
    )

    # Create host notification
    Notification.objects.create(
        user=host,
        type=Notification.TYPE_MEETING_CREATED,
        title="Instant Meeting Created",
        message=f"Your instant meeting '{meeting.title}' is ready. ID: {meeting.meeting_id}",
        meeting=meeting
    )

    return meeting

def create_scheduled_meeting(host, title, description, scheduled_at, duration_minutes=60):
    """
    Creates a scheduled meeting, verifying scheduled_at is in the future.
    """
    if not title:
        raise CustomAPIException(
            message="Meeting title is required.",
            code="VALIDATION_ERROR",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if not scheduled_at:
        raise CustomAPIException(
            message="Scheduled time is required for scheduled meetings.",
            code="VALIDATION_ERROR",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if scheduled_at < timezone.now():
        raise CustomAPIException(
            message="Scheduled time must be in the future.",
            code="VALIDATION_ERROR",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if not isinstance(duration_minutes, int) or duration_minutes <= 0:
        raise CustomAPIException(
            message="Duration must be a positive integer.",
            code="INVALID_DURATION",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    meeting_id = generate_meeting_id()
    invite_link = generate_invite_link(meeting_id)

    meeting = Meeting.objects.create(
        meeting_id=meeting_id,
        title=title,
        description=description or "",
        host=host,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        status=Meeting.STATUS_SCHEDULED,
        meeting_type=Meeting.TYPE_SCHEDULED,
        invite_link=invite_link
    )

    # Log event
    MeetingEvent.objects.create(
        meeting=meeting,
        event_type=MeetingEvent.EVENT_MEETING_CREATED,
        metadata={"created_by": host.username, "type": "scheduled"}
    )

    # Create host notification
    Notification.objects.create(
        user=host,
        type=Notification.TYPE_MEETING_CREATED,
        title="Meeting Scheduled",
        message=f"Meeting '{meeting.title}' is scheduled for {meeting.scheduled_at.strftime('%Y-%m-%d %H:%M UTC')}.",
        meeting=meeting
    )

    return meeting

def start_meeting(meeting):
    """
    Transitions a meeting status to active.
    """
    if meeting.status == Meeting.STATUS_ACTIVE:
        return meeting

    if meeting.status in [Meeting.STATUS_ENDED, Meeting.STATUS_CANCELLED]:
        raise CustomAPIException(
            message=f"Cannot start a meeting that has already been {meeting.status}.",
            code="MEETING_NOT_JOINABLE",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    meeting.status = Meeting.STATUS_ACTIVE
    meeting.save()

    MeetingEvent.objects.create(
        meeting=meeting,
        event_type=MeetingEvent.EVENT_MEETING_STARTED,
        metadata={"started_at": str(timezone.now())}
    )

    return meeting

def end_meeting(meeting):
    """
    Ends a meeting, marking all active participants as inactive.
    """
    if meeting.status == Meeting.STATUS_ENDED:
        return meeting

    meeting.status = Meeting.STATUS_ENDED
    meeting.save()

    # Deactivate all active participants
    active_participants = meeting.participants.filter(is_active=True)
    now = timezone.now()
    for participant in active_participants:
        participant.is_active = False
        participant.left_at = now
        participant.save()

        MeetingEvent.objects.create(
            meeting=meeting,
            participant=participant,
            event_type=MeetingEvent.EVENT_PARTICIPANT_LEFT,
            metadata={"reason": "meeting_ended"}
        )

    MeetingEvent.objects.create(
        meeting=meeting,
        event_type=MeetingEvent.EVENT_MEETING_ENDED,
        metadata={"ended_at": str(now)}
    )

    return meeting

def cancel_meeting(meeting):
    """
    Cancels a scheduled meeting.
    """
    if meeting.status in [Meeting.STATUS_ENDED, Meeting.STATUS_CANCELLED]:
        return meeting

    meeting.status = Meeting.STATUS_CANCELLED
    meeting.save()

    # Deactivate participants
    active_participants = meeting.participants.filter(is_active=True)
    now = timezone.now()
    for participant in active_participants:
        participant.is_active = False
        participant.left_at = now
        participant.save()

    MeetingEvent.objects.create(
        meeting=meeting,
        event_type=MeetingEvent.EVENT_MEETING_ENDED,
        metadata={"reason": "cancelled"}
    )

    # Notify host
    Notification.objects.create(
        user=meeting.host,
        type=Notification.TYPE_MEETING_CANCELLED,
        title="Meeting Cancelled",
        message=f"Meeting '{meeting.title}' has been cancelled.",
        meeting=meeting
    )

    return meeting

def join_meeting(meeting, display_name, session_id, user=None):
    """
    Adds a participant to the meeting.
    If the participant already exists with an active session, returns it.
    If this is the first participant of an instant meeting, transitions meeting to active.
    """
    if meeting.status in [Meeting.STATUS_ENDED, Meeting.STATUS_CANCELLED]:
        raise CustomAPIException(
            message="This meeting has ended or was cancelled.",
            code="MEETING_NOT_JOINABLE",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if not display_name or not display_name.strip():
        raise CustomAPIException(
            message="Display name is required.",
            code="INVALID_DISPLAY_NAME",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if not session_id or not session_id.strip():
        raise CustomAPIException(
            message="Session ID is required.",
            code="VALIDATION_ERROR",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # Check if this participant is already active with the same session_id
    existing_participant = meeting.participants.filter(session_id=session_id, is_active=True).first()
    if existing_participant:
        return existing_participant

    # Determine host status
    # Derived from host relationship or if the user is authenticated and matches host
    is_host = False
    if user and user.is_authenticated and meeting.host == user:
        is_host = True

    # Transition instant meeting to active on first join
    if meeting.meeting_type == Meeting.TYPE_INSTANT and meeting.status == Meeting.STATUS_SCHEDULED:
        start_meeting(meeting)

    participant = MeetingParticipant.objects.create(
        meeting=meeting,
        user=user if (user and user.is_authenticated) else None,
        display_name=display_name.strip(),
        session_id=session_id.strip(),
        is_host=is_host,
        is_active=True
    )

    # Record join event
    MeetingEvent.objects.create(
        meeting=meeting,
        participant=participant,
        event_type=MeetingEvent.EVENT_PARTICIPANT_JOINED,
        metadata={"session_id": session_id, "is_host": is_host}
    )

    # Notify host if someone else joins
    if not is_host:
        Notification.objects.create(
            user=meeting.host,
            type=Notification.TYPE_PARTICIPANT_JOINED,
            title="Participant Joined",
            message=f"{participant.display_name} has joined your meeting '{meeting.title}'.",
            meeting=meeting
        )

    return participant

def leave_meeting(participant):
    """
    Processes participant leaving the meeting.
    If no active participants remain, ends the meeting.
    """
    if not participant.is_active:
        return participant

    participant.is_active = False
    participant.left_at = timezone.now()
    participant.save()

    MeetingEvent.objects.create(
        meeting=participant.meeting,
        participant=participant,
        event_type=MeetingEvent.EVENT_PARTICIPANT_LEFT,
        metadata={"session_id": participant.session_id}
    )

    # Check if there are any active participants remaining in the meeting
    active_exists = participant.meeting.participants.filter(is_active=True).exists()
    if not active_exists:
        # End meeting automatically
        end_meeting(participant.meeting)

    return participant
