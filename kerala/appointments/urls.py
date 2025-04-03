from django.urls import path
from .views import (
    CreateAppointmentView, AppointmentListView, DoctorListView, VitalsAPIView,
    EditAppointmentView, CancelAppointmentView, RescheduleAppointmentView,
    CreatePatientAndAppointmentView
)

urlpatterns = [
    path('create/', CreateAppointmentView.as_view(), name='create-appointment'),
    path('list/', AppointmentListView.as_view(), name='appointment-list'),
    path('vitals/<int:appointment_id>/', VitalsAPIView.as_view(), name='vitals-detail'),
    path('vitals/', VitalsAPIView.as_view(), name='vitals-create'),
    path('doctors/list/', DoctorListView.as_view(), name='doctor-list'),
    path('edit/<int:appointment_id>/', EditAppointmentView.as_view(), name='edit-appointment'),
    path('cancel/<int:appointment_id>/', CancelAppointmentView.as_view(), name='cancel-appointment'),
    path('cancel/', CancelAppointmentView.as_view(), name='bulk-cancel-appointment'),
    path('reschedule/<int:appointment_id>/', RescheduleAppointmentView.as_view(), name='reschedule-appointment'),
    path('reschedule/', RescheduleAppointmentView.as_view(), name='bulk-reschedule-appointment'),
    path('patients-and-appointments/create/', CreatePatientAndAppointmentView.as_view(), name='create-patient-and-appointment'),
]