from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group
from django.utils.timezone import now
from users.models import User, Receptionist, Doctor
import random

class Command(BaseCommand):
    help = "Create default users for Receptionist, Doctor, and Admin roles."

    def handle(self, *args, **kwargs):
        default_users = [
            {
                "username": "admin",
                "password": "AdminPass123",
                "user_type": "Admin",
                "email": "flipsgodfrey@gmail.com",
            },
            {
                "username": "skeeper",
                "first_name": "Skeeper",
                "last_name": "Loyaltie",
                "password": "DoctorPass123",
                "user_type": "Doctor",
                "email": "flipsgodfrey@gmail.com",
                "extra": {
                    "specialization": "Cardiology",
                    "contact_number": "1234567890",
                },
            },
            {
                "username": "gopim",
                "first_name": "Gopi",
                "last_name": "M",
                "password": "GopiPass123",
                "user_type": "Doctor",
                "email": "gopizee007@gmail.com",
                "extra": {
                    "specialization": "Dentistry",
                    "contact_number": "1234567890",
                },
            },
            {
                "username": "roshnisekar",
                "first_name": "Roshni",
                "last_name": "Sekar",
                "password": "RoshniPass123",
                "user_type": "Receptionist",
                "email": "roshnisekar@gmail.com",
                "extra": {
                    "contact_number": "1234567890",
                },
            },
            {
                "username": "freak",
                "first_name": "Freak",
                "last_name": "Godfrey",
                "password": "GodfreyPass123",
                "user_type": "Receptionist",
                "email": "flipsgodfrey@gmail.com",
                "extra": {
                    "contact_number": "9876543210",
                },
            },
        ]

        for user_data in default_users:
            username = user_data["username"]
            email = user_data["email"]
            password = user_data["password"]
            user_type = user_data["user_type"]
            extra = user_data.get("extra", {})

            # Check if the user already exists
            if User.objects.filter(username=username).exists():
                self.stdout.write(self.style.WARNING(f"User {username} already exists. Skipping."))
                continue

            # Create the user
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                user_type=user_type,
            )
            self.stdout.write(self.style.SUCCESS(f"User {username} created."))

            # Add extra fields for specific user types
            if user_type == "Doctor":
                Doctor.objects.create(user=user, **extra)
                self.stdout.write(self.style.SUCCESS(f"Doctor profile for {username} created."))
            elif user_type == "Receptionist":
                Receptionist.objects.create(user=user, **extra)
                self.stdout.write(self.style.SUCCESS(f"Receptionist profile for {username} created."))
            elif user_type == "Admin":
                user.is_staff = True
                user.is_superuser = True
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Admin privileges assigned to {username}."))

        self.stdout.write(self.style.SUCCESS("Default users created successfully."))
