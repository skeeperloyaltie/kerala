from django.contrib import admin
from .models import MonitoredAppointment

@admin.register(MonitoredAppointment)
class MonitoredAppointmentAdmin(admin.ModelAdmin):
    list_display = ("appointment", "edited_by", "action", "timestamp")
    search_fields = ("appointment__id", "edited_by__username", "action")
    list_filter = ("action", "timestamp")
    readonly_fields = ("appointment", "edited_by", "previous_data", "action", "timestamp")

    def has_add_permission(self, request):
        """Prevent manual addition of logs from the admin panel."""
        return False

    def has_change_permission(self, request, obj=None):
        """Prevent editing of logs from the admin panel."""
        return False
