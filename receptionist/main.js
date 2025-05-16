// main.js (Receptionist Dashboard)

// Configurable Constants
const CONFIG = {
  API_BASE_URL: window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'http://smarthospitalmaintain.com:8000',
  CITY_API_URL: 'https://raw.githubusercontent.com/nshntarora/indian-cities-json/master/cities.json',
  FALLBACK_CITIES: [
    { name: 'Mumbai', state: 'Maharashtra' },
    { name: 'Delhi', state: 'Delhi' },
    { name: 'Bengaluru', state: 'Karnataka' },
    { name: 'Chennai', state: 'Tamil Nadu' },
    { name: 'Kolkata', state: 'West Bengal' },
    { name: 'Rajkot', state: 'Gujarat' },
    { name: 'Bhopal', state: 'Madhya Pradesh' }
  ],
  VALID_ROLES: ['receptionist-senior', 'receptionist-medium', 'receptionist-basic']
};

// Global Variables
let indianCities = [];
let isFetchingCities = false;
let selectedPatientId = null;
let appointmentsData = [];

// Utility: Log Errors
function logError(context, xhr, customMessage = '') {
  const errorMsg = `[${context}] Error: ${xhr.status} - ${xhr.responseJSON?.error || xhr.statusText} ${customMessage}`;
  console.error(errorMsg);
  return errorMsg;
}

// Utility: Debounce
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Utility: Format Date to YYYY-MM-DD
function formatDateToYYYYMMDD(date) {
  return date.toISOString().split('T')[0]; // e.g., "2025-05-16"
}

// Utility: Format Date to Readable String
function formatDateTimeReadable(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date); // e.g., "May 16, 2025 9:36 AM"
}

// Utility: Format Time to HH:mm
function formatTimeHHMM(date) {
  return date.toTimeString().slice(0, 5); // e.g., "09:36"
}

