from django.urls import path
from meetings import views

urlpatterns = [
    path('', views.MeetingListCreateView.as_view(), name='meeting-list-create'),
    path('instant/', views.InstantMeetingView.as_view(), name='meeting-instant'),
    path('upcoming/', views.UpcomingMeetingsView.as_view(), name='meeting-upcoming'),
    path('recent/', views.RecentMeetingsView.as_view(), name='meeting-recent'),
    path('search/', views.MeetingSearchView.as_view(), name='meeting-search'),
    path('<str:meeting_id>/', views.MeetingDetailView.as_view(), name='meeting-detail'),
    path('<str:meeting_id>/validate/', views.MeetingValidateView.as_view(), name='meeting-validate'),
    path('<str:meeting_id>/join/', views.JoinMeetingView.as_view(), name='meeting-join'),
    path('<str:meeting_id>/leave/', views.LeaveMeetingView.as_view(), name='meeting-leave'),
    path('<str:meeting_id>/participants/', views.ParticipantListView.as_view(), name='participant-list'),
    path('<str:meeting_id>/participants/<int:participant_id>/', views.ParticipantDetailView.as_view(), name='participant-detail'),
    path('<str:meeting_id>/mute-all/', views.MuteAllParticipantsView.as_view(), name='meeting-mute-all'),
    path('<str:meeting_id>/messages/', views.MeetingMessageView.as_view(), name='meeting-messages'),
]
