from rest_framework import status, views
from rest_framework.response import Response
from django.contrib.auth.models import User
from config.exceptions import CustomAPIException
from notifications.models import Notification
from notifications.serializers import NotificationSerializer

def get_current_user_or_default(request):
    """Utility to resolve current authenticated user or fallback to seeded Alex Johnson."""
    user = request.user
    if not user or not user.is_authenticated:
        user, _ = User.objects.get_or_create(
            username='alex',
            defaults={
                'email': 'alex@example.com',
                'first_name': 'Alex',
                'last_name': 'Johnson'
            }
        )
    return user

class NotificationListCreateView(views.APIView):
    """
    GET /api/notifications/
    Lists notifications for the default/logged-in user, newest first.
    Includes the unread count in the response payload.
    """
    def get(self, request, *args, **kwargs):
        user = get_current_user_or_default(request)
        notifications = Notification.objects.filter(user=user)
        
        unread_count = notifications.filter(is_read=False).count()
        serializer = NotificationSerializer(notifications, many=True)
        
        return Response({
            "unread_count": unread_count,
            "notifications": serializer.data
        })


class NotificationReadView(views.APIView):
    """
    PATCH /api/notifications/{id}/read/
    Marks a specific notification as read.
    """
    def patch(self, request, pk, *args, **kwargs):
        user = get_current_user_or_default(request)
        try:
            notification = Notification.objects.get(id=pk, user=user)
        except Notification.DoesNotExist:
            raise CustomAPIException(
                message="Notification not found.",
                code="NOTIFICATION_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND
            )
        
        notification.is_read = True
        notification.save()
        
        serializer = NotificationSerializer(notification)
        return Response(serializer.data)


class NotificationReadAllView(views.APIView):
    """
    POST /api/notifications/read-all/
    Marks all notifications for the user as read.
    """
    def post(self, request, *args, **kwargs):
        user = get_current_user_or_default(request)
        Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        return Response({"message": "All notifications marked as read."}, status=status.HTTP_200_OK)
