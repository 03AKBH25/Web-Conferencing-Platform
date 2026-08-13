from rest_framework import serializers
from django.contrib.auth.models import User
from accounts.serializers import UserSerializer
from meetings.models import Meeting, MeetingParticipant, MeetingMessage, MeetingEvent

class MeetingParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = MeetingParticipant
        fields = [
            'id', 
            'display_name', 
            'session_id', 
            'is_host', 
            'audio_enabled', 
            'video_enabled', 
            'is_active', 
            'joined_at', 
            'left_at'
        ]
        read_only_fields = ['id', 'is_host', 'joined_at', 'left_at']


class MeetingSerializer(serializers.ModelSerializer):
    host = UserSerializer(read_only=True)
    participant_count = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            'id', 
            'meeting_id', 
            'title', 
            'description', 
            'host', 
            'scheduled_at', 
            'duration_minutes', 
            'status', 
            'meeting_type',
            'invite_link', 
            'participant_count',
            'created_at', 
            'updated_at'
        ]
        read_only_fields = ['id', 'meeting_id', 'status', 'meeting_type', 'invite_link', 'created_at', 'updated_at']

    def get_participant_count(self, obj):
        # Return count of active participants
        return obj.participants.filter(is_active=True).count()


class MeetingMessageSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='participant.display_name', read_only=True)
    participant_id = serializers.PrimaryKeyRelatedField(
        queryset=MeetingParticipant.objects.all(), 
        source='participant'
    )
    is_host = serializers.BooleanField(source='participant.is_host', read_only=True)

    class Meta:
        model = MeetingMessage
        fields = [
            'id', 
            'participant_id', 
            'display_name', 
            'is_host',
            'message', 
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate_message(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Message cannot be empty.")
        if len(value) > 2000:
            raise serializers.ValidationError("Message exceeds maximum length of 2000 characters.")
        return value.strip()


class MeetingEventSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='participant.display_name', read_only=True, default='System')

    class Meta:
        model = MeetingEvent
        fields = [
            'id', 
            'event_type', 
            'display_name', 
            'metadata', 
            'created_at'
        ]
