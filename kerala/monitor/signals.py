from django.db.models.signals import pre_save
from django.dispatch import receiver
from appointments.models import Appointment
from .models import MonitoredAppointment
from django.utils.timezone import localtime

@receiver(pre_save, sender=Appointment)
def monitor_appointment_changes(sender, instance, **kwargs):
    """
    Monitor edits, cancellations, and reschedules of appointments.
    Logs changes before they are saved.
    """
    if instance.pk:  # Ensure this is an update, not a new record
        try:
            old_appointment = Appointment.objects.get(pk=instance.pk)
            
            # Store previous data before changes
            previous_data = {
                "doctor": getattr(old_appointment.doctor, "id", None),
                "patient": getattr(old_appointment.patient, "id", None),
                "appointment_date": localtime(old_appointment.appointment_date).strftime("%Y-%m-%d %H:%M:%S"),
                "status": old_appointment.status,
            }

            # Determine action type
            action = "EDITED"
            if old_appointment.status != instance.status:
                if instance.status == "Cancelled":
                    action = "CANCELLED"
                elif instance.status == "Scheduled":
                    action = "RESCHEDULED"

            # Ensure updated_by exists
            updated_by = getattr(instance, "updated_by", None)

            # Log the monitored appointment
            MonitoredAppointment.objects.create(
                appointment=old_appointment,
                edited_by=updated_by,  # Ensure this is set in views
                previous_data=previous_data,
                action=action,
            )

        except Appointment.DoesNotExist:
            pass  # No monitoring needed for new records
        except Exception as e:
            print(f"Error monitoring appointment changes: {e}")  # Debugging
