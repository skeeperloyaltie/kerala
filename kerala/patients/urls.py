from django.urls import path
from .views import PatientListView

urlpatterns = [
    path("patients/list/", PatientListView.as_view(), name="patient-list"),
]
