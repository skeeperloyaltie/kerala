from rest_framework import serializers
from .models import Patient
from users.models import Doctor
from datetime import date

class PatientSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField(format="%Y-%m-%d", input_formats=["%Y-%m-%d"])
    primary_doctor = serializers.PrimaryKeyRelatedField(queryset=Doctor.objects.all(), allow_null=True)
    marital_since = serializers.DateField(format="%Y-%m-%d", input_formats=["%Y-%m-%d"], allow_null=True)

    class Meta:
        model = Patient
        fields = [
            'patient_id', 'first_name', 'last_name', 'gender', 'date_of_birth', 'age', 'father_name',
            'address', 'city', 'pincode', 'email', 'mobile_number', 'alternate_mobile_number', 'aadhar_number',
            'preferred_language', 'marital_status', 'marital_since', 'referred_by', 'channel', 'cio',
            'occupation', 'tag', 'blood_group', 'known_allergies', 'current_medications', 'past_medical_history',
            'specific_notes', 'primary_doctor', 'emergency_contact_name', 'emergency_contact_relationship',
            'emergency_contact_number', 'insurance_provider', 'policy_number', 'payment_preference',
            'admission_type', 'hospital_code'
        ]
        read_only_fields = ['patient_id', 'age']

    def validate_date_of_birth(self, value):
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 0:
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value