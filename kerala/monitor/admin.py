from django.contrib import admin
from .models import MonitoredAppointment, UserLoginLog

@admin.register(MonitoredAppointment)
class MonitoredAppointmentAdmin(admin.ModelAdmin):
    list_display = ("appointment", "edited_by", "action", "timestamp")
    search_fields = ("appointment__id", "edited_by__username", "action")
    list_filter = ("action", "timestamp")
    readonly_fields = ("appointment", "edited_by", "previous_data", "new_data", "action", "timestamp")

    def has_add_permission(self, request):
        """Prevent manual addition of logs from the admin panel."""
        return False

    def has_change_permission(self, request, obj=None):
        """Prevent editing of logs from the admin panel."""
        return False


@admin.register(UserLoginLog)
class UserLoginLogAdmin(admin.ModelAdmin):
    list_display = ("user", "login_time", "ip_address", "user_agent")
    search_fields = ("user__username", "ip_address", "user_agent")
    list_filter = ("login_time",)
    readonly_fields = ("user", "login_time", "ip_address", "user_agent")

    def has_add_permission(self, request):
        """Prevent manual addition of logs from the admin panel."""
        return False

    def has_change_permission(self, request, obj=None):
        """Prevent editing of logs from the admin panel."""
        return False
