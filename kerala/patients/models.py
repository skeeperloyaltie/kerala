from django.db import models
from django.utils import timezone
from datetime import date
from simple_history.models import HistoricalRecords

class Patient(models.Model):
    ADMISSION_TYPE_CHOICES = [
        ('IN', 'Inpatient'),
        ('OU', 'Outpatient'),
    ]
    history = HistoricalRecords()
    patient_id = models.CharField(max_length=12, unique=True, editable=False, null=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    gender = models.CharField(max_length=10, choices=[('Male', 'Male'), ('Female', 'Female'), ('Other', 'Other')])
    date_of_birth = models.DateField()
    age = models.IntegerField(editable=False)
    father_name = models.CharField(max_length=255, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    pincode = models.CharField(max_length=6, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    mobile_number = models.CharField(max_length=15)
    alternate_mobile_number = models.CharField(max_length=15, null=True, blank=True)
    aadhar_number = models.CharField(max_length=12, null=True, blank=True, unique=True)
    preferred_language = models.CharField(max_length=50, null=True, blank=True)
    marital_status = models.CharField(max_length=20, choices=[('Single', 'Single'), ('Married', 'Married'), ('Divorced', 'Divorced'), ('Widowed', 'Widowed')], null=True, blank=True)
    marital_since = models.DateField(null=True, blank=True)
    referred_by = models.CharField(max_length=255, null=True, blank=True)
    channel = models.CharField(max_length=50, choices=[('Website', 'Website'), ('Referral', 'Referral'), ('Advertisement', 'Advertisement'), ('Social Media', 'Social Media'), ('Other', 'Other')], null=True, blank=True)
    cio = models.CharField(max_length=100, null=True, blank=True)
    occupation = models.CharField(max_length=100, null=True, blank=True)
    tag = models.CharField(max_length=100, null=True, blank=True)
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    known_allergies = models.TextField(null=True, blank=True)
    current_medications = models.TextField(null=True, blank=True)
    past_medical_history = models.TextField(null=True, blank=True)
    specific_notes = models.TextField(null=True, blank=True)
    primary_doctor = models.ForeignKey('users.Doctor', on_delete=models.SET_NULL, null=True, blank=True)
    emergency_contact_name = models.CharField(max_length=255, null=True, blank=True)
    emergency_contact_relationship = models.CharField(max_length=100, null=True, blank=True)
    emergency_contact_number = models.CharField(max_length=15, null=True, blank=True)
    insurance_provider = models.CharField(max_length=255, null=True, blank=True)
    policy_number = models.CharField(max_length=50, null=True, blank=True)
    payment_preference = models.CharField(max_length=20, choices=[('Cash', 'Cash'), ('Card', 'Card'), ('Insurance', 'Insurance')], null=True, blank=True)
    admission_type = models.CharField(max_length=2, choices=ADMISSION_TYPE_CHOICES, default='OU')
    hospital_code = models.CharField(max_length=3, default='115')

    class Meta:
        unique_together = ('first_name', 'mobile_number')

    def __str__(self):
        return f"{self.patient_id} - {self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        if not self.patient_id:
            self.patient_id = self.generate_patient_id()
        if self.date_of_birth:
            self.age = self.calculate_age()
        super().save(*args, **kwargs)

    def calculate_age(self):
        today = date.today()
        age = today.year - self.date_of_birth.year
        if (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day):
            age -= 1
        return age

    def generate_patient_id(self):
        prefix = f"KH{self.admission_type}{self.hospital_code}"
        last_patient = Patient.objects.filter(patient_id__startswith=prefix).order_by('-patient_id').first()
        if last_patient:
            last_number = int(last_patient.patient_id[-3:])
            new_number = last_number + 1
        else:
            new_number = 1
        return f"{prefix}{new_number:03d}"