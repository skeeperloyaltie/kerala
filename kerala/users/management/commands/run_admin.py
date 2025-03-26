from django.core.management.base import BaseCommand
from users.models import User

class Command(BaseCommand):
    help = "Create a superuser with default credentials"

    def handle(self, *args, **kwargs):
        username = "loyaltieskeeper"
        email = "gugod254@gmail.com"
        password = "13917295!Gg"

        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.ERROR(f"User '{username}' already exists!"))
        else:
            # Create superuser using the manager
            user = User.objects.create_superuser(username=username, email=email, password=password)
            self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' created successfully!"))