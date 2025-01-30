from rest_framework import serializers
from .models import Appointment, Patient, AppointmentTests
from users.models import Doctor, Receptionist


class PatientSerializer(serializers.ModelSerializer):
    """
    Serializer for Patient model, including additional fields like illness, DOB, and contact details.
    """
    class Meta:
        model = Patient
        fields = [
            "id",
            "first_name",
            "last_name",
            "contact_number",
            "email",
            "date_of_birth",
            "current_illness",
            "age",
        ]


class AppointmentSerializer(serializers.ModelSerializer):
    """
    Serializer for Appointment model, ensuring validation and including necessary relationships.
    """
    patient = PatientSerializer(read_only=True)  # Serialize patient as an object
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.all(), write_only=True, source="patient"
    )  # Allow writing using patient ID

    doctor = serializers.PrimaryKeyRelatedField(
        queryset=Doctor.objects.all(), required=False
    )  # Direct relation to Doctor model
    doctor_name = serializers.CharField(source="doctor.get_full_name", read_only=True)  # Add doctor's name for easier access

    receptionist = serializers.PrimaryKeyRelatedField(
        queryset=Receptionist.objects.all(), required=False
    )  # Direct relation to Receptionist model
    receptionist_name = serializers.CharField(source="receptionist.get_full_name", read_only=True)  # Add receptionist's name for easier access

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_id",
            "doctor",
            "doctor_name",
            "receptionist",
            "receptionist_name",
            "appointment_date",
            "status",
            "notes",
        ]
        read_only_fields = ["id", "status"]  # ID and status should not be writable


class AppointmentTestsSerializer(serializers.ModelSerializer):
    """
    Serializer for Appointment Tests, ensuring validation.
    """
    class Meta:
        model = AppointmentTests
        fields = ["id", "appointment", "test_name", "result"]
