from django.urls import path
from accounts import views

urlpatterns = [
    path('me/', views.MeView.as_view(), name='accounts-me'),
]
