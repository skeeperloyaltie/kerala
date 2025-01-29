from django.urls import path
from .views import CreateAppointmentView, AppointmentListView

urlpatterns = [
    path('create/', CreateAppointmentView.as_view(), name='create-appointment'),
    path('list/', AppointmentListView.as_view(), name='appointment-list'),
]