// Utility: Validate YYYY-MM-DD
function isValidDateFormat(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// Authentication: Get Headers
function getAuthHeaders() {
  const token = sessionStorage.getItem('token');
  if (!token) console.warn('[getAuthHeaders] No token found');
  return token ? { Authorization: `Token ${token}` } : {};
}

// Authentication: Check
function checkAuthentication() {
  const token = sessionStorage.getItem('token');
  const userType = sessionStorage.getItem('user_type')?.toLowerCase();
  const roleLevel = sessionStorage.getItem('role_level')?.toLowerCase();
  const permissions = sessionStorage.getItem('permissions');

  console.log('[checkAuthentication] Session:', { token: !!token, userType, roleLevel, permissions: !!permissions });

  if (!token || !userType || !roleLevel || !permissions) {
    console.error('[checkAuthentication] Missing session data');
    alert('Authentication failed: Missing data. Please log in.');
    window.location.href = '../login/login.html';
    return false;
  }

  if (userType !== 'receptionist') {
    console.error('[checkAuthentication] Non-receptionist user:', userType);
    alert('Access restricted: This dashboard is for receptionists only.');
    window.location.href = '../login/login.html';
    return false;
  }

  $.ajax({
    url: `${CONFIG.API_BASE_URL}/users/profile/`,
    type: 'GET',
    headers: getAuthHeaders(),
    success: function (data) {
      console.log('[checkAuthentication] Profile:', data);
      const role = `${userType}-${roleLevel}`;
      if (!CONFIG.VALID_ROLES.includes(role)) {
        console.error('[checkAuthentication] Invalid role:', role);
        alert('Invalid receptionist role.');
        window.location.href = '../login/login.html';
        return;
      }
      adjustUIForRole(userType, roleLevel, data.username || 'Unknown User');
      const todayStr = formatDateToYYYYMMDD(new Date());
      fetchAppointmentsByDate(todayStr);
    },
    error: function (xhr) {
      logError('checkAuthentication', xhr);
      sessionStorage.clear();
      alert('Authentication failed: Invalid token.');
      window.location.href = '../login/login.html';
    }
  });
  return true;
}

// UI: Adjust for Role
function adjustUIForRole(userType, roleLevel, username) {
  console.log(`[adjustUIForRole] User: ${username}, Role: ${userType}-${roleLevel}`);
  $('#dashboardType').text('Receptionist Dashboard');
  $('#usernameDisplay').text(username);

  const role = `${userType}-${roleLevel}`.toLowerCase();
  const $navItems = $('.navbar-top .nav-item');
  const $secondaryNav = $('.navbar-secondary .nav-item');
  const $buttons = $('.navbar-top .btn, .navbar-secondary .btn');
  const $searchInput = $('.patient-search');
  const $dateFilter = $('#dateFilter');
  const $dashboardDropdown = $('#dashboardDropdown').parent();
  const $modalTabs = $('#newActionTabs .nav-item');

  $navItems.show();
  $secondaryNav.show();
  $buttons.show();
  $searchInput.show();
  $dateFilter.show();
  $dashboardDropdown.show();
  $modalTabs.show();

  switch (role) {
    case 'receptionist-senior':
      $navItems.filter(':contains("Add Services"), :contains("Tele Consults")').hide();
      $modalTabs.filter(':contains("Add Service")').hide();
      $secondaryNav.filter(':contains("On-Going"), :contains("Reviewed")').hide();
      $('.navbar-secondary .btn-circle').not(':contains("Filter")').hide();
      $dashboardDropdown.hide();
      break;
    case 'receptionist-medium':
      $navItems.filter(':contains("Add Services"), :contains("Tele Consults")').hide();
      $modalTabs.filter(':contains("Add Service"), :contains("Add Bills")').hide();
      $buttons.filter(':contains("Support")').hide();
      $secondaryNav.filter(':contains("On-Going"), :contains("Reviewed")').hide();
      $('.navbar-secondary .btn-circle').hide();
      $dashboardDropdown.hide();
      break;
    case 'receptionist-basic':
      $navItems.filter(':contains("All Bills"), :contains("Add Services"), :contains("Tele Consults")').hide();
      $modalTabs.filter(':contains("Add Service"), :contains("Add Bills")').hide();
      $buttons.hide();
      $searchInput.hide();
      $dateFilter.hide();
      $secondaryNav.filter(':contains("Arrived"), :contains("On-Going"), :contains("Reviewed")').hide();
      $dashboardDropdown.hide();
      break;
    default:
      console.error('[adjustUIForRole] Unknown role:', role);
      alert('Unknown role. Access restricted.');
      $navItems.hide();
      $secondaryNav.hide();
      $buttons.hide();
      $modalTabs.hide();
      window.location.href = '../login/login.html';
  }
}

// Appointments: Fetch
function fetchAppointmentsByDate(dateStr = null, filter = 'all') {
  const todayStr = formatDateToYYYYMMDD(new Date());
  const selectedDate = dateStr || todayStr;

  console.log(`[fetchAppointmentsByDate] Fetching for date: ${selectedDate}, Filter: ${filter}`);
  $('#dateFilter').val(selectedDate).trigger('input');

  $.ajax({
    url: `${CONFIG.API_BASE_URL}/appointments/list/?date=${selectedDate}`,
    type: 'GET',
    headers: getAuthHeaders(),
    success: function (data) {
      appointmentsData = Array.isArray(data.appointments) ? data.appointments : [];
      console.log(`[fetchAppointmentsByDate] Fetched ${appointmentsData.length} appointments`);
      const statusMap = {
        all: ['booked', 'arrived', 'on-going', 'reviewed', 'scheduled'],
        booked: ['booked'],
        arrived: ['arrived'],
        'on-going': ['on-going'],
        reviewed: ['reviewed'],
        scheduled: ['scheduled']
      };
      const allowedStatuses = statusMap[filter.toLowerCase()] || statusMap['all'];
      const filteredAppointments = appointmentsData.filter(appt =>
        appt?.status && allowedStatuses.includes(appt.status.toLowerCase())
      );
      populateAppointmentsTable(filteredAppointments, selectedDate);
      markAppointmentsForDate(selectedDate);
    },
    error: function (xhr) {
      logError('fetchAppointmentsByDate', xhr);
      alert('Failed to fetch appointments.');
      populateAppointmentsTable([], selectedDate);
    }
  });
}

// Appointments: Populate Table
function populateAppointmentsTable(appointments, dateStr) {
  const $tableBody = $('#appointmentsTableBody');
  if (!$tableBody.length) {
    console.error('[populateAppointmentsTable] Table body not found');
    alert('Error: Table not found.');
    return;
  }
  $tableBody.empty();

  if (!isValidDateFormat(dateStr)) {
    $tableBody.html('<tr><td colspan="6" class="text-center">Invalid date selected.</td></tr>');
    return;
  }

  const filteredAppointments = appointments.filter(appt => {
    if (!appt?.appointment_date) return false;
    const apptDate = new Date(appt.appointment_date);
    return formatDateToYYYYMMDD(apptDate) === dateStr;
  });

  if (!filteredAppointments.length) {
    $tableBody.html(`<tr><td colspan="6" class="text-center">No appointments for ${dateStr}.</td></tr>`);
    return;
  }

  filteredAppointments.sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));

  filteredAppointments.forEach(appt => {
    const apptDate = new Date(appt.appointment_date);
    const time = formatTimeHHMM(apptDate);
    const patientName = appt.patient?.first_name
      ? `${appt.patient.first_name} ${appt.patient.last_name || ''}`
      : 'Unnamed';
    const doctorName = appt.doctor?.first_name
      ? `${appt.doctor.first_name} ${appt.doctor.last_name || ''}`
      : 'N/A';
    const statusClass = appt.status ? `status-${appt.status.toLowerCase().replace(/\s+/g, '-')}` : 'status-unknown';

    const $row = $(`
      <tr>
        <td>${time}</td>
        <td>${patientName}</td>
        <td>${doctorName}</td>
        <td><span class="${statusClass}">${appt.status.toUpperCase()}</span></td>
        <td>${appt.notes || 'N/A'}</td>
        <td><button class="btn btn-primary btn-sm view-details" data-appointment-id="${appt.id}">View</button></td>
      </tr>
    `);
    $tableBody.append($row);
  });

  $('.view-details').off('click').on('click', function () {
    showAppointmentDetails($(this).data('appointment-id'));
  });

  console.log(`[populateAppointmentsTable] Populated ${filteredAppointments.length} appointments for ${dateStr}`);
}

// Appointments: Mark Dates
function markAppointmentsForDate(dateStr) {
  const $dateFilter = $('#dateFilter');
  $dateFilter.removeAttr('data-appointment-times').removeClass('has-appointment');

  const appointmentTimes = appointmentsData
    .filter(appt => {
      if (!appt?.appointment_date) return false;
      const apptDate = new Date(appt.appointment_date);
      return formatDateToYYYYMMDD(apptDate) === dateStr;
    })
    .map(appt => formatTimeHHMM(new Date(appt.appointment_date)));

  if (appointmentTimes.length) {
    $dateFilter.addClass('has-appointment').attr('data-appointment-times', appointmentTimes.join(', '));
    console.log(`[markAppointmentsForDate] Marked ${appointmentTimes.length} appointments for ${dateStr}`);
  }
}

// Appointments: Show Details
function showAppointmentDetails(appointmentId) {
  console.log(`[showAppointmentDetails] Fetching ID: ${appointmentId}`);
  $.ajax({
    url: `${CONFIG.API_BASE_URL}/appointments/list/?appointment_id=${appointmentId}`,
    type: 'GET',
    headers: getAuthHeaders(),
    success: function (response) {
      if (!response.appointments?.length) {
        console.warn('[showAppointmentDetails] No appointment details found for ID:', appointmentId);
        alert('No appointment details found.');
        return;
      }
      const appt = response.appointments[0];
      const patientName = appt.patient?.first_name
        ? `${appt.patient.first_name} ${appt.patient.last_name || ''}`
        : 'Unnamed';
      const doctorName = appt.doctor?.first_name
        ? `${appt.doctor.first_name} ${appt.doctor.last_name || ''}`
        : 'N/A';
      const formattedDate = formatDateTimeReadable(new Date(appt.appointment_date));

      const modalHtml = `
        <div class="modal fade" id="appointmentDetailsModal" tabindex="-1" aria-labelledby="appointmentDetailsModalLabel">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Appointment ID: ${appointmentId}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <p><strong>Patient:</strong> ${patientName}</p>
                <p><strong>Doctor:</strong> ${doctorName}</p>
                <p><strong>Date & Time:</strong> ${formattedDate}</p>
                <p><strong>Status:</strong> ${appt.status?.toUpperCase() || 'N/A'}</p>
                <p><strong>Notes:</strong> ${appt.notes || 'None'}</p>
                <p><strong>Illness:</strong> ${appt.patient?.current_medications || 'None'}</p>
                <p><strong>Emergency:</strong> ${appt.is_emergency ? 'Yes' : 'No'}</p>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" onclick="editAppointment(${appointmentId})">Edit</button>
              </div>
            </div>
          </div>
        </div>
      `;

      $('#appointmentDetailsModal').remove();
      $('body').append(modalHtml);
      const modal = new bootstrap.Modal('#appointmentDetailsModal', { backdrop: 'static' });
      modal.show();

      $('#appointmentDetailsModal').on('hidden.bs.modal', function () {
        $(this).remove();
      });
      console.log(`[showAppointmentDetails] Displayed details for ID: ${appointmentId}`);
    },
    error: function (xhr) {
      logError('showAppointmentDetails', xhr);
      alert('Failed to load appointment details.');
    }
  });
}

// Appointments: Edit
function editAppointment(appointmentId) {
  console.log(`[editAppointment] Fetching appointment ID: ${appointmentId}`);
  $.ajax({
    url: `${CONFIG.API_BASE_URL}/appointments/edit/${appointmentId}/`,
    type: 'GET',
    headers: getAuthHeaders(),
    success: function (appt) {
      const apptDate = new Date(appt.appointment_date);
      const modal = $(`
        <div class="modal fade" id="editAppointmentModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Edit Appointment</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label for="editApptDate" class="form-label">Date</label>
                  <input type="text" class="form-control" id="editApptDate" value="${formatDateToYYYYMMDD(apptDate)}">
                  <div class="invalid-feedback">Use YYYY-MM-DD format.</div>
                </div>
                <div class="mb-3">
                  <label for="editApptTime" class="form-label">Time (HH:mm, 24hr)</label>
                  <input type="text" class="form-control" id="editApptTime" value="${formatTimeHHMM(apptDate)}">
                  <div class="invalid-feedback">Use HH:mm format.</div>
                </div>
                <div class="mb-3">
                  <label for="editApptDoctor" class="form-label">Doctor</label>
                  <select class="form-select" id="editApptDoctor"></select>
                </div>
                <div class="mb-3">
                  <label for="editApptStatus" class="form-label">Status</label>
                  <select class="form-select" id="editApptStatus">
                    <option value="booked" ${appt.status.toLowerCase() === 'booked' ? 'selected' : ''}>Booked</option>
                    <option value="arrived" ${appt.status.toLowerCase() === 'arrived' ? 'selected' : ''}>Arrived</option>
                    <option value="on-going" ${appt.status.toLowerCase() === 'on-going' ? 'selected' : ''}>On-Going</option>
                    <option value="reviewed" ${appt.status.toLowerCase() === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                  </select>
                </div>
                <div class="mb-3">
                  <label for="editApptNotes" class="form-label">Notes</label>
                  <textarea class="form-control" id="editApptNotes">${appt.notes || ''}</textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary save-appointment" data-appointment-id="${appt.id}">Save</button>
              </div>
            </div>
          </div>
        </div>
      `);

      $('body').append(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();

      $('#editApptDate').datepicker({ format: 'yyyy-mm-dd', autoclose: true });
      $('#editApptDate').on('input', function () {
        $(this).toggleClass('is-invalid', !/^\d{4}-\d{2}-\d{2}$/.test($(this).val()));
      });
      $('#editApptTime').on('input', function () {
        $(this).toggleClass('is-invalid', !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test($(this).val()));
      });

      populateDoctorDropdown('editApptDoctor');
      $('#editApptDoctor').val(appt.doctor?.id || '');

      modal.find('.save-appointment').on('click', function () {
        const date = $('#editApptDate').val();
        const time = $('#editApptTime').val();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
          alert('Please enter valid date (YYYY-MM-DD) and time (HH:mm).');
          return;
        }
        const dateTime = new Date(`${date}T${time}:00+05:30`);
        if (isNaN(dateTime.getTime())) {
          alert('Invalid date or time format.');
          return;
        }
        const updatedData = {
          appointment_date: dateTime.toISOString(),
          doctor_id: $('#editApptDoctor').val(),
          status: $('#editApptStatus').val(),
          notes: $('#editApptNotes').val()
        };

        $.ajax({
          url: `${CONFIG.API_BASE_URL}/appointments/edit/${appointmentId}/`,
          type: 'PATCH',
          headers: getAuthHeaders(),
          data: JSON.stringify(updatedData),
          contentType: 'application/json',
          success: function () {
            console.log(`[editAppointment] Updated ID: ${appointmentId}`);
            alert('Appointment updated successfully!');
            bsModal.hide();
            fetchAppointmentsByDate(formatDateToYYYYMMDD(new Date()));
          },
          error: function (xhr) {
            logError('editAppointment', xhr);
            alert('Failed to update appointment.');
          }
        });
      });

      modal.on('hidden.bs.modal', function () {
        modal.remove();
      });
    },
    error: function (xhr) {
      logError('editAppointment', xhr);
      alert('Failed to fetch appointment details.');
    }
  });
}

// Patient Search: Setup
function setupPatientSearch() {
  const $searchInput = $('.patient-search');
  if (!$searchInput.length) {
    console.error('[setupPatientSearch] Search input not found');
    return;
  }

  if (!$.fn.select2) {
    console.error('[setupPatientSearch] Select2 library is not loaded');
    alert('Patient search functionality is unavailable. Please contact support.');
    return;
  }

  console.log('[setupPatientSearch] Initializing Select2 for patient search');
  $searchInput.select2({
    placeholder: 'Search Patient',
    allowClear: true,
    minimumInputLength: 2,
    ajax: {
      url: `${CONFIG.API_BASE_URL}/patients/search/`,
      type: 'GET',
      headers: getAuthHeaders(),
      delay: 500,
      data: params => {
        console.log('[setupPatientSearch] Search query:', params.term);
        return { query: params.term };
      },
      processResults: data => {
        const results = data.patients?.map(patient => ({
          id: patient.patient_id,
          text: `${patient.first_name} ${patient.last_name || ''} (ID: ${patient.patient_id})`
        })) || [];
        console.log('[setupPatientSearch] Search results:', results);
        return { results };
      },
      error: xhr => {
        logError('setupPatientSearch', xhr, 'Patient search failed');
        alert('Failed to search patients.');
        return { results: [] };
      }
    }
  });

  $searchInput.on('select2:select', e => {
    selectedPatientId = e.params.data.id;
    console.log(`[setupPatientSearch] Selected patient ID: ${selectedPatientId}`);
    fetchPatientDetails(selectedPatientId, 'profileTab');
  });

  $searchInput.on('select2:clear', () => {
    selectedPatientId = null;
    console.log('[setupPatientSearch] Cleared patient selection');
    updateDetailsSection(null);
    resetModalView();
  });
}

// Patient: Fetch Details
function fetchPatientDetails(patientId, targetTab = 'profileTab') {
  console.log(`[fetchPatientDetails] Fetching details for patient ID: ${patientId}`);
  $.ajax({
    url: `${CONFIG.API_BASE_URL}/patients/patients/${patientId}/`,
    type: 'GET',
    headers: getAuthHeaders(),
    success: function (data) {
      const patient = data.patient || data;
      selectedPatientId = patient.patient_id;
      populateProfileTab(patient);
      populateAddPatientForm(patient);
      updateDetailsSection(patient);
      $('#newActionModal').modal('show');
      $(`#${targetTab}`).tab('show');
      console.log(`[fetchPatientDetails] Loaded patient ID: ${patientId}`, patient);
    },
    error: function (xhr) {
      logError('fetchPatientDetails', xhr);
      alert('Failed to load patient details.');
    }
  });
}

// Patient: Update Details Section
function updateDetailsSection(patient) {
  const $title = $('#detailsTitle');
  const $meta = $('#detailsMeta');
  const $visitPadBtn = $('#visitPadBtn');

  if (patient?.patient_id) {
    const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    const dob = patient.date_of_birth ? new Date(patient.date_of_birth) : null;
    const age = dob && !isNaN(dob.getTime()) ? Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 'N/A';
    $title.text(fullName || 'Unnamed');
    $meta.text(`${patient.gender || 'N/A'} | ${age} Years | ${patient.patient_id}`);
    $visitPadBtn.show();
    console.log(`[updateDetailsSection] Updated details for patient: ${fullName}`);
  } else {
    $title.text('No Patient Selected');
    $meta.text('N/A | N/A | N/A');
    $visitPadBtn.hide();
    console.log('[updateDetailsSection] No patient selected');
  }
}

// Patient: Populate Profile Tab
function populateProfileTab(patient) {
  const fields = [
    'first_name', 'last_name', 'mobile_number:phone', 'gender', 'date_of_birth:dob',
    'preferred_language', 'father_name', 'marital_status', 'payment_preference',
    'city', 'address', 'pincode:pin', 'marital_since', 'blood_group', 'referred_by',
    'channel', 'cio', 'occupation', 'tag', 'alternate_mobile_number:mobile2',
    'aadhar_number', 'known_allergies', 'current_medications', 'past_medical_history',
    'specific_notes', 'emergency_contact_name', 'emergency_contact_relationship',
    'emergency_contact_number', 'insurance_provider', 'policy_number', 'admission_type',
    'hospital_code'
  ];

  fields.forEach(field => {
    let [apiField, formField = apiField] = field.split(':');
    const $input = $(`#profile${formField.charAt(0).toUpperCase() + formField.slice(1)}`);
    if ($input.length) {
      $input.val(patient[apiField] || '');
    }
  });

  $('#profileCity, #profileAddress, #profilePin').prop('readonly', true);

  if (!$('#toggleProfileEdit').length) {
    const $editButton = $('<button class="btn btn-sm btn-outline-primary ms-2" id="toggleProfileEdit">Edit</button>');
    $('#profileCity').closest('.input-group').append($editButton);

    $editButton.on('click', function () {
      const $fields = $('#profileCity, #profileAddress, #profilePin');
      const isReadonly = $fields.prop('readonly');
      $fields.prop('readonly', !isReadonly);
      $(this).text(isReadonly ? 'Save' : 'Edit');
      if (!isReadonly) {
        $.ajax({
          url: `${CONFIG.API_BASE_URL}/patients/patients/${selectedPatientId}/`,
          type: 'PATCH',
          headers: getAuthHeaders(),
          data: JSON.stringify({
            city: $('#profileCity').val(),
            address: $('#profileAddress').val(),
            pincode: $('#profilePin').val()
          }),
          contentType: 'application/json',
          success: () => {
            console.log(`[toggleProfileEdit] Address updated for patient ID: ${selectedPatientId}`);
            alert('Address updated successfully!');
          },
          error: xhr => {
            logError('toggleProfileEdit', xhr);
            alert('Failed to update address.');
          }
        });
      }
      console.log(`[toggleProfileEdit] Toggled edit mode: ${isReadonly ? 'Editing' : 'Saved'}`);
    });
  }

  setupCityAutocomplete('profileCity');
  console.log('[populateProfileTab] Populated profile tab for patient ID:', patient.patient_id);
}

// Patient: Populate Add Patient Form
function populateAddPatientForm(patient, appointment = null) {
  const fields = [
    'first_name', 'last_name', 'mobile_number:patientPhone', 'gender:patientGender',
    'date_of_birth:patientDOB', 'preferred_language', 'father_name', 'marital_status',
    'payment_preference', 'city:patientCity', 'address:patientAddress', 'pincode:patientPin',
    'marital_since', 'blood_group', 'referred_by', 'channel', 'cio', 'occupation', 'tag',
    'alternate_mobile_number:mobile2', 'aadhar_number', 'known_allergies',
    'current_medications', 'past_medical_history', 'specific_notes',
    'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_number',
    'insurance_provider', 'policy_number', 'admission_type', 'hospital_code'
  ];

  fields.forEach(field => {
    let [apiField, formField = apiField] = field.split(':');
    const $input = $(`#${formField}`);
    if ($input.length) {
      $input.val(patient[apiField] || '');
    }
  });

  if (appointment) {
    const apptDate = new Date(appointment.appointment_date);
    $('#appointmentDate').val(`${formatDateToYYYYMMDD(apptDate)} ${formatTimeHHMM(apptDate)}`);
    $('#doctor').val(appointment.doctor?.id || '');
    $('#doctorSpecialty').val(appointment.doctor?.specialization || '');
    $('#appointmentNotes').val(appointment.notes || '');
  }

  $('#addPatientForm').data('edit-mode', !!patient.patient_id)
    .data('patient-id', patient.patient_id)
    .data('appointment-id', appointment?.id || null);

  console.log('[populateAddPatientForm] Populated form for patient ID:', patient.patient_id || 'new patient');
}

// Cities: Fetch
function fetchIndianCities(attempt = 1, maxAttempts = 3) {
  if (isFetchingCities) {
    console.log('[fetchIndianCities] Fetch already in progress, skipping');
    return;
  }
  isFetchingCities = true;
  console.log(`[fetchIndianCities] Attempt ${attempt} to fetch cities from ${CONFIG.CITY_API_URL}`);

  $.ajax({
    url: CONFIG.CITY_API_URL,
    type: 'GET',
    cache: true,
    timeout: 5000,
    success: function (data) {
      if (!Array.isArray(data)) {
        console.error('[fetchIndianCities] Response is not an array:', data);
        indianCities = CONFIG.FALLBACK_CITIES;
      } else {
        indianCities = data.map(city => ({
          name: city.name.trim(),
          state: city.state?.trim() || ''
        })) || CONFIG.FALLBACK_CITIES;
      }
      console.log(`[fetchIndianCities] Successfully loaded ${indianCities.length} cities`);
      isFetchingCities = false;
      setupCityAutocomplete('patientCity');
      setupCityAutocomplete('profileCity');
    },
    error: function (xhr) {
      logError('fetchIndianCities', xhr, `Attempt ${attempt} failed`);
      isFetchingCities = false;
      if (attempt < maxAttempts) {
        console.log(`[fetchIndianCities] Retrying, attempt ${attempt + 1}`);
        setTimeout(() => fetchIndianCities(attempt + 1, maxAttempts), 1000);
      } else {
        console.warn('[fetchIndianCities] All attempts failed, using fallback cities');
        indianCities = CONFIG.FALLBACK_CITIES;
        setupCityAutocomplete('patientCity');
        setupCityAutocomplete('profileCity');
      }
    }
  });
}

// Cities: Autocomplete
function setupCityAutocomplete(inputId) {
  const $input = $(`#${inputId}`);
  if (!$input.length) {
    console.error(`[setupCityAutocomplete] Input #${inputId} not found`);
    return;
  }
  if (!$.fn.autocomplete) {
    console.warn(`[setupCityAutocomplete] jQuery UI Autocomplete unavailable, using plain input for #${inputId}`);
    $input.attr('list', `${inputId}-datalist`);
    const $datalist = $(`<datalist id="${inputId}-datalist"></datalist>`);
    indianCities.forEach(city => {
      $datalist.append(`<option value="${city.name}, ${city.state}">`);
    });
    $input.after($datalist);
    return;
  }
  console.log(`[setupCityAutocomplete] Setting up autocomplete for #${inputId}, cities available: ${indianCities.length}`);
  $input.autocomplete({
    source: function (request, response) {
      const term = request.term.toLowerCase();
      const matches = indianCities
        .filter(city => city.name.toLowerCase().includes(term))
        .map(city => `${city.name}, ${city.state}`);
      console.log(`[setupCityAutocomplete] Search term: ${term}, matches found: ${matches.length}`);
      response(matches);
    },
    minLength: 2,
    select: function (event, ui) {
      $input.val(ui.item.value.split(',')[0].trim());
      console.log(`[setupCityAutocomplete] Selected city: ${ui.item.value} for #${inputId}`);
      return false;
    },
    open: function () {
      console.log(`[setupCityAutocomplete] Autocomplete dropdown opened for #${inputId}`);
    },
    close: function () {
      console.log(`[setupCityAutocomplete] Autocomplete dropdown closed for #${inputId}`);
    }
  });
}

// Doctors: Populate Dropdown
function populateDoctorDropdown(selectId, specialtyId = null) {
  const $select = $(`#${selectId}`);
  $select.empty().append('<option value="" disabled selected>Select Doctor</option>');

  console.log(`[populateDoctorDropdown] Fetching doctors for #${selectId}`);
  $.ajax({
    url: `${CONFIG.API_BASE_URL}/appointments/doctors/list/`,
    type: 'GET',
    headers: getAuthHeaders(),
    success: function (data) {
      const doctors = Array.isArray(data.doctors) ? data.doctors : [];
      doctors.forEach(doctor => {
        if (doctor.id && doctor.first_name) {
          $select.append(`<option value="${doctor.id}" data-specialty="${doctor.specialization || ''}">${doctor.first_name} ${doctor.last_name || ''}</option>`);
        }
      });
      if (specialtyId) {
        $select.on('change', function () {
          $(`#${specialtyId}`).val($(this).find('option:selected').data('specialty') || '');
          console.log(`[populateDoctorDropdown] Updated specialty for #${specialtyId}`);
        });
      }
      console.log(`[populateDoctorDropdown] Populated ${doctors.length} doctors for #${selectId}`);
    },
    error: function (xhr) {
      logError('populateDoctorDropdown', xhr);
      $select.append('<option value="" disabled>Failed to load doctors</option>');
      console.error('[populateDoctorDropdown] Failed to load doctors');
    }
  });
}

// Modal: Bind Actions
function bindModalActions() {
  $('[data-action]').off('click').on('click', function (e) {
    e.preventDefault();
    const action = $(this).data('action');
    console.log(`[bindModalActions] Triggered action: ${action}`);

    if (action === 'new') {
      selectedPatientId = null;
      updateDetailsSection(null);
      resetModalView();
      $('#newActionModal').modal('show');
      $('#addPatientTab').tab('show');
    } else if (action === 'support') {
      alert('Support feature not implemented.');
    }
  });

  $('#addPatientForm').off('submit').on('submit', function (e) {
    e.preventDefault();
    const buttonId = e.originalEvent.submitter?.id;
    console.log(`[bindModalActions] Form submitted with button: ${buttonId}`);
    createPatientAndAppointment(buttonId);
  });

  $('#goBackBtn').off('click').on('click', function () {
    console.log('[bindModalActions] Go Back button clicked');
    resetModalView();
    $('#newActionModal').modal('hide');
  });

  $('#editProfileBtn').off('click').on('click', function () {
    if (selectedPatientId) {
      console.log(`[bindModalActions] Edit Profile clicked for patient ID: ${selectedPatientId}`);
      fetchPatientDetails(selectedPatientId, 'addPatientTab');
    }
  });

  $('#viewAppointmentsBtn').off('click').on('click', function () {
    if (selectedPatientId) {
      console.log(`[bindModalActions] View Appointments clicked for patient ID: ${selectedPatientId}`);
      showPatientAppointments(selectedPatientId);
    } else {
      alert('No patient selected.');
      console.warn('[bindModalActions] View Appointments clicked with no patient selected');
    }
  });
}

// Modal: Reset View
function resetModalView() {
  $('#newActionTabs .nav-link').removeClass('active').filter('#addPatientTab').addClass('active');
  $('#newActionTabContent .tab-pane').removeClass('show active').filter('#addPatient').addClass('show active');
  $('#modalBody').removeClass('split-view');
  $('#sidebarContentArea').hide();
  $('#addPatientForm')[0].reset();
  $('#patientPhone, #mobile2, #emergencyContactNumber').each(function () {
    const iti = window.intlTelInputGlobals.getInstance(this);
    if (iti) iti.setNumber('');
  });
  $('#patientDOB, #maritalSince, #appointmentDate').val('');
  $('#addPatientForm').removeData('edit-mode').removeData('patient-id').removeData('appointment-id');
  $('#personalDetailsCollapse').addClass('show');
  $('#contactDetailsCollapse, #medicalInfoCollapse, #additionalPersonalDetailsCollapse, #appointmentDetailsCollapse, #insuranceDetailsCollapse, #imageUploadCollapse').removeClass('show');
  console.log('[resetModalView] Modal view reset');
}

// Patient: Create and Appointment
function createPatientAndAppointment(buttonId) {
  console.log('[createPatientAndAppointment] Starting form validation');
  const requiredFields = [
    { id: 'patientFirstName', name: 'First Name' },
    { id: 'patientLastName', name: 'Last Name' },
    { id: 'patientGender', name: 'Gender' },
    { id: 'patientDOB', name: 'Date of Birth' },
    { id: 'patientPhone', name: 'Phone Number' },
    { id: 'preferredLanguage', name: 'Preferred Language' },
    { id: 'maritalStatus', name: 'Marital Status' }
  ];

  const errors = [];
  requiredFields.forEach(field => {
    const value = field.id === 'patientPhone'
      ? window.intlTelInputGlobals.getInstance(document.getElementById('patientPhone')).getNumber()
      : $(`#${field.id}`).val();
    if (!value?.trim()) errors.push(`${field.name} is required.`);
  });

  const aadhar = $('#aadharNumber').val().trim();
  if (aadhar && !/^\d{12}$/.test(aadhar)) errors.push('Aadhar Number must be 12 digits.');

  const phone = window.intlTelInputGlobals.getInstance(document.getElementById('patientPhone')).getNumber();
  if (!/^\+?\d+$/.test(phone) || phone.length > 13) errors.push('Phone Number invalid.');

  const mobile2 = window.intlTelInputGlobals.getInstance(document.getElementById('mobile2')).getNumber();
  if (mobile2 && (!/^\+?\d+$/.test(mobile2) || mobile2.length > 13)) errors.push('Mobile 2 invalid.');

  const apptDate = $('#appointmentDate').val();
  if (apptDate && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(apptDate)) errors.push('Appointment Date must be YYYY-MM-DD HH:mm.');

  if ($('#addPatientForm').data('appointment-id') && !apptDate) errors.push('Appointment Date required for editing.');

  if (errors.length) {
    console.error('[createPatientAndAppointment] Validation errors:', errors);
    alert('Please fix:\n- ' + errors.join('\n- '));
    return;
  }

  const patientData = {
    first_name: $('#patientFirstName').val(),
    last_name: $('#patientLastName').val(),
    gender: $('#patientGender').val(),
    date_of_birth: $('#patientDOB').val(),
    mobile_number: phone,
    alternate_mobile_number: mobile2 || null,
    aadhar_number: aadhar || null,
    preferred_language: $('#preferredLanguage').val(),
    marital_status: $('#maritalStatus').val(),
    marital_since: $('#maritalSince').val() || null,
    referred_by: $('#referredBy').val() || null,
    channel: $('#channel').val(),
    cio: $('#cio').val(),
    occupation: $('#occupation').val(),
    tag: $('#tag').val(),
    blood_group: $('#bloodGroup').val(),
    address: $('#patientAddress').val(),
    city: $('#patientCity').val(),
    pincode: $('#patientPin').val(),
    known_allergies: $('#knownAllergies').val(),
    current_medications: $('#currentMedications').val(),
    past_medical_history: $('#pastMedicalHistory').val(),
    specific_notes: $('#specificNotes').val(),
    emergency_contact_name: $('#emergencyContactName').val(),
    emergency_contact_relationship: $('#emergencyContactRelationship').val(),
    emergency_contact_number: $('#emergencyContactNumber').val(),
    insurance_provider: $('#insuranceProvider').val(),
    policy_number: $('#policyNumber').val(),
    payment_preference: $('#paymentPreference').val(),
    admission_type: $('#admissionType').val(),
    hospital_code: $('#hospitalCode').val(),
    primary_doctor: $('#doctor').val() || null
  };

  const appointmentData = apptDate ? {
    appointment_date: new Date(`${apptDate}:00+05:30`).toISOString(),
    notes: $('#appointmentNotes').val(),
    doctor_id: $('#doctor').val() || null,
    is_emergency: false
  } : null;

  const isEditMode = $('#addPatientForm').data('edit-mode');
  const patientId = $('#addPatientForm').data('patient-id');
  const appointmentId = $('#addPatientForm').data('appointment-id');

  console.log(`[createPatientAndAppointment] Submitting data - Edit mode: ${isEditMode}, Patient ID: ${patientId}, Appointment ID: ${appointmentId}`);

  const handleSuccess = (data) => {
    updateDetailsSection(data);
    populateProfileTab(data);
    $('#profileTab').tab('show');
    if (buttonId === 'addAndCreateAppointment') {
      resetModalView();
      $('#addPatientForm')[0].reset();
      $('#addPatientForm').data('patient-id', data.patient_id);
    } else {
      $('#newActionModal').modal('hide');
    }
    console.log(`[createPatientAndAppointment] Success: Patient ${isEditMode ? 'updated' : 'created'}, ID: ${data.patient_id}`);
    alert(`Patient ${isEditMode ? 'updated' : 'created'} successfully!`);
  };

  if (isEditMode && patientId) {
    $.ajax({
      url: `${CONFIG.API_BASE_URL}/patients/patients/${patientId}/`,
      type: 'PATCH',
      headers: getAuthHeaders(),
      data: JSON.stringify(patientData),
      contentType: 'application/json',
      success: function (updatedPatient) {
        if (appointmentId && appointmentData) {
          $.ajax({
            url: `${CONFIG.API_BASE_URL}/appointments/edit/${appointmentId}/`,
            type: 'PATCH',
            headers: getAuthHeaders(),
            data: JSON.stringify(appointmentData),
            contentType: 'application/json',
            success: updatedAppointment => handleSuccess({ ...updatedPatient, appointments: [updatedAppointment] }),
            error: xhr => {
              logError('createPatientAndAppointment', xhr, 'Appointment update failed');
              alert('Failed to update appointment.');
            }
          });
        } else if (appointmentData) {
          $.ajax({
            url: `${CONFIG.API_BASE_URL}/appointments/create/`,
            type: 'POST',
            headers: getAuthHeaders(),
            data: JSON.stringify({ ...appointmentData, patient_id: patientId }),
            contentType: 'application/json',
            success: newAppointment => handleSuccess({ ...updatedPatient, appointments: [newAppointment] }),
            error: xhr => {
              logError('createPatientAndAppointment', xhr, 'Appointment creation failed');
              alert('Failed to create appointment.');
            }
          });
        } else {
          handleSuccess(updatedPatient);
        }
      },
      error: function (xhr) {
        logError('createPatientAndAppointment', xhr, 'Patient update failed');
        alert('Failed to update patient.');
      }
    });
  } else {
    $.ajax({
      url: `${CONFIG.API_BASE_URL}/patients/patients/create/`,
      type: 'POST',
      headers: getAuthHeaders(),
      data: JSON.stringify(patientData),
      contentType: 'application/json',
      success: function (newPatient) {
        if (appointmentData) {
          $.ajax({
            url: `${CONFIG.API_BASE_URL}/appointments/create/`,
            type: 'POST',
            headers: getAuthHeaders(),
            data: JSON.stringify({ ...appointmentData, patient_id: newPatient.patient_id }),
            contentType: 'application/json',
            success: newAppointment => {
              handleSuccess({ ...newPatient, appointments: [newAppointment] });
              postSubmissionAppointment(newAppointment.id);
            },
            error: xhr => {
              logError('createPatientAndAppointment', xhr, 'Appointment creation failed');
              alert('Failed to create appointment.');
            }
          });
        } else {
          handleSuccess(newPatient);
        }
      },
      error: function (xhr) {
        logError('createPatientAndAppointment', xhr, 'Patient creation failed');
        alert('Failed to create patient.');
      }
    });
  }
}

// Patient: Show Appointments
function showPatientAppointments(patientId) {
  console.log(`[showPatientAppointments] Fetching appointments for patient ID: ${patientId}`);
  $.ajax({
    url: `${CONFIG.API_BASE_URL}/appointments/list/?patient_id=${patientId}`,
    type: 'GET',
    headers: getAuthHeaders(),
    success: function (data) {
      const appointments = data.appointments || [];
      console.log(`[showPatientAppointments] Fetched ${appointments.length} appointments for patient ID: ${patientId}`);
      const modalHtml = `
        <div class="modal fade" id="patientAppointmentsModal" tabindex="-1" aria-labelledby="patientAppointmentsModalLabel">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Patient Appointments</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <table class="table table-striped">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Doctor</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${appointments.length ? appointments.map(appt => {
                      const apptDate = new Date(appt.appointment_date);
                      return `
                      <tr>
                        <td>${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(apptDate)}</td>
                        <td>${formatTimeHHMM(apptDate)}</td>
                        <td>${appt.doctor ? `${appt.doctor.first_name} ${appt.doctor.last_name || ''}` : 'N/A'}</td>
                        <td>${appt.status?.toUpperCase() || 'N/A'}</td>
                        <td>${appt.notes || 'N/A'}</td>
                      </tr>
                    `;
                    }).join('') : '<tr><td colspan="5" class="text-center">No appointments found.</td></tr>'}
                  </tbody>
                </table>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `;

      $('#patientAppointmentsModal').remove();
      $('body').append(modalHtml);
      const modal = new bootstrap.Modal('#patientAppointmentsModal');
      modal.show();

      $('#patientAppointmentsModal').on('hidden.bs.modal', function () {
        $(this).remove();
      });
    },
    error: function (xhr) {
      logError('showPatientAppointments', xhr);
      alert('Failed to load appointments.');
    }
  });
}

// Appointment: Post-Submission Status Update
function postSubmissionAppointment(appointmentId) {
  if (!appointmentId) return;
  console.log(`[postSubmissionAppointment] Setting status to Booked for appointment ID: ${appointmentId}`);
  $.ajax({
    url: `${CONFIG.API_BASE_URL}/appointments/edit/${appointmentId}/`,
    type: 'PATCH',
    headers: getAuthHeaders(),
    data: JSON.stringify({ status: 'Booked' }),
    contentType: 'application/json',
    success: () => console.log(`[postSubmissionAppointment] Set ID ${appointmentId} to Booked`),
    error: xhr => logError('postSubmissionAppointment', xhr)
  });
}

// Navigation: Bind Filters
function bindNavFilters() {
  $('.navbar-secondary .nav-item a').off('click').on('click', function (e) {
    e.preventDefault();
    const section = $(this).data('section');
    console.log(`[bindNavFilters] Applying filter: ${section}`);
    $('.navbar-secondary .nav-link').removeClass('active');
    $(this).addClass('active');
    const dateStr = $('#dateFilter').val() || formatDateToYYYYMMDD(new Date());
    fetchAppointmentsByDate(dateStr, section);
  });
}

// Date Input: Validate
function validateDateInput(inputId) {
  const $input = $(`#${inputId}`);
  if (!$input.length) {
    console.warn(`[validateDateInput] Input #${inputId} not found, skipping initialization`);
    return;
  }

  $input.datepicker({
    format: 'yyyy-mm-dd',
    autoclose: true,
    todayHighlight: true
  }).on('changeDate', function () {
    const value = $input.val();
    const isValid = isValidDateFormat(value);
    $input.toggleClass('is-invalid', !isValid);
    if (isValid) {
      fetchAppointmentsByDate(value);
    } else {
      alert('Please use YYYY-MM-DD format.');
    }
    console.log(`[validateDateInput] #${inputId}: ${value}, Valid: ${isValid}`);
  });
}

// Date Filter: Bind Buttons
function bindDateFilterButtons() {
  const $setBtn = $('.navbar-secondary .btn:contains("Set")');
  const $todayBtn = $('.navbar-secondary .btn:contains("Today")');

  $setBtn.off('click').on('click', () => {
    const dateStr = $('#dateFilter').val();
    console.log(`[bindDateFilterButtons] Set button clicked, date: ${dateStr}`);
    if (dateStr) {
      fetchAppointmentsByDate(dateStr);
    } else {
      alert('Please select a date.');
    }
  });

  $todayBtn.off('click').on('click', () => {
    const todayStr = formatDateToYYYYMMDD(new Date());
    console.log('[bindDateFilterButtons] Today button clicked');
    $('#dateFilter').val(todayStr).trigger('changeDate');
  });
}

// Phone Inputs: Initialize
function initializePhoneInputs() {
  ['patientPhone', 'mobile2', 'emergencyContactNumber'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      window.intlTelInput(input, {
        initialCountry: 'in',
        separateDialCode: true,
        utilsScript: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js'
      });
      console.log(`[initializePhoneInputs] Initialized phone input: ${id}`);
    }
  });
}

// Gender: Bind Selection
function bindGenderSelection() {
  $('input[name="patientGender"]').off('change').on('change', function () {
    $('#patientGender').val($(this).val());
    console.log(`[bindGenderSelection] Selected gender: ${$(this).val()}`);
    $('.btn-group label').removeClass('active');
    $(this).next('label').addClass('active');
  });
}

// Logout
function logoutUser() {
  console.log('[logoutUser] Initiating logout');
  $.ajax({
    url: `${CONFIG.API_BASE_URL}/users/logout/`,
    type: 'POST',
    headers: getAuthHeaders(),
    success: () => {
      console.log('[logoutUser] Logout successful');
      sessionStorage.clear();
      window.location.href = '../login/login.html';
    },
    error: xhr => {
      logError('logoutUser', xhr);
      console.warn('[logoutUser] Logout failed, clearing session anyway');
      sessionStorage.clear();
      window.location.href = '../login/login.html';
    }
  });
}

// Initialize
$(document).ready(function () {
  try {
    console.log('[Main] Starting initialization');
    checkAuthentication();
    bindNavFilters();
    bindModalActions();
    validateDateInput('dateFilter');
    validateDateInput('patientDOB');
    bindDateFilterButtons();
    initializePhoneInputs();
    fetchIndianCities();
    populateDoctorDropdown('doctor', 'doctorSpecialty');
    bindGenderSelection();
    setupPatientSearch();

    $('.dropdown-item:contains("Logout")').on('click', e => {
      e.preventDefault();
      console.log('[Main] Logout dropdown item clicked');
      logoutUser();
    });

    $('#newActionTabs a').on('click', function (e) {
      e.preventDefault();
      console.log(`[Main] Tab clicked: ${$(this).attr('id')}`);
      $(this).tab('show');
    });

    console.log('[Main] Initialization completed');
  } catch (error) {
    console.error('[Main] Initialization error:', error);
    alert('Failed to load dashboard. Please refresh or contact support.');
  }
});