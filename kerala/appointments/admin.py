from django.contrib import admin
from .models import Appointment, Patient, AppointmentTests, Vitals

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = (
        'patient_id',  # Display the patient ID
        'first_name', 
        'last_name', 
        'contact_number', 
        'email', 
        'age',
        'current_illness',
        'date_of_birth', 
        'get_status'
        
    )
    search_fields = ('first_name', 'last_name', 'contact_number', 'email', 'patient_id')
    list_filter = ('date_of_birth',)
    ordering = ('last_name', 'first_name')

    def get_status(self, obj):
        """
        Return the status of the latest appointment for the patient.
        """
        latest_appointment = Appointment.objects.filter(patient=obj).order_by('-appointment_date').first()
        return latest_appointment.status if latest_appointment else "No Appointments"

    get_status.short_description = 'Status'


from django.contrib import admin
from .models import Appointment

@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'doctor', 'receptionist', 'formatted_appointment_date', 'created_by', 'updated_by', 'created_at', 'updated_at')
    search_fields = ('patient__first_name', 'patient__last_name', 'doctor__user__username', 'receptionist__user__username')
    list_filter = ('status', 'appointment_date', 'doctor', 'receptionist')
    ordering = ('-appointment_date',)
    raw_id_fields = ('patient', 'doctor', 'receptionist', 'created_by', 'updated_by')
    readonly_fields = ('created_at', 'updated_at', 'created_by')

    def get_queryset(self, request):
        """Optimize query to prefetch related patient, doctor, receptionist, and user data."""
        queryset = super().get_queryset(request)
        return queryset.select_related('patient', 'doctor', 'receptionist', 'created_by', 'updated_by')

    def formatted_appointment_date(self, obj):
        """Format the appointment date for better readability in admin panel."""
        return obj.appointment_date.strftime('%d-%m-%Y %H:%M')
    formatted_appointment_date.admin_order_field = 'appointment_date'
    formatted_appointment_date.short_description = 'Appointment Date & Time'


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

