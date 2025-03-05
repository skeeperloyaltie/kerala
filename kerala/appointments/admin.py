from django.contrib import admin
from .models import Appointment, Patient, AppointmentTests, Vitals, CancellationReason

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = (
        'patient_id',
        'first_name',
        'last_name',
        'gender',
        'mobile_number',  # Updated from contact_number
        'email',
        'age',
        'date_of_birth',
        'father_name',
        'city',
        'blood_group',
        'get_status',
    )
    search_fields = (
        'first_name',
        'last_name',
        'mobile_number',  # Updated from contact_number
        'email',
        'patient_id',
        'father_name',
        'city',
        'aadhar_number',
    )
    list_filter = (
        'gender',
        'date_of_birth',
        'city',
        'blood_group',
        'payment_preferences',
    )
    ordering = ('last_name', 'first_name')
    readonly_fields = ('age', 'patient_id')  # Age and patient_id are calculated/automatically generated

    def get_status(self, obj):
        """
        Return the status of the latest appointment for the patient.
        """
        latest_appointment = Appointment.objects.filter(patient=obj).order_by('-appointment_date').first()
        return latest_appointment.status if latest_appointment else "No Appointments"

    get_status.short_description = 'Latest Appointment Status'

    def get_queryset(self, request):
        """
        Optimize query to prefetch related appointments.
        """
        queryset = super().get_queryset(request)
        return queryset.prefetch_related('appointments')


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'patient',
        'doctor',
        'receptionist',
        'formatted_appointment_date',
        'status',
        'is_emergency',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
    )
    search_fields = (
        'patient__first_name',
        'patient__last_name',
        'patient__mobile_number',  # Updated from contact_number
        'doctor__user__username',
        'receptionist__user__username',
    )
    list_filter = (
        'status',
        'appointment_date',
        'is_emergency',
        'doctor',
        'receptionist',
    )
    ordering = ('-appointment_date',)
    raw_id_fields = ('patient', 'doctor', 'receptionist', 'created_by', 'updated_by')
    readonly_fields = ('created_at', 'updated_at', 'created_by', 'first_name', 'mobile_number')  # first_name and mobile_number are synced from patient

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
    list_display = (
        'appointment',
        'temperature',
        'height',
        'weight',
        'blood_pressure',
    )
    search_fields = (
        'appointment__patient__first_name',
        'appointment__patient__last_name',
        'appointment__patient__mobile_number',  # Updated from contact_number
    )
    list_filter = ('appointment__appointment_date',)
    raw_id_fields = ('appointment',)
    ordering = ('-appointment__appointment_date',)

    def get_queryset(self, request):
        """Optimize query to prefetch related appointment and patient."""
        queryset = super().get_queryset(request)
        return queryset.select_related('appointment__patient')


@admin.register(Vitals)
class VitalsAdmin(admin.ModelAdmin):
    list_display = (
        'appointment',
        'blood_pressure',
        'heart_rate',
        'respiratory_rate',
        'oxygen_saturation',
        'temperature',
        'height',
        'weight',
        'blood_sugar_level',
        'bmi',
        'recorded_at',
        'recorded_by',
    )
    search_fields = (
        'appointment__patient__first_name',
        'appointment__patient__last_name',
        'appointment__patient__mobile_number',  # Updated from contact_number
    )
    list_filter = (
        'appointment__appointment_date',
        'recorded_at',
    )
    raw_id_fields = ('appointment', 'recorded_by')
    readonly_fields = ('bmi', 'blood_sugar_level', 'recorded_at')  # Calculated or auto-set fields
    ordering = ('-appointment__appointment_date',)

    def get_queryset(self, request):
        """Optimize query to prefetch related appointment and patient."""
        queryset = super().get_queryset(request)
        return queryset.select_related('appointment__patient', 'recorded_by')


@admin.register(CancellationReason)
class CancellationReasonAdmin(admin.ModelAdmin):
    list_display = (
        'appointment',
        'reason',
        'cancelled_by',
    )
    search_fields = (
        'appointment__patient__first_name',
        'appointment__patient__last_name',
        'appointment__patient__mobile_number',  # Updated from contact_number
        'reason',
    )
    list_filter = ('appointment__appointment_date',)
    raw_id_fields = ('appointment', 'cancelled_by')
    ordering = ('-appointment__appointment_date',)

    def get_queryset(self, request):
        """Optimize query to prefetch related appointment and patient."""
        queryset = super().get_queryset(request)
        return queryset.select_related('appointment__patient', 'cancelled_by')