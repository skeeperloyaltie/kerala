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

