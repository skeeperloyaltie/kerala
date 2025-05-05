from django.db import models
from django.conf import settings
from simple_history.models import HistoricalRecords
from patients.models import Patient
from systime.utils import get_current_ist_time, make_ist_aware  # Import systime utilities

class Appointment(models.Model):
    STATUS_CHOICES = [
        ('booked', 'Booked'),
        ('arrived', 'Arrived'),
        ('on-going', 'On-Going'),
        ('reviewed', 'Reviewed'),
    ]
    history = HistoricalRecords()
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    doctor = models.ForeignKey('users.Doctor', on_delete=models.SET_NULL, null=True, blank=True)
    receptionist = models.ForeignKey('users.Receptionist', on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Booked')
    appointment_date = models.DateTimeField()
    notes = models.TextField(null=True, blank=True)
    is_emergency = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="updated_appointments")

    class Meta:
        unique_together = ('patient', 'appointment_date')

    def __str__(self):
        return f"Appointment for {self.patient} with {self.doctor} on {self.appointment_date}"

    def save(self, *args, **kwargs):
        # Ensure appointment_date is IST-aware
        self.appointment_date = make_ist_aware(self.appointment_date)
        # Set created_at and updated_at to current IST time if not set
        if not self.created_at:
            self.created_at = get_current_ist_time()
        self.updated_at = get_current_ist_time()
        super().save(*args, **kwargs)

class AppointmentTests(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="tests")
    temperature = models.FloatField(null=True, blank=True, help_text="Temperature in °C")
    height = models.FloatField(null=True, blank=True, help_text="Height in cm")
    weight = models.FloatField(null=True, blank=True, help_text="Weight in kg")
    blood_pressure = models.CharField(max_length=20, null=True, blank=True, help_text="Blood Pressure in mmHg")

    def __str__(self):
        return f"Tests for Appointment ID {self.appointment.id}"

class CancellationReason(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="cancellation_reason")
    reason = models.TextField()
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    def __str__(self):
        return f"Cancellation Reason for Appointment ID {self.appointment.id}"

class Vitals(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name='vitals')
    history = HistoricalRecords()
    temperature = models.FloatField(null=True, blank=True, help_text="Temperature in °C")
    height = models.FloatField(null=True, blank=True, help_text="Height in cm")
    weight = models.FloatField(null=True, blank=True, help_text="Weight in kg")
    blood_pressure = models.CharField(max_length=20, null=True, blank=True, help_text="Blood Pressure in mmHg")
    heart_rate = models.IntegerField(null=True, blank=True, help_text="Heart rate in beats per minute (BPM)")
    respiratory_rate = models.IntegerField(null=True, blank=True, help_text="Respiratory rate in breaths per minute")
    oxygen_saturation = models.FloatField(null=True, blank=True, help_text="Oxygen saturation percentage (SpO2)")
    blood_sugar_level = models.FloatField(null=True, blank=True, help_text="Blood sugar level in mg/dL")
    bmi = models.FloatField(null=True, blank=True, help_text="Body Mass Index (BMI)")
    recorded_at = models.DateTimeField()
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Vitals for Appointment ID {self.appointment.id}"

    def calculate_blood_sugar(self):
        if self.bmi and self.weight:
            if self.bmi > 30:
                return round(self.weight * 0.4, 2)
            elif self.bmi > 25:
                return round(self.weight * 0.3, 2)
            else:
                return round(self.weight * 0.2, 2)
        return None

    def calculate_bmi(self):
        if self.height and self.weight:
            height_m = self.height / 100
            return round(self.weight / (height_m ** 2), 2)
        return None

    def convert_fahrenheit_to_celsius(self, fahrenheit):
        return round((fahrenheit - 32) * (5 / 9), 2)

    def save(self, *args, **kwargs):
        self.bmi = self.calculate_bmi()
        self.blood_sugar_level = self.calculate_blood_sugar()
        if self.temperature and self.temperature > 50:
            self.temperature = self.convert_fahrenheit_to_celsius(self.temperature)
        # Ensure recorded_at is IST-aware
        if not self.recorded_at:
            self.recorded_at = get_current_ist_time()
        else:
            self.recorded_at = make_ist_aware(self.recorded_at)
        super().save(*args, **kwargs)