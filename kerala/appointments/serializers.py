from rest_framework import serializers
from .models import Appointment, Patient, AppointmentTests
from users.models import Doctor, Receptionist


from rest_framework import serializers
from .models import Patient
from datetime import date


class PatientSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(format="%Y-%m-%d", input_formats=["%Y-%m-%d"])

    class Meta:
        model = Patient
        fields = ['patient_id','first_name', 'last_name', 'contact_number', 'email', 'date_of_birth', 'age']  # Add 'age' here

    def get_age(self, obj):
        # Check if date_of_birth is not None
        if obj.date_of_birth is None:
            return None  # or return 0 or any other value you prefer

        # Calculate age from date_of_birth
        today = date.today()
        age = today.year - obj.date_of_birth.year
        if today.month < obj.date_of_birth.month or (today.month == obj.date_of_birth.month and today.day < obj.date_of_birth.day):
            age -= 1
        return age


    age = serializers.SerializerMethodField()

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
        # Add other necessary fields as needed


class AppointmentSerializer(serializers.ModelSerializer):
    """
    Serializer for Appointment model, ensuring validation and including necessary relationships.
    """
    patient = PatientSerializer(read_only=True)  # Serialize patient as an object
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.all(), write_only=True, source="patient"
    )  # Allow writing using patient ID

    doctor = DoctorSerializer(read_only=True)  # Use DoctorSerializer to return full doctor details
    doctor_id = serializers.PrimaryKeyRelatedField(
        queryset=Doctor.objects.all(), write_only=True, source="doctor"
    )  # Allow writing using doctor ID

    receptionist = serializers.PrimaryKeyRelatedField(
        queryset=Receptionist.objects.all(), required=False
    )  # Direct relation to Receptionist model
    receptionist_name = serializers.CharField(source="receptionist.get_full_name", read_only=True)  # Add receptionist's name for easier access
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)  # Get username of creator

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_id",
            "doctor",
            "doctor_id",
            "receptionist",
            "receptionist_name",
            "appointment_date",
            "status",
            "notes",
            "created_by_username",
        ]
        read_only_fields = ["id", "status", "created_by", "created_by_username"]  # Make sure created_by fields are read-only

        
        

        
        



from rest_framework import serializers
from .models import Appointment, Patient, AppointmentTests, Vitals

class VitalsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vitals
        fields = '__all__'

    def validate(self, data):
        """
        Ensure that an appointment can only have one vitals record.
        """
        appointment = data.get('appointment')
        if Vitals.objects.filter(appointment=appointment).exists():
            raise serializers.ValidationError("Vitals for this appointment already exist.")
        return data

class AppointmentTestsSerializer(serializers.ModelSerializer):
    """
    Serializer for Appointment Tests, ensuring validation.
    """
    class Meta:
        model = AppointmentTests
        fields = ["id", "appointment", "test_name", "result"]