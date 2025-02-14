from django.db.models.signals import pre_save
from django.dispatch import receiver
from appointments.models import Appointment
from .models import MonitoredAppointment
from django.utils.timezone import localtime

from django.db.models.signals import pre_save
from django.dispatch import receiver
from appointments.models import Appointment
from .models import MonitoredAppointment
from django.utils.timezone import localtime

@receiver(pre_save, sender=Appointment)
def monitor_appointment_changes(sender, instance, **kwargs):
    """
    Monitor changes to appointments, logging both old and new data with full details.
    """
    if instance.pk:  # Only monitor updates
        try:
            old_appointment = Appointment.objects.get(pk=instance.pk)

            # Capture previous data (full details)
            previous_data = {
                "doctor": {
                    "id": getattr(old_appointment.doctor, "id", None),
                    "name": getattr(old_appointment.doctor, "name", None),
                    "email": getattr(old_appointment.doctor, "email", None),
                    "specialization": getattr(old_appointment.doctor, "specialization", None),
                },
                "patient": {
                    "id": getattr(old_appointment.patient, "id", None),
                    "name": getattr(old_appointment.patient, "name", None),
                    "email": getattr(old_appointment.patient, "email", None),
                    "phone": getattr(old_appointment.patient, "phone", None),
                },
                "appointment_date": localtime(old_appointment.appointment_date).strftime("%Y-%m-%d %H:%M:%S"),
                "status": old_appointment.status,
            }

            # Capture new data (full details)
            new_data = {
                "doctor": {
                    "id": getattr(instance.doctor, "id", None),
                    "name": getattr(instance.doctor, "name", None),
                    "email": getattr(instance.doctor, "email", None),
                    "specialization": getattr(instance.doctor, "specialization", None),
                },
                "patient": {
                    "id": getattr(instance.patient, "id", None),
                    "name": getattr(instance.patient, "name", None),
                    "email": getattr(instance.patient, "email", None),
                    "phone": getattr(instance.patient, "phone", None),
                },
                "appointment_date": localtime(instance.appointment_date).strftime("%Y-%m-%d %H:%M:%S"),
                "status": instance.status,
            }

            # Determine action type
            action = "EDITED"
            if old_appointment.status != instance.status:
                if instance.status == "Cancelled":
                    action = "CANCELED"
                elif instance.status == "Scheduled":
                    action = "RESCHEDULED"

            # Ensure updated_by exists
            updated_by = getattr(instance, "updated_by", None)

            # Log monitored appointment
            MonitoredAppointment.objects.create(
                appointment=old_appointment,
                edited_by=updated_by,
                previous_data=previous_data,
                new_data=new_data,
                action=action,
            )

        except Appointment.DoesNotExist:
            pass  # No monitoring needed for new records
        except Exception as e:
            print(f"Error monitoring appointment changes: {e}")  # Debugging



from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from django.utils.timezone import now
from .models import UserLoginLog

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    """
    Logs user login details.
    """
    ip = get_client_ip(request)
    user_agent = request.META.get('HTTP_USER_AGENT', '')

    UserLoginLog.objects.create(
        user=user,
        ip_address=ip,
        user_agent=user_agent,
        login_time=now()
    )

def get_client_ip(request):
    """
    Extracts client IP from request headers.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip
