from django.db import models
from django.contrib.auth import get_user_model
from appointments.models import Appointment  # Import the original Appointment model

User = get_user_model()

class MonitoredAppointment(models.Model):
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="monitor_logs")
    edited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    previous_data = models.JSONField()  # Store previous appointment details as JSON
    action = models.CharField(max_length=20, choices=[
        ("EDITED", "Edited"),
        ("CANCELED", "Canceled"),
        ("RESCHEDULED", "Rescheduled"),
    ])
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.appointment} - {self.action} by {self.edited_by}"
