from rest_framework import serializers
from appointments.models import Patient

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = "__all__"  # Includes all patient details


