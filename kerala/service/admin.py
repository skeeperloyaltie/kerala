from django.contrib import admin
from .models import Service

@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'price', 'owner', 'color_code', 'created_at')
    list_filter = ('owner', 'created_at')
    search_fields = ('name', 'code')
    readonly_fields = ('created_at', 'updated_at')