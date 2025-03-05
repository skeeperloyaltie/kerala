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
        fields = ['patient_id','first_name', 'last_name', 'contact_number', 'current_illness', 'email', 'date_of_birth', 'age']  # Add 'age' here

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




from rest_framework import serializers
from .models import Appointment, Patient, AppointmentTests
from users.models import Doctor, Receptionist
from datetime import datetime
import pytz

KOLKATA_TZ = pytz.timezone("Asia/Kolkata")

class AppointmentSerializer(serializers.ModelSerializer):
    """
    Serializer for Appointment model, ensuring validation and including necessary relationships.
    """
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.all(), write_only=True, source="patient"
    )
    doctor = DoctorSerializer(read_only=True)
    doctor_id = serializers.PrimaryKeyRelatedField(
        queryset=Doctor.objects.all(), write_only=True, source="doctor"
    )
    receptionist = serializers.PrimaryKeyRelatedField(
        queryset=Receptionist.objects.all(), required=False
    )
    receptionist_name = serializers.CharField(source="receptionist.user.get_full_name", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)
    doctor_name = serializers.CharField(source="doctor.user.get_full_name", read_only=True)

    # Handle appointment_date explicitly
    appointment_date = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%S%z")

    class Meta:
        model = Appointment
        fields = [
            "id", "patient", "patient_id", "doctor", "doctor_id", "doctor_name",
            "receptionist", "receptionist_name", "appointment_date", "status",
            "notes", "created_by_username", "updated_by_username", "is_emergency",
            "updated_by", "updated_at"
        ]
        read_only_fields = ["id", "status", "created_by", "created_by_username", "updated_by", "updated_by_username"]

    def to_internal_value(self, data):
        # Handle appointment_date parsing explicitly
        if "appointment_date" in data:
            appointment_date_str = data["appointment_date"]
            try:
                # Parse the incoming date and ensure it's timezone-aware
                if "Z" in appointment_date_str or "+" in appointment_date_str or "-" in appointment_date_str:
                    appointment_date = datetime.fromisoformat(appointment_date_str)
                else:
                    appointment_date = datetime.strptime(appointment_date_str, "%Y-%m-%dT%H:%M:%S")
                    appointment_date = KOLKATA_TZ.localize(appointment_date)
                data["appointment_date"] = appointment_date.astimezone(KOLKATA_TZ)
            except ValueError as e:
                raise serializers.ValidationError({"appointment_date": f"Invalid format: {str(e)}. Use 'YYYY-MM-DDTHH:MM:SS'."})
        return super().to_internal_value(data)



        
        



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