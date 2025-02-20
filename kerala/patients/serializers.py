from rest_framework import serializers
from appointments.models import Patient, Appointment, Vitals
from users.models import Doctor  # Import Doctor model


class DoctorSerializer(serializers.ModelSerializer):
    """Serializer for Doctor details"""
    class Meta:
        model = Doctor
        fields = ["id", "first_name", "last_name", "specialization", "contact_number", "email"]


class VitalsSerializer(serializers.ModelSerializer):
    """Serializer for vitals recorded during the appointment"""
    class Meta:
        model = Vitals
        fields = ["temperature", "height", "weight", "blood_pressure", "heart_rate", 
                  "respiratory_rate", "oxygen_saturation", "blood_sugar_level", "bmi", "recorded_at"]


class AppointmentSerializer(serializers.ModelSerializer):
    """Serializer for Appointment details, including doctor and vitals"""
    doctor = DoctorSerializer(read_only=True)  # Nested doctor details
    vitals = VitalsSerializer(read_only=True)  # Nested vitals

    class Meta:
        model = Appointment
        fields = ["id", "status", "appointment_date", "notes", "is_emergency", "doctor", "vitals"]


class PatientSerializer(serializers.ModelSerializer):
    """Serializer for Patient details, including appointments"""
    appointments = AppointmentSerializer(many=True, read_only=True)  # Fetch all appointments

    class Meta:
        model = Patient
        fields = ["patient_id", "first_name", "last_name", "contact_number", "email", 
                  "date_of_birth", "current_illness", "age", "appointments"]  # Includes appointments
