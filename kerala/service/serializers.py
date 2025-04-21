from users.models import Doctor
from rest_framework import serializers
from .models import Service
from appointments.serializers import DoctorSerializer

from rest_framework import serializers
from .models import Service
from users.models import Doctor

class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = ['id', 'first_name', 'last_name', 'specialization']

class ServiceSerializer(serializers.ModelSerializer):
    doctors = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Doctor.objects.all(), required=False
    )
    doctor_details = DoctorSerializer(many=True, read_only=True, source='doctors')

    class Meta:
        model = Service
        fields = ['id', 'name', 'price', 'code', 'color_code', 'doctors', 'doctor_details', 'created_at', 'updated_at']

    def validate(self, data):
        # Ensure at least one doctor or all_doctors flag is provided
        all_doctors = self.context['request'].data.get('all_doctors', False)
        if not all_doctors and not data.get('doctors'):
            raise serializers.ValidationError("At least one doctor must be specified or 'all_doctors' must be true.")
        return data

    def create(self, validated_data):
        doctors_data = validated_data.pop('doctors', [])
        all_doctors = self.context['request'].data.get('all_doctors', False)
        service = Service.objects.create(**validated_data)
        if all_doctors:
            service.doctors.set(Doctor.objects.all())
        else:
            service.doctors.set(doctors_data)
        return service

    def update(self, instance, validated_data):
        doctors_data = validated_data.pop('doctors', None)
        all_doctors = self.context['request'].data.get('all_doctors', False)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if all_doctors:
            instance.doctors.set(Doctor.objects.all())
        elif doctors_data is not None:
            instance.doctors.set(doctors_data)
        instance.save()
        return instance