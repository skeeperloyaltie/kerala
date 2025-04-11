# bills/serializers.py
from appointments.models import Appointment
from rest_framework import serializers
from .models import Bill, BillItem
from patients.serializers import PatientSerializer
from services.models import Service
from appointments.serializers import AppointmentSerializer

class BillItemSerializer(serializers.ModelSerializer):
    service_id = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all(), source='service')

    class Meta:
        model = BillItem
        fields = ['id', 'service_id', 'quantity', 'unit_price', 'gst', 'discount', 'total_price']

class BillSerializer(serializers.ModelSerializer):
    patient_id = serializers.CharField(source='patient.patient_id')
    items = BillItemSerializer(many=True)
    appointment_id = serializers.PrimaryKeyRelatedField(
        queryset=Appointment.objects.all(), source='appointment', required=False, allow_null=True
    )

    class Meta:
        model = Bill
        fields = [
            'bill_id', 'patient_id', 'appointment_id', 'total_amount', 'deposit_amount',
            'status', 'created_by', 'created_at', 'updated_at', 'notes', 'items'
        ]
        read_only_fields = ['bill_id', 'created_by', 'created_at', 'updated_at']

    def validate(self, data):
        items = data.get('items', [])
        if not items:
            raise serializers.ValidationError("At least one bill item is required.")
        total_amount = sum(item['quantity'] * item['unit_price'] * (1 + item['gst'] / 100) - item['discount'] for item in items)
        if data.get('total_amount') != total_amount:
            data['total_amount'] = total_amount
        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        validated_data['created_by'] = self.context['request'].user
        bill = Bill.objects.create(**validated_data)
        for item_data in items_data:
            BillItem.objects.create(bill=bill, **item_data)
        return bill