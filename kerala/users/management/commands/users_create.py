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
                "username": "yrncollo",
                "first_name": "collins",
                "last_name": "collo",
                "password": "Collins123",
                "user_type": "Receptionist",
                "email": "collins@gmail.com",
                "extra": {
                    "specialization": "Dentistry",
                },
            },
            {
                "username": "emmanuel",
                "first_name": "Emmanuel",
                "last_name": "Valary",
                "password": "E_Valary123",
                "user_type": "Doctor",
                "email": "emanuel@gmail.com",
                "extra": {
                    "specialization": "Dentistry",
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
            firstname = user_data.get("first_name", "")
            lastname = user_data.get("last_name", "")
            password = user_data["password"]
            user_type = user_data["user_type"]
            extra = user_data.get("extra", {})

            user, created = User.objects.get_or_create(username=username, defaults={
                "email": email,
                "first_name": firstname,
                "last_name": lastname,
                "user_type": user_type
            })

            if not created:
                # Update existing user details if they differ
                updated_fields = []
                if user.email != email:
                    user.email = email
                    updated_fields.append("email")
                if user.first_name != firstname:
                    user.first_name = firstname
                    updated_fields.append("first_name")
                if user.last_name != lastname:
                    user.last_name = lastname
                    updated_fields.append("last_name")
                if user.user_type != user_type:
                    user.user_type = user_type
                    updated_fields.append("user_type")

                if updated_fields:
                    user.save(update_fields=updated_fields)
                    self.stdout.write(self.style.SUCCESS(f"User {username} updated: {', '.join(updated_fields)}"))
                else:
                    self.stdout.write(self.style.WARNING(f"User {username} already exists with correct details. Skipping."))

            else:
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"User {username} created."))

            # Ensure role-specific profiles are created/updated
            if user_type == "Doctor":
                doctor, doctor_created = Doctor.objects.get_or_create(user=user, defaults=extra)
                if not doctor_created:
                    for key, value in extra.items():
                        if getattr(doctor, key) != value:
                            setattr(doctor, key, value)
                            doctor.save(update_fields=[key])
                    self.stdout.write(self.style.SUCCESS(f"Doctor profile for {username} updated."))
                else:
                    self.stdout.write(self.style.SUCCESS(f"Doctor profile for {username} created."))

            elif user_type == "Receptionist":
                receptionist, rec_created = Receptionist.objects.get_or_create(user=user, defaults=extra)
                if not rec_created:
                    for key, value in extra.items():
                        if getattr(receptionist, key) != value:
                            setattr(receptionist, key, value)
                            receptionist.save(update_fields=[key])
                    self.stdout.write(self.style.SUCCESS(f"Receptionist profile for {username} updated."))
                else:
                    self.stdout.write(self.style.SUCCESS(f"Receptionist profile for {username} created."))

            elif user_type == "Admin":
                user.is_staff = True
                user.is_superuser = True
                user.save(update_fields=["is_staff", "is_superuser"])
                self.stdout.write(self.style.SUCCESS(f"Admin privileges assigned to {username}."))

        self.stdout.write(self.style.SUCCESS("Default users created/updated successfully."))

