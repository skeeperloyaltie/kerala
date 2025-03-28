$(document).ready(function () {
  const API_BASE_URL = "http://104.37.187.187:8000"; // Adjust to your Django API

  // Show Notification using Bootstrap Modal
  function showNotification(message, type, redirect = null) {
    const modal = $('#notificationModal');
    const messageEl = $('#notificationMessage');
    messageEl.text(message);
    $('#notificationModalLabel').text(type === 'success' ? 'Success' : 'Error');
    messageEl.removeClass('text-success text-danger');
    messageEl.addClass(type === 'success' ? 'text-success' : 'text-danger');
    modal.modal('show');
    console.log(`🔔 Notification [${type.toUpperCase()}]: ${message}`);
    if (redirect) {
      setTimeout(() => {
        console.log(`🔄 Redirecting to: ${redirect}`);
        window.location.href = redirect;
      }, 1000);
    }
  }

  // Initialize Flatpickr (restored and aligned with HTML)
  flatpickr("#dateFilter", {
    dateFormat: "Y-m-d",
    defaultDate: "2025-03-28", // Updated to current date
    onChange: function (selectedDates, dateStr) {
      console.log("📅 Date Filter Changed - Selected date:", dateStr);
    }
  });
  console.log("🟢 Flatpickr Initialized for #dateFilter with default date: 28 Mar 2025");

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
      showNotification("Authentication failed: Missing required data. Please log in again.", "danger", "../login/login.html");
      return;
    }

    $.ajax({
      url: `${API_BASE_URL}/users/profile/`,
      type: "GET",
      headers: { "Authorization": `Token ${token}` },
      successA: function (data) {
        console.log("🟢 User Profile Fetched Successfully:", data);
        adjustUIForRole(userType, roleLevel);
        if (data.doctor_code) {
          console.log(`👨‍⚕️ Updating Doctor Code: ${data.doctor_code}`);
          $(".doctor-code").text(`Doctor Code: ${data.doctor_code}`); // Restore if needed
        }
      },
      error: function (xhr) {
        console.error("❌ Authentication Error:", xhr.responseJSON || xhr.statusText);
        localStorage.clear();
        console.log("🗑️ Cleared localStorage due to authentication failure");
        showNotification("Authentication failed: Invalid token. Please log in again.", "danger", "../login/login.html");
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

    navItems.show();
    secondaryNavItems.show();
    buttons.show();
    searchInput.show();
    dateFilter.show();
    dashboardDropdown.show();

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
        buttons.filter(":contains('New')").hide(); // Adjusted to match HTML
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
        showNotification("Unknown role detected. Access restricted.", "danger");
        navItems.hide();
        secondaryNavItems.hide();
        buttons.hide();
    }

    console.log("🔍 Final Nav Items Visibility:", navItems.filter(":visible").map((i, el) => $(el).text().trim()).get());
  }
// Button Actions
$("#newBtn").click(function () {
  console.log("🖱️ New Button Clicked");
  showNotification("New action triggered. (Placeholder)", "success");
  // Add logic to open a modal for creating a new appointment or patient
});

$("#searchPatientBtn").click(function () {
  console.log("🖱️ Search Patient Button Clicked");
  showNotification("Search Patient action triggered. (Placeholder)", "success");
  // Add logic to open a search modal or redirect to a search page
});

$("#supportBtn").click(function () {
  console.log("🖱️ Support Button Clicked");
  showNotification("Support action triggered. (Placeholder)", "success");
  // Add logic to open a support modal or redirect to support page
});

$("#uploadPatientListBtn").click(function () {
  console.log("🖱️ Upload Patient List Button Clicked");
  showNotification("Upload Patient List action triggered. (Placeholder)", "success");
  // Add logic to handle file upload
});

$("#viewReportsBtn").click(function () {
  console.log("🖱️ View Reports Button Clicked");
  showNotification("Switching to Reports section.", "success");
  $(".section").addClass("d-none").removeClass("active");
  $("#reportsSection").removeClass("d-none").addClass("active");
  console.log("✅ Displayed Reports section");
  $(".navbar-custom .nav-link").removeClass("active");
  console.log("✅ Cleared active nav link");
});

$("#logoutBtn").click(function (e) {
  e.preventDefault();
  console.log("🖱️ Logout Button Clicked");
  localStorage.clear();
  console.log("🗑️ Cleared localStorage");
  showNotification("Logged out successfully.", "success", "../login/login.html");
});

  // Initialize
  console.log("🚀 Initializing Dashboard...");
  checkAuthentication();
  console.log("✅ Dashboard Initialization Complete");
});