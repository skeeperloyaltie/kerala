# service/models.py
from django.db import models
from users.models import Doctor  # Import Doctor from users app

class Service(models.Model):
    service_id = models.CharField(max_length=20, unique=True, editable=False)
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    code = models.CharField(max_length=20, unique=True)
    color_code = models.CharField(max_length=7, default="#007bff")  # Hex color code
    doctors = models.ManyToManyField(Doctor, related_name="services", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.service_id:
            self.service_id = self.generate_service_id()
        super().save(*args, **kwargs)

    def generate_service_id(self):
        prefix = 'SERV'
        last_service = Service.objects.filter(service_id__startswith=prefix).order_by('-service_id').first()
        if last_service:
            last_number = int(last_service.service_id[len(prefix):])
            new_number = last_number + 1
        else:
            new_number = 1
        return f"{prefix}{new_number:04d}"

    def __str__(self):
        return f"{self.name} ({self.service_id})"