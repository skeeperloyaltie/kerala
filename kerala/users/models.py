import logging
import random
from datetime import timedelta
from django.contrib.auth.models import AbstractUser, Group, Permission, BaseUserManager
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)

class CustomUserManager(BaseUserManager):
    def create_user(self, username, email, password=None, first_name=None, last_name=None, user_type='Receptionist', role_level='Basic'):
        if not email:
            raise ValueError("Users must have an email address")
        if not first_name or not last_name:
            raise ValueError("Users must provide a first name and last name")

        user = self.model(
            username=username,
            email=self.normalize_email(email),
            first_name=first_name,
            last_name=last_name,
            user_type=user_type,
            role_level=role_level
        )
        user.set_password(password)
        user.save(using=self._db)  # Save the user first
        self._assign_permissions(user, user_type, role_level)  # Then assign permissions
        return user

    def create_superuser(self, username, email, password=None, first_name="Admin", last_name="User"):
        user = self.create_user(username, email, password, first_name, last_name, user_type='Admin', role_level='Senior')
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)  # Save again to update is_staff and is_superuser
        return user

    def _assign_permissions(self, user, user_type, role_level):
        """Assign permissions based on user type and role level."""
        group_name = f"{user_type}_{role_level}"
        group, created = Group.objects.get_or_create(name=group_name)
        if created:
            permissions = self._get_permissions(user_type, role_level)
            group.permissions.set(permissions)
        user.groups.add(group)

    def _get_permissions(self, user_type, role_level):
        """Define permissions based on role level."""
        from django.contrib.auth.models import Permission
        permissions = []
        if user_type in ['Receptionist', 'Nurse', 'Doctor']:
            if role_level == 'Basic':
                permissions.append(Permission.objects.get(codename='view_appointment'))
            elif role_level == 'Medium':
                permissions.extend([
                    Permission.objects.get(codename='view_appointment'),
                    Permission.objects.get(codename='add_appointment'),
                ])
            elif role_level == 'Senior':
                permissions.extend([
                    Permission.objects.get(codename='view_appointment'),
                    Permission.objects.get(codename='add_appointment'),
                    Permission.objects.get(codename='change_appointment'),
                ])
        return permissions


class User(AbstractUser):
    USER_TYPE_CHOICES = (
        ('Receptionist', 'Receptionist'),
        ('Nurse', 'Nurse'),
        ('Doctor', 'Doctor'),
        ('Admin', 'Admin'),
    )
    ROLE_LEVEL_CHOICES = (
        ('Basic', 'Basic'),
        ('Medium', 'Medium'),
        ('Senior', 'Senior'),
    )
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default='Receptionist')
    role_level = models.CharField(max_length=20, choices=ROLE_LEVEL_CHOICES, default='Basic')

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
        return f"{self.first_name} {self.last_name} ({self.username}) - {self.user_type} ({self.role_level})"


class OTPVerification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    verified = models.BooleanField(default=False)

    def generate_otp(self):
        self.otp = str(random.randint(100000, 999999))  # 6-digit OTP
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
        return f"{self.user.username} - {self.user.role_level} Receptionist"


class Nurse(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    contact_number = models.CharField(max_length=15)
    email = models.EmailField()
    certification = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username} - {self.user.role_level} Nurse"


class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    specialization = models.CharField(max_length=255)
    contact_number = models.CharField(max_length=15)
    email = models.EmailField()

    def __str__(self):
        return f"{self.user.username} - {self.user.role_level} Doctor"