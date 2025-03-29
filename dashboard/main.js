// main.js
function resetModalView() {
  console.log("🔄 Resetting modal view...");
  const modalBody = $("#modalBody");
  const sidebarContentArea = $("#sidebarContentArea");
  modalBody.removeClass("split-view");
  sidebarContentArea.hide();
}

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

    // Map actions to tabs
    const actionToTabMap = {
      "new": "addPatientTab",
      "all-bills": "billsTab",
      "add-services": "addBillsTab",
      "patient-q": "addPatientTab",
      "tele-consults": "visitsTab",
      "support": "profileTab"
    };

    // Bind click events for all actionable elements
    $("[data-action]").off('click').on('click', function (e) {
      e.preventDefault();
      const action = $(this).data("action");
      console.log(`🖱️ Action Triggered: ${action}`);

      // Get the corresponding tab ID
      const tabId = actionToTabMap[action] || "addPatientTab";
      console.log(`🎯 Switching to Tab: ${tabId}`);

      // Open the modal
      const modal = $('#newActionModal');
      modal.modal('show');

      // Switch to the appropriate tab
      const tabElement = $(`#${tabId}`);
      if (tabElement.length) {
        tabElement.tab('show');
        console.log(`✅ Successfully switched to tab: ${tabId}`);
      } else {
        console.error(`❌ Tab with ID ${tabId} not found!`);
      }
    });
  }

  // Add toggleSplitView function
  function toggleSplitView(tabId) {
    const modalBody = $("#modalBody");
    const sidebarContentArea = $("#sidebarContentArea");
    const sidebarTabContent = $("#sidebarTabContent");

    // Clear previous sidebar content
    sidebarTabContent.empty();

    // Add the corresponding tab content to the sidebar
    if (tabId === "addBills") {
      sidebarTabContent.html(`
        <div class="tab-pane fade show active" id="sidebarAddBills" role="tabpanel">
          <h6>Add Bill for Patient</h6>
          <form id="sidebarAddBillsForm">
            <div class="mb-2">
              <label for="sidebarBillDescription" class="form-label">Description</label>
              <input type="text" class="form-control form-control-sm" id="sidebarBillDescription" required>
            </div>
            <div class="mb-2">
              <label for="sidebarBillAmount" class="form-label">Amount (₹)</label>
              <input type="number" class="form-control form-control-sm" id="sidebarBillAmount" required>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Add Bill</button>
          </form>
        </div>
      `);

      // Bind the form submission for the sidebar bill form
      $("#sidebarAddBillsForm").off('submit').on('submit', function (e) {
        e.preventDefault();
        const billDescription = $("#sidebarBillDescription").val();
        const billAmount = $("#sidebarBillAmount").val();
        console.log("🖱️ Sidebar Add Bill Submitted:", { billDescription, billAmount });
        alert("Bill added successfully from sidebar! (Placeholder)");
      });
    } else if (tabId === "addPatient") {
      sidebarTabContent.html(`
        <div class="tab-pane fade show active" id="sidebarAddPatient" role="tabpanel">
          <h6>Patient Details</h6>
          <p>Patient details will be displayed here after adding.</p>
        </div>
      `);
    }

    // Show the sidebar by adding the split-view class
    modalBody.addClass("split-view");
    sidebarContentArea.show();
    console.log(`✅ Split view toggled for tab: ${tabId}`);
  }

  // Add updateDetailsSection function
  function updateDetailsSection(patientData) {
    if (patientData) {
      const fullName = `${patientData.first_name} ${patientData.last_name}`;
      const age = patientData.age || 'N/A';
      const patientId = patientData.patient_id || 'N/A';
      const gender = patientData.gender || 'N/A';
  
      $("#detailsTitle").text(`Appointment for ${fullName}`);
      $("#detailsMeta").text(`${gender} | ${age} Years | ${patientId}`);
      $("#visitPadBtn").show();
      console.log("✅ Updated patient details section:", { fullName, gender, age, patientId });
    } else {
      $("#detailsTitle").text('No Patient Selected');
      $("#detailsMeta").text('N/A | N/A | N/A');
      $("#visitPadBtn").hide();
      console.log("✅ Reset patient details section");
    }
  }

  $("#addPatientForm").submit(function (e) {
    e.preventDefault();

    initializeDatePickers();


    // Validate required fields
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

    // Validate date formats
    const dateOfBirth = $("#patientDOB").val();
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      errors.push("Date of Birth must be in YYYY-MM-DD format.");
    }

    const maritalSince = $("#maritalSince").val();
    if (maritalSince && !/^\d{4}-\d{2}-\d{2}$/.test(maritalSince)) {
      errors.push("Marital Since must be in YYYY-MM-DD format.");
    }

    // Ensure we get the value from the hidden Flatpickr input
    // Ensure we get the value from the hidden Flatpickr input
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


    // Transform appointmentDate to YYYY-MM-DDTHH:MM:SS+03:00 format for the API
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
        const fullName = `${data.patient.first_name} ${data.patient.last_name}`;
        const age = data.patient.age || 'N/A';
        const patientId = data.patient.patient_id || 'N/A';
        $("#detailsTitle").text(fullName);
        $("#detailsMeta").text(`${data.patient.gender} | ${age} Years | ${patientId}`);
    
        updateDetailsSection(data.patient);
    
        const activeButton = e.originalEvent.submitter.id;
        if (activeButton === 'addAndCreateBill') {
          toggleSplitView('addBills');
          $('#addBillsTab').tab('show');
        } else if (activeButton === 'addAndCreateAppointment') {
          toggleSplitView('addPatient');
          $('#profileTab').tab('show');
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
    alert("Bill added successfully! (Placeholder)");
  });

  // Initialize
  console.log("🚀 Initializing Dashboard...");
  checkAuthentication();
  console.log("✅ Dashboard Initialization Complete");

  // Fetch Doctors and Populate Dropdown
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

        // Update specialty when a doctor is selected
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

  // Call this function when the modal is opened
  $('#newActionModal').on('shown.bs.modal', function () {
    populateDoctorDropdown();
  });

  resetModalView();
});