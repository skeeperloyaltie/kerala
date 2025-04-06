from django.db import models
from django.conf import settings
from django.utils import timezone
from simple_history.models import HistoricalRecords
from patients.models import Patient  # Import Patient from patients app

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
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    appointment_date = models.DateTimeField()
    notes = models.TextField(null=True, blank=True)
    is_emergency = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="updated_appointments")

    class Meta:
        unique_together = ('patient', 'appointment_date')
        permissions = [
            ("view_appointment", "Can view appointments"),
            ("add_appointment", "Can add a new appointment"),
            ("change_appointment", "Can change existing appointments"),
            ("delete_appointment", "Can delete appointments"),
        ]

    def __str__(self):
        return f"Appointment for {self.patient} with {self.doctor} on {self.appointment_date}"

class AppointmentTests(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="tests")
    temperature = models.FloatField(null=True, blank=True, help_text="Temperature in °C")
    height = models.FloatField(null=True, blank=True, help_text="Height in cm")
    weight = models.FloatField(null=True, blank=True, help_text="Weight in kg")
    blood_pressure = models.CharField(max_length=20, null=True, blank=True, help_text="Blood Pressure in mmHg")

    class Meta:
        permissions = [
            ("view_appointmenttests", "Can view appointment tests"),
            ("add_appointmenttests", "Can add appointment tests"),
            ("change_appointmenttests", "Can change appointment tests"),
            ("delete_appointmenttests", "Can delete appointment tests"),
        ]

    def __str__(self):
        return f"Tests for Appointment ID {self.appointment.id}"

class CancellationReason(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="cancellation_reason")
    reason = models.TextField()
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        permissions = [
            ("view_cancellationreason", "Can view cancellation reasons"),
            ("add_cancellationreason", "Can add cancellation reasons"),
            ("change_cancellationreason", "Can change cancellation reasons"),
            ("delete_cancellationreason", "Can delete cancellation reasons"),
        ]

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
    recorded_at = models.DateTimeField(auto_now_add=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        permissions = [
            ("view_vitals", "Can view vitals"),
            ("add_vitals", "Can add vitals"),
            ("change_vitals", "Can change vitals"),
            ("delete_vitals", "Can delete vitals"),
        ]

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
        super().save(*args, **kwargs)