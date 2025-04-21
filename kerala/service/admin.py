from django.contrib import admin
from .models import Service

@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'price', 'display_doctors', 'color_code', 'created_at')
    list_filter = ('doctors', 'created_at')
    search_fields = ('name', 'code')
    readonly_fields = ('created_at', 'updated_at')

    def display_doctors(self, obj):
        """
        Display a comma-separated list of doctors associated with the service.
        """
        doctors = obj.doctors.all()
        if doctors.exists():
            return ", ".join(f"{doctor.first_name} {doctor.last_name or ''}".strip() for doctor in doctors)
        return "All Doctors" if obj.doctors.count() == obj.doctors.model.objects.count() else "None"
    
    display_doctors.short_description = "Doctors"