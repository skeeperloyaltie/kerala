from rest_framework import generics
from appointments.models import Patient
from .serializers import PatientSerializer

class PatientListView(generics.ListAPIView):
    """
    Returns a list of all patients with their details.
    """
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
