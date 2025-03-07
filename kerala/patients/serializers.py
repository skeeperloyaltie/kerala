from rest_framework import serializers
from appointments.models import Patient, Appointment, Vitals
from users.models import Doctor  # Import Doctor model

from rest_framework import serializers
from users.models import Doctor  # Import Doctor model

class DoctorSerializer(serializers.ModelSerializer):
    """Serializer for Doctor details"""

    first_name = serializers.CharField(source="user.first_name")  # Fetch from related User model
    last_name = serializers.CharField(source="user.last_name")    # Fetch from related User model
    email = serializers.EmailField(source="user.email")          # Fetch email from User model

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

from rest_framework import generics
from appointments.models import Patient
from appointments.serializers import PatientSerializer

class PatientListView(generics.ListAPIView):
    serializer_class = PatientSerializer

    def get_queryset(self):
        queryset = Patient.objects.all()
        if self.request.user.user_type == 'Doctor':
            return queryset.filter(primary_doctor__user=self.request.user)
        return queryset
