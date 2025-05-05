import logging
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.db.models import Q
from datetime import datetime, timedelta
from .models import Appointment, Vitals
from .serializers import AppointmentSerializer, DoctorSerializer, VitalsSerializer, CreatePatientAndAppointmentSerializer
from patients.models import Patient
from patients.serializers import PatientSerializer
from users.models import Doctor, Receptionist, Nurse
from systime.utils import get_current_ist_time, make_ist_aware, validate_ist_datetime  # Import systime utilities

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class CreateAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data
        logger.info(f"Received appointment creation request from user {user.username}: {data}")

        if not (user.is_superuser or user.has_perm('appointments.add_appointment')):
            logger.warning(f"Unauthorized appointment creation attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("Only Medium or Senior roles can create appointments.")

        required_fields = ["patient_id", "appointment_date", "doctor_id"]
        missing_fields = [field for field in required_fields if field not in data or not data[field]]
        if missing_fields:
            logger.warning(f"Missing fields: {missing_fields}")
            return Response({"error": f"Missing required fields: {', '.join(missing_fields)}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            patient = Patient.objects.get(patient_id=data["patient_id"])
        except Patient.DoesNotExist:
            logger.error(f"Patient with ID {data['patient_id']} not found.")
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            doctor = Doctor.objects.get(id=data["doctor_id"])
        except Doctor.DoesNotExist:
            logger.error(f"Doctor with ID {data['doctor_id']} not found.")
            return Response({"error": "Doctor not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            # Parse and convert appointment_date to IST
            appointment_date = datetime.fromisoformat(data["appointment_date"].replace("Z", "+00:00"))
            appointment_date = make_ist_aware(appointment_date)
            if not validate_ist_datetime(appointment_date):
                logger.warning(f"Non-IST datetime provided for appointment_date: {appointment_date}")
                return Response({"error": "Appointment date must be in IST."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            logger.error("Invalid appointment date format.")
            return Response({"error": "Invalid appointment date format. Use 'YYYY-MM-DDTHH:MM'."}, status=status.HTTP_400_BAD_REQUEST)

        now_ist = get_current_ist_time()
        if appointment_date <= now_ist:
            logger.warning(f"Past appointment date: {appointment_date}")
            return Response({"error": "Appointment date must be in the future."}, status=status.HTTP_400_BAD_REQUEST)

        if Appointment.objects.filter(patient=patient, appointment_date=appointment_date).exists():
            logger.warning(f"Duplicate appointment for {patient.patient_id} on {appointment_date}")
            return Response({"error": "An appointment for this patient at this date and time already exists."}, status=status.HTTP_400_BAD_REQUEST)

        current_illness = data.get("current_illness", "").strip()
        if current_illness:
            patient.current_medications = current_illness
            patient.save(update_fields=["current_medications"])
            logger.info(f"Updated patient {patient.patient_id} current_medications to: {current_illness}")

        appointment = Appointment.objects.create(
            patient=patient,
            doctor=doctor,
            appointment_date=appointment_date,
            notes=data.get("notes", ""),
            status="booked",
            is_emergency=data.get("is_emergency", False),
            created_by=user,
            created_at=get_current_ist_time(),
            updated_at=get_current_ist_time()
        )

        logger.info(f"Appointment created: {appointment.id} by {user.username}")
        return Response({
            "message": "Appointment created successfully.",
            "appointment": AppointmentSerializer(appointment).data
        }, status=status.HTTP_201_CREATED)

@method_decorator(csrf_exempt, name='dispatch')
class AppointmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        status_filter = request.query_params.get('status', 'all').lower()
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        doctor_id = request.query_params.get('doctor_id')
        appointment_id = request.query_params.get('appointment_id')

        logger.info(f"User {user.username} ({user.user_type} - {user.role_level}) requesting appointments with params: status={status_filter}, start_date={start_date_str}, end_date={end_date_str}, doctor_id={doctor_id}, appointment_id={appointment_id}")

        if not user.has_perm('appointments.view_appointment'):
            logger.warning(f"Unauthorized appointment list access by {user.username}")
            raise PermissionDenied("You do not have permission to view appointments.")

        try:
            # Handle single appointment fetch by appointment_id
            if appointment_id:
                try:
                    appointment = Appointment.objects.get(id=appointment_id)
                    if user.user_type == "Doctor" and appointment.doctor != user.doctor:
                        logger.warning(f"Doctor {user.username} tried to access an appointment they don't own.")
                        raise PermissionDenied("You can only view your own appointments.")
                    serializer = AppointmentSerializer(appointment)
                    logger.info(f"Returning single appointment {appointment_id} for {user.username}")
                    return Response({"appointments": [serializer.data]}, status=status.HTTP_200_OK)
                except Appointment.DoesNotExist:
                    logger.error(f"Appointment with ID {appointment_id} not found.")
                    return Response({"error": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)

            # Existing logic for fetching multiple appointments
            appointments = Appointment.objects.all()
            filtered_appointments = []
            status_success = False
            date_success = False
            doctor_success = False

            # Define status map
            status_map = {
                'all': ['booked', 'arrived', 'on-going', 'reviewed', 'scheduled'],
                'booked': ['booked'],
                'arrived': ['arrived'],
                'on-going': ['on-going'],
                'reviewed': ['reviewed'],
                'scheduled': ['scheduled']
            }
            allowed_statuses = status_map.get(status_filter, status_map['all'])

            # Apply status filter
            if allowed_statuses:
                appointments = appointments.filter(status__in=allowed_statuses)
                logger.debug(f"Status filter applied: {appointments.count()} appointments")

            # Apply date range filter
            if start_date_str and end_date_str:
                try:
                    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
                    end_date = datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1) - timedelta(seconds=1)
                    # Localize to IST
                    start_date = make_ist_aware(start_date)
                    end_date = make_ist_aware(end_date)
                    appointments = appointments.filter(appointment_date__range=[start_date, end_date])
                    if appointments.exists():
                        date_success = True
                        filtered_appointments = list(appointments)
                        logger.debug(f"Date filter successful: {appointments.count()} appointments")
                        for appt in appointments:
                            logger.debug(f"Appointment {appt.id}: {appt.appointment_date}")
                    else:
                        logger.debug(f"Date filter returned 0 appointments")
                except ValueError:
                    logger.error(f"Invalid date format: start_date={start_date_str}, end_date={end_date_str}")
                    return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                logger.warning("Missing start_date or end_date parameters")
                return Response({"error": "Both start_date and end_date are required for fetching multiple appointments."}, status=status.HTTP_400_BAD_REQUEST)

            # Apply doctor filter
            if doctor_id and doctor_id != 'all':
                try:
                    appointments = appointments.filter(doctor__id=doctor_id)
                    if appointments.exists():
                        doctor_success = True
                        filtered_appointments = list(appointments)
                        logger.debug(f"Doctor filter successful: {appointments.count()} appointments")
                    else:
                        logger.debug(f"Doctor filter returned 0 appointments")
                except ValueError:
                    logger.error(f"Invalid doctor_id: {doctor_id}")
                    return Response({"error": "Invalid doctor_id."}, status=status.HTTP_400_BAD_REQUEST)
            elif user.user_type == "Doctor":
                appointments = appointments.filter(doctor=user.doctor)
                if appointments.exists():
                    doctor_success = True
                    filtered_appointments = list(appointments)
                    logger.debug(f"User.doctor filter successful: {appointments.count()} appointments")
                else:
                    logger.debug(f"User.doctor filter returned 0 appointments")

            # For Receptionists: Apply only status and doctor filters, skip date filter if not provided
            if user.user_type == "Receptionist" and not (start_date_str and end_date_str):
                filtered_appointments = list(appointments)
                if filtered_appointments:
                    status_success = True
                    logger.debug(f"Receptionist: {len(filtered_appointments)} appointments after status/doctor filters")
                else:
                    logger.debug("Receptionist: No appointments after status/doctor filters")

            # Validate appointments are within date range
            filtered_appointments = [
                appt for appt in filtered_appointments
                if start_date <= appt.appointment_date <= end_date
            ]
            logger.debug(f"Final filtered appointments: {len(filtered_appointments)} within {start_date} to {end_date}")

            # Serialize and return
            serializer = AppointmentSerializer(filtered_appointments, many=True)
            logger.info(f"Appointments returned for {user.username}: {len(serializer.data)}")
            return Response({"appointments": serializer.data}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error fetching appointments for {user.username}: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred while retrieving appointments."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@method_decorator(csrf_exempt, name='dispatch')
class DoctorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        logger.info(f"User {user.username} ({user.user_type} - {user.role_level}) requested the list of doctors.")

        if not user.has_perm('appointments.view_appointment'):
            logger.warning(f"Unauthorized doctor list access by {user.username}")
            raise PermissionDenied("You do not have permission to view doctors.")

        try:
            doctors = Doctor.objects.all()
            serializer = DoctorSerializer(doctors, many=True)
            logger.info(f"Fetched {doctors.count()} doctors successfully.")
            return Response({"doctors": serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching doctors: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred while retrieving doctors."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@method_decorator(csrf_exempt, name='dispatch')
class VitalsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, appointment_id=None):
        user = request.user
        logger.info(f"GET request for vitals by {user.username} for appointment ID: {appointment_id}")

        if not user.has_perm('appointments.view_appointment'):
            logger.warning(f"Unauthorized vitals access by {user.username}")
            raise PermissionDenied("You do not have permission to view vitals.")

        try:
            vitals = get_object_or_404(Vitals, appointment_id=appointment_id)
            serializer = VitalsSerializer(vitals)
            logger.info(f"Vitals retrieved successfully for appointment ID: {appointment_id}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error retrieving vitals for appointment ID: {appointment_id}: {str(e)}")
            return Response({"error": "Vitals not found."}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, appointment_id=None):
        user = request.user
        logger.info(f"POST request for vitals by {user.username}: {request.data}")

        if not (user.is_superuser or user.has_perm('appointments.add_appointment') and user.user_type in ['Nurse', 'Doctor']):
            logger.warning(f"Unauthorized vitals creation attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("Only Medium or Senior Nurses and Doctors can add vitals.")

        appointment_id = appointment_id or request.data.get("appointment")
        if Vitals.objects.filter(appointment_id=appointment_id).exists():
            logger.warning(f"Vitals already exist for appointment ID: {appointment_id}")
            return Response({"error": "Vitals for this appointment already exist."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VitalsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(appointment_id=appointment_id, recorded_by=user, recorded_at=get_current_ist_time())
            logger.info(f"Vitals created successfully for appointment ID: {appointment_id} by {user.username}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        logger.error(f"Invalid data for vitals creation: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, appointment_id=None):
        user = request.user
        logger.info(f"PATCH request for vitals by {user.username} for appointment ID: {appointment_id}")

        if not (user.is_superuser or user.has_perm('appointments.change_appointment') and user.user_type in ['Nurse', 'Doctor']):
            logger.warning(f"Unauthorized vitals update attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("Only Senior Nurses and Doctors can update vitals.")

        try:
            vitals = get_object_or_404(Vitals, appointment_id=appointment_id)
            serializer = VitalsSerializer(vitals, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save(recorded_by=user, recorded_at=get_current_ist_time())
                logger.info(f"Vitals updated successfully for appointment ID: {appointment_id} by {user.username}")
                return Response(serializer.data, status=status.HTTP_200_OK)
            logger.error(f"Invalid data for vitals update: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating vitals for appointment ID: {appointment_id}: {str(e)}")
            return Response({"error": "Vitals not found."}, status=status.HTTP_404_NOT_FOUND)

@method_decorator(csrf_exempt, name='dispatch')
class EditAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id):
        user = request.user
        logger.info(f"User {user.username} editing appointment {appointment_id}")

        if not (user.is_superuser or user.has_perm('appointments.change_appointment')):
            raise PermissionDenied("Only Senior roles can edit appointments.")

        appointment = get_object_or_404(Appointment, id=appointment_id)
        if user.user_type == "Doctor" and appointment.doctor != user.doctor:
            raise PermissionDenied("You can only edit your own appointments.")

        # Handle appointment_date if provided
        data = request.data.copy()
        if data.get('appointment_date'):
            try:
                appointment_date = datetime.fromisoformat(data['appointment_date'].replace("Z", "+00:00"))
                data['appointment_date'] = make_ist_aware(appointment_date)
                if not validate_ist_datetime(data['appointment_date']):
                    logger.warning(f"Non-IST datetime provided for appointment_date: {data['appointment_date']}")
                    return Response({"error": "Appointment date must be in IST."}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                logger.error("Invalid appointment date format.")
                return Response({"error": "Invalid appointment date format. Use 'YYYY-MM-DDTHH:MM:SS'."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AppointmentSerializer(appointment, data=data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save(updated_by=user, updated_at=get_current_ist_time())
            patient_id = request.data.get('patient_id')
            if patient_id:
                patient = get_object_or_404(Patient, patient_id=patient_id)
                patient_serializer = PatientSerializer(patient, data=request.data, partial=True)
                if patient_serializer.is_valid():
                    patient_serializer.save()
            logger.info(f"Appointment {appointment_id} updated by {user.username}")
            return Response({
                "message": "Appointment updated successfully.",
                "appointment": serializer.data,
                "patient": patient_serializer.data if patient_id else None
            }, status=status.HTTP_200_OK)
        logger.error(f"Errors updating appointment {appointment_id}: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class CancelAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id=None):
        user = request.user
        data = request.data
        appointment_ids = data.get("appointment_ids")
        logger.info(f"User {user.username} ({user.user_type} - {user.role_level}) attempting to cancel appointment(s)")

        if not (user.is_superuser or user.has_perm('appointments.change_appointment')):
            logger.warning(f"Unauthorized cancellation attempt by {user.username}")
            raise PermissionDenied("Only Senior roles can cancel appointments.")

        if appointment_id:
            appointments = [get_object_or_404(Appointment, id=appointment_id)]
        elif appointment_ids:
            appointments = Appointment.objects.filter(id__in=appointment_ids)
            if not appointments.exists():
                return Response({"error": "No valid appointments found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({"error": "Appointment ID or list of IDs required."}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        for appointment in appointments:
            if user.user_type == "Doctor" and appointment.doctor != user.doctor:
                logger.warning(f"Doctor {user.username} tried to cancel an appointment they don't own.")
                continue
            appointment.status = data.get("status", "Canceled")
            appointment.updated_by = user
            appointment.updated_at = get_current_ist_time()
            appointment.save()
            updated_count += 1

        if updated_count == 0:
            return Response({"error": "No appointments were canceled. Check permissions or appointment IDs."}, status=status.HTTP_403_FORBIDDEN)

        logger.info(f"User {user.username} successfully canceled {updated_count} appointment(s)")
        return Response({"message": f"Successfully canceled {updated_count} appointment(s)."}, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class RescheduleAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, appointment_id=None):
        user = request.user
        data = request.data
        new_date_str = data.get("appointment_date")
        appointment_ids = data.get("appointment_ids")
        patient_id = data.get("patient_id")

        if not (user.is_superuser or user.has_perm('appointments.change_appointment')):
            raise PermissionDenied("Only Senior roles can reschedule appointments.")

        if not new_date_str:
            return Response({"error": "New appointment date is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_date = datetime.fromisoformat(new_date_str.replace("Z", "+00:00"))
            new_date = make_ist_aware(new_date)
            if not validate_ist_datetime(new_date):
                logger.warning(f"Non-IST datetime provided for new_date: {new_date}")
                return Response({"error": "New appointment date must be in IST."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({"error": "Invalid date format. Use 'YYYY-MM-DDTHH:MM:SS'."}, status=status.HTTP_400_BAD_REQUEST)

        now_ist = get_current_ist_time()
        if new_date <= now_ist:
            return Response({"error": "New appointment date must be in the future."}, status=status.HTTP_400_BAD_REQUEST)

        if appointment_id:
            appointments = [get_object_or_404(Appointment, id=appointment_id)]
        elif appointment_ids:
            appointments = Appointment.objects.filter(id__in=appointment_ids)
        elif patient_id:
            appointments = Appointment.objects.filter(patient__patient_id=patient_id)
        else:
            return Response({"error": "Provide an appointment ID, list of IDs, or patient ID."}, status=status.HTTP_400_BAD_REQUEST)

        if not appointments.exists():
            return Response({"error": "No valid appointments found."}, status=status.HTTP_404_NOT_FOUND)

        updated_count = 0
        for appointment in appointments:
            if user.user_type == "Doctor" and appointment.doctor != user.doctor:
                continue
            serializer = AppointmentSerializer(
                appointment,
                data={"appointment_date": new_date, "status": data.get("status", "booked")},
                partial=True,
                context={'request': request}
            )
            if serializer.is_valid():
                serializer.save(updated_by=user, updated_at=get_current_ist_time())
                updated_count += 1

        if updated_count == 0:
            return Response({"error": "No appointments were updated. Check permissions or IDs."}, status=status.HTTP_403_FORBIDDEN)

        logger.info(f"User {user.username} rescheduled {updated_count} appointments to {new_date}")
        return Response({"message": f"Successfully rescheduled {updated_count} appointments to {new_date}."}, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class AppointmentUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, *args, **kwargs):
        user = request.user
        data = request.data
        appointment_id = data.get('appointment_id')
        logger.info(f"User {user.username} attempting to update appointment {appointment_id}")
        logger.debug(f"Incoming request data: {data}")

        if not (user.is_superuser or user.has_perm('appointments.change_appointment')):
            logger.warning(f"Unauthorized appointment update attempt by {user.username}")
            raise PermissionDenied("Only Senior roles can edit appointments.")

        appointment = get_object_or_404(Appointment, id=appointment_id)
        if user.user_type == "Doctor" and appointment.doctor != user.doctor:
            logger.warning(f"Doctor {user.username} tried to edit an appointment they don't own.")
            raise PermissionDenied("You can only edit your own appointments.")

        # Log valid status choices
        status_field = Appointment._meta.get_field('status')
        status_choices = [choice[0] for choice in status_field.choices]
        logger.debug(f"Valid status choices for Appointment: {status_choices}")
        logger.debug(f"Status field details: default={status_field.default}, max_length={status_field.max_length}")

        # Convert date and time to appointment_date
        if data.get('date') and data.get('time'):
            try:
                appointment_date_str = f"{data['date']} {data['time']}"
                appointment_date = datetime.strptime(appointment_date_str, '%Y-%m-%d %H:%M')
                data['appointment_date'] = make_ist_aware(appointment_date)
                if not validate_ist_datetime(data['appointment_date']):
                    logger.warning(f"Non-IST datetime provided for appointment_date: {data['appointment_date']}")
                    return Response({"error": "Appointment date must be in IST."}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                logger.error(f"Invalid date/time format: {appointment_date_str}")
                return Response({"error": "Invalid date/time format. Use 'YYYY-MM-DD' and 'HH:MM'."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AppointmentSerializer(appointment, data=data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save(updated_by=user, updated_at=get_current_ist_time())
            logger.info(f"Appointment {appointment_id} updated by {user.username}")
            return Response({"success": True, "appointment": serializer.data}, status=status.HTTP_200_OK)

        logger.error(f"Errors updating appointment {appointment_id}: {serializer.errors}")
        return Response({"error": "Invalid appointment data", "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class CreatePatientAndAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        logger.info(f"Request data: {request.data}")

        serializer = CreatePatientAndAppointmentSerializer(data=request.data)
        if serializer.is_valid():
            patient_data = {
                'first_name': serializer.validated_data['first_name'],
                'last_name': serializer.validated_data['last_name'],
                'gender': serializer.validated_data['gender'],
                'date_of_birth': serializer.validated_data['date_of_birth'],
                'father_name': serializer.validated_data['father_name'],
                'mobile_number': serializer.validated_data['mobile_number'],
                'alternate_mobile_number': serializer.validated_data.get('alternate_mobile_number', ''),
                'aadhar_number': serializer.validated_data.get('aadhar_number', ''),
                'preferred_language': serializer.validated_data.get('preferred_language', ''),
                'marital_status': serializer.validated_data.get('marital_status', ''),
                'marital_since': serializer.validated_data.get('marital_since'),
                'referred_by': serializer.validated_data.get('referred_by', ''),
                'channel': serializer.validated_data.get('channel', ''),
                'cio': serializer.validated_data.get('cio', ''),
                'occupation': serializer.validated_data.get('occupation', ''),
                'tag': serializer.validated_data.get('tag', ''),
                'blood_group': serializer.validated_data.get('blood_group', ''),
                'address': serializer.validated_data.get('address', ''),
                'city': serializer.validated_data.get('city', ''),
                'pincode': serializer.validated_data.get('pincode', ''),
                'email': serializer.validated_data.get('email', ''),
                'known_allergies': serializer.validated_data.get('known_allergies', ''),
                'current_medications': serializer.validated_data.get('current_medications', ''),
                'past_medical_history': serializer.validated_data.get('past_medical_history', ''),
                'specific_notes': serializer.validated_data.get('specific_notes', ''),
                'primary_doctor': serializer.validated_data.get('primary_doctor'),
                'emergency_contact_name': serializer.validated_data.get('emergency_contact_name', ''),
                'emergency_contact_relationship': serializer.validated_data.get('emergency_contact_relationship', ''),
                'emergency_contact_number': serializer.validated_data.get('emergency_contact_number', ''),
                'insurance_provider': serializer.validated_data.get('insurance_provider', ''),
                'policy_number': serializer.validated_data.get('policy_number', ''),
                'payment_preference': serializer.validated_data.get('payment_preference', ''),
                'admission_type': serializer.validated_data.get('admission_type', ''),
                'hospital_code': serializer.validated_data.get('hospital_code', ''),
                'created_at': get_current_ist_time(),
                'updated_at': get_current_ist_time()
            }

            patient_serializer = PatientSerializer(data=patient_data)
            if patient_serializer.is_valid():
                patient = patient_serializer.save()
                logger.info(f"Patient created: {patient.patient_id}")

                appointment_data = {
                    'patient_id': patient.patient_id,
                    'doctor_id': serializer.validated_data.get('doctor').id if serializer.validated_data.get('doctor') else None,
                    'appointment_date': make_ist_aware(serializer.validated_data['appointment_date']),
                    'notes': serializer.validated_data.get('notes', ''),
                    'is_emergency': serializer.validated_data.get('is_emergency', False),
                    'status': 'booked',
                    'created_at': get_current_ist_time(),
                    'updated_at': get_current_ist_time()
                }

                if not validate_ist_datetime(appointment_data['appointment_date']):
                    logger.warning(f"Non-IST datetime provided for appointment_date: {appointment_data['appointment_date']}")
                    return Response({"error": "Appointment date must be in IST."}, status=status.HTTP_400_BAD_REQUEST)

                try:
                    receptionist = Receptionist.objects.get(user=request.user)
                    appointment_data['receptionist'] = receptionist.id
                except Receptionist.DoesNotExist:
                    appointment_data['receptionist'] = None

                appointment_serializer = AppointmentSerializer(data=appointment_data, context={'request': request})
                if appointment_serializer.is_valid():
                    appointment = appointment_serializer.save(created_by=request.user)
                    logger.info(f"Appointment created: {appointment.id}")
                    return Response({
                        'patient': patient_serializer.data,
                        'appointment': appointment_serializer.data
                    }, status=status.HTTP_201_CREATED)
                logger.error(f"Appointment serializer errors: {appointment_serializer.errors}")
                return Response(appointment_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            logger.error(f"Patient serializer errors: {patient_serializer.errors}")
            return Response(patient_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        logger.error(f"CreatePatientAndAppointment serializer errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)