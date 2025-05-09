"""
URL configuration for kerala project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')sudo systemctl
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('smart/', admin.site.urls),
    path('users/', include('users.urls')),
    path('appointments/', include('appointments.urls')),
    path('cookie/', include('cookie.urls')),  # Include the cookie URLs
    path('info/', include('info.urls')),
    path("patients/", include("patients.urls")),
    path('service/', include('service.urls')),
    path('bills/', include('bills.urls')),




]
