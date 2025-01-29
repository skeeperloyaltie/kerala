from django.contrib import admin
from .models import Cookie

class CookieAdmin(admin.ModelAdmin):
    list_display = ('user', 'token', 'created_at', 'expires_at', 'is_valid')
    search_fields = ('user__username', 'token')
    list_filter = ('is_valid',)

admin.site.register(Cookie, CookieAdmin)
