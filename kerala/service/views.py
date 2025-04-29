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

        if user_type == 'Doctor' and role_level == 'Senior':
            logger.info(f"User {request.user.username} (Doctor-Senior) allowed to add service")
        elif not request.user.has_perm('service.add_service'):
            error_msg = f"Permission denied: User {request.user.username} lacks 'service.add_service' permission."
            if not user_type or not role_level:
                error_msg += " User type or role level missing from profile."
            else:
                error_msg += f" Current role: {user_type}-{role_level}."
            logger.warning(error_msg)
            return Response({"error": error_msg}, status=status.HTTP_403_FORBIDDEN)

        serializer = ServiceSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            service = serializer.save()
            logger.info(f"Service {service.name} created by {request.user.username} with doctors: {list(service.doctors.values_list('id', flat=True))}")
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

        if user_type == 'Doctor' and role_level == 'Senior':
            logger.info(f"User {request.user.username} (Doctor-Senior) allowed to view services")
        elif not request.user.has_perm('service.view_service'):
            error_msg = f"Permission denied: User {request.user.username} lacks 'service.view_service' permission."
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
class ServiceSearchView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        query = request.query_params.get('query', '').strip()
        service_ids = request.query_params.get('service_ids', '')

        logger.info(f"User {user.username} ({user.user_type} - {user.role_level}) searching services with query: '{query}', service_ids: '{service_ids}'")

        user_type = getattr(user, 'user_type', None)
        role_level = getattr(user, 'role_level', None)
        if user_type == 'Doctor' and role_level == 'Senior':
            logger.info(f"User {user.username} (Doctor-Senior) allowed to search services")
        elif not user.has_perm('service.view_service'):
            error_msg = f"Permission denied: User {user.username} lacks 'service.view_service' permission."
            if not user_type or not role_level:
                error_msg += " User type or role level missing from profile."
            else:
                error_msg += f" Current role: {user_type}-{role_level}."
            logger.warning(error_msg)
            return Response({"error": error_msg}, status=status.HTTP_403_FORBIDDEN)

        try:
            services = Service.objects.all()

            if service_ids:
                try:
                    id_list = [int(id.strip()) for id in service_ids.split(',') if id.strip()]
                    services = services.filter(id__in=id_list)
                    if not services.exists():
                        logger.warning(f"No services found for IDs: {id_list}")
                        return Response({"services": [], "warning": "No services found for the provided IDs"}, status=status.HTTP_200_OK)
                    logger.info(f"Filtered services by IDs: {id_list}")
                except ValueError:
                    logger.error(f"Invalid service_ids format: {service_ids}")
                    return Response({"error": "Invalid service_ids format. Use comma-separated integers."}, status=status.HTTP_400_BAD_REQUEST)
            elif query:
                services = services.filter(name__icontains=query)

            serializer = ServiceSerializer(services, many=True)
            logger.info(f"Fetched {services.count()} services for query '{query}', service_ids '{service_ids}' by {user.username}")
            return Response({"services": serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error searching services: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred while searching services."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
@method_decorator(csrf_exempt, name='dispatch')
class ServiceUpdateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, *args, **kwargs):
        user_type = getattr(request.user, 'user_type', None)
        role_level = getattr(request.user, 'role_level', None)

        if user_type == 'Doctor' and role_level == 'Senior':
            logger.info(f"User {request.user.username} (Doctor-Senior) allowed to update service")
        elif not request.user.has_perm('service.change_service'):
            error_msg = f"Permission denied: User {request.user.username} lacks 'service.change_service' permission."
            if not user_type or not role_level:
                error_msg += " User type or role level missing from profile."
            else:
                error_msg += f" Current role: {user_type}-{role_level}."
            logger.warning(error_msg)
            return Response({"error": error_msg}, status=status.HTTP_403_FORBIDDEN)

        try:
            service = Service.objects.get(pk=pk)
        except Service.DoesNotExist:
            logger.error(f"Service with ID {pk} not found for update by {request.user.username}")
            return Response({"error": "Service not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = ServiceSerializer(service, data=request.data, context={'request': request}, partial=True)
        if serializer.is_valid():
            updated_service = serializer.save()
            logger.info(f"Service {updated_service.name} (ID: {pk}) updated by {request.user.username} with doctors: {list(updated_service.doctors.values_list('id', flat=True))}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        logger.error(f"Service update failed for ID {pk}: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)