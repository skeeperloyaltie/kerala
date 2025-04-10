from django.urls import path
from .views import ServiceCreateView, ServiceListView, ServiceSearchView

urlpatterns = [
    path('create/', ServiceCreateView.as_view(), name='service-create'),
    path('list/', ServiceListView.as_view(), name='service-list'),
    path('search/', ServiceSearchView.as_view(), name='service-search'),

]