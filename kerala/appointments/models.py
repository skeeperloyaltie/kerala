from django.db import models
from django.conf import settings
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
    father_name = models.CharField(max_length=255)
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    pincode = models.CharField(max_length=6, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    mobile_number = models.CharField(max_length=15)
    alternate_mobile_number = models.CharField(max_length=15, null=True, blank=True)
    aadhar_number = models.CharField(max_length=12, null=True, blank=True, unique=True)

    # New Fields from Modal
    preferred_language = models.CharField(max_length=50, null=True, blank=True)
    marital_status = models.CharField(max_length=20, choices=[('Single', 'Single'), ('Married', 'Married'), ('Divorced', 'Divorced'), ('Widowed', 'Widowed')], null=True, blank=True)
    marital_since = models.DateField(null=True, blank=True)
    referred_by = models.CharField(max_length=255, null=True, blank=True)
    channel = models.CharField(max_length=50, choices=[('Website', 'Website'), ('Referral', 'Referral'), ('Advertisement', 'Advertisement'), ('Social Media', 'Social Media'), ('Other', 'Other')], null=True, blank=True)
    cio = models.CharField(max_length=100, null=True, blank=True)
    occupation = models.CharField(max_length=100, null=True, blank=True)
    tag = models.CharField(max_length=100, null=True, blank=True)

    # Medical Information
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    known_allergies = models.TextField(null=True, blank=True)
    current_medications = models.TextField(null=True, blank=True)
    past_medical_history = models.TextField(null=True, blank=True)
    specific_notes = models.TextField(null=True, blank=True)
    primary_doctor = models.ForeignKey('users.Doctor', on_delete=models.SET_NULL, null=True, blank=True)

    # Emergency Contact
    emergency_contact_name = models.CharField(max_length=255, null=True, blank=True)
    emergency_contact_relationship = models.CharField(max_length=100, null=True, blank=True)
    emergency_contact_number = models.CharField(max_length=15, null=True, blank=True)

    # Insurance & Billing
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


class Appointment(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Waiting'),
        ('scheduled', 'Scheduled'),
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('canceled', 'Canceled'),
        ('rescheduled', 'Rescheduled'),
    ]
    history = HistoricalRecords()

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    doctor = models.ForeignKey('users.Doctor', on_delete=models.SET_NULL, null=True, blank=True)
    receptionist = models.ForeignKey('users.Receptionist', on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')  # Changed default to 'scheduled'
    appointment_date = models.DateTimeField()
    notes = models.TextField(null=True, blank=True)
    is_emergency = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="updated_appointments")

    class Meta:
        unique_together = ('patient', 'appointment_date')

    def __str__(self):
        return f"Appointment for {self.patient} with {self.doctor} on {self.appointment_date}"

class AppointmentTests(models.Model):
    """
    Stores test results for appointments, which only doctors can update.
    """
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="tests")
    temperature = models.FloatField(null=True, blank=True, help_text="Temperature in °C")
    height = models.FloatField(null=True, blank=True, help_text="Height in cm")
    weight = models.FloatField(null=True, blank=True, help_text="Weight in kg")
    blood_pressure = models.CharField(max_length=20, null=True, blank=True, help_text="Blood Pressure in mmHg")

    def __str__(self):
        return f"Tests for Appointment ID {self.appointment.id}"


class CancellationReason(models.Model):
    """
    Tracks reasons for appointment cancellations.
    """
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="cancellation_reason")
    reason = models.TextField()
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    def __str__(self):
        return f"Cancellation Reason for Appointment ID {self.appointment.id}"

class Vitals(models.Model):
    """
    Stores vital signs for an appointment, typically recorded by a nurse or doctor.
    """
    appointment = models.OneToOneField(
        'Appointment', on_delete=models.CASCADE, related_name='vitals'
    )
    history = HistoricalRecords()

    temperature = models.FloatField(null=True, blank=True, help_text="Temperature in °C")
    height = models.FloatField(null=True, blank=True, help_text="Height in cm")
    weight = models.FloatField(null=True, blank=True, help_text="Weight in kg")
    blood_pressure = models.CharField(
        max_length=20, null=True, blank=True, help_text="Blood Pressure in mmHg"
    )
    heart_rate = models.IntegerField(null=True, blank=True, help_text="Heart rate in beats per minute (BPM)")
    respiratory_rate = models.IntegerField(null=True, blank=True, help_text="Respiratory rate in breaths per minute")
    oxygen_saturation = models.FloatField(null=True, blank=True, help_text="Oxygen saturation percentage (SpO2)")
    blood_sugar_level = models.FloatField(null=True, blank=True, help_text="Blood sugar level in mg/dL")
    bmi = models.FloatField(null=True, blank=True, help_text="Body Mass Index (BMI)")
    
    recorded_at = models.DateTimeField(auto_now_add=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    def __str__(self):
        return f"Vitals for Appointment ID {self.appointment.id}"
    
    def calculate_blood_sugar(self):
        """Calculate an estimated blood sugar level based on BMI and weight."""
        if self.bmi and self.weight:
            # Example calculation: High BMI or weight may lead to higher blood sugar levels
            if self.bmi > 30:  # Assuming BMI over 30 might suggest a risk of higher blood sugar
                return round(self.weight * 0.4, 2)  # Hypothetical formula (weight * constant)
            elif self.bmi > 25:  # Slightly above normal BMI
                return round(self.weight * 0.3, 2)
            else:
                return round(self.weight * 0.2, 2)  # Lower blood sugar level for healthy weight/BMI
        return None

    def calculate_bmi(self):
        """Calculate and return the BMI if height and weight are available."""
        if self.height and self.weight:
            height_m = self.height / 100  # Convert height to meters
            return round(self.weight / (height_m ** 2), 2)
        return None
    def convert_fahrenheit_to_celsius(self, fahrenheit):
        """Convert Fahrenheit to Celsius if needed."""
        return round((fahrenheit - 32) * (5 / 9), 2)
    
    def save(self, *args, **kwargs):
        """Automatically calculate BMI before saving."""
        self.bmi = self.calculate_bmi()
        self.blood_sugar_level = self.calculate_blood_sugar()  # Calculate blood sugar as well
        if self.temperature and self.temperature > 50:  # Likely Fahrenheit
            self.temperature = self.convert_fahrenheit_to_celsius(self.temperature)
        super().save(*args, **kwargs)


