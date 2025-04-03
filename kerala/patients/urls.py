from django.urls import path
from .views import CreatePatientView, GetPatientDetailsView, PatientListView

urlpatterns = [
    path('patients/create/', CreatePatientView.as_view(), name='create-patient'),
    path('patients/<str:patient_id>/', GetPatientDetailsView.as_view(), name='get-patient-details'),
    path('patients/list/', PatientListView.as_view(), name='patient-list'),
]