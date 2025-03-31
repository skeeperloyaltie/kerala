from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group
from django.utils.timezone import now
from users.models import User, Receptionist, Doctor, Nurse

class Command(BaseCommand):
    help = "Create default users for Receptionist, Nurse, Doctor, and Admin roles with appropriate role levels."

    def handle(self, *args, **kwargs):
        default_users = [
            {
                "username": "admin",
                "password": "AdminPass123",
                "user_type": "Admin",
                "role_level": "Senior",  # Admins are Senior by default
                "email": "flipsgodfrey@gmail.com",
                "first_name": "Admin",
                "last_name": "User",
            },
            {
                "username": "skeeper",
                "first_name": "Skeeper",
                "last_name": "Loyaltie",
                "password": "DoctorPass123",
                "user_type": "Doctor",
                "role_level": "Senior",  # Senior Doctor
                "email": "flipsgodfrey@gmail.com",
                "extra": {
                    "specialization": "Cardiology",
                    "contact_number": "1234567890",
                    "email": "flipsgodfrey@gmail.com",
                },
            },
            {
                "username": "yrncollo",
                "first_name": "Collins",
                "last_name": "Collo",
                "password": "Collins123",
                "user_type": "Receptionist",
                "role_level": "Medium",  # Medium Receptionist
                "email": "collins@gmail.com",
                "extra": {
                    "contact_number": "1234567890",
                    "email": "collins@gmail.com",
                },
            },
            {
                "username": "emmanuel",
                "first_name": "Emmanuel",
                "last_name": "Valary",
                "password": "Valary123",
                "user_type": "Doctor",
                "role_level": "Medium",  # Medium Doctor
                "email": "emanuel@gmail.com",
                "extra": {
                    "specialization": "Dentistry",
                    "contact_number": "1234567890",
                    "email": "emanuel@gmail.com",
                },
            },
            {
                "username": "gopim",
                "first_name": "Gopi",
                "last_name": "M",
                "password": "GopiPass123",
                "user_type": "Doctor",
                "role_level": "Senior",  # Basic Doctor
                "email": "gopizee007@gmail.com",
                "extra": {
                    "specialization": "Dentistry",
                    "contact_number": "1234567890",
                    "email": "gopizee007@gmail.com",
                },
            },
            {
                "username": "roshnisekar",
                "first_name": "Roshni",
                "last_name": "Sekar",
                "password": "RoshniPass123",
                "user_type": "Receptionist",
                "role_level": "Senior",  # Basic Receptionist
                "email": "roshnisekar@gmail.com",
                "extra": {
                    "contact_number": "1234567890",
                    "email": "roshnisekar@gmail.com",
                },
            },
            {
                "username": "freak",
                "first_name": "Freak",
                "last_name": "Godfrey",
                "password": "GodfreyPass123",
                "user_type": "Receptionist",
                "role_level": "Senior",  # Senior Receptionist
                "email": "flipsgodfrey@gmail.com",
                "extra": {
                    "contact_number": "9876543210",
                    "email": "flipsgodfrey@gmail.com",
                },
            },
            {
                "username": "nurse1",
                "first_name": "Nurse",
                "last_name": "One",
                "password": "NursePass123",
                "user_type": "Nurse",
                "role_level": "Medium",  # Medium Nurse
                "email": "nurse1@example.com",
                "extra": {
                    "contact_number": "5555555555",
                    "email": "nurse1@example.com",
                    "certification": "Registered Nurse",
                },
            },
        ]

        for user_data in default_users:
            username = user_data["username"]
            email = user_data["email"]
            first_name = user_data.get("first_name", "")
            last_name = user_data.get("last_name", "")
            password = user_data["password"]
            user_type = user_data["user_type"]
            role_level = user_data["role_level"]
            extra = user_data.get("extra", {})

            # Use CustomUserManager to create or fetch user
            try:
                user = User.objects.get(username=username)
                created = False
            except User.DoesNotExist:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    user_type=user_type,
                    role_level=role_level
                )
                created = True

            if not created:
                # Update existing user details if they differ
                updated_fields = []
                if user.email != email:
                    user.email = email
                    updated_fields.append("email")
                if user.first_name != first_name:
                    user.first_name = first_name
                    updated_fields.append("first_name")
                if user.last_name != last_name:
                    user.last_name = last_name
                    updated_fields.append("last_name")
                if user.user_type != user_type:
                    user.user_type = user_type
                    updated_fields.append("user_type")
                if user.role_level != role_level:
                    user.role_level = role_level
                    updated_fields.append("role_level")
                    # Reassign permissions if role_level changes
                    user.groups.clear()
                    User.objects._assign_permissions(user, user_type, role_level)

                if updated_fields:
                    user.save(update_fields=updated_fields)
                    self.stdout.write(self.style.SUCCESS(f"User {username} updated: {', '.join(updated_fields)}"))
                else:
                    self.stdout.write(self.style.WARNING(f"User {username} already exists with correct details. Skipping."))
            else:
                self.stdout.write(self.style.SUCCESS(f"User {username} created with {role_level} {user_type} role."))

            # Handle role-specific profiles
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

            elif user_type == "Nurse":
                nurse, nurse_created = Nurse.objects.get_or_create(user=user, defaults=extra)
                if not nurse_created:
                    for key, value in extra.items():
                        if getattr(nurse, key) != value:
                            setattr(nurse, key, value)
                            nurse.save(update_fields=[key])
                    self.stdout.write(self.style.SUCCESS(f"Nurse profile for {username} updated."))
                else:
                    self.stdout.write(self.style.SUCCESS(f"Nurse profile for {username} created."))

            elif user_type == "Admin":
                user.is_staff = True
                user.is_superuser = True
                user.save(update_fields=["is_staff", "is_superuser"])
                self.stdout.write(self.style.SUCCESS(f"Admin privileges assigned to {username}."))

        self.stdout.write(self.style.SUCCESS("Default users created/updated successfully."))