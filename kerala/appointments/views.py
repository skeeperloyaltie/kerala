from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment, Patient, AppointmentTests
from .serializers import AppointmentSerializer, PatientSerializer, AppointmentTestsSerializer
from users.models import Doctor, Receptionist

from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment, Patient, AppointmentTests
from .serializers import AppointmentSerializer, PatientSerializer, AppointmentTestsSerializer
from users.models import Doctor, Receptionist
from django.views.decorators.csrf import csrf_exempt

@method_decorator(csrf_exempt, name='dispatch')
class CreateAppointmentView(APIView):
    """
    Endpoint for creating appointments while ensuring patients can have multiple appointments only if the last one is completed.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data

        # Validate patient details
        patient_data = data.get("patient", None)
        if not patient_data:
            return Response({"error": "Patient details are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if the patient already exists
        patient, created = Patient.objects.get_or_create(
            first_name=patient_data["first_name"],
            last_name=patient_data["last_name"],
            contact_number=patient_data["contact_number"],
            defaults={
                "email": patient_data.get("email"),
                "date_of_birth": patient_data.get("date_of_birth"),
            },
        )

        # Ensure the patient can only have multiple appointments if the last one is completed
        last_appointment = Appointment.objects.filter(patient=patient).order_by('-appointment_date').first()
        if last_appointment and last_appointment.status != "Completed":
            return Response(
                {"error": "Patient already has an active appointment. Please complete or cancel the existing appointment before creating a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate appointment details
        appointment_data = {
            "patient": patient.id,
            "appointment_date": data.get("appointment_date"),
            "notes": data.get("notes", ""),
            "status": "Pending",  # Default to Pending
            "is_emergency": data.get("is_emergency", False)  # Capture the emergency status
        }

        if user.user_type == "Receptionist":
            doctor_id = data.get("doctor", None)
            if not doctor_id:
                return Response({"error": "Doctor assignment is required for appointments."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                doctor = Doctor.objects.get(id=doctor_id)
                appointment_data["doctor"] = doctor.id
                appointment_data["receptionist"] = user.receptionist.id
            except Doctor.DoesNotExist:
                return Response({"error": "Doctor not found."}, status=status.HTTP_404_NOT_FOUND)

            # Allow vitals for emergencies only
            if appointment_data["is_emergency"]:
                vitals_data = data.get("vitals", None)
                if vitals_data:
                    vitals_serializer = AppointmentTestsSerializer(data=vitals_data)
                    if not vitals_serializer.is_valid():
                        return Response(vitals_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                    vitals_serializer.save(appointment=appointment_data)

        elif user.user_type == "Doctor":
            appointment_data["doctor"] = user.doctor.id

            # Automatically add vitals if a doctor creates an appointment
            vitals_data = data.get("vitals", None)
            if vitals_data:
                vitals_serializer = AppointmentTestsSerializer(data=vitals_data)
                if not vitals_serializer.is_valid():
                    return Response(vitals_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                vitals_serializer.save(appointment=appointment_data)

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

class AppointmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Get the status from query params, default to 'Pending'
        status_filter = request.query_params.get('status', 'Pending')
        user = request.user

        if user.user_type == "Doctor":
            appointments = Appointment.objects.filter(doctor=user.doctor, status=status_filter)
        elif user.user_type == "Receptionist":
            appointments = Appointment.objects.filter(receptionist=user.receptionist, status=status_filter)
        else:
            return Response({"error": "Only Doctors and Receptionists can view appointments."}, status=status.HTTP_403_FORBIDDEN)

        # Serialize the appointment data
        serializer = AppointmentSerializer(appointments, many=True)
        return Response({"appointments": serializer.data}, status=status.HTTP_200_OK)
