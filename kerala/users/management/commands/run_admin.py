# detail/management/commands/create_user.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = 'Creates a superuser if one does not already exist'

    def handle(self, *args, **kwargs):
        username = 'kerala'
        email = 'kerala@gmail.com'
        password = 'kerala123456'
        
        User = get_user_model()  # Get the custom user model

        # Check if the superuser exists
        if not User.objects.filter(username=username).exists():
            try:
                # Create superuser
                User.objects.create_superuser(username=username, email=email, password=password)
                self.stdout.write(self.style.SUCCESS('Superuser created successfully'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Error creating superuser: {e}'))
        else:
            self.stdout.write(self.style.SUCCESS('Superuser already exists'))
