from django.shortcuts import render
from django.http import JsonResponse
from users.models import User, Receptionist, Doctor
from appointments.models import Patient, Appointment
from django.contrib.auth.models import Permission
from django.core.exceptions import ObjectDoesNotExist

# Fetch the currently logged-in user's details
def get_user_details(request):
    try:
        user = request.user  # Get the current logged-in user
        user_details = {
            'username': user.username,
            'email': user.email,
            'user_type': user.user_type,
            'permissions': [perm.name for perm in user.user_permissions.all()],
        }

        # Add details based on user type
        if user.user_type == 'Receptionist':
            try:
                receptionist = Receptionist.objects.get(user=user)
                user_details.update({
                    'first_name': receptionist.first_name,
                    'last_name': receptionist.last_name,
                    'contact_number': receptionist.contact_number,
                    'email': receptionist.email,
                })
            except Receptionist.DoesNotExist:
                user_details['receptionist_details'] = 'Not available'
        
        elif user.user_type == 'Doctor':
            try:
                doctor = Doctor.objects.get(user=user)
                user_details.update({
                    'first_name': doctor.first_name,
                    'last_name': doctor.last_name,
                    'specialization': doctor.specialization,
                    'contact_number': doctor.contact_number,
                    'email': doctor.email,
                })
            except Doctor.DoesNotExist:
                user_details['doctor_details'] = 'Not available'

        # Return user details as JSON response
        return JsonResponse(user_details)

    except ObjectDoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)


# Fetch appointments for the logged-in patient (if any)
def get_patient_appointments(request):
    try:
        patient = Patient.objects.get(user=request.user)  # Assuming user has a Patient object linked
        appointments = Appointment.objects.filter(patient=patient).values(
            'doctor__user__username', 'status', 'appointment_date', 'notes', 'is_emergency'
        )
        return JsonResponse({'patient_appointments': list(appointments)})

    except ObjectDoesNotExist:
        return JsonResponse({'error': 'Patient not found or not linked to user'}, status=404)

# Fetch doctor appointments for the logged-in doctor
def get_doctor_appointments(request):
    try:
        doctor = Doctor.objects.get(user=request.user)  # Fetching doctor linked to the logged-in user
        appointments = Appointment.objects.filter(doctor=doctor).values(
            'patient__first_name', 'patient__last_name', 'status', 'appointment_date', 'notes', 'is_emergency'
        )
        return JsonResponse({'doctor_appointments': list(appointments)})

    except ObjectDoesNotExist:
        return JsonResponse({'error': 'Doctor not found or not linked to user'}, status=404)
