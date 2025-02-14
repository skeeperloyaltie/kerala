from django.db import models
from django.contrib.auth import get_user_model
from appointments.models import Appointment  

User = get_user_model()

class MonitoredAppointment(models.Model):
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="monitor_logs")
    edited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    previous_data = models.JSONField()  # Stores previous appointment details
    new_data = models.CharField(max_length=255, null=True, blank=True)
    action = models.CharField(max_length=20, choices=[
        ("EDITED", "Edited"),
        ("CANCELED", "Canceled"),
        ("RESCHEDULED", "Rescheduled"),
    ])
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.appointment} - {self.action} by {self.edited_by}"


from django.db import models
from django.contrib.auth import get_user_model
from django.utils.timezone import now

User = get_user_model()

class UserLoginLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    login_time = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} logged in at {self.login_time}"
