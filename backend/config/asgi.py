import os
from django.core.asgi import get_asgi_application

# 1. Set environment variable and initialize the Django ASGI application.
# This registers all Django apps/models so subsequent imports do not raise AppRegistryNotReady.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django_asgi_app = get_asgi_application()

# 2. Import channels components and project routes *after* Django apps are fully loaded.
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from config.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})
