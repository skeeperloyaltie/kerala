import logging
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment, Patient, AppointmentTests
from .serializers import AppointmentSerializer, PatientSerializer, AppointmentTestsSerializer
from users.models import Doctor, Receptionist

# Configure logger
logger = logging.getLogger(__name__)
@method_decorator(csrf_exempt, name='dispatch')
class CreateAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data

        logger.info(f"Received appointment creation request from user {user.id} ({user.username}): {data}")

        required_fields = ["patient", "appointment_date"]
        missing_fields = [field for field in required_fields if field not in data or not data[field]]
        if missing_fields:
            logger.warning(f"Missing fields in request: {missing_fields}")
            return Response({"error": f"Missing required fields: {', '.join(missing_fields)}"}, status=status.HTTP_400_BAD_REQUEST)

        patient_data = data.get("patient")
        if not isinstance(patient_data, dict):
            logger.error("Invalid format for patient details.")
            return Response({"error": "Patient details must be a dictionary."}, status=status.HTTP_400_BAD_REQUEST)

        # Extract patient info
        first_name = patient_data.get("first_name", "").strip()
        contact_number = patient_data.get("contact_number", "").strip()
        appointment_date = data.get("appointment_date")

        if not first_name or not contact_number:
            logger.error("Patient's first name and contact number are required.")
            return Response({"error": "Patient's first name and contact number are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Check for existing patient using first_name and contact_number
        patient, created = Patient.objects.get_or_create(
            first_name=first_name,
            contact_number=contact_number,
            defaults={
                "last_name": patient_data.get("last_name", ""),
                "email": patient_data.get("email"),
                "date_of_birth": patient_data.get("date_of_birth"),
            }
        )

        if not created:
            # Update existing patient details if they are missing
            updated = False
            if not patient.last_name and patient_data.get("last_name"):
                patient.last_name = patient_data["last_name"]
                updated = True
            if not patient.email and patient_data.get("email"):
                patient.email = patient_data["email"]
                updated = True
            if not patient.date_of_birth and patient_data.get("date_of_birth"):
                patient.date_of_birth = patient_data["date_of_birth"]
                updated = True

            if updated:
                patient.save()
                logger.info(f"Updated existing patient details: {patient.id}")

        logger.info(f"Using patient: {patient.id} ({patient.first_name} {patient.last_name})")

        # **Duplicate Appointment Check**
        duplicate_appointment = Appointment.objects.filter(
            first_name=first_name,
            contact_number=contact_number,
            appointment_date=appointment_date
        ).exists()

        if duplicate_appointment:
            logger.warning(f"Duplicate appointment detected for {first_name} ({contact_number}) on {appointment_date}")
            return Response(
                {"error": "An appointment for this patient at the specified date and time already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Proceed to create the appointment
        appointment_data = {
            "patient": patient,
            "appointment_date": appointment_date,
            "notes": data.get("notes", ""),
            "status": "Scheduled",
            "is_emergency": data.get("is_emergency", False),
            "created_by": user,
            "first_name": first_name,
            "contact_number": contact_number
        }

        if user.user_type == "Receptionist":
            doctor_id = data.get("doctor")
            if not doctor_id:
                logger.error("Doctor assignment is missing for Receptionist.")
                return Response({"error": "Doctor assignment is required for appointments."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                doctor = Doctor.objects.get(id=doctor_id)
                appointment_data["doctor"] = doctor
                appointment_data["receptionist"] = user.receptionist
                logger.info(f"Appointment assigned to doctor {doctor.id} ({doctor.user.first_name} {doctor.user.last_name})")
            except Doctor.DoesNotExist:
                logger.error(f"Doctor with ID {doctor_id} not found.")
                return Response({"error": "Doctor not found."}, status=status.HTTP_404_NOT_FOUND)

        elif user.user_type == "Doctor":
            # Fetch doctor from the related user profile
            doctor = user.doctor
            appointment_data["doctor"] = doctor
            logger.info(f"Appointment assigned to doctor {doctor.id} ({doctor.user.first_name} {doctor.user.last_name})")
            
        else:
            logger.error(f"Unauthorized user type {user.user_type} attempted to create an appointment.")
            return Response({"error": "Only Receptionists and Doctors can create appointments."}, status=status.HTTP_403_FORBIDDEN)

        # Save the appointment
        appointment = Appointment.objects.create(**appointment_data)
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
        logger.info(f"User {request.user.id} requested the list of doctors.")

        doctors = Doctor.objects.all()
        serializer = DoctorSerializer(doctors, many=True)

        logger.info(f"Fetched {len(doctors)} doctors.")

        return Response({"doctors": serializer.data}, status=status.HTTP_200_OK)


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

        # Doctors can only view their own appointments and patients assigned to them
        if user.user_type == "Doctor":
            appointments = Appointment.objects.filter(doctor=user.doctor, status=status_filter)

        # Receptionists can view all appointments
        elif user.user_type == "Receptionist":
            appointments = Appointment.objects.filter(status=status_filter)  # No doctor or patient filter for receptionists

        # For other user types, return an error
        else:
            return Response({"error": "Only Doctors and Receptionists can view appointments."}, status=status.HTTP_403_FORBIDDEN)

        # Serialize the appointments with full details
        serializer = AppointmentSerializer(appointments, many=True)

        # Log the serialized data
        logger.info(f"Fetched appointments: {serializer.data}")  # Logs the serialized appointment data

        return Response({"appointments": serializer.data}, status=status.HTTP_200_OK)





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

# Set up logging
logger = logging.getLogger(__name__)

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

        # Ensure user is a doctor or receptionist
        if not hasattr(user, 'doctor') and not hasattr(user, 'receptionist'):
            logger.warning(f"Unauthorized attempt to edit appointment {appointment_id} by {user.username}.")
            return Response({"error": "Only doctors and receptionists can edit appointments."}, status=status.HTTP_403_FORBIDDEN)

        appointment = get_object_or_404(Appointment, id=appointment_id)

        # Ensure doctor can only edit their own appointments
        if hasattr(user, 'doctor') and appointment.doctor != user.doctor:
            logger.warning(f"Doctor {user.username} tried to edit an appointment they don't own.")
            return Response({"error": "You can only edit your own appointments."}, status=status.HTTP_403_FORBIDDEN)

        # Update appointment fields
        if 'status' in data:
            appointment.status = data['status']
        appointment.updated_by = user  # Track the user making the change

        serializer = AppointmentSerializer(appointment, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"Appointment {appointment_id} successfully updated by {user.username}.")
            return Response({"message": "Appointment updated successfully.", "appointment": serializer.data}, status=status.HTTP_200_OK)

        logger.error(f"Error updating appointment {appointment_id}: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



@method_decorator(csrf_exempt, name='dispatch')
class CancelAppointmentView(APIView):
    """
    Allows doctors and receptionists to cancel an appointment with status update from the front end.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id):
        user = request.user
        data = request.data

        appointment = get_object_or_404(Appointment, id=appointment_id)

        logger.info(f"User {user.username} attempting to cancel appointment {appointment_id}.")

        if not hasattr(user, 'doctor') and not hasattr(user, 'receptionist'):
            logger.warning(f"Unauthorized attempt to cancel appointment {appointment_id} by {user.username}.")
            return Response({"error": "Only doctors and receptionists can cancel appointments."}, status=status.HTTP_403_FORBIDDEN)

        if hasattr(user, 'doctor') and appointment.doctor != user.doctor:
            logger.warning(f"Doctor {user.username} tried to cancel an appointment they don't own.")
            return Response({"error": "You can only cancel your own appointments."}, status=status.HTTP_403_FORBIDDEN)

        # Update status and track user making the change
        appointment.status = data.get("status", "Canceled")
        appointment.updated_by = user
        appointment.save()

        logger.info(f"Appointment {appointment_id} canceled successfully by {user.username}.")
        return Response({"message": "Appointment canceled successfully."}, status=status.HTTP_200_OK)



@method_decorator(csrf_exempt, name='dispatch')
class RescheduleAppointmentView(APIView):
    """
    Allows doctors and receptionists to reschedule an appointment, with status update from the front end.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id):
        user = request.user
        data = request.data
        new_date = data.get("appointment_date")

        logger.info(f"User {user.username} attempting to reschedule appointment {appointment_id} to {new_date}.")

        if not hasattr(user, 'doctor') and not hasattr(user, 'receptionist'):
            logger.warning(f"Unauthorized attempt to reschedule appointment {appointment_id} by {user.username}.")
            return Response({"error": "Only doctors and receptionists can reschedule appointments."}, status=status.HTTP_403_FORBIDDEN)

        appointment = get_object_or_404(Appointment, id=appointment_id)

        if hasattr(user, 'doctor') and appointment.doctor != user.doctor:
            logger.warning(f"Doctor {user.username} tried to reschedule an appointment they don't own.")
            return Response({"error": "You can only reschedule your own appointments."}, status=status.HTTP_403_FORBIDDEN)

        if not new_date:
            logger.error(f"Reschedule request for appointment {appointment_id} is missing new date.")
            return Response({"error": "New appointment date is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Update appointment date and status
        appointment.appointment_date = new_date
        appointment.status = data.get("status", "Rescheduled")
        appointment.updated_by = user  # Track user making the change
        appointment.save()

        logger.info(f"Appointment {appointment_id} successfully rescheduled to {new_date} by {user.username}.")
        return Response({"message": "Appointment rescheduled successfully."}, status=status.HTTP_200_OK)

## SEARCH ENDPOOINT
from rest_framework import generics, permissions, pagination
from rest_framework.response import Response
from django.core.cache import cache
from django.db.models import Q
from users.models import Doctor, Receptionist
from .models import Patient, Appointment
from users.serializers import UserSerializer
from .serializers import PatientSerializer, AppointmentSerializer

class StandardResultsSetPagination(pagination.PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class SearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        query = self.request.query_params.get("q", "").strip().lower()
        cache_key = f"search_{user.id}_{query}"

        # Check cache first
        cached_results = cache.get(cache_key)
        if cached_results:
            return cached_results

        if not query:
            return []

        patients, doctors, receptionists, appointments = [], [], [], []

        # Receptionists can search all users and appointments
        if hasattr(user, "receptionist"):
            patients = Patient.objects.filter(
                Q(first_name__icontains=query) | Q(last_name__icontains=query) | 
                Q(contact_number__icontains=query) | Q(email__icontains=query) |
                Q(address__icontains=query)
            )
            doctors = Doctor.objects.filter(
                Q(user__username__icontains=query) | Q(user__email__icontains=query) | 
                Q(specialization__icontains=query)
            )
            receptionists = Receptionist.objects.filter(
                Q(user__username__icontains=query) | Q(user__email__icontains=query)
            )
            appointments = Appointment.objects.filter(
                Q(patient__first_name__icontains=query) | Q(patient__last_name__icontains=query) | 
                Q(doctor__user__username__icontains=query) | Q(receptionist__user__username__icontains=query) |
                Q(status__icontains=query)
            )
        
        # Doctors can search only for their assigned patients and appointments
        elif hasattr(user, "doctor"):
            patients = Patient.objects.filter(
                Q(appointments__doctor=user.doctor) &
                (Q(first_name__icontains=query) | Q(last_name__icontains=query) | 
                 Q(contact_number__icontains=query) | Q(email__icontains=query) |
                 Q(address__icontains=query))
            ).distinct()

            appointments = Appointment.objects.filter(
                Q(doctor=user.doctor) & (
                    Q(patient__first_name__icontains=query) | 
                    Q(patient__last_name__icontains=query) | 
                    Q(status__icontains=query)
                )
            )

        results = {
            "patients": PatientSerializer(patients, many=True).data,
            "appointments": AppointmentSerializer(appointments, many=True).data,
            "doctors": UserSerializer(doctors, many=True).data,
            "receptionists": UserSerializer(receptionists, many=True).data
        }

        # Cache results for 10 minutes
        cache.set(cache_key, results, timeout=600)

        return results

    def list(self, request, *args, **kwargs):
        results = self.get_queryset()
        page = self.paginate_queryset(results)
        if page is not None:
            return self.get_paginated_response(page)

        return Response(results)


