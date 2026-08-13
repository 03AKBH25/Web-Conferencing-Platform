from rest_framework import permissions
from meetings.models import Meeting
from config.exceptions import CustomAPIException
from rest_framework import status

class IsMeetingHost(permissions.BasePermission):
    """
    Permission class that checks if the requesting user is the host of the meeting.
    Resolves meeting_id from view kwargs.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        meeting_id = view.kwargs.get('meeting_id')
        if not meeting_id:
            # Fallback if meeting_id is not in path (e.g., detail view of meeting itself)
            # which might map to pk or meeting_id.
            meeting_id = view.kwargs.get('pk')

        if not meeting_id:
            return False

        try:
            meeting = Meeting.objects.get(meeting_id=meeting_id)
            is_host = (meeting.host == request.user)
            if not is_host:
                raise CustomAPIException(
                    message="You do not have permission to perform this action.",
                    code="PERMISSION_DENIED",
                    status_code=status.HTTP_403_FORBIDDEN
                )
            return True
        except Meeting.DoesNotExist:
            raise CustomAPIException(
                message="The requested meeting could not be found.",
                code="MEETING_NOT_FOUND",
                status_code=status.HTTP_404_NOT_FOUND
            )
