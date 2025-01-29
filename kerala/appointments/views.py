from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment, Patient, AppointmentTests
from .serializers import AppointmentSerializer, PatientSerializer, AppointmentTestsSerializer
from users.models import Doctor, Receptionist

@method_decorator(csrf_protect, name='dispatch')
class CreateAppointmentView(APIView):
    """
    Endpoint for creating appointments, allowing different functionality for Doctors and Receptionists.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data

        # Validate patient details
        patient_data = data.get("patient", None)
        if not patient_data:
            return Response({"error": "Patient details are required."}, status=status.HTTP_400_BAD_REQUEST)

        patient_serializer = PatientSerializer(data=patient_data)
        if not patient_serializer.is_valid():
            return Response(patient_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Create or get the patient
        patient, created = Patient.objects.get_or_create(
            first_name=patient_data["first_name"],
            last_name=patient_data["last_name"],
            contact_number=patient_data["contact_number"],
            defaults=patient_data,
        )

        # Validate appointment details
        appointment_data = {
            "patient": patient.id,
            "appointment_date": data.get("appointment_date"),
            "notes": data.get("notes", ""),
        }

        if user.user_type == "Receptionist":
            # Receptionists can only schedule appointments and assign a doctor
            doctor_id = data.get("doctor", None)
            if not doctor_id:
                return Response({"error": "Doctor assignment is required for appointments."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                doctor = Doctor.objects.get(id=doctor_id)
                appointment_data["doctor"] = doctor.id
                appointment_data["receptionist"] = user.receptionist.id
            except Doctor.DoesNotExist:
                return Response({"error": "Doctor not found."}, status=status.HTTP_404_NOT_FOUND)

        elif user.user_type == "Doctor":
            # Doctors can schedule appointments and add initial tests
            appointment_data["doctor"] = user.doctor.id

        else:
            return Response({"error": "Only Receptionists and Doctors can create appointments."}, status=status.HTTP_403_FORBIDDEN)

        # Create the appointment
        appointment_serializer = AppointmentSerializer(data=appointment_data)
        if not appointment_serializer.is_valid():
            return Response(appointment_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        appointment = appointment_serializer.save()

        # If a doctor is creating the appointment, handle initial tests
        if user.user_type == "Doctor" and "tests" in data:
            tests_data = data["tests"]
            tests_serializer = AppointmentTestsSerializer(data=tests_data)
            if not tests_serializer.is_valid():
                return Response(tests_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            tests_serializer.save(appointment=appointment)

        return Response(
            {
                "message": "Appointment created successfully.",
                "appointment": appointment_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )
