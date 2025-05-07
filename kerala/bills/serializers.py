from rest_framework import serializers
from .models import Bill, BillItem
from service.models import Service
from patients.models import Patient
from appointments.models import Appointment
from appointments.serializers import AppointmentSerializer
from service.serializers import ServiceSerializer

class BillItemSerializer(serializers.ModelSerializer):
    service = ServiceSerializer(read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), source='service', write_only=True
    )
    service_id_read = serializers.IntegerField(source='service.id', read_only=True)

    class Meta:
        model = BillItem
        fields = ['id', 'service', 'service_id', 'service_id_read', 'quantity', 'unit_price', 'gst', 'discount', 'total_price']
        read_only_fields = ['id', 'service', 'service_id_read']

    def validate_service_id(self, value):
        if not value:
            raise serializers.ValidationError("Service is required for each bill item.")
        return value

class BillSerializer(serializers.ModelSerializer):
    items = BillItemSerializer(many=True)
    patient_id = serializers.CharField(write_only=True)
    patient_id_read = serializers.CharField(source='patient.patient_id', read_only=True)
    appointment_id = serializers.PrimaryKeyRelatedField(
        queryset=Appointment.objects.all(), source='appointment', write_only=True, allow_null=True
    )
    appointment = AppointmentSerializer(read_only=True)
    appointment_date = serializers.CharField(write_only=True, required=False)
    doctor_id = serializers.PrimaryKeyRelatedField(
        queryset=Doctor.objects.all(), write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Bill
        fields = [
            'bill_id', 'patient_id', 'patient_id_read', 'appointment_id', 'appointment', 'total_amount',
            'deposit_amount', 'status', 'created_at', 'updated_at', 'notes', 'items', 'appointment_date', 'doctor_id'
        ]
        read_only_fields = ['bill_id', 'created_at', 'updated_at', 'patient_id_read', 'appointment']

    def validate_patient_id(self, value):
        try:
            patient = Patient.objects.get(patient_id=value)
            return value  # Return patient_id as string
        except Patient.DoesNotExist:
            raise serializers.ValidationError(f"Patient with patient_id {value} does not exist.")

    def validate(self, data):
        items = data.get('items', [])
        if not items:
            raise serializers.ValidationError("A bill must have at least one item.")
        for item in items:
            if not item.get('service'):
                raise serializers.ValidationError("Each bill item must have a valid service.")
        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        appointment_id = validated_data.pop('appointment_id', None)
        validated_data.pop('appointment_date', None)  # Handled in view
        validated_data.pop('doctor_id', None)  # Handled in view
        patient_id = validated_data.pop('patient_id')
        patient = Patient.objects.get(patient_id=patient_id)

        bill = Bill.objects.create(
            patient=patient,
            appointment_id=appointment_id,
            **validated_data
        )
        for item_data in items_data:
            BillItem.objects.create(bill=bill, **item_data)
        return bill

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        validated_data.pop('appointment_date', None)
        validated_data.pop('doctor_id', None)
        validated_data.pop('appointment_id', None)
        instance = super().update(instance, validated_data)
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                BillItem.objects.create(bill=instance, **item_data)
        return instance