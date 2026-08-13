from rest_framework import serializers
from notifications.models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    meeting_id = serializers.CharField(source='meeting.meeting_id', read_only=True, default=None)

    class Meta:
        model = Notification
        fields = [
            'id',
            'type',
            'title',
            'message',
            'meeting_id',
            'is_read',
            'created_at'
        ]
        read_only_fields = ['id', 'type', 'title', 'message', 'meeting_id', 'created_at']
