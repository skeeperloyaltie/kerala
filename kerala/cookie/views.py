from datetime import timedelta, datetime
from django.utils import timezone

from django.utils.timezone import make_aware
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from users.models import User
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import Cookie
import logging  # Adding logging to debug

class CookieVerification(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [TokenAuthentication]

    def post(self, request, *args, **kwargs):
        # Getting the token from the Authorization header
        token = request.headers.get('Authorization')  # Expecting 'Authorization: Token <token>'
        print(f"Authorization Header: {request.headers.get('Authorization')}")

        if token:
            token = token.split(' ')[1]  # Remove 'Token' prefix

        username = request.data.get('username')

        if not username or not token:
            return Response({'error': 'Username or Token is missing.'}, status=400)

        try:
            # Fetch user based on the custom User model
            user = User.objects.get(username=username)

            # Check if user has a valid auth_token
            if user.auth_token and user.auth_token.key == token:
                # If valid token, generate the response and set the cookie
                
                response = JsonResponse({'message': 'Cookie verification successful!'}, status=200)
                
                # Set the token as a cookie for subsequent requests
                response.set_cookie(
                    'auth_token', 
                    token, 
                    httponly=True,  # Prevent client-side JavaScript access
                    secure=True if request.is_secure() else False,  # Adjust based on environment
                    max_age=60*60*24*30,  # Set expiration date (30 days in seconds)
                    path='/'  # Make the cookie available site-wide
                )

                # Calculate expiration datetime directly based on max_age
                expiration_time = datetime.utcnow() + timedelta(seconds=60*60*24*30)  # 30 days
                expiration_time = make_aware(expiration_time)  # Convert to timezone-aware datetime

                # Save cookie information into the database for auditing
                Cookie.objects.create(
                    user=user,
                    token=token,
                    login_time=user.last_login or user.date_joined,  # Assuming last_login is available
                    expires_at=expiration_time,
                    is_valid=True,
                    user_type=user.user_type  # Assuming 'user_type' is a field on the User model
                )
                
                return response

            else:
                # If token is invalid
                raise AuthenticationFailed('Invalid token.')

        except User.DoesNotExist:
            return Response({'error': 'User does not exist.'}, status=404)
        except AuthenticationFailed as e:
            return Response({'error': str(e)}, status=401)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.authentication import TokenAuthentication
from django.http import JsonResponse
from users.models import User
from cookie.models import Cookie
from datetime import datetime

# Set up logging
logger = logging.getLogger(__name__)

class CheckCookie(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [TokenAuthentication]

    def get(self, request, *args, **kwargs):
        # Log the incoming request data for debugging
        logger.info("Received request to check cookie validity.")
        logger.info(f"Request headers: {request.headers}")

        # Retrieve the token from localStorage (sent in the Authorization header)
        token = request.headers.get('Authorization', '').split(' ')[-1]
        logger.info(f"Retrieved token from headers: {token}")

        # Retrieve the username from localStorage (sent as a custom header)
        username = request.headers.get('Username')
        logger.info(f"Retrieved username from headers: {username}")

        # Retrieve the CSRF token (if required for protection)
        csrf_token = request.headers.get('X-CSRFToken')
        logger.info(f"Retrieved CSRF token: {csrf_token}")

        # Check if the token is missing
        if not token:
            logger.warning("No auth_token in Authorization header.")
            return Response({'error': 'No auth_token in Authorization header.'}, status=400)
        
        # Check if the username is missing
        if not username:
            logger.warning("No username in request header.")
            return Response({'error': 'No username in request header.'}, status=400)
        
        try:
            # Fetch the user based on the username (which should exist in the User model)
            user = User.objects.get(username=username)
            logger.info(f"User found: {user.username}")

            # Check if the user has a valid token in the cookie
            cookie_entry = Cookie.objects.filter(user=user, token=token, is_valid=True).first()
            
            if not cookie_entry:
                logger.warning(f"Token for user {username} not found in cookie records or expired.")
                return Response({'error': 'Token not found in cookie records or expired.'}, status=401)
            
            # Ensure both datetimes are timezone-aware before comparing
            if cookie_entry.expires_at and timezone.is_naive(cookie_entry.expires_at):
                # Convert expires_at to timezone-aware datetime if it's naive
                cookie_entry.expires_at = timezone.make_aware(cookie_entry.expires_at)
            
            # Compare the token expiration time
            if cookie_entry.expires_at < timezone.now():
                # Token has expired
                cookie_entry.is_valid = False
                cookie_entry.save()
                logger.warning(f"Token for user {username} has expired. Logging out.")

                # Log the user out by redirecting to logout endpoint
                return JsonResponse({'message': 'Token expired. Logging out.'}, status=401, safe=False)

            # If everything is valid, return success
            logger.info(f"Token for user {username} is valid.")
            return JsonResponse({'message': 'Cookie is valid.'}, status=200)

        except User.DoesNotExist:
            logger.error(f"User with username {username} does not exist.")
            return Response({'error': 'User does not exist.'}, status=404)
        except Exception as e:
            logger.error(f"An error occurred: {str(e)}")
            return Response({'error': str(e)}, status=500)
