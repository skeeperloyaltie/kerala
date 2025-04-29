$(document).ready(function () {

 
  // Setup Patient Search with Autocomplete
  let selectedPatientId = null;

// Setup Patient Search with Autocomplete
function setupPatientSearch() {
  console.log("🔍 Setting up patient search...");
  const $searchInput = $('.navbar-top .form-control.patient-search');
  const $dropdown = $('<ul class="autocomplete-dropdown"></ul>').hide();
  $searchInput.after($dropdown);

  $searchInput.on('input', debounce(function () {
    const query = $searchInput.val().trim();
    console.log("✨ Search input triggered:", query);
    if (query.length < 1) {
      $dropdown.hide().empty();
      return;
    }

    $.ajax({
      url: `${API_BASE_URL}/patients/search/?query=${encodeURIComponent(query)}`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        console.log("✅ Patient search results:", data);
        $dropdown.empty();
        if (data.patients && data.patients.length > 0) {
          data.patients.forEach(patient => {
            const $li = $(`<li data-patient-id="${patient.patient_id}">${patient.first_name} ${patient.last_name || ''} (ID: ${patient.patient_id})</li>`);
            $dropdown.append($li);
          });
          $dropdown.show();
        } else {
          $dropdown.show();
          showCreatePatientPrompt(query);
        }
      },
      error: function (xhr) {
        console.error("❌ Search error:", xhr.status, xhr.statusText, xhr.responseText);
        $dropdown.hide();
      }
    });
  }, 300));

  // Handle patient selection
  $dropdown.on('click', 'li', function () {
    const patientId = $(this).data('patient-id');
    $searchInput.val($(this).text());
    $dropdown.hide();
    console.log("👤 Patient selected, ID:", patientId);
    selectedPatientId = patientId; // Store globally
    fetchPatientDetails(patientId, 'addBillsTab'); // Default to Add Bills tab
  });

  $(document).on('click', function (e) {
    if (!$(e.target).closest('.navbar-top .form-control.patient-search, .autocomplete-dropdown').length) {
      $dropdown.hide();
    }
  });
}

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Fetch Patient Details
  function fetchPatientDetails(patientId, targetTab = 'addPatientTab') {
    $.ajax({
      url: `${API_BASE_URL}/patients/patients/${patientId}/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        selectedPatientId = (data.patient || data).patient_id; // Update global variable
        const patient = data.patient || data;
        const appointment = patient.appointments && patient.appointments.length > 0 ? patient.appointments[0] : null;
  
        // Populate forms
        populateProfileTab(patient);
        populateAddPatientForm(patient, appointment);
        updateDetailsSection(data);
  
        // Pre-set bill patient ID
        $("#patientIdForBill").val(selectedPatientId);
        sessionStorage.setItem("billPatientId", selectedPatientId);
  
        // Open modal and switch to target tab
        $('#newActionModal').modal('show');
        $(`#${targetTab}`).tab('show');
  
        // If targeting Add Bills tab, ensure form is ready
        if (targetTab === 'addBillsTab') {
          updateBillDetails(selectedPatientId);
          if (!$("#billItemsTableBody tr").length) {
            $("#addBillItem").click(); // Add at least one bill item
          }
        }
  
        // Show all sections in Add Patient form if needed
        if (targetTab === 'addPatientTab') {
          $('#personalDetailsCollapse, #contactDetailsCollapse, #medicalInfoCollapse, #additionalPersonalDetailsCollapse, #appointmentDetailsCollapse, #insuranceDetailsCollapse, #imageUploadCollapse').addClass('show');
        }
  
        console.log(`✅ Fetched and populated details for patient ${patientId}, switched to ${targetTab}`);
      },
      error: function (xhr) {
        console.error(`❌ Failed to fetch patient details for ${patientId}:`, xhr.responseJSON);
        let errorMessage = xhr.responseJSON?.error || "Failed to fetch patient details.";
        alert(errorMessage);
      }
    });
  }

  // New Function: Display Patient Appointments in APPT Tab
function showPatientAppointments(patientId) {
  $.ajax({
    url: `${API_BASE_URL}/appointments/list/?patient_id=${patientId}`,
    type: "GET",
    headers: getAuthHeaders(),
    success: function (data) {
      console.log(`✅ Fetched appointments for patient ${patientId}:`, data);
      const appointments = Array.isArray(data.appointments) ? data.appointments : [];
      renderAppointmentsTable(appointments, patientId);
      $('#newActionModal').modal('show');
      $('#visitsTab').tab('show'); // This should work if the tab trigger has id="visitsTab"
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch appointments for patient ${patientId}:`, xhr.responseJSON);
      alert(`Failed to fetch appointments: ${xhr.responseJSON?.error || "Unknown error"}`);
    }
  });
}
// New Function: Render Appointments Table in APPT Tab
function renderAppointmentsTable(appointments, patientId) {
  const $visitsTabContent = $('#visitsTabContent'); // Target the content container
  $visitsTabContent.empty(); // Clear existing content

  if (!appointments.length) {
    $visitsTabContent.append('<p class="text-center">No appointments found for this patient.</p>');
    console.log(`ℹ️ No appointments to display for patient ${patientId}`);
    return;
  }

  const $table = $(`
    <table class="table table-striped table-bordered">
      <thead>
        <tr>
          <th>#</th>
          <th>Appointment ID</th>
          <th>Date & Time</th>
          <th>Doctor</th>
          <th>Status</th>
          <th>Notes</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `);
  const $tbody = $table.find('tbody');

  appointments.forEach((appt, index) => {
    const doctorName = appt.doctor && appt.doctor.first_name
      ? `${appt.doctor.first_name} ${appt.doctor.last_name || ''}`
      : 'N/A';
    const apptDate = appt.appointment_date
      ? new Date(appt.appointment_date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      : 'N/A';
    const statusClass = appt.status ? `status-${appt.status.toLowerCase().replace(' ', '-')}` : 'status-unknown';

    const $row = $(`
      <tr>
        <td>${index + 1}</td>
        <td>${appt.id}</td>
        <td>${apptDate}</td>
        <td>${doctorName}</td>
        <td><span class="${statusClass}">${appt.status.toUpperCase()}</span></td>
        <td>${appt.notes || 'N/A'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary edit-appointment" data-appointment-id="${appt.id}">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      </tr>
    `);
    $tbody.append($row);
  });

  $visitsTabContent.append($table);

  // Bind edit button click
  $visitsTabContent.find('.edit-appointment').on('click', function () {
    const appointmentId = $(this).data('appointment-id');
    editAppointment(appointmentId);
  });

  console.log(`✅ Rendered appointments table for patient ${patientId} with ${appointments.length} entries`);
}
  // New Function: Edit Appointment (Frontend Modal)
function editAppointment(appointmentId) {
  $.ajax({
    url: `${API_BASE_URL}/appointments/edit/${appointmentId}/`,
    type: "GET",
    headers: getAuthHeaders(),
    success: function (appt) {
      console.log(`📋 Fetched appointment ${appointmentId} for editing:`, appt);

      // Create edit modal
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
                  <label for="editApptDate" class="form-label">Date & Time</label>
                  <input type="text" class="form-control" id="editApptDate" value="${appt.appointment_date || ''}">
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
      const bsModal = new bootstrap.Modal(modal[0]);
      bsModal.show();

      // Initialize Flatpickr for date
      flatpickr("#editApptDate", {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        minDate: "today",
        defaultDate: appt.appointment_date || new Date(),
        time_24hr: true,
        allowInput: true
      });

      // Populate doctor dropdown
      populateDoctorDropdown('editApptDoctor');
      $('#editApptDoctor').val(appt.doctor?.id || '');

      // Handle save
      modal.find('.save-appointment').on('click', function () {
        const updatedData = {
          appointment_date: $('#editApptDate').val(),
          doctor_id: $('#editApptDoctor').val(),
          status: $('#editApptStatus').val(),
          notes: $('#editApptNotes').val()
        };

        // Placeholder for backend update (to be implemented)
        $.ajax({
          url: `${API_BASE_URL}/appointments/edit/${appointmentId}/`,
          type: "PATCH",
          headers: getAuthHeaders(),
          data: JSON.stringify(updatedData),
          contentType: "application/json",
          success: function () {
            console.log(`✅ Updated appointment ${appointmentId}`);
            alert("Appointment updated successfully!");
            bsModal.hide();
            showPatientAppointments(selectedPatientId); // Refresh table
          },
          error: function (xhr) {
            console.error(`❌ Failed to update appointment ${appointmentId}:`, xhr.responseJSON);
            alert(`Failed to update appointment: ${xhr.responseJSON?.error || "Unknown error"}`);
          }
        });
      });

      modal.on('hidden.bs.modal', function () {
        modal.remove();
      });
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch appointment ${appointmentId}:`, xhr.responseJSON);
      alert(`Failed to fetch appointment details: ${xhr.responseJSON?.error || "Unknown error"}`);
    }
  });
}

  // Populate Profile Tab
  // Update Profile Tab to Include View Appointments Button
  function populateProfileTab(data) {
    const patient = data.patient || data;
    console.log("📋 Populating profile tab with data:", patient);

    // Existing population logic (unchanged)
    $('#profileFirstName').val(patient.first_name || '');
    $('#profileLastName').val(patient.last_name || '');
    $('#profilePhone').val(patient.mobile_number || '');
    $('#profileGender').val(patient.gender || 'N/A');
    $('#profileDOB').val(patient.date_of_birth || 'N/A');
    $('#profilePreferredLanguage').val(patient.preferred_language || 'N/A');
    $('#profileFatherName').val(patient.father_name || 'N/A');
    $('#profileMaritalStatus').val(patient.marital_status || 'N/A');
    $('#profilePaymentPreference').val(patient.payment_preference || 'N/A');
    const appointment = patient.appointments && patient.appointments.length > 0 ? patient.appointments[0] : null;
    if (appointment && appointment.appointment_date) {
      const appointmentDate = new Date(appointment.appointment_date);
      const formattedDate = `${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, '0')}-${String(appointmentDate.getDate()).padStart(2, '0')} ${String(appointmentDate.getHours()).padStart(2, '0')}:${String(appointmentDate.getMinutes()).padStart(2, '0')}`;
      $('#profileAppointmentDate').val(formattedDate);
    } else {
      $('#profileAppointmentDate').val('N/A');
    }
    $('#profileCity').val(patient.city || '');
    $('#profileAddress').val(patient.address || '');
    $('#profilePin').val(patient.pincode || '');
    $('#profileMaritalSince').val(patient.marital_since || '');
    $('#profileBloodGroup').val(patient.blood_group || '');
    $('#profileReferredBy').val(patient.referred_by || '');

    const doctor = patient.primary_doctor || (appointment && appointment.doctor) || {};
    $('#profileDoctor').val(doctor.first_name ? `${doctor.first_name} ${doctor.last_name || ''}` : 'N/A');
    $('#profileDoctorSpecialty').val(doctor.specialization || '');

    $('#profileChannel').val(patient.channel || '');
    $('#profileCIO').val(patient.cio || '');
    $('#profileOccupation').val(patient.occupation || '');
    $('#profileTag').val(patient.tag || '');
    $('#profileMobile2').val(patient.alternate_mobile_number || '');
    $('#profileAadharNumber').val(patient.aadhar_number || '');
    $('#profileKnownAllergies').val(patient.known_allergies || '');
    $('#profileCurrentMedications').val(patient.current_medications || '');
    $('#profilePastMedicalHistory').val(patient.past_medical_history || '');
    $('#profileSpecificNotes').val(patient.specific_notes || '');
    $('#profileEmergencyContactName').val(patient.emergency_contact_name || '');
    $('#profileEmergencyContactRelationship').val(patient.emergency_contact_relationship || '');
    $('#profileEmergencyContactNumber').val(patient.emergency_contact_number || '');
    $('#profileInsuranceProvider').val(patient.insurance_provider || '');
    $('#profilePolicyNumber').val(patient.policy_number || '');
    $('#profileAdmissionType').val(patient.admission_type || '');
    $('#profileHospitalCode').val(patient.hospital_code || '');
    $('#profileAppointmentNotes').val(appointment ? appointment.notes || '' : '');

    // Toggle readonly for profile fields
    const $profileFields = $('#profileCity, #profileAddress, #profilePin');
    $profileFields.prop('readonly', true);

    // Add edit toggle button if not already present
    if (!$('#toggleProfileEdit').length) {
      const $editButton = $('<button class="btn btn-sm btn-outline-primary ms-2" id="toggleProfileEdit">Edit</button>');
      $('#profileCity').closest('.input-group').append($editButton);

      $editButton.on('click', function () {
        const isReadonly = $profileFields.prop('readonly');
        $profileFields.prop('readonly', !isReadonly);
        $(this).text(isReadonly ? 'Save' : 'Edit');
        if (!isReadonly) {
          const patientId = selectedPatientId || patient.patient_id;
          if (!patientId) {
            alert("No patient ID found. Please select a patient.");
            return;
          }
          const updatedData = {
            city: $('#profileCity').val(),
            address: $('#profileAddress').val(),
            pincode: $('#profilePin').val()
          };
          $.ajax({
            url: `${API_BASE_URL}/patients/patients/${patientId}/`,
            type: "PATCH",
            headers: getAuthHeaders(),
            data: JSON.stringify(updatedData),
            contentType: "application/json",
            success: function () {
              console.log(`✅ Updated patient ${patientId} address details`);
              alert("Address details updated successfully!");
            },
            error: function (xhr) {
              console.error(`❌ Failed to update patient ${patientId}:`, xhr.responseJSON || xhr.statusText);
              alert(`Failed to update address: ${xhr.responseJSON?.error || "Unknown error"}`);
            }
          });
        }
      });
    }

    // Reinitialize autocomplete for profileCity
    setupCityAutocomplete("profileCity");

    // Update button bindings
    $('#editProfileBtn').off('click').on('click', function () {
      populateAddPatientForm(patient, appointment);
      $('#addPatientTab').tab('show');
    });

    $('#viewAppointmentsBtn').off('click').on('click', function () {
      showPatientAppointments(patient.patient_id);
    });

    $('#addBillFromProfileBtn').off('click').on('click', function () {
      selectedPatientId = patient.patient_id;
      $('#patientIdForBill').val(patient.patient_id || '');
      sessionStorage.setItem("billPatientId", patient.patient_id || '');
      $('#addBillsTab').tab('show');
    });

    console.log("✅ Profile tab populated with patient data:", patient);
  }

  // Update Details Section
  function updateDetailsSection(data) {
    const detailsTitle = document.getElementById('detailsTitle');
    const detailsMeta = document.getElementById('detailsMeta');
    const visitPadBtn = document.getElementById('visitPadBtn');

    const patient = data && data.patient ? data.patient : data;
    console.log("📋 Updating details section with data:", patient);

    if (patient && patient.patient_id) {
      const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
      const dob = patient.date_of_birth ? new Date(patient.date_of_birth) : null;
      const age = dob ? Math.floor((new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25)) : 'N/A';
      const patientId = patient.patient_id || 'N/A';

      detailsTitle.textContent = `${fullName}`;
      detailsMeta.textContent = `${patient.gender || 'N/A'} | ${age} Years | ${patientId}`;
      visitPadBtn.style.display = 'inline-block';
      console.log("✅ Updated patient details section:", { fullName, age, patientId });
    } else {
      detailsTitle.textContent = 'No Patient Selected';
      detailsMeta.textContent = 'N/A | N/A | N/A';
      visitPadBtn.style.display = 'none';
      console.log("✅ Reset patient details section");
    }
  }

  // Populate Add Patient Form
  function populateAddPatientForm(patient, appointment = null) {
    $('#patientFirstName').val(patient.first_name || '');
    $('#patientLastName').val(patient.last_name || '');
    $('#patientPhone').val(patient.mobile_number || '');
    $('#patientGender').val(patient.gender || '');
    $('#patientDOB').val(patient.date_of_birth || '');
    $('#preferredLanguage').val(patient.preferred_language || '');
    $('#fatherName').val(patient.father_name || '');
    $('#maritalStatus').val(patient.marital_status || '');
    $('#paymentPreference').val(patient.payment_preference || '');
    $('#appointmentDate').val(appointment ? appointment.appointment_date : '');
    $('#patientCity').val(patient.city || '');
    $('#patientAddress').val(patient.address || '');
    $('#patientPin').val(patient.pincode || '');
    $('#maritalSince').val(patient.marital_since || '');
    $('#bloodGroup').val(patient.blood_group || '');
    $('#referredBy').val(patient.referred_by || '');
    $('#doctor').val(appointment && appointment.doctor ? appointment.doctor.id : '');
    $('#doctorSpecialty').val(appointment && appointment.doctor ? appointment.doctor.specialization : '');
    $('#channel').val(patient.channel || '');
    $('#cio').val(patient.cio || '');
    $('#occupation').val(patient.occupation || '');
    $('#tag').val(patient.tag || '');
    $('#mobile2').val(patient.alternate_mobile_number || '');
    $('#aadharNumber').val(patient.aadhar_number || '');
    $('#knownAllergies').val(patient.known_allergies || '');
    $('#currentMedications').val(patient.current_medications || '');
    $('#pastMedicalHistory').val(patient.past_medical_history || '');
    $('#specificNotes').val(patient.specific_notes || '');
    $('#emergencyContactName').val(patient.emergency_contact_name || '');
    $('#emergencyContactRelationship').val(patient.emergency_contact_relationship || '');
    $('#emergencyContactNumber').val(patient.emergency_contact_number || '');
    $('#insuranceProvider').val(patient.insurance_provider || '');
    $('#policyNumber').val(patient.policy_number || '');
    $('#admissionType').val(patient.admission_type || '');
    $('#hospitalCode').val(patient.hospital_code || '');
    $('#appointmentNotes').val(appointment ? appointment.notes || '' : '');

    $('#addPatientForm').data('edit-mode', !!patient.patient_id);
    $('#addPatientForm').data('patient-id', patient.patient_id);
    $('#addPatientForm').data('appointment-id', appointment ? appointment.id : null);
  }

  // Show Create Patient Prompt
  // Show Create Patient Prompt
  function showCreatePatientPrompt(query) {
    const [firstName, ...lastNameParts] = query.split(' ');
    const lastName = lastNameParts.join(' ');

    // Create modal with proper Bootstrap classes and centered positioning
    const modalHtml = `
      <div class="modal fade" id="noPatientFoundModal" tabindex="-1" aria-labelledby="noPatientFoundModalLabel" aria-hidden="true" style="z-index: 1055;">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="noPatientFoundModalLabel">Patient Not Found</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p>No patient found matching "${query}". Would you like to create a new patient?</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Search Again</button>
              <button type="button" class="btn btn-primary" id="createPatientBtn">Create Patient</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Append modal to body
    const $modal = $(modalHtml);
    $('body').append($modal);

    // Initialize Bootstrap modal
    const promptModal = new bootstrap.Modal($modal[0], {
      backdrop: 'static', // Prevent closing by clicking outside
      keyboard: true, // Allow closing with ESC key
      focus: true // Ensure modal is focused
    });

    // Show the modal
    promptModal.show();

    // Handle Create Patient button click
    $('#createPatientBtn').on('click', function () {
      promptModal.hide();
      $('#newActionModal').modal('show');
      $('#addPatientTab').tab('show');
      $('#patientFirstName').val(firstName);
      $('#patientLastName').val(lastName);
      resetModalView();
      updateDetailsSection(null);
    });

    // Clean up modal after it is hidden
    $modal.on('hidden.bs.modal', function () {
      $modal.remove(); // Remove modal from DOM
    });
  }

  // Toggle Split View
  function toggleSplitView(tabId) {
    const modalBody = document.getElementById('modalBody');
    const sidebarContentArea = document.getElementById('sidebarContentArea');
    const sidebarTabContent = document.getElementById('sidebarTabContent');

    const tabContent = document.querySelector(`#${tabId}`).cloneNode(true);
    sidebarTabContent.innerHTML = '';
    sidebarTabContent.appendChild(tabContent);

    modalBody.classList.add('split-view');
    sidebarContentArea.style.display = 'block';

    const sidebarTabPane = sidebarTabContent.querySelector(`#${tabId}`);
    sidebarTabPane.classList.add('show', 'active');
    console.log(`✅ Split view toggled for tab: ${tabId}`);
  }

  // Add Patient Form Submission
  $("#addPatientForm").submit(function (e) {
    e.preventDefault();

    const requiredFields = [
      { id: "patientFirstName", name: "First Name" },
      { id: "patientLastName", name: "Last Name" },
      { id: "patientGender", name: "Gender" },
      { id: "patientDOB", name: "Date of Birth" },
      { id: "fatherName", name: "Father's Name" },
      { id: "patientPhone", name: "Phone Number" },
      { id: "preferredLanguage", name: "Preferred Language" },
      { id: "maritalStatus", name: "Marital Status" },
      { id: "paymentPreference", name: "Payment Preference" }
    ];

    let errors = [];

    requiredFields.forEach(field => {
      const value = field.id === "patientPhone" ? itiPhone.getNumber() : $(`#${field.id}`).val();
      if (!value || value.trim() === "") {
        errors.push(`${field.name} is required.`);
      }
    });

    const aadharValue = $("#aadharNumber").val().trim();
    if (aadharValue && !/^\d{12}$/.test(aadharValue)) {
      errors.push("Aadhar Number must be exactly 12 digits.");
    }

    const phoneValue = itiPhone.getNumber();
    if (!/^\+?\d+$/.test(phoneValue) || phoneValue.length > 13) {
      errors.push("Phone Number must be numeric and up to 13 digits (including country code).");
    }

    const mobile2Value = itiMobile2.getNumber();
    if (mobile2Value && (!/^\+?\d+$/.test(mobile2Value) || mobile2Value.length > 13)) {
      errors.push("Mobile 2 must be numeric and up to 13 digits (including country code).");
    }

    const appointmentDateInput = $("#appointmentDate")[0]?._flatpickr?.selectedDates[0];
    const appointmentDate = appointmentDateInput
      ? flatpickr.formatDate(appointmentDateInput, "Y-m-d H:i") + ":00+05:30"
      : null;

    if ($('#addPatientForm').data('appointment-id') && !appointmentDate) {
      errors.push("Appointment Date is required for editing an appointment.");
    }

    const primaryDoctor = $("#doctor").val();
    if (!primaryDoctor) {
      errors.push("Primary Doctor is required.");
    }

    if (errors.length > 0) {
      alert("Please fix the following errors:\n- " + errors.join("\n- "));
      return;
    }

    const patientData = {
      first_name: $("#patientFirstName").val(),
      last_name: $("#patientLastName").val(),
      gender: $("#patientGender").val(),
      date_of_birth: $("#patientDOB").val(),
      father_name: $("#fatherName").val(),
      mobile_number: itiPhone.getNumber(),
      alternate_mobile_number: mobile2Value || null,
      aadhar_number: aadharValue || null,
      preferred_language: $("#preferredLanguage").val(),
      marital_status: $("#maritalStatus").val(),
      marital_since: $("#maritalSince").val() || null,
      referred_by: $("#referredBy").val(),
      channel: $("#channel").val(),
      cio: $("#cio").val(),
      occupation: $("#occupation").val(),
      tag: $("#tag").val(),
      blood_group: $("#bloodGroup").val(),
      address: $("#patientAddress").val(),
      city: $("#patientCity").val(),
      pincode: $("#patientPin").val(),
      known_allergies: $("#knownAllergies").val(),
      current_medications: $("#currentMedications").val(),
      past_medical_history: $("#pastMedicalHistory").val(),
      specific_notes: $("#specificNotes").val(),
      emergency_contact_name: $("#emergencyContactName").val(),
      emergency_contact_relationship: $("#emergencyContactRelationship").val(),
      emergency_contact_number: $("#emergencyContactNumber").val(),
      insurance_provider: $("#insuranceProvider").val(),
      policy_number: $("#policyNumber").val(),
      payment_preference: $("#paymentPreference").val(),
      admission_type: $("#admissionType").val(),
      hospital_code: $("#hospitalCode").val(),
      primary_doctor: $("#doctor").val()
    };

    const appointmentData = appointmentDate
      ? {
          appointment_date: appointmentDate,
          notes: $("#appointmentNotes").val(),
          doctor_id: $("#doctor").val() || null,
          is_emergency: false
        }
      : null;

    const isEditMode = $('#addPatientForm').data('edit-mode');
    const patientId = $('#addPatientForm').data('patient-id');
    const appointmentId = $('#addPatientForm').data('appointment-id');
    let activeButton = null;
    if (e.originalEvent && e.originalEvent.submitter) {
      activeButton = e.originalEvent.submitter.id;
    } else {
      console.warn("⚠️ Submitter not available, checking form buttons...");
      const $submitButtons = $('#addPatientForm').find('button[type="submit"]');
      activeButton = $submitButtons.length === 1 ? $submitButtons.attr('id') : 'savePatient';
    }
    console.log(`🖱️ Form submitted by button: ${activeButton}`);

    if (isEditMode && patientId) {
      $.ajax({
        url: `${API_BASE_URL}/patients/patients/${patientId}/`,
        type: "PATCH",
        headers: getAuthHeaders(),
        data: JSON.stringify(patientData),
        contentType: "application/json",
        success: function (updatedPatient) {
          if (appointmentId && appointmentData) {
            $.ajax({
              url: `${API_BASE_URL}/appointments/edit/${appointmentId}/`,
              type: "PATCH",
              headers: getAuthHeaders(),
              data: JSON.stringify(appointmentData),
              contentType: "application/json",
              success: function (updatedAppointment) {
                const combinedData = { ...updatedPatient, appointments: [updatedAppointment] };
                handlePostSubmission(combinedData, activeButton);
              },
              error: function (xhr) {
                alert(`Failed to update appointment: ${xhr.responseJSON?.error || "Unknown error"}`);
              }
            });
          } else if (appointmentData) {
            $.ajax({
              url: `${API_BASE_URL}/appointments/create/`,
              type: "POST",
              headers: getAuthHeaders(),
              data: JSON.stringify({ ...appointmentData, patient_id: patientId }),
              contentType: "application/json",
              success: function (newAppointment) {
                const combinedData = { ...updatedPatient, appointments: [newAppointment] };
                handlePostSubmission(combinedData, activeButton);
              },
              error: function (xhr) {
                alert(`Failed to create appointment: ${xhr.responseJSON?.error || "Unknown error"}`);
              }
            });
          } else {
            handlePostSubmission(updatedPatient, activeButton);
          }
        },
        error: function (xhr) {
          alert(`Failed to update patient: ${xhr.responseJSON?.error || "Unknown error"}`);
        }
      });
    } else {
      $.ajax({
        url: `${API_BASE_URL}/patients/patients/create/`,
        type: "POST",
        headers: getAuthHeaders(),
        data: JSON.stringify(patientData),
        contentType: "application/json",
        success: function (newPatient) {
          if (appointmentData) {
            $.ajax({
              url: `${API_BASE_URL}/appointments/create/`,
              type: "POST",
              headers: getAuthHeaders(),
              data: JSON.stringify({ ...appointmentData, patient_id: newPatient.patient_id }),
              contentType: "application/json",
              success: function (newAppointment) {
                const combinedData = { ...newPatient, appointments: [newAppointment] };
                handlePostSubmission(combinedData, activeButton);
              },
              error: function (xhr) {
                alert(`Failed to create appointment: ${xhr.responseJSON?.error || "Unknown error"}`);
              }
            });
          } else {
            handlePostSubmission(newPatient, activeButton);
          }
        },
        error: function (xhr) {
          alert(`Failed to create patient: ${xhr.responseJSON?.error || "Unknown error"}`);
        }
      });
    }
  });

  function handlePostSubmission(data, activeButton) {
    updateDetailsSection(data);
    populateProfileTab(data);
    $('#profileTab').tab('show');

    if (activeButton === 'addAndCreateBill') {
      toggleSplitView('addBills');
      $('#addBillsTab').tab('show');
      $('#patientIdForBill').val(data.patient_id);
      sessionStorage.setItem("billPatientId", data.patient_id);
    } else if (activeButton === 'addAndCreateAppointment') {
      toggleSplitView('addPatient');
      $('#addPatientTab').tab('show');
      $('#addPatientForm')[0].reset();
      flatpickr("#patientDOB").clear();
      flatpickr("#maritalSince").clear();
      flatpickr("#appointmentDate").clear();
      $('#addPatientForm').data('patient-id', data.patient_id);
    }

    alert(`Patient ${$('#addPatientForm').data('edit-mode') ? 'updated' : 'created'} successfully!`);
    if (activeButton !== 'addAndCreateAppointment') {
      $("#addPatientForm")[0].reset();
      flatpickr("#patientDOB").clear();
      flatpickr("#maritalSince").clear();
      flatpickr("#appointmentDate").clear();
    }
    $('#addPatientForm').removeData('edit-mode').removeData('appointment-id');
  }

  // Add Service Form Submission
  
// Update Add Service Form Submission to refresh table
  $("#addServiceForm").submit(function (e) {
    e.preventDefault();

    const serviceName = $("#serviceName").val().trim();
    const servicePrice = parseFloat($("#servicePrice").val());
    const serviceCode = $("#serviceCode").val().trim();
    const serviceColorCode = $("#serviceColorCode").val();
    let selectedDoctors = $("#serviceDoctors").val() || [];

    // Validation
    if (!serviceName) {
      alert("Service Name is required.");
      return;
    }
    if (isNaN(servicePrice) || servicePrice < 0) {
      alert("Service Price must be a valid number greater than or equal to 0.");
      return;
    }
    if (!serviceCode) {
      alert("Service Code is required.");
      return;
    }
    if (!serviceColorCode) {
      alert("Service Color Code is required.");
      return;
    }
    if (!selectedDoctors.length) {
      alert("Please select at least one doctor or 'All Doctors'.");
      return;
    }

    // Handle "All Doctors" selection
    const allDoctors = selectedDoctors.includes("all");
    const doctorIds = allDoctors
      ? [] // Empty array if "All Doctors" is selected
      : selectedDoctors
          .filter(id => id !== "all")
          .map(id => parseInt(id)); // Convert to integers

    // Adjust data to match server expectations
    const data = {
      name: serviceName, // Changed from service_name to name
      price: servicePrice, // Changed from service_price to price
      code: serviceCode,
      color_code: serviceColorCode,
      doctors: doctorIds,
      all_doctors: allDoctors
    };
    console.log("🟢 Submitting add service form:", data);

    $.ajax({
      url: `${API_BASE_URL}/service/create/`,
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(data),
      contentType: "application/json",
      success: () => {
        console.log("✅ Service added successfully");
        $(this)[0].reset();
        $("#serviceDoctors").val(null).trigger('change'); // Reset multi-select
        $("#newActionModal").modal("hide");
        alert("Service added successfully");
        fetchServices(); // Refresh services list for bill items
        populateServicesTable(); // Refresh services table
      },
      error: xhr => {
        console.error(`❌ Failed to add service: ${xhr.status}`, xhr.responseJSON);
        const errorMsg = xhr.responseJSON?.error || xhr.responseJSON?.detail || "Unknown error";
        alert(`Failed to add service: ${errorMsg}`);
      }
    });
  });

  // Add Bills Form Handling
  flatpickr("#billDate", { dateFormat: "Y-m-d", defaultDate: new Date(), allowInput: true });

  const appointmentDatePicker = flatpickr("#appointmentDateInput", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    minDate: "today",
    defaultDate: new Date(),
    time_24hr: true,
    allowInput: true
  });

  $("#todayBillBtn").on("click", function () {
    $("#billDate").val(new Date().toISOString().split("T")[0]);
    console.log("Bill date set to today");
  });

  // Service Search and Dropdown
  let services = [];
  let isFetchingServices = false;
  function fetchServices(attempt = 1, maxAttempts = 3) {
    if (isFetchingServices) return;
    isFetchingServices = true;
    $(".service-search, .dropdown-toggle").prop("disabled", true);
    $.ajax({
      url: `${API_BASE_URL}/service/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        console.log("Raw API response for services:", data);
        let rawServices = [];
        if (Array.isArray(data.results)) {
          rawServices = data.results;
        } else if (Array.isArray(data)) {
          rawServices = data;
        } else if (data && Array.isArray(data.services)) {
          rawServices = data.services;
        } else {
          console.error("Unexpected service data format:", data);
          services = [];
          return;
        }
        services = rawServices.map(service => ({
          id: service.id,
          name: service.service_name || service.name || "Unknown Service",
          price: service.service_price || service.price || 0,
          code: service.code || "",
          doctor_details: service.doctor_details || []
        }));
        console.log(`Fetched ${services.length} services for autocomplete`, services);
      },
      error: function (xhr) {
        console.error(`Failed to fetch services (attempt ${attempt}): ${xhr.status} ${xhr.statusText}`, xhr.responseJSON);
        if (attempt < maxAttempts) {
          setTimeout(() => fetchServices(attempt + 1, maxAttempts), 1000);
        } else {
          services = [];
          alert("Failed to load services after multiple attempts. Please try again later.");
        }
      },
      complete: function () {
        isFetchingServices = false;
        $(".service-search, .dropdown-toggle").prop("disabled", false);
      }
    });
  }

  function populateDoctorOptions($select, allDoctors, selectedDoctors) {
    $.ajax({
      url: `${API_BASE_URL}/appointments/doctors/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        $select.empty().append('<option value="all">All Doctors</option>');
        const doctors = Array.isArray(data.doctors) ? data.doctors : [];
        doctors.forEach(doctor => {
          if (doctor.id && doctor.first_name) {
            $select.append(
              `<option value="${doctor.id}" ${selectedDoctors.includes(doctor.id) ? 'selected' : ''}>
                ${doctor.first_name} ${doctor.last_name || ''}
              </option>`
            );
          }
        });
        // Set initial value
        if (allDoctors) {
          $select.val(['all']);
        } else {
          $select.val(selectedDoctors.map(id => id.toString()));
        }
      },
      error: function (xhr) {
        console.error(`Failed to fetch doctors for dropdown: ${xhr.status}`, xhr.responseJSON);
        $select.empty().append('<option value="" disabled>Failed to load doctors</option>');
      }
    });
  }

  function updateService(serviceId, data, $row) {
    $.ajax({
      url: `${API_BASE_URL}/service/update/${serviceId}/`,
      type: "PATCH",
      headers: getAuthHeaders(),
      data: JSON.stringify(data),
      contentType: "application/json",
      success: function (response) {
        console.log(`✅ Updated service ${serviceId}:`, response);
        alert("Service updated successfully!");
        // Update the display value
        const $cell = $row.find('.editing');
        const field = $cell.data('field');
        const $display = $cell.find('.display-value');
        if (field === 'name') {
          $display.text(response.service_name || response.name);
        } else if (field === 'code') {
          $display.text(response.code || 'N/A');
        } else if (field === 'price') {
          $display.text(`₹${parseFloat(response.service_price || response.price).toFixed(2)}`);
        } else if (field === 'color_code') {
          $display.html(`<span style="display: inline-block; width: 20px; height: 20px; background-color: ${response.color_code}; border: 1px solid #ccc;"></span>`);
        } else if (field === 'doctors') {
          const doctorNames = response.doctor_details && response.doctor_details.length
            ? response.doctor_details.map(d => `${d.first_name} ${d.last_name || ''}`.trim()).join(', ') || 'All Doctors'
            : 'N/A';
          $display.text(doctorNames);
        }
        // Store original value for future cancels
        $display.data('original-value', $cell.find('.edit-input').val());
        // Exit edit mode
        exitEditMode($row);
        // Refresh services for bill items
        fetchServices();
      },
      error: function (xhr) {
        console.error(`❌ Failed to update service ${serviceId}:`, xhr.responseJSON || xhr.statusText);
        alert(`Failed to update service: ${xhr.responseJSON?.error || "Unknown error"}`);
      }
    });
  }

  function exitEditMode($row) {
    const $cell = $row.find('.editing');
    $cell.find('.display-value').removeClass('d-none');
    $cell.find('.edit-input').addClass('d-none');
    $cell.removeClass('editing');
    $row.find('.edit-controls').addClass('d-none');
    $row.find('.edit-icon').removeClass('d-none');
  }


  function validateServiceField(field, value) {
    if (field === 'name' && !value.trim()) {
      return false; // Service name cannot be empty
    }
    if (field === 'code' && !value.trim()) {
      return false; // Service code cannot be empty
    }
    if (field === 'price' && (isNaN(value) || value < 0)) {
      return false; // Price must be a non-negative number
    }
    if (field === 'color_code' && !value.match(/^#[0-9A-Fa-f]{6}$/)) {
      return false; // Must be a valid hex color
    }
    if (field === 'doctors' && (!Array.isArray(value) || value.length === 0)) {
      return false; // At least one doctor or 'All Doctors' must be selected
    }
    return true;
  }
  // Fetch services on page load
  fetchServices();

  function populateServicesTable() {
    $.ajax({
      url: `${API_BASE_URL}/service/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        let rawServices = [];
        if (Array.isArray(data.results)) {
          rawServices = data.results;
        } else if (Array.isArray(data)) {
          rawServices = data;
        } else if (data && Array.isArray(data.services)) {
          rawServices = data.services;
        } else {
          console.error("Unexpected service data format:", data);
          rawServices = [];
        }
  
        const $tbody = $("#servicesTableBody");
        $tbody.empty();
  
        if (!rawServices.length) {
          $tbody.append('<tr><td colspan="6" class="text-center">No services found.</td></tr>');
          console.log("No services to display in table");
          return;
        }
  
        rawServices.forEach((service, index) => {
          const doctorNames = service.doctor_details && service.doctor_details.length
            ? service.doctor_details.map(d => `${d.first_name} ${d.last_name || ''}`.trim()).join(', ') || 'All Doctors'
            : 'N/A';
          const serviceId = service.id; // Ensure service ID is captured
          const $row = $(`
            <tr data-service-id="${serviceId}">
              <td>${index + 1}</td>
              <td class="editable" data-field="name">
                <span class="display-value">${service.service_name || service.name || 'Unknown Service'}</span>
                <input type="text" class="edit-input form-control form-control-sm d-none" value="${service.service_name || service.name || ''}">
                <i class="fas fa-edit edit-icon ms-2"></i>
              </td>
              <td class="editable" data-field="code">
                <span class="display-value">${service.code || 'N/A'}</span>
                <input type="text" class="edit-input form-control form-control-sm d-none" value="${service.code || ''}">
                <i class="fas fa-edit edit-icon ms-2"></i>
              </td>
              <td class="editable" data-field="price">
                <span class="display-value">₹${parseFloat(service.service_price || service.price || 0).toFixed(2)}</span>
                <input type="number" step="0.01" min="0" class="edit-input form-control form-control-sm d-none" value="${parseFloat(service.service_price || service.price || 0).toFixed(2)}">
                <i class="fas fa-edit edit-icon ms-2"></i>
              </td>
              <td class="editable" data-field="color_code">
                <span class="display-value">
                  <span style="display: inline-block; width: 20px; height: 20px; background-color: ${service.color_code || '#000000'}; border: 1px solid #ccc;"></span>
                </span>
                <input type="color" class="edit-input form-control form-control-sm d-none" value="${service.color_code || '#000000'}">
                <i class="fas fa-edit edit-icon ms-2"></i>
              </td>
              <td class="editable" data-field="doctors">
                <span class="display-value">${doctorNames}</span>
                <select multiple class="edit-input form-select form-select-sm d-none" data-original-value="${service.all_doctors ? 'all' : service.doctors.join(',')}">
                  <!-- Options populated dynamically -->
                </select>
                <i class="fas fa-edit edit-icon ms-2"></i>
              </td>
              <td class="edit-controls d-none">
                <button class="btn btn-success btn-sm save-edit me-1"><i class="fas fa-check"></i></button>
                <button class="btn btn-secondary btn-sm cancel-edit"><i class="fas fa-times"></i></button>
              </td>
            </tr>
          `);
          $tbody.append($row);
  
          // Populate doctor dropdown for editing
          populateDoctorOptions($row.find('select.edit-input'), service.all_doctors, service.doctors);
        });
  
        console.log(`Populated services table with ${rawServices.length} entries`);
  
        // Bind edit icon click event
        $tbody.find('.edit-icon').on('click', function () {
          const $cell = $(this).closest('td');
          const $row = $cell.closest('tr');
          const field = $cell.data('field');
  
          // Exit if another cell is being edited
          if ($tbody.find('.editing').length && !$cell.hasClass('editing')) {
            alert('Please save or cancel the current edit before editing another field.');
            return;
          }
  
          // Toggle edit mode for this cell
          $cell.addClass('editing');
          $row.find('.edit-controls').removeClass('d-none');
          $cell.find('.display-value').addClass('d-none');
          $cell.find('.edit-input').removeClass('d-none').focus();
  
          // Hide edit icons in other cells
          $row.find('.edit-icon').addClass('d-none');
        });
  
        // Bind save button click event
        $tbody.find('.save-edit').on('click', function () {
          const $row = $(this).closest('tr');
          const serviceId = $row.data('service-id');
          const $cell = $row.find('.editing');
          const field = $cell.data('field');
          const $input = $cell.find('.edit-input');
          let newValue = $input.val();
  
          // Validate input
          if (!validateServiceField(field, newValue)) {
            alert(`Invalid value for ${field}.`);
            return;
          }
  
          // Format new value based on field
          if (field === 'doctors') {
            newValue = $input.val().includes('all') ? { all_doctors: true, doctors: [] } : { all_doctors: false, doctors: $input.val().map(id => parseInt(id)) };
          } else if (field === 'price') {
            newValue = parseFloat(newValue);
          }
  
          // Prepare data for PATCH request
          const updateData = field === 'doctors' ? newValue : { [field]: newValue };
  
          // Send update to server
          updateService(serviceId, updateData, $row);
        });
  
        // Bind cancel button click event
        $tbody.find('.cancel-edit').on('click', function () {
          const $row = $(this).closest('tr');
          const $cell = $row.find('.editing');
          const field = $cell.data('field');
          const $input = $cell.find('.edit-input');
          const $display = $cell.find('.display-value');
  
          // Reset input to original value
          if (field === 'doctors') {
            const originalValue = $input.data('original-value').split(',');
            $input.val(originalValue);
          } else {
            $input.val($display.data('original-value') || $input.val());
          }
  
          // Exit edit mode
          exitEditMode($row);
        });
      },
      error: function (xhr) {
        console.error(`Failed to fetch services for table: ${xhr.status} ${xhr.statusText}`, xhr.responseJSON);
        $("#servicesTableBody").empty().append('<tr><td colspan="6" class="text-center">Failed to load services.</td></tr>');
      }
    });
  }

  function populateServiceDropdown($dropdown, servicesToShow) {
    $dropdown.empty();
    if (isFetchingServices) {
      $dropdown.append('<li><a class="dropdown-item disabled">Loading services...</a></li>');
      return;
    }
    const validServices = servicesToShow.filter(
      s => s.id && s.name && typeof s.price !== "undefined"
    );
    if (!validServices.length) {
      $dropdown.append(
        '<li><a class="dropdown-item disabled">No services available. <a href="#" class="add-service-link">Add a service</a>.</a></li>'
      );
      $dropdown.on("click", ".add-service-link", function (e) {
        e.preventDefault();
        $("#addServiceTab").tab("show");
        $dropdown.removeClass("show");
      });
      return;
    }
    validServices.forEach(service => {
      $dropdown.append(
        `<li><a class="dropdown-item" href="#" data-service-id="${service.id}" data-price="${service.price}">${service.name}</a></li>`
      );
    });
  }

  // Handle service search input
  $(document).on("input", ".service-search", function () {
    const $input = $(this);
    const query = $input.val().toLowerCase().trim();
    const $dropdown = $input.closest(".input-group").find(".autocomplete-dropdown");

    populateServiceDropdown($dropdown, query ? services.filter(s => s.name && s.name.toLowerCase().includes(query)) : services);
    $dropdown.addClass("show");
  });

  // Handle dropdown toggle button click
  $(document).on("click", ".input-group .dropdown-toggle", function (e) {
    e.preventDefault();
    const $button = $(this);
    const $dropdown = $button.closest(".input-group").find(".autocomplete-dropdown");
    const $input = $button.closest(".input-group").find(".service-search");

    if (!$dropdown.hasClass("show")) {
      populateServiceDropdown($dropdown, services);
      $dropdown.addClass("show");
      $input.focus();
    } else {
      $dropdown.removeClass("show");
    }
  });


  // Handle service selection
  // Update service selection to populate service code
  $(document).on("click", ".autocomplete-dropdown .dropdown-item:not(.disabled)", function (e) {
    e.preventDefault();
    const $li = $(this);
    const $input = $li.closest(".input-group").find(".service-search");
    const $row = $li.closest("tr");
    const serviceId = $li.data("service-id");
    const service = services.find(s => s.id == serviceId);
    $input.val($li.text()).data("service-id", serviceId);
    $row.find(".unit-price").val($li.data("price"));
    $row.find(".service-id").val(serviceId);
    $row.find(".service-code").val(service ? service.code : ""); // Set service code
    updateTotalPrice($row);
    $li.closest(".autocomplete-dropdown").removeClass("show");
  });

  // Hide dropdown when clicking outside
  $(document).on("click", function (e) {
    if (!$(e.target).closest(".input-group, .autocomplete-dropdown").length) {
      $(".autocomplete-dropdown").removeClass("show");
    }
  });


  function populateDoctorDropdownForBill() {
    const doctorSelect = $("#billDoctor");
    doctorSelect.empty().append('<option value="" selected>Select Doctor</option>');
    doctorSelect.append('<option value="" disabled>Loading doctors...</option>');
  
    $.ajax({
      url: `${API_BASE_URL}/appointments/doctors/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        console.log("Doctor API response for billDoctor:", data); // Log for debugging
        doctorSelect.empty().append('<option value="" selected>Select Doctor</option>');
  
        const doctors = Array.isArray(data.doctors) ? data.doctors : [];
        if (doctors.length === 0) {
          console.warn("No doctors returned from API");
          doctorSelect.append('<option value="" disabled>No doctors available</option>');
        } else {
          doctors.forEach(doctor => {
            if (doctor.id && doctor.first_name) {
              doctorSelect.append(
                `<option value="${doctor.id}">${doctor.first_name} ${doctor.last_name || ''}</option>`
              );
            } else {
              console.warn("Skipping invalid doctor entry:", doctor);
            }
          });
        }
        
      },
      error: function (xhr) {
        console.error(`Failed to fetch doctors for billDoctor: ${xhr.status}`, xhr.responseJSON);
        doctorSelect.empty().append('<option value="" selected>Select Doctor</option>');
        doctorSelect.append('<option value="" disabled>Failed to load doctors</option>');
        alert("Failed to fetch doctors. Please check your connection or try again.");
      }
    });
  }

  // Add Bill Item
  let itemCount = 0;
  // Add Bill Item
  $("#addBillItem").on("click", function () {
    itemCount++;
    const newRow = `
      <tr>
        <td class="item-number">${itemCount}</td>
        <td>
          <div class="input-group input-group-sm">
            <span class="input-group-text"><i class="fas fa-concierge-bell"></i></span>
            <input type="text" class="form-control service-search" name="service_name[]" placeholder="Search or select service" required autocomplete="off">
            <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false"></button>
            <ul class="dropdown-menu autocomplete-dropdown" style="width: 100%; max-height: 200px; overflow-y: auto;"></ul>
            <input type="hidden" name="service_id[]" class="service-id">
          </div>
        </td>
        <td><input type="text" class="form-control form-control-sm service-code" name="service_code[]" readonly></td>
        <td><input type="number" class="form-control form-control-sm" name="quantity[]" min="1" value="1" required></td>
        <td><input type="number" class="form-control form-control-sm unit-price" name="unit_price[]" min="0" step="0.01" required readonly></td>
        <td><input type="number" class="form-control form-control-sm gst" name="gst[]" min="0" max="100" step="0.01" value="0" required></td>
        <td><input type="number" class="form-control form-control-sm discount" name="discount[]" min="0" step="0.01" value="0" required></td>
        <td><input type="number" class="form-control form-control-sm total-price" name="total_price[]" min="0" step="0.01" readonly style="color: red;"></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-bill-item"><i class="fas fa-trash"></i></button></td>
      </tr>`;
    $("#billItemsTableBody").append(newRow);
    console.log(`Added bill item #${itemCount}`);
  });

  // Remove Bill Item and Re-number
  $(document).on("click", ".remove-bill-item", function () {
    $(this).closest("tr").remove();
    itemCount--;
    renumberBillItems();
    updateTotalBillAmount();
    updateDepositColor();
    console.log(`Removed bill item. New count: ${itemCount}`);
  });

  // Re-number Bill Items
  function renumberBillItems() {
    $("#billItemsTableBody tr").each(function (index) {
      $(this).find(".item-number").text(index + 1);
    });
  }

  function updateTotalPrice($row) {
    const qty = parseFloat($row.find("[name='quantity[]']").val()) || 0;
    const unitPrice = parseFloat($row.find(".unit-price").val()) || 0;
    const gst = parseFloat($row.find(".gst").val()) || 0;
    const discount = parseFloat($row.find(".discount").val()) || 0;
    const total = (qty * unitPrice * (1 + gst / 100)) - discount;
    $row.find(".total-price").val(total.toFixed(2));
    updateTotalBillAmount();
    updateDepositColor();
  }

  function updateTotalBillAmount() {
    const total = Array.from($(".total-price")).reduce((sum, el) => sum + (parseFloat($(el).val()) || 0), 0);
    $("#totalAmount").val(total.toFixed(2));
  }

  function updateDepositColor() {
    const total = parseFloat($("#totalAmount").val()) || 0;
    const deposit = parseFloat($("#depositAmount").val()) || 0;
    $("#depositAmount").css("color", deposit >= total ? "green" : "red");
  }

  $(document).on("input", "[name='quantity[]'], .gst, .discount, #depositAmount", function () {
    updateTotalPrice($(this).closest("tr"));
    updateDepositColor();
  });

  function showAppointmentDatePopup(callback) {
    const modal = $(`
      <div class="modal fade" id="appointmentDateModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Select Appointment Date</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label for="appointmentDateInput" class="form-label">Appointment Date and Time</label>
                <input type="text" class="form-control custom-datetime-picker" id="appointmentDateInput">
              </div>
              <div class="mb-3">
                <label for="billDoctor" class="form-label">Doctor</label>
                <select class="form-select" id="billDoctor" name="doctor_id"></select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="confirmAppointmentDate">Confirm</button>
            </div>
          </div>
        </div>
      </div>
    `);
  
    $('body').append(modal);
    const bsModal = new bootstrap.Modal(modal[0]);
    bsModal.show();
  
    // Initialize Flatpickr with future date enforcement
    const appointmentDatePicker = flatpickr("#appointmentDateInput", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      altInput: true,
      altFormat: "F j, Y, h:i K",
      minDate: "today", // Prevent past dates
      defaultDate: new Date(Date.now() + 30 * 60 * 1000), // Default to 30 minutes from now
      time_24hr: false,
      allowInput: true,
      onReady: function(selectedDates, dateStr, instance) {
        const buttonContainer = document.createElement("div");
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "center";
        buttonContainer.style.gap = "10px";
        buttonContainer.style.padding = "5px";
  
        const confirmButton = document.createElement("button");
        confirmButton.innerText = "OK";
        confirmButton.className = "flatpickr-confirm";
        confirmButton.onclick = function() {
          if (selectedDates.length > 0) {
            instance.close();
            $("#appointmentDateInput").removeClass("is-invalid");
          }
        };
  
        const clearButton = document.createElement("button");
        clearButton.innerText = "Clear";
        clearButton.className = "flatpickr-clear";
        clearButton.onclick = function() {
          instance.clear();
          $("#appointmentDateInput").val("");
          $("#appointmentDateInput").removeClass("is-invalid");
          instance.close();
        };
  
        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(clearButton);
        instance.calendarContainer.appendChild(buttonContainer);
      },
      onClose: function(selectedDates, dateStr, instance) {
        if (selectedDates.length === 0) {
          $("#appointmentDateInput").val("");
          console.log("Cleared #appointmentDateInput on close due to no selection");
        }
      },
      onChange: function(selectedDates, dateStr, instance) {
        const selectedDate = selectedDates[0];
        const now = new Date();
        if (selectedDate && selectedDate < now) {
          alert("Please select a future date and time.");
          instance.clear();
          $("#appointmentDateInput").val("");
        }
      }
    });
  
    populateDoctorDropdownForBill();
  
    $("#confirmAppointmentDate").on("click", function () {
      const date = appointmentDatePicker.selectedDates[0];
      const doctorId = $("#billDoctor").val();
      if (!date || !doctorId) {
        alert("Please select both an appointment date and a doctor.");
        return;
      }
      const now = new Date();
      if (date < now) {
        alert("Selected date is in the past. Please choose a future date.");
        return;
      }
      const formattedDate = flatpickr.formatDate(date, "Y-m-d H:i");
      $("#billAppointmentDate").val(formattedDate);
      callback(formattedDate, doctorId);
      bsModal.hide();
      modal.remove();
    });
  
    modal.on('hidden.bs.modal', function () {
      appointmentDatePicker.destroy();
      modal.remove();
    });
  }
// main.js
function showBillDetails(billId) {
  $.ajax({
    url: `${API_BASE_URL}/bills/list/?bill_id=${billId}`,
    type: "GET",
    headers: getAuthHeaders(),
    success: function (data) {
      console.log(`📋 Fetched bill details for ID ${billId}:`, data);
      const bill = data.bills && data.bills.length > 0 ? data.bills[0] : null;
      if (!bill) {
        alert("Bill not found.");
        return;
      }

      // Create modal
      const modal = $(`
        <div class="modal fade" id="billDetailsModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Bill Details - ${bill.bill_id}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <p><strong>Patient ID:</strong> ${bill.patient_id || 'N/A'}</p>
                <p><strong>Date:</strong> ${bill.created_at ? new Date(bill.created_at).toLocaleString() : 'N/A'}</p>
                <p><strong>Status:</strong> ${bill.status || 'N/A'}</p>
                <p><strong>Total Amount:</strong> ₹${parseFloat(bill.total_amount || 0).toFixed(2)}</p>
                <p><strong>Deposit Amount:</strong> ₹${parseFloat(bill.deposit_amount || 0).toFixed(2)}</p>
                <p><strong>Notes:</strong> ${bill.notes || 'N/A'}</p>
                <h6>Items:</h6>
                <table class="table table-bordered">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Service</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                      <th>GST (%)</th>
                      <th>Discount</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${bill.items.map((item, index) => `
                      <tr>
                        <td>${index + 1}</td>
                        <td>Service ID: ${item.service_id}</td>
                        <td>${item.quantity}</td>
                        <td>₹${parseFloat(item.unit_price).toFixed(2)}</td>
                        <td>${parseFloat(item.gst).toFixed(2)}</td>
                        <td>₹${parseFloat(item.discount).toFixed(2)}</td>
                        <td>₹${parseFloat(item.total_price).toFixed(2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>
      `);

      $('body').append(modal);
      const bsModal = new bootstrap.Modal(modal[0]);
      bsModal.show();

      modal.on('hidden.bs.modal', function () {
        modal.remove();
      });
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch bill ${billId}:`, xhr.responseJSON || xhr.statusText);
      alert(`Failed to fetch bill details: ${xhr.responseJSON?.error || "Unknown error"}`);
    }
  });
}
  // main.js
// main.js
// main.js
function populateBillsTable(bills, page = 1, pageSize = 10) {
  const $tbody = $('#billsTable tbody');
  $tbody.empty();

  if (!bills.length) {
    $tbody.append('<tr><td colspan="9" class="text-center">No bills found.</td></tr>');
    $('#billsTableInfo').text('Showing 0 of 0 entries');
    console.log(`ℹ️ No bills to display`);
    return;
  }

  const startIndex = (page - 1) * pageSize;
  const paginatedBills = bills.slice(startIndex, startIndex + pageSize);

  paginatedBills.forEach((bill, index) => {
    const patientName = bill.patient_id ? `Patient ID: ${bill.patient_id}` : 'Unknown';
    const billDate = bill.created_at
      ? new Date(bill.created_at).toLocaleDateString()
      : 'N/A';
    const statusClass = bill.status
      ? `status-${bill.status.toLowerCase().replace(' ', '-')}`
      : 'status-unknown';
    const amountClass = bill.status
      ? `amount-${bill.status.toLowerCase().replace(' ', '-')}`
      : 'amount-unknown';
    const totalAmount = bill.total_amount
      ? `<span class="${amountClass}">₹${parseFloat(bill.total_amount).toFixed(2)}</span>`
      : 'N/A';
    const depositAmount = bill.deposit_amount
      ? `₹${parseFloat(bill.deposit_amount).toFixed(2)}`
      : '₹0.00';

    console.log(`📄 Rendering bill with ID: ${bill.bill_id}`); // Added logging

    const $row = $(`
      <tr>
        <td>
          <button class="btn btn-sm btn-outline-warning edit-bill" data-bill-id="${bill.bill_id}">
            <i class="fas fa-edit"></i> Edit
          </button>
        </td>
        <td>${startIndex + index + 1}</td>
        <td>${bill.bill_id || 'N/A'}</td>
        <td>${patientName}</td>
        <td>${billDate}</td>
        <td><span class="${statusClass}">${bill.status.toUpperCase()}</span></td>
        <td>${totalAmount}</td>
        <td>${depositAmount}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary view-bill" data-bill-id="${bill.bill_id}">
            <i class="fas fa-eye"></i> View
          </button>
        </td>
      </tr>
    `);
    $tbody.append($row);
  });

  // Update table info
  const totalEntries = bills.length;
  const showingStart = startIndex + 1;
  const showingEnd = Math.min(startIndex + paginatedBills.length, totalEntries);
  $('#billsTableInfo').text(`Showing ${showingStart} to ${showingEnd} of ${totalEntries} entries`);

  // Bind button click events
  $tbody.find('.view-bill').on('click', function () {
    const billId = $(this).data('bill-id');
    console.log(`🖱️ View bill clicked for ID: ${billId}`); // Added logging
    showBillDetails(billId);
  });

  $tbody.find('.edit-bill').on('click', function () {
    const billId = $(this).data('bill-id');
    console.log(`🖱️ Edit bill clicked for ID: ${billId}`); // Added logging
    editBill(billId);
  });

  console.log(`✅ Populated bills table with ${paginatedBills.length} bills (page ${page})`);
}

// Edit bill 
// main.js
function editBill(billId) {
  if (!billId) {
    console.error("❌ Invalid billId provided:", billId);
    alert("Cannot edit bill: Invalid bill ID.");
    return;
  }

  $.ajax({
    url: `${API_BASE_URL}/bills/list/?bill_id=${encodeURIComponent(billId)}`,
    type: "GET",
    headers: getAuthHeaders(),
    success: function (data) {
      console.log(`📋 Fetched bill details for editing ID ${billId}:`, data);
      const bill = data.bills && data.bills.length > 0 ? data.bills[0] : null;
      if (!bill) {
        console.error(`❌ No bill found with ID ${billId}`);
        alert("Bill not found.");
        return;
      }

      // Fetch services for bill items
      const serviceIds = bill.items.map(item => item.service_id).join(',');
      let servicePromise = serviceIds
        ? $.ajax({
            url: `${API_BASE_URL}/service/search/?service_ids=${encodeURIComponent(serviceIds)}`,
            type: "GET",
            headers: getAuthHeaders()
          })
        : Promise.resolve({ services: [] });

      // Fetch all services for autocomplete
      let allServicesPromise = new Promise((resolve, reject) => {
        if (services.length > 0) {
          resolve({ services });
        } else {
          fetchServices()
            .then(() => resolve({ services }))
            .catch(reject);
        }
      });

      // Fetch associated appointment
      let appointmentPromise = bill.appointment_id
        ? $.ajax({
            url: `${API_BASE_URL}/appointments/list/?appointment_id=${encodeURIComponent(bill.appointment_id)}`,
            type: "GET",
            headers: getAuthHeaders()
          })
        : Promise.resolve({ appointments: [] });

      // Wait for all promises
      Promise.all([servicePromise, allServicesPromise, appointmentPromise])
        .then(([serviceData, allServicesData, appointmentData]) => {
          const services = serviceData.services || [];
          const allServices = allServicesData.services || [];
          let appointment = appointmentData.appointments && appointmentData.appointments.length > 0
            ? appointmentData.appointments[0]
            : null;

          // Normalize appointment data
          if (appointment && appointment.appointment_date) {
            const apptDate = new Date(appointment.appointment_date);
            appointment.date = apptDate.toISOString().split('T')[0]; // YYYY-MM-DD
            appointment.time = apptDate.toTimeString().slice(0, 5); // HH:MM
            appointment.appointment_id = appointment.id;
          }

          // Map services to items
          const serviceMap = {};
          services.forEach(service => {
            serviceMap[service.id] = {
              id: service.id,
              name: service.service_name || service.name || 'Unknown Service',
              price: service.service_price || service.price || 0
            };
          });

          // Create edit modal
          const modal = $(`
            <div class="modal fade" id="editBillModal" tabindex="-1">
              <div class="modal-dialog modal-lg">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title">Edit Bill - ${bill.bill_id}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                  </div>
                  <div class="modal-body">
                    <form id="editBillForm">
                      <div class="mb-3">
                        <label for="editBillPatientId" class="form-label">Patient ID</label>
                        <input type="text" class="form-control" id="editBillPatientId" value="${bill.patient_id || ''}" required>
                      </div>
                      <div class="mb-3">
                        <label for="editBillStatus" class="form-label">Status</label>
                        <select class="form-control" id="editBillStatus" required>
                          <option value="Paid" ${bill.status === 'Paid' ? 'selected' : ''}>Paid</option>
                          <option value="Partially Paid" ${bill.status === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
                          <option value="Pending" ${bill.status === 'Pending' ? 'selected' : ''}>Pending</option>
                          <option value="Canceled" ${bill.status === 'Canceled' ? 'selected' : ''}>Canceled</option>
                        </select>
                      </div>
                      <div class="mb-3">
                        <label for="editBillTotalAmount" class="form-label">Total Amount</label>
                        <input type="number" step="0.01" class="form-control" id="editBillTotalAmount" value="${bill.total_amount || ''}" required>
                      </div>
                      <div class="mb-3">
                        <label for="editBillDepositAmount" class="form-label">Deposit Amount</label>
                        <input type="number" step="0.01" class="form-control" id="editBillDepositAmount" value="${bill.deposit_amount || '0'}" required>
                      </div>
                      <div class="mb-3">
                        <label for="editBillNotes" class="form-label">Notes</label>
                        <textarea class="form-control" id="editBillNotes">${bill.notes || ''}</textarea>
                      </div>
                      ${
                        appointment
                          ? `
                          <!-- Appointment Details -->
                          <h6>Associated Appointment</h6>
                          <div class="mb-3">
                            <label for="editAppointmentId" class="form-label">Appointment ID</label>
                            <input type="text" class="form-control" id="editAppointmentId" value="${appointment.appointment_id || ''}" readonly>
                          </div>
                          <div class="mb-3">
                            <label for="editAppointmentDate" class="form-label">Appointment Date</label>
                            <input type="date" class="form-control" id="editAppointmentDate" value="${appointment.date || ''}">
                          </div>
                          <div class="mb-3">
                            <label for="editAppointmentTime" class="form-label">Appointment Time</label>
                            <input type="time" class="form-control" id="editAppointmentTime" value="${appointment.time || ''}">
                          </div>
                          <div class="mb-3">
                            <label for="editAppointmentStatus" class="form-label">Appointment Status</label>
                            <select class="form-control" id="editAppointmentStatus">
                              <option value="Scheduled" ${appointment.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                              <option value="Completed" ${appointment.status === 'Completed' ? 'selected' : ''}>Completed</option>
                              <option value="Cancelled" ${appointment.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                          </div>
                          `
                          : ''
                      }
                      <!-- Bill Items -->
                      <h6>Bill Items</h6>
                      <div id="editBillItems">
                        ${bill.items.map((item, index) => {
                          const service = serviceMap[item.service_id];
                          return `
                            <div class="row mb-2 bill-item-row">
                              <div class="col-md-3">
                                <input type="hidden" class="service-id" name="item_service_id_${index}" value="${item.service_id}">
                                <input type="text" class="form-control service-search" name="item_service_name_${index}" value="${service ? service.name : item.service_id}" placeholder="Search Service" required>
                              </div>
                              <div class="col-md-2">
                                <input type="number" class="form-control item-quantity" name="item_quantity_${index}" value="${item.quantity}" placeholder="Quantity" required min="1">
                              </div>
                              <div class="col-md-2">
                                <input type="number" step="0.01" class="form-control item-unit-price" name="item_unit_price_${index}" value="${item.unit_price}" placeholder="Unit Price" required min="0">
                              </div>
                              <div class="col-md-2">
                                <input type="number" step="0.01" class="form-control item-gst" name="item_gst_${index}" value="${item.gst}" placeholder="GST (%)" min="0">
                              </div>
                              <div class="col-md-2">
                                <input type="number" step="0.01" class="form-control item-discount" name="item_discount_${index}" value="${item.discount}" placeholder="Discount" min="0">
                              </div>
                              <div class="col-md-1">
                                <button type="button" class="btn btn-danger btn-sm remove-item"><i class="fas fa-trash"></i></button>
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-primary add-item"><i class="fas fa-plus"></i> Add Item</button>
                    </form>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="saveBillChanges">Save Changes</button>
                  </div>
                </div>
              </div>
            </div>
          `);

          $('body').append(modal);
          const bsModal = new bootstrap.Modal(modal[0]);
          bsModal.show();

          // Initialize autocomplete for service search
          modal.find('.service-search').each(function () {
            $(this).autocomplete({
              source: function (request, response) {
                const term = request.term.toLowerCase();
                const filteredServices = allServices.filter(service =>
                  service.name.toLowerCase().includes(term) ||
                  service.code.toLowerCase().includes(term)
                );
                response(filteredServices.map(service => ({
                  label: `${service.name} (${service.code})`,
                  value: service.name,
                  id: service.id
                })));
              },
              minLength: 2,
              select: function (event, ui) {
                const $row = $(this).closest('.bill-item-row');
                $row.find('.service-id').val(ui.item.id);
                $row.find('.item-unit-price').val(ui.item.id in serviceMap ? serviceMap[ui.item.id].price : 0);
                calculateTotalAmount();
              }
            });
          });

          // Add item dynamically
          modal.find('.add-item').on('click', function () {
            const itemCount = modal.find('#editBillItems .row').length;
            const newItem = `
              <div class="row mb-2 bill-item-row">
                <div class="col-md-3">
                  <input type="hidden" class="service-id" name="item_service_id_${itemCount}">
                  <input type="text" class="form-control service-search" name="item_service_name_${itemCount}" placeholder="Search Service" required>
                </div>
                <div class="col-md-2">
                  <input type="number" class="form-control item-quantity" name="item_quantity_${itemCount}" placeholder="Quantity" required min="1">
                </div>
                <div class="col-md-2">
                  <input type="number" step="0.01" class="form-control item-unit-price" name="item_unit_price_${itemCount}" placeholder="Unit Price" required min="0">
                </div>
                <div class="col-md-2">
                  <input type="number" step="0.01" class="form-control item-gst" name="item_gst_${itemCount}" placeholder="GST (%)" min="0">
                </div>
                <div class="col-md-2">
                  <input type="number" step="0.01" class="form-control item-discount" name="item_discount_${itemCount}" placeholder="Discount" min="0">
                </div>
                <div class="col-md-1">
                  <button type="button" class="btn btn-danger btn-sm remove-item"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            `;
            modal.find('#editBillItems').append(newItem);

            // Initialize autocomplete for new item
            modal.find(`[name="item_service_name_${itemCount}"]`).autocomplete({
              source: function (request, response) {
                const term = request.term.toLowerCase();
                const filteredServices = allServices.filter(service =>
                  service.name.toLowerCase().includes(term) ||
                  service.code.toLowerCase().includes(term)
                );
                response(filteredServices.map(service => ({
                  label: `${service.name} (${service.code})`,
                  value: service.name,
                  id: service.id
                })));
              },
              minLength: 2,
              select: function (event, ui) {
                const $row = $(this).closest('.bill-item-row');
                $row.find('.service-id').val(ui.item.id);
                $row.find('.item-unit-price').val(ui.item.id in serviceMap ? serviceMap[ui.item.id].price : 0);
                calculateTotalAmount();
              }
            });
          });

          // Remove item
          modal.find('.remove-item').on('click', function () {
            $(this).closest('.row').remove();
            calculateTotalAmount();
          });

          // Calculate total amount on input change
          modal.find('#editBillItems').on('input', '.item-quantity, .item-unit-price, .item-gst, .item-discount', calculateTotalAmount);

          function calculateTotalAmount() {
            let total = 0;
            modal.find('.bill-item-row').each(function () {
              const $row = $(this);
              const quantity = parseInt($row.find('.item-quantity').val()) || 0;
              const unitPrice = parseFloat($row.find('.item-unit-price').val()) || 0;
              const gst = parseFloat($row.find('.item-gst').val()) || 0;
              const discount = parseFloat($row.find('.item-discount').val()) || 0;
              const itemTotal = (quantity * unitPrice * (1 + gst / 100)) - discount;
              total += itemTotal;
            });
            modal.find('#editBillTotalAmount').val(total.toFixed(2));
          }

          // Save changes
          modal.find('#saveBillChanges').on('click', function () {
            const updatedBill = {
              bill_id: bill.bill_id,
              patient_id: modal.find('#editBillPatientId').val(),
              status: modal.find('#editBillStatus').val(),
              total_amount: parseFloat(modal.find('#editBillTotalAmount').val()),
              deposit_amount: parseFloat(modal.find('#editBillDepositAmount').val()),
              notes: modal.find('#editBillNotes').val(),
              items: []
            };

            // Collect bill items
            let hasErrors = false;
            modal.find('.bill-item-row').each(function () {
              const $row = $(this);
              const serviceId = $row.find('.service-id').val();
              const quantity = parseInt($row.find('.item-quantity').val()) || 0;
              const unitPrice = parseFloat($row.find('.item-unit-price').val()) || 0;
              const gst = parseFloat($row.find('.item-gst').val()) || 0;
              const discount = parseFloat($row.find('.item-discount').val()) || 0;
              const totalPrice = (quantity * unitPrice * (1 + gst / 100)) - discount;

              if (!serviceId) {
                alert("Please select a valid service for all items.");
                hasErrors = true;
                return false;
              }
              if (quantity <= 0) {
                alert("Quantity must be greater than zero.");
                hasErrors = true;
                return false;
              }
              if (unitPrice <= 0) {
                alert("Unit price must be greater than zero.");
                hasErrors = true;
                return false;
              }

              updatedBill.items.push({
                service_id: serviceId,
                quantity: quantity,
                unit_price: unitPrice,
                gst: gst,
                discount: discount,
                total_price: totalPrice // Include total_price for compatibility
              });
            });

            if (hasErrors) {
              return;
            }

            // Update bill
            $.ajax({
              url: `${API_BASE_URL}/bills/update/`,
              type: "PUT",
              headers: getAuthHeaders(),
              data: JSON.stringify(updatedBill),
              contentType: "application/json",
              success: function (response) {
                console.log(`✅ Bill ${billId} updated successfully:`, response);

                // Update appointment if applicable
                if (appointment && modal.find('#editAppointmentId').val()) {
                  const updatedAppointment = {
                    appointment_id: modal.find('#editAppointmentId').val(),
                    date: modal.find('#editAppointmentDate').val(),
                    time: modal.find('#editAppointmentTime').val(),
                    status: modal.find('#editAppointmentStatus').val()
                  };

                  $.ajax({
                    url: `${API_BASE_URL}/appointments/update/`,
                    type: "PUT",
                    headers: getAuthHeaders(),
                    data: JSON.stringify(updatedAppointment),
                    contentType: "application/json",
                    success: function (response) {
                      console.log(`✅ Appointment ${updatedAppointment.appointment_id} updated successfully:`, response);
                      alert("Bill and appointment updated successfully!");
                      bsModal.hide();
                      fetchBills($('.bills-filter .nav-link.active').data('filter') || 'all');
                    },
                    error: function (xhr) {
                      console.error(`❌ Failed to update appointment:`, xhr.responseJSON || xhr.statusText);
                      alert(`Failed to update appointment: ${xhr.responseJSON?.error || "Unknown error"}`);
                    }
                  });
                } else {
                  alert("Bill updated successfully!");
                  bsModal.hide();
                  fetchBills($('.bills-filter .nav-link.active').data('filter') || 'all');
                }
              },
              error: function (xhr) {
                console.error(`❌ Failed to update bill ${billId}:`, xhr.responseJSON || xhr.statusText);
                alert(`Failed to update bill: ${xhr.responseJSON?.error || "Unknown error"}`);
              }
            });
          });

          modal.on('hidden.bs.modal', function () {
            modal.remove();
          });
        })
        .catch(error => {
          console.error(`❌ Failed to fetch services or appointment for bill ${billId}:`, error);
          alert("Failed to fetch services or associated appointment. Continuing with basic bill edit.");

          // Fallback modal without services or appointment
          const modal = $(`
            <div class="modal fade" id="editBillModal" tabindex="-1">
              <div class="modal-dialog modal-lg">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title">Edit Bill - ${bill.bill_id}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                  </div>
                  <div class="modal-body">
                    <form id="editBillForm">
                      <div class="mb-3">
                        <label for="editBillPatientId" class="form-label">Patient ID</label>
                        <input type="text" class="form-control" id="editBillPatientId" value="${bill.patient_id || ''}" required>
                      </div>
                      <div class="mb-3">
                        <label for="editBillStatus" class="form-label">Status</label>
                        <select class="form-control" id="editBillStatus" required>
                          <option value="Paid" ${bill.status === 'Paid' ? 'selected' : ''}>Paid</option>
                          <option value="Partially Paid" ${bill.status === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
                          <option value="Pending" ${bill.status === 'Pending' ? 'selected' : ''}>Pending</option>
                          <option value="Canceled" ${bill.status === 'Canceled' ? 'selected' : ''}>Canceled</option>
                        </select>
                      </div>
                      <div class="mb-3">
                        <label for="editBillTotalAmount" class="form-label">Total Amount</label>
                        <input type="number" step="0.01" class="form-control" id="editBillTotalAmount" value="${bill.total_amount || ''}" required>
                      </div>
                      <div class="mb-3">
                        <label for="editBillDepositAmount" class="form-label">Deposit Amount</label>
                        <input type="number" step="0.01" class="form-control" id="editBillDepositAmount" value="${bill.deposit_amount || '0'}" required>
                      </div>
                      <div class="mb-3">
                        <label for="editBillNotes" class="form-label">Notes</label>
                        <textarea class="form-control" id="editBillNotes">${bill.notes || ''}</textarea>
                      </div>
                      <!-- Bill Items -->
                      <h6>Bill Items</h6>
                      <div id="editBillItems">
                        ${bill.items.map((item, index) => `
                          <div class="row mb-2 bill-item-row">
                            <div class="col-md-3">
                              <input type="text" class="form-control" name="item_service_id_${index}" value="${item.service_id}" placeholder="Service ID" required>
                            </div>
                            <div class="col-md-2">
                              <input type="number" class="form-control" name="item_quantity_${index}" value="${item.quantity}" placeholder="Quantity" required min="1">
                            </div>
                            <div class="col-md-2">
                              <input type="number" step="0.01" class="form-control" name="item_unit_price_${index}" value="${item.unit_price}" placeholder="Unit Price" required min="0">
                            </div>
                            <div class="col-md-2">
                              <input type="number" step="0.01" class="form-control" name="item_gst_${index}" value="${item.gst}" placeholder="GST (%)" min="0">
                            </div>
                            <div class="col-md-2">
                              <input type="number" step="0.01" class="form-control" name="item_discount_${index}" value="${item.discount}" placeholder="Discount" min="0">
                            </div>
                            <div class="col-md-1">
                              <button type="button" class="btn btn-danger btn-sm remove-item"><i class="fas fa-trash"></i></button>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-primary add-item"><i class="fas fa-plus"></i> Add Item</button>
                    </form>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="saveBillChanges">Save Changes</button>
                  </div>
                </div>
              </div>
            </div>
          `);

          $('body').append(modal);
          const bsModal = new bootstrap.Modal(modal[0]);
          bsModal.show();

          // Add item dynamically (fallback)
          modal.find('.add-item').on('click', function () {
            const itemCount = modal.find('#editBillItems .row').length;
            const newItem = `
              <div class="row mb-2 bill-item-row">
                <div class="col-md-3">
                  <input type="text" class="form-control" name="item_service_id_${itemCount}" placeholder="Service ID" required>
                </div>
                <div class="col-md-2">
                  <input type="number" class="form-control" name="item_quantity_${itemCount}" placeholder="Quantity" required min="1">
                </div>
                <div class="col-md-2">
                  <input type="number" step="0.01" class="form-control" name="item_unit_price_${itemCount}" placeholder="Unit Price" required min="0">
                </div>
                <div class="col-md-2">
                  <input type="number" step="0.01" class="form-control" name="item_gst_${itemCount}" placeholder="GST (%)" min="0">
                </div>
                <div class="col-md-2">
                  <input type="number" step="0.01" class="form-control" name="item_discount_${itemCount}" placeholder="Discount" min="0">
                </div>
                <div class="col-md-1">
                  <button type="button" class="btn btn-danger btn-sm remove-item"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            `;
            modal.find('#editBillItems').append(newItem);
          });

          // Remove item
          modal.find('.remove-item').on('click', function () {
            $(this).closest('.row').remove();
            calculateTotalAmount();
          });

          // Save changes (fallback)
          modal.find('#saveBillChanges').on('click', function () {
            const updatedBill = {
              bill_id: bill.bill_id,
              patient_id: modal.find('#editBillPatientId').val(),
              status: modal.find('#editBillStatus').val(),
              total_amount: parseFloat(modal.find('#editBillTotalAmount').val()),
              deposit_amount: parseFloat(modal.find('#editBillDepositAmount').val()),
              notes: modal.find('#editBillNotes').val(),
              items: []
            };

            // Collect bill items
            let hasErrors = false;
            modal.find('.bill-item-row').each(function () {
              const $row = $(this);
              const serviceId = $row.find('[name^="item_service_id"]').val();
              const quantity = parseInt($row.find('.item-quantity').val()) || 0;
              const unitPrice = parseFloat($row.find('.item-unit-price').val()) || 0;
              const gst = parseFloat($row.find('.item-gst').val()) || 0;
              const discount = parseFloat($row.find('.item-discount').val()) || 0;
              const totalPrice = (quantity * unitPrice * (1 + gst / 100)) - discount;

              if (!serviceId) {
                alert("Please select a valid service for all items.");
                hasErrors = true;
                return false;
              }
              if (quantity <= 0) {
                alert("Quantity must be greater than zero.");
                hasErrors = true;
                return false;
              }
              if (unitPrice <= 0) {
                alert("Unit price must be greater than zero.");
                hasErrors = true;
                return false;
              }

              updatedBill.items.push({
                service_id: serviceId,
                quantity: quantity,
                unit_price: unitPrice,
                gst: gst,
                discount: discount,
                total_price: totalPrice // Include total_price for compatibility
              });
            });

            if (hasErrors) {
              return;
            }

            // Update bill
            $.ajax({
              url: `${API_BASE_URL}/bills/update/`,
              type: "PUT",
              headers: getAuthHeaders(),
              data: JSON.stringify(updatedBill),
              contentType: "application/json",
              success: function (response) {
                console.log(`✅ Bill ${billId} updated successfully:`, response);
                alert("Bill updated successfully!");
                bsModal.hide();
                fetchBills($('.bills-filter .nav-link.active').data('filter') || 'all');
              },
              error: function (xhr) {
                console.error(`❌ Failed to update bill ${billId}:`, xhr.responseJSON || xhr.statusText);
                alert(`Failed to update bill: ${xhr.responseJSON?.error || "Unknown error"}`);
              }
            });
          });

          modal.on('hidden.bs.modal', function () {
            modal.remove();
          });
        });
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch bill ${billId}:`, xhr.responseJSON || xhr.statusText);
      alert(`Failed to fetch bill details: ${xhr.responseJSON?.error || "Unknown error"}`);
    }
  });
}

// main.js
function bindBillFilters() {
  $('#billsNav .nav-link').on('click', function (e) {
    e.preventDefault();
    const filter = $(this).data('filter');
    console.log(`🖱️ Bill filter clicked: ${filter}`);

    // Update active class
    $('#billsNav .nav-link').removeClass('active');
    $(this).addClass('active');

    // Fetch bills with the selected filter
    fetchBills(filter);
  });
}
let currentBills = [];
let currentPage = 1;
const pageSize = 10;

function fetchBills(filter = 'all', patientId = null, startDate = null, endDate = null) {
  console.log(`📄 Fetching bills with filter: ${filter}, patientId: ${patientId}, date range: ${startDate} - ${endDate}`);
  
  let url = `${API_BASE_URL}/bills/list/`;
  const queryParams = [];
  if (patientId) queryParams.push(`patient_id=${encodeURIComponent(patientId)}`);
  if (startDate) queryParams.push(`start_date=${encodeURIComponent(startDate)}`);
  if (endDate) queryParams.push(`end_date=${encodeURIComponent(endDate)}`);
  if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

  $.ajax({
    url: url,
    type: "GET",
    headers: getAuthHeaders(),
    success: function (data) {
      console.log(`📥 Raw API response for bills:`, data);
      
      let billsArray = [];
      if (Array.isArray(data.bills)) {
        billsArray = data.bills;
      } else if (Array.isArray(data)) {
        billsArray = data;
      } else if (data && Array.isArray(data.results)) {
        billsArray = data.results;
      } else {
        console.warn(`⚠️ Unexpected response format:`, data);
        billsArray = [];
      }

      const statusMap = {
        'all': ['Paid', 'Partially Paid', 'Pending'],
        'paid': ['Paid'],
        'partially-paid': ['Partially Paid'],
        'pending': ['Pending']
      };
      const allowedStatuses = statusMap[filter.toLowerCase()] || statusMap['all'];
      
      currentBills = billsArray.filter(bill => {
        if (!bill || !bill.status) return false;
        return allowedStatuses.includes(bill.status);
      });

      currentPage = 1; // Reset to first page
      populateBillsTable(currentBills, currentPage, pageSize);
      
      console.log(`✅ Fetched ${currentBills.length} bills with filter ${filter}`);
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch bills: ${xhr.responseJSON?.error || "Unknown error"}`);
      alert(`Failed to fetch bills: ${xhr.responseJSON?.error || "Unknown error"}`);
      currentBills = [];
      populateBillsTable(currentBills, currentPage, pageSize);
    }
  });
}

function bindPagination() {
  $('#billsPrevPage').on('click', function (e) {
    e.preventDefault();
    if (currentPage > 1) {
      currentPage--;
      populateBillsTable(currentBills, currentPage, pageSize);
    }
  });

  $('#billsNextPage').on('click', function (e) {
    e.preventDefault();
    if (currentPage * pageSize < currentBills.length) {
      currentPage++;
      populateBillsTable(currentBills, currentPage, pageSize);
    }
  });
}

  // Add Bills Form Submission
  $("#addBillsForm").submit(function (e) {
    e.preventDefault();
  
    const patientId = $("#patientIdForBill").val() || sessionStorage.getItem("billPatientId");
    if (!patientId) {
      alert("Please select a patient.");
      return;
    }
  
    const items = [];
    let hasErrors = false;
    $("#billItemsTableBody tr").each(function () {
      const $row = $(this);
      const serviceId = $row.find(".service-id").val();
      const serviceName = $row.find(".service-search").val();
      const quantity = parseInt($row.find("[name='quantity[]']").val()) || 0;
      const unitPrice = parseFloat($row.find(".unit-price").val()) || 0;
      const gst = parseFloat($row.find(".gst").val()) || 0;
      const discount = parseFloat($row.find(".discount").val()) || 0;
      const totalPrice = parseFloat($row.find(".total-price").val()) || 0;
  
      if (!serviceId || !serviceName) {
        alert("Please select a valid service for all items.");
        hasErrors = true;
        return false;
      }
      if (quantity <= 0) {
        alert("Quantity must be greater than zero.");
        hasErrors = true;
        return false;
      }
      if (unitPrice <= 0) {
        alert("Unit price must be greater than zero.");
        hasErrors = true;
        return false;
      }
  
      items.push({
        service_id: serviceId,
        quantity: quantity,
        unit_price: unitPrice,
        gst: gst,
        discount: discount,
        total_price: totalPrice
      });
    });
  
    if (hasErrors) {
      return;
    }
  
    const totalAmount = parseFloat($("#totalAmount").val()) || 0;
    const depositAmount = parseFloat($("#depositAmount").val()) || 0;
    const status = depositAmount >= totalAmount ? 'Paid' : (depositAmount > 0 ? 'Partially Paid' : 'Pending');
    const notes = $("#billNotes").val();
  
    const billData = {
      patient_id: patientId,
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      status: status,
      notes: notes,
      items: items
    };
  
    showAppointmentDatePopup(function (appointmentDate, doctorId) {
      billData.appointment_date = appointmentDate;
      billData.doctor_id = doctorId;
  
      $.ajax({
        url: `${API_BASE_URL}/bills/create/`,
        type: "POST",
        headers: getAuthHeaders(),
        data: JSON.stringify(billData),
        contentType: "application/json",
        success: function (response) {
          console.log("Bill created successfully:", response);
          $("#addBillsForm")[0].reset();
          $("#newActionModal").modal("hide");
          sessionStorage.removeItem("billPatientId");
          alert("Bill and appointment created successfully!");
  
          // Extract appointment date from response or input
          let appointmentDateStr = null;
          if (response.appointment && response.appointment.appointment_date) {
            const apptDate = new Date(response.appointment.appointment_date);
            appointmentDateStr = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}-${String(apptDate.getDate()).padStart(2, '0')}`;
          } else if (appointmentDate) {
            // Fallback to the appointmentDate from the popup
            appointmentDateStr = appointmentDate.split(' ')[0]; // Extract YYYY-MM-DD
          }
          fetchBills();

  
          // Refresh appointments table with the appointment date
          if (appointmentDateStr) {
            console.log(`📅 Refreshing appointments for date: ${appointmentDateStr}`);
            fetchAppointmentsByDate(appointmentDateStr);
          } else {
            console.warn("⚠️ No appointment date found, refreshing with current filter");
            fetchAppointmentsByDate();
          }
        },
        error: function (xhr) {
          console.error(`Failed to create bill: ${xhr.responseJSON?.error || xhr.statusText}`);
          alert(`Failed to create bill: ${xhr.responseJSON?.error || "Unknown error"}`);
        }
      });
    });
  });

  // Cancel and Create Buttons
  $("#cancelBillBtn").on("click", function () {
    $("#addBillsForm")[0].reset();
    $("#billItemsTableBody").empty();
    itemCount = 0;
    sessionStorage.removeItem("billPatientId");
    console.log("Bill form reset");
  });

  $("#createBillBtn").on("click", function () {
    $("#addBillsForm").submit();
  });

  $("#goBackBtn").on("click", function () {
    $("#newActionTabs .nav-link.active").removeClass("active");
    $("#addPatientTab").addClass("active");
    $("#newActionTabContent .tab-pane.active").removeClass("show active");
    $("#addPatient").addClass("show active");
    console.log("Navigated back to Add Patient tab");
  });

  // Add a global variable to store the selected patient ID

  function updateBillDetails(patientId) {
    // Use provided patientId, global selectedPatientId, input field, or sessionStorage
    const effectivePatientId = patientId || selectedPatientId || $("#patientIdForBill").val() || sessionStorage.getItem("billPatientId");

    if (!effectivePatientId) {
      console.warn("No patient ID found for bill details update");
      // Reset bill form fields to avoid stale data
      $("#billServiceName").val("");
      $("#billDoctorName").val("");
      $("#billAppointmentDate").val("");
      $("#billDuration").val("");
      return;
    }

    console.log(`Fetching bill details for patient ID: ${effectivePatientId}`);

    $.ajax({
      url: `${API_BASE_URL}/patients/patients/${effectivePatientId}/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        const patient = data.patient || data;
        const firstRowService = $("#billItemsTableBody tr:first .service-search");
        $("#billServiceName").val(firstRowService.length ? firstRowService.val() || "" : "");
        $("#billDoctorName").val(
          patient.primary_doctor
            ? `${patient.primary_doctor.first_name} ${patient.primary_doctor.last_name || ""}`
            : ""
        );
        $("#billAppointmentDate").val("");
        $("#billDuration").val("30");
        $("#patientIdForBill").val(patient.patient_id); // Ensure patientId is set
        sessionStorage.setItem("billPatientId", patient.patient_id);
        selectedPatientId = patient.patient_id; // Update global variable
        console.log(`Updated bill details for patient ${patient.patient_id}`);
      },
      error: function (xhr) {
        console.error(`Failed to fetch patient for bill details: ${xhr.status} ${xhr.statusText}`, xhr.responseJSON);
        $("#billServiceName").val("");
        $("#billDoctorName").val("");
        $("#billAppointmentDate").val("");
        $("#billDuration").val("");
        alert(`Failed to fetch patient details: ${xhr.responseJSON?.error || "Unknown error"}`);
      }
    });
  }

  $("#addBillsTab").on("shown.bs.tab", function () {
    const patientId = $("#patientIdForBill").val() || sessionStorage.getItem("billPatientId") || selectedPatientId;
    const $form = $("#addBillsForm");
    const $alert = $form.find(".alert-warning");

    // Remove any existing alerts
    $alert.remove();

    if (patientId) {
      $("#patientIdForBill").val(patientId);
      sessionStorage.setItem("billPatientId", patientId);
      selectedPatientId = patientId; // Update global variable
      updateBillDetails(patientId);
      $form.find("input, button, select").prop("disabled", false);
      $("#createBillBtn, #addBillItem").prop("disabled", false);
      // Initialize at least one bill item if none exist
      if (!$("#billItemsTableBody tr").length) {
        $("#addBillItem").click();
      }
    } else {
      console.warn("No patient ID found for bill details update");
      $form.find("input, button, select").prop("disabled", true);
      $("#createBillBtn, #addBillItem").prop("disabled", true);
      $form.prepend(
        '<div class="alert alert-warning alert-dismissible fade show" role="alert">' +
        'Please select a patient before creating a bill. ' +
        '<a href="#" class="alert-link select-patient">Select a patient now</a>.' +
        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
        '</div>'
      );
      $form.find(".select-patient").on("click", function (e) {
        e.preventDefault();
        $("#addPatientTab").tab("show");
      });
      $form[0].reset();
      $("#billServiceName").val("");
      $("#billDoctorName").val("");
      $("#billAppointmentDate").val("");
      $("#billDuration").val("");
      $("#billItemsTableBody").empty();
      itemCount = 0;
    }
  });

  // Populate Doctor Dropdown
  function populateDoctorDropdown(selectId, specialtyId) {
    const doctorSelect = $(`#${selectId}`);
    // if (!doctorSelect.length) {
    //   console.error(`❌ Select element #${selectId} not found in DOM`);
    //   return;
    // }
  
    // Clear existing options and set loading state
    doctorSelect.empty().append('<option value="" disabled>Loading doctors...</option>');
  
    $.ajax({
      url: `${API_BASE_URL}/appointments/doctors/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        console.log(`🟢 Doctor API response for ${selectId}:`, data);
        doctorSelect.empty();
  
        // Handle selectId-specific options
        if (selectId === "serviceDoctors") {
          doctorSelect.append('<option value="all">All Doctors</option>');
          doctorSelect.prop('multiple', true); // Enable multi-select
          doctorSelect.addClass('form-select'); // Ensure Bootstrap styling
        } else {
          doctorSelect.append('<option value="" selected disabled>Select Doctor</option>');
          doctorSelect.prop('multiple', false); // Ensure single-select
          doctorSelect.addClass('form-select');
        }
  
        // Validate and populate doctor options
        const doctors = Array.isArray(data.doctors) ? data.doctors : [];
        if (doctors.length === 0) {
          console.warn(`⚠️ No doctors returned from API for ${selectId}`);
          doctorSelect.append('<option value="" disabled>No doctors available</option>');
        } else {
          doctors.forEach(doctor => {
            if (doctor.id && doctor.first_name) {
              doctorSelect.append(
                `<option value="${doctor.id}">${doctor.first_name} ${doctor.last_name || ''}</option>`
              );
            } else {
              console.warn(`⚠️ Skipping invalid doctor entry:`, doctor);
            }
          });
        }
  
        // Handle specialty field updates
        if (specialtyId) {
          doctorSelect.off('change.specialty').on('change.specialty', function () {
            const selectedDoctor = doctors.find(d => d.id == $(this).val());
            $(`#${specialtyId}`).val(selectedDoctor ? selectedDoctor.specialization : '');
          });
        }
  
        // Trigger change to ensure UI updates
        doctorSelect.trigger('change');
      },
      error: function (xhr) {
        console.error(`❌ Failed to fetch doctors for ${selectId}: ${xhr.status}`, xhr.responseJSON);
        doctorSelect.empty().append('<option value="" disabled>Failed to load doctors</option>');
        alert("Failed to fetch doctors. Please check your connection or try again.");
      }
    });
  }

  // Populate doctor dropdowns
  populateDoctorDropdown("doctor", "doctorSpecialty");
  // populateDoctorDropdown("serviceOwner");

  // Event Listeners
  $('#newActionModal').on('shown.bs.modal', function () {
    console.log("🔍 Modal shown, ensuring tab visibility...");
    const role = `${sessionStorage.getItem("user_type")?.toLowerCase()}-${sessionStorage.getItem("role_level")?.toLowerCase()}`;
  
    if (role === "doctor-senior") {
      // Show all tabs and enable all elements for doctor-senior
      $("#newActionTabs .nav-item").show();
      $("#newActionTabContent .tab-pane").find("input, select, button, textarea").prop("disabled", false);
      console.log("✅ All modal tabs visible and elements enabled for doctor-senior");
    } else {
      // For other roles, show only permitted tabs
      const permittedTabs = $("#newActionTabs .nav-item:visible");
      permittedTabs.show();
      // Hide Add Service tab unless explicitly active
      $("#addServiceTab").closest(".nav-item").hide();
      if ($("#addServiceTab").hasClass("active")) {
        $("#addServiceTab").closest(".nav-item").show();
      }
    }
  
    // Handle Add Patient tab reset
    if ($("#addPatientTab").hasClass("active") && !selectedPatientId) {
      $('#addPatientForm')[0].reset();
      $('#patientPhone').val('').trigger('change');
      $('#mobile2').val('').trigger('change');
      flatpickr("#patientDOB").clear();
      flatpickr("#maritalSince").clear();
      flatpickr("#appointmentDate").clear();
      $('#addPatientForm').removeData('edit-mode').removeData('patient-id').removeData('appointment-id');
      $('#personalDetailsCollapse').addClass('show');
      $('#contactDetailsCollapse, #medicalInfoCollapse, #additionalPersonalDetailsCollapse, #appointmentDetailsCollapse, #insuranceDetailsCollapse, #imageUploadCollapse').removeClass('show');
      updateDetailsSection(null);
    }
    if (typeof initializeDatePickers === 'function') initializeDatePickers();
  });
  
  $('#newActionModal').on('hidden.bs.modal', function () {
    console.log("🔄 Modal hidden, resetting view and search input...");
    resetModalView();
    updateDetailsSection(null);
    sessionStorage.removeItem("billPatientId");
    selectedPatientId = null;
    $('.navbar-top .form-control.patient-search').val('');
    $('#addPatientForm')[0].reset();
    $('#patientPhone').val('').trigger('change');
    $('#mobile2').val('').trigger('change');
    flatpickr("#patientDOB").clear();
    flatpickr("#maritalSince").clear();
    flatpickr("#appointmentDate").clear();
    $('#addPatientForm').removeData('edit-mode').removeData('patient-id').removeData('appointment-id');
    $('#personalDetailsCollapse').addClass('show');
    $('#contactDetailsCollapse, #medicalInfoCollapse, #additionalPersonalDetailsCollapse, #appointmentDetailsCollapse, #insuranceDetailsCollapse, #imageUploadCollapse').removeClass('show');
  });;

  $('#newActionModal').on('hidden.bs.modal', function () {
    console.log("🔄 Modal hidden, resetting view and search input...");
    resetModalView();
    updateDetailsSection(null);
    sessionStorage.removeItem("billPatientId");
    selectedPatientId = null; // Clear global patient ID
    // Clear the search input
    $('.navbar-top .form-control.patient-search').val('');
    // Reset the Add Patient form to show only Personal Details
    $('#addPatientForm')[0].reset();
    $('#patientPhone').val('').trigger('change'); // Reset intlTelInput
    $('#mobile2').val('').trigger('change'); // Reset intlTelInput
    flatpickr("#patientDOB").clear();
    flatpickr("#maritalSince").clear();
    flatpickr("#appointmentDate").clear();
    $('#addPatientForm').removeData('edit-mode').removeData('patient-id').removeData('appointment-id');
    $('#personalDetailsCollapse').addClass('show');
    $('#contactDetailsCollapse, #medicalInfoCollapse, #additionalPersonalDetailsCollapse, #appointmentDetailsCollapse, #insuranceDetailsCollapse, #imageUploadCollapse').removeClass('show');
  });

  console.log("🚀 Initializing Dashboard...");
  checkAuthentication();
  bindDateFilterButtons();
  bindNavFilters();
  // Populate doctor dropdowns
  populateDoctorDropdown("doctor", "doctorSpecialty");
  populateDoctorDropdown("serviceDoctors");

  populateDoctorDropdownForFilter();
  bindDoctorFilter();
  bindBillFilters();
  bindPagination();


  // Call populateServicesTable when Add Service tab is shown
  $("#addServiceTab").on("shown.bs.tab", function () {
    console.log("Add Service tab shown, populating doctors...");
    populateDoctorDropdown("serviceDoctors"); // Re-populate doctors
    populateServicesTable(); // Existing call to populate services table
  });
  
  // Fetch today's appointments on page load
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  fetchAppointmentsByDate(todayStr);
  console.log("✅ Dashboard Initialization Complete");
});
