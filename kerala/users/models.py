from datetime import timedelta
import logging
from django.contrib.auth.models import AbstractUser, Group, Permission
from django.db import models
from django.utils import timezone
import random
import logging

logger = logging.getLogger(__name__)

class User(AbstractUser):
    USER_TYPE_CHOICES = (
        ('receptionist', 'receptionist'),
        ('doctor', 'doctor'),
        ('admin', 'admin'),
    )
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default='Receptionist')

    groups = models.ManyToManyField(
        Group,
        related_name="custom_user_set",  # Avoids clash with auth.User.groups
        blank=True,
        help_text="The groups this user belongs to.",
        verbose_name="groups",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name="custom_user_permissions_set",  # Avoids clash with auth.User.user_permissions
        blank=True,
        help_text="Specific permissions for this user.",
        verbose_name="user permissions",
    )

class OTPVerification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    verified = models.BooleanField(default=False)

    

    def generate_otp(self):
        self.otp = str(random.randint(10000, 99999))
        self.expires_at = timezone.now() + timedelta(minutes=10)
        self.save()
        logger.info(f"OTP generated for {self.user.username} with expiry at {self.expires_at}")


    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"OTP for {self.user.username}"

class Receptionist(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    contact_number = models.CharField(max_length=15)
    email = models.EmailField()

    def __str__(self):
        return self.user.username

class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    specialization = models.CharField(max_length=255)
    contact_number = models.CharField(max_length=15)
    email = models.EmailField()

    def __str__(self):
        return self.user.username
