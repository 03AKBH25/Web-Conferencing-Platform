# WARNING: This is a demo-only authentication backend. It does NOT verify credentials 
# or validate secrets. It is designed solely for classroom/demo testing and must NEVER 
# be used in a production environment.

from django.contrib.auth.models import User
from rest_framework import authentication

class DemoAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        # Allow simulating the default user using X-Demo-User header or demo_user query parameter
        demo_user_val = request.headers.get('X-Demo-User') or request.GET.get('demo_user')
        
        if demo_user_val:
            try:
                # Find the default user Alex Johnson
                user = User.objects.get(email='alex@example.com')
                return (user, None)
            except User.DoesNotExist:
                # If not seeded yet, fallback to any superuser or first user
                user = User.objects.filter(is_superuser=True).first() or User.objects.first()
                if user:
                    return (user, None)
        
        # Return None to let other authentication classes (like SessionAuthentication) try,
        # or fallback to AnonymousUser.
        return None
