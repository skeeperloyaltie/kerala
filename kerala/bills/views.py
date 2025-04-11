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

        # Validate patient
        patient_id = data.get('patient_id')
        try:
            patient = Patient.objects.get(patient_id=patient_id)
        except Patient.DoesNotExist:
            logger.error(f"Patient with ID {patient_id} not found.")
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        # Handle appointment creation if appointment_date is provided
        appointment_date = data.pop('appointment_date', None)
        doctor_id = data.get('doctor_id')
        appointment = None
        if appointment_date:
            try:
                appointment_date = datetime.fromisoformat(appointment_date.replace("Z", "+00:00"))
                appointment_date = KOLKATA_TZ.localize(appointment_date) if not appointment_date.tzinfo else appointment_date.astimezone(KOLKATA_TZ)
            except ValueError:
                logger.error("Invalid appointment date format.")
                return Response({"error": "Invalid appointment date format. Use 'YYYY-MM-DDTHH:MM'."}, status=status.HTTP_400_BAD_REQUEST)

            now_kolkata = datetime.now(KOLKATA_TZ)
            if appointment_date < now_kolkata:
                logger.warning(f"Past appointment date: {appointment_date}")
                return Response({"error": "Appointment date must be in the future."}, status=status.HTTP_400_BAD_REQUEST)

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
                'status': 'Scheduled',
                'is_emergency': False,
                'created_by': user
            }
            appointment = Appointment.objects.create(**appointment_data)
            logger.info(f"Appointment created: {appointment.id} during bill creation")
            data['appointment_id'] = appointment.id

        # Create bill
        serializer = BillSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            bill = serializer.save()
            logger.info(f"Bill created: {bill.bill_id} by {user.username}")
            response_data = serializer.data
            if appointment:
                response_data['appointment'] = AppointmentSerializer(appointment).data
            return Response(response_data, status=status.HTTP_201_CREATED)
        
        logger.error(f"Bill creation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class BillListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        logger.info(f"User {user.username} requesting bill list")

        if not (user.is_superuser or user.has_perm('bills.view_bill')):
            logger.warning(f"Unauthorized bill list access by {user.username}")
            raise PermissionDenied("You do not have permission to view bills.")

        bills = Bill.objects.all()
        if user.user_type == 'Doctor':
            bills = bills.filter(appointment__doctor=user.doctor)
        
        serializer = BillSerializer(bills, many=True)
        logger.info(f"Returning {bills.count()} bills for {user.username}")
        return Response({"bills": serializer.data}, status=status.HTTP_200_OK)