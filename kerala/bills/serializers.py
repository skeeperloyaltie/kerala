# bills/serializers.py
from rest_framework import serializers
from .models import Bill, BillItem
from service.models import Service
from patients.models import Patient
from appointments.models import Appointment

class BillItemSerializer(serializers.ModelSerializer):
    service = ServiceSerializer(read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), source='service', write_only=True
    )

    class Meta:
        model = BillItem
        fields = ['id', 'service', 'service_id', 'quantity', 'unit_price', 'gst', 'discount', 'total_price']

    def validate_service_id(self, value):
        if not value:
            raise serializers.ValidationError("Service is required for each bill item.")
        return value

class BillSerializer(serializers.ModelSerializer):
    items = BillItemSerializer(many=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Patient.objects.all(), source='patient'
    )
    appointment_id = serializers.PrimaryKeyRelatedField(
        queryset=Appointment.objects.all(), source='appointment', allow_null=True
    )

    class Meta:
        model = Bill
        fields = ['bill_id', 'patient_id', 'appointment_id', 'total_amount', 'deposit_amount', 'status', 'created_at', 'updated_at', 'notes', 'items']

    def validate(self, data):
        # Ensure at least one item with a valid service
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
        items_data = validated_data.pop('items')
        instance = super().update(instance, validated_data)
        
        # Delete existing items and create new ones
        instance.items.all().delete()
        for item_data in items_data:
            BillItem.objects.create(bill=instance, **item_data)
        return instance