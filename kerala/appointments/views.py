from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Appointment, Patient, AppointmentTests
from .serializers import AppointmentSerializer, PatientSerializer, AppointmentTestsSerializer
from users.models import Doctor, Receptionist
class CreateAppointmentView(APIView):
    """
    Endpoint for creating appointments, allowing different functionality for Doctors and Receptionists.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data

        # Validate patient details and vitals
        patient_data = data.get("patient", None)
        if not patient_data:
            return Response({"error": "Patient details are required."}, status=status.HTTP_400_BAD_REQUEST)

        patient_serializer = PatientSerializer(data=patient_data)
        if not patient_serializer.is_valid():
            return Response(patient_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
            appointment_data["doctor"] = user.doctor.id
        else:
            return Response({"error": "Only Receptionists and Doctors can create appointments."}, status=status.HTTP_403_FORBIDDEN)

        # Create appointment
        appointment_serializer = AppointmentSerializer(data=appointment_data)
        if not appointment_serializer.is_valid():
            return Response(appointment_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        appointment = appointment_serializer.save()

        return Response(
            {
                "message": "Appointment created successfully.",
                "appointment": appointment_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def get(self, request, *args, **kwargs):
        """
        Retrieve the list of doctors for the dropdown menu.
        """
        doctors = Doctor.objects.all()
        doctor_data = [{"id": doc.id, "name": f"{doc.user.first_name} {doc.user.last_name}", "specialization": doc.specialization} for doc in doctors]
        return Response(doctor_data, status=status.HTTP_200_OK)
