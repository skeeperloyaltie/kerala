# users/serializers.py
from rest_framework import serializers
from .models import User

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

class OTPLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    otp = serializers.IntegerField()

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'user_type', 'role_level', 'email']

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'user_type', 'role_level']