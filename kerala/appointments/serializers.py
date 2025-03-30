# appointments/serializers.py
from rest_framework import serializers
from .models import Appointment, Patient, AppointmentTests, Vitals
from users.models import Doctor, Receptionist, Nurse
from datetime import date, datetime
import pytz
from django.utils import timezone

KOLKATA_TZ = pytz.timezone("Asia/Kolkata")


class PatientSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(format="%Y-%m-%d", input_formats=["%Y-%m-%d"])
    primary_doctor = serializers.PrimaryKeyRelatedField(queryset=Doctor.objects.all(), allow_null=True)
    marital_since = serializers.DateField(format="%Y-%m-%d", input_formats=["%Y-%m-%d"], allow_null=True)

    class Meta:
        model = Patient
        fields = [
            'patient_id', 'first_name', 'last_name', 'gender', 'date_of_birth', 'age', 'father_name',
            'address', 'city', 'pincode', 'email', 'mobile_number', 'alternate_mobile_number', 'aadhar_number',
            'preferred_language', 'marital_status', 'marital_since', 'referred_by', 'channel', 'cio',
            'occupation', 'tag', 'blood_group', 'known_allergies', 'current_medications', 'past_medical_history',
            'specific_notes', 'primary_doctor', 'emergency_contact_name', 'emergency_contact_relationship',
            'emergency_contact_number', 'insurance_provider', 'policy_number', 'payment_preference',
            'admission_type', 'hospital_code'
        ]
        read_only_fields = ['patient_id', 'age']

    def validate_date_of_birth(self, value):
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 0:
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value


class DoctorSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    role_level = serializers.CharField(source='user.role_level', read_only=True)

    class Meta:
        model = Doctor
        fields = ['id', 'user', 'specialization', 'contact_number', 'email', 'first_name', 'last_name', 'role_level']


class VitalsSerializer(serializers.ModelSerializer):
    recorded_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)

    class Meta:
        model = Vitals
        fields = [
            'temperature', 'height', 'weight', 'blood_pressure', 'heart_rate',
            'respiratory_rate', 'oxygen_saturation', 'blood_sugar_level', 'bmi',
            'recorded_at', 'recorded_by'
        ]
        read_only_fields = ['recorded_at', 'recorded_by']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['recorded_by'] = instance.recorded_by.username if instance.recorded_by else "N/A"
        return representation


class AppointmentSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.CharField(write_only=True, source="patient.patient_id")
    doctor = DoctorSerializer(read_only=True)
    doctor_id = serializers.PrimaryKeyRelatedField(queryset=Doctor.objects.all(), write_only=True, source="doctor", allow_null=True)
    receptionist = serializers.PrimaryKeyRelatedField(read_only=True)  # No queryset needed since read-only
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)
    appointment_date = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%S%z")
    vitals = VitalsSerializer(read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id", "patient", "patient_id", "doctor", "doctor_id", "receptionist", "appointment_date", "status",
            "notes", "created_by", "created_by_username", "updated_by", "updated_by_username", "is_emergency",
            "created_at", "updated_at", "vitals"
        ]
        read_only_fields = [
            "id", "created_by", "created_by_username", "updated_by", "updated_by_username",
            "created_at", "updated_at", "receptionist"
        ]
        depth = 1

    def to_internal_value(self, data):
        validated_data = super().to_internal_value(data)
        appointment_date = validated_data.get('appointment_date')
        if appointment_date:
            KOLKATA_TZ = pytz.timezone("Asia/Kolkata")
            if not appointment_date.tzinfo:  # If naive datetime, localize it
                appointment_date = KOLKATA_TZ.localize(appointment_date)
            else:  # If aware, convert to Kolkata timezone
                appointment_date = appointment_date.astimezone(KOLKATA_TZ)
            validated_data['appointment_date'] = appointment_date
        return validated_data

    def create(self, validated_data):
        # Extract fields that need special handling
        patient_id = validated_data.pop('patient_id')  # Use 'patient_id' instead of 'patient.patient_id'
        doctor = validated_data.pop('doctor', None)  # Already a Doctor instance or None

        # Fetch the patient instance using patient_id
        try:
            patient = Patient.objects.get(patient_id=patient_id)
        except Patient.DoesNotExist:
            raise serializers.ValidationError({"patient_id": "Patient with this ID does not exist."})

        # Create the Appointment instance
        appointment = Appointment.objects.create(
            patient=patient,
            doctor=doctor,
            appointment_date=validated_data.get('appointment_date'),
            status=validated_data.get('status', 'scheduled'),
            notes=validated_data.get('notes', ''),
            is_emergency=validated_data.get('is_emergency', False),
            created_by=validated_data.get('created_by'),
            receptionist=validated_data.get('receptionist')
        )
        return appointment

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['illness'] = instance.patient.current_medications if instance.patient.current_medications else "None"
        representation['visited_time'] = None  # Placeholder
        representation['completion_status'] = None  # Placeholder
        return representation

    def validate_appointment_date(self, value):
        if value < timezone.now():
            raise serializers.ValidationError("Appointment date cannot be in the past.")
        return value

    def validate(self, data):
        # Additional validation if needed
        return data

class AppointmentTestsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentTests
        fields = ["id", "appointment", "temperature", "height", "weight", "blood_pressure"]


# serializers.py
from rest_framework import serializers
from .models import Patient, Appointment
from datetime import datetime
import pytz

class CreatePatientAndAppointmentSerializer(serializers.Serializer):
    # Patient fields
    
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    gender = serializers.CharField(max_length=10)
    date_of_birth = serializers.DateField()
    father_name = serializers.CharField(max_length=100)
    mobile_number = serializers.CharField(max_length=15)
    alternate_mobile_number = serializers.CharField(max_length=15, required=False, allow_blank=True)
    aadhar_number = serializers.CharField(max_length=12, required=False, allow_blank=True)
    preferred_language = serializers.CharField(max_length=50, required=False, allow_blank=True)
    marital_status = serializers.CharField(max_length=20, required=False, allow_blank=True)
    marital_since = serializers.DateField(required=False, allow_null=True)
    referred_by = serializers.CharField(max_length=100, required=False, allow_blank=True)
    channel = serializers.CharField(max_length=50, required=False, allow_blank=True)
    cio = serializers.CharField(max_length=50, required=False, allow_blank=True)
    occupation = serializers.CharField(max_length=100, required=False, allow_blank=True)
    tag = serializers.CharField(max_length=50, required=False, allow_blank=True)
    blood_group = serializers.CharField(max_length=10, required=False, allow_blank=True)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    pincode = serializers.CharField(max_length=10, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    known_allergies = serializers.CharField(max_length=255, required=False, allow_blank=True)
    current_medications = serializers.CharField(max_length=255, required=False, allow_blank=True)
    past_medical_history = serializers.CharField(max_length=255, required=False, allow_blank=True)
    specific_notes = serializers.CharField(max_length=255, required=False, allow_blank=True)
    primary_doctor = serializers.PrimaryKeyRelatedField(queryset=Doctor.objects.all(), required=False, allow_null=True)  # Changed to match PatientSerializer
    emergency_contact_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    emergency_contact_relationship = serializers.CharField(max_length=50, required=False, allow_blank=True)
    emergency_contact_number = serializers.CharField(max_length=15, required=False, allow_blank=True)
    insurance_provider = serializers.CharField(max_length=100, required=False, allow_blank=True)
    policy_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    payment_preference = serializers.CharField(max_length=50, required=False, allow_blank=True)
    admission_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    hospital_code = serializers.CharField(max_length=50, required=False, allow_blank=True)

    # Appointment fields
    doctor = serializers.PrimaryKeyRelatedField(queryset=Doctor.objects.all(), required=False, allow_null=True)
    appointment_date = serializers.DateTimeField(required=True)  # Correctly defined as DateTimeField
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True)
    is_emergency = serializers.BooleanField(default=False)

    def to_internal_value(self, data):
        validated_data = super().to_internal_value(data)
        appointment_date = validated_data.get('appointment_date')
        if appointment_date:
            KOLKATA_TZ = pytz.timezone("Asia/Kolkata")
            if not appointment_date.tzinfo:  # If naive datetime, localize it
                appointment_date = KOLKATA_TZ.localize(appointment_date)
            else:  # If aware, convert to Kolkata timezone
                appointment_date = appointment_date.astimezone(KOLKATA_TZ)
            validated_data['appointment_date'] = appointment_date
        return validated_data

    def validate_date_of_birth(self, value):
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 0:
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value

    def validate_appointment_date(self, value):
        if value < timezone.now():
            raise serializers.ValidationError("Appointment date cannot be in the past.")
        return value

    def validate(self, data):
        return data