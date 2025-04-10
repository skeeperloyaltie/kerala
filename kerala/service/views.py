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
        user_type = getattr(request.user, 'user_type', None)
        role_level = getattr(request.user, 'role_level', None)

        if user_type == 'doctor' and role_level == 'senior':
            logger.info(f"User {request.user.username} (doctor-senior) allowed to add service")
        elif not request.user.has_perm('services.add_service'):
            error_msg = f"Permission denied: User {request.user.username} lacks 'services.add_service' permission."
            if not user_type or not role_level:
                error_msg += " User type or role level missing from profile."
            else:
                error_msg += f" Current role: {user_type}-{role_level}."
            logger.warning(error_msg)
            return Response({"error": error_msg}, status=status.HTTP_403_FORBIDDEN)

        serializer = ServiceSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"Service {serializer.data.get('service_name', 'Unnamed')} created by {request.user.username}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        logger.error(f"Service creation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class ServiceListView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user_type = getattr(request.user, 'user_type', None)
        role_level = getattr(request.user, 'role_level', None)

        if user_type == 'doctor' and role_level == 'senior':
            logger.info(f"User {request.user.username} (doctor-senior) allowed to view services")
        elif not request.user.has_perm('services.view_service'):
            error_msg = f"Permission denied: User {request.user.username} lacks 'services.view_service' permission."
            if not user_type or not role_level:
                error_msg += " User type or role level missing from profile."
            else:
                error_msg += f" Current role: {user_type}-{role_level}."
            logger.warning(error_msg)
            return Response({"error": error_msg}, status=status.HTTP_403_FORBIDDEN)

        services = Service.objects.all()
        serializer = ServiceSerializer(services, many=True)
        logger.info(f"Services retrieved by {request.user.username}: {len(serializer.data)}")
        return Response({"services": serializer.data}, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class ServiceSearchView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        query = request.query_params.get('query', '').strip()
        logger.info(f"User {user.username} ({user.user_type} - {user.role_level}) searching services with query: '{query}'")

        user_type = getattr(user, 'user_type', None)
        role_level = getattr(user, 'role_level', None)
        if user_type == 'doctor' and role_level == 'senior':
            logger.info(f"User {user.username} (doctor-senior) allowed to search services")
        elif not user.has_perm('services.view_service'):
            error_msg = f"Permission denied: User {user.username} lacks 'services.view_service' permission."
            if not user_type or not role_level:
                error_msg += " User type or role level missing from profile."
            else:
                error_msg += f" Current role: {user_type}-{role_level}."
            logger.warning(error_msg)
            return Response({"error": error_msg}, status=status.HTTP_403_FORBIDDEN)

        try:
            if query:
                services = Service.objects.filter(name__icontains=query)
            else:
                services = Service.objects.all()

            serializer = ServiceSerializer(services, many=True)
            logger.info(f"Fetched {services.count()} services for query '{query}' by {user.username}")
            return Response({"services": serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error searching services: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred while searching services."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)