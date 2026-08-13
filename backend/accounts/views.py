from rest_framework import views
from rest_framework.response import Response
from accounts.serializers import UserSerializer
from notifications.views import get_current_user_or_default

class MeView(views.APIView):
    """
    GET /api/accounts/me/
    Returns details of the currently authenticated user (or the default Alex Johnson).
    """
    def get(self, request, *args, **kwargs):
        user = get_current_user_or_default(request)
        serializer = UserSerializer(user)
        return Response(serializer.data)
