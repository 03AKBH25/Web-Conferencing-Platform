from django.db import models
from django.contrib.auth.models import User

class Meeting(models.Model):
    STATUS_SCHEDULED = 'scheduled'
    STATUS_ACTIVE = 'active'
    STATUS_ENDED = 'ended'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_SCHEDULED, 'Scheduled'),
        (STATUS_ACTIVE, 'Active'),
        (STATUS_ENDED, 'Ended'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    TYPE_INSTANT = 'instant'
    TYPE_SCHEDULED = 'scheduled'

    TYPE_CHOICES = [
        (TYPE_INSTANT, 'Instant'),
        (TYPE_SCHEDULED, 'Scheduled'),
    ]

    meeting_id = models.CharField(max_length=20, unique=True, db_index=True)
    title = models.CharField(max_length=255, default="Instant Meeting")
    description = models.TextField(blank=True, default="")
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_meetings')
    scheduled_at = models.DateTimeField(null=True, blank=True, db_index=True)
    duration_minutes = models.IntegerField(default=60)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SCHEDULED, db_index=True)
    meeting_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_INSTANT)
    invite_link = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.meeting_id}) - {self.status}"


class MeetingParticipant(models.Model):
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='participants', db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='meeting_participations')
    display_name = models.CharField(max_length=100)
    session_id = models.CharField(max_length=255, db_index=True)
    is_host = models.BooleanField(default=False)
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    audio_enabled = models.BooleanField(default=True)
    video_enabled = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.display_name} in {self.meeting.meeting_id} (Active: {self.is_active})"


class MeetingMessage(models.Model):
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='messages', db_index=True)
    participant = models.ForeignKey(MeetingParticipant, on_delete=models.CASCADE, related_name='messages')
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.participant.display_name}: {self.message[:30]}..."


class MeetingEvent(models.Model):
    EVENT_MEETING_CREATED = 'meeting_created'
    EVENT_MEETING_STARTED = 'meeting_started'
    EVENT_MEETING_ENDED = 'meeting_ended'
    EVENT_PARTICIPANT_JOINED = 'participant_joined'
    EVENT_PARTICIPANT_LEFT = 'participant_left'
    EVENT_PARTICIPANT_MUTED = 'participant_muted'
    EVENT_PARTICIPANT_UNMUTED = 'participant_unmuted'
    EVENT_CAMERA_ENABLED = 'camera_enabled'
    EVENT_CAMERA_DISABLED = 'camera_disabled'

    EVENT_CHOICES = [
        (EVENT_MEETING_CREATED, 'Meeting Created'),
        (EVENT_MEETING_STARTED, 'Meeting Started'),
        (EVENT_MEETING_ENDED, 'Meeting Ended'),
        (EVENT_PARTICIPANT_JOINED, 'Participant Joined'),
        (EVENT_PARTICIPANT_LEFT, 'Participant Left'),
        (EVENT_PARTICIPANT_MUTED, 'Participant Muted'),
        (EVENT_PARTICIPANT_UNMUTED, 'Participant Unmuted'),
        (EVENT_CAMERA_ENABLED, 'Camera Enabled'),
        (EVENT_CAMERA_DISABLED, 'Camera Disabled'),
    ]

    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name='events', db_index=True)
    participant = models.ForeignKey(MeetingParticipant, on_delete=models.SET_NULL, null=True, blank=True, related_name='events')
    event_type = models.CharField(max_length=50, choices=EVENT_CHOICES)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        participant_name = self.participant.display_name if self.participant else 'System'
        return f"{self.event_type} by {participant_name} at {self.created_at}"
