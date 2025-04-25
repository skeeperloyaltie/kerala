# bills/serializers.py
from rest_framework import serializers
from .models import Bill, BillItem
from patients.models import Patient
from appointments.models import Appointment

class BillItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillItem
        fields = ['service_id', 'quantity', 'unit_price', 'gst', 'discount', 'total_price']

# bills/serializers.py
class BillSerializer(serializers.ModelSerializer):
    items = BillItemSerializer(many=True)
    patient_id = serializers.CharField(write_only=True)
    appointment_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Bill
        fields = ['patient_id', 'total_amount', 'deposit_amount', 'status', 'notes', 'items', 'appointment_id']
        # Remove status from read_only_fields
        read_only_fields = []

    def validate_patient_id(self, value):
        try:
            patient = Patient.objects.get(patient_id=value)
            return patient
        except Patient.DoesNotExist:
            raise serializers.ValidationError("Patient with this ID does not exist.")

    def validate(self, data):
        patient = data.get('patient_id')
        if not isinstance(patient, Patient):
            raise serializers.ValidationError("Patient must be a valid Patient instance.")
        data['patient'] = patient
        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        validated_data.pop('patient_id')
        bill = Bill.objects.create(**validated_data)
        for item_data in items_data:
            BillItem.objects.create(bill=bill, **item_data)
        return bill

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        validated_data.pop('patient_id', None)
        patient = validated_data.pop('patient', None)
        if patient:
            instance.patient = patient
        
        # Update bill fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update bill items if provided
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                BillItem.objects.create(bill=instance, **item_data)

        return instance

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation['patient_id'] = instance.patient.patient_id
        return representation