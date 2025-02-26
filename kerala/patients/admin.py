# patients/admin.py
from django.contrib import admin
from appointments.models import Patient, Appointment, Vitals
from users.models import Doctor  # Import the Doctor model from users app

# Register the Patient model
@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('patient_id', 'first_name', 'last_name', 'contact_number', 'age', 'date_of_birth')
    search_fields = ('patient_id', 'first_name', 'last_name', 'contact_number')
    list_filter = ('date_of_birth', 'age')
    ordering = ('last_name', 'first_name')

# Register the Appointment model
@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('patient', 'doctor', 'status', 'appointment_date', 'created_at')
    search_fields = ('patient__patient_id', 'patient__first_name', 'patient__last_name', 'doctor__user__username', 'status')
    list_filter = ('status', 'appointment_date', 'doctor')
    ordering = ('appointment_date',)

# Register the Vitals model
@admin.register(Vitals)
class VitalsAdmin(admin.ModelAdmin):
    list_display = ('appointment', 'temperature', 'weight', 'blood_pressure', 'recorded_at')
    search_fields = ('appointment__patient__patient_id', 'appointment__patient__first_name')
    list_filter = ('recorded_at',)
    ordering = ('recorded_at',)

# Register the Doctor model (from users app)
@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ('user', 'specialization', 'contact_number')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'specialization')
    list_filter = ('specialization',)
    ordering = ('user__last_name', 'user__first_name')