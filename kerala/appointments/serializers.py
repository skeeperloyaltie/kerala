from rest_framework import serializers
from .models import Appointment, Patient, AppointmentTests
from users.models import Doctor, Receptionist


from rest_framework import serializers
from .models import Patient
from datetime import date

from rest_framework import serializers
from .models import Patient

class PatientSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(format="%Y-%m-%d", input_formats=["%Y-%m-%d"])
    primary_doctor = serializers.PrimaryKeyRelatedField(queryset=Doctor.objects.all(), allow_null=True)

    class Meta:
        model = Patient
        fields = [
            'patient_id', 'first_name', 'last_name', 'gender', 'date_of_birth', 'age', 'father_name',
            'address', 'city', 'pincode', 'email', 'mobile_number', 'alternate_mobile_number', 'aadhar_number',
            'blood_group', 'known_allergies', 'current_medications', 'past_medical_history', 'specific_notes',
            'primary_doctor', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_number',
            'insurance_provider', 'policy_number', 'payment_preference', 'admission_type'
        ]
        read_only_fields = ['patient_id', 'age']

from rest_framework import serializers
from rest_framework import serializers
from users.models import Doctor

class DoctorSerializer(serializers.ModelSerializer):
    # If you want to include the related User model's first_name and last_name
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = Doctor
        fields = ['id', 'user', 'specialization', 'contact_number', 'email', 'first_name', 'last_name']



from rest_framework import serializers
from .models import Appointment, Patient, AppointmentTests, Vitals

from rest_framework import serializers
from .models import Vitals

class VitalsSerializer(serializers.ModelSerializer):
    recorded_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S")

    class Meta:
        model = Vitals
        fields = [
            'temperature', 'height', 'weight', 'blood_pressure', 'heart_rate',
            'respiratory_rate', 'oxygen_saturation', 'blood_sugar_level', 'bmi',
            'recorded_at', 'recorded_by'
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['recorded_by'] = instance.recorded_by.username if instance.recorded_by else "N/A"
        return representation

from rest_framework import serializers
from .models import Appointment, Patient, AppointmentTests
from users.models import Doctor, Receptionist
from datetime import datetime
import pytz

KOLKATA_TZ = pytz.timezone("Asia/Kolkata")

from rest_framework import serializers
from .models import Appointment, Patient
from users.models import Doctor, Receptionist

KOLKATA_TZ = pytz.timezone("Asia/Kolkata")



KOLKATA_TZ = pytz.timezone("Asia/Kolkata")

class AppointmentSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.CharField(write_only=True, source="patient.patient_id")
    doctor = DoctorSerializer(read_only=True)
    doctor_id = serializers.PrimaryKeyRelatedField(queryset=Doctor.objects.all(), write_only=True, source="doctor")
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)
    appointment_date = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S%z")
    vitals = VitalsSerializer(read_only=True)  # Nested Vitals

    class Meta:
        model = Appointment
        fields = [
            "id", "patient", "patient_id", "doctor", "doctor_id", "appointment_date", "status",
            "notes", "created_by_username", "updated_by_username", "is_emergency", "updated_by",
            "updated_at", "vitals"
        ]
        read_only_fields = ["id", "created_by", "created_by_username", "updated_by", "updated_by_username"]

    def to_internal_value(self, data):
        if "appointment_date" in data:
            try:
                appointment_date_str = data["appointment_date"]
                if "Z" in appointment_date_str or "+" in appointment_date_str or "-" in appointment_date_str:
                    appointment_date = datetime.fromisoformat(appointment_date_str)
                else:
                    appointment_date = datetime.strptime(appointment_date_str, "%Y-%m-%dT%H:%M")
                    appointment_date = KOLKATA_TZ.localize(appointment_date)
                data["appointment_date"] = appointment_date.astimezone(KOLKATA_TZ)
            except ValueError:
                raise serializers.ValidationError({"appointment_date": "Invalid format. Use 'YYYY-MM-DDTHH:MM'."})
        return super().to_internal_value(data)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Add Illness (current_medications) from patient
        representation['illness'] = instance.patient.current_medications if instance.patient.current_medications else "None"
        # Placeholder for Visited Time and Completion Status
        representation['visited_time'] = None  # To be implemented later
        representation['completion_status'] = None  # To be implemented later
        return representation



        
        





class AppointmentTestsSerializer(serializers.ModelSerializer):
    """
    Serializer for Appointment Tests, ensuring validation.
    """
    class Meta:
        model = AppointmentTests
        fields = ["id", "appointment", "test_name", "result"]