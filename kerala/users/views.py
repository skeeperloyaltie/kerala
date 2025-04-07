import logging
from django.contrib.auth import authenticate, login
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.generics import RetrieveAPIView
from .models import User, OTPVerification, Receptionist, Doctor, Nurse
from .serializers import LoginSerializer, OTPLoginSerializer, UserProfileSerializer, UserSerializer


from django.middleware.csrf import get_token

# Get the logger for the application
logger = logging.getLogger(__name__)

def get_user_permissions(user):
    """Helper function to return permissions based on user role."""
    permissions = {
        "can_view": user.has_perm('appointments.view_appointment'),
        "can_create": user.has_perm('appointments.add_appointment'),
        "can_edit": user.has_perm('appointments.change_appointment'),
    }
    return permissions

def get_user_role_info(user):
    """Helper function to return consistent user role info."""
    return {
        "user_type": user.user_type,
        "role_level": user.role_level,
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
        "permissions": get_user_permissions(user)
    }

@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logger.info("Login request received")
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            password = serializer.validated_data['password']
            logger.debug(f"Attempting to authenticate user: {username}")

            try:
                user = authenticate(request, username=username, password=password)
                if user:
                    if user.is_active:
                        logger.info(f"User {username} authenticated successfully")
                        login(request, user)
                        token, created = Token.objects.get_or_create(user=user)
                        role_info = get_user_role_info(user)

                        return Response({
                            "message": "Login successful",
                            "token": token.key,
                            **role_info
                        }, status=status.HTTP_200_OK)
                    else:
                        logger.warning(f"Inactive user attempted login: {username}")
                        return Response({"error": "User account is inactive"}, status=status.HTTP_403_FORBIDDEN)
                else:
                    logger.warning(f"Authentication failed for user: {username}")
                    return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
            except Exception as e:
                logger.exception(f"Error during authentication for user {username}: {e}")
                return Response({"error": "Authentication error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        logger.error(f"Login request validation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(csrf_exempt, name='dispatch')
class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        method = request.data.get('method', 'email')
        logger.info(f"Send OTP request received for user: {username} via {method}")

        try:
            user = get_object_or_404(User, username=username)
            if not user.is_active:
                logger.warning(f"Cannot send OTP to inactive user: {username}")
                return Response({"error": "User account is inactive"}, status=status.HTTP_403_FORBIDDEN)

            otp_verification = OTPVerification.objects.create(
                user=user,
                expires_at=timezone.now() + timezone.timedelta(minutes=5)
            )
            otp_verification.generate_otp()
            otp_verification.save()

            otp = otp_verification.otp
            if method == 'email':
                self.send_email(user.email, otp)
            logger.info(f"OTP sent successfully to user: {username}")
            return Response({"message": "OTP sent successfully"}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"Error sending OTP to {username}: {e}")
            return Response({"error": "Error occurred while sending OTP"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def send_email(self, email, otp):
        subject = "Your OTP Code"
        message = f"Your OTP code is {otp}"
        send_mail(subject, message, 'no-reply@example.com', [email])


@method_decorator(csrf_exempt, name='dispatch')
class OTPLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        logger.info("OTP login request received")
        serializer = OTPLoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            otp = serializer.validated_data['otp']
            logger.debug(f"Verifying OTP for user: {username}")

            try:
                user = get_object_or_404(User, username=username)
                otp_verification = OTPVerification.objects.filter(user=user, verified=False).latest('created_at')

                if otp_verification.is_expired():
                    logger.warning(f"Expired OTP for user: {username}")
                    return Response({"error": "OTP has expired"}, status=status.HTTP_400_BAD_REQUEST)

                if otp == otp_verification.otp:
                    otp_verification.verified = True
                    otp_verification.save()
                    logger.info(f"OTP verified successfully for user: {username}")
                    login(request, user)
                    token, created = Token.objects.get_or_create(user=user)
                    role_info = get_user_role_info(user)

                    return Response({
                        "message": "OTP verified and login successful",
                        "token": token.key,
                        **role_info
                    }, status=status.HTTP_200_OK)
                else:
                    logger.warning(f"Invalid OTP entered for user: {username}")
                    return Response({"error": "Invalid OTP"}, status=status.HTTP_401_UNAUTHORIZED)
            except OTPVerification.DoesNotExist:
                logger.error(f"No OTP found for user: {username}")
                return Response({"error": "OTP not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            logger.error(f"OTP validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [TokenAuthentication]

    def post(self, request):
        token = request.headers.get('Authorization')
        if not token:
            logger.warning("Logout request received without a token")
            return Response({"error": "Authorization token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = token.split(' ')[1]
            user_token = Token.objects.get(key=token)
            user = user_token.user
            user_token.delete()
            logger.info(f"User {user.username} logged out successfully, token {token} deleted")
            return Response({"message": "Logout successful"}, status=status.HTTP_200_OK)
        except Token.DoesNotExist:
            logger.warning(f"Invalid or expired token provided for logout")
            return Response({"error": "Invalid token or token does not exist"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.exception(f"Error during logout process: {e}")
            return Response({"error": "An error occurred during logout"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class UserProfileView(RetrieveAPIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        user = self.request.user
        profile_data = {
            "username": user.username,
            "email": user.email,
            **get_user_role_info(user)
        }

        if user.user_type == "Receptionist":
            try:
                receptionist = Receptionist.objects.get(user=user)
                profile_data.update({
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "contact_number": receptionist.contact_number
                })
            except Receptionist.DoesNotExist:
                profile_data["error"] = "Receptionist profile not found"
        elif user.user_type == "Doctor":
            try:
                doctor = Doctor.objects.get(user=user)
                profile_data.update({
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "specialization": doctor.specialization,
                    "contact_number": doctor.contact_number,
                    "doctor_code": doctor.doctor_code  # Add this

                })
            except Doctor.DoesNotExist:
                profile_data["error"] = "Doctor profile not found"
        elif user.user_type == "Nurse":
            try:
                nurse = Nurse.objects.get(user=user)
                profile_data.update({
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "contact_number": nurse.contact_number,
                    "certification": nurse.certification
                })
            except Nurse.DoesNotExist:
                profile_data["error"] = "Nurse profile not found"
        elif user.user_type == "Admin":
            profile_data.update({
                "first_name": user.first_name,
                "last_name": user.last_name
            })

        return profile_data

    def retrieve(self, request, *args, **kwargs):
        profile_data = self.get_object()
        if isinstance(profile_data, Response):
            return profile_data
        logger.info(f"Profile retrieved for user: {request.user.username}")
        return Response(profile_data, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class UserListView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_superuser or request.user.user_type == "Admin"):
            logger.warning(f"Unauthorized access attempt by {request.user.username}")
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        logger.info(f"User list retrieved by {request.user.username}")
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        if not (request.user.is_superuser or request.user.user_type == "Admin"):
            logger.warning(f"Unauthorized create attempt by {request.user.username}")
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = User.objects.create_user(
                username=serializer.validated_data['username'],
                email=serializer.validated_data['email'],
                password=serializer.validated_data.get('password'),
                first_name=serializer.validated_data.get('first_name', ''),
                last_name=serializer.validated_data.get('last_name', ''),
                user_type=serializer.validated_data['user_type'],
                role_level=serializer.validated_data['role_level']
            )
            logger.info(f"User {user.username} created by {request.user.username}")
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        logger.error(f"User creation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class UserDetailView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        if not (request.user.is_superuser or request.user.user_type == "Admin"):
            logger.warning(f"Unauthorized access attempt by {request.user.username}")
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        user = get_object_or_404(User, id=user_id)
        serializer = UserSerializer(user)
        logger.info(f"User details retrieved for {user.username} by {request.user.username}")
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, user_id):
        if not (request.user.is_superuser or request.user.user_type == "Admin"):
            logger.warning(f"Unauthorized update attempt by {request.user.username}")
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        user = get_object_or_404(User, id=user_id)
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            # Update basic fields
            for field, value in serializer.validated_data.items():
                if field != 'password':
                    setattr(user, field, value)
            
            # Handle password update separately
            if 'password' in request.data:
                user.set_password(request.data['password'])
            
            user.save()
            logger.info(f"User {user.username} updated by {request.user.username}")
            return Response(UserSerializer(user).data, status=status.HTTP_200_OK)
        logger.error(f"User update failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, user_id):
        if not (request.user.is_superuser or request.user.user_type == "Admin"):
            logger.warning(f"Unauthorized delete attempt by {request.user.username}")
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        user = get_object_or_404(User, id=user_id)
        if user == request.user:
            logger.warning(f"User {request.user.username} attempted to delete self")
            return Response({"error": "Cannot delete your own account"}, status=status.HTTP_400_BAD_REQUEST)
        
        username = user.username
        user.delete()
        logger.info(f"User {username} deleted by {request.user.username}")
        return Response({"message": "User deleted successfully"}, status=status.HTTP_204_NO_CONTENT)

def get_csrf_token(request):
    return JsonResponse({'csrftoken': get_token(request)})