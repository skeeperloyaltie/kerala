import logging
from django.contrib.auth import authenticate
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.utils import timezone
from .models import User, OTPVerification
from .serializers import LoginSerializer, OTPLoginSerializer

# Get the logger for the application
logger = logging.getLogger(__name__)

class LoginView(APIView):
    def post(self, request):
        logger.info("Login request received")
        logger.debug(f"Request data: {request.data}")

        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            password = serializer.validated_data['password']
            logger.debug(f"Starting authentication for user: {username}")

            try:
                user = authenticate(request, username=username, password=password)
            except Exception as e:
                logger.exception(f"Error during authentication for user {username}: {e}")
                return Response({"error": "An error occurred during authentication"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            if user:
                logger.info(f"User {username} authenticated successfully")
                logger.debug(f"Authenticated user details: {user}")
                return Response({"message": "Login successful", "user_type": user.user_type}, status=status.HTTP_200_OK)

            if not User.objects.filter(username=username).exists():
                logger.warning(f"Login failed for user {username}: User does not exist")
                return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)

            user_obj = User.objects.filter(username=username).first()
            if user_obj and not user_obj.check_password(password):
                logger.warning(f"Login failed for user {username}: Incorrect password")

            if user_obj and not user_obj.is_active:
                logger.warning(f"Login failed for user {username}: User account is inactive")
                return Response({"error": "User account is inactive"}, status=status.HTTP_403_FORBIDDEN)

            logger.warning(f"Login failed for user {username}: Invalid credentials")
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        logger.error(f"Login request validation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class OTPLoginView(APIView):
    def post(self, request):
        action = request.data.get('action')
        username = request.data.get('username')
        logger.info(f"OTP login action received: {action} for user {username}")

        if action == "generate":
            return self.generate_otp(username)
        elif action == "verify":
            otp = request.data.get('otp')
            return self.verify_otp(username, otp)
        else:
            logger.error("Invalid action for OTP login")
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

    def generate_otp(self, username):
        try:
            user = User.objects.get(username=username)
            if not user.is_active:
                logger.warning(f"Cannot generate OTP for inactive user: {username}")
                return Response({"error": "User account is inactive"}, status=status.HTTP_403_FORBIDDEN)

            otp_verification = OTPVerification.objects.create(user=user)
            otp_verification.generate_otp()

            logger.info(f"Generated OTP {otp_verification.otp} for user {username} with expiry {otp_verification.expires_at}")
            self.send_otp(user, otp_verification.otp, method="email")

            return Response({"message": "OTP sent successfully"}, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            logger.error(f"User {username} does not exist")
            return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)

    def verify_otp(self, username, otp):
        try:
            user = User.objects.get(username=username)
            otp_verification = OTPVerification.objects.filter(user=user, verified=False).latest('created_at')

            # Validate OTP and expiry
            if otp_verification.is_expired():
                logger.warning(f"OTP expired for user {username}")
                return Response({"error": "OTP has expired"}, status=status.HTTP_400_BAD_REQUEST)

            if otp_verification.otp != otp:
                logger.warning(f"Invalid OTP entered for user {username}")
                return Response({"error": "Invalid OTP"}, status=status.HTTP_401_UNAUTHORIZED)

            # Mark OTP as verified
            otp_verification.verified = True
            otp_verification.save()
            logger.info(f"OTP verified for user {username}")

            return Response({"message": "OTP verified successfully", "user_type": user.user_type}, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            logger.error(f"User {username} does not exist")
            return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)

        except OTPVerification.DoesNotExist:
            logger.error(f"No OTP found for user {username}")
            return Response({"error": "No valid OTP found for this user"}, status=status.HTTP_404_NOT_FOUND)

    def send_otp(self, user, method="email"):
        logger.info(f"Sending OTP to user: {user.username} via {method}")
        otp_verification = OTPVerification(user=user)
        otp_verification.generate_otp()

        otp = otp_verification.otp
        try:
            if method == "email":
                self.send_email(user.email, otp)
            logger.info(f"OTP sent successfully to {user.username}")
        except Exception as e:
            logger.error(f"Failed to send OTP to {user.username}: {e}")

    def send_email(self, email, otp):
        logger.debug(f"Sending email to {email}")
        subject = "Your OTP Code"
        message = f"Your OTP code is {otp}. It expires in 5 minutes."
        send_mail(subject, message, 'no-reply@example.com', [email])


class SendOTPView(APIView):
    def post(self, request):
        username = request.data.get('username')
        method = request.data.get('method', 'email')
        logger.info(f"Send OTP request received for user: {username} via {method}")

        try:
            user = User.objects.get(username=username)
            if not user.is_active:
                logger.warning(f"Cannot send OTP to inactive user: {username}")
                return Response({"error": "User account is inactive"}, status=status.HTTP_403_FORBIDDEN)

            otp_verification = OTPVerification(user=user, verified=False)
            otp_verification.generate_otp()

            otp_verification.expires_at = timezone.now() + timezone.timedelta(minutes=5)
            otp_verification.save()

            otp = otp_verification.otp
            if method == 'email':
                self.send_email(user.email, otp)
            logger.info(f"OTP sent successfully to user: {username}")
            return Response({"message": "OTP sent successfully"}, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            logger.error(f"User {username} does not exist")
            return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.exception(f"Error sending OTP to {username}: {e}")
            return Response({"error": "An error occurred while sending OTP"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def send_email(self, email, otp):
        logger.debug(f"Sending email to {email}")
        subject = "Your OTP Code"
        message = f"Your OTP code is {otp}"
        send_mail(subject, message, 'no-reply@example.com', [email])
        
from django.contrib.auth import login
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
import logging

logger = logging.getLogger(__name__)

class OTPVerifyAndLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Parse input data
        username = request.data.get('username')
        otp = request.data.get('otp')

        if not username or not otp:
            logger.warning("Username or OTP not provided in the request")
            return Response({"error": "Both 'username' and 'otp' are required"}, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"OTP verification and login request received for user: {username}")

        try:
            # Fetch user
            user = get_object_or_404(User, username=username)

            # Fetch the latest unverified OTP for the user
            otp_verification = OTPVerification.objects.filter(user=user, verified=False).latest('created_at')

            # Check if the OTP is expired
            if otp_verification.is_expired():
                logger.warning(f"Expired OTP used for user: {username}")
                return Response({"error": "OTP has expired"}, status=status.HTTP_400_BAD_REQUEST)

            # Validate the OTP
            if otp_verification.otp != otp:
                logger.warning(f"Invalid OTP entered for user: {username}")
                return Response({"error": "Invalid OTP"}, status=status.HTTP_401_UNAUTHORIZED)

            # Mark OTP as verified
            otp_verification.verified = True
            otp_verification.save()

            # Log the user in
            login(request, user)
            logger.info(f"User {username} logged in successfully after OTP verification")
            return Response({"message": "OTP verified and login successful", "user_type": user.user_type}, status=status.HTTP_200_OK)

        except OTPVerification.DoesNotExist:
            logger.error(f"No unverified OTP found for user: {username}")
            return Response({"error": "No valid OTP found for this user"}, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            logger.exception(f"Unexpected error during OTP verification for user {username}: {e}")
            return Response({"error": "An internal server error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
