from django.contrib import admin
from meetings.models import Meeting, MeetingParticipant, MeetingMessage, MeetingEvent

@admin.register(Meeting)
class MeetingAdmin(admin.ModelAdmin):
    list_display = ('meeting_id', 'title', 'status', 'meeting_type', 'host', 'scheduled_at', 'created_at')
    list_filter = ('status', 'meeting_type', 'created_at', 'scheduled_at')
    search_fields = ('meeting_id', 'title', 'description', 'host__username', 'host__email')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)


@admin.register(MeetingParticipant)
class MeetingParticipantAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'meeting', 'user', 'session_id', 'is_host', 'is_active', 'joined_at', 'left_at')
    list_filter = ('is_host', 'is_active', 'joined_at', 'left_at')
    search_fields = ('display_name', 'session_id', 'meeting__meeting_id', 'meeting__title', 'user__username')
    ordering = ('-joined_at',)


@admin.register(MeetingMessage)
class MeetingMessageAdmin(admin.ModelAdmin):
    list_display = ('meeting', 'participant', 'message_snippet', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('message', 'participant__display_name', 'meeting__meeting_id')
    ordering = ('created_at',)

    def message_snippet(self, obj):
        return obj.message[:50] + '...' if len(obj.message) > 50 else obj.message
    message_snippet.short_description = 'Message'


@admin.register(MeetingEvent)
class MeetingEventAdmin(admin.ModelAdmin):
    list_display = ('meeting', 'participant', 'event_type', 'created_at')
    list_filter = ('event_type', 'created_at')
    search_fields = ('meeting__meeting_id', 'participant__display_name', 'event_type')
    ordering = ('-created_at',)
