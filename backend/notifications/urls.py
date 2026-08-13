from django.urls import path
from notifications import views

urlpatterns = [
    path('', views.NotificationListCreateView.as_view(), name='notification-list'),
    path('<int:pk>/read/', views.NotificationReadView.as_view(), name='notification-read'),
    path('read-all/', views.NotificationReadAllView.as_view(), name='notification-read-all'),
]
