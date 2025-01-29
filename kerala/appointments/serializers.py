from rest_framework import serializers
from .models import Appointment, Patient, AppointmentTests

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
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.all(), write_only=True, source="patient"
    )

    doctor_id = serializers.PrimaryKeyRelatedField(
        queryset=Appointment.objects.all(), write_only=True, required=False, source="doctor"
    )
    
    receptionist_id = serializers.PrimaryKeyRelatedField(
        queryset=Appointment.objects.all(), write_only=True, required=False, source="receptionist"
    )

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_id",
            "doctor",
            "doctor_id",
            "receptionist",
            "receptionist_id",
            "appointment_date",
            ''
            "status",
            "notes",
        ]
        read_only_fields = ["id", "status"]


class AppointmentTestsSerializer(serializers.ModelSerializer):
    """
    Serializer for Appointment Tests, ensuring validation.
    """
    class Meta:
        model = AppointmentTests
        fields = ["id", "appointment", "test_name", "result"]
