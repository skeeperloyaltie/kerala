from users.models import Doctor
from rest_framework import serializers
from .models import Service
from appointments.serializers import DoctorSerializer  # Assuming DoctorSerializer exists in users app

class ServiceSerializer(serializers.ModelSerializer):
    owner = DoctorSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        queryset=Doctor.objects.all(), source='owner', write_only=True
    )

    class Meta:
        model = Service
        fields = ['id', 'name', 'price', 'code', 'color_code', 'owner', 'owner_id', 'created_at', 'updated_at']