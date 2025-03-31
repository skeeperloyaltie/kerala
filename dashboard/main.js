// main.js
$(document).ready(function () {
  const API_BASE_URL = "http://smarthospitalmaintain.com:8000"; // Adjust to your Django API

  // Initialize Flatpickr for Date Filter
  flatpickr("#dateFilter", {
    dateFormat: "Y-m-d",
    defaultDate: "2025-03-28",
    onChange: function (selectedDates, dateStr) {
      console.log("📅 Date Filter Changed - Selected date:", dateStr);
    }
  });
  console.log("🟢 Flatpickr Initialized for #dateFilter with default date: 28 Mar 2025");

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

  // Role-Based UI Adjustments
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
    const $searchInput = $('.navbar-top .form-control');
    const $dropdown = $('<ul class="autocomplete-dropdown"></ul>').hide();
    $searchInput.after($dropdown);

    $searchInput.on('input', debounce(function () {
      const query = $searchInput.val().trim();
      if (query.length < 2) {
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
              $dropdown.append(
                `<li data-patient-id="${patient.patient_id}">${patient.first_name} ${patient.last_name || ''} (ID: ${patient.patient_id})</li>`
              );
            });
            $dropdown.show();
          } else {
            $dropdown.hide();
            showCreatePatientPrompt(query);
          }
        },
        error: function (xhr) {
          console.error("❌ Search error:", xhr.responseText);
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

  // Debounce function to limit API calls
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Fetch Patient Details and Populate Modal
  function fetchPatientDetails(patientId) {
    $.ajax({
      url: `${API_BASE_URL}/patients/detail/${patientId}/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        console.log("✅ Patient details:", data);
        populateProfileTab(data);
        $('#newActionModal').modal('show');
        $('#profileTab').tab('show');
        updateDetailsSection(data);
      },
      error: function (xhr) {
        console.error("❌ Fetch patient error:", xhr.responseText);
        alert("Failed to fetch patient details.");
      }
    });
  }

  // Populate Profile Tab
  function populateProfileTab(patient) {
    const $profileTab = $('#profile');
    // Populate required fields
    $('#profileFirstName').val(patient.first_name || '');
    $('#profileLastName').val(patient.last_name || '');
    $('#profilePhone').val(patient.mobile_number || '');
    $('#profileGender').val(patient.gender || 'N/A');
    $('#profileDOB').val(patient.date_of_birth || 'N/A');
    $('#profilePreferredLanguage').val(patient.preferred_language || 'N/A');
    $('#profileFatherName').val(patient.father_name || 'N/A');
    $('#profileMaritalStatus').val(patient.marital_status || 'N/A');
    $('#profilePaymentPreference').val(patient.payment_preference || 'N/A');
    $('#profileAppointmentDate').val(patient.appointment_date ? patient.appointment_date.replace('T', ' ').substring(0, 16) : 'N/A');
  
    // Populate additional fields
    $('#profileCity').val(patient.city || '');
    $('#profileAddress').val(patient.address || '');
    $('#profilePin').val(patient.pincode || '');
    $('#profileMaritalSince').val(patient.marital_since || '');
    $('#profileBloodGroup').val(patient.blood_group || '');
    $('#profileReferredBy').val(patient.referred_by || '');
    $('#profileDoctor').val(patient.doctor ? `${patient.doctor.first_name} ${patient.doctor.last_name || ''}` : 'N/A');
    $('#profileDoctorSpecialty').val(patient.doctor ? patient.doctor.specialization : '');
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
    $('#profileAppointmentNotes').val(patient.notes || '');
  
    // Add event listeners for addons
    $('#editProfileBtn').off('click').on('click', function () {
      // Transfer data to addPatientForm and switch tab
      $('#patientFirstName').val(patient.first_name || '');
      $('#patientLastName').val(patient.last_name || '');
      $('#patientPhone').val(patient.mobile_number || '');
      $('#patientGender').val(patient.gender || '');
      $('#patientDOB').val(patient.date_of_birth || '');
      $('#preferredLanguage').val(patient.preferred_language || '');
      $('#fatherName').val(patient.father_name || '');
      $('#maritalStatus').val(patient.marital_status || '');
      $('#paymentPreference').val(patient.payment_preference || '');
      $('#appointmentDate').val(patient.appointment_date ? patient.appointment_date.replace('T', ' ').substring(0, 16) : '');
      $('#patientCity').val(patient.city || '');
      $('#patientAddress').val(patient.address || '');
      $('#patientPin').val(patient.pincode || '');
      $('#maritalSince').val(patient.marital_since || '');
      $('#bloodGroup').val(patient.blood_group || '');
      $('#referredBy').val(patient.referred_by || '');
      $('#doctor').val(patient.doctor ? patient.doctor.id : '');
      $('#doctorSpecialty').val(patient.doctor ? patient.doctor.specialization : '');
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
      $('#appointmentNotes').val(patient.notes || '');
  
      $('#addPatientTab').tab('show');
    });
  
    $('#viewAppointmentsBtn').off('click').on('click', function () {
      alert('View Appointments functionality TBD'); // Placeholder
    });
  
    $('#addBillFromProfileBtn').off('click').on('click', function () {
      $('#patientIdForBill').val(patient.patient_id || '');
      $('#addBillsTab').tab('show');
    });
  
    console.log("✅ Profile tab populated with patient data:", patient);
  }

  // Show Prompt to Create New Patient
  function showCreatePatientPrompt(query) {
    const [firstName, ...lastNameParts] = query.split(' ');
    const lastName = lastNameParts.join(' ');

    const $modal = $('#newActionModal');
    $modal.modal('hide');

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
      $modal.modal('show');
      $('#addPatientTab').tab('show');
      $('#patientFirstName').val(firstName);
      $('#patientLastName').val(lastName);
      resetModalView();
      updateDetailsSection(null);
    });

    $(promptModal._element).on('hidden.bs.modal', function () {
      $modal.modal('show');
    });
  }

  // Update Details Section (from clicks.js)
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

  // Toggle Split View (from clicks.js)
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
  
    initializeDatePickers(); // Call from flatpicker.js
  
    const requiredFields = [
      { id: "patientFirstName", name: "First Name" },
      { id: "patientLastName", name: "Last Name" },
      { id: "patientGender", name: "Gender" },
      { id: "patientDOB", name: "Date of Birth" },
      { id: "fatherName", name: "Father's Name" },
      { id: "patientPhone", name: "Phone Number" },
      { id: "preferredLanguage", name: "Preferred Language" },
      { id: "maritalStatus", name: "Marital Status" },
      { id: "paymentPreference", name: "Payment Preference" },
      { id: "appointmentDate", name: "Appointment Date" }
    ];
  
    let errors = [];
    requiredFields.forEach(field => {
      const value = $(`#${field.id}`).val();
      if (!value || value.trim() === "") {
        errors.push(`${field.name} is required.`);
      }
    });
  
    const dateOfBirth = $("#patientDOB").val();
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      errors.push("Date of Birth must be in YYYY-MM-DD format.");
    }
  
    const maritalSince = $("#maritalSince").val();
    if (maritalSince && !/^\d{4}-\d{2}-\d{2}$/.test(maritalSince)) {
      errors.push("Marital Since must be in YYYY-MM-DD format.");
    }
  
    const $appointmentDateInput = $("#appointmentDate");
    let appointmentDate;
    if ($appointmentDateInput[0]._flatpickr && $appointmentDateInput[0]._flatpickr.selectedDates[0]) {
      appointmentDate = $appointmentDateInput[0]._flatpickr.formatDate($appointmentDateInput[0]._flatpickr.selectedDates[0], "Y-m-d H:i");
    } else {
      appointmentDate = $appointmentDateInput.val();
    }
    console.log("🔍 Validating appointmentDate:", appointmentDate);
    if (appointmentDate && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(appointmentDate)) {
      errors.push("Appointment Date must be in YYYY-MM-DD HH:MM format.");
    }
  
    const formattedAppointmentDate = appointmentDate ? `${appointmentDate}:00+03:00`.replace(" ", "T") : null;
    if (!formattedAppointmentDate) {
      errors.push("Appointment Date is required.");
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
      doctor: $("#doctor").val() || null,
      appointment_date: formattedAppointmentDate,
      notes: $("#appointmentNotes").val(),
      is_emergency: false
    };
  
    console.log("📤 Sending patientData to API:", patientData);
  
    $.ajax({
      url: `${API_BASE_URL}/appointments/patients-and-appointments/create/`,
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(patientData),
      contentType: "application/json",
      success: function (data) {
        console.log("✅ Patient and Appointment Created Successfully:", data);
        updateDetailsSection(data.patient);
        populateProfileTab(data.patient); // Populate profile tab after creation
        $('#profileTab').tab('show'); // Switch to profile tab
  
        const activeButton = e.originalEvent.submitter.id;
        if (activeButton === 'addAndCreateBill') {
          toggleSplitView('addBills');
          $('#addBillsTab').tab('show');
          $('#patientIdForBill').val(data.patient.patient_id); // Pre-fill patient ID in bill form
        } else if (activeButton === 'addAndCreateAppointment') {
          toggleSplitView('addPatient');
        }
  
        alert("Patient and appointment added successfully!");
        $("#addPatientForm")[0].reset();
        flatpickr("#patientDOB").clear();
        flatpickr("#maritalSince").clear();
        flatpickr("#appointmentDate").clear();
      },
      error: function (xhr) {
        console.error("❌ Failed to Add Patient and Appointment:", xhr.status, xhr.responseJSON || xhr.statusText);
        let errorMessage = "Unknown error";
        if (xhr.responseJSON) {
          if (xhr.responseJSON.detail) {
            errorMessage = xhr.responseJSON.detail;
          } else if (xhr.responseJSON.appointment_date) {
            errorMessage = `Appointment Date Error: ${xhr.responseJSON.appointment_date}`;
          } else {
            errorMessage = JSON.stringify(xhr.responseJSON);
          }
        } else if (xhr.statusText) {
          errorMessage = xhr.statusText;
        }
        alert(`Failed to add patient and appointment: ${errorMessage}`);
      }
    });
  });

  // Handle Add Bills Form Submission (Placeholder)
  $("#addBillsForm").submit(function (e) {
    e.preventDefault();
    console.log("🖱️ Add Bill Submitted");
  
    // Collect form data
    const billData = {
      patient_id: $("#patientIdForBill").val(), // Assuming a hidden/input field for patient ID
      description: $("#billDescription").val(),
      amount: $("#billAmount").val(),
      date: $("#billDate").val() || new Date().toISOString().split('T')[0] // Default to today if not provided
    };
  
    // Basic validation
    let errors = [];
    if (!billData.patient_id) errors.push("Patient ID is required.");
    if (!billData.description || billData.description.trim() === "") errors.push("Description is required.");
    if (!billData.amount || isNaN(billData.amount) || parseFloat(billData.amount) <= 0) errors.push("A valid amount is required.");
  
    if (errors.length > 0) {
      alert("Please fix the following errors:\n- " + errors.join("\n- "));
      return;
    }
  
    // Send to backend
    $.ajax({
      url: `${API_BASE_URL}/bills/create/`, // Adjust to your actual endpoint
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(billData),
      contentType: "application/json",
      success: function (data) {
        console.log("✅ Bill Added Successfully:", data);
        alert("Bill added successfully!");
        $("#addBillsForm")[0].reset(); // Reset the form
        // Optionally update UI, e.g., refresh bill list or close split view
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

  // Populate Doctor Dropdown
  function populateDoctorDropdown() {
    $.ajax({
      url: `${API_BASE_URL}/appointments/doctors/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        console.log("✅ Doctors Fetched Successfully:", data);
        const doctorSelect = $("#doctor");
        doctorSelect.empty();
        doctorSelect.append('<option value="" selected>Select Doctor</option>');
        data.doctors.forEach(doctor => {
          doctorSelect.append(`<option value="${doctor.id}">${doctor.first_name} ${doctor.last_name}</option>`);
        });

        doctorSelect.on('change', function () {
          const selectedDoctorId = $(this).val();
          const selectedDoctor = data.doctors.find(doctor => doctor.id == selectedDoctorId);
          $("#doctorSpecialty").val(selectedDoctor ? selectedDoctor.specialization : '');
        });
      },
      error: function (xhr) {
        console.error("❌ Failed to Fetch Doctors:", xhr.responseJSON || xhr.statusText);
        alert("Failed to fetch doctors. Please try again.");
      }
    });
  }

  // Event Listeners
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
  console.log("✅ Dashboard Initialization Complete");
});