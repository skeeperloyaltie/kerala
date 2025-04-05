from django.urls import path
from .views import (
    LoginView, SendOTPView, OTPLoginView, LogoutView, UserProfileView,
    UserListView, UserDetailView, get_csrf_token
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('send-otp/', SendOTPView.as_view(), name='send_otp'),
    path('otp/', OTPLoginView.as_view(), name='otp_login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('users/', UserListView.as_view(), name='user_list'),  # Updated endpoint name
    path('users/<int:user_id>/', UserDetailView.as_view(), name='user_detail'),
    path('get-csrf-token/', get_csrf_token, name='get_csrf_token'),
]