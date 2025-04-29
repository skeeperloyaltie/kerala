# bills/serializers.py
from rest_framework import serializers
from .models import Bill, BillItem
from service.models import Service
from patients.models import Patient
from appointments.models import Appointment
from service.serializers import ServiceSerializer

class BillItemSerializer(serializers.ModelSerializer):
    service = ServiceSerializer(read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), source='service', write_only=True
    )
    service_id_read = serializers.IntegerField(source='service.id', read_only=True)  # Explicitly include service_id in output

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
    appointment_id = serializers.PrimaryKeyRelatedField(
        queryset=Appointment.objects.all(), source='appointment', allow_null=True
    )

    class Meta:
        model = Bill
        fields = ['bill_id', 'patient_id', 'appointment_id', 'total_amount', 'deposit_amount', 'status', 'created_at', 'updated_at', 'notes', 'items']
        read_only_fields = ['bill_id', 'created_at', 'updated_at']

    def validate_patient_id(self, value):
        try:
            patient = Patient.objects.get(patient_id=value)
            return patient.id
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
        bill = Bill.objects.create(**validated_data)
        for item_data in items_data:
            BillItem.objects.create(bill=bill, **item_data)
        return bill

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        instance = super().update(instance, validated_data)
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                BillItem.objects.create(bill=instance, **item_data)
        return instance