import logging
from django.contrib.auth import authenticate
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.mail import send_mail
from django.utils import timezone
import requests  # For sending SMS and WhatsApp messages
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

            # Attempt authentication
            try:
                user = authenticate(request, username=username, password=password)
            except Exception as e:
                logger.exception(f"Error during authentication for user {username}: {e}")
                return Response({"error": "An error occurred during authentication"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            if user:
                logger.info(f"User {username} authenticated successfully")
                logger.debug(f"Authenticated user details: {user}")
                return Response({"message": "Login successful", "user_type": user.user_type}, status=status.HTTP_200_OK)
            
            # Authentication failed - additional checks
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
        logger.info("OTP login request received")
        serializer = OTPLoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            otp = serializer.validated_data['otp']
            logger.debug(f"Verifying OTP for user: {username}")
            
            try:
                user = User.objects.get(username=username)
                otp_verification = OTPVerification.objects.filter(user=user, verified=False).latest('created_at')
                
                if otp_verification.is_expired():
                    logger.warning(f"OTP expired for user: {username}")
                    return Response({"error": "OTP has expired"}, status=status.HTTP_400_BAD_REQUEST)
                
                if otp == otp_verification.otp:
                    otp_verification.verified = True
                    otp_verification.save()
                    logger.info(f"OTP verified successfully for user: {username}")
                    return Response({"message": "OTP Verified", "user_type": user.user_type}, status=status.HTTP_200_OK)
                
                logger.warning(f"Invalid OTP entered for user: {username}")
                return Response({"error": "Invalid OTP"}, status=status.HTTP_401_UNAUTHORIZED)

            except User.DoesNotExist:
                logger.error(f"User {username} does not exist")
                return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)

            except OTPVerification.DoesNotExist:
                logger.error(f"No OTP found for user: {username}")
                return Response({"error": "OTP not found for this user"}, status=status.HTTP_404_NOT_FOUND)

        logger.error(f"OTP login request validation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def send_otp(self, user, method="whatsapp"):
        logger.info(f"Sending OTP to user: {user.username} via {method}")
        otp_verification = OTPVerification(user=user, verified=False)
        otp_verification.generate_otp()

        otp_verification.expires_at = timezone.now() + timezone.timedelta(minutes=5)
        otp_verification.save()

        otp = otp_verification.otp[:4]  # Ensure OTP is only four digits
        try:
            if method == "whatsapp":
                self.send_whatsapp_message(user.contact_number, otp)
            elif method == "sms":
                self.send_sms(user.contact_number, otp)
            elif method == "email":
                self.send_email(user.email, otp)
            logger.info(f"OTP sent successfully to {user.username}")
        except Exception as e:
            logger.error(f"Failed to send OTP to {user.username}: {e}")

    def send_whatsapp_message(self, phone_number, otp):
        logger.debug(f"Sending WhatsApp message to {phone_number}")
        url = "https://api.twilio.com/2010-04-01/Accounts/your_account_sid/Messages.json"
        payload = {
            'To': f'whatsapp:{phone_number}',
            'From': 'whatsapp:+your_twilio_whatsapp_number',
            'Body': f'Your OTP code is {otp}'
        }
        headers = {
            'Authorization': 'Basic your_twilio_auth_token'
        }
        response = requests.post(url, data=payload, headers=headers)
        return response

    def send_sms(self, phone_number, otp):
        logger.debug(f"Sending SMS to {phone_number}")
        url = "https://api.twilio.com/2010-04-01/Accounts/your_account_sid/Messages.json"
        payload = {
            'To': phone_number,
            'From': '+your_twilio_phone_number',
            'Body': f'Your OTP code is {otp}'
        }
        headers = {
            'Authorization': 'Basic your_twilio_auth_token'
        }
        response = requests.post(url, data=payload, headers=headers)
        return response

    def send_email(self, email, otp):
        logger.debug(f"Sending email to {email}")
        subject = "Your OTP Code"
        message = f"Your OTP code is {otp}"
        send_mail(subject, message, 'no-reply@example.com', [email])
