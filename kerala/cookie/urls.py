# cookie/urls.py
from django.urls import path
from .views import CookieVerification, CheckCookie

urlpatterns = [
    path('verify/', CookieVerification.as_view(), name='cookie_verify'),
    path('check/', CheckCookie.as_view(), name='cookie_check'),
]
