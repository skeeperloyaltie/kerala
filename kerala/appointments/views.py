import logging
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment, Patient
from .serializers import AppointmentSerializer, PatientSerializer
from users.models import Doctor

# Configure logger
logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class CreateAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data
        logger.info(f"Received appointment creation request from user {user.id} ({user.username}): {data}")

        # Validate required fields
        required_fields = ["appointment", "appointment_date"]
        missing_fields = [field for field in required_fields if field not in data or not data[field]]
        if missing_fields:
            logger.warning(f"Missing fields in request: {missing_fields}")
            return Response({"error": f"Missing required fields: {', '.join(missing_fields)}"}, status=status.HTTP_400_BAD_REQUEST)

        appointment_info = data.get("appointment")
        if not isinstance(appointment_info, dict):
            logger.error("Invalid format for appointment details.")
            return Response({"error": "Appointment details must be a dictionary."}, status=status.HTTP_400_BAD_REQUEST)

        # Extract patient details
        patient_id = appointment_info.get("patient_id")
        first_name = appointment_info.get("first_name", "").strip()
        last_name = appointment_info.get("last_name", "").strip()
        contact_number = appointment_info.get("contact_number", "").strip()
        date_of_birth = appointment_info.get("date_of_birth")
        appointment_date = data.get("appointment_date")
        doctor_id = data.get("doctor")
        notes = data.get("notes", "")
        is_emergency = data.get("is_emergency", False)
        
        # log all data received fro mthe front end 
        logger.info(f"Data received from the front end: {data}")

        if not (first_name and last_name and contact_number and date_of_birth):
            logger.error("Patient details are incomplete.")
            return Response({"error": "Patient details (first name, last name, contact number, and date of birth) are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if patient exists or create a new one
        try:
            patient, created = Patient.objects.get_or_create(
                patient_id=patient_id,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "contact_number": contact_number,
                    "date_of_birth": date_of_birth
                }
            )
            if not created:
                # Update patient details if necessary
                patient.first_name = first_name
                patient.last_name = last_name
                patient.contact_number = contact_number
                patient.date_of_birth = date_of_birth
                patient.save()
        except Exception as e:
            logger.error(f"Error while fetching or creating patient: {e}")
            return Response({"error": "Error processing patient details."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.info(f"Using patient: {patient.id} ({patient.first_name} {patient.last_name})")

        # **Check for duplicate appointment**
        if Appointment.objects.filter(
            patient=patient,
            appointment_date=appointment_date
        ).exists():
            logger.warning(f"Duplicate appointment detected for {patient.first_name} ({patient.contact_number}) on {appointment_date}")
            return Response(
                {"error": "An appointment for this patient at the specified date and time already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Assign doctor if provided
        doctor = None
        if doctor_id:
            try:
                doctor = Doctor.objects.get(id=doctor_id)
            except Doctor.DoesNotExist:
                logger.error(f"Doctor with ID {doctor_id} not found.")
                return Response({"error": "Doctor not found."}, status=status.HTTP_404_NOT_FOUND)

        # Create appointment
        appointment = Appointment.objects.create(
            patient=patient,
            appointment_date=appointment_date,
            doctor=doctor,
            notes=notes,
            status="Scheduled",
            is_emergency=is_emergency,
            created_by=user
        )

        logger.info(f"Appointment created successfully: {appointment.id} for patient {patient.id}")

        return Response(
            {
                "message": "Appointment created successfully.",
                "appointment": AppointmentSerializer(appointment).data,
                "patient": PatientSerializer(patient).data,
            },
            status=status.HTTP_201_CREATED,
        )



from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from users.models import Doctor
from .serializers import DoctorSerializer  # Ensure you have a serializer for doctors
import logging

# Set up the logger
logger = logging.getLogger(__name__)

class DoctorListView(APIView):
    """
    API view to fetch the list of available doctors.
    Only authenticated users can access this endpoint.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        """
        Retrieve the list of doctors.
        """
        try:
            logger.info(f"User {request.user.id} ({request.user.username}) requested the list of doctors.")

            doctors = Doctor.objects.all()
            if not doctors.exists():
                logger.warning("No doctors found in the database.")

            serializer = DoctorSerializer(doctors, many=True)

            logger.info(f"Fetched {doctors.count()} doctors successfully.")
            return Response({"doctors": serializer.data}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error fetching doctors: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred while retrieving doctors."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment
from .serializers import AppointmentSerializer

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment
from .serializers import AppointmentSerializer
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

# Set up a logger
logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class AppointmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        status_filter = request.query_params.get('status', 'Scheduled')
        user = request.user

        logger.info(f"User {user.username} ({user.user_type}) is requesting appointments with status '{status_filter}'")

        try:
            # Doctors can only view their own appointments and patients assigned to them
            if user.user_type == "Doctor":
                appointments = Appointment.objects.filter(doctor=user.doctor, status=status_filter)
                logger.info(f"Doctor {user.username} fetched {appointments.count()} appointments")

            # Receptionists can view all appointments
            elif user.user_type == "Receptionist":
                appointments = Appointment.objects.filter(status=status_filter)
                logger.info(f"Receptionist {user.username} fetched {appointments.count()} appointments")

            # For other user types, return an error
            else:
                logger.warning(f"Unauthorized access attempt by {user.username} ({user.user_type})")
                return Response(
                    {"error": "Only Doctors and Receptionists can view appointments."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Serialize the appointments with full details
            serializer = AppointmentSerializer(appointments, many=True)

            # Log detailed serialized data
            logger.info(f"Appointments returned for {user.username}: {serializer.data}")

            return Response({"appointments": serializer.data}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error fetching appointments for {user.username}: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred while retrieving appointments."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )





from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Vitals, Appointment
from .serializers import VitalsSerializer

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Vitals
from .serializers import VitalsSerializer

# Set up import logging
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Vitals
from .serializers import VitalsSerializer

# Set up the logger
logger = logging.getLogger(__name__)

class VitalsAPIView(APIView):
    """
    API view to create, update, and retrieve vitals for an appointment.
    Only doctors and receptionists can add/update vitals.
    Fetching vitals is allowed for all authenticated users.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, appointment_id=None):
        """
        Retrieve vitals for a specific appointment.
        """
        logger.info(f"GET request received for appointment ID: {appointment_id}")
        
        try:
            vitals = get_object_or_404(Vitals, appointment_id=appointment_id)
            serializer = VitalsSerializer(vitals)
            logger.info(f"Vitals retrieved successfully for appointment ID: {appointment_id}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error retrieving vitals for appointment ID: {appointment_id}. Error: {str(e)}")
            return Response({"error": "Vitals not found."}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, appointment_id=None):
        """
        Create vitals for an appointment. Only doctors and receptionists can add vitals.
        """
        logger.info(f"POST request received with data: {request.data}")
        
        if not request.user.is_authenticated or not (hasattr(request.user, 'doctor') or hasattr(request.user, 'receptionist')):
            logger.warning(f"Unauthorized access attempt by user: {request.user.username}")
            return Response({"error": "Only doctors and receptionists can add vitals."}, status=status.HTTP_403_FORBIDDEN)

        # Use the appointment_id from the URL
        appointment_id = appointment_id or request.data.get("appointment")

        if Vitals.objects.filter(appointment_id=appointment_id).exists():
            logger.warning(f"Vitals already exist for appointment ID: {appointment_id}")
            return Response({"error": "Vitals for this appointment already exist."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VitalsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(appointment_id=appointment_id, recorded_by=request.user)  # Save the vitals
            logger.info(f"Vitals created successfully for appointment ID: {appointment_id} by user: {request.user.username}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        logger.error(f"Invalid data received for vitals creation: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, appointment_id=None):
        """
        Update vitals for a given appointment. Only doctors and receptionists can update vitals.
        """
        logger.info(f"PATCH request received for appointment ID: {appointment_id} with data: {request.data}")
        
        if not request.user.is_authenticated or not (hasattr(request.user, 'doctor') or hasattr(request.user, 'receptionist')):
            logger.warning(f"Unauthorized access attempt by user: {request.user.username}")
            return Response({"error": "Only doctors and receptionists can update vitals."}, status=status.HTTP_403_FORBIDDEN)

        try:
            vitals = get_object_or_404(Vitals, appointment_id=appointment_id)
            serializer = VitalsSerializer(vitals, data=request.data, partial=True)

            if serializer.is_valid():
                serializer.save(recorded_by=request.user)  # Update the user who modified vitals
                logger.info(f"Vitals updated successfully for appointment ID: {appointment_id} by user: {request.user.username}")
                return Response(serializer.data, status=status.HTTP_200_OK)

            logger.error(f"Invalid data received for vitals update: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating vitals for appointment ID: {appointment_id}. Error: {str(e)}")
            return Response({"error": "Vitals not found."}, status=status.HTTP_404_NOT_FOUND)


import logging
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment
from .serializers import AppointmentSerializer
from users.models import Doctor, Receptionist

from django.core.exceptions import ObjectDoesNotExist

# Set up logging
logger = logging.getLogger(__name__)


from django.shortcuts import get_object_or_404
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

@method_decorator(csrf_exempt, name='dispatch')
class EditAppointmentView(APIView):
    """
    Allows doctors and receptionists to edit an appointment's details, including status.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id):
        user = request.user
        data = request.data

        logger.info(f"User {user.username} ({user.user_type}) attempting to edit appointment {appointment_id}.")
        logger.info(f"Received data: {data}")  # Log incoming data

        # Ensure user is a doctor or receptionist
        if not hasattr(user, 'doctor') and not hasattr(user, 'receptionist'):
            logger.warning(f"Unauthorized attempt to edit appointment {appointment_id} by {user.username}.")
            return Response({"error": "Only doctors and receptionists can edit appointments."}, status=status.HTTP_403_FORBIDDEN)

        appointment = get_object_or_404(Appointment, id=appointment_id)

        # Ensure doctor can only edit their own appointments
        if hasattr(user, 'doctor') and appointment.doctor != user.doctor:
            logger.warning(f"Doctor {user.username} tried to edit an appointment they don't own.")
            return Response({"error": "You can only edit your own appointments."}, status=status.HTTP_403_FORBIDDEN)

        # Process patient_id if provided
        if "patient_id" in data:
            try:
                patient = get_object_or_404(Patient, patient_id=data["patient_id"])
                appointment.patient = patient  # Assign Patient instance
                logger.info(f"Matched patient ID {data['patient_id']} to DB ID {patient.id}")  # Log successful match
            except ObjectDoesNotExist:
                logger.error(f"Patient with ID {data['patient_id']} not found.")
                return Response({"error": "Invalid patient ID."}, status=status.HTTP_400_BAD_REQUEST)

        # Update other appointment fields
        appointment.patient.current_illness = data.get("current_illness", appointment.patient.current_illness)
        appointment.patient.save()
        appointment.doctor_id = data.get("doctor_id", appointment.doctor_id)
        appointment.notes = data.get("notes", appointment.notes)
        appointment.updated_by = user  # Track the user making the change

        # Ensure only valid statuses are assigned
        allowed_statuses = ["Waiting", "Scheduled", "Pending", "Active", "Completed", "Canceled", "Rescheduled"]
        if "status" in data:
            if data["status"] in allowed_statuses:
                appointment.status = data["status"]
            else:
                logger.error(f"Invalid status '{data['status']}' provided.")
                return Response({"error": "Invalid status value."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            appointment.save()
            logger.info(f"Appointment {appointment_id} successfully updated by {user.username}.")
            return Response({"message": "Appointment updated successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error updating appointment {appointment_id}: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)



from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
import logging

from .models import Appointment  # Import the Appointment model

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class CancelAppointmentView(APIView):
    """
    Allows doctors and receptionists to cancel a single or multiple appointments.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id=None):
        user = request.user
        data = request.data
        appointment_ids = data.get("appointment_ids")  # List of appointment IDs for bulk cancellation

        logger.info(f"User {user.username} attempting to cancel appointment(s).")

        if not hasattr(user, 'doctor') and not hasattr(user, 'receptionist'):
            logger.warning(f"Unauthorized cancellation attempt by {user.username}.")
            return Response({"error": "Only doctors and receptionists can cancel appointments."}, status=status.HTTP_403_FORBIDDEN)

        if appointment_id:
            # Single appointment cancellation
            appointments = [get_object_or_404(Appointment, id=appointment_id)]
        elif appointment_ids:
            # Bulk cancellation
            appointments = Appointment.objects.filter(id__in=appointment_ids)
            if not appointments.exists():
                return Response({"error": "No valid appointments found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({"error": "Appointment ID or list of IDs required."}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        for appointment in appointments:
            if hasattr(user, 'doctor') and appointment.doctor != user.doctor:
                logger.warning(f"Doctor {user.username} tried to cancel an appointment they don't own.")
                continue  # Skip unauthorized cancellations

            # Update status and track user making the change
            appointment.status = data.get("status", "Canceled")
            appointment.updated_by = user
            appointment.save()
            updated_count += 1

        if updated_count == 0:
            return Response({"error": "No appointments were canceled. Check permissions or appointment IDs."}, status=status.HTTP_403_FORBIDDEN)

        logger.info(f"User {user.username} successfully canceled {updated_count} appointment(s).")
        return Response({"message": f"Successfully canceled {updated_count} appointment(s)."}, status=status.HTTP_200_OK)


from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
import logging

from .models import Appointment  # Ensure you import your Appointment model

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class RescheduleAppointmentView(APIView):
    """
    Allows doctors and receptionists to reschedule a single or multiple appointments.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id=None):
        user = request.user
        data = request.data
        new_date = data.get("appointment_date")
        appointment_ids = data.get("appointment_ids")  # List of appointment IDs (for bulk reschedule)

        logger.info(f"User {user.username} attempting to reschedule appointments.")

        if not hasattr(user, 'doctor') and not hasattr(user, 'receptionist'):
            logger.warning(f"Unauthorized attempt by {user.username}.")
            return Response({"error": "Only doctors and receptionists can reschedule appointments."}, status=status.HTTP_403_FORBIDDEN)

        if not new_date:
            logger.error("Reschedule request is missing the new date.")
            return Response({"error": "New appointment date is required."}, status=status.HTTP_400_BAD_REQUEST)

        if appointment_id:
            # Single appointment reschedule
            appointments = [get_object_or_404(Appointment, id=appointment_id)]
        elif appointment_ids:
            # Bulk reschedule
            appointments = Appointment.objects.filter(id__in=appointment_ids)
            if not appointments.exists():
                return Response({"error": "No valid appointments found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({"error": "Appointment ID or list of IDs required."}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        for appointment in appointments:
            if hasattr(user, 'doctor') and appointment.doctor != user.doctor:
                logger.warning(f"Doctor {user.username} tried to reschedule an appointment they don't own.")
                continue  # Skip unauthorized reschedules

            appointment.appointment_date = new_date
            appointment.status = data.get("status", "Rescheduled")
            appointment.updated_by = user  # Track who made the change
            appointment.save()
            updated_count += 1

        if updated_count == 0:
            return Response({"error": "No appointments were updated. Check permissions or appointment IDs."}, status=status.HTTP_403_FORBIDDEN)

        logger.info(f"User {user.username} successfully rescheduled {updated_count} appointment(s) to {new_date}.")
        return Response({"message": f"Successfully rescheduled {updated_count} appointment(s)."}, status=status.HTTP_200_OK)

    
import logging
from rest_framework import generics, permissions, pagination
from rest_framework.response import Response
from django.core.cache import cache
from django.db.models import Q
from users.models import Doctor, Receptionist
from .models import Patient, Appointment
from users.serializers import UserSerializer
from .serializers import PatientSerializer, AppointmentSerializer

# Set up logging
logger = logging.getLogger(__name__)

class StandardResultsSetPagination(pagination.PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

class SearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        query_params = self.request.query_params
        query_filters = {}

        # Collect available search parameters
        first_name = query_params.get("first_name", "").strip()
        last_name = query_params.get("last_name", "").strip()
        contact_number = query_params.get("contact_number", "").strip()
        email = query_params.get("email", "").strip()
        status = query_params.get("status", "").strip()
        
        query_key = f"{first_name}_{last_name}_{contact_number}_{email}_{status}"
        cache_key = f"search_{user.id}_{query_key}"

        logger.info(f"Received query params: {query_params}")
        logger.info(f"User {user.id} searching with parameters: {query_key}")

        # Check cached results
        cached_results = cache.get(cache_key)
        if cached_results:
            logger.info(f"Cache hit for user {user.id}, query: {query_key}")
            return cached_results

        if not any([first_name, last_name, contact_number, email, status]):
            logger.info(f"Empty query received from user {user.id}.")
            return []

        # Prepare query sets
        patients, doctors, receptionists, appointments = [], [], [], []

        if hasattr(user, "receptionist"):  # Receptionists can search all
            patients = Patient.objects.filter(
                Q(first_name__icontains=first_name) |
                Q(last_name__icontains=last_name) |
                Q(contact_number__icontains=contact_number) |
                Q(email__icontains=email)
            )
            doctors = Doctor.objects.filter(
                Q(user__username__icontains=first_name) |
                Q(user__email__icontains=email)
            )
            receptionists = Receptionist.objects.filter(
                Q(user__username__icontains=first_name) |
                Q(user__email__icontains=email)
            )
            appointments = Appointment.objects.filter(
                Q(patient__first_name__icontains=first_name) |
                Q(patient__last_name__icontains=last_name) |
                Q(doctor__user__username__icontains=first_name) |
                Q(receptionist__user__username__icontains=first_name) |
                Q(status__icontains=status)
            )

        elif hasattr(user, "doctor"):  # Doctors search only their patients
            patients = Patient.objects.filter(
                Q(appointments__doctor=user.doctor) & (
                    Q(first_name__icontains=first_name) |
                    Q(last_name__icontains=last_name) |
                    Q(contact_number__icontains=contact_number) |
                    Q(email__icontains=email)
                )
            ).distinct()
            appointments = Appointment.objects.filter(
                Q(doctor=user.doctor) & (
                    Q(patient__first_name__icontains=first_name) |
                    Q(patient__last_name__icontains=last_name) |
                    Q(status__icontains=status)
                )
            ).distinct()

        # Compile results
        results = {
            "patients": list(patients),
            "doctors": list(doctors),
            "receptionists": list(receptionists),
            "appointments": list(appointments)
        }

        logger.info(f"Total search results fetched for user {user.id}: {sum(len(v) for v in results.values())}")

        # Cache results for 10 minutes
        cache.set(cache_key, results, timeout=600)
        return results

    def list(self, request, *args, **kwargs):
        search_results = self.get_queryset()

        # Ensure search_results is a dictionary
        if isinstance(search_results, dict):
            paginated_results = {
                "patients": self.paginate_queryset(search_results.get("patients", [])),
                "doctors": self.paginate_queryset(search_results.get("doctors", [])),
                "receptionists": self.paginate_queryset(search_results.get("receptionists", [])),
                "appointments": self.paginate_queryset(search_results.get("appointments", []))
            }
        else:
            paginated_results = {"patients": self.paginate_queryset(search_results)}

        response_data = {
            "patients": PatientSerializer(paginated_results.get("patients", []), many=True).data if paginated_results.get("patients") else [],
            "doctors": UserSerializer([d.user for d in paginated_results.get("doctors", [])], many=True).data if paginated_results.get("doctors") else [],
            "receptionists": UserSerializer([r.user for r in paginated_results.get("receptionists", [])], many=True).data if paginated_results.get("receptionists") else [],
            "appointments": AppointmentSerializer(paginated_results.get("appointments", []), many=True).data if paginated_results.get("appointments") else [],
        }

        return Response(response_data)


