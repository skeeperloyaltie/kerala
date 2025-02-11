from django.urls import path
from .views import (
    CreateAppointmentView,
    AppointmentListView,
    DoctorListView,
    VitalsAPIView,
    EditAppointmentView,
    CancelAppointmentView,
    RescheduleAppointmentView,
)

urlpatterns = [
    path('create/', CreateAppointmentView.as_view(), name='create-appointment'),
    path('list/', AppointmentListView.as_view(), name='appointment-list'),
    path('vitals/<int:appointment_id>/', VitalsAPIView.as_view(), name='vitals-detail'),  # For GET and PATCH
    path('vitals/', VitalsAPIView.as_view(), name='vitals-create'),  # For POST (creating vitals)
    path('doctors/list/', DoctorListView.as_view(), name='doctor-list'),
    
    # New endpoints
    path('edit/<int:appointment_id>/', EditAppointmentView.as_view(), name='edit-appointment'),
    path('cancel/<int:appointment_id>/', CancelAppointmentView.as_view(), name='cancel-appointment'),
    path('reschedule/<int:appointment_id>/', RescheduleAppointmentView.as_view(), name='reschedule-appointment'),
]
