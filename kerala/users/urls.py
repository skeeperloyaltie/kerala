# users/urls.py
from django.urls import path
from .views import LoginView, OTPLoginView, SendOTPView, OTPVerifyAndLoginView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('otp-login/', OTPLoginView.as_view(), name='otp-login'),
    path('send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('otp/', OTPVerifyAndLoginView.as_view(), name='otp_verify_and_login'),

]
