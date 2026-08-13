from django.urls import path
from meetings.consumers import MeetingRoomConsumer

websocket_urlpatterns = [
    path('ws/meetings/<str:meeting_id>/', MeetingRoomConsumer.as_asgi()),
]
