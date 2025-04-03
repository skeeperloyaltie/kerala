// main.js
$(document).ready(function () {
  const API_BASE_URL = "http://smarthospitalmaintain.com:8000"; // Adjust to your Django API

  // Initialize Flatpickr for Date Filter
  flatpickr("#dateFilter", {
    dateFormat: "Y-m-d",
    defaultDate: new Date(), // Set to today by default
    onChange: function (selectedDates, dateStr) {
      console.log("📅 Date Filter Changed - Selected date:", dateStr);
      fetchAppointmentsByDate(dateStr); // Fetch appointments when date changes
    }
  });
  console.log("🟢 Flatpickr Initialized for #dateFilter with default date: Today");

  // Get Authentication Headers
  function getAuthHeaders() {
    const token = localStorage.getItem("token");
    return token ? { "Authorization": `Token ${token}` } : {};
  }

  // Authentication Check
  function checkAuthentication() {
    const token = localStorage.getItem("token");
    const userType = localStorage.getItem("user_type");
    const roleLevel = localStorage.getItem("role_level");
    const permissions = localStorage.getItem("permissions");

    console.log("🔍 Checking Authentication - Stored Data:", {
      token: token ? "Present" : "Missing",
      userType: userType || "Missing",
      roleLevel: roleLevel || "Missing",
      permissions: permissions ? "Present" : "Missing"
    });

    if (!token || !userType || !roleLevel || !permissions) {
      console.error("❌ Missing authentication data in localStorage:", {
        token: !!token,
        userType: !!userType,
        roleLevel: !!roleLevel,
        permissions: !!permissions
      });
      alert("Authentication failed: Missing required data. Please log in again.");
      window.location.href = "../login/login.html";
      return;
    }

    $.ajax({
      url: `${API_BASE_URL}/users/profile/`,
      type: "GET",
      headers: { "Authorization": `Token ${token}` },
      success: function (data) {
        console.log("🟢 User Profile Fetched Successfully:", data);
        adjustUIForRole(userType, roleLevel);
        if (data.doctor_code) {
          console.log(`👨‍⚕️ Updating Doctor Code: ${data.doctor_code}`);
          $(".doctor-code").text(`Doctor Code: ${data.doctor_code}`);
        }
        fetchAppointmentsByDate(); // Fetch today's appointments on load
      },
      error: function (xhr) {
        console.error("❌ Authentication Error:", xhr.responseJSON || xhr.statusText);
        localStorage.clear();
        console.log("🗑️ Cleared localStorage due to authentication failure");
        alert("Authentication failed: Invalid token. Please log in again.");
        window.location.href = "../login/login.html";
      }
    });
  }

  // Role-Based UI Adjustments (unchanged)
  function adjustUIForRole(userType, roleLevel) {
    console.log(`🎭 Adjusting UI for UserType: ${userType}, RoleLevel: ${roleLevel}`);
    const navItems = $(".navbar-top .nav-item");
    const secondaryNavItems = $(".navbar-secondary .nav-item");
    const buttons = $(".navbar-top .btn, .navbar-secondary .btn");
    const searchInput = $(".navbar-top .form-control");
    const dateFilter = $("#dateFilter");
    const dashboardDropdown = $("#dashboardDropdown").parent();
    const logoutLink = $(".dropdown-menu .dropdown-item:contains('Logout')");

    navItems.show();
    secondaryNavItems.show();
    buttons.show();
    searchInput.show();
    dateFilter.show();
    dashboardDropdown.show();
    logoutLink.show();

    const role = `${userType}-${roleLevel}`.toLowerCase();
    switch (role) {
      case "doctor-senior":
        break;
      case "doctor-medium":
        navItems.filter(":contains('Add Services')").hide();
        dashboardDropdown.hide();
        secondaryNavItems.filter(":contains('Reviewed')").hide();
        break;
      case "doctor-basic":
        navItems.filter(":contains('All Bills'), :contains('Add Services')").hide();
        buttons.filter(":contains('New')").hide();
        secondaryNavItems.filter(":contains('Reviewed'), :contains('On-Going')").hide();
        $(".navbar-secondary .btn-circle").not(":contains('Filter'), :contains('Star')").hide();
        dashboardDropdown.hide();
        break;
      case "nurse-senior":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.filter(":contains('New')").hide();
        secondaryNavItems.filter(":contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").not(":contains('Filter')").hide();
        dashboardDropdown.hide();
        break;
      case "nurse-medium":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.filter(":contains('New'), :contains('Support')").hide();
        secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").hide();
        dashboardDropdown.hide();
        break;
      case "nurse-basic":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.hide();
        searchInput.hide();
        dateFilter.hide();
        secondaryNavItems.filter(":contains('Booked'), :contains('On-Going'), :contains('Reviewed')").hide();
        dashboardDropdown.hide();
        break;
      case "receptionist-senior":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").not(":contains('Filter')").hide();
        dashboardDropdown.hide();
        break;
      case "receptionist-medium":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.filter(":contains('Support')").hide();
        secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").hide();
        dashboardDropdown.hide();
        break;
      case "receptionist-basic":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.hide();
        searchInput.hide();
        dateFilter.hide();
        secondaryNavItems.filter(":contains('Arrived'), :contains('On-Going'), :contains('Reviewed')").hide();
        dashboardDropdown.hide();
        break;
      default:
        console.warn("⚠️ Unknown role combination:", role);
        alert("Unknown role detected. Access restricted.");
        navItems.hide();
        secondaryNavItems.hide();
        buttons.hide();
    }

    console.log("🔍 Final Nav Items Visibility:", navItems.filter(":visible").map((i, el) => $(el).text().trim()).get());
    bindLogoutEvent();
    bindModalActions();
    setupPatientSearch();
  }

  // Fetch Appointments by Date
  function fetchAppointmentsByDate(dateStr = null) {
    const today = new Date();
    const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedDate = dateStr || defaultDate;

    $.ajax({
      url: `${API_BASE_URL}/appointments/list/?date=${selectedDate}`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        populateAppointmentsTable(data.results || data, selectedDate);
      },
      error: function (xhr) {
        alert(`Failed to fetch appointments: ${xhr.responseJSON?.error || "Unknown error"}`);
        populateAppointmentsTable([], selectedDate);
      }
    });
  }

  // Populate Appointments Table
  function populateAppointmentsTable(appointments, date) {
    const $tbody = $('.table-appointments tbody');
    $tbody.empty();
  
    // Log the raw appointments data for debugging
    console.log(`📥 Received appointments data:`, appointments);
  
    // Normalize appointments to an array
    let appointmentsArray = [];
    if (Array.isArray(appointments)) {
      appointmentsArray = appointments;
    } else if (appointments && typeof appointments === 'object' && Array.isArray(appointments.results)) {
      appointmentsArray = appointments.results;
    } else if (appointments && typeof appointments === 'object' && !Array.isArray(appointments)) {
      // If it's a single object, wrap it in an array
      appointmentsArray = [appointments];
    } else {
      console.warn(`⚠️ Appointments data is not an array or valid object:`, appointments);
    }
  
    if (!appointmentsArray.length) {
      $tbody.append(`<tr><td colspan="7" class="text-center">No appointments found for ${date}</td></tr>`);
      console.log(`ℹ️ No appointments to display for ${date}`);
      return;
    }
  
    appointmentsArray.forEach((appt, index) => {
      const appointmentDate = new Date(appt.appointment_date);
      const timeStr = appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const doctorName = appt.doctor ? `${appt.doctor.first_name} ${appt.doctor.last_name || ''}` : 'N/A';
      const patientName = `${appt.patient.first_name} ${appt.patient.last_name || ''}`;
      const statusClass = `status-${appt.status.toLowerCase().replace(' ', '-')}`;
  
      const $row = $(`
        <tr>
          <td>${index + 1}</td>
          <td>${appt.id}</td>
          <td>${patientName}</td>
          <td>${timeStr}</td>
          <td><span class="${statusClass}">${appt.status.toUpperCase()}</span></td>
          <td>${doctorName}</td>
          <td>${appt.notes || 'N/A'}</td>
        </tr>
      `);
      $tbody.append($row);
    });
  
    console.log(`✅ Populated appointments table with ${appointmentsArray.length} entries for ${date}`);
  }

  // Bind Date Filter Buttons
  function bindDateFilterButtons() {
    $('.btn:contains("Set")').on('click', function () {
      const dateStr = $("#dateFilter").val();
      console.log("🖱️ Set Date Clicked:", dateStr);
      fetchAppointmentsByDate(dateStr);
    });

    $('.btn:contains("Today")').on('click', function () {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      console.log("🖱️ Today Clicked:", todayStr);
      $("#dateFilter").val(todayStr); // Update Flatpickr input
      fetchAppointmentsByDate(todayStr);
    });
  }

  // Logout Function (unchanged)
  function logoutUser() {
    const headers = getAuthHeaders();
    if (!headers['Authorization']) {
      console.warn("No authorization token found. Forcing logout...");
      forceLogout();
      return;
    }

    $.ajax({
      url: `${API_BASE_URL}/users/logout/`,
      type: "POST",
      headers: headers,
      success: function () {
        console.log("✅ Logout successful");
        sessionStorage.clear();
        localStorage.clear();
        document.cookie = "sessionid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        alert("Logged out successfully.");
        window.location.href = "../login/login.html";
      },
      error: function (xhr) {
        console.error("❌ Logout failed:", xhr.status, xhr.responseText);
        forceLogout();
      }
    });
  }

  // Force Logout Fallback (unchanged)
  function forceLogout() {
    console.log("🔒 Forcing logout...");
    sessionStorage.clear();
    localStorage.clear();
    document.cookie = "sessionid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    alert("Logged out successfully (forced).");
    window.location.href = "../login/login.html";
  }

  // Bind Logout Event (unchanged)
  function bindLogoutEvent() {
    const logoutLink = $(".dropdown-menu .dropdown-item:contains('Logout')");
    logoutLink.off('click').on('click', function (e) {
      e.preventDefault();
      console.log("🖱️ Logout Clicked");
      logoutUser();
    });
  }

  // Bind Modal Actions (unchanged)
  function bindModalActions() {
    console.log("🔍 Found elements with data-action:", $("[data-action]").length, $("[data-action]").map((i, el) => $(el).data("action")).get());

    const actionToTabMap = {
      "new": "addPatientTab",
      "all-bills": "billsTab",
      "add-services": "addBillsTab",
      "patient-q": "addPatientTab",
      "tele-consults": "visitsTab",
      "support": "profileTab"
    };

    $("[data-action]").off('click').on('click', function (e) {
      e.preventDefault();
      const action = $(this).data("action");
      console.log(`🖱️ Action Triggered: ${action}`);

      const tabId = actionToTabMap[action] || "addPatientTab";
      console.log(`🎯 Switching to Tab: ${tabId}`);

      const modal = $('#newActionModal');
      modal.modal('show');

      const tabElement = $(`#${tabId}`);
      if (tabElement.length) {
        tabElement.tab('show');
        console.log(`✅ Successfully switched to tab: ${tabId}`);
      } else {
        console.error(`❌ Tab with ID ${tabId} not found!`);
      }
    });
  }

  // Reset Modal View (unchanged)
  function resetModalView() {
    console.log("🔄 Resetting modal view...");
    const modalBody = $("#modalBody");
    const sidebarContentArea = $("#sidebarContentArea");
    modalBody.removeClass("split-view");
    sidebarContentArea.hide();
  }

  // Setup Patient Search with Autocomplete (unchanged)
  function setupPatientSearch() {
    console.log("🔍 Setting up patient search...");
    const $searchInput = $('.navbar-top .form-control');
    console.log("🔍 Search input found:", $searchInput.length ? "Yes" : "No", $searchInput);

    const $dropdown = $('<ul class="autocomplete-dropdown"></ul>').hide();
    $searchInput.after($dropdown);
  
    $searchInput.on('input', debounce(function () {
      console.log("✨ Search input triggered:", $searchInput.val());
      const query = $searchInput.val().trim();
      if (query.length < 1) {
        $dropdown.hide().empty();
        console.log("Query too short, skipping search");
        return;
      }
      console.log("🚀 Proceeding with search for query:", query);

      $.ajax({
        url: `${API_BASE_URL}/patients/search/?query=${encodeURIComponent(query)}`,
        type: "GET",
        headers: getAuthHeaders(),
        beforeSend: function () {
          console.log("📤 Sending search request for query:", query);
        },
        success: function (data) {
          console.log("✅ Patient search results:", data);
          if (!data || !data.patients) {
            data = { patients: [] };
            console.log("🛠️ Mocking empty response for testing");
          }
          $dropdown.empty();
          if (data.patients && data.patients.length > 0) {
            data.patients.forEach(patient => {
              const $li = $(`<li data-patient-id="${patient.patient_id}">${patient.first_name} ${patient.last_name || ''} (ID: ${patient.patient_id})</li>`);
              $dropdown.append($li);
              console.log("➕ Added patient to dropdown:", $li.text());
            });
            $dropdown.show();
            console.log("👀 Dropdown should be visible now");
          } else {
            $dropdown.show();
            console.log("🕳️ No patients found, hiding dropdown");
            showCreatePatientPrompt(query);
          }
        },
        error: function (xhr) {
          console.error("❌ Search error:", xhr.status, xhr.statusText, xhr.responseText);
          $dropdown.hide();
        }
      });
    }, 300));
  
    $dropdown.on('click', 'li', function () {
      const patientId = $(this).data('patient-id');
      $searchInput.val($(this).text());
      $dropdown.hide();
      fetchPatientDetails(patientId);
    });
  
    $(document).on('click', function (e) {
      if (!$(e.target).closest('.navbar-top .form-control, .autocomplete-dropdown').length) {
        $dropdown.hide();
      }
    });
  }

  // Debounce function (unchanged)
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Fetch Patient Details (unchanged)
  function fetchPatientDetails(patientId) {
    $.ajax({
      url: `${API_BASE_URL}/patients/patients/${patientId}/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        populateProfileTab(data);
        $('#newActionModal').modal('show');
        $('#profileTab').tab('show');
        updateDetailsSection(data);
      },
      error: function (xhr) {
        alert(`Failed to fetch patient details: ${xhr.responseJSON?.error || "Unknown error"}`);
      }
    });
  }
// Populate Profile Tab
function populateProfileTab(patient) {
  const $profileTab = $('#profile');
  $('#profileFirstName').val(patient.first_name || '');
    $('#profileLastName').val(patient.last_name || '');
    $('#profilePhone').val(patient.mobile_number || '');
    $('#profileGender').val(patient.gender || 'N/A');
    $('#profileDOB').val(patient.date_of_birth || 'N/A');
    $('#profilePreferredLanguage').val(patient.preferred_language || 'N/A');
    $('#profileFatherName').val(patient.father_name || 'N/A');
    $('#profileMaritalStatus').val(patient.marital_status || 'N/A');
    $('#profilePaymentPreference').val(patient.payment_preference || 'N/A');

  // Handle appointment_date with Flatpickr (use first appointment if available)
  const $appointmentDateInput = $('#profileAppointmentDate');
  const appointment = patient.appointments && patient.appointments.length > 0 ? patient.appointments[0] : null;
  if (appointment && appointment.appointment_date) {
    const appointmentDate = new Date(appointment.appointment_date);
    const formattedDate = `${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, '0')}-${String(appointmentDate.getDate()).padStart(2, '0')} ${String(appointmentDate.getHours()).padStart(2, '0')}:${String(appointmentDate.getMinutes()).padStart(2, '0')}`;
    $appointmentDateInput.val(formattedDate);
  } else {
    $appointmentDateInput.val('');
  }
  
    $('#profileAppointmentDate').val(appointment ? appointment.appointment_date : '');
    $('#profileCity').val(patient.city || '');
    $('#profileAddress').val(patient.address || '');
    $('#profilePin').val(patient.pincode || '');
    $('#profileMaritalSince').val(patient.marital_since || '');
    $('#profileBloodGroup').val(patient.blood_group || '');
    $('#profileReferredBy').val(patient.referred_by || '');
    $('#profileDoctor').val(appointment && appointment.doctor ? `${appointment.doctor.first_name} ${appointment.doctor.last_name || ''}` : 'N/A');
    $('#profileDoctorSpecialty').val(appointment && appointment.doctor ? appointment.doctor.specialization : '');
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

  // Re-initialize Flatpickr after setting values
  initializeDatePickers();

  $('#editProfileBtn').off('click').on('click', function () {
    $('#patientFirstName').val(patient.first_name || '');
    $('#patientLastName').val(patient.last_name || '');
    $('#patientPhone').val(patient.mobile_number || '');
    $('#patientGender').val(patient.gender || '');
    $('#patientDOB').val(patient.date_of_birth || '');
    $('#preferredLanguage').val(patient.preferred_language || '');
    $('#fatherName').val(patient.father_name || '');
    $('#maritalStatus').val(patient.marital_status || '');
    $('#paymentPreference').val(patient.payment_preference || '');

    const $editAppointmentDate = $('#appointmentDate');
    if (appointment && appointment.appointment_date) {
      const appointmentDate = new Date(appointment.appointment_date);
      const formattedDate = `${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, '0')}-${String(appointmentDate.getDate()).padStart(2, '0')} ${String(appointmentDate.getHours()).padStart(2, '0')}:${String(appointmentDate.getMinutes()).padStart(2, '0')}`;
      $editAppointmentDate.val(formattedDate);
    } else {
      $editAppointmentDate.val('');
    }

    $('#patientCity').val(patient.city || '');
    $('#patientAddress').val(patient.address || '');
    $('#patientPin').val(patient.pincode || '');
    $('#maritalSince').val(patient.marital_since || '');
    $('#bloodGroup').val(patient.blood_group || '');
    $('#referredBy').val(patient.referred_by || '');
    $('#profileDoctor').val(patient.doctor ? `${patient.doctor.first_name} ${patient.doctor.last_name || ''}` : 'N/A');
    $('#profileDoctorSpecialty').val(patient.doctor ? patient.doctor.specialization : '');
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

    // Set edit mode and store IDs
    $('#addPatientForm').data('edit-mode', !!appointment); // True if editing an existing appointment
    $('#addPatientForm').data('patient-id', patient.patient_id); // String
    $('#addPatientForm').data('appointment-id', appointment ? appointment.id : null); // Integer or null

    $('#addPatientTab').tab('show');
  });

  $('#viewAppointmentsBtn').off('click').on('click', function () {
    alert('View Appointments functionality TBD');
  });

  $('#addBillFromProfileBtn').off('click').on('click', function () {
    $('#patientIdForBill').val(patient.patient_id || '');
    $('#addBillsTab').tab('show');
  });

  console.log("✅ Profile tab populated with patient data:", patient);
}

  // Show Create Patient Prompt (unchanged)
  // function showCreatePatientPrompt(query) {
  //   const [firstName, ...lastNameParts] = query.split(' ');
  //   const lastName = lastNameParts.join(' ');

  //   const $modal = $('#newActionModal');
  //   $modal.modal('hide');

  //   const promptModal = new bootstrap.Modal(document.createElement('div'));
  //   $(promptModal._element).html(`
  //     <div class="modal-dialog">
  //       <div class="modal-content">
  //         <div class="modal-header">
  //           <h5 class="modal-title">Patient Not Found</h5>
  //           <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
  //         </div>
  //         <div class="modal-body">
  //           <p>No patient found matching "${query}". Would you like to create a new patient?</p>
  //         </div>
  //         <div class="modal-footer">
  //           <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Search Again</button>
  //           <button type="button" class="btn btn-primary" id="createPatientBtn">Create Patient</button>
  //         </div>
  //       </div>
  //     </div>
  //   `);
  //   promptModal.show();

  //   $('#createPatientBtn').on('click', function () {
  //     promptModal.hide();
  //     $modal.modal('show');
  //     $('#addPatientTab').tab('show');
  //     $('#patientFirstName').val(firstName);
  //     $('#patientLastName').val(lastName);
  //     resetModalView();
  //     updateDetailsSection(null);
  //   });

  //   $(promptModal._element).on('hidden.bs.modal', function () {
  //     $modal.modal('show');
  //   });
  // }

  // Update Details Section (unchanged)
  function updateDetailsSection(patientData) {
    const detailsTitle = document.getElementById('detailsTitle');
    const detailsMeta = document.getElementById('detailsMeta');
    const visitPadBtn = document.getElementById('visitPadBtn');

    if (patientData) {
      const fullName = `${patientData.first_name} ${patientData.last_name || ''}`;
      const age = patientData.age || 'N/A';
      const patientId = patientData.patient_id || 'N/A';
      detailsTitle.textContent = `Appointment for ${fullName}`;
      detailsMeta.textContent = `${patientData.gender || 'N/A'} | ${age} Years | ${patientId}`;
      visitPadBtn.style.display = 'inline-block';
      console.log("✅ Updated patient details section:", { fullName, age, patientId });
    } else {
      detailsTitle.textContent = 'No Patient Selected';
      detailsMeta.textContent = 'N/A | N/A | N/A';
      visitPadBtn.style.display = 'none';
      console.log("✅ Reset patient details section");
    }
  }
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

  function showCreatePatientPrompt(query) {
    const [firstName, ...lastNameParts] = query.split(' ');
    const lastName = lastNameParts.join(' ');

    const promptModal = new bootstrap.Modal(document.createElement('div'));
    $(promptModal._element).html(`
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Patient Not Found</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
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
    `);
    promptModal.show();

    $('#createPatientBtn').on('click', function () {
      promptModal.hide();
      $('#newActionModal').modal('show');
      $('#addPatientTab').tab('show');
      $('#patientFirstName').val(firstName);
      $('#patientLastName').val(lastName);
      resetModalView();
      updateDetailsSection(null);
    });
  }

  // Toggle Split View (unchanged)
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

  // Add Patient Form Submission (unchanged)
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
      const value = $(`#${field.id}`).val();
      if (!value || value.trim() === "") {
        errors.push(`${field.name} is required.`);
      }
    });
  
    const appointmentDateInput = $("#appointmentDate")[0]._flatpickr?.selectedDates[0];
    const appointmentDate = appointmentDateInput ? flatpickr.formatDate(appointmentDateInput, "Y-m-d H:i") + ":00+05:30" : null;
  
    if ($('#addPatientForm').data('appointment-id') && !appointmentDate) {
      errors.push("Appointment Date is required for editing an appointment.");
    }
  
    // Add validation for primary doctor
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
      mobile_number: $("#patientPhone").val(),
      alternate_mobile_number: $("#mobile2").val(),
      aadhar_number: $("#aadharNumber").val(),
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
      primary_doctor: $("#doctor").val() // Add primary_doctor here
    };
  
    const appointmentData = appointmentDate ? {
      appointment_date: appointmentDate,
      notes: $("#appointmentNotes").val(),
      doctor: $("#doctor").val() || null,
      is_emergency: false
    } : null;
  
    const isEditMode = $('#addPatientForm').data('edit-mode');
    const patientId = $('#addPatientForm').data('patient-id');
    const appointmentId = $('#addPatientForm').data('appointment-id');
    let activeButton = null;
    if (e.originalEvent && e.originalEvent.submitter) {
      activeButton = e.originalEvent.submitter.id;
    } else {
      console.warn("⚠️ Submitter not available, checking form buttons...");
      const $submitButtons = $('#addPatientForm').find('button[type="submit"]');
      if ($submitButtons.length === 1) {
        activeButton = $submitButtons.attr('id');
      } else {
        activeButton = 'savePatient';
      }
    }
    console.log(`🖱️ Form submitted by button: ${activeButton}`);
  
    if (isEditMode && patientId) {
      // Update existing patient
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
              data: JSON.stringify({ ...appointmentData, patient: patientId }),
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
      // Create new patient
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
              data: JSON.stringify({ ...appointmentData, patient: newPatient.patient_id }),
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

  // Add Bills Form Submission (unchanged)
  $("#addBillsForm").submit(function (e) {
    e.preventDefault();
    console.log("🖱️ Add Bill Submitted");
  
    const billData = {
      patient_id: $("#patientIdForBill").val(),
      description: $("#billDescription").val(),
      amount: $("#billAmount").val(),
      date: $("#billDate").val() || new Date().toISOString().split('T')[0]
    };
  
    let errors = [];
    if (!billData.patient_id) errors.push("Patient ID is required.");
    if (!billData.description || billData.description.trim() === "") errors.push("Description is required.");
    if (!billData.amount || isNaN(billData.amount) || parseFloat(billData.amount) <= 0) errors.push("A valid amount is required.");
  
    if (errors.length > 0) {
      alert("Please fix the following errors:\n- " + errors.join("\n- "));
      return;
    }
  
    $.ajax({
      url: `${API_BASE_URL}/bills/create/`,
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(billData),
      contentType: "application/json",
      success: function (data) {
        console.log("✅ Bill Added Successfully:", data);
        alert("Bill added successfully!");
        $("#addBillsForm")[0].reset();
      },
      error: function (xhr) {
        console.error("❌ Failed to Add Bill:", xhr.status, xhr.responseJSON || xhr.statusText);
        let errorMessage = "Unknown error";
        if (xhr.responseJSON) {
          errorMessage = xhr.responseJSON.detail || JSON.stringify(xhr.responseJSON);
        } else if (xhr.statusText) {
          errorMessage = xhr.statusText;
        }
        alert(`Failed to add bill: ${errorMessage}`);
      }
    });
  });

  // Populate Doctor Dropdown (unchanged)
  function populateDoctorDropdown() {
    $.ajax({
      url: `${API_BASE_URL}/appointments/doctors/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        const doctorSelect = $("#doctor");
        doctorSelect.empty();
        doctorSelect.append('<option value="" selected>Select Doctor</option>');
        data.doctors.forEach(doctor => {
          doctorSelect.append(`<option value="${doctor.id}">${doctor.first_name} ${doctor.last_name}</option>`);
        });

        doctorSelect.on('change', function () {
          const selectedDoctor = data.doctors.find(d => d.id == $(this).val());
          $("#doctorSpecialty").val(selectedDoctor ? selectedDoctor.specialization : '');
        });
      },
      error: function () {
        alert("Failed to fetch doctors.");
      }
    });
  }

  // Event Listeners (updated)
  $('#newActionModal').on('shown.bs.modal', function () {
    populateDoctorDropdown();
    initializeDatePickers(); // Call from flatpicker.js
  });

  $('#newActionModal').on('hidden.bs.modal', function () {
    resetModalView();
    updateDetailsSection(null);
  });

  // Initialize
  console.log("🚀 Initializing Dashboard...");
  checkAuthentication();
  bindDateFilterButtons(); // Bind buttons after DOM is ready
  console.log("✅ Dashboard Initialization Complete");
});