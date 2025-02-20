from rest_framework import generics
from appointments.models import Patient
from .serializers import PatientSerializer

class PatientListView(generics.ListAPIView):
    """
    Returns a list of all patients with their details, including appointments, doctor, and vitals.
    """
    queryset = Patient.objects.prefetch_related("appointments__doctor", "appointments__vitals").all()
    serializer_class = PatientSerializer
