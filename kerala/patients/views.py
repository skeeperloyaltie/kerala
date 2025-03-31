from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q  # Imported for Q objects used in filtering
from appointments.models import Patient
from .serializers import PatientSerializer
import logging
from django.shortcuts import get_object_or_404


logger = logging.getLogger(__name__)

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
        
        

from rest_framework import generics
from rest_framework.response import Response
from .serializers import PatientSerializer
from django.db.models import Q
from rest_framework import generics, permissions, pagination


class PatientSearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PatientSerializer

    def get_queryset(self):
        query = self.request.query_params.get('query', '').strip()
        if not query:
            return Patient.objects.none()

        return Patient.objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(patient_id__icontains=query) |
            Q(mobile_number__icontains=query) |
            Q(date_of_birth__icontains=query)
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.serializer_class(queryset, many=True)
        return Response({'patients': serializer.data})
    
    
class PatientDetailView(generics.RetrieveAPIView):
    """
    Returns detailed information about a specific patient.
    - Doctors: Can only see details of their assigned patients
    - Receptionists: Can see details of any patient
    Includes patient details, appointments, doctors, and vitals.
    """
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'pk'  # Using patient's primary key

    def get_queryset(self):
        """
        Customize the queryset based on user's role and ensure proper access control
        """
        user = self.request.user
        patient_id = self.kwargs.get('pk')
        
        logger.info(f"User {user.username} ({user.user_type if hasattr(user, 'user_type') else 'Unknown'}) "
                   f"requesting details for patient ID {patient_id}")

        # Base queryset with prefetching
        base_qs = Patient.objects.prefetch_related(
            "appointments__doctor",
            "appointments__vitals"
        )

        if hasattr(user, 'doctor'):  # Doctor role
            # Filter to only patients this doctor is assigned to
            queryset = base_qs.filter(
                Q(primary_doctor=user.doctor) | 
                Q(appointments__doctor=user.doctor)
            )
            return queryset

        elif hasattr(user, 'receptionist'):  # Receptionist role
            # Receptionists can access all patients
            return base_qs

        else:
            # Return empty queryset for unauthorized users
            logger.warning(f"Unauthorized attempt by {user.username} to access patient details")
            return base_qs.none()

    def retrieve(self, request, *args, **kwargs):
        logger.info(f"Retrieving patient details for pk={self.kwargs.get('pk')}")
        try:
            queryset = self.get_queryset()
            logger.info(f"Queryset count: {queryset.count()}")
            patient = get_object_or_404(queryset, pk=self.kwargs.get('pk'))
            serializer = self.get_serializer(patient)
            logger.info(f"Patient data: {serializer.data}")
            return Response({"patient": serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)