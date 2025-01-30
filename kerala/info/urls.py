from django.urls import path
from . import views

urlpatterns = [
    path('user-details/', views.get_user_details, name='user_details'),
    path('patient-appointments/', views.get_patient_appointments, name='patient_appointments'),
    path('doctor-appointments/', views.get_doctor_appointments, name='doctor_appointments'),
]
