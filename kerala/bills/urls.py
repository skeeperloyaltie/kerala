# bills/urls.py
from django.urls import path
from .views import CreateBillView, BillListView

urlpatterns = [
    path('create/', CreateBillView.as_view(), name='create_bill'),
    path('list/', BillListView.as_view(), name='bill_list'),
]