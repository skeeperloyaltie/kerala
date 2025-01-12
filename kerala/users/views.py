from django.contrib.auth import authenticate
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import User, OTPVerification
from .serializers import LoginSerializer, OTPLoginSerializer
from django.core.mail import send_mail
import requests  # For sending SMS and WhatsApp messages

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            password = serializer.validated_data['password']
            user = authenticate(request, username=username, password=password)
            if user:
                return Response({"message": "Login successful", "user_type": user.user_type}, status=status.HTTP_200_OK)
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class OTPLoginView(APIView):
    def post(self, request):
        serializer = OTPLoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            otp = serializer.validated_data['otp']
            try:
                user = User.objects.get(username=username)
                otp_verification = OTPVerification.objects.filter(user=user, verified=False).latest('created_at')

                # Check if OTP is expired or not
                if otp_verification.is_expired():
                    return Response({"error": "OTP has expired"}, status=status.HTTP_400_BAD_REQUEST)

                # Verify OTP
                if otp == otp_verification.otp:
                    otp_verification.verified = True
                    otp_verification.save()
                    return Response({"message": "OTP Verified", "user_type": user.user_type}, status=status.HTTP_200_OK)
                return Response({"error": "Invalid OTP"}, status=status.HTTP_401_UNAUTHORIZED)

            except User.DoesNotExist:
                return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)

            except OTPVerification.DoesNotExist:
                return Response({"error": "OTP not found for this user"}, status=status.HTTP_404_NOT_FOUND)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def send_otp(self, user, method="whatsapp"):
        otp_verification = OTPVerification(user=user, verified=False)
        otp_verification.generate_otp()

        # Set OTP expiration time (e.g., 5 minutes)
        otp_verification.expires_at = timezone.now() + timezone.timedelta(minutes=5)
        otp_verification.save()

        otp = otp_verification.otp
        if method == "whatsapp":
            self.send_whatsapp_message(user.contact_number, otp)
        elif method == "sms":
            self.send_sms(user.contact_number, otp)
        elif method == "email":
            self.send_email(user.email, otp)

    def send_whatsapp_message(self, phone_number, otp):
        # Use WhatsApp API (such as Twilio or other service) to send the OTP
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
        # Use SMS service API (e.g., Twilio, Nexmo)
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
        subject = "Your OTP Code"
        message = f"Your OTP code is {otp}"
        send_mail(subject, message, 'no-reply@example.com', [email])
