import logging
from django.db import models
from patients.models import Patient
from service.models import Service
from appointments.models import Appointment
from django.conf import settings
from simple_history.models import HistoricalRecords
from systime.utils import get_current_ist_time  # Import systime utility

logger = logging.getLogger(__name__)

class Bill(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Paid', 'Paid'),
        ('Partially Paid', 'Partially Paid'),
        ('Canceled', 'Canceled'),
    ]
    history = HistoricalRecords()
    bill_id = models.CharField(max_length=20, unique=True, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='bills')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='bills')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='bills_created')
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    notes = models.TextField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.bill_id:
            self.bill_id = self.generate_bill_id()
        # Set created_at and updated_at to current IST time
        if not self.created_at:
            self.created_at = get_current_ist_time()
        self.updated_at = get_current_ist_time()
        super().save(*args, **kwargs)
        logger.debug(f"Bill {self.bill_id} saved with created_at={self.created_at}, updated_at={self.updated_at}")

    def generate_bill_id(self):
        prefix = 'BILL'
        last_bill = Bill.objects.filter(bill_id__startswith=prefix).order_by('-bill_id').first()
        if last_bill:
            last_number = int(last_bill.bill_id[len(prefix):])
            new_number = last_number + 1
        else:
            new_number = 1
        return f"{prefix}{new_number:04d}"

    def __str__(self):
        return f"Bill {self.bill_id} for {self.patient}"

class BillItem(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='items')
    service = models.ForeignKey(Service, on_delete=models.PROTECT, null=False, blank=False)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    gst = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)  # Percentage
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)

    def save(self, *args, **kwargs):
        # Calculate total price: (quantity * unit_price * (1 + gst/100)) - discount
        self.total_price = (self.quantity * self.unit_price * (1 + self.gst / 100)) - self.discount
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Item {self.service.name} for Bill {self.bill.bill_id}"