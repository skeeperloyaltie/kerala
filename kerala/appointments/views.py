import logging
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, generics, permissions, pagination
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.core.cache import cache
from datetime import datetime
import pytz
from .models import Appointment, Patient, Vitals
from .serializers import AppointmentSerializer, PatientSerializer, DoctorSerializer, VitalsSerializer
from users.models import Doctor, Receptionist, Nurse

# Configure logger
logger = logging.getLogger(__name__)

# Set the timezone to Asia/Kolkata
KOLKATA_TZ = pytz.timezone("Asia/Kolkata")


@method_decorator(csrf_exempt, name='dispatch')
class CreatePatientView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        logger.info(f"Received patient creation request from user {user.username}: {request.data}")

        # Only Medium/Senior Receptionists, Nurses, Doctors, or Admins can create patients
        if not (user.is_superuser or user.has_perm('appointments.add_appointment')):
            logger.warning(f"Unauthorized patient creation attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("Only Medium or Senior roles can create patients.")

        serializer = PatientSerializer(data=request.data)
        if serializer.is_valid():
            patient = serializer.save()
            logger.info(f"Patient created successfully: {patient.patient_id} by {user.username}")
            return Response({"message": "Patient created successfully.", "patient": PatientSerializer(patient).data}, status=status.HTTP_201_CREATED)
        logger.error(f"Patient creation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(csrf_exempt, name='dispatch')
class CreateAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        user = request.user
        data = request.data
        logger.info(f"Received appointment creation request from user {user.username}: {data}")

        # Only Medium/Senior roles or Admins can create appointments
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
            appointment_date = datetime.fromisoformat(data["appointment_date"].replace("Z", "+00:00"))
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
            status="Scheduled",
            is_emergency=data.get("is_emergency", False),
            created_by=user
        )

        logger.info(f"Appointment created: {appointment.id} by {user.username}")
        return Response({
            "message": "Appointment created successfully.",
            "appointment": AppointmentSerializer(appointment).data
        }, status=status.HTTP_201_CREATED)


class DoctorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        logger.info(f"User {user.username} ({user.user_type} - {user.role_level}) requested the list of doctors.")

        # All authenticated users can view doctors (Basic and above)
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
class AppointmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        status_filter = request.query_params.get('status', 'Scheduled')
        logger.info(f"User {user.username} ({user.user_type} - {user.role_level}) requesting appointments with status '{status_filter}'")

        # Check view permission
        if not user.has_perm('appointments.view_appointment'):
            logger.warning(f"Unauthorized appointment list access by {user.username}")
            raise PermissionDenied("You do not have permission to view appointments.")

        try:
            if user.user_type == "Doctor":
                appointments = Appointment.objects.filter(doctor=user.doctor, status=status_filter)
                logger.info(f"Doctor {user.username} fetched {appointments.count()} appointments")
            elif user.user_type in ["Receptionist", "Nurse"] or user.is_superuser:
                appointments = Appointment.objects.filter(status=status_filter)
                logger.info(f"{user.user_type} {user.username} fetched {appointments.count()} appointments")
            else:
                logger.warning(f"Unauthorized access attempt by {user.username} ({user.user_type})")
                return Response({"error": "Only Doctors, Nurses, Receptionists, or Admins can view appointments."}, status=status.HTTP_403_FORBIDDEN)

            serializer = AppointmentSerializer(appointments, many=True)
            logger.info(f"Appointments returned for {user.username}: {len(serializer.data)}")
            return Response({"appointments": serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching appointments for {user.username}: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred while retrieving appointments."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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

        # Only Medium/Senior Nurses, Doctors, or Admins can add vitals
        if not (user.is_superuser or user.has_perm('appointments.add_appointment') and user.user_type in ['Nurse', 'Doctor']):
            logger.warning(f"Unauthorized vitals creation attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("Only Medium or Senior Nurses and Doctors can add vitals.")

        appointment_id = appointment_id or request.data.get("appointment")
        if Vitals.objects.filter(appointment_id=appointment_id).exists():
            logger.warning(f"Vitals already exist for appointment ID: {appointment_id}")
            return Response({"error": "Vitals for this appointment already exist."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VitalsSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(appointment_id=appointment_id, recorded_by=user)
            logger.info(f"Vitals created successfully for appointment ID: {appointment_id} by {user.username}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        logger.error(f"Invalid data for vitals creation: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, appointment_id=None):
        user = request.user
        logger.info(f"PATCH request for vitals by {user.username} for appointment ID: {appointment_id}")

        # Only Senior Nurses, Doctors, or Admins can update vitals
        if not (user.is_superuser or user.has_perm('appointments.change_appointment') and user.user_type in ['Nurse', 'Doctor']):
            logger.warning(f"Unauthorized vitals update attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("Only Senior Nurses and Doctors can update vitals.")

        try:
            vitals = get_object_or_404(Vitals, appointment_id=appointment_id)
            serializer = VitalsSerializer(vitals, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save(recorded_by=user)
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

        serializer = AppointmentSerializer(appointment, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save(updated_by=user)
            # Optionally update patient if patient_id is provided
            patient_id = request.data.get('patient_id')
            if patient_id:
                patient = get_object_or_404(Patient, patient_id=patient_id)
                patient_serializer = PatientSerializer(patient, data=request.data, partial=True)
                if patient_serializer.is_valid():
                    patient_serializer.save()
            logger.info(f"Appointment {appointment_id} updated by {user.username}")
            return Response({"message": "Appointment updated successfully.", "appointment": serializer.data, "patient": patient_serializer.data if patient_id else None}, status=status.HTTP_200_OK)
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

        # Only Senior roles or Admins can cancel (update) appointments
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
            new_date = KOLKATA_TZ.localize(new_date) if not new_date.tzinfo else new_date.astimezone(KOLKATA_TZ)
        except ValueError:
            return Response({"error": "Invalid date format. Use 'YYYY-MM-DDTHH:MM:SS'."}, status=status.HTTP_400_BAD_REQUEST)

        if new_date <= datetime.now(KOLKATA_TZ):
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
            serializer = AppointmentSerializer(appointment, data={"appointment_date": new_date, "status": data.get("status", "Rescheduled")}, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save(updated_by=user)
                updated_count += 1

        if updated_count == 0:
            return Response({"error": "No appointments were updated. Check permissions or IDs."}, status=status.HTTP_403_FORBIDDEN)

        logger.info(f"User {user.username} rescheduled {updated_count} appointments to {new_date}")
        return Response({"message": f"Successfully rescheduled {updated_count} appointments to {new_date}."}, status=status.HTTP_200_OK)
class StandardResultsSetPagination(pagination.PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class SearchView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        query_params = self.request.query_params

        if not user.has_perm('appointments.view_appointment'):
            logger.warning(f"Unauthorized search attempt by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("You do not have permission to search appointments.")

        patient_ids = query_params.getlist("patient_id", [])
        patient_ids = [pid.strip() for pid in patient_ids if pid.strip()] if patient_ids else []
        first_name = query_params.get("first_name", "").strip()
        last_name = query_params.get("last_name", "").strip()
        contact_number = query_params.get("contact_number", "").strip()
        email = query_params.get("email", "").strip()
        status = query_params.get("status", "").strip()
        date_of_birth = query_params.get("date_of_birth", "").strip()
        appointment_date = query_params.get("appointment_date", "").strip()
        doctor_id = query_params.get("doctor_id", "").strip()

        query_key = f"{','.join(patient_ids)}_{first_name}_{last_name}_{contact_number}_{email}_{status}_{date_of_birth}_{appointment_date}_{doctor_id}"
        cache_key = f"search_{user.id}_{query_key}"
        logger.info(f"User {user.username} searching with parameters: {query_key}")

        cached_results = cache.get(cache_key)
        if cached_results and not appointment_date:
            logger.info(f"Cache hit for user {user.id}, query: {query_key}")
            return cached_results

        if not any([patient_ids, first_name, last_name, contact_number, email, status, date_of_birth, appointment_date, doctor_id]):
            logger.info(f"Empty query received from user {user.id}")
            return {"patients": [], "appointments": []}

        patients, appointments = [], []
        if user.user_type in ["Receptionist", "Nurse"] or user.is_superuser:
            if patient_ids:
                patients = Patient.objects.filter(patient_id__in=patient_ids)
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
            elif doctor_id:
                appointments = Appointment.objects.filter(doctor__id=doctor_id).prefetch_related('vitals')
                patient_ids_from_appts = appointments.values_list('patient__patient_id', flat=True)
                patients = Patient.objects.filter(patient_id__in=patient_ids_from_appts)
            elif first_name:
                patients = Patient.objects.filter(first_name__iexact=first_name)
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
            elif contact_number:
                patients = Patient.objects.filter(mobile_number__icontains=contact_number)
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
            elif date_of_birth:
                try:
                    dob = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
                    patients = Patient.objects.filter(date_of_birth=dob)
                    patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                    appointments = Appointment.objects.filter(patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
                except ValueError:
                    logger.error(f"Invalid date_of_birth format: {date_of_birth}")
                    return {"patients": [], "appointments": []}
            elif appointment_date:
                try:
                    apt_datetime = datetime.strptime(appointment_date, "%Y-%m-%dT%H:%M:%S%z")
                    apt_datetime = apt_datetime.astimezone(KOLKATA_TZ)
                    appointments = Appointment.objects.filter(appointment_date=apt_datetime).prefetch_related('vitals')
                    patient_ids_from_appts = appointments.values_list('patient__patient_id', flat=True)
                    patients = Patient.objects.filter(patient_id__in=patient_ids_from_appts)
                except ValueError:
                    try:
                        apt_date = datetime.strptime(appointment_date, "%Y-%m-%d").date()
                        appointments = Appointment.objects.filter(appointment_date__date=apt_date).prefetch_related('vitals')
                        patient_ids_from_appts = appointments.values_list('patient__patient_id', flat=True)
                        patients = Patient.objects.filter(patient_id__in=patient_ids_from_appts)
                    except ValueError:
                        logger.error(f"Invalid appointment_date format: {appointment_date}")
                        return {"patients": [], "appointments": []}
            else:
                patients = Patient.objects.filter(
                    Q(last_name__icontains=last_name) |
                    Q(mobile_number__icontains=contact_number) |
                    Q(email__icontains=email)
                )
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
        elif user.user_type == "Doctor":
            if patient_ids:
                patients = Patient.objects.filter(patient_id__in=patient_ids, appointments__doctor=user.doctor).distinct()
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(doctor=user.doctor, patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
            elif doctor_id and str(user.doctor.id) == doctor_id:
                appointments = Appointment.objects.filter(doctor=user.doctor).prefetch_related('vitals')
                patient_ids_from_appts = appointments.values_list('patient__patient_id', flat=True)
                patients = Patient.objects.filter(patient_id__in=patient_ids_from_appts)
            elif first_name:
                patients = Patient.objects.filter(Q(appointments__doctor=user.doctor) & Q(first_name__iexact=first_name)).distinct()
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(doctor=user.doctor, patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
            elif contact_number:
                patients = Patient.objects.filter(Q(appointments__doctor=user.doctor) & Q(mobile_number__icontains=contact_number)).distinct()
                patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                appointments = Appointment.objects.filter(doctor=user.doctor, patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
            elif date_of_birth:
                try:
                    dob = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
                    patients = Patient.objects.filter(Q(appointments__doctor=user.doctor) & Q(date_of_birth=dob)).distinct()
                    patient_ids_from_patients = patients.values_list('patient_id', flat=True)
                    appointments = Appointment.objects.filter(doctor=user.doctor, patient__patient_id__in=patient_ids_from_patients).prefetch_related('vitals')
                except ValueError:
                    logger.error(f"Invalid date_of_birth format: {date_of_birth}")
                    return {"patients": [], "appointments": []}
            elif appointment_date:
                try:
                    apt_date = datetime.strptime(appointment_date, "%Y-%m-%d").date()
                    appointments = Appointment.objects.filter(doctor=user.doctor, appointment_date__date=apt_date).prefetch_related('vitals')
                    patient_ids_from_appts = appointments.values_list('patient__patient_id', flat=True)
                    patients = Patient.objects.filter(patient_id__in=patient_ids_from_appts)
                except ValueError:
                    logger.error(f"Invalid appointment_date format: {appointment_date}")
                    return {"patients": [], "appointments": []}

        results = {"patients": list(patients), "appointments": list(appointments)}
        logger.info(f"Total search results fetched for user {user.id}: {sum(len(v) for v in results.values())}")
        cache.set(cache_key, results, timeout=60)
        return results

    def list(self, request, *args, **kwargs):
        search_results = self.get_queryset()
        if isinstance(search_results, dict):
            paginated_results = {
                "patients": self.paginate_queryset(search_results.get("patients", [])),
                "appointments": self.paginate_queryset(search_results.get("appointments", []))
            }
        else:
            paginated_results = {"patients": self.paginate_queryset(search_results)}

        response_data = {
            "patients": PatientSerializer(paginated_results.get("patients", []), many=True).data if paginated_results.get("patients") else [],
            "appointments": AppointmentSerializer(paginated_results.get("appointments", []), many=True).data if paginated_results.get("appointments") else [],
        }
        return Response(response_data)
    
## list appointments based on date
class AppointmentListByDateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        date_str = request.query_params.get('date', None)
        logger.info(f"User {user.username} requesting appointments for date: {date_str}")

        if not user.has_perm('appointments.view_appointment'):
            raise PermissionDenied("You do not have permission to view appointments.")

        if not date_str:
            return Response({"error": "Date parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            date_filter = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "Invalid date format. Use 'YYYY-MM-DD'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if user.user_type == "Doctor":
                appointments = Appointment.objects.filter(
                    doctor=user.doctor,
                    appointment_date__date=date_filter
                )
            elif user.user_type in ["Receptionist", "Nurse"] or user.is_superuser:
                appointments = Appointment.objects.filter(
                    appointment_date__date=date_filter
                )
            else:
                return Response({"error": "Unauthorized role."}, status=status.HTTP_403_FORBIDDEN)

            serializer = AppointmentSerializer(appointments, many=True)
            logger.info(f"Fetched {appointments.count()} appointments for {date_filter}")
            return Response({"appointments": serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching appointments: {str(e)}", exc_info=True)
            return Response({"error": "An error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

class GetPatientDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id):
        user = request.user
        if not user.has_perm('appointments.view_appointment'):
            logger.warning(f"Unauthorized patient details access by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("You do not have permission to view patient details.")

        try:
            patient = Patient.objects.get(patient_id=patient_id)
            if user.user_type == "Doctor" and not patient.appointments.filter(doctor=user.doctor).exists():
                logger.warning(f"Doctor {user.username} attempted to access patient {patient_id} not assigned to them.")
                raise PermissionDenied("You can only view details of your patients.")
            return Response({"patient": PatientSerializer(patient).data}, status=status.HTTP_200_OK)
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)


class PatientHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id):
        user = request.user
        if not user.has_perm('appointments.view_appointment'):
            logger.warning(f"Unauthorized patient history access by {user.username} ({user.user_type} - {user.role_level})")
            raise PermissionDenied("You do not have permission to view patient history.")

        try:
            patient = get_object_or_404(Patient, patient_id=patient_id)
            if user.user_type == "Doctor" and not patient.appointments.filter(doctor=user.doctor).exists():
                logger.warning(f"Doctor {user.username} attempted to access history of patient {patient_id} not assigned to them.")
                raise PermissionDenied("You can only view history of your patients.")

            patient_history = patient.history.all().order_by('-history_date')
            appointment_history = []
            vitals_history = []
            for appt in patient.appointments.all():
                appointment_history.extend(appt.history.all())
                if hasattr(appt, 'vitals'):
                    vitals_history.extend(appt.vitals.history.all())

            history_data = []
            for record in patient_history:
                history_data.append({
                    'changed_at': record.history_date,
                    'changed_by': record.history_user.username if record.history_user else 'N/A',
                    'change_type': record.history_type,
                    'changes': record.diff_against(record.prev_record).changes if record.prev_record else [],
                    'model': 'Patient',
                })
            for record in appointment_history:
                history_data.append({
                    'changed_at': record.history_date,
                    'changed_by': record.history_user.username if record.history_user else 'N/A',
                    'change_type': record.history_type,
                    'changes': record.diff_against(record.prev_record).changes if record.prev_record else [],
                    'model': 'Appointment',
                    'appointment_id': record.id,
                })
            for record in vitals_history:
                history_data.append({
                    'changed_at': record.history_date,
                    'changed_by': record.history_user.username if record.history_user else 'N/A',
                    'change_type': record.history_type,
                    'changes': record.diff_against(record.prev_record).changes if record.prev_record else [],
                    'model': 'Vitals',
                    'appointment_id': record.appointment_id,
                })

            history_data.sort(key=lambda x: x['changed_at'], reverse=True)
            logger.info(f"History fetched for patient {patient_id} by {user.username}")
            return Response({'history': history_data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching history for patient {patient_id}: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        
    # views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .serializers import CreatePatientAndAppointmentSerializer, PatientSerializer, AppointmentSerializer
from .models import Patient, Appointment
from users.models import Receptionist, Doctor
import logging

logger = logging.getLogger(__name__)

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
            }

            patient_serializer = PatientSerializer(data=patient_data)
            if patient_serializer.is_valid():
                patient = patient_serializer.save()
                logger.info(f"Patient created: {patient.patient_id}")

                # Create appointment data matching serializer fields
                appointment_data = {
                    'patient_id': patient.patient_id,  # String, matches serializer
                    'doctor_id': serializer.validated_data.get('doctor').id if serializer.validated_data.get('doctor') else None,  # Integer or None, matches serializer
                    'appointment_date': serializer.validated_data['appointment_date'],
                    'notes': serializer.validated_data.get('notes', ''),
                    'is_emergency': serializer.validated_data.get('is_emergency', False),
                    'status': 'scheduled',
                }

                # Set receptionist if applicable
                try:
                    receptionist = Receptionist.objects.get(user=request.user)
                    appointment_data['receptionist'] = receptionist
                except Receptionist.DoesNotExist:
                    appointment_data['receptionist'] = None

                # Pass request context for created_by
                appointment_serializer = AppointmentSerializer(data=appointment_data, context={'request': request})
                if appointment_serializer.is_valid():
                    appointment = appointment_serializer.save()
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