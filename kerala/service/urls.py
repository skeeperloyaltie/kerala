from django.urls import path
from .views import ServiceCreateView, ServiceListView

urlpatterns = [
    path('create/', ServiceCreateView.as_view(), name='service-create'),
    path('list/', ServiceListView.as_view(), name='service-list'),
]