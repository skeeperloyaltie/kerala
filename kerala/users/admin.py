# users/admin.py
from django.contrib import admin
from .models import User, Receptionist, Doctor

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'user_type', 'is_active')
    search_fields = ('username', 'email')

@admin.register(Receptionist)
class ReceptionistAdmin(admin.ModelAdmin):
    list_display = ('user', 'contact_number', 'email')

@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ('user', 'specialization', 'contact_number', 'email')
