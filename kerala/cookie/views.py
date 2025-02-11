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
                    'token', 
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
import logging
from django.utils import timezone

# Set up logging
logger = logging.getLogger(__name__)

class CheckCookie(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [TokenAuthentication]

    def get(self, request, *args, **kwargs):
        logger.info("Received request to check cookie validity.")
        logger.info(f"Request Headers: {request.headers}")

        # Extract headers
        auth_header = request.headers.get('Authorization', '')
        username = request.headers.get('Username', '').strip()
        csrf_token = request.headers.get('X-CSRFToken', '')

        # Validate token format
        if not auth_header.startswith('Token '):
            logger.warning("Invalid or missing Authorization header format.")
            return Response({'error': 'Invalid Authorization header format.'}, status=400)

        token = auth_header.split('Token ')[-1].strip()
        logger.info(f"Extracted Token: {token if token else 'None'}")
        logger.info(f"Extracted Username: {username if username else 'None'}")
        logger.info(f"Extracted CSRF Token: {csrf_token if csrf_token else 'None'}")

        # Validate presence of username and token
        if not token:
            return Response({'error': 'Missing auth token in headers.'}, status=400)
        if not username:
            return Response({'error': 'Missing username in headers.'}, status=400)

        try:
            # Fetch user
            user = User.objects.get(username=username)
            logger.info(f"User Found: {user.username}")

            # Fetch valid cookie token
            cookie_entry = Cookie.objects.filter(user=user, token=token, is_valid=True).first()

            if not cookie_entry:
                logger.warning(f"Token for user {username} not found or expired.")
                return Response({'error': 'Token not found or expired.'}, status=401)

            # Ensure expires_at is timezone-aware
            if cookie_entry.expires_at and timezone.is_naive(cookie_entry.expires_at):
                cookie_entry.expires_at = timezone.make_aware(cookie_entry.expires_at)

            # Compare expiration time
            if cookie_entry.expires_at < timezone.now():
                cookie_entry.is_valid = False
                cookie_entry.save()
                logger.warning(f"Token for user {username} has expired. Logging out.")
                return JsonResponse({'message': 'Token expired. Logging out.'}, status=401)

            # Validate CSRF token
            expected_csrf_token = request.COOKIES.get('csrftoken', None)
            if expected_csrf_token and expected_csrf_token != csrf_token:
                logger.warning("CSRF token mismatch.")
                return Response({'error': 'CSRF token mismatch.'}, status=403)

            logger.info(f"Token for user {username} is valid.")

            # Return user details in the response
            return JsonResponse({
                'message': 'Cookie is valid.',
                'username': username,
                'user_id': user.id,
                'name': user.get_full_name() if user.get_full_name() else user.username,
                'user_type': user.user_type if hasattr(user, 'user_type') else None
            }, status=200)

        except User.DoesNotExist:
            logger.error(f"User {username} does not exist.")
            return Response({'error': 'User does not exist.'}, status=404)

        except Exception as e:
            logger.error(f"An error occurred: {str(e)}")
            return Response({'error': str(e)}, status=500)


