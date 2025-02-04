from django.contrib import admin
from .models import Appointment, Patient, AppointmentTests, Vitals

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'contact_number', 'email', 'date_of_birth', 'get_status')
    search_fields = ('first_name', 'last_name', 'contact_number', 'email')
    list_filter = ('date_of_birth',)
    ordering = ('last_name', 'first_name')

    def get_status(self, obj):
        """
        Return the status of the latest appointment for the patient.
        """
        latest_appointment = Appointment.objects.filter(patient=obj).order_by('-appointment_date').first()
        return latest_appointment.status if latest_appointment else "No Appointments"

    get_status.short_description = 'Status'

@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'doctor', 'appointment_date', 'status', 'notes')
    search_fields = ('patient__first_name', 'patient__last_name', 'doctor__user__username')
    list_filter = ('status', 'appointment_date', 'doctor')
    ordering = ('-appointment_date',)
    raw_id_fields = ('patient', 'doctor')
    readonly_fields = ('created_at', 'updated_at')

    def get_queryset(self, request):
        """Optimize query to prefetch related patient and doctor information."""
        queryset = super().get_queryset(request)
        return queryset.select_related('patient', 'doctor')

@admin.register(AppointmentTests)
class AppointmentTestsAdmin(admin.ModelAdmin):
    list_display = ('appointment', 'temperature', 'height', 'weight', 'blood_pressure')
    search_fields = ('appointment__patient__first_name', 'appointment__patient__last_name')
    raw_id_fields = ('appointment',)

@admin.register(Vitals)
class VitalsAdmin(admin.ModelAdmin):
    list_display = (
        'appointment', 'blood_pressure', 'heart_rate', 'respiratory_rate', 
        'oxygen_saturation', 'temperature', 'height', 'weight', 'blood_sugar_level', 
        'bmi', 'recorded_at', 'recorded_by'
    )
    search_fields = ('appointment__patient__first_name', 'appointment__patient__last_name')
    list_filter = ('appointment__appointment_date',)
    raw_id_fields = ('appointment',)
    ordering = ('-appointment__appointment_date',)

    def get_queryset(self, request):
        """Optimize query to prefetch related appointment and patient."""
        queryset = super().get_queryset(request)
        return queryset.select_related('appointment__patient')

