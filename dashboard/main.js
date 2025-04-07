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

    console.log("🔍 Checking Authentication - Stored Data:", {
      token: token ? "Present" : "Missing",
      userType: userType || "Missing",
      roleLevel: roleLevel || "Missing"
    });

    if (!token || !userType || !roleLevel) {
      console.error("❌ Missing authentication data in localStorage:", {
        token: !!token,
        userType: !!userType,
        roleLevel: !!roleLevel
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

  // Role-Based UI Adjustments (Permissions Removed)
  function adjustUIForRole(userType, roleLevel) {
    console.log(`🎭 Adjusting UI for UserType: ${userType}, RoleLevel: ${roleLevel}`);
    const navItems = $(".navbar-top .nav-item");
    const secondaryNavItems = $(".navbar-secondary .nav-item");
    const buttons = $(".navbar-top .btn, .navbar-secondary .btn");
    const searchInput = $(".navbar-top .form-control");
    const dateFilter = $("#dateFilter");
    const dashboardDropdown = $("#dashboardDropdown").parent();
    const logoutLink = $(".dropdown-menu .dropdown-item:contains('Logout')");
    const modalTabs = $("#newActionTabs .nav-item");

    navItems.show();
    secondaryNavItems.show();
    buttons.show();
    searchInput.show();
    dateFilter.show();
    dashboardDropdown.show();
    logoutLink.show();
    modalTabs.show(); // Show all modal tabs by default

    const role = `${userType}-${roleLevel}`.toLowerCase();

    switch (role) {
      case "doctor-senior":
        // Full access, including Add Service
        break;
      case "doctor-medium":
        navItems.filter(":contains('Add Services')").hide();
        dashboardDropdown.hide();
        secondaryNavItems.filter(":contains('Reviewed')").hide();
        modalTabs.filter(":contains('Add Service')").hide();
        break;
      case "doctor-basic":
        navItems.filter(":contains('All Bills'), :contains('Add Services')").hide();
        buttons.filter(":contains('New')").hide();
        secondaryNavItems.filter(":contains('Reviewed'), :contains('On-Going')").hide();
        $(".navbar-secondary .btn-circle").not(":contains('Filter'), :contains('Star')").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service')").hide();
        break;
      case "nurse-senior":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.filter(":contains('New')").hide();
        secondaryNavItems.filter(":contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").not(":contains('Filter')").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service')").hide();
        break;
      case "nurse-medium":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.filter(":contains('New'), :contains('Support')").hide();
        secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service')").hide();
        break;
      case "nurse-basic":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.hide();
        searchInput.hide();
        dateFilter.hide();
        secondaryNavItems.filter(":contains('Booked'), :contains('On-Going'), :contains('Reviewed')").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service')").hide();
        break;
      case "receptionist-senior":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").not(":contains('Filter')").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service')").hide();
        break;
      case "receptionist-medium":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.filter(":contains('Support')").hide();
        secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service')").hide();
        break;
      case "receptionist-basic":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.hide();
        searchInput.hide();
        dateFilter.hide();
        secondaryNavItems.filter(":contains('Arrived'), :contains('On-Going'), :contains('Reviewed')").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service')").hide();
        break;
      default:
        console.warn("⚠️ Unknown role combination:", role);
        alert("Unknown role detected. Access restricted.");
        navItems.hide();
        secondaryNavItems.hide();
        buttons.hide();
        modalTabs.hide();
    }

    console.log("🔍 Final Nav Items Visibility:", navItems.filter(":visible").map((i, el) => $(el).text().trim()).get());
    console.log("🔍 Final Modal Tabs Visibility:", modalTabs.filter(":visible").map((i, el) => $(el).text().trim()).get());
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

    console.log(`📥 Received appointments data:`, appointments);

    let appointmentsArray = [];
    if (Array.isArray(appointments)) {
      appointmentsArray = appointments;
    } else if (appointments && typeof appointments === 'object' && Array.isArray(appointments.results)) {
      appointmentsArray = appointments.results;
    } else if (appointments && typeof appointments === 'object' && !Array.isArray(appointments)) {
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
      $("#dateFilter").val(todayStr);
      fetchAppointmentsByDate(todayStr);
    });
  }

  // Logout Function
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

  // Force Logout Fallback
  function forceLogout() {
    console.log("🔒 Forcing logout...");
    sessionStorage.clear();
    localStorage.clear();
    document.cookie = "sessionid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    alert("Logged out successfully (forced).");
    window.location.href = "../login/login.html";
  }

  // Bind Logout Event
  function bindLogoutEvent() {
    const logoutLink = $(".dropdown-menu .dropdown-item:contains('Logout')");
    logoutLink.off('click').on('click', function (e) {
      e.preventDefault();
      console.log("🖱️ Logout Clicked");
      logoutUser();
    });
  }

  // Bind Modal Actions
  function bindModalActions() {
    console.log("🔍 Found elements with data-action:", $("[data-action]").length, $("[data-action]").map((i, el) => $(el).data("action")).get());

    const actionToTabMap = {
      "new": "addPatientTab",
      "all-bills": "billsTab",
      "add-services": "addServiceTab",
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
      if (tabElement.length && tabElement.is(":visible")) {
        tabElement.tab('show');
        console.log(`✅ Successfully switched to tab: ${tabId}`);
      } else {
        console.error(`❌ Tab with ID ${tabId} not found or not permitted! Falling back to Add Patient tab`);
        $("#addPatientTab").tab("show");
      }
    });
  }

  // Reset Modal View
  function resetModalView() {
    console.log("🔄 Resetting modal view...");
    const modalBody = $("#modalBody");
    const sidebarContentArea = $("#sidebarContentArea");
    modalBody.removeClass("split-view");
    sidebarContentArea.hide();
  }

  // Setup Patient Search with Autocomplete
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

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Fetch Patient Details
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
        console.log(`✅ Fetched details for patient ${patientId}`);
      },
      error: function (xhr) {
        console.error(`❌ Failed to fetch patient details for ${patientId}:`, {
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseJSON
        });

        let errorMessage = "Failed to fetch patient details.";
        if (xhr.responseJSON && xhr.responseJSON.error) {
          errorMessage = xhr.responseJSON.error;
        } else if (xhr.status === 403) {
          errorMessage = "You do not have permission to view this patient’s details.";
        } else if (xhr.status === 404) {
          errorMessage = "Patient not found.";
        } else {
          errorMessage += ` Unknown error (Status: ${xhr.status}).`;
        }

        alert(errorMessage);
      }
    });
  }

  // Populate Profile Tab
  function populateProfileTab(data) {
    const patient = data.patient || data;
    console.log("📋 Populating profile tab with data:", patient);

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

    initializeDatePickers();

    $('#editProfileBtn').off('click').on('click', function () {
      populateAddPatientForm(patient, appointment);
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
      primary_doctor: $("#doctor").val()
    };

    const appointmentData = appointmentDate ? {
      appointment_date: appointmentDate,
      notes: $("#appointmentNotes").val(),
      doctor_id: $("#doctor").val() || null,
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
  $("#addServiceForm").submit(function (e) {
    e.preventDefault();
    const data = $(this).serializeObject();
    console.info("Submitting add service form...");
    $.ajax({
      url: `${API_BASE_URL}/services/create/`,
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(data),
      contentType: "application/json",
      success: () => {
        console.info("Service added successfully");
        $(this)[0].reset();
        $("#newActionModal").modal("hide");
        showNotification("Service added successfully", "success");
      },
      error: xhr => {
        console.error(`Failed to add service: ${xhr.responseJSON?.error || xhr.statusText}`);
        showNotification(`Failed to add service: ${xhr.responseJSON?.error || "Unknown error"}`, "danger");
      }
    });
  });

  // Add Bills Form Handling
  $(document).ready(function () {
    flatpickr("#billDate", { dateFormat: "Y-m-d", defaultDate: new Date() });

    $("#todayBillBtn").on("click", function () {
      $("#billDate").val(new Date().toISOString().split("T")[0]);
      console.info("Bill date set to today");
    });

    let services = [];
    $.ajax({
      url: `${API_BASE_URL}/services/list/`,
      headers: getAuthHeaders(),
      success: data => {
        services = data;
        console.info(`Fetched ${services.length} services for autocomplete`);
      },
      error: xhr => console.error(`Failed to fetch services: ${xhr.status}`)
    });

    $(document).on("input", ".service-search", function () {
      const $input = $(this);
      const query = $input.val().toLowerCase();
      const $dropdown = $input.next(".autocomplete-dropdown");

      $dropdown.empty().hide();
      if (query.length > 0) {
        const filteredServices = services.filter(s => s.service_name.toLowerCase().includes(query));
        if (filteredServices.length) {
          filteredServices.forEach(service => {
            $dropdown.append(`<li data-service-id="${service.id}" data-price="${service.service_price}">${service.service_name}</li>`);
          });
          $dropdown.show();
        }
      }
    });

    $(document).on("click", ".autocomplete-dropdown li", function () {
      const $li = $(this);
      const $input = $li.closest("td").find(".service-search");
      const $row = $li.closest("tr");
      $input.val($li.text());
      $row.find(".unit-price").val($li.data("price"));
      updateTotalPrice($row);
      $li.parent().hide();
    });

    let itemCount = 1;
    $("#addBillItem").on("click", function () {
      itemCount++;
      const newRow = `
        <tr>
          <td>${itemCount}</td>
          <td>
            <div class="input-group input-group-sm">
              <span class="input-group-text"><i class="fas fa-concierge-bell"></i></span>
              <input type="text" class="form-control service-search" name="service_name[]" placeholder="Search Service" required>
              <ul class="autocomplete-dropdown" style="display: none;"></ul>
            </div>
          </td>
          <td><input type="number" class="form-control form-control-sm" name="quantity[]" min="1" value="1" required></td>
          <td><input type="number" class="form-control form-control-sm unit-price" name="unit_price[]" min="0" step="0.01" required readonly></td>
          <td><input type="number" class="form-control form-control-sm gst" name="gst[]" min="0" max="100" step="0.01" value="0" required></td>
          <td><input type="number" class="form-control form-control-sm discount" name="discount[]" min="0" step="0.01" value="0" required></td>
          <td><input type="number" class="form-control form-control-sm total-price" name="total_price[]" min="0" step="0.01" readonly style="color: red;"></td>
        </tr>`;
      $("#billItemsTableBody").append(newRow);
      console.info(`Added bill item #${itemCount}`);
    });

    function updateTotalPrice($row) {
      const qty = parseFloat($row.find("[name='quantity[]']").val()) || 0;
      const unitPrice = parseFloat($row.find(".unit-price").val()) || 0;
      const gst = parseFloat($row.find(".gst").val()) || 0;
      const discount = parseFloat($row.find(".discount").val()) || 0;
      const total = (qty * unitPrice * (1 + gst / 100)) - discount;
      $row.find(".total-price").val(total.toFixed(2));
      updateDepositColor();
    }

    $(document).on("input", "[name='quantity[]'], .gst, .discount", function () {
      updateTotalPrice($(this).closest("tr"));
    });

    function updateDepositColor() {
      const total = Array.from($(".total-price")).reduce((sum, el) => sum + (parseFloat($(el).val()) || 0), 0);
      const deposit = parseFloat($("#depositAmount").val()) || 0;
      $("#depositAmount").css("color", deposit >= total ? "green" : "red");
    }

    $("#addBillsForm").submit(function (e) {
      e.preventDefault();
      const data = $(this).serializeObject();
      console.info("Submitting add bills form...");
      $.ajax({
        url: `${API_BASE_URL}/bills/create/`,
        type: "POST",
        headers: getAuthHeaders(),
        data: JSON.stringify(data),
        contentType: "application/json",
        success: () => {
          console.info("Bill created successfully");
          $(this)[0].reset();
          $("#newActionModal").modal("hide");
          showNotification("Bill created successfully", "success");
        },
        error: xhr => {
          console.error(`Failed to create bill: ${xhr.responseJSON?.error || xhr.statusText}`);
          showNotification(`Failed to create bill: ${xhr.responseJSON?.error || "Unknown error"}`, "danger");
        }
      });
    });

    $("#cancelBillBtn").on("click", function () {
      $("#addBillsForm")[0].reset();
      console.info("Bill form reset");
    });

    $("#createBillBtn").on("click", function () {
      $("#addBillsForm").submit();
    });

    $("#goBackBtn").on("click", function () {
      $("#newActionTabs .nav-link.active").removeClass("active");
      $("#addPatientTab").addClass("active");
      $("#newActionTabContent .tab-pane.active").removeClass("show active");
      $("#addPatient").addClass("show active");
      console.info("Navigated back to Add Patient tab");
    });
  });

  // Populate Doctor Dropdown
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

  // Event Listeners
  $('#newActionModal').on('shown.bs.modal', function () {
    populateDoctorDropdown();
    initializeDatePickers();
  });

  $('#newActionModal').on('hidden.bs.modal', function () {
    resetModalView();
    updateDetailsSection(null);
  });

  // Initialize
  console.log("🚀 Initializing Dashboard...");
  checkAuthentication();
  bindDateFilterButtons();
  console.log("✅ Dashboard Initialization Complete");
});