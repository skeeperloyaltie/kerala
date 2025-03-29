// main.js
$(document).ready(function () {
  const API_BASE_URL = "http://104.37.187.187:8000"; // Adjust to your Django API

  // Initialize Flatpickr for Date Filter
  flatpickr("#dateFilter", {
    dateFormat: "Y-m-d",
    defaultDate: "2025-03-28",
    onChange: function (selectedDates, dateStr) {
      console.log("📅 Date Filter Changed - Selected date:", dateStr);
    }
  });
  console.log("🟢 Flatpickr Initialized for #dateFilter with default date: 28 Mar 2025");

  // Initialize Flatpickr for Patient DOB in Modal
  flatpickr("#patientDOBInput", {
    dateFormat: "Y-m-d",
    maxDate: "today",
    onChange: function (selectedDates, dateStr) {
      console.log("📅 Patient DOB Changed - Selected date:", dateStr);
    }
  });

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

  // Handle Add Patient Form Submission
  $("#addPatientForm").submit(function (e) {
    e.preventDefault();
    const patientData = {
      first_name: $("#patientFirstName").val(),
      last_name: $("#patientLastName").val(),
      gender: $("#patientGender").val(),
      age: $("#patientAge").val(),
      phone: $("#patientPhone").val(),
      city: $("#patientCity").val(),
      address: $("#patientAddress").val(),
      pin: $("#patientPin").val(),
      marital_status: $("#maritalStatus").val(),
      marital_since: $("#maritalSince").val(),
      blood_group: $("#bloodGroup").val(),
      referred_by: $("#referredBy").val(),
      doctor_name: $("#doctorName").val(),
      doctor_specialty: $("#doctorSpecialty").val(),
      channel: $("#channel").val(),
      cio: $("#cio").val(),
      occupation: $("#occupation").val(),
      tag: $("#tag").val(),
      mobile2: $("#mobile2").val(),
      aadhar_number: $("#aadharNumber").val()
    };

    $.ajax({
      url: `${API_BASE_URL}/patients/create/`,
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(patientData),
      contentType: "application/json",
      success: function (data) {
        console.log("✅ Patient Created Successfully:", data);
        // Update patient details in the modal
        const fullName = `${data.first_name} ${data.last_name}`;
        const age = data.age || 'N/A';
        const patientId = data.id || 'N/A';
        $("#patientName").text(fullName);
        $("#patientMeta").text(`${data.gender} | ${age} Years | ${patientId}`);
        alert("Patient added successfully!");
        $("#addPatientForm")[0].reset();
      },
      error: function (xhr) {
        console.error("❌ Failed to Add Patient:", xhr.responseJSON || xhr.statusText);
        alert("Failed to add patient. Please try again.");
      }
    });
  });

  // Handle Add Bills Form Submission (Placeholder)
  $("#addBillsForm").submit(function (e) {
    e.preventDefault();
    console.log("🖱️ Add Bill Submitted");
    alert("Bill added successfully! (Placeholder)");
  });

  // Handle Add Payments Form Submission (Placeholder)
  $("#addPaymentsForm").submit(function (e) {
    e.preventDefault();
    console.log("🖱️ Add Payment Submitted");
    alert("Payment added successfully! (Placeholder)");
  });

  // Initialize
  console.log("🚀 Initializing Dashboard...");
  checkAuthentication();
  console.log("✅ Dashboard Initialization Complete");
});