from rest_framework.views import exception_handler
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound, NotAuthenticated
from rest_framework.response import Response
from rest_framework import status

class CustomAPIException(Exception):
    """Base class for custom meeting API exceptions."""
    status_code = status.HTTP_400_BAD_REQUEST
    code = "VALIDATION_ERROR"
    message = "An error occurred."

    def __init__(self, message=None, code=None, status_code=None):
        if message is not None:
            self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.message)

def custom_exception_handler(exc, context):
    # Call DRF's default exception handler first to get the standard error response
    response = exception_handler(exc, context)

    if isinstance(exc, CustomAPIException):
        return Response(
            {
                "error": {
                    "code": exc.code,
                    "message": exc.message
                }
            },
            status=exc.status_code
        )

    if response is not None:
        # Extract and format message
        message = ""
        code = "VALIDATION_ERROR"
        
        if isinstance(exc, ValidationError):
            # Parse DRF validation errors into a readable string
            errors = []
            if isinstance(response.data, dict):
                for field, errs in response.data.items():
                    if isinstance(errs, list):
                        err_str = " ".join([str(e) for e in errs])
                    else:
                        err_str = str(errs)
                    errors.append(f"{field}: {err_str}")
                message = "; ".join(errors)
            elif isinstance(response.data, list):
                message = " ".join([str(e) for e in response.data])
            else:
                message = str(response.data)
            code = "VALIDATION_ERROR"
        elif isinstance(exc, NotFound):
            code = "NOT_FOUND"
            message = response.data.get("detail", str(response.data))
        elif isinstance(exc, PermissionDenied):
            code = "PERMISSION_DENIED"
            message = response.data.get("detail", str(response.data))
        elif isinstance(exc, NotAuthenticated):
            code = "NOT_AUTHENTICATED"
            message = response.data.get("detail", str(response.data))
        else:
            if isinstance(response.data, dict):
                message = response.data.get("detail", str(response.data))
            else:
                message = str(response.data)
            code = getattr(exc, "default_code", "ERROR")

        response.data = {
            "error": {
                "code": code,
                "message": message
            }
        }
        
    return response
