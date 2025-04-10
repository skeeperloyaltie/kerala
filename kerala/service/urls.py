from django.urls import path
from .views import ServiceCreateView, ServiceListView

urlpatterns = [
    path('services/create/', ServiceCreateView.as_view(), name='service-create'),
    path('services/list/', ServiceListView.as_view(), name='service-list'),
]