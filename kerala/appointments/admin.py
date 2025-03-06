from django.contrib import admin
from .models import Appointment, Patient, AppointmentTests, Vitals

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = (
        'patient_id', 'first_name', 'last_name', 'gender', 'age', 'mobile_number', 'email',
        'admission_type', 'primary_doctor', 'get_status'
    )
    search_fields = ('patient_id', 'first_name', 'last_name', 'mobile_number', 'email', 'aadhar_number')
    list_filter = ('gender', 'admission_type', 'date_of_birth', 'primary_doctor')
    ordering = ('last_name', 'first_name')
    list_per_page = 20
    readonly_fields = ('patient_id', 'age')

    fieldsets = (
        ('Basic Information', {
            'fields': (
                'patient_id', 'first_name', 'last_name', 'gender', 'date_of_birth', 'age',
                'father_name', 'admission_type', 'mobile_number', 'alternate_mobile_number',
                'email', 'aadhar_number', 'address', 'city', 'pincode'
            )
        }),
        ('Medical Information', {
            'fields': (
                'blood_group', 'known_allergies', 'current_medications',
                'past_medical_history', 'specific_notes', 'primary_doctor'
            )
        }),
        ('Emergency Contact', {
            'fields': ('emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_number')
        }),
        ('Insurance & Billing', {
            'fields': ('insurance_provider', 'policy_number', 'payment_preference')
        }),
    )

    def get_status(self, obj):
        """Return the status of the latest appointment for the patient."""
        latest_appointment = Appointment.objects.filter(patient=obj).order_by('-appointment_date').first()
        return latest_appointment.status if latest_appointment else "No Appointments"

    get_status.short_description = 'Latest Appointment Status'

    def get_queryset(self, request):
        """Optimize query to prefetch related primary_doctor."""
        return super().get_queryset(request).select_related('primary_doctor')

@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'patient', 'doctor', 'receptionist', 'status', 'formatted_appointment_date',
        'is_emergency', 'created_by', 'updated_by', 'created_at', 'updated_at'
    )
    search_fields = (
        'patient__patient_id', 'patient__first_name', 'patient__last_name',
        'doctor__user__username', 'receptionist__user__username'
    )
    list_filter = ('status', 'appointment_date', 'is_emergency', 'doctor', 'receptionist', 'created_by')
    ordering = ('-appointment_date',)
    raw_id_fields = ('patient', 'doctor', 'receptionist', 'created_by', 'updated_by')
    readonly_fields = ('created_at', 'updated_at', 'created_by')
    list_per_page = 20

    fieldsets = (
        (None, {
            'fields': (
                'patient', 'doctor', 'receptionist', 'appointment_date', 'status',
                'notes', 'is_emergency'
            )
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at')
        }),
    )

    def get_queryset(self, request):
        """Optimize query to prefetch related patient, doctor, receptionist, and user data."""
        return super().get_queryset(request).select_related(
            'patient', 'doctor', 'receptionist', 'created_by', 'updated_by'
        )

    def formatted_appointment_date(self, obj):
        """Format the appointment date for better readability in admin panel."""
        return obj.appointment_date.strftime('%d-%m-%Y %H:%M')
    formatted_appointment_date.admin_order_field = 'appointment_date'
    formatted_appointment_date.short_description = 'Appointment Date & Time'

@admin.register(AppointmentTests)
class AppointmentTestsAdmin(admin.ModelAdmin):
    list_display = ('appointment', 'temperature', 'height', 'weight', 'blood_pressure')
    search_fields = ('appointment__patient__first_name', 'appointment__patient__last_name', 'appointment__patient__patient_id')
    list_filter = ('appointment__appointment_date',)
    raw_id_fields = ('appointment',)
    ordering = ('-appointment__appointment_date',)
    list_per_page = 20

    fieldsets = (
        (None, {
            'fields': ('appointment', 'temperature', 'height', 'weight', 'blood_pressure')
        }),
    )

    def get_queryset(self, request):
        """Optimize query to prefetch related appointment and patient."""
        return super().get_queryset(request).select_related('appointment__patient')

@admin.register(Vitals)
class VitalsAdmin(admin.ModelAdmin):
    list_display = (
        'appointment', 'blood_pressure', 'heart_rate', 'respiratory_rate',
        'oxygen_saturation', 'temperature', 'height', 'weight', 'blood_sugar_level',
        'bmi', 'recorded_at', 'recorded_by'
    )
    search_fields = (
        'appointment__patient__patient_id', 'appointment__patient__first_name',
        'appointment__patient__last_name'
    )
    list_filter = ('appointment__appointment_date', 'recorded_by')
    raw_id_fields = ('appointment', 'recorded_by')
    ordering = ('-appointment__appointment_date',)
    list_per_page = 20
    readonly_fields = ('recorded_at', 'bmi', 'blood_sugar_level')

    fieldsets = (
        (None, {
            'fields': (
                'appointment', 'blood_pressure', 'heart_rate', 'respiratory_rate',
                'oxygen_saturation', 'temperature', 'height', 'weight'
            )
        }),
        ('Calculated Fields', {
            'fields': ('blood_sugar_level', 'bmi')
        }),
        ('Audit Information', {
            'fields': ('recorded_by', 'recorded_at')
        }),
    )

    def get_queryset(self, request):
        """Optimize query to prefetch related appointment and patient."""
        return super().get_queryset(request).select_related('appointment__patient', 'recorded_by')