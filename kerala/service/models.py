from django.db import models
from users.models import Doctor  # Import Doctor from users app

class Service(models.Model):
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    code = models.CharField(max_length=20, unique=True)
    color_code = models.CharField(max_length=7, default="#007bff")  # Hex color code
    owner = models.ForeignKey(Doctor, on_delete=models.SET_NULL, null=True, related_name="services")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.code})"