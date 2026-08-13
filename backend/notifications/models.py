from django.db import models
from django.contrib.auth.models import User
from meetings.models import Meeting

class Notification(models.Model):
    TYPE_MEETING_CREATED = 'meeting_created'
    TYPE_MEETING_UPDATED = 'meeting_updated'
    TYPE_MEETING_STARTING = 'meeting_starting'
    TYPE_MEETING_CANCELLED = 'meeting_cancelled'
    TYPE_PARTICIPANT_JOINED = 'participant_joined'

    TYPE_CHOICES = [
        (TYPE_MEETING_CREATED, 'Meeting Created'),
        (TYPE_MEETING_UPDATED, 'Meeting Updated'),
        (TYPE_MEETING_STARTING, 'Meeting Starting'),
        (TYPE_MEETING_CANCELLED, 'Meeting Cancelled'),
        (TYPE_PARTICIPANT_JOINED, 'Participant Joined'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', db_index=True)
    type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    meeting = models.ForeignKey(Meeting, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.username}: {self.title} (Read: {self.is_read})"
