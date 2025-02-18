from datetime import timedelta
import logging
from django.contrib.auth.models import AbstractUser, Group, Permission
from django.db import models
from django.utils import timezone
import random
import logging

logger = logging.getLogger(__name__)

from django.contrib.auth.models import AbstractUser, Group, Permission, BaseUserManager
from django.db import models
from django.utils import timezone
from datetime import timedelta
import random
import logging

logger = logging.getLogger(__name__)

class CustomUserManager(BaseUserManager):
    def create_user(self, username, email, password=None, first_name=None, last_name=None, user_type='Receptionist'):
        if not email:
            raise ValueError("Users must have an email address")
        if not first_name or not last_name:
            raise ValueError("Users must provide a first name and last name")

        user = self.model(
            username=username,
            email=self.normalize_email(email),
            first_name=first_name,
            last_name=last_name,
            user_type=user_type
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, first_name="Admin", last_name="User"):
        user = self.create_user(username, email, password, first_name, last_name, user_type='Admin')
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user



class User(AbstractUser):
    USER_TYPE_CHOICES = (
        ('Receptionist', 'Receptionist'),
        ('Doctor', 'Doctor'),
        ('Admin', 'Admin'),
    )
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default='Receptionist')

    groups = models.ManyToManyField(
        Group,
        related_name="custom_user_set",
        blank=True,
        help_text="The groups this user belongs to.",
        verbose_name="groups",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name="custom_user_permissions_set",
        blank=True,
        help_text="Specific permissions for this user.",
        verbose_name="user permissions",
    )

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.username})"

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
    first_name = models.CharField(max_length=100, default="receptionist")
    last_name = models.CharField(max_length=100, default="receptionist")
    contact_number = models.CharField(max_length=15)
    email = models.EmailField()

    def __str__(self):
        return self.user.username

class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    first_name = models.CharField(max_length=100, default="doctor")
    last_name = models.CharField(max_length=100, default="docctor")
    specialization = models.CharField(max_length=255)
    contact_number = models.CharField(max_length=15)
    email = models.EmailField()

    def __str__(self):
        return self.user.username
    
    
