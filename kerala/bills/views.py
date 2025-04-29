# bills/views.py
from datetime import datetime
import logging
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.core.exceptions import PermissionDenied
from .models import Bill
from .serializers import BillSerializer
from appointments.models import Appointment
from appointments.serializers import AppointmentSerializer
from patients.models import Patient
from users.models import Doctor
from django.utils import timezone
import pytz

logger = logging.getLogger(__name__)
KOLKATA_TZ = pytz.timezone("Asia/Kolkata")

@method_decorator(csrf_exempt, name='dispatch')
class CreateBillView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data.copy()
        logger.info(f"Received bill creation request from user {user.username}: {data}")

        # Check permissions
        if not (user.is_superuser or user.has_perm('bills.add_bill')):
            logger.warning(f"Unauthorized bill creation attempt by {user.username}")
            raise PermissionDenied("You do not have permission to create bills.")

        # Validate patient_id presence
        if 'patient_id' not in data:
            logger.error("Missing patient_id in request data.")
            return Response({"error": "patient_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Handle appointment creation if appointment_date is provided
        appointment_date = data.pop('appointment_date', None)
        doctor_id = data.pop('doctor_id', None)  # Remove doctor_id from bill data
        appointment = None
        if appointment_date:
            try:
                # Parse appointment_date as YYYY-MM-DD HH:MM
                appointment_date = datetime.strptime(appointment_date, '%Y-%m-%d %H:%M')
                appointment_date = KOLKATA_TZ.localize(appointment_date)
            except ValueError:
                logger.error("Invalid appointment date format.")
                return Response({"error": "Invalid appointment date format. Use 'YYYY-MM-DD HH:MM'."}, status=status.HTTP_400_BAD_REQUEST)

            now_kolkata = datetime.now(KOLKATA_TZ)
            if appointment_date < now_kolkata:
                logger.warning(f"Past appointment date: {appointment_date}")
                return Response({"error": "Appointment date must be in the future."}, status=status.HTTP_400_BAD_REQUEST)

            patient_id = data.get('patient_id')
            try:
                patient = Patient.objects.get(patient_id=patient_id)
            except Patient.DoesNotExist:
                logger.error(f"Patient with ID {patient_id} not found.")
                return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

            if Appointment.objects.filter(patient=patient, appointment_date=appointment_date).exists():
                logger.warning(f"Duplicate appointment for {patient.patient_id} on {appointment_date}")
                return Response({"error": "An appointment for this patient at this date and time already exists."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                doctor = Doctor.objects.get(id=doctor_id) if doctor_id else None
            except Doctor.DoesNotExist:
                logger.error(f"Doctor with ID {doctor_id} not found.")
                return Response({"error": "Doctor not found."}, status=status.HTTP_404_NOT_FOUND)

            appointment_data = {
                'patient': patient,
                'doctor': doctor,
                'appointment_date': appointment_date,
                'notes': data.get('notes', ''),
                'status': 'Booked',
                'is_emergency': False,
                'created_by': user
            }
            appointment = Appointment.objects.create(**appointment_data)
            logger.info(f"Appointment created: {appointment.id} with appointment_date: {appointment.appointment_date} (Kolkata: {appointment.appointment_date.astimezone(KOLKATA_TZ)})")
            data['appointment_id'] = appointment.id

        # Ensure items' service_id is treated as integer
        if 'items' in data:
            for item in data['items']:
                if 'service_id' in item and isinstance(item['service_id'], str):
                    try:
                        item['service_id'] = int(item['service_id'])
                    except ValueError:
                        logger.error(f"Invalid service_id: {item['service_id']}")
                        return Response({"error": f"Invalid service_id: {item['service_id']} must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        # Create bill
        serializer = BillSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            bill = serializer.save(created_by=user)  # Set created_by
            logger.info(f"Bill created: {bill.bill_id} by {user.username}")
            response_data = serializer.data
            if appointment:
                response_data['appointment'] = AppointmentSerializer(appointment).data
            return Response(response_data, status=status.HTTP_201_CREATED)
        
        logger.error(f"Bill creation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# bills/views.py
@method_decorator(csrf_exempt, name='dispatch')
class BillListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        bill_id = request.query_params.get('bill_id')
        logger.info(f"User {user.username} requesting bill list with bill_id: {bill_id}")

        if not (user.is_superuser or user.has_perm('bills.view_bill')):
            logger.warning(f"Unauthorized bill list access by {user.username}")
            raise PermissionDenied("You do not have permission to view bills.")

        bills = Bill.objects.all()
        if bill_id:
            bills = bills.filter(bill_id=bill_id)
            if not bills.exists():
                logger.error(f"Bill with ID {bill_id} not found for {user.username}")
                return Response({"error": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if user.user_type == 'Doctor':
            bills = bills.filter(appointment__doctor=user.doctor)
        
        serializer = BillSerializer(bills, many=True)
        logger.info(f"Returning {bills.count()} bills for {user.username}")
        return Response({"bills": serializer.data}, status=status.HTTP_200_OK)
    
    
# bills/views.py
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import PermissionDenied
from .models import Bill, BillItem
from .serializers import BillSerializer, BillItemSerializer
import logging

logger = logging.getLogger(__name__)
KOLKATA_TZ = pytz.timezone("Asia/Kolkata")

@method_decorator(csrf_exempt, name='dispatch')
class BillUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, *args, **kwargs):
        user = request.user
        data = request.data
        bill_id = data.get('bill_id')
        logger.info(f"User {user.username} attempting to update bill {bill_id}")

        # Check permissions
        if not (user.is_superuser or user.has_perm('bills.change_bill')):
            logger.warning(f"Unauthorized bill update attempt by {user.username}")
            raise PermissionDenied("You do not have permission to update bills.")

        try:
            bill = Bill.objects.get(bill_id=bill_id)
        except Bill.DoesNotExist:
            logger.error(f"Bill with ID {bill_id} not found.")
            return Response({"error": "Bill not found."}, status=status.HTTP_404_NOT_FOUND)

        # Prepare data for serializer
        items_data = data.pop('items', [])
        data['patient_id'] = data.get('patient_id')  # Ensure patient_id is included

        serializer = BillSerializer(bill, data=data, partial=True, context={'request': request})
        if serializer.is_valid():
            # Update bill
            bill = serializer.save()

            # Update bill items
            BillItem.objects.filter(bill=bill).delete()  # Remove existing items
            for item_data in items_data:
                item_serializer = BillItemSerializer(data=item_data)
                if item_serializer.is_valid():
                    BillItem.objects.create(bill=bill, **item_serializer.validated_data)
                else:
                    logger.error(f"Invalid bill item data: {item_serializer.errors}")
                    return Response({"error": "Invalid bill item data", "details": item_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

            logger.info(f"Bill {bill_id} updated successfully by {user.username}")
            return Response({"success": True, "bill": BillSerializer(bill).data}, status=status.HTTP_200_OK)
        
        logger.error(f"Bill update errors: {serializer.errors}")
        return Response({"error": "Invalid bill data", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)