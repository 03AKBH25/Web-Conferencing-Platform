from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/meetings/', include('meetings.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/accounts/', include('accounts.urls')),
]
