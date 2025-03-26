$(document).ready(function () {
    const API_BASE_URL = "http://104.37.187.187:8000"; // Adjust to your Django API

    // Show Notification using Bootstrap Modal
    function showNotification(message, type, redirect = null) {
      const modal = $('#notificationModal');
      const messageEl = $('#notificationMessage');
      
      // Update modal content
      messageEl.text(message);
      
      // Update modal title and styling based on type
      $('#notificationModalLabel').text(type === 'success' ? 'Success' : 'Error');
      messageEl.removeClass('text-success text-danger');
      messageEl.addClass(type === 'success' ? 'text-success' : 'text-danger');
      
      // Show the modal
      modal.modal('show');

      // Log the notification
      console.log(`🔔 Notification [${type.toUpperCase()}]: ${message}`);

      // If a redirect is specified, perform it after a delay
      if (redirect) {
        setTimeout(() => {
          console.log(`🔄 Redirecting to: ${redirect}`);
          window.location.href = redirect;
        }, 1000); // Delay to allow user to see the message
      }
    }

    // Initialize Flatpickr for Date Picker
    flatpickr("#datePicker", {
      dateFormat: "d M Y",
      defaultDate: new Date("2025-03-19"), // Set to match screenshot date
      onChange: function (selectedDates, dateStr) {
        console.log("📅 Date Picker Changed - Selected date:", dateStr);
        // Add logic to filter appointments or content based on date
      }
    });
    console.log("🟢 Flatpickr Initialized with default date: 19 Mar 2025");

    // Authentication Check
    function checkAuthentication() {
      const token = localStorage.getItem("token");
      const userType = localStorage.getItem("user_type");
      const roleLevel = localStorage.getItem("role_level");
      const permissions = localStorage.getItem("permissions");

      // Log stored data
      console.log("🔍 Checking Authentication - Stored Data:", {
        token: token ? "Present" : "Missing",
        userType: userType || "Missing",
        roleLevel: roleLevel || "Missing",
        permissions: permissions ? "Present" : "Missing"
      });

      // Check if all required data is present
      if (!token || !userType || !roleLevel || !permissions) {
        console.error("❌ Missing authentication data in localStorage:", {
          token: !!token,
          userType: !!userType,
          roleLevel: !!roleLevel,
          permissions: !!permissions
        });
        showNotification("Authentication failed: Missing required data. Please log in again.", "danger", "../profiling/login.html");
        return;
      }

      // Verify token with the backend
      console.log("🌐 Sending API request to verify token...");
      $.ajax({
        url: `${API_BASE_URL}/users/profile/`,
        headers: { "Authorization": `Token ${token}` },
        success: function (data) {
          const user = data;
          console.log("🟢 User Profile Fetched Successfully:", user);
          adjustUIForRole(userType); // Use stored user_type for role-based UI
          // Update doctor code if available
          if (user.doctor_code) {
            console.log(`👨‍⚕️ Updating Doctor Code: ${user.doctor_code}`);
            $(".doctor-code").text(`Doctor Code: ${user.doctor_code}`);
          }
        },
        error: function (xhr) {
          console.error("❌ Authentication Error:", xhr.responseJSON || xhr.statusText);
          localStorage.clear();
          console.log("🗑️ Cleared localStorage due to authentication failure");
          showNotification("Authentication failed: Invalid token. Please log in again.", "danger", "../profiling/login.html");
        }
      });
    }

    // Role-Based UI Adjustments
    function adjustUIForRole(role) {
      console.log(`🎭 Adjusting UI for Role: ${role}`);
      const navItems = $(".navbar-custom .nav-item");
      navItems.show();
      console.log("🔍 Initial Nav Items Visibility:", navItems.map((i, el) => $(el).text().trim()).get());

      switch (role) {
        case "patient":
          console.log("🚫 Hiding 'Teleconsult' and certain buttons for Patient role");
          navItems.filter(":contains('Teleconsult')").hide();
          $("#newBtn, #uploadPatientListBtn, #viewReportsBtn").hide();
          break;
        case "doctor":
          console.log("✅ Doctor role: All nav items visible");
          break;
        case "nurse":
          console.log("🚫 Hiding 'Refer & Earn' and certain buttons for Nurse role");
          navItems.filter(":contains('Refer & Earn')").hide();
          $("#uploadPatientListBtn, #viewReportsBtn").hide();
          break;
        case "admin":
          console.log("✅ Admin role: All nav items visible");
          break;
        case "receptionist":
          console.log("🚫 Hiding 'Teleconsult' and 'Refer & Earn' for Receptionist role");
          navItems.filter(":contains('Teleconsult'), :contains('Refer & Earn')").hide();
          $("#viewReportsBtn").hide();
          break;
        default:
          console.warn("⚠️ Unknown role:", role);
      }

      console.log("🔍 Final Nav Items Visibility:", navItems.filter(":visible").map((i, el) => $(el).text().trim()).get());
    }

    // Top Navigation Handling
    $(".navbar-custom .nav-link").click(function (e) {
      e.preventDefault();
      const section = $(this).data("section");
      console.log(`🖱️ Navigation Clicked - Switching to section: ${section}`);

      $(".navbar-custom .nav-link").removeClass("active");
      $(this).addClass("active");
      console.log(`✅ Set active nav link: ${$(this).text()}`);

      $(".section").addClass("d-none").removeClass("active");
      $(`#${section}Section`).removeClass("d-none").addClass("active");
      console.log(`✅ Displayed section: ${section}Section`);
    });

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
      showNotification("Logged out successfully.", "success", "../profiling/login.html");
    });

    // Initialize
    console.log("🚀 Initializing Dashboard...");
    checkAuthentication();
    console.log("✅ Dashboard Initialization Complete");
  });