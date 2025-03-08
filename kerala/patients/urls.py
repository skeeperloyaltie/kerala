from django.urls import path
from .views import PatientListView, PatientSearchView

urlpatterns = [
    path("list/", PatientListView.as_view(), name="patient-list"),
    path('search/', PatientSearchView.as_view(), name='patient-search'),

]
