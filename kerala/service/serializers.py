from rest_framework import serializers
from .models import Service
from users.models import Doctor

class DoctorSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

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
        fields = ['id', 'service_id', 'name', 'price', 'code', 'color_code', 'doctors', 'created_at', 'updated_at']

    def validate(self, data):
        # Only validate doctors if provided in the request (for partial updates)
        all_doctors = self.context['request'].data.get('all_doctors', False)
        doctors = data.get('doctors', None)
        if not self.partial and not all_doctors and not doctors:
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
        
        # Update only provided fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Update doctors only if provided
        if all_doctors:
            instance.doctors.set(Doctor.objects.all())
        elif doctors_data is not None:
            instance.doctors.set(doctors_data)
        
        instance.save()
        return instance