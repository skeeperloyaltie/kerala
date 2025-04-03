from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, generics
from django.core.exceptions import PermissionDenied
from django.db.models import Q  # Imported for Q objects used in filtering
from .models import Patient
from .serializers import PatientSerializer
import logging
from rest_framework import status, generics, permissions, pagination


logger = logging.getLogger(__name__)

class CreatePatientView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        logger.info(f"Received patient creation request from user {user.username}: {request.data}")

        if not (user.is_superuser or user.has_perm('appointments.add_appointment')):
            logger.warning(f"Unauthorized patient creation attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("Only Medium or Senior roles can create patients.")

        serializer = PatientSerializer(data=request.data)
        if serializer.is_valid():
            patient = serializer.save()
            logger.info(f"Patient created successfully: {patient.patient_id} by {user.username}")
            return Response({"message": "Patient created successfully.", "patient": PatientSerializer(patient).data}, status=status.HTTP_201_CREATED)
        logger.error(f"Patient creation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class GetPatientDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id):
        user = request.user
        if not user.has_perm('appointments.view_appointment'):
            logger.warning(f"Unauthorized patient details access by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("You do not have permission to view patient details.")

        try:
            patient = Patient.objects.get(patient_id=patient_id)
            if user.user_type == "Doctor" and not patient.appointments.filter(doctor=user.doctor).exists():
                logger.warning(f"Doctor {user.username} attempted to access patient {patient_id} not assigned to them.")
                raise PermissionDenied("You can only view details of your patients.")
            return Response({"patient": PatientSerializer(patient).data}, status=status.HTTP_200_OK)
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

class PatientListView(generics.ListAPIView):
    """
    Returns a list of patients based on the user's role.
    - Doctors: Only see patients assigned to them (via primary_doctor or appointments).
    - Receptionists: See all patients.
    Includes patient details, appointments, doctors, and vitals.
    """
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Customize the queryset based on the user's role.
        """
        user = self.request.user
        logger.info(f"User {user.username} ({user.user_type if hasattr(user, 'user_type') else 'Unknown'}) requesting patient list.")

        # Base queryset with prefetching for performance
        base_qs = Patient.objects.prefetch_related(
            "appointments__doctor",
            "appointments__vitals"
        )

        # Role-based filtering
        if hasattr(user, 'doctor'):  # Doctor role
            # Patients where this doctor is the primary doctor OR has appointments with them
            queryset = base_qs.filter(
                Q(primary_doctor=user.doctor) |  # Primary doctor
                Q(appointments__doctor=user.doctor)  # Doctor in appointments
            ).distinct()  # Avoid duplicates
            logger.info(f"Doctor {user.username} fetched {queryset.count()} patients.")
            return queryset

        elif hasattr(user, 'receptionist'):  # Receptionist role
            # Receptionists can see all patients
            queryset = base_qs.all()
            logger.info(f"Receptionist {user.username} fetched {queryset.count()} patients.")
            return queryset

        else:
            # Unauthorized user type (e.g., patient or other roles)
            logger.warning(f"Unauthorized attempt by {user.username} to access patient list.")
            # Return empty queryset for safety; could also raise PermissionDenied
            return base_qs.none()

    def list(self, request, *args, **kwargs):
        """
        Override the list method to handle the response and logging.
        """
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            return Response({"patients": serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching patient list for {request.user.username}: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred while retrieving patients."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        


class PatientSearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PatientSerializer

    def get_queryset(self):
        user = self.request.user
        query = self.request.query_params.get('query', '').strip()
        if not query:
            return Patient.objects.none()

        base_qs = Patient.objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(patient_id__icontains=query) |
            Q(mobile_number__icontains=query) |
            Q(date_of_birth__icontains=query)
        )

        if hasattr(user, 'doctor'):
            return base_qs.filter(
                Q(primary_doctor=user.doctor) | 
                Q(appointments__doctor=user.doctor)
            ).distinct()
        elif hasattr(user, 'receptionist'):
            return base_qs
        else:
            return base_qs.none()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.serializer_class(queryset, many=True)
        return Response({'patients': serializer.data})