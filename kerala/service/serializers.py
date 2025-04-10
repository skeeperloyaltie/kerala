from users.models import Doctor
from rest_framework import serializers
from .models import Service
from appointments.serializers import DoctorSerializer

class ServiceSerializer(serializers.ModelSerializer):
    owner = DoctorSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        queryset=Doctor.objects.all(), source='owner', write_only=True
    )
    service_name = serializers.CharField(source='name')
    service_price = serializers.DecimalField(source='price', max_digits=10, decimal_places=2)

    class Meta:
        model = Service
        fields = ['id', 'service_name', 'service_price', 'code', 'color_code', 'owner', 'owner_id', 'created_at', 'updated_at']