from datetime import timedelta
from django.db import models
from users.models import User
from django.utils import timezone

class Cookie(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255)  # Store token in the database
    created_at = models.DateTimeField(auto_now_add=True)  # Timestamp when cookie was created
    login_time = models.DateTimeField(default=timezone.now)  # Default to the current time
    expires_at = models.DateTimeField()  # Expiration timestamp
    is_valid = models.BooleanField(default=True)  # Whether the cookie is still valid
    login_time = models.DateTimeField(null=True, blank=True)  # Optional field
    user_type = models.CharField(max_length=50, null=True, blank=True)  # Optional field

    def __str__(self):
        return f"Cookie for {self.user.username} - Valid: {self.is_valid}"

    def save(self, *args, **kwargs):
        # Ensure expiration date is set
        if not self.expires_at:
            self.expires_at = self.login_time + timedelta(minutes=300)  # Default expiration is 30 days
        super().save(*args, **kwargs)
