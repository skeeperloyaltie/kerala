# users/admin.py
from django.contrib import admin
from .models import User, Receptionist, Nurse, Doctor

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'first_name', 'last_name', 'user_type', 'role_level', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    list_filter = ('user_type', 'role_level', 'is_active')
    ordering = ('username',)
    fieldsets = (
        (None, {
            'fields': ('username', 'email', 'password')
        }),
        ('Personal Info', {
            'fields': ('first_name', 'last_name')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('Role Info', {
            'fields': ('user_type', 'role_level')
        }),
    )

@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_first_name', 'get_last_name', 'specialization', 'contact_number', 'email', 'get_role_level')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'specialization', 'email')
    list_filter = ('user__role_level',)

    @admin.display(ordering='user__first_name', description='First Name')
    def get_first_name(self, obj):
        return obj.user.first_name

    @admin.display(ordering='user__last_name', description='Last Name')
    def get_last_name(self, obj):
        return obj.user.last_name

    @admin.display(ordering='user__role_level', description='Role Level')
    def get_role_level(self, obj):
        return obj.user.role_level

@admin.register(Receptionist)
class ReceptionistAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_first_name', 'get_last_name', 'contact_number', 'email', 'get_role_level')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'email')
    list_filter = ('user__role_level',)

    @admin.display(ordering='user__first_name', description='First Name')
    def get_first_name(self, obj):
        return obj.user.first_name

    @admin.display(ordering='user__last_name', description='Last Name')
    def get_last_name(self, obj):
        return obj.user.last_name

    @admin.display(ordering='user__role_level', description='Role Level')
    def get_role_level(self, obj):
        return obj.user.role_level

@admin.register(Nurse)
class NurseAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_first_name', 'get_last_name', 'contact_number', 'email', 'certification', 'get_role_level')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'email', 'certification')
    list_filter = ('user__role_level',)

    @admin.display(ordering='user__first_name', description='First Name')
    def get_first_name(self, obj):
        return obj.user.first_name

    @admin.display(ordering='user__last_name', description='Last Name')
    def get_last_name(self, obj):
        return obj.user.last_name

    @admin.display(ordering='user__role_level', description='Role Level')
    def get_role_level(self, obj):
        return obj.user.role_level