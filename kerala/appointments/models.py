from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import date

class Patient(models.Model):
    """
    Stores patient details for appointments.
    """
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    contact_number = models.CharField(max_length=15)
    email = models.EmailField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    current_illness = models.TextField(null=True, blank=True)  # Add this field if needed
    age = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        if self.date_of_birth:
            self.age = self.calculate_age()
        super().save(*args, **kwargs)

    def calculate_age(self):
        today = date.today()
        age = today.year - self.date_of_birth.year
        if today.month < self.date_of_birth.month or (today.month == self.date_of_birth.month and today.day < self.date_of_birth.day):
            age -= 1
        return age


class Appointment(models.Model):
    """
    Stores appointment details for patients, linked to doctors and receptionists.
    """
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    )

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    doctor = models.ForeignKey('users.Doctor', on_delete=models.SET_NULL, null=True, blank=True)
    receptionist = models.ForeignKey('users.Receptionist', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    appointment_date = models.DateTimeField(default=timezone.now)
    notes = models.TextField(null=True, blank=True)
    is_emergency = models.BooleanField(default=False)  # Emergency flag
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Appointment for {self.patient} with {self.doctor} on {self.appointment_date}"


class AppointmentTests(models.Model):
    """
    Stores test results for appointments, which only doctors can update.
    """
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="tests")
    temperature = models.FloatField(null=True, blank=True)
    height = models.FloatField(null=True, blank=True)
    weight = models.FloatField(null=True, blank=True)
    blood_pressure = models.CharField(max_length=20, null=True, blank=True)

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
