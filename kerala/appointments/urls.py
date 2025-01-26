from django.urls import path
from .views import CreateAppointmentView

urlpatterns = [
    path('appointments/', CreateAppointmentView.as_view(), name='create-appointment'),
]
