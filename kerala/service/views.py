from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Service
from .serializers import ServiceSerializer
import logging

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class ServiceCreateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Check user type and role from token or profile
        user_type = request.user.user_type if hasattr(request.user, 'user_type') else None
        role_level = request.user.role_level if hasattr(request.user, 'role_level') else None

        # Allow 'doctor-senior' full access without explicit permission check
        if user_type == 'doctor' and role_level == 'senior':
            logger.info(f"User {request.user.username} (doctor-senior) allowed to add service")
        elif not request.user.has_perm('services.add_service'):
            logger.warning(f"User {request.user.username} lacks permission to add service")
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ServiceSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"Service {serializer.data['service_name']} created by {request.user.username}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        logger.error(f"Service creation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class ServiceListView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Check user type and role from token or profile
        user_type = request.user.user_type if hasattr(request.user, 'user_type') else None
        role_level = request.user.role_level if hasattr(request.user, 'role_level') else None

        # Allow 'doctor-senior' full access without explicit permission check
        if user_type == 'doctor' and role_level == 'senior':
            logger.info(f"User {request.user.username} (doctor-senior) allowed to view services")
        elif not request.user.has_perm('services.view_service'):
            logger.warning(f"User {request.user.username} lacks permission to view services")
            return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

        services = Service.objects.all()
        serializer = ServiceSerializer(services, many=True)
        logger.info(f"Services retrieved by {request.user.username}")
        return Response(serializer.data, status=status.HTTP_200_OK)