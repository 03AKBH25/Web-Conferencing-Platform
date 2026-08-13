from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from meetings.models import Meeting, MeetingParticipant, MeetingMessage, MeetingEvent
from notifications.models import Notification

class MeetingAPITestCase(APITestCase):

    def setUp(self):
        # Create default host Alex Johnson
        self.host = User.objects.create_user(
            username='alex',
            email='alex@example.com',
            first_name='Alex',
            last_name='Johnson',
            password='alexpassword'
        )
        
        # Another user for permission checks
        self.other_user = User.objects.create_user(
            username='john',
            email='john@example.com',
            first_name='John',
            last_name='Doe',
            password='johnpassword'
        )

        # Basic headers to authenticate as host Alex Johnson
        self.host_headers = {'HTTP_X_DEMO_USER': 'alex'}

    def test_create_instant_meeting(self):
        """POST /api/meetings/instant/ creates a new instant meeting."""
        url = reverse('meeting-instant')
        data = {
            "title": "Quick Standup",
            "description": "Discuss blockers"
        }
        
        # Test anonymous request (should resolve to host Alex Johnson in our backend fallback)
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], "Quick Standup")
        self.assertEqual(response.data['meeting_type'], Meeting.TYPE_INSTANT)
        self.assertEqual(response.data['status'], Meeting.STATUS_SCHEDULED) # Starts scheduled, becomes active on join
        self.assertIsNotNone(response.data['meeting_id'])
        self.assertIn(response.data['meeting_id'], response.data['invite_link'])

    def test_create_scheduled_meeting(self):
        """POST /api/meetings/ creates a scheduled meeting."""
        url = reverse('meeting-list-create')
        future_time = (timezone.now() + timezone.timedelta(days=1)).isoformat()
        
        data = {
            "title": "Sprint Planning",
            "description": "Plan next sprint",
            "scheduled_at": future_time,
            "duration_minutes": 45
        }
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], "Sprint Planning")
        self.assertEqual(response.data['meeting_type'], Meeting.TYPE_SCHEDULED)
        self.assertEqual(response.data['duration_minutes'], 45)

    def test_create_scheduled_meeting_past_date_rejected(self):
        """POST /api/meetings/ fails if scheduled time is in the past."""
        url = reverse('meeting-list-create')
        past_time = (timezone.now() - timezone.timedelta(days=1)).isoformat()
        
        data = {
            "title": "Past Meeting",
            "scheduled_at": past_time,
            "duration_minutes": 60
        }
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['code'], "VALIDATION_ERROR")

    def test_meeting_retrieval(self):
        """GET /api/meetings/{meeting_id}/ retrieves meeting details successfully."""
        meeting = Meeting.objects.create(
            meeting_id='123-456-789',
            title='Sample Meeting',
            host=self.host,
            status=Meeting.STATUS_SCHEDULED,
            meeting_type=Meeting.TYPE_INSTANT
        )
        
        # Valid retrieval
        url = reverse('meeting-detail', kwargs={'meeting_id': '123-456-789'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Sample Meeting')
        
        # Invalid retrieval
        url_invalid = reverse('meeting-detail', kwargs={'meeting_id': '999-999-999'})
        response_invalid = self.client.get(url_invalid)
        self.assertEqual(response_invalid.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response_invalid.data['error']['code'], 'MEETING_NOT_FOUND')

    def test_meeting_validation(self):
        """GET /api/meetings/{meeting_id}/validate/ checks joinability."""
        meeting = Meeting.objects.create(
            meeting_id='123-456-789',
            title='Sample Meeting',
            host=self.host,
            status=Meeting.STATUS_SCHEDULED
        )
        
        url = reverse('meeting-validate', kwargs={'meeting_id': '123-456-789'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        
        # End the meeting and validate again
        meeting.status = Meeting.STATUS_ENDED
        meeting.save()
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['valid'])

    def test_join_meeting(self):
        """POST /api/meetings/{meeting_id}/join/ registers a participant."""
        meeting = Meeting.objects.create(
            meeting_id='123-456-789',
            title='Instant Standup',
            host=self.host,
            status=Meeting.STATUS_SCHEDULED,
            meeting_type=Meeting.TYPE_INSTANT
        )
        
        url = reverse('meeting-join', kwargs={'meeting_id': '123-456-789'})
        data = {
            "display_name": "Bob Vance",
            "session_id": "bob-sess-abc"
        }
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['display_name'], "Bob Vance")
        self.assertEqual(response.data['is_host'], False)
        
        # Verify the meeting status transitioned to active on first join (since it's an instant meeting)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_ACTIVE)
        
        # Verify participant was created in database
        participant_exists = MeetingParticipant.objects.filter(session_id="bob-sess-abc", meeting=meeting).exists()
        self.assertTrue(participant_exists)

    def test_join_ended_meeting_rejected(self):
        """POST /api/meetings/{meeting_id}/join/ fails for ended meetings."""
        meeting = Meeting.objects.create(
            meeting_id='123-456-789',
            title='Ended Meeting',
            host=self.host,
            status=Meeting.STATUS_ENDED
        )
        
        url = reverse('meeting-join', kwargs={'meeting_id': '123-456-789'})
        data = {
            "display_name": "Bob Vance",
            "session_id": "bob-sess-abc"
        }
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['code'], "MEETING_NOT_JOINABLE")

    def test_leave_meeting(self):
        """POST /api/meetings/{meeting_id}/leave/ marks participant as inactive."""
        meeting = Meeting.objects.create(
            meeting_id='123-456-789',
            title='Sample Meeting',
            host=self.host,
            status=Meeting.STATUS_ACTIVE
        )
        
        participant = MeetingParticipant.objects.create(
            meeting=meeting,
            display_name="Bob Vance",
            session_id="bob-sess-abc",
            is_active=True
        )
        
        url = reverse('meeting-leave', kwargs={'meeting_id': '123-456-789'})
        data = {
            "participant_id": participant.id
        }
        
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh from database and check status
        participant.refresh_from_db()
        self.assertFalse(participant.is_active)
        self.assertIsNotNone(participant.left_at)

    def test_host_remove_participant(self):
        """DELETE /api/meetings/{meeting_id}/participants/{participant_id}/ removes participant if host."""
        meeting = Meeting.objects.create(
            meeting_id='123-456-789',
            title='Sample Meeting',
            host=self.host,
            status=Meeting.STATUS_ACTIVE
        )
        
        participant = MeetingParticipant.objects.create(
            meeting=meeting,
            display_name="Bob Vance",
            session_id="bob-sess-abc",
            is_active=True
        )
        
        url = reverse('participant-detail', kwargs={'meeting_id': '123-456-789', 'participant_id': participant.id})
        
        # 1. Test removing without host credentials (should fail)
        response_fail = self.client.delete(url)
        self.assertEqual(response_fail.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response_fail.data['error']['code'], "PERMISSION_DENIED")
        
        # 2. Test removing with host credentials (should succeed)
        response_success = self.client.delete(url, **self.host_headers)
        self.assertEqual(response_success.status_code, status.HTTP_204_NO_CONTENT)
        
        participant.refresh_from_db()
        self.assertFalse(participant.is_active)

    def test_meetings_upcoming_and_recent(self):
        """GET /api/meetings/upcoming/ and recent/ return filtered meetings."""
        # 1. Create a future scheduled meeting
        future_time = timezone.now() + timezone.timedelta(days=1)
        meeting_upcoming = Meeting.objects.create(
            meeting_id='222-333-444',
            title='Upcoming standup',
            host=self.host,
            status=Meeting.STATUS_SCHEDULED,
            meeting_type=Meeting.TYPE_SCHEDULED,
            scheduled_at=future_time
        )
        
        # 2. Create a past scheduled meeting
        past_time = timezone.now() - timezone.timedelta(days=1)
        meeting_past = Meeting.objects.create(
            meeting_id='555-666-777',
            title='Past review',
            host=self.host,
            status=Meeting.STATUS_ENDED,
            meeting_type=Meeting.TYPE_SCHEDULED,
            scheduled_at=past_time
        )

        # Test upcoming endpoint
        url_upcoming = reverse('meeting-upcoming')
        response = self.client.get(url_upcoming, **self.host_headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should contain only upcoming Standup
        meeting_ids = [m['meeting_id'] for m in response.data]
        self.assertIn('222-333-444', meeting_ids)
        self.assertNotIn('555-666-777', meeting_ids)

        # Test recent endpoint
        url_recent = reverse('meeting-recent')
        response_recent = self.client.get(url_recent)
        self.assertEqual(response_recent.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_recent.data), 2)

    def test_meeting_search(self):
        """GET /api/meetings/search/?q=... returns matching meetings."""
        Meeting.objects.create(
            meeting_id='111-222-333',
            title='Design Critique',
            host=self.host,
            status=Meeting.STATUS_SCHEDULED
        )
        Meeting.objects.create(
            meeting_id='444-555-666',
            title='Marketing Huddle',
            host=self.host,
            status=Meeting.STATUS_SCHEDULED
        )

        url = reverse('meeting-search')
        
        # Search for Critique
        response = self.client.get(url, {'q': 'Design'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['meeting_id'], '111-222-333')

        # Search for ID
        response_id = self.client.get(url, {'q': '444-555-666'})
        self.assertEqual(response_id.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_id.data), 1)
        self.assertEqual(response_id.data[0]['title'], 'Marketing Huddle')

    def test_notifications(self):
        """Notification endpoints retrieve and read notifications."""
        notification = Notification.objects.create(
            user=self.host,
            type=Notification.TYPE_MEETING_CREATED,
            title="Meeting Scheduled",
            message="Your meeting is scheduled.",
            is_read=False
        )

        url_list = reverse('notification-list')
        url_read = reverse('notification-read', kwargs={'pk': notification.id})
        url_read_all = reverse('notification-read-all')

        # 1. List notifications (retrieve unread count)
        response = self.client.get(url_list, **self.host_headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unread_count'], 1)
        self.assertEqual(len(response.data['notifications']), 1)

        # 2. Mark one read
        response_read = self.client.patch(url_read, {}, **self.host_headers)
        self.assertEqual(response_read.status_code, status.HTTP_200_OK)
        self.assertTrue(response_read.data['is_read'])

        # Verify unread count is now 0
        response_count = self.client.get(url_list, **self.host_headers)
        self.assertEqual(response_count.data['unread_count'], 0)
