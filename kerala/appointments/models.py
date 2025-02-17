from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import date

from datetime import date, datetime
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import date, datetime
import uuid
from datetime import date, datetime
from django.db import models

class Patient(models.Model):
    patient_id = models.CharField(
        max_length=10, unique=True, editable=False, default=None, null=True
    )
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    contact_number = models.CharField(max_length=15)
    email = models.EmailField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    current_illness = models.TextField(null=True, blank=True)
    age = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ('first_name', 'contact_number')

    def __str__(self):
        return f"{self.patient_id} - {self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        if self.date_of_birth:
            if isinstance(self.date_of_birth, str):
                self.date_of_birth = datetime.strptime(self.date_of_birth, "%Y-%m-%d").date()
            self.age = self.calculate_age()
        
        if not self.patient_id:  
            self.patient_id = self.generate_patient_id()
        
        super().save(*args, **kwargs)

    def calculate_age(self):
        today = date.today()
        if isinstance(self.date_of_birth, date):
            age = today.year - self.date_of_birth.year
            if (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day):
                age -= 1
            return age
        return None

    def generate_patient_id(self):
        """Generate a unique patient ID."""
        first_letter = self.first_name[0].upper() if self.first_name else "X"
        year_of_birth = str(self.date_of_birth.year)[-2:] if self.date_of_birth else "00"
        
        existing_patients = Patient.objects.filter(first_name=self.first_name, contact_number=self.contact_number)
        if existing_patients.exists():
            return existing_patients.first().patient_id  # Reuse existing patient ID
        
        last_patient = Patient.objects.filter(patient_id__startswith=f"{first_letter}{year_of_birth}").order_by("-patient_id").first()
        if last_patient:
            last_number = int(last_patient.patient_id[-4:])
            new_number = last_number + 1
        else:
            new_number = 1
        
        return f"{first_letter}{year_of_birth}{new_number:04d}"




class Appointment(models.Model):
    """
    Stores appointment details for patients, linked to doctors and receptionists.
    """
    STATUS_CHOICES = (
        ('Waiting', 'Waiting'),
        ('Scheduled', 'Scheduled'),
        ('Pending', 'Pending'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    )

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    doctor = models.ForeignKey('users.Doctor', on_delete=models.SET_NULL, null=True, blank=True)
    receptionist = models.ForeignKey('users.Receptionist', on_delete=models.SET_NULL, null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)  

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Waiting')
    appointment_date = models.DateTimeField(default=timezone.now)
    notes = models.TextField(null=True, blank=True)
    is_emergency = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name="updated_appointments"
    )

    # Store first_name and contact_number explicitly for uniqueness constraints
    first_name = models.CharField(max_length=255, default="Unknown")  
    contact_number = models.CharField(max_length=15, default="0702940509")


    class Meta:
        unique_together = ('first_name', 'contact_number', 'appointment_date')  

    def __str__(self):
        return f"Appointment for {self.patient} with {self.doctor} on {self.appointment_date}"

    def save(self, *args, **kwargs):
        """Ensure first_name and contact_number are saved based on patient details."""
        self.first_name = self.patient.first_name
        self.contact_number = self.patient.contact_number
        super().save(*args, **kwargs)



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


