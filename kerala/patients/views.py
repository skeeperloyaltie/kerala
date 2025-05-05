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

        # Permission check
        if not (user.is_superuser or user.has_perm('appointments.add_appointment')):
            logger.warning(f"Unauthorized patient creation attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("Only Medium or Senior roles can create patients.")

        # Create a mutable copy of request.data
        data = request.data.copy()

        # Assign primary_doctor based on user role
        try:
            if user.user_type == "Doctor":
                # For doctors, set primary_doctor to themselves
                if not hasattr(user, 'doctor'):
                    logger.error(f"User {user.username} is a Doctor but has no associated Doctor instance.")
                    return Response({"error": "User is not properly linked to a Doctor profile."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                data['primary_doctor'] = user.doctor.id
                logger.info(f"Assigned primary_doctor to Doctor {user.doctor.id} for user {user.username}")
            elif user.user_type == "Receptionist":
                # For receptionists, use provided primary_doctor or assign a default
                if 'primary_doctor' in data and data['primary_doctor']:
                    try:
                        doctor = Doctor.objects.get(id=data['primary_doctor'])
                        logger.info(f"Receptionist {user.username} specified primary_doctor: {doctor.id}")
                    except Doctor.DoesNotExist:
                        logger.error(f"Invalid primary_doctor ID {data['primary_doctor']} provided by {user.username}")
                        return Response({"error": "Specified primary doctor not found."}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    # Assign a default doctor associated with the receptionist
                    try:
                        receptionist = Receptionist.objects.get(user=user)
                        # Assume Receptionist has a ManyToManyField 'doctors'
                        if hasattr(receptionist, 'doctors') and receptionist.doctors.exists():
                            default_doctor = receptionist.doctors.first()
                            data['primary_doctor'] = default_doctor.id
                            logger.info(f"Assigned default primary_doctor {default_doctor.id} for receptionist {user.username}")
                        else:
                            # Fallback: Use the first available doctor
                            default_doctor = Doctor.objects.first()
                            if default_doctor:
                                data['primary_doctor'] = default_doctor.id
                                logger.info(f"No associated doctors found; assigned system default doctor {default_doctor.id} for receptionist {user.username}")
                            else:
                                logger.warning(f"No doctors available to assign as primary_doctor for receptionist {user.username}")
                                data['primary_doctor'] = None  # Allow null
                    except Receptionist.DoesNotExist:
                        logger.error(f"User {user.username} is a Receptionist but has no associated Receptionist instance.")
                        return Response({"error": "User is not properly linked to a Receptionist profile."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                # For superusers or other roles, use provided primary_doctor or None
                if 'primary_doctor' in data and data['primary_doctor']:
                    try:
                        Doctor.objects.get(id=data['primary_doctor'])
                        logger.info(f"Using provided primary_doctor {data['primary_doctor']} for user {user.username}")
                    except Doctor.DoesNotExist:
                        logger.error(f"Invalid primary_doctor ID {data['primary_doctor']} provided by {user.username}")
                        return Response({"error": "Specified primary doctor not found."}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    data['primary_doctor'] = None
                    logger.info(f"No primary_doctor specified for user {user.username}; setting to null")

        except Exception as e:
            logger.error(f"Error assigning primary_doctor for user {user.username}: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred while assigning the primary doctor."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Validate and save patient
        serializer = PatientSerializer(data=data)
        if serializer.is_valid():
            patient = serializer.save()
            logger.info(f"Patient created successfully: {patient.patient_id} by {user.username}")
            return Response(
                {"message": "Patient created successfully.", "patient": PatientSerializer(patient).data},
                status=status.HTTP_201_CREATED
            )
        logger.error(f"Patient creation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class GetPatientDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id):
        user = request.user
        if not user.has_perm('appointments.view_appointment'):
            logger.warning(f"Unauthorized patient details access by {user.username} ({user.user_type} - {user.role_level})")
            return Response(
                {"error": "You do not have permission to view patient details."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            patient = Patient.objects.get(patient_id=patient_id)
            if user.user_type == "Doctor" and not (patient.primary_doctor == user.doctor or patient.appointments.filter(doctor=user.doctor).exists()):
                logger.warning(f"Doctor {user.username} attempted to access patient {patient_id} not assigned to them.")
                return Response(
                    {"error": f"You can only view details of your assigned patients. Patient {patient_id} is not assigned to you."},
                    status=status.HTTP_403_FORBIDDEN
                )
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
            logger.info(f"User {user.username} performed an empty search query.")
            return Patient.objects.none()

        # Base queryset with search filters
        base_qs = Patient.objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(patient_id__icontains=query) |
            Q(mobile_number__icontains=query) |
            Q(date_of_birth__icontains=query)
        ).prefetch_related("appointments__doctor")  # Optimize queries

        # Role-based filtering
        if hasattr(user, 'doctor'):  # Doctor role
            # Include patients where the user is the primary doctor or has appointments
            queryset = base_qs.filter(
                Q(primary_doctor=user.doctor) |  # Primary doctor assignment
                Q(appointments__doctor=user.doctor)  # Appointment assignment
            ).distinct()  # Avoid duplicates
            logger.info(f"Doctor {user.username} searched for '{query}': found {queryset.count()} patients.")
            return queryset
        elif hasattr(user, 'receptionist'):  # Receptionist role
            # Receptionists can see all matching patients
            logger.info(f"Receptionist {user.username} searched for '{query}': found {base_qs.count()} patients.")
            return base_qs
        else:
            # Unauthorized roles return empty queryset
            logger.warning(f"Unauthorized user {user.username} attempted patient search for '{query}'.")
            return base_qs.none()

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.get_queryset()
            serializer = self.serializer_class(queryset, many=True)
            return Response({'patients': serializer.data}, status=200)
        except Exception as e:
            logger.error(f"Error in patient search for {request.user.username}: {str(e)}", exc_info=True)
            return Response({'error': 'An error occurred while searching patients.'}, status=500)
        
# patients/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.core.exceptions import PermissionDenied
from .models import Patient
from .serializers import PatientSerializer
import logging

logger = logging.getLogger(__name__)

class UpdatePatientView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, patient_id, *args, **kwargs):
        user = request.user
        logger.info(f"Received patient update request for {patient_id} from user {user.username}: {request.data}")

        # Permission check: Only superusers or users with 'appointments.change_appointment' can update patients
        if not (user.is_superuser or user.has_perm('appointments.change_appointment')):
            logger.warning(f"Unauthorized patient update attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("You do not have permission to update patients.")

        try:
            patient = Patient.objects.get(patient_id=patient_id)
        except Patient.DoesNotExist:
            logger.error(f"Patient {patient_id} not found for update by {user.username}")
            return Response({"error": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

        # Additional check for doctors: Can only update their assigned patients
        if user.user_type == "Doctor" and not (
            patient.primary_doctor == user.doctor or
            patient.appointments.filter(doctor=user.doctor).exists()
        ):
            logger.warning(f"Doctor {user.username} attempted to update patient {patient_id} not assigned to them.")
            return Response(
                {"error": f"You can only update details of your assigned patients. Patient {patient_id} is not assigned to you."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = PatientSerializer(patient, data=request.data, partial=True)
        if serializer.is_valid():
            updated_patient = serializer.save()
            logger.info(f"Patient {patient_id} updated successfully by {user.username}")
            return Response(
                {"message": "Patient updated successfully.", "patient": PatientSerializer(updated_patient).data},
                status=status.HTTP_200_OK
            )
        logger.error(f"Patient update failed for {patient_id}: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)