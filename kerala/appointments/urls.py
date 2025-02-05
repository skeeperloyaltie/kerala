from django.urls import path
from .views import CreateAppointmentView, AppointmentListView, DoctorListView, VitalsAPIView

urlpatterns = [
    path('create/', CreateAppointmentView.as_view(), name='create-appointment'),
    path('list/', AppointmentListView.as_view(), name='appointment-list'),
    path('vitals/<int:appointment_id>/', VitalsAPIView.as_view(), name='vitals-detail'),  # For GET and PATCH
    path('vitals/', VitalsAPIView.as_view(), name='vitals-create'),  # For POST (creating vitals)
    path('doctors/list/', DoctorListView.as_view(), name='doctor-list'),

]
