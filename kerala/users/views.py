import logging
from django.contrib.auth import authenticate, login
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.utils import timezone
from .models import User, OTPVerification
from .serializers import LoginSerializer, OTPLoginSerializer
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.permissions import AllowAny
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token


# Get the logger for the application
logger = logging.getLogger(__name__)

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
                        login(request, user)  # Django login function
                        
                        # Generate Token
                        token, created = Token.objects.get_or_create(user=user)

                        # Return the token and user type
                        return Response({
                            "message": "Login successful", 
                            "user_type": user.user_type,
                            "token": token.key
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
                    login(request, user)  # Log the user in after OTP verification
                    
                    # Generate Token
                    token, created = Token.objects.get_or_create(user=user)

                    # Return token and user type
                    return Response({
                        "message": "OTP verified and login successful", 
                        "user_type": user.user_type,
                        "token": token.key
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

            # Create OTPVerification instance and set expires_at before saving
            otp_verification = OTPVerification.objects.create(
                user=user,
                expires_at=timezone.now() + timezone.timedelta(minutes=5)
            )
            otp_verification.generate_otp()  # Ensure this method updates the otp field
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
class OTPVerifyAndLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        otp = request.data.get('otp')

        if not username or not otp:
            return Response({"error": "Username and OTP are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = get_object_or_404(User, username=username)
            otp_verification = OTPVerification.objects.filter(user=user, verified=False).latest('created_at')

            if otp_verification.is_expired():
                return Response({"error": "OTP has expired"}, status=status.HTTP_400_BAD_REQUEST)

            if otp == otp_verification.otp:
                otp_verification.verified = True
                otp_verification.save()

                # Log the user in
                login(request, user)

                # Generate token
                token, created = Token.objects.get_or_create(user=user)

                return Response({
                    "message": "OTP verified and login successful",
                    "token": token.key,  # Provide the token in the response
                    'user_type': user.user_type
                }, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid OTP"}, status=status.HTTP_401_UNAUTHORIZED)
        except OTPVerification.DoesNotExist:
            return Response({"error": "OTP not found"}, status=status.HTTP_404_NOT_FOUND)

@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [TokenAuthentication]  # TokenAuthentication to ensure the user is authenticated

    def post(self, request):
        token = request.headers.get('Authorization')  # Retrieve the token from the request header
        if not token:
            logger.warning("Logout request received without a token")
            return Response({"error": "Authorization token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Extract the token from the 'Bearer' format
            token = token.split(' ')[1]
            user_token = Token.objects.get(key=token)
            
            # Perform the logout
            user_token.delete()
            logger.info(f"User logged out successfully, token {token} deleted")

            return Response({"message": "Logout successful"}, status=status.HTTP_200_OK)

        except Token.DoesNotExist:
            logger.warning(f"Invalid or expired token provided for logout")
            return Response({"error": "Invalid token or token does not exist"}, status=status.HTTP_401_UNAUTHORIZED)

        except Exception as e:
            logger.exception(f"Error during logout process: {e}")
            return Response({"error": "An error occurred during logout"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import RetrieveAPIView
from .models import User, Receptionist, Doctor
from .serializers import UserProfileSerializer

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from rest_framework.authtoken.models import Token
import logging

from users.serializers import UserProfileSerializer

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class UserProfileView(RetrieveAPIView):
    """
    Fetches the authenticated user's profile details.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        """
        Retrieves the user profile using the token in the Authorization header.
        """
        request = self.request
        token = request.headers.get('Authorization')  # Retrieve the token from the request header

        if not token:
            logger.warning("Request received without an authorization token")
            return Response({"error": "Authorization token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Extract token from 'Token <token_key>' format
            token_key = token.split(' ')[1]
            user_token = Token.objects.get(key=token_key)
            user = user_token.user  # Get the user from the token
        except (Token.DoesNotExist, IndexError):
            logger.warning("Invalid or expired token provided")
            return Response({"error": "Invalid token or token does not exist"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            logger.exception(f"Error retrieving user from token: {e}")
            return Response({"error": "An error occurred while processing the request"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Fetch profile details based on user type
        profile_data = {
            "username": user.username,
            "user_type": user.user_type,
            "email": user.email
        }

        # Fetch Receptionist details if applicable
        if user.user_type == "Receptionist":
            try:
                receptionist = Receptionist.objects.get(user=user)
                profile_data.update({
                    "first_name": receptionist.first_name,
                    "last_name": receptionist.last_name,
                    "contact_number": receptionist.contact_number
                })
            except Receptionist.DoesNotExist:
                profile_data["error"] = "Receptionist profile not found"

        # Fetch Doctor details if applicable
        elif user.user_type == "Doctor":
            try:
                doctor = Doctor.objects.get(user=user)
                profile_data.update({
                    "first_name": doctor.first_name,
                    "last_name": doctor.last_name,
                    "specialization": doctor.specialization,
                    "contact_number": doctor.contact_number
                })
            except Doctor.DoesNotExist:
                profile_data["error"] = "Doctor profile not found"

        return profile_data

    def retrieve(self, request, *args, **kwargs):
        """
        Override retrieve method to return custom profile data.
        """
        profile_data = self.get_object()
        if isinstance(profile_data, Response):  
            # If get_object() returned a Response (error case), return it directly
            return profile_data

        return Response(profile_data, status=status.HTTP_200_OK)
