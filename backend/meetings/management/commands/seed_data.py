from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from meetings.models import Meeting, MeetingParticipant, MeetingMessage, MeetingEvent
from meetings import services
from notifications.models import Notification

class Command(BaseCommand):
    help = 'Seeds default user and realistic meetings for testing and development'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # 1. Create or get default user Alex Johnson
        host, created = User.objects.get_or_create(
            username='alex',
            defaults={
                'email': 'alex@example.com',
                'first_name': 'Alex',
                'last_name': 'Johnson',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            host.set_password('alex123')
            host.save()
            self.stdout.write(self.style.SUCCESS(f'Created default host: {host.username} (password: alex123)'))
        else:
            self.stdout.write(f'Host {host.username} already exists.')

        # 2. Check if seed meetings already exist
        if Meeting.objects.filter(host=host).exists():
            self.stdout.write('Meetings already exist for host. Skipping duplicate creation.')
            # Let's verify we have at least notifications and some messages
            self.stdout.write(self.style.SUCCESS('Database seeding complete (already seeded).'))
            return

        now = timezone.now()

        # Meeting 1: Instant/recent meeting (Ended yesterday)
        self.stdout.write('Creating Meeting 1: Client Discussion (Past, Ended)')
        past_time = now - timezone.timedelta(days=1, hours=3)
        client_meeting = Meeting.objects.create(
            meeting_id='111-222-333',
            title='Client Discussion',
            description='Project handoff and final review with client.',
            host=host,
            scheduled_at=past_time,
            duration_minutes=60,
            status=Meeting.STATUS_ENDED,
            meeting_type=Meeting.TYPE_SCHEDULED,
            invite_link=services.generate_invite_link('111-222-333'),
            created_at=past_time - timezone.timedelta(days=2)
        )
        # Create events & participants for history
        p1 = MeetingParticipant.objects.create(
            meeting=client_meeting,
            user=host,
            display_name='Alex Johnson',
            session_id='alex-sess-111',
            is_host=True,
            is_active=False,
            joined_at=past_time,
            left_at=past_time + timezone.timedelta(minutes=55)
        )
        p2 = MeetingParticipant.objects.create(
            meeting=client_meeting,
            user=None,
            display_name='Sarah Miller (Client)',
            session_id='sarah-sess-111',
            is_host=False,
            is_active=False,
            joined_at=past_time + timezone.timedelta(minutes=2),
            left_at=past_time + timezone.timedelta(minutes=50)
        )
        # Log events
        MeetingEvent.objects.create(
            meeting=client_meeting,
            event_type=MeetingEvent.EVENT_MEETING_CREATED,
            created_at=past_time - timezone.timedelta(days=2)
        )
        MeetingEvent.objects.create(
            meeting=client_meeting,
            participant=p1,
            event_type=MeetingEvent.EVENT_PARTICIPANT_JOINED,
            created_at=past_time
        )
        MeetingEvent.objects.create(
            meeting=client_meeting,
            participant=p2,
            event_type=MeetingEvent.EVENT_PARTICIPANT_JOINED,
            created_at=past_time + timezone.timedelta(minutes=2)
        )
        # Chat message
        MeetingMessage.objects.create(
            meeting=client_meeting,
            participant=p2,
            message='Thank you for the updates! Excited to launch.',
            created_at=past_time + timezone.timedelta(minutes=20)
        )
        MeetingMessage.objects.create(
            meeting=client_meeting,
            participant=p1,
            message='You are welcome! We are ready.',
            created_at=past_time + timezone.timedelta(minutes=22)
        )
        # Leave events
        MeetingEvent.objects.create(
            meeting=client_meeting,
            participant=p2,
            event_type=MeetingEvent.EVENT_PARTICIPANT_LEFT,
            created_at=past_time + timezone.timedelta(minutes=50)
        )
        MeetingEvent.objects.create(
            meeting=client_meeting,
            participant=p1,
            event_type=MeetingEvent.EVENT_PARTICIPANT_LEFT,
            created_at=past_time + timezone.timedelta(minutes=55)
        )
        MeetingEvent.objects.create(
            meeting=client_meeting,
            event_type=MeetingEvent.EVENT_MEETING_ENDED,
            created_at=past_time + timezone.timedelta(minutes=55)
        )

        # Meeting 2: Instant meeting (Active right now with participants)
        self.stdout.write('Creating Meeting 2: Instant Sync (Active)')
        active_meeting = Meeting.objects.create(
            meeting_id='999-888-777',
            title='Instant Sync',
            description='Quick huddle on blockers.',
            host=host,
            scheduled_at=now,
            duration_minutes=60,
            status=Meeting.STATUS_ACTIVE,
            meeting_type=Meeting.TYPE_INSTANT,
            invite_link=services.generate_invite_link('999-888-777'),
            created_at=now - timezone.timedelta(minutes=15)
        )
        MeetingEvent.objects.create(
            meeting=active_meeting,
            event_type=MeetingEvent.EVENT_MEETING_CREATED,
            created_at=now - timezone.timedelta(minutes=15)
        )
        MeetingEvent.objects.create(
            meeting=active_meeting,
            event_type=MeetingEvent.EVENT_MEETING_STARTED,
            created_at=now - timezone.timedelta(minutes=15)
        )
        # Add host as active participant
        host_part = MeetingParticipant.objects.create(
            meeting=active_meeting,
            user=host,
            display_name='Alex Johnson',
            session_id='alex-active-sess',
            is_host=True,
            is_active=True,
            joined_at=now - timezone.timedelta(minutes=14)
        )
        MeetingEvent.objects.create(
            meeting=active_meeting,
            participant=host_part,
            event_type=MeetingEvent.EVENT_PARTICIPANT_JOINED,
            created_at=now - timezone.timedelta(minutes=14)
        )
        # Add guest as active participant
        guest_part = MeetingParticipant.objects.create(
            meeting=active_meeting,
            user=None,
            display_name='David Kim',
            session_id='david-active-sess',
            is_host=False,
            is_active=True,
            joined_at=now - timezone.timedelta(minutes=10)
        )
        MeetingEvent.objects.create(
            meeting=active_meeting,
            participant=guest_part,
            event_type=MeetingEvent.EVENT_PARTICIPANT_JOINED,
            created_at=now - timezone.timedelta(minutes=10)
        )
        # Add messages
        MeetingMessage.objects.create(
            meeting=active_meeting,
            participant=host_part,
            message='Hey David, thanks for jumping in.',
            created_at=now - timezone.timedelta(minutes=9)
        )
        MeetingMessage.objects.create(
            meeting=active_meeting,
            participant=guest_part,
            message='No problem. Let me share my screen.',
            created_at=now - timezone.timedelta(minutes=8)
        )

        # Meeting 3: Upcoming Standup (Scheduled for tomorrow morning)
        self.stdout.write('Creating Meeting 3: Team Standup (Upcoming)')
        tomorrow_standup = now + timezone.timedelta(days=1)
        tomorrow_standup = tomorrow_standup.replace(hour=10, minute=0, second=0, microsecond=0)
        services.create_scheduled_meeting(
            host=host,
            title='Team Standup',
            description='Daily alignment standup.',
            scheduled_at=tomorrow_standup,
            duration_minutes=30
        )

        # Meeting 4: Product Review (Scheduled for day after tomorrow)
        self.stdout.write('Creating Meeting 4: Product Review (Upcoming)')
        after_tomorrow = now + timezone.timedelta(days=2)
        after_tomorrow = after_tomorrow.replace(hour=15, minute=0, second=0, microsecond=0)
        services.create_scheduled_meeting(
            host=host,
            title='Product Review',
            description='Walkthrough of UX prototypes and feedback.',
            scheduled_at=after_tomorrow,
            duration_minutes=60
        )

        # Meeting 5: Engineering Sync (Scheduled for next week)
        self.stdout.write('Creating Meeting 5: Engineering Sync (Upcoming)')
        next_week = now + timezone.timedelta(days=7)
        next_week = next_week.replace(hour=14, minute=0, second=0, microsecond=0)
        services.create_scheduled_meeting(
            host=host,
            title='Engineering Sync',
            description='Architecture discussion for Django Channels integration.',
            scheduled_at=next_week,
            duration_minutes=45
        )

        # 3. Create generic notification history
        Notification.objects.create(
            user=host,
            type=Notification.TYPE_MEETING_CREATED,
            title="Meeting Scheduled: Engineering Sync",
            message="Meeting 'Engineering Sync' has been scheduled successfully.",
            is_read=True
        )
        Notification.objects.create(
            user=host,
            type=Notification.TYPE_PARTICIPANT_JOINED,
            title="David Kim joined 'Instant Sync'",
            message="David Kim has joined your active instant meeting.",
            is_read=False
        )

        self.stdout.write(self.style.SUCCESS('Database seeding complete successfully!'))
