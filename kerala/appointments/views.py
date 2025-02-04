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

        # Log patient data
        logger.info(f"Patient data received: {patient_data}")

        # Check if a patient with the same name exists
        existing_patient = Patient.objects.filter(
            first_name=patient_data["first_name"], 
            last_name=patient_data["last_name"]
        ).first()

        if existing_patient:
            last_appointment = Appointment.objects.filter(patient=existing_patient).order_by('-appointment_date').first()
            last_status = last_appointment.status if last_appointment else "No previous appointments"

            logger.info(f"Existing patient found: {existing_patient.id} ({existing_patient.first_name} {existing_patient.last_name}), last status: {last_status}")

            if last_status != "Completed":
                logger.warning(f"Attempt to create a new appointment for patient {existing_patient.id} with an active appointment.")
                return Response(
                    {"error": "Patient already has an active appointment. Please complete or cancel the existing appointment before creating a new one."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            patient = existing_patient  # Use the existing patient
        else:
            # Create a new patient
            patient = Patient.objects.create(
                first_name=patient_data["first_name"],
                last_name=patient_data["last_name"],
                contact_number=patient_data["contact_number"],
                email=patient_data.get("email"),
                date_of_birth=patient_data.get("date_of_birth"),
            )
            logger.info(f"New patient created: {patient.id} ({patient.first_name} {patient.last_name})")

        # Proceed to create an appointment
        appointment_data = {
            "patient": patient,
            "appointment_date": data.get("appointment_date"),
            "notes": data.get("notes", ""),
            "status": "Pending",
            "is_emergency": data.get("is_emergency", False)
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
                logger.info(f"Doctor assigned: {doctor.id} ({doctor.first_name} {doctor.last_name})")
            except Doctor.DoesNotExist:
                logger.error(f"Doctor with ID {doctor_id} not found.")
                return Response({"error": "Doctor not found."}, status=status.HTTP_404_NOT_FOUND)

        elif user.user_type == "Doctor":
            appointment_data["doctor"] = user.doctor
            logger.info(f"Appointment assigned to doctor {user.doctor.id} ({user.doctor.first_name} {user.doctor.last_name})")

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
from .models import Appointment
from .serializers import AppointmentSerializer

# views.py
@method_decorator(csrf_exempt, name='dispatch')
class AppointmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        status_filter = request.query_params.get('status', 'Pending')
        user = request.user

        if user.user_type == "Doctor":
            appointments = Appointment.objects.filter(doctor=user.doctor, status=status_filter)
        elif user.user_type == "Receptionist":
            appointments = Appointment.objects.filter(receptionist=user.receptionist, status=status_filter)
        else:
            return Response({"error": "Only Doctors and Receptionists can view appointments."}, status=status.HTTP_403_FORBIDDEN)

        serializer = AppointmentSerializer(appointments, many=True)
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
