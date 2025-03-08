import logging
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone
from django.utils.timezone import make_aware

import pytz
from datetime import datetime
from .models import Appointment, Patient
from .serializers import AppointmentSerializer, PatientSerializer
from users.models import Doctor

# Configure logger
logger = logging.getLogger(__name__)

# Set the timezone to Asia/Kolkata
KOLKATA_TZ = pytz.timezone("Asia/Kolkata")


@method_decorator(csrf_exempt, name='dispatch')
class CreatePatientView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        logger.info(f"Received patient creation request from user {request.user.username}: {request.data}")
        serializer = PatientSerializer(data=request.data)
        if serializer.is_valid():
            patient = serializer.save()
            logger.info(f"Patient created successfully: {patient.patient_id}")
            return Response({"message": "Patient created successfully.", "patient": PatientSerializer(patient).data}, status=status.HTTP_201_CREATED)
        logger.error(f"Patient creation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class CreateAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data
        logger.info(f"Received appointment creation request from user {user.username}: {data}")

        required_fields = ["patient_id", "appointment_date", "doctor_id"]
        missing_fields = [field for field in required_fields if field not in data or not data[field]]
        if missing_fields:
            logger.warning(f"Missing fields: {missing_fields}")
            return Response({"error": f"Missing required fields: {', '.join(missing_fields)}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            patient = Patient.objects.get(patient_id=data["patient_id"])
        except Patient.DoesNotExist:
            logger.error(f"Patient with ID {data['patient_id']} not found.")
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            doctor = Doctor.objects.get(id=data["doctor_id"])
        except Doctor.DoesNotExist:
            logger.error(f"Doctor with ID {data['doctor_id']} not found.")
            return Response({"error": "Doctor not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            appointment_date = datetime.fromisoformat(data["appointment_date"].replace("Z", "+00:00"))
            appointment_date = KOLKATA_TZ.localize(appointment_date) if not appointment_date.tzinfo else appointment_date.astimezone(KOLKATA_TZ)
        except ValueError:
            logger.error("Invalid appointment date format.")
            return Response({"error": "Invalid appointment date format. Use 'YYYY-MM-DDTHH:MM'."}, status=status.HTTP_400_BAD_REQUEST)

        now_kolkata = datetime.now(KOLKATA_TZ)
        if appointment_date < now_kolkata:
            logger.warning(f"Past appointment date: {appointment_date}")
            return Response({"error": "Appointment date must be in the future."}, status=status.HTTP_400_BAD_REQUEST)

        if Appointment.objects.filter(patient=patient, appointment_date=appointment_date).exists():
            logger.warning(f"Duplicate appointment for {patient.patient_id} on {appointment_date}")
            return Response({"error": "An appointment for this patient at this date and time already exists."}, status=status.HTTP_400_BAD_REQUEST)

        appointment = Appointment.objects.create(
            patient=patient,
            doctor=doctor,
            appointment_date=appointment_date,
            notes=data.get("notes", ""),
            status="Scheduled",
            is_emergency=data.get("is_emergency", False),
            created_by=user
        )

        logger.info(f"Appointment created: {appointment.id}")
        return Response({
            "message": "Appointment created successfully.",
            "appointment": AppointmentSerializer(appointment).data
        }, status=status.HTTP_201_CREATED)




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
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment, Patient
from .serializers import AppointmentSerializer
from users.models import Doctor, Receptionist
from datetime import datetime
import pytz
import logging

logger = logging.getLogger(__name__)
KOLKATA_TZ = pytz.timezone("Asia/Kolkata")

@method_decorator(csrf_exempt, name='dispatch')
class EditAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id):
        user = request.user
        data = request.data.copy()

        logger.info(f"User {user.username} ({user.user_type}) attempting to edit appointment {appointment_id}.")
        logger.info(f"Received data: {data}")

        if not hasattr(user, 'doctor') and not hasattr(user, 'receptionist'):
            logger.warning(f"Unauthorized attempt to edit appointment {appointment_id} by {user.username}.")
            return Response({"error": "Only doctors and receptionists can edit appointments."}, status=status.HTTP_403_FORBIDDEN)

        appointment = get_object_or_404(Appointment, id=appointment_id)

        if hasattr(user, 'doctor') and appointment.doctor != user.doctor:
            logger.warning(f"Doctor {user.username} tried to edit an appointment they don't own.")
            return Response({"error": "You can only edit your own appointments."}, status=status.HTTP_403_FORBIDDEN)

        # Process patient_id if provided
        if "patient_id" in data:
            patient = get_object_or_404(Patient, patient_id=data["patient_id"])
            appointment.patient = patient
            logger.info(f"Matched patient ID {data['patient_id']} to DB ID {patient.id}")

        # Update patient fields if provided
        if "current_illness" in data:
            appointment.patient.current_illness = data["current_illness"]
            appointment.patient.save()

        # Handle appointment_date
        if "appointment_date" in data:
            try:
                appointment_date_str = data["appointment_date"]
                appointment_date = datetime.fromisoformat(appointment_date_str.replace("Z", "+00:00"))
                appointment_date = KOLKATA_TZ.localize(appointment_date) if not appointment_date.tzinfo else appointment_date.astimezone(KOLKATA_TZ)
                
                now_kolkata = datetime.now(KOLKATA_TZ)
                if appointment_date <= now_kolkata:
                    logger.warning(f"Attempt to set appointment {appointment_id} date in the past: {appointment_date}")
                    return Response({"error": "Appointment date must be in the future."}, status=status.HTTP_400_BAD_REQUEST)
                
                appointment.appointment_date = appointment_date
            except ValueError as e:
                logger.error(f"Invalid appointment date format: {e}")
                return Response({"error": "Invalid date format. Use 'YYYY-MM-DDTHH:MM:SS' (e.g., '2025-03-10T14:30:00')."}, status=status.HTTP_400_BAD_REQUEST)

        # Handle doctor_id
        if "doctor_id" in data and data["doctor_id"]:
            doctor = get_object_or_404(Doctor, id=data["doctor_id"])
            appointment.doctor = doctor

        appointment.notes = data.get("notes", appointment.notes)
        appointment.updated_by = user

        # Handle status update
        allowed_statuses = ["Waiting", "Scheduled", "Pending", "Active", "Completed", "Canceled", "Rescheduled"]
        if "status" in data:
            if data["status"] in allowed_statuses:
                appointment.status = data["status"]
            else:
                logger.error(f"Invalid status '{data['status']}' provided.")
                return Response({"error": "Invalid status value."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            appointment.save()
            serializer = AppointmentSerializer(appointment)
            logger.info(f"Appointment {appointment_id} successfully updated by {user.username}.")
            return Response({
                "message": "Appointment updated successfully.",
                "appointment": serializer.data
            }, status=status.HTTP_200_OK)
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
from .models import Appointment
import pytz

logger = logging.getLogger(__name__)
KOLKATA_TZ = pytz.timezone("Asia/Kolkata")

@method_decorator(csrf_exempt, name='dispatch')
class CancelAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id=None):
        user = request.user
        data = request.data
        appointment_ids = data.get("appointment_ids")

        logger.info(f"User {user.username} attempting to cancel appointment(s).")

        if not hasattr(user, 'doctor') and not hasattr(user, 'receptionist'):
            logger.warning(f"Unauthorized cancellation attempt by {user.username}.")
            return Response({"error": "Only doctors and receptionists can cancel appointments."}, status=status.HTTP_403_FORBIDDEN)

        if appointment_id:
            appointments = [get_object_or_404(Appointment, id=appointment_id)]
        elif appointment_ids:
            appointments = Appointment.objects.filter(id__in=appointment_ids)
            if not appointments.exists():
                return Response({"error": "No valid appointments found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({"error": "Appointment ID or list of IDs required."}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        now_kolkata = datetime.now(KOLKATA_TZ)  # Use for logging or future checks if needed
        for appointment in appointments:
            if hasattr(user, 'doctor') and appointment.doctor != user.doctor:
                logger.warning(f"Doctor {user.username} tried to cancel an appointment they don't own.")
                continue

            appointment.status = data.get("status", "Canceled")
            appointment.updated_by = user
            appointment.save()
            updated_count += 1

        if updated_count == 0:
            return Response({"error": "No appointments were canceled. Check permissions or appointment IDs."}, status=status.HTTP_403_FORBIDDEN)

        logger.info(f"User {user.username} successfully canceled {updated_count} appointment(s) at {now_kolkata}.")
        return Response({"message": f"Successfully canceled {updated_count} appointment(s)."}, status=status.HTTP_200_OK)

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
import logging
from .models import Appointment
from .serializers import AppointmentSerializer  # Add this for serialization
from datetime import datetime
import pytz

logger = logging.getLogger(__name__)
KOLKATA_TZ = pytz.timezone("Asia/Kolkata")

@method_decorator(csrf_exempt, name='dispatch')
class RescheduleAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id=None):
        user = request.user
        data = request.data
        new_date_str = data.get("appointment_date")
        appointment_ids = data.get("appointment_ids")
        patient_id = data.get("patient_id")

        logger.info(f"User {user.username} attempting to reschedule appointments.")

        if not hasattr(user, 'doctor') and not hasattr(user, 'receptionist'):
            logger.warning(f"Unauthorized attempt by {user.username}.")
            return Response({"error": "Only doctors and receptionists can reschedule appointments."}, status=status.HTTP_403_FORBIDDEN)

        if not new_date_str:
            logger.error("Reschedule request is missing the new date.")
            return Response({"error": "New appointment date is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Parse and validate appointment_date in Kolkata timezone
        try:
            new_date = datetime.fromisoformat(new_date_str.replace("Z", "+00:00"))
            new_date = KOLKATA_TZ.localize(new_date) if not new_date.tzinfo else new_date.astimezone(KOLKATA_TZ)
        except ValueError:
            logger.error(f"Invalid date format: {new_date_str}")
            return Response({"error": "Invalid date format. Use 'YYYY-MM-DDTHH:MM:SS' (e.g., '2025-03-10T14:30:00')."}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure the date is in the future
        now_kolkata = datetime.now(KOLKATA_TZ)
        if new_date <= now_kolkata:
            logger.warning(f"Attempt to reschedule to past date: {new_date}")
            return Response({"error": "New appointment date must be in the future."}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch appointments to reschedule
        appointments = []
        if appointment_id:
            appointments = [get_object_or_404(Appointment, id=appointment_id)]
        elif appointment_ids:
            appointments = list(Appointment.objects.filter(id__in=appointment_ids))
        elif patient_id:
            appointments = list(Appointment.objects.filter(patient__patient_id=patient_id))
        else:
            return Response({"error": "Provide an appointment ID, list of IDs, or patient ID."}, status=status.HTTP_400_BAD_REQUEST)

        if not appointments:
            return Response({"error": "No valid appointments found."}, status=status.HTTP_404_NOT_FOUND)

        # Process appointment updates
        updated_count = 0
        allowed_statuses = [choice[0] for choice in Appointment.STATUS_CHOICES]
        requested_status = data.get("status", "scheduled").lower()  # Default to "scheduled"

        if requested_status not in allowed_statuses:
            logger.error(f"Invalid status '{requested_status}' provided.")
            return Response({"error": f"Invalid status value. Allowed values: {', '.join(allowed_statuses)}"}, status=status.HTTP_400_BAD_REQUEST)

        updated_appointments = []
        for appointment in appointments:
            if hasattr(user, 'doctor') and appointment.doctor != user.doctor:
                logger.warning(f"Doctor {user.username} attempted unauthorized reschedule.")
                continue

            # Check if this is a reschedule by comparing dates
            was_rescheduled = appointment.appointment_date != new_date

            # Update fields
            original_status = appointment.status
            appointment.appointment_date = new_date
            appointment.status = requested_status  # Set to "scheduled" or requested status
            appointment.updated_by = user
            appointment.save()

            # Check history for prior rescheduling
            history_records = appointment.history.all().order_by('-history_date')
            is_rescheduled = was_rescheduled or any(
                record.status == 'rescheduled' for record in history_records[1:]  # Skip current change
            )

            updated_count += 1
            updated_appointments.append({
                "appointment": AppointmentSerializer(appointment).data,
                "is_rescheduled": is_rescheduled
            })

        if updated_count == 0:
            return Response({"error": "No appointments were updated. Check permissions or IDs."}, status=status.HTTP_403_FORBIDDEN)

        logger.info(f"User {user.username} successfully rescheduled {updated_count} appointment(s) to {new_date}.")
        return Response({
            "message": f"Successfully rescheduled {updated_count} appointment(s) to {new_date} (Kolkata time).",
            "appointments": [
                {
                    "id": appt["appointment"]["id"],
                    "status": appt["appointment"]["status"],
                    "is_rescheduled": appt["is_rescheduled"],
                    "appointment_date": appt["appointment"]["appointment_date"]
                } for appt in updated_appointments
            ]
        }, status=status.HTTP_200_OK)

import logging
from rest_framework import generics, permissions, pagination
from rest_framework.response import Response
from django.core.cache import cache
from django.db.models import Q
from users.models import Doctor, Receptionist
from .models import Patient, Appointment
from users.serializers import UserSerializer
from .serializers import PatientSerializer, AppointmentSerializer
from datetime import datetime

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

        # Collect available search parameters
        patient_ids = query_params.getlist("patient_id", [])
        patient_ids = [pid.strip() for pid in patient_ids if pid.strip()] if patient_ids else []
        first_name = query_params.get("first_name", "").strip()
        last_name = query_params.get("last_name", "").strip()
        contact_number = query_params.get("contact_number", "").strip()
        email = query_params.get("email", "").strip()
        status = query_params.get("status", "").strip()
        date_of_birth = query_params.get("date_of_birth", "").strip()
        appointment_date = query_params.get("appointment_date", "").strip()
        doctor_id = query_params.get("doctor_id", "").strip()

        query_key = f"{','.join(patient_ids)}_{first_name}_{last_name}_{contact_number}_{email}_{status}_{date_of_birth}_{appointment_date}_{doctor_id}"
        cache_key = f"search_{user.id}_{query_key}"

        logger.info(f"Received query params: {query_params}")
        logger.info(f"User {user.id} ({user.user_type}) searching with parameters: {query_key}")

        # Check cached results
        cached_results = cache.get(cache_key)
        if cached_results:
            logger.info(f"Cache hit for user {user.id}, query: {query_key}")
            return cached_results

        if not any([patient_ids, first_name, last_name, contact_number, email, status, date_of_birth, appointment_date, doctor_id]):
            logger.info(f"Empty query received from user {user.id}.")
            return {"patients": [], "appointments": []}  # Consistent return type

        # Prepare query sets
        patients, appointments = [], []

        if hasattr(user, "receptionist"):  # Receptionists can search all
            if patient_ids:
                patients = Patient.objects.filter(patient_id__in=patient_ids)
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
            elif doctor_id:
                appointments = Appointment.objects.filter(doctor__id=doctor_id).prefetch_related('vitals')
                patient_ids_from_appts = appointments.values_list('patient__patient_id', flat=True)
                patients = Patient.objects.filter(patient_id__in=patient_ids_from_appts)
            elif first_name:
                patients = Patient.objects.filter(first_name__iexact=first_name)
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
            elif date_of_birth:
                try:
                    dob = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
                    patients = Patient.objects.filter(date_of_birth=dob)
                    patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                    appointments = Appointment.objects.filter(patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
                except ValueError:
                    logger.error(f"Invalid date_of_birth format: {date_of_birth}")
                    return {"patients": [], "appointments": []}
            elif appointment_date:
                try:
                    apt_date = datetime.strptime(appointment_date, "%Y-%m-%d").date()
                    appointments = Appointment.objects.filter(appointment_date__date=apt_date).prefetch_related('vitals')
                    patient_ids_from_appts = appointments.values_list('patient__patient_id', flat=True)
                    patients = Patient.objects.filter(patient_id__in=patient_ids_from_appts)
                except ValueError:
                    logger.error(f"Invalid appointment_date format: {appointment_date}")
                    return {"patients": [], "appointments": []}
            else:
                patients = Patient.objects.filter(
                    Q(last_name__icontains=last_name) |
                    Q(mobile_number__icontains=contact_number) |  # Updated to match Patient model field
                    Q(email__icontains=email)
                )
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')

        elif hasattr(user, "doctor"):  # Doctors search only their patients
            if patient_ids:
                patients = Patient.objects.filter(
                    patient_id__in=patient_ids,
                    appointments__doctor=user.doctor
                ).distinct()
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(
                    doctor=user.doctor,
                    patient__patient_id__in=patient_ids_from_patients
                ).prefetch_related('vitals')
            elif doctor_id:
                if str(user.doctor.id) == doctor_id:
                    appointments = Appointment.objects.filter(doctor=user.doctor).prefetch_related('vitals')
                    patient_ids_from_appts = appointments.values_list('patient__patient_id', flat=True)
                    patients = Patient.objects.filter(patient_id__in=patient_ids_from_appts)
                else:
                    return {"patients": [], "appointments": []}
            elif first_name:
                patients = Patient.objects.filter(
                    Q(appointments__doctor=user.doctor) & Q(first_name__iexact=first_name)
                ).distinct()
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(
                    doctor=user.doctor,
                    patient__patient_id__in=patient_ids_from_patients
                ).prefetch_related('vitals')
            # Add additional doctor-specific conditions as needed...

        # Compile results
        results = {
            "patients": list(patients),
            "appointments": list(appointments)
        }

        logger.info(f"Total search results fetched for user {user.id}: {sum(len(v) for v in results.values())}")
        cache.set(cache_key, results, timeout=600)
        return results

    def list(self, request, *args, **kwargs):
        search_results = self.get_queryset()
        if isinstance(search_results, dict):
            paginated_results = {
                "patients": self.paginate_queryset(search_results.get("patients", [])),
                "appointments": self.paginate_queryset(search_results.get("appointments", []))
            }
        else:
            paginated_results = {"patients": self.paginate_queryset(search_results)}

        response_data = {
            "patients": PatientSerializer(paginated_results.get("patients", []), many=True).data if paginated_results.get("patients") else [],
            "appointments": AppointmentSerializer(paginated_results.get("appointments", []), many=True).data if paginated_results.get("appointments") else [],
        }
        return Response(response_data)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Patient
from .serializers import PatientSerializer

class GetPatientDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id):
        try:
            patient = Patient.objects.get(patient_id=patient_id)
            return Response({"patient": PatientSerializer(patient).data}, status=200)
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found"}, status=404)


# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Patient
import logging

logger = logging.getLogger(__name__)

class PatientHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id):
        try:
            patient = get_object_or_404(Patient, patient_id=patient_id)
            # Fetch history for Patient, Appointments, and Vitals
            patient_history = patient.history.all().order_by('-history_date')
            appointment_history = []
            vitals_history = []
            for appt in patient.appointments.all():
                appointment_history.extend(appt.history.all())
                if hasattr(appt, 'vitals'):
                    vitals_history.extend(appt.vitals.history.all())

            # Combine and format history data
            history_data = []
            for record in patient_history:
                history_data.append({
                    'changed_at': record.history_date,
                    'changed_by': record.history_user.username if record.history_user else 'N/A',
                    'change_type': record.history_type,
                    'changes': record.diff_against(record.prev_record).changes if record.prev_record else [],
                    'model': 'Patient',
                })
            for record in appointment_history:
                history_data.append({
                    'changed_at': record.history_date,
                    'changed_by': record.history_user.username if record.history_user else 'N/A',
                    'change_type': record.history_type,
                    'changes': record.diff_against(record.prev_record).changes if record.prev_record else [],
                    'model': 'Appointment',
                    'appointment_id': record.id,
                })
            for record in vitals_history:
                history_data.append({
                    'changed_at': record.history_date,
                    'changed_by': record.history_user.username if record.history_user else 'N/A',
                    'change_type': record.history_type,
                    'changes': record.diff_against(record.prev_record).changes if record.prev_record else [],
                    'model': 'Vitals',
                    'appointment_id': record.appointment_id,
                })

            # Sort by date descending
            history_data.sort(key=lambda x: x['changed_at'], reverse=True)

            logger.info(f"History fetched for patient {patient_id} by {request.user.username}")
            return Response({'history': history_data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching history for patient {patient_id}: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)