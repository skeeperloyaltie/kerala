from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password

class Command(BaseCommand):
    help = 'Creates a superuser if one does not already exist and ensures the password remains constant'

    def handle(self, *args, **kwargs):
        username = 'kerala'
        email = 'kerala@gmail.com'
        default_password = 'kerala123456'
        
        User = get_user_model()  # Get the custom user model

        try:
            # Check if the superuser exists
            user = User.objects.filter(username=username).first()
            if not user:
                # Create superuser if it doesn't exist
                User.objects.create_superuser(username=username, email=email, password=default_password)
                self.stdout.write(self.style.SUCCESS('Superuser created successfully'))
            else:
                # Check if the password matches the default
                if not check_password(default_password, user.password):
                    user.password = make_password(default_password)  # Reset password
                    user.save()
                    self.stdout.write(self.style.WARNING('Superuser password was reset to the default'))
                else:
                    self.stdout.write(self.style.SUCCESS('Superuser already exists with the correct password'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error processing superuser: {e}'))
