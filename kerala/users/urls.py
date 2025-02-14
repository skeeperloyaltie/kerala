# users/urls.py
from django.urls import path
from .views import LoginView, OTPLoginView, SendOTPView, OTPVerifyAndLoginView,LogoutView, UserProfileView, get_csrf_token

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('otp-login/', OTPLoginView.as_view(), name='otp-login'),
    path('send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('otp/', OTPVerifyAndLoginView.as_view(), name='otp_verify_and_login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path("profile/", UserProfileView.as_view(), name="user-profile"),
    path('get-csrf-token/', get_csrf_token, name='get_csrf_token'),




]
