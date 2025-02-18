# users/admin.py
from django.contrib import admin
from .models import User, Receptionist, Doctor

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'first_name','last_name', 'user_type', 'is_active')
    search_fields = ('username', 'email')

from django.contrib import admin
from .models import Doctor, Receptionist

class DoctorAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_first_name', 'get_last_name', 'specialization', 'contact_number', 'email')

    @admin.display(ordering='user__first_name', description='First Name')
    def get_first_name(self, obj):
        return obj.user.first_name

    @admin.display(ordering='user__last_name', description='Last Name')
    def get_last_name(self, obj):
        return obj.user.last_name

class ReceptionistAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_first_name', 'get_last_name', 'contact_number', 'email')

    @admin.display(ordering='user__first_name', description='First Name')
    def get_first_name(self, obj):
        return obj.user.first_name

    @admin.display(ordering='user__last_name', description='Last Name')
    def get_last_name(self, obj):
        return obj.user.last_name

admin.site.register(Doctor, DoctorAdmin)
admin.site.register(Receptionist, ReceptionistAdmin)

