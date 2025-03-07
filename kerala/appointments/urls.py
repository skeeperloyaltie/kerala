from django.urls import path
from .views import (
    CreateAppointmentView,
    AppointmentListView,
    CreatePatientView,
    DoctorListView,
    GetPatientDetailsView,
    PatientHistoryView,
    SearchView,
    VitalsAPIView,
    EditAppointmentView,
    CancelAppointmentView,
    RescheduleAppointmentView,
)

urlpatterns = [
    path('patients/create/', CreatePatientView.as_view(), name='create-patient'),
    path('create/', CreateAppointmentView.as_view(), name='create-appointment'),
    path('list/', AppointmentListView.as_view(), name='appointment-list'),
    path('vitals/<int:appointment_id>/', VitalsAPIView.as_view(), name='vitals-detail'),
    path('vitals/', VitalsAPIView.as_view(), name='vitals-create'),
    path('doctors/list/', DoctorListView.as_view(), name='doctor-list'),
    path("get-patient-details/<str:patient_id>/", GetPatientDetailsView.as_view(), name="get-patient-details"),
    path('edit/<int:appointment_id>/', EditAppointmentView.as_view(), name='edit-appointment'),
    path('cancel/<int:appointment_id>/', CancelAppointmentView.as_view(), name='cancel-appointment'),
    path('cancel/', CancelAppointmentView.as_view(), name='bulk-cancel-appointment'),
    path('reschedule/<int:appointment_id>/', RescheduleAppointmentView.as_view(), name='reschedule-appointment'),
    path('reschedule/', RescheduleAppointmentView.as_view(), name='bulk-reschedule-appointment'),
    path('search/', SearchView.as_view(), name='search-appointment'),
    path('patients/<str:patient_id>/history/', PatientHistoryView.as_view(), name='patient-history'),

]