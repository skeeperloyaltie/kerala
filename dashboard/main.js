

$(document).ready(function () {
  // main.js
// Ensure global dependencies are available
const moment = window.moment;
const { Calendar } = window.FullCalendar;
const $ = window.jQuery;

  const API_BASE_URL = "http://smarthospitalmaintain.com:8000"; // Adjust to your Django API

  // Initialize intl-tel-input for phone numbers
  const phoneInput = document.querySelector("#patientPhone");
  const mobile2Input = document.querySelector("#mobile2");

  const itiPhone = intlTelInput(phoneInput, {
    initialCountry: "in",
    separateDialCode: true,
    utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js"
  });

  const itiMobile2 = intlTelInput(mobile2Input, {
    initialCountry: "in",
    separateDialCode: true,
    utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js"
  });

  // Handle tabbed gender selection
  $('.btn-group input[name="patientGender"]').on('change', function () {
    const selectedGender = $(this).val();
    $('#patientGender').val(selectedGender);
    console.log(`🖱️ Selected gender: ${selectedGender}`);
    // Update button styles to indicate selection
    $('.btn-group label').removeClass('active');
    $(this).next('label').addClass('active');
  });

  // Initialize Bootstrap for Bill Date
  function validateDateInput(inputId, format = 'YYYY-MM-DD') {
    const $input = $(`#${inputId}`);
    $input.on('input', function() {
      const value = $input.val();
      const regex = format === 'YYYY-MM-DD' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
      if (value && !regex.test(value)) {
        // $input.addClass('is-invalid');
        $input.next('.invalid-feedback').remove();
        // $input.after('<div class="invalid-feedback">Please use format ' + format + '</div>');
      } else {
        $input.next('.invalid-feedback').remove();
      }
    });
  }
  
  $(document).ready(function() {
    validateDateInput('billDate');
    validateDateInput('patientDOB');
    validateDateInput('appointmentDate', 'YYYY-MM-DD HH:mm');
  });

  // Get Authentication Headers
  function getAuthHeaders() {
    const token = sessionStorage.getItem("token");
    return token ? { "Authorization": `Token ${token}` } : {};
  }

  // Authentication Check
  // Function to check authentication and set dashboard type/username
function checkAuthentication() {
  const token = sessionStorage.getItem('token');
  const userType = sessionStorage.getItem('user_type');
  const roleLevel = sessionStorage.getItem('role_level');
  const permissions = sessionStorage.getItem('permissions');

  console.log('🔍 Checking Authentication - Stored Data:', {
    token: token ? 'Present' : 'Missing',
    userType: userType || 'Missing',
    roleLevel: roleLevel || 'Missing',
    permissions: permissions ? 'Present' : 'Missing',
  });

  if (!token || !userType || !roleLevel || !permissions) {
    console.error('❌ Missing authentication data in sessionStorage:', {
      token: !!token,
      userType: !!userType,
      roleLevel: !!roleLevel,
      permissions: !!permissions,
    });
    alert('Authentication failed: Missing required data. Please log in again.');
    window.location.href = '../login/login.html';
    return;
  }

  $.ajax({
    url: `${API_BASE_URL}/users/profile/`,
    type: 'GET',
    headers: { Authorization: `Token ${token}` },
    success: function (data) {
      console.log('🟢 User Profile Fetched Successfully:', data);
      if (data.doctor_id) {
        sessionStorage.setItem('doctor_id', data.doctor_id);
        console.log(`👨‍⚕️ Stored Doctor ID: ${data.doctor_id}`);
      }
      // Pass username to adjustUIForRole
      adjustUIForRole(userType, roleLevel, data.username || 'Unknown User');
      if (data.doctor_code) {
        console.log(`👨‍⚕️ Updating Doctor Code: ${data.doctor_code}`);
        $('.doctor-code').text(`Doctor Code: ${data.doctor_code}`);
      }
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      fetchAppointmentsByDate(todayStr); // Explicitly fetch today's appointments
    },
    error: function (xhr) {
      console.error('❌ Authentication Error:', xhr.responseJSON || xhr.statusText);
      sessionStorage.clear();
      console.log('🗑️ Cleared sessionStorage due to authentication failure');
      alert('Authentication failed: Invalid token. Please log in again.');
      window.location.href = '../login/login.html';
    },
  });
}

  // Fetch Indian Cities for Autocomplete
  let indianCities = [];
  let isFetchingCities = false;

  // Fallback city list for testing
  const fallbackCities = [
    { name: "Mumbai", state: "Maharashtra" },
    { name: "Delhi", state: "Delhi" },
    { name: "Bengaluru", state: "Karnataka" },
    { name: "Chennai", state: "Tamil Nadu" },
    { name: "Kolkata", state: "West Bengal" },
    { name: "Rajkot", state: "Gujarat" },
    { name: "Bhopal", state: "Madhya Pradesh" }
  ];

  // Fetch Indian Cities for Autocomplete
  function fetchIndianCities(attempt = 1, maxAttempts = 3) {
    if (isFetchingCities) {
      console.log("⏳ Fetch already in progress, skipping...");
      return;
    }
    isFetchingCities = true;
    console.log(`🌍 Fetching Indian cities (attempt ${attempt})...`);
    $.ajax({
      url: "https://raw.githubusercontent.com/nshntarora/indian-cities-json/master/cities.json",
      type: "GET",
      cache: true,
      timeout: 5000,
      dataType: "json",
      success: function (data) {
        indianCities = data
          .filter(city => city.name && typeof city.name === "string") // Ensure valid names
          .map(city => ({
            name: city.name.trim().replace(/\s+/g, " "), // Normalize whitespace
            state: city.state ? city.state.trim() : ""
          }));
        console.log(`✅ Loaded ${indianCities.length} Indian cities`, indianCities.slice(0, 10)); // Log first 10
        isFetchingCities = false;
        // Verify common cities
        const testCities = ["Mumbai", "Delhi", "Bengaluru", "Rajkot", "Bhopal"];
        testCities.forEach(city => {
          const found = indianCities.some(c => c.name.toLowerCase() === city.toLowerCase());
          console.log(`🔍 Test for ${city}: ${found ? "Found" : "Not found"}`);
        });
      },
      error: function (xhr, status, error) {
        console.error(`❌ Failed to fetch Indian cities (attempt ${attempt}):`, { status, error, xhr });
        isFetchingCities = false;
        if (attempt < maxAttempts) {
          console.log(`🔄 Retrying fetch (attempt ${attempt + 1})...`);
          setTimeout(() => fetchIndianCities(attempt + 1, maxAttempts), 1000);
        } else {
          console.warn("⚠️ Using fallback city list");
          indianCities = fallbackCities;
          console.log(`✅ Loaded ${indianCities.length} fallback cities`, indianCities);
          alert("Failed to load city suggestions. Using a basic city list.");
        }
      }
    });
  }

  // Setup City Autocomplete
  function setupCityAutocomplete(inputId) {
    const $input = $(`#${inputId}`);
    const $dropdown = $('<ul class="autocomplete-dropdown city-autocomplete"></ul>').hide();
    $input.after($dropdown);

    $input.on("input", debounce(function () {
      const query = $input.val().trim().toLowerCase();
      console.log(`🔍 City search for ${inputId}: "${query}"`);
      console.log(`🔍 indianCities length: ${indianCities.length}`);

      $dropdown.empty();

      if (query.length < 2) {
        $dropdown.append('<li class="dropdown-item disabled">Type at least 2 characters</li>');
        $dropdown.show();
        return;
      }

      if (isFetchingCities) {
        $dropdown.append('<li class="dropdown-item disabled">Loading cities...</li>');
        $dropdown.show();
        return;
      }

      if (indianCities.length === 0) {
        console.log("⚠️ No cities loaded, attempting to fetch...");
        fetchIndianCities();
        $dropdown.append('<li class="dropdown-item disabled">Loading cities...</li>');
        $dropdown.show();
        return;
      }

      // Filter cities with includes for broader matching
      const filteredCities = indianCities.filter(city => {
        const matches = city.name.toLowerCase().includes(query);
        if (matches) {
          console.log(`✅ Match found: ${city.name} for query "${query}"`);
        }
        return matches;
      });

      console.log(`🔍 Filtered cities:`, filteredCities);

      if (filteredCities.length === 0) {
        $dropdown.append('<li class="dropdown-item disabled">No cities found</li>');
      } else {
        filteredCities.slice(0, 10).forEach(city => {
          $dropdown.append(
            `<li class="dropdown-item" data-city="${city.name}">${city.name}, ${city.state}</li>`
          );
        });
      }
      $dropdown.show();
    }, 300));

    // Handle city selection
    $dropdown.on("click", "li:not(.disabled)", function () {
      const cityName = $(this).data("city");
      $input.val(cityName);
      $dropdown.hide();
      console.log(`✅ Selected city for ${inputId}: ${cityName}`);
    });

    // Hide dropdown on outside click
    $(document).on("click", function (e) {
      if (!$(e.target).closest(`#${inputId}, .city-autocomplete`).length) {
        $dropdown.hide();
      }
    });

    // Handle Enter key to select first suggestion
    $input.on("keydown", function (e) {
      if (e.key === "Enter" && $dropdown.is(":visible")) {
        const $firstItem = $dropdown.find("li:not(.disabled):first");
        if ($firstItem.length) {
          $input.val($firstItem.data("city"));
          $dropdown.hide();
          e.preventDefault();
        }
      }
    });
  }

  // Initialize City Autocomplete
  fetchIndianCities();
  setupCityAutocomplete("patientCity");
  setupCityAutocomplete("profileCity");

  // Role-Based UI Adjustments
  function adjustUIForRole(userType, roleLevel) {
    console.log(`🎭 Adjusting UI for UserType: ${userType}, RoleLevel: ${roleLevel}`);
    const dashboardMap = {
      admin: 'Admin Dashboard',
      doctor: 'Doctor Dashboard',
      receptionist: 'Receptionist Dashboard',
    };
    
  const username = sessionStorage.getItem('username') || 'Unknown User';
    const dashboardType = dashboardMap[userType.toLowerCase()] || 'Unknown Dashboard';
    const dashboardTypeElement = document.getElementById('dashboardType');
    const usernameElement = document.getElementById('usernameDisplay');
    
    if (dashboardTypeElement) {
      dashboardTypeElement.textContent = dashboardType;
      console.log(`📊 Updated dashboard type to: ${dashboardType}`);
    } else {
      console.error('❌ Dashboard type element (#dashboardType) not found');
    }
  
    if (usernameElement) {
      usernameElement.textContent = username;
      console.log(`👤 Updated username to: ${username}`);
    } else {
      console.error('❌ Username element (#usernameDisplay) not found');
    }
    const navItems = $(".navbar-top .nav-item");
    const secondaryNavItems = $(".navbar-secondary .nav-item");
    const buttons = $(".navbar-top .btn, .navbar-secondary .btn");
    const searchInput = $(".navbar-top .form-control");
    const dateFilter = $("#dateFilter");
    const dashboardDropdown = $("#dashboardDropdown").parent();
    const logoutLink = $(".dropdown-menu .dropdown-item:contains('Logout')");
    const modalTabs = $("#newActionTabs .nav-item");

    // Show all elements by default
    navItems.show();
    secondaryNavItems.show();
    buttons.show();
    searchInput.show();
    dateFilter.show();
    dashboardDropdown.show();
    logoutLink.show();
    modalTabs.show();

    const role = `${userType}-${roleLevel}`.toLowerCase();
    const permissions = JSON.parse(sessionStorage.getItem("permissions") || "[]");

    if (role === "doctor-senior") {
      console.log("✅ Granting full access to doctor-senior");
      modalTabs.show();
      $("#newActionTabContent .tab-pane").find("input, select, button, textarea").prop("disabled", false);
    } else {
      switch (role) {
        case "doctor-medium":
          navItems.filter(":contains('Add Services')").hide();
          modalTabs.filter(":contains('Add Service')").hide();
          dashboardDropdown.hide();
          secondaryNavItems.filter(":contains('Reviewed')").hide();
          break;
        case "doctor-basic":
          navItems.filter(":contains('All Bills'), :contains('Add Services')").hide();
          modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
          buttons.filter(":contains('New')").hide();
          secondaryNavItems.filter(":contains('Reviewed'), :contains('On-Going')").hide();
          $(".navbar-secondary .btn-circle").not(":contains('Filter'), :contains('Star')").hide();
          dashboardDropdown.hide();
          break;
        case "nurse-senior":
          navItems.filter(":contains('Add Services'), :contains('Tele Consults')").hide();
          modalTabs.filter(":contains('Add Service')").hide();
          buttons.filter(":contains('New')").hide();
          secondaryNavItems.filter(":contains('Reviewed')").hide();
          $(".navbar-secondary .btn-circle").not(":contains('Filter')").hide();
          dashboardDropdown.hide();
          break;
        case "nurse-medium":
          navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
          modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
          buttons.filter(":contains('New'), :contains('Support')").hide();
          secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
          $(".navbar-secondary .btn-circle").hide();
          dashboardDropdown.hide();
          break;
        case "nurse-basic":
          navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
          modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
          buttons.hide();
          searchInput.hide();
          dateFilter.hide();
          secondaryNavItems.filter(":contains('Booked'), :contains('On-Going'), :contains('Reviewed')").hide();
          dashboardDropdown.hide();
          break;
        case "receptionist-senior":
          navItems.filter(":contains('Add Services'), :contains('Tele Consults')").hide();
          modalTabs.filter(":contains('Add Service')").hide();
          secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
          $(".navbar-secondary .btn-circle").not(":contains('Filter')").hide();
          dashboardDropdown.hide();
          break;
        case "receptionist-medium":
          navItems.filter(":contains('Add Services'), :contains('Tele Consults')").hide();
          modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
          buttons.filter(":contains('Support')").hide();
          secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
          $(".navbar-secondary .btn-circle").hide();
          dashboardDropdown.hide();
          break;
        case "receptionist-basic":
          navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
          modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
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
          modalTabs.hide();
      }
    }

    // Re-apply modal tabs based on current action (if modal is open)
    if ($("#newActionModal").hasClass("show")) {
      adjustModalTabs(currentModalAction);
    }

    console.log("🔍 Final Nav Items Visibility:", navItems.filter(":visible").map((i, el) => $(el).text().trim()).get());
    console.log("🔍 Final Modal Tabs Visibility:", modalTabs.filter(":visible").map((i, el) => $(el).text().trim()).get());

    bindLogoutEvent();
    bindModalActions();
    bindNavActions(); // Bind navigation actions
    setupPatientSearch();
  }

  // Mark appointments for a given date
function markAppointmentsForDate(dateStr) {
  if (!appointmentsData || !Array.isArray(appointmentsData)) return;

  // Clear any existing appointment indicators
  const $dateFilter = $("#dateFilter");
  $dateFilter.removeAttr('data-appointment-times').removeClass('has-appointment');

  // Process appointments for the selected date
  const appointmentTimes = [];
  appointmentsData.forEach(appt => {
    if (!appt.appointment_date) return;
    const apptDate = new Date(appt.appointment_date);
    const apptDateStr = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, "0")}-${String(apptDate.getDate()).padStart(2, "0")}`;
    if (apptDateStr === dateStr) {
      const apptTime = apptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      appointmentTimes.push(apptTime);
    }
  });

  // If there are appointments, mark the input
  if (appointmentTimes.length > 0) {
    $dateFilter.addClass('has-appointment');
    $dateFilter.attr('data-appointment-times', appointmentTimes.join(', '));
    console.log(`🟢 Marked appointments for ${dateStr}:`, appointmentTimes);
  } else {
    console.log(`ℹ️ No appointments for ${dateStr}`);
  }
}
  // main.js (replace relevant sections)
  let appointmentsData = [];

  validateDateInput('dateFilter', function(dateStr) {
    // Fetch appointments for the selected date
    $.ajax({
      url: `${API_BASE_URL}/appointments/list/?date=${dateStr}`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function(data) {
        appointmentsData = Array.isArray(data.appointments) ? data.appointments : [];
        console.log(`📅 Loaded appointments for ${dateStr}:`, appointmentsData);
        fetchAppointmentsByDate(dateStr); // Update UI
        markAppointmentsForDate(dateStr); // Mark appointments
      },
      error: function(xhr) {
        console.warn(`⚠️ Failed to load appointments for ${dateStr}: ${xhr.responseJSON?.error || "Server Unavailable"}`);
        appointmentsData = [];
        markAppointmentsForDate(dateStr); // Clear markers on error
      }
    });
  });
  bindDateFilterButtons();

  // Set today's date and trigger fetch/marking
  const today = new Date();
  $("#dateFilter").val(today).trigger('input');

  // Optional: Initialize Bootstrap tooltip for appointment times
  $("#dateFilter").tooltip({
    title: function() {
      return $(this).hasClass('has-appointment') ? `Appointments: ${$(this).attr('data-appointment-times')}` : 'No appointments';
    },
    trigger: 'hover',
    placement: 'bottom'
  });

  console.log("🟢 Date Filter Initialized with default date: Today");

  // Bind actions to date filter buttons
function bindDateFilterButtons() {
  // "Set" button: Validate and fetch appointments
  $(".btn:contains('Set')").on("click", function() {
    const dateStr = $("#dateFilter").val();
    console.log("🖱️ Set Date Clicked:", dateStr);
    if (dateStr) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        fetchAppointmentsByDate(dateStr);
      } else {
        alert("Please enter a valid date in YYYY-MM-DD format.");
        $("#dateFilter").addClass('is-invalid');
        $("#dateFilter").next('.invalid-feedback').remove();
        $("#dateFilter").after('<div class="invalid-feedback">Please use format YYYY-MM-DD</div>');
      }
    } else {
      alert("Please enter a date.");
    }
  });

  // "Today" button: Set today's date and fetch appointments
  $(".btn:contains('Today')").on("click", function() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    console.log("🖱️ Today Clicked:", todayStr);
    $("#dateFilter").val(todayStr).trigger('input'); // Trigger validation and fetch
  });

  // Calendar Trigger: Optional action (e.g., toggle FullCalendar or disabled)
  $("#calendarTrigger").on("click", function() {
    console.log("🗓️ Calendar button clicked");
    // Option 1: Toggle FullCalendar visibility (if implemented)
    $("#appointmentsCalendar").toggle();
    
    // Option 2: Show a message (temporary)
    alert("Calendar view is not available. Please enter a date manually in YYYY-MM-DD format.");
    
    // Option 3: Disable button (uncomment to disable)
    // $(this).prop('disabled', true).addClass('disabled');
  });
}

  // Global view state (assumed to be set by toggleView)
  let currentView = 'table'; // Default to table view
  function fetchAppointmentsByDate(dateStr = null, filter = 'all', doctorId = 'all') {
    const today = new Date();
    const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedDate = dateStr || defaultDate;
  
    console.log(`📅 Fetching appointments for date: ${selectedDate}, filter: ${filter}, doctorId: ${doctorId}, view: ${currentView}`);
  
    // Update #dateFilter to reflect the selected date
    $("#dateFilter").val(selectedDate).trigger('input'); // Trigger validation and related logic
  
    // Build API URL based on view
    let url;
    let startDateStr, endDateStr;
  
    if (currentView === 'table') {
      // Table view: Fetch single day
      startDateStr = selectedDate;
      endDateStr = selectedDate; // Same day for single-day query
      url = `${API_BASE_URL}/appointments/list/?start_date=${startDateStr}&end_date=${endDateStr}`;
    } else {
      // Calendar view: Fetch week
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6); // End on Saturday
  
      startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      url = `${API_BASE_URL}/appointments/list/?start_date=${startDateStr}&end_date=${endDateStr}`;
    }
  
    if (doctorId !== 'all') {
      url += `&doctor_id=${doctorId}`;
    }
  
    $.ajax({
      url: url,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        console.log(`📥 Raw API response for ${startDateStr} to ${endDateStr}:`, data);
  
        // Normalize appointments data
        let appointmentsArray = [];
        if (Array.isArray(data)) {
          appointmentsArray = data;
        } else if (data && Array.isArray(data.appointments)) {
          appointmentsArray = data.appointments;
        } else if (data && Array.isArray(data.results)) {
          appointmentsArray = data.results;
        } else {
          console.warn(`⚠️ Unexpected response format:`, data);
          appointmentsArray = [];
        }
  
        // Filter by status
        const statusMap = {
          'all': ['booked', 'arrived', 'on-going', 'reviewed', 'scheduled'],
          'booked': ['booked'],
          'arrived': ['arrived'],
          'on-going': ['on-going'],
          'reviewed': ['reviewed'],
          'scheduled': ['scheduled']
        };
        const allowedStatuses = statusMap[filter.toLowerCase()] || statusMap['all'];
  
        appointmentsArray = appointmentsArray.filter(appt => {
          if (!appt || !appt.status) return false;
          return allowedStatuses.includes(appt.status.toLowerCase());
        });
  
        // Populate based on current view
        if (currentView === 'table') {
          populateAppointmentsTable(appointmentsArray, selectedDate, doctorId);
        } else {
          populateAppointmentsCalendar(appointmentsArray, startDateStr, doctorId);
        }
  
        console.log(`✅ Fetched ${appointmentsArray.length} appointments for ${startDateStr} to ${endDateStr} with filter ${filter} and doctorId ${doctorId}`);
      },
      error: function (xhr) {
        console.error(`❌ Failed to fetch appointments: ${xhr.responseJSON?.error || "Server Unavailable"}`);
        alert(`Failed to fetch appointments: ${xhr.responseJSON?.error || "Server Unavailable"}`);
        // Show empty view
        if (currentView === 'table') {
          populateAppointmentsTable([], selectedDate, doctorId);
        } else {
          populateAppointmentsCalendar([], startDateStr, doctorId);
        }
      }
    });
  }

  // Bind Navigation Filters
  function bindNavFilters() {
    $(".navbar-secondary .nav-item a").on("click", function (e) {
      e.preventDefault();
      const section = $(this).data("section");
      console.log(`🖱️ Filter clicked: ${section}`);

      // Update active class
      $(".navbar-secondary .nav-item a").removeClass("active");
      $(this).addClass("active");

      // Get current date from #dateFilter
      const dateStr = $("#dateFilter").val();
      if (dateStr) {
        fetchAppointmentsByDate(dateStr, section);
      } else {
        console.warn("No date selected, fetching for today");
        fetchAppointmentsByDate(null, section);
      }
    });
  }

  // Initialize Dashboard
  $(document).ready(function () {
    console.log("🚀 Initializing Dashboard...");
    checkAuthentication();
    bindDateFilterButtons();
    bindNavFilters();
    // Fetch today's appointments on page load
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    fetchAppointmentsByDate(todayStr);
    console.log("✅ Dashboard Initialization Complete");
  });

  
  // Fetch Appointments by Date
  function populateDoctorDropdownForFilter() {
    const doctorSelect = $("#doctorFilter");
    doctorSelect.empty().append('<option value="all">All Doctors</option>');
  
    $.ajax({
      url: `${API_BASE_URL}/appointments/doctors/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        console.log("Doctor API response for filter:", data);
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
        console.error(`Failed to fetch doctors for filter: ${xhr.status}`, xhr.responseJSON);
        doctorSelect.empty().append('<option value="" disabled>Failed to load doctors</option>');
        alert("Failed to fetch doctors for filter.");
      }
    });
  }


  function bindDoctorFilter() {
    $("#doctorFilter").on("change", function () {
      const doctorId = $(this).val();
      const dateStr = $("#dateFilter").val();
      const filter = $(".navbar-secondary .nav-item a.active").data("section") || "all";
      console.log(`🖱️ Doctor filter changed to: ${doctorId}`);
      fetchAppointmentsByDate(dateStr, filter, doctorId);
    });
  }

  function updateAppointmentStatus(appointmentId, newStatus, $row = null, selectedDate = null, callback = null) {
    $.ajax({
      url: `${API_BASE_URL}/appointments/edit/${appointmentId}/`,
      type: "PATCH",
      headers: getAuthHeaders(),
      data: JSON.stringify({ status: newStatus }),
      contentType: "application/json",
      success: function (updatedAppointment) {
        console.log(`✅ Updated appointment ${appointmentId} to status ${newStatus}`);
        if ($row) {
          // Update table row if provided (for backward compatibility)
          const statusClass = newStatus ? `status-${newStatus.toLowerCase().replace(' ', '-')}` : 'status-unknown';
          $row.find('.status-select').val(newStatus);
          $row.find('.status-cell').html(`<span class="${statusClass}">${newStatus.toUpperCase()}</span>`);
        }
        if (callback) {
          callback(); // Execute callback to refresh UI
        }
      },
      error: function (xhr) {
        console.error(`❌ Failed to update appointment ${appointmentId}:`, xhr.responseJSON || xhr.statusText);
        alert(`Failed to update status: ${xhr.responseJSON?.error || "Server Unavailable"}`);
        if ($row) {
          $row.find('.status-select').val($row.find('.status-select').data('original-status'));
        }
      }
    });
  }

  function showAppointmentDetails(appointmentId) {
    console.log(`🔍 Fetching details for appointment ID: ${appointmentId}`);

    $.ajax({
        url: `${API_BASE_URL}/appointments/list/?appointment_id=${appointmentId}`, // Correct endpoint
        type: "GET",
        headers: getAuthHeaders(),
        success: function (response) {
            console.log(`✅ Appointment details fetched:`, response);

            // Extract appointment data from the response
            if (!response.appointments || !response.appointments.length) {
                console.error('No appointment data found in response:', response);
                alert('No appointment details found.');
                return;
            }
            const appointment = response.appointments[0];

            // Format appointment details for display
            const patientName = appointment.patient && appointment.patient.first_name
                ? `${appointment.patient.first_name} ${appointment.patient.last_name || ''}`
                : 'Unnamed';
            const doctorName = appointment.doctor && appointment.doctor.first_name
                ? `${appointment.doctor.first_name} ${appointment.doctor.last_name || ''}`
                : 'N/A';
            const apptDate = new Date(appointment.appointment_date);
            const istDate = new Date(apptDate.getTime() + (5.5 * 60 * 60 * 1000)); // Convert to IST
            const formattedDate = istDate.toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
            });

            // Create modal content
            const modalHtml = `
                <div class="modal fade" id="appointmentDetailsModal" tabindex="-1" aria-labelledby="appointmentDetailsModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="appointmentDetailsModalLabel">Appointment Details (ID: ${appointmentId})</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <p><strong>Patient:</strong> ${patientName}</p>
                                <p><strong>Doctor:</strong> ${doctorName}</p>
                                <p><strong>Date & Time:</strong> ${formattedDate}</p>
                                <p><strong>Status:</strong> ${appointment.status?.toUpperCase() || 'N/A'}</p>
                                <p><strong>Notes:</strong> ${appointment.notes || 'None'}</p>
                                <p><strong>Illness:</strong> ${appointment.patient?.current_medications || 'None'}</p>
                                <p><strong>Emergency:</strong> ${appointment.is_emergency ? 'Yes' : 'No'}</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="editAppointment(${appointmentId})">Edit</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove any existing modal
            $('#appointmentDetailsModal').remove();

            // Append and show modal
            $('body').append(modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('appointmentDetailsModal'), {
                backdrop: 'static',
                keyboard: true
            });
            modal.show();

            // Clean up modal on hide
            $('#appointmentDetailsModal').on('hidden.bs.modal', function () {
                $(this).remove();
            });
        },
        error: function (xhr) {
            console.error(`❌ Failed to fetch appointment details for ID ${appointmentId}: ${xhr.responseJSON?.error || xhr.statusText}`);
            alert(`Failed to load appointment details: ${xhr.responseJSON?.error || 'Server unavailable. Please try again.'}`);
        }
    });
}
// Initialize view state
let currentDate = new Date(); // Current date for table view
let currentWeekStart = new Date(); // Week start for calendar view
currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay()); // Start of current week (Sunday)

// Format date to YYYY-MM-DD
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}


// Populate table view for a single day
function populateAppointmentsTable(appointments, dateStr, doctorId = 'all') {
  const tableBody = document.getElementById('appointmentsTableBody');
  tableBody.innerHTML = '';

  const targetDate = new Date(dateStr);
  if (isNaN(targetDate)) {
    console.error('Invalid dateStr:', dateStr);
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Invalid date selected.</td></tr>';
    return;
  }

  const dateStrFormatted = formatDate(targetDate);
  console.log(`📅 Populating table for ${dateStrFormatted}, doctorId: ${doctorId}`);

  // Filter appointments for the selected date and doctor
  let filteredAppointments = appointments;
  if (doctorId !== 'all') {
    filteredAppointments = appointments.filter(appt => appt.doctor && appt.doctor.id == doctorId);
  } else {
    const loggedInDoctorId = sessionStorage.getItem('doctor_id');
    if (loggedInDoctorId && loggedInDoctorId !== 'null') {
      filteredAppointments = appointments.filter(appt => appt.doctor && appt.doctor.id == loggedInDoctorId);
      console.log(`🔍 Filtering for logged-in doctor ID: ${loggedInDoctorId}`);
    }
  }

  filteredAppointments = filteredAppointments.filter(appt => {
    if (!appt || !appt.appointment_date) {
      console.warn(`⚠️ Invalid appointment:`, appt);
      return false;
    }
    const apptDateStr = appt.appointment_date.split('T')[0];
    return apptDateStr === dateStrFormatted;
  });

  if (filteredAppointments.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No appointments found for ${dateStrFormatted}.</td></tr>`;
    console.log(`ℹ️ No appointments for ${dateStrFormatted}, doctorId: ${doctorId}`);
    return;
  }

  console.log(`📋 Filtered ${filteredAppointments.length} appointments for ${dateStrFormatted}:`, filteredAppointments.map(appt => ({
    id: appt.id,
    appointment_date: appt.appointment_date,
    status: appt.status
  })));

  // Sort appointments by time
  filteredAppointments.sort((a, b) => {
    const timeA = a.appointment_date.split('T')[1];
    const timeB = b.appointment_date.split('T')[1];
    return timeA.localeCompare(timeB);
  });

  // Populate table rows
  filteredAppointments.forEach(appt => {
    const row = document.createElement('tr');
    const time = appt.appointment_date.split('T')[1].split(':').slice(0, 2).join(':'); // e.g., "08:30"
    const patientName = appt.patient && appt.patient.first_name
      ? `${appt.patient.first_name} ${appt.patient.last_name || ''}`
      : 'Unnamed';
    const doctorName = appt.doctor && appt.doctor.first_name
      ? `${appt.doctor.first_name} ${appt.doctor.last_name || ''}`
      : 'N/A';
    const statusClass = appt.status ? `status-${appt.status.toLowerCase().replace(' ', '-')}` : 'status-unknown';

    row.innerHTML = `
      <td>${time}</td>
      <td>${patientName}</td>
      <td>${doctorName}</td>
      <td><span class="${statusClass}">${appt.status.toUpperCase()}</span></td>
      <td>${appt.notes || 'N/A'}</td>
      <td>
        <button class="btn btn-primary btn-sm view-details" data-appointment-id="${appt.id}">View</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  // Add click handlers for view buttons
  document.querySelectorAll('.view-details').forEach(button => {
    button.addEventListener('click', () => {
      const appointmentId = button.dataset.appointmentId;
      console.log(`🖱️ View details clicked for appointment ID ${appointmentId}`);
      showAppointmentDetails(appointmentId);
    });
  });

  console.log(`✅ Populated table with ${filteredAppointments.length} appointments for ${dateStrFormatted}, doctorId: ${doctorId}`);
}

function toggleView(view) {
  if (view === currentView) {
    console.log(`🔄 View unchanged: ${view}`);
    return;
  }
  console.log(`🔄 Switching to ${view} view`);

  const tableView = document.getElementById('appointmentsTableView');
  const calendarView = document.getElementById('appointmentsCalendarView');
  const tableBtn = document.getElementById('tableViewBtn');
  const calendarBtn = document.getElementById('calendarViewBtn');

  if (!tableView || !calendarView || !tableBtn || !calendarBtn) {
    console.error('❌ Missing DOM elements:', {
      tableView: !!tableView,
      calendarView: !!calendarView,
      tableBtn: !!tableBtn,
      calendarBtn: !!calendarBtn
    });
    return;
  }

  const doctorId = document.getElementById('doctorFilter')?.value || 'all';
  const selectedDate = $("#dateFilter").val() || formatDate(new Date());

  if (view === 'table') {
    tableView.classList.add('active');
    calendarView.classList.remove('active');
    tableBtn.classList.add('active');
    calendarBtn.classList.remove('active');
    fetchAppointmentsByDate(selectedDate, 'all', doctorId);
  } else {
    tableView.classList.remove('active');
    calendarView.classList.add('active');
    tableBtn.classList.remove('active');
    calendarBtn.classList.add('active');
    fetchAppointmentsByDate(selectedDate, 'all', doctorId);
  }

  // Log final state
  console.log(`🔄 Switched to ${view} view. Classes:`, {
    tableView: tableView.className,
    calendarView: calendarView.className,
    tableBtn: tableBtn.className,
    calendarBtn: calendarBtn.className
  });
}


// Helper function to exit edit mode for a single row
function exitEditMode($row) {
  $row.removeClass('editing');
  $row.find('.edit-controls').addClass('d-none');
  $row.find('.edit-input').addClass('d-none');
  $row.find('.display-value').removeClass('d-none');

  // Update display values to reflect current input values (in case of cancel)
  $row.find('.editable').each(function () {
    const $cell = $(this);
    const field = $cell.data('field');
    const $input = $cell.find('.edit-input');
    const $display = $cell.find('.display-value');

    if (field === 'price') {
      $display.text(`₹${parseFloat($input.val()).toFixed(2)}`);
    } else if (field === 'color_code') {
      $display.find('span').css('background-color', $input.val());
    } else if (field === 'doctors') {
      // Re-fetch doctor names if needed, or rely on server refresh
      // For simplicity, assume server refresh updates this
    } else {
      $display.text($input.val() || 'N/A');
    }
  });

  // Check if all rows are done editing to toggle global button
  if (!$("#servicesTableBody").find('.editing').length) {
    $('#editServicesBtn').text('Edit').removeClass('btn-warning').addClass('btn-primary').data('editing', false);
  }
}


// main.js
function populateAppointmentsCalendar(appointments, weekStartDateStr, doctorId = 'all') {
  const calendarBody = document.getElementById("calendarBody");
  const calendarHeader = document.querySelector(".calendar-header");
  calendarBody.innerHTML = "";
  calendarHeader.innerHTML = "<div>Time</div>";

  const weekStart = new Date(weekStartDateStr);
  if (isNaN(weekStart)) {
    console.error("Invalid weekStartDateStr:", weekStartDateStr);
    calendarBody.innerHTML = '<div class="text-center">Invalid date selected.</div>';
    return;
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return {
      dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      display: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]} ${date.getDate()}/${date.getMonth() + 1}`
    };
  });

  days.forEach(day => {
    const headerCell = document.createElement("div");
    headerCell.innerText = day.display;
    calendarHeader.appendChild(headerCell);
  });

  const loggedInDoctorId = sessionStorage.getItem("doctor_id");
  console.log(`🔍 Logged-in Doctor ID: ${loggedInDoctorId}, Requested Doctor ID: ${doctorId}`);

  let filteredAppointments = appointments;
  if (doctorId !== 'all') {
    filteredAppointments = appointments.filter(appt => appt.doctor && appt.doctor.id == doctorId);
  } else if (loggedInDoctorId && loggedInDoctorId !== 'null') {
    filteredAppointments = appointments.filter(appt => appt.doctor && appt.doctor.id == loggedInDoctorId);
    console.log(`🔍 Filtering for logged-in doctor's appointments (ID: ${loggedInDoctorId})`);
  }

  if (filteredAppointments.length === 0) {
    calendarBody.innerHTML = `<div class="text-center">No appointments found for ${doctorId === 'all' && loggedInDoctorId ? 'your schedule' : doctorId === 'all' ? 'the selected week' : 'this doctor'}.</div>`;
    console.log(`ℹ️ No appointments to display for week starting ${weekStartDateStr}, doctorId: ${doctorId}`);
    return;
  }

  // Log appointment details for debugging
  console.log(`📅 Filtered appointments (${filteredAppointments.length}):`, filteredAppointments.map(appt => ({
    id: appt.id,
    appointment_date: appt.appointment_date,
    status: appt.status
  })));

  // Get current IST time using system time for the time marker
  
  const now = new Date();

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  hours.forEach(hour => {
    const row = document.createElement("div");
    row.classList.add("calendar-row");
    row.dataset.hour = hour;

    // Grey out past days and past hours on the current day (based on system IST time)
    days.forEach(day => {
      const isPastDay = new Date(day.dateStr) < new Date(currentDateStr);
      const isCurrentDay = day.dateStr === currentDateStr;
      if (isPastDay || (isCurrentDay && hour < currentHour)) {
        row.classList.add("past");
      }
    });

    const hourLabel = document.createElement("div");
    hourLabel.innerText = `${String(hour).padStart(2, '0')}:00`;
    row.appendChild(hourLabel);

    days.forEach(day => {
      const slot = document.createElement("div");
      slot.classList.add("calendar-slot");
      slot.style.position = "relative";
      slot.style.overflowY = "auto";
      slot.style.maxHeight = "none";

      console.log(`🔄 Processing slot for day ${day.dateStr}, hour ${hour}:00`);

      // Add current time marker on current day and hour (based on system IST time)
      if (day.dateStr === currentDateStr && hour === currentHour) {
        const marker = document.createElement("div");
        marker.classList.add("current-time-marker");
        // Position marker based on minutes (assuming row height is 60px)
        const minuteOffset = (currentMinute / 60) * 60;
        marker.style.top = `${minuteOffset}px`;
        slot.appendChild(marker);
      }

      const slotAppointments = filteredAppointments.filter(appt => {
        if (!appt || !appt.appointment_date) {
          console.warn(`⚠️ Invalid appointment:`, appt);
          return false;
        }

        const apptDate = new Date(appt.appointment_date);
        if (isNaN(apptDate)) {
          console.warn(`⚠️ Invalid appointment_date for ID ${appt.id}:`, appt.appointment_date);
          return false;
        }

        // Use raw appointment_date (assumed UTC) without conversion
        const apptDateStr = appt.appointment_date.split('T')[0]; // e.g., "2025-05-05"
        const apptTime = appt.appointment_date.split('T')[1]; // e.g., "08:30:00Z"
        const apptHour = parseInt(apptTime.split(':')[0], 10);
        const apptMinute = parseInt(apptTime.split(':')[1], 10);

        if (apptDateStr !== day.dateStr) {
          console.log(`⚠️ Date mismatch for appointment ID ${appt.id}: apptDateStr=${apptDateStr}, day.dateStr=${day.dateStr}`);
          return false;
        }

        const isInHour = apptHour === hour;
        if (!isInHour) {
          console.log(`⚠️ Hour mismatch for appointment ID ${appt.id}: apptHour=${apptHour}, slotHour=${hour}`);
        }

        console.log(`🔍 Checking appointment ID ${appt.id}: Date=${apptDateStr}, Raw=${appt.appointment_date}, Hour=${apptHour}:${String(apptMinute).padStart(2, '0')}, Matches=${isInHour ? 'Yes' : 'No'}`);

        return isInHour;
      });

      slotAppointments.forEach((appt, index) => {
        const block = document.createElement("div");
        block.classList.add("appointment-block");
        block.dataset.appointmentId = appt.id;

        block.style.marginTop = `${index * 22}px`;
        block.style.zIndex = index + 1;

        const patientName = appt.patient && appt.patient.first_name
          ? `${appt.patient.first_name} ${appt.patient.last_name || ''}`
          : 'Unnamed';
        const statusClass = appt.status ? `status-${appt.status.toLowerCase().replace(' ', '-')}` : 'status-unknown';

        // Extract time from raw appointment_date (e.g., "08:30:00Z" -> "08:30")
        const apptTime = appt.appointment_date.split('T')[1].split(':').slice(0, 2).join(':'); // e.g., "08:30"

        block.innerHTML = `
          <strong>${patientName}</strong><br>
          <span class="${statusClass}">${appt.status.toUpperCase()}</span><br>
          <small>Time: ${apptTime}</small><br>
          ID: ${appt.id}
        `;
        block.title = `Doctor: ${appt.doctor ? `${appt.doctor.first_name} ${appt.doctor.last_name || ''}` : 'N/A'}\nNotes: ${appt.notes || 'N/A'}`;

        slot.appendChild(block);
      });

      row.appendChild(slot);
    });

    calendarBody.appendChild(row);
  });

  // Fallback rendering for unmatched appointments
  if (document.querySelectorAll(".appointment-block").length === 0) {
    calendarBody.innerHTML += `<div class="text-center text-warning">No appointments matched calendar slots. Displaying all:</div>`;
    filteredAppointments.forEach(appt => {
      const div = document.createElement("div");
      div.innerHTML = `ID: ${appt.id}, Date: ${appt.appointment_date}, Status: ${appt.status}`;
      calendarBody.appendChild(div);
    });
  }

  const unmatchedAppointments = filteredAppointments.filter(appt => {
    const apptDateStr = appt.appointment_date.split('T')[0];
    return !days.some(day => day.dateStr === apptDateStr);
  });
  if (unmatchedAppointments.length > 0) {
    calendarBody.innerHTML += `<div class="text-center text-warning">Warning: ${unmatchedAppointments.length} appointment(s) are outside the selected week.</div>`;
  }

  // Scroll to current time (based on system IST time)
  const currentHourRow = document.querySelector(`.calendar-row[data-hour="${currentHour}"]`);
  if (currentHourRow) {
    const calendarContainer = calendarBody.parentElement || calendarBody;
    const rowOffset = currentHourRow.offsetTop;
    const containerHeight = calendarContainer.clientHeight;
    const rowHeight = currentHourRow.clientHeight;
    calendarContainer.scrollTop = rowOffset - (containerHeight / 2) + (rowHeight / 2);
  }

  document.querySelectorAll(".appointment-block").forEach(block => {
    block.addEventListener("click", () => {
      const appointmentId = block.dataset.appointmentId;
      console.log(`🖱️ Appointment block clicked: ID ${appointmentId}`);
      showAppointmentDetails(appointmentId);
    });
  });

  console.log(`✅ Populated calendar with ${filteredAppointments.length} appointments for week starting ${weekStartDateStr}, doctorId: ${doctorId}`);
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

// Global variable to track the action that opened the modal
let currentModalAction = null;

// Function to adjust modal tabs based on action
function adjustModalTabs(action) {
  console.log(`🔍 Adjusting modal tabs for action: ${action}`);
  const modalTabs = $("#newActionTabs .nav-item");
  const tabContent = $("#newActionTabContent .tab-pane");

  // Reset tabs and content
  modalTabs.show();
  tabContent.removeClass("show active");

  // Apply role-based restrictions first
  const userType = sessionStorage.getItem("userType") || "unknown";
  const roleLevel = sessionStorage.getItem("roleLevel") || "unknown";
  const role = `${userType}-${roleLevel}`.toLowerCase();

  // Restrict tabs based on action
  switch (action) {
    case "add-services":
      modalTabs.hide();
      modalTabs.filter("#addServiceTab").show();
      $("#addService").addClass("show active");
      break;
    case "all-bills":
      modalTabs.hide();
      modalTabs.filter("#billsTab").show();
      $("#bills").addClass("show active");
      break;
    case "tele-consults":
    case "patient-search":
    case "new":
      modalTabs.show();
      modalTabs.filter("#addServiceTab, #billsTab").hide();
      $("#addPatient").addClass("show active"); // Default to Appt tab
      break;
    default:
      modalTabs.show();
      $("#addPatient").addClass("show active");
  }

  // Apply role-based restrictions (override action-based if needed)
  switch (role) {
    case "doctor-medium":
      modalTabs.filter(":contains('Add Service')").hide();
      break;
    case "doctor-basic":
      modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
      break;
    case "nurse-senior":
      modalTabs.filter(":contains('Add Service')").hide();
      break;
    case "nurse-medium":
    case "nurse-basic":
    case "receptionist-medium":
    case "receptionist-basic":
      modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
      break;
    case "receptionist-senior":
      modalTabs.filter(":contains('Add Service')").hide();
      break;
    case "doctor-senior":
      // Full access, no additional restrictions
      break;
    default:
      console.warn(`⚠️ Unknown role: ${role}, restricting all tabs`);
      modalTabs.hide();
      modalTabs.filter("#addPatientTab").show(); // Fallback to Appt tab
  }

  console.log("🔍 Final Modal Tabs Visibility:", modalTabs.filter(":visible").map((i, el) => $(el).text().trim()).get());
}

// Function to open modal with specific action
function openModalWithAction(action) {
  currentModalAction = action;
  console.log(`🖱️ Opening modal for action: ${action}`);

  // Ensure modal is reset
  $("#newActionModal").modal("show");
  adjustModalTabs(action);

  // If tele-consults, trigger patient search
  if (action === "tele-consults") {
    $(".patient-search").focus();
    // Optionally trigger search UI or autocomplete
    setupPatientSearch();
  }
}

// Bind navigation click events
function bindNavActions() {
  $(".navbar-top .nav-link").on("click", function (e) {
    e.preventDefault();
    const action = $(this).data("action");
    console.log(`🖱️ Nav item clicked: ${action}`);

    // Check if user has permission for this action
    const navItem = $(this).closest(".nav-item");
    if (navItem.is(":visible")) {
      openModalWithAction(action);
    } else {
      console.warn(`⚠️ User lacks permission for action: ${action}`);
      // alert("You do not have permission to perform this action.");
    }
  });

  // Handle "New" button
  $(".navbar-top .btn[data-action='new']").on("click", function (e) {
    e.preventDefault();
    openModalWithAction("new");
  });

  // Handle patient search
  $(".patient-search").on("search", function () {
    const query = $(this).val().trim();
    if (query) {
      console.log(`🔍 Patient search triggered: ${query}`);
      openModalWithAction("patient-search");
      // Assume search populates patient data in modal
      setupPatientSearch(query);
    }
  });
}

// Bind Modal Actions
function bindModalActions() {
  console.log("🔍 Found elements with data-action:", $("[data-action]").length, $("[data-action]").map((i, el) => $(el).data("action")).get());

  const actionToTabMap = {
    "new": "addPatientTab",
    "all-bills": "addBillsTab",
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
    const tabElement = $(`#${tabId}`);
    const navItem = $(this).closest(".nav-item");

    // Check if the clicked nav item is visible (indicates user has access)
    if (navItem.length && !navItem.is(":visible") && sessionStorage.getItem("user_type")?.toLowerCase() !== "doctor" && sessionStorage.getItem("role_level")?.toLowerCase() !== "senior") {
      console.error(`❌ Nav item for action ${action} is not visible. User lacks access.`);
      alert("You do not have permission to access this feature.");
      return;
    }

    // Show modal
    console.log("🔍 Modal Element:", modal.length ? "Found" : "Not Found");
    modal.modal('show');
    console.log("🔍 Modal Opened");

    // Determine role
    const role = `${sessionStorage.getItem("user_type")?.toLowerCase()}-${sessionStorage.getItem("role_level")?.toLowerCase()}`;

    // Handle tab visibility based on action
    if (role === "doctor-senior") {
      // Show all tabs by default for doctor-senior
      $("#newActionTabs .nav-item").show();
      $("#newActionTabContent .tab-pane").find("input, select, button, textarea").prop("disabled", false);

      if (action === "add-services") {
        // Hide all tabs except Add Service when "Add Services" is clicked
        $("#newActionTabs .nav-item").hide();
        $(`#addServiceTab`).closest(".nav-item").show();
        $("#newActionTabContent .tab-pane").removeClass("show active");
        $(`#addServiceTab`).tab('show');
        $(`#addService`).addClass("show active");
        console.log(`✅ Exclusively showing Add Service tab for doctor-senior: ${tabId}`);
      } else if (action === "new") {
        // Hide Add Service tab when "New" is clicked
        $("#newActionTabs .nav-item").show();
        $(`#addServiceTab`).closest(".nav-item").hide();
        $(`#${tabId}`).tab('show');
        console.log(`✅ Showing tab ${tabId} with Add Service hidden for doctor-senior`);
      } else {
        // Show requested tab with all permitted tabs visible (except Add Service if not explicitly allowed)
        $(`#${tabId}`).tab('show');
        console.log(`✅ Showing tab ${tabId} with all permitted tabs visible for doctor-senior`);
      }
    } else {
      // For other roles, show only permitted tabs
      const permittedTabs = $("#newActionTabs .nav-item:visible");
      permittedTabs.show();

      if (action === "add-services") {
        // Hide all tabs except Add Service when "Add Services" is clicked
        $("#newActionTabs .nav-item").hide();
        $(`#addServiceTab`).closest(".nav-item").show();
        $("#newActionTabContent .tab-pane").removeClass("show active");
        $(`#addServiceTab`).tab('show');
        $(`#addService`).addClass("show active");
        console.log(`✅ Exclusively showing Add Service tab: ${tabId}`);
      } else if (action === "new") {
        // Hide Add Service tab when "New" is clicked
        $("#newActionTabs .nav-item:visible").show();
        $(`#addServiceTab`).closest(".nav-item").hide();
        $(`#${tabId}`).tab('show');
        console.log(`✅ Showing tab ${tabId} with Add Service hidden`);
      } else {
        // Default behavior: Show permitted tabs, hide Add Service unless explicitly active
        permittedTabs.show();
        if (!$(`#addServiceTab`).closest(".nav-item").is(":visible")) {
          $(`#addServiceTab`).closest(".nav-item").hide();
        }
        if (tabElement.length) {
          console.log(`🔍 Tab Element: ${tabId} found, Visible: ${tabElement.is(":visible")}`);
          tabElement.closest(".nav-item").show();
          tabElement.tab('show');
          console.log(`✅ Successfully switched to tab: ${tabId}`);
        } else {
          console.error(`❌ Tab with ID ${tabId} not found! Falling back to Add Patient tab`);
          $("#addPatientTab").tab("show");
        }
      }
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

  const role = `${sessionStorage.getItem("user_type")?.toLowerCase()}-${sessionStorage.getItem("role_level")?.toLowerCase()}`;

  if (role === "doctor-senior") {
    // Show all tabs for doctor-senior
    $("#newActionTabs .nav-item").show();
    $("#newActionTabContent .tab-pane").find("input, select, button, textarea").prop("disabled", false);
    console.log("✅ Reset modal view with all tabs visible for doctor-senior");
  } else {
    // Show all permitted tabs based on role
    $("#newActionTabs .nav-item:visible").show();
    // Ensure Add Service tab is hidden unless explicitly allowed
    if (!$("#addServiceTab").closest(".nav-item").is(":visible")) {
      $("#addServiceTab").closest(".nav-item").hide();
    }
  }

  // Reset to default tab (e.g., Add Patient)
  $("#addPatientTab").tab("show");
}

// Setup Patient Search with Autocomplete
let selectedPatientId = null;

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
          $dropdown.hide(); // Hide dropdown if no patients found
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

  // Hide dropdown when clicking outside
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
      alert(`Failed to fetch appointments: ${xhr.responseJSON?.error || "Server Unavailable"}`);
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
                  <label for="editApptDate" class="form-label">Date</label>
                  <input type="text" class="form-control" id="editApptDate" value="${appt.appointment_date ? appt.appointment_date.split('T')[0] : ''}" placeholder="YYYY-MM-DD">
                  <div class="invalid-feedback">Please use format YYYY-MM-DD</div>
                </div>
                <div class="mb-3">
                  <label for="editApptTime" class="form-label">Time (HH:mm, 24hr)</label>
                  <input type="text" class="form-control" id="editApptTime" value="${appt.appointment_date ? appt.appointment_date.split('T')[1].split(':').slice(0, 2).join(':') : ''}" placeholder="HH:mm">
                  <div class="invalid-feedback">Please use format HH:mm (24hr)</div>
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

      // Validate date input (YYYY-MM-DD)
      $("#editApptDate").on("input", function () {
        const date = $(this).val();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          $(this).addClass("is-invalid");
        } else {
          $(this).removeClass("is-invalid");
        }
      });

      // Basic time input validation (HH:mm, 24hr format)
      $("#editApptTime").on("input", function () {
        const time = $(this).val();
        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
          $(this).addClass("is-invalid");
        } else {
          $(this).removeClass("is-invalid");
        }
      });

      // Populate doctor dropdown
      populateDoctorDropdown('editApptDoctor');
      $('#editApptDoctor').val(appt.doctor?.id || '');

      // Handle save
      modal.find('.save-appointment').on('click', function () {
        const date = $('#editApptDate').val();
        const time = $('#editApptTime').val();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
          alert("Please enter a valid date (YYYY-MM-DD) and time (HH:mm, 24hr format).");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            $('#editApptDate').addClass("is-invalid");
          }
          if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            $('#editApptTime').addClass("is-invalid");
          }
          return;
        }
        const updatedData = {
          appointment_date: `${date}T${time}:00Z`,
          doctor_id: $('#editApptDoctor').val(),
          status: $('#editApptStatus').val(),
          notes: $('#editApptNotes').val()
        };

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
            alert(`Failed to update appointment: ${xhr.responseJSON?.error || "Server Unavailable"}`);
          }
        });
      });

      modal.on('hidden.bs.modal', function () {
        modal.remove();
      });
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch appointment ${appointmentId}:`, xhr.responseJSON);
      alert(`Failed to fetch appointment details: ${xhr.responseJSON?.error || "Server Unavailable"}`);
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
            alert(`Failed to update address: ${xhr.responseJSON?.error || "Server Unavailable"}`);
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
function showCreatePatientPrompt(query) {
  // Check if modal already exists
  if ($('#noPatientFoundModal').length > 0) {
    console.log("ℹ️ No Patient Found modal already exists, skipping creation.");
    return; // Exit if modal is already present
  }

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
    initializePatientForm(); // Initialize form with default doctor
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
    { id: 'patientFirstName', name: 'First Name' },
    { id: 'patientLastName', name: 'Last Name' },
    { id: 'patientGender', name: 'Gender' },
    { id: 'patientDOB', name: 'Date of Birth' },
    { id: 'patientPhone', name: 'Phone Number' },
    { id: 'preferredLanguage', name: 'Preferred Language' },
    { id: 'maritalStatus', name: 'Marital Status' },
    { id: 'doctor', name: 'Referred By' }
  ];

  let errors = [];

  requiredFields.forEach(field => {
    let value;
    if (field.id === 'patientPhone') {
      value = itiPhone.getNumber();
    } else if (field.id === 'patientGender') {
      value = $('#patientGender').val();
    } else {
      value = $(`#${field.id}`).val();
    }
    if (!value || value.trim() === '') {
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

  const appointmentDate = $("#appointmentDate").val();
  if (appointmentDate && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(appointmentDate)) {
    errors.push("Appointment Date must be in format YYYY-MM-DD HH:mm.");
  }

  if ($('#addPatientForm').data('appointment-id') && !appointmentDate) {
    errors.push("Appointment Date is required for editing an appointment.");
  }

  const primaryDoctor = $("#doctor").val() || null; // Use selected value or null
  

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
    referred_by: $("#referredBy").val(), // Preserved as user-entered
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
    primary_doctor: $("#doctor").val() // Will use default if set
  };

  const appointmentData = appointmentDate
    ? {
        appointment_date: appointmentDate + ":00+05:30",
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
              alert(`Failed to update appointment: ${xhr.responseJSON?.error || "Server Unavailable"}`);
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
              alert(`Failed to create appointment: ${xhr.responseJSON?.error || "Server Unavailable"}`);
            }
          });
        } else {
          handlePostSubmission(updatedPatient, activeButton);
        }
      },
      error: function (xhr) {
        alert(`Failed to update patient: ${xhr.responseJSON?.error || "Server Unavailable"}`);
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
              alert(`Failed to create appointment: ${xhr.responseJSON?.error || "Server Unavailable"}`);
            }
          });
        } else {
          handlePostSubmission(newPatient, activeButton);
        }
      },
      error: function (xhr) {
        alert(`Failed to create patient: ${xhr.responseJSON?.error || "Server Unavailable"}`);
      }
    });
  }
});

function initializePatientForm() {
  console.log("🔄 Initializing patient form...");

  // Clear form fields (if not in edit mode)
  if (!$('#addPatientForm').data('edit-mode')) {
    $('#addPatientForm')[0].reset();
    $('#patientPhone').val(''); // Reset phone input (handled by intl-tel-input)
    $('#mobile2').val(''); // Reset alternate mobile
    if (itiPhone) itiPhone.setNumber(''); // Reset intl-tel-input for phone
    if (itiMobile2) itiMobile2.setNumber(''); // Reset intl-tel-input for mobile2
  }

  // Set default primary doctor based on logged-in doctor
  const loggedInDoctorId = sessionStorage.getItem("doctor_id");
  console.log(`🔍 Logged-in Doctor ID for default: ${loggedInDoctorId || 'None'}`);

  if (loggedInDoctorId && loggedInDoctorId !== 'null') {
    // Check if #doctor select has an option matching loggedInDoctorId
    const $doctorSelect = $("#doctor");
    if ($doctorSelect.find(`option[value="${loggedInDoctorId}"]`).length > 0) {
      $doctorSelect.val(loggedInDoctorId);
      console.log(`👨‍⚕️ Set default Primary Doctor to ID: ${loggedInDoctorId}`);
    } else {
      console.warn(`⚠️ Doctor ID ${loggedInDoctorId} not found in #doctor options`);
      $doctorSelect.val(''); // Fallback to empty
    }
  } else {
    // Non-doctor user or no doctor_id, set to empty or placeholder
    $("#doctor").val('');
    console.log("ℹ️ No logged-in doctor, Primary Doctor set to empty");
  }
}

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
    $('#patientDOB').val('');
    $('#maritalSince').val('');
    $('#appointmentDate').val('');
    $('#addPatientForm').data('patient-id', data.patient_id);
  }

  alert(`Patient ${$('#addPatientForm').data('edit-mode') ? 'updated' : 'created'} successfully!`);
  if (activeButton !== 'addAndCreateAppointment') {
    $("#addPatientForm")[0].reset();
    $('#patientDOB').val('');
    $('#maritalSince').val('');
    $('#appointmentDate').val('');
  }
  $('#addPatientForm').removeData('edit-mode').removeData('appointment-id');
}

// Add Service Form Submission
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
      const errorMsg = xhr.responseJSON?.error || xhr.responseJSON?.detail || "Server Unavailable";
      alert(`Failed to add service: ${errorMsg}`);
    }
  });
});

// Add Bills Form Handling
$("#todayBillBtn").on("click", function () {
  $("#billDate").val(new Date().toISOString().split("T")[0]);
  console.log("Bill date set to today");
});

// Service Search and Dropdown
let services = [];
let isFetchingServices = false;
function fetchServices() {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: `${API_BASE_URL}/service/list/`,
      type: 'GET',
      headers: getAuthHeaders(),
      success: function (data) {
        services = data.services || [];
        allServices = services.map(service => ({
          id: service.id,
          service_id: service.service_id || service.code || service.id,
          name: service.service_name || service.name || 'Unknown Service',
          code: service.code || service.service_id || '',
          price: parseFloat(service.service_price || service.price || 0),
          gst: parseFloat(service.gst || 0), // Add GST if available
          doctors: service.doctor_details || []
        }));
        serviceMap = {};
        allServices.forEach(service => {
          serviceMap[service.id] = service;
        });
        console.log(`✅ Fetched ${allServices.length} services`);
        resolve(allServices);
      },
      error: function (xhr) {
        console.error('❌ Failed to fetch services:', xhr.responseJSON || xhr.statusText);
        reject(new Error(`Failed to fetch services: ${xhr.responseJSON?.error || xhr.statusText}`));
      }
    });
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
      alert(`Failed to update service: ${xhr.responseJSON?.error || "Server Unavailable"}`);
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
  fetchServices()
    .then(services => {
      const $tbody = $("#servicesTableBody");
      $tbody.empty();

      if (!services.length) {
        $tbody.append('<tr><td colspan="6" class="text-center">No services found.</td></tr>');
        console.log("No services to display in table");
        return;
      }

      services.forEach((service, index) => {
        const doctorNames = service.doctors && service.doctors.length
          ? service.doctors.map(d => `${d.first_name} ${d.last_name || ''}`.trim()).join(', ') || 'All Doctors'
          : 'N/A';
        const serviceId = service.id;
        const $row = $(`
          <tr data-service-id="${serviceId}">
            <td>${index + 1}</td>
            <td class="editable" data-field="name">
              <span class="display-value">${service.name || 'Unknown Service'}</span>
              <input type="text" class="edit-input form-control form-control-sm d-none" value="${service.name || ''}">
            </td>
            <td class="editable" data-field="code">
              <span class="display-value">${service.code || 'N/A'}</span>
              <input type="text" class="edit-input form-control form-control-sm d-none" value="${service.code || ''}">
            </td>
            <td class="editable" data-field="price">
              <span class="display-value">₹${parseFloat(service.price || 0).toFixed(2)}</span>
              <input type="number" step="0.01" min="0" class="edit-input form-control form-control-sm d-none" value="${parseFloat(service.price || 0).toFixed(2)}">
            </td>
            <td class="editable" data-field="color_code">
              <span class="display-value">
                <span style="display: inline-block; width: 20px; height: 20px; background-color: ${service.color_code || '#000000'}; border: 1px solid #ccc;"></span>
              </span>
              <input type="color" class="edit-input form-control form-control-sm d-none" value="${service.color_code || '#000000'}">
            </td>
            <td class="editable" data-field="doctors">
              <span class="display-value">${doctorNames}</span>
              <select multiple class="edit-input form-select form-select-sm d-none" data-original-value="${service.all_doctors ? 'all' : service.doctors.map(d => d.id).join(',')}">
                <!-- Options populated dynamically -->
              </select>
            </td>
            <td class="edit-controls d-none">
              <button class="btn btn-success btn-sm save-edit me-1"><i class="fas fa-check"></i></button>
              <button class="btn btn-secondary btn-sm cancel-edit"><i class="fas fa-times"></i></button>
            </td>
          </tr>
        `);
        $tbody.append($row);

        // Store original values for cancel functionality
        $row.find('.edit-input').each(function () {
          const $input = $(this);
          $input.data('original-value', $input.val());
        });

        // Populate doctor dropdown for editing
        populateDoctorOptions($row.find('select.edit-input'), service.all_doctors, service.doctors.map(d => d.id));
      });

      console.log(`Populated services table with ${services.length} entries`);

      // Bind global edit button click event
      $('#editServicesBtn').off('click').on('click', function () {
        const $button = $(this);
        const isEditing = $button.data('editing') || false;

        if (isEditing) {
          if ($tbody.find('.editing').length) {
            alert('Please save or cancel all edits before exiting edit mode.');
            return;
          }
          $button.text('Edit').removeClass('btn-warning').addClass('btn-primary').data('editing', false);
          $tbody.find('tr').removeClass('editing');
          $tbody.find('.edit-controls').addClass('d-none');
          $tbody.find('.edit-input').addClass('d-none');
          $tbody.find('.display-value').removeClass('d-none');
        } else {
          $button.text('Done').removeClass('btn-primary').addClass('btn-warning').data('editing', true);
          $tbody.find('tr').addClass('editing');
          $tbody.find('.edit-controls').removeClass('d-none');
          $tbody.find('.edit-input').removeClass('d-none');
          $tbody.find('.display-value').addClass('d-none');
        }
      });

      // Bind save button click event (per row)
      $tbody.on('click', '.save-edit', function () {
        const $row = $(this).closest('tr');
        const serviceId = $row.data('service-id');
        const updateData = {};

        $row.find('.editable').each(function () {
          const $cell = $(this);
          const field = $cell.data('field');
          const $input = $cell.find('.edit-input');
          let newValue = $input.val();

          if (!validateServiceField(field, newValue)) {
            alert(`Invalid value for ${field} in row.`);
            return false;
          }

          if (field === 'doctors') {
            newValue = $input.val().includes('all') ? { all_doctors: true, doctors: [] } : { all_doctors: false, doctors: $input.val().map(id => parseInt(id)) };
            updateData.all_doctors = newValue.all_doctors;
            updateData.doctors = newValue.doctors;
          } else if (field === 'price') {
            newValue = parseFloat(newValue);
            updateData[field] = newValue;
          } else {
            updateData[field] = newValue;
          }
        });

        if (Object.keys(updateData).length === 0) {
          return;
        }

        updateService(serviceId, updateData, $row);
      });

      // Bind cancel button click event (per row)
      $tbody.on('click', '.cancel-edit', function () {
        const $row = $(this).closest('tr');
        $row.find('.edit-input').each(function () {
          const $input = $(this);
          $input.val($input.data('original-value'));
        });
        exitEditMode($row);
      });
    })
    .catch(error => {
      console.error(`Failed to fetch services for table: ${error.message}`);
      $("#servicesTableBody").empty().append('<tr><td colspan="6" class="text-center">Failed to load services.</td></tr>');
    });
}

function populateServiceDropdown($dropdown, servicesToShow) {
  $dropdown.empty();

  if (isFetchingServices) {
    if ($dropdown.is('select')) {
      $dropdown.append('<option value="">Loading services...</option>');
    } else {
      $dropdown.append('<li><a class="dropdown-item disabled">Loading services...</a></li>');
    }
    return;
  }

  if (!Array.isArray(servicesToShow)) {
    console.warn('⚠️ servicesToShow is not an array or is undefined:', servicesToShow);
    if ($dropdown.is('select')) {
      $dropdown.append('<option value="">No services available</option>');
    } else {
      $dropdown.append(
        '<li><a class="dropdown-item disabled">No services available. <a href="#" class="add-service-link">Add a service</a>.</a></li>'
      );
      $dropdown.on('click', '.add-service-link', function (e) {
        e.preventDefault();
        $('#addServiceTab').tab('show');
        $dropdown.removeClass('show');
      });
    }
    return;
  }

  const validServices = servicesToShow.filter(
    s => s && s.id && s.name && typeof s.price !== 'undefined'
  );

  if (!validServices.length) {
    if ($dropdown.is('select')) {
      $dropdown.append('<option value="">No services available</option>');
    } else {
      $dropdown.append(
        '<li><a class="dropdown-item disabled">No services available. <a href="#" class="add-service-link">Add a service</a>.</a></li>'
      );
      $dropdown.on('click', '.add-service-link', function (e) {
        e.preventDefault();
        $('#addServiceTab').tab('show');
        $dropdown.removeClass('show');
      });
    }
    return;
  }

  if ($dropdown.is('select')) {
    $dropdown.append('<option value="">Select a service</option>');
    validServices.forEach(service => {
      $dropdown.append(
        `<option value="${service.id}" data-code="${service.code}" data-price="${service.price}" data-gst="${service.gst}">${service.name} (${service.code})</option>`
      );
    });
  } else {
    validServices.forEach(service => {
      $dropdown.append(
        `<li><a class="dropdown-item" href="#" data-service-id="${service.id}" data-price="${service.price}">${service.name}</a></li>`
      );
    });
  }
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
  $row.find(".service-code").val(service ? service.code : "");
  updateTotalPrice($row);
  $li.closest(".autocomplete-dropdown").removeClass("show");
});

$(document).on("click", function (e) {
  if (!$(e.target).closest(".input-group, .autocomplete-dropdown").length) {
    $(".autocomplete-dropdown").removeClass("show");
  }
});

// Populate Doctor Dropdown for Bill
function populateDoctorDropdownForBill() {
  const $doctorSelect = $("#billDoctor");
  $doctorSelect.empty().append('<option value="" selected>Select Doctor</option>');
  populateDoctorOptions($doctorSelect, false, []);
}

function addBillItem() {
  const itemCount = $('#billItemsTableBody tr').length + 1;
  const newItem = `
    <tr>
      <td>${itemCount}</td>
      <td>
        <div class="input-group input-group-sm">
          <input type="hidden" class="service-id" name="item_service_id[]">
          <input type="text" class="form-control form-control-sm service-search" name="item_service_name[]" placeholder="Search or select service" style="width: 100%;">
        </div>
        <small class="form-text text-muted doctor-info">Doctors: No doctors assigned</small>
      </td>
      <td><input type="text" class="form-control form-control-sm service-code" name="item_service_code[]" placeholder="Enter Code"></td>
      <td><input type="number" class="form-control form-control-sm item-quantity" name="quantity[]" value="1" min="1" required></td>
      <td><input type="number" class="form-control form-control-sm item-unit-price unit-price" name="unit_price[]" step="0.01" min="0" required></td>
      <td><input type="number" class="form-control form-control-sm item-gst gst" name="gst[]" step="0.01" min="0" value="0"></td>
      <td><input type="number" class="form-control form-control-sm item-discount discount" name="discount[]" step="0.01" min="0" value="0"></td>
      <td><input type="number" class="form-control form-control-sm item-total-price total-price" name="total_price[]" step="0.01" readonly></td>
      <td><button type="button" class="btn btn-danger btn-sm remove-item"><i class="fas fa-trash"></i></button></td>
    </tr>
  `;
  $('#billItemsTableBody').append(newItem);
  const $newRow = $('#billItemsTableBody tr').last();

  // Initialize autocomplete with dropdown for service name
  const $serviceSearch = $newRow.find('.service-search');
  if ($.fn.autocomplete) {
    $serviceSearch.autocomplete({
      source: function (request, response) {
        const term = request.term.toLowerCase();
        const filteredServices = allServices.filter(service =>
          service.name.toLowerCase().includes(term) ||
          (service.code && service.code.toLowerCase().includes(term)) ||
          (service.service_id && service.service_id.toLowerCase().includes(term))
        );
        response(filteredServices.map(service => ({
          label: `${service.name} (${service.service_id || service.code || service.id})`,
          value: `${service.name} (${service.service_id || service.code || service.id})`,
          id: service.id,
          code: service.service_id || service.code || service.id,
          price: service.price || 0,
          gst: service.gst || 0,
          doctors: service.doctors || []
        })));
      },
      minLength: 0, // Show all services when clicking the input
      open: function () {
        $(this).autocomplete('widget').css('z-index', 1051); // Ensure dropdown appears above modals
      },
      focus: function (event, ui) {
        return false; // Prevent value from updating on focus
      },
      select: function (event, ui) {
        const $row = $(this).closest('tr');
        $row.find('.service-id').val(ui.item.id);
        $row.find('.service-code').val(ui.item.code);
        $row.find('.item-unit-price').val(ui.item.price.toFixed(2));
        $row.find('.item-gst').val(ui.item.gst.toFixed(2));
        const doctorNames = ui.item.doctors.length > 0
          ? ui.item.doctors.map(d => `${d.first_name} ${d.last_name}`).join(', ')
          : 'No doctors assigned';
        $row.find('.doctor-info').text(`Doctors: ${doctorNames}`);
        $(this).val(ui.item.value);
        calculateBillTotal();
        return false;
      },
      change: function (event, ui) {
        // Only clear fields if no valid selection and no valid code-based update
        const $row = $(this).closest('tr');
        const currentCode = $row.find('.service-code').val().trim().toLowerCase();
        const codeService = currentCode
          ? allServices.find(service =>
              (service.code && service.code.toLowerCase() === currentCode) ||
              (service.service_id && service.service_id.toLowerCase() === currentCode)
            )
          : null;

        if (!ui.item && !codeService) {
          $row.find('.service-id').val('');
          $row.find('.service-code').val('');
          $row.find('.item-unit-price').val('');
          $row.find('.item-gst').val('0');
          $row.find('.doctor-info').text('Doctors: No doctors assigned');
          $(this).val('');
          calculateBillTotal();
        }
      }
    })
    .on('focus', function () {
      $(this).autocomplete('search', ''); // Show all services on focus
    });
  } else {
    console.warn('⚠️ jQuery UI Autocomplete not available. Falling back to select.');
    const $select = $(`
      <select class="form-control form-control-sm service-select" name="item_service_name[]">
        <option value="">Select Service</option>
        ${allServices.map(service => `
          <option value="${service.id}" data-code="${service.code}" data-price="${service.price}" data-gst="${service.gst}">
            ${service.name} (${service.service_id || service.code || service.id})
          </option>
        `).join('')}
      </select>
    `);
    $serviceSearch.replaceWith($select);
    $select.on('change', function () {
      const $row = $(this).closest('tr');
      const serviceId = $(this).val();
      const service = allServices.find(s => s.id === Number(serviceId));
      if (service) {
        $row.find('.service-id').val(service.id);
        $row.find('.service-code').val(service.service_id || service.code || service.id);
        $row.find('.item-unit-price').val(service.price.toFixed(2));
        $row.find('.item-gst').val(service.gst.toFixed(2));
        const doctorNames = service.doctors && service.doctors.length > 0
          ? service.doctors.map(d => `${d.first_name} ${d.last_name}`).join(', ')
          : 'No doctors assigned';
        $row.find('.doctor-info').text(`Doctors: ${doctorNames}`);
      } else {
        $row.find('.service-id').val('');
        $row.find('.service-code').val('');
        $row.find('.item-unit-price').val('');
        $row.find('.item-gst').val('0');
        $row.find('.doctor-info').text('Doctors: No doctors assigned');
      }
      calculateBillTotal();
    });
  }

  // Handle service code input
  const $serviceCode = $newRow.find('.service-code');
  $serviceCode.on('input blur', function () {
    const code = $(this).val().trim().toLowerCase();
    const $row = $(this).closest('tr');
    const service = allServices.find(service =>
      (service.code && service.code.toLowerCase() === code) ||
      (service.service_id && service.service_id.toLowerCase() === code)
    );

    if (service) {
      console.log('✅ Found service for code:', { code, service });
      $row.find('.service-id').val(service.id);
      const serviceDisplay = `${service.name} (${service.service_id || service.code || service.id})`;
      $row.find('.service-search').val(serviceDisplay).trigger('change'); // Trigger change to sync autocomplete
      $row.find('.item-unit-price').val(service.price.toFixed(2));
      $row.find('.item-gst').val(service.gst.toFixed(2));
      const doctorNames = service.doctors && service.doctors.length > 0
        ? service.doctors.map(d => `${d.first_name} ${d.last_name}`).join(', ')
        : 'No doctors assigned';
      $row.find('.doctor-info').text(`Doctors: ${doctorNames}`);
    } else {
      console.log('⚠️ No service found for code:', code);
      if (code) {
        $row.find('.service-id').val('');
        $row.find('.service-search').val('').trigger('change'); // Clear and sync autocomplete
        $row.find('.item-unit-price').val('');
        $row.find('.item-gst').val('0');
        $row.find('.doctor-info').text('Doctors: No doctors assigned');
      }
    }
    calculateBillTotal();
  });

  // Handle input changes for quantity, unit price, GST, and discount
  $newRow.find('.item-quantity, .item-unit-price, .item-gst, .item-discount').on('input', calculateBillTotal);
}


function calculateBillTotal() {
  let total = 0;
  $('#billItemsTableBody tr').each(function() {
    const $row = $(this);
    const quantity = parseInt($row.find('.item-quantity').val()) || 0;
    const unitPrice = parseFloat($row.find('.item-unit-price').val()) || 0;
    const gst = parseFloat($row.find('.item-gst').val()) || 0;
    const discount = parseFloat($row.find('.item-discount').val()) || 0;
    const itemTotal = (quantity * unitPrice * (1 + gst / 100)) - discount;
    $row.find('.item-total-price').val(itemTotal.toFixed(2));
    total += itemTotal;
  });
  $('#totalAmount').val(total.toFixed(2));
}

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
  const qty = parseFloat($row.find(".item-quantity").val()) || 0;
  const unitPrice = parseFloat($row.find(".item-unit-price").val()) || 0;
  const gst = parseFloat($row.find(".item-gst").val()) || 0;
  const discount = parseFloat($row.find(".item-discount").val()) || 0;
  const total = (qty * unitPrice * (1 + gst / 100)) - discount;
  $row.find(".item-total-price").val(total.toFixed(2));
  updateTotalBillAmount();
  updateDepositColor();
}

function updateTotalBillAmount() {
  const total = Array.from($(".item-total-price")).reduce((sum, el) => sum + (parseFloat($(el).val()) || 0), 0);
  $("#totalAmount").val(total.toFixed(2));
}

function updateDepositColor() {
  const total = parseFloat($("#totalAmount").val()) || 0;
  const deposit = parseFloat($("#depositAmount").val()) || 0;
  $("#depositAmount").css("color", deposit >= total ? "green" : "red");
}

$(document).on("input", "[name='quantity[]'], .item-gst, .item-discount, #depositAmount", function () {
  updateTotalPrice($(this).closest("tr"));
  updateDepositColor();
});

// main.js (partial, focusing on showAppointmentDatePopup)

// Assumes jQuery and Bootstrap are loaded
function showAppointmentDatePopup(callback) {
  // Create modal HTML with two input fields for date and time
  const modal = $(`
    <div class="modal fade" id="appointmentDateModal" tabindex="-1" aria-labelledby="appointmentDateModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="appointmentDateModalLabel">Select Appointment Date and Time</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="appointmentDateInput" class="form-label">Date (YYYY-MM-DD)</label>
              <input type="text" class="form-control" id="appointmentDateInput" placeholder="e.g., 2025-01-01">
            </div>
            <div class="mb-3">
              <label for="appointmentTimeInput" class="form-label">Time (HH:MM)</label>
              <input type="text" class="form-control" id="appointmentTimeInput" placeholder="e.g., 10:10">
            </div>
            <div class="mb-3">
              <label for="billDoctor" class="form-label">Doctor</label>
              <select class="form-select" id="billDoctor" name="doctor_id">
                <option value="" selected disabled>Select a doctor</option>
              </select>
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

  // Append modal to body and show it
  $('body').append(modal);
  const bsModal = new bootstrap.Modal(modal[0], {
    backdrop: 'static', // Prevent closing on backdrop click
    keyboard: true,     // Allow closing with ESC key
  });
  bsModal.show();

  // Populate doctor dropdown (assumed to be defined elsewhere)
  populateDoctorDropdownForBill();

  // Validation functions
  function validateDate(dateStr) {
    const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (!regex.test(dateStr)) {
      return { valid: false, message: 'Date must be in YYYY-MM-DD format (e.g., 2025-01-01).' };
    }

    const [, year, month, day] = dateStr.match(regex);
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    // Validate year
    const currentYear = new Date().getFullYear();
    if (yearNum < currentYear) {
      return { valid: false, message: `Year must be ${currentYear} or later.` };
    }

    // Validate month
    if (monthNum < 1 || monthNum > 12) {
      return { valid: false, message: 'Month must be between 01 and 12.' };
    }

    // Validate day
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    if (dayNum < 1 || dayNum > daysInMonth) {
      return { valid: false, message: `Day must be between 01 and ${daysInMonth}.` };
    }

    return { valid: true };
  }

  function validateTime(timeStr) {
    const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!regex.test(timeStr)) {
      return { valid: false, message: 'Time must be in HH:MM format (e.g., 10:10).' };
    }
    return { valid: true };
  }

  // Handle Confirm button click
  $('#confirmAppointmentDate').on('click', function () {
    const dateStr = $('#appointmentDateInput').val().trim(); // YYYY-MM-DD
    const timeStr = $('#appointmentTimeInput').val().trim(); // HH:MM
    const doctorId = $('#billDoctor').val();

    // Validate inputs
    if (!dateStr) {
      alert('Please enter a date.');
      return;
    }
    if (!timeStr) {
      alert('Please enter a time.');
      return;
    }
    if (!doctorId) {
      alert('Please select a doctor.');
      return;
    }

    // Validate date
    const dateValidation = validateDate(dateStr);
    if (!dateValidation.valid) {
      alert(dateValidation.message);
      return;
    }

    // Validate time
    const timeValidation = validateTime(timeStr);
    if (!timeValidation.valid) {
      alert(timeValidation.message);
      return;
    }

    // Combine date and time
    const dateTimeStr = `${dateStr}T${timeStr}`;
    const selectedDate = new Date(dateTimeStr);

    // Check if date is valid
    if (isNaN(selectedDate.getTime())) {
      alert('Invalid date or time. Please check your input.');
      return;
    }

    // Check if date is in the future
    const now = new Date();
    if (selectedDate <= now) {
      alert('Selected date/time is in the past or current time. Please choose a future date.');
      return;
    }

    // Format output as YYYY-MM-DD HH:mm
    const formattedDate = `${dateStr} ${timeStr}`;
    console.log(`Confirmed appointment date: ${formattedDate}, doctorId: ${doctorId}`);

    // Update hidden input (if used elsewhere)
    $('#billAppointmentDate').val(formattedDate);

    // Call callback with formatted date and doctorId
    callback(formattedDate, doctorId);

    // Hide and remove modal
    bsModal.hide();
  });

  // Clean up modal on close
  modal.on('hidden.bs.modal', function () {
    bsModal.dispose();
    modal.remove();
  });
}

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
      alert(`Failed to fetch bill details: ${xhr.responseJSON?.error || "Server Unavailable"}`);
    }
  });
}

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
    console.log(`📄 Rendering bill with ID: ${bill.bill_id}`);
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
  const totalEntries = bills.length;
  const showingStart = startIndex + 1;
  const showingEnd = Math.min(startIndex + paginatedBills.length, totalEntries);
  $('#billsTableInfo').text(`Showing ${showingStart} to ${showingEnd} of ${totalEntries} entries`);
  $tbody.find('.view-bill').on('click', function () {
    const billId = $(this).data('bill-id');
    console.log(`🖱️ View bill clicked for ID: ${billId}`);
    showBillDetails(billId);
  });
  $tbody.find('.edit-bill').on('click', function () {
    const billId = $(this).data('bill-id');
    console.log(`🖱️ Edit bill clicked for ID: ${billId}`);
    editBill(billId);
  });
  console.log(`✅ Populated bills table with ${paginatedBills.length} bills (page ${page})`);
}

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

      console.log(`📋 Bill ${billId} items:`, bill.items);

      const serviceIds = bill.items
        .map(item => Number(item.service_id_read))
        .filter(id => id && Number.isInteger(id));
      console.log(`📋 Service IDs for bill ${billId}:`, serviceIds);

      const invalidItems = bill.items.filter(item => !item.service_id_read || !Number.isInteger(Number(item.service_id_read)));
      if (invalidItems.length > 0) {
        console.warn(`⚠️ Invalid or missing service IDs in bill ${billId} items:`, invalidItems);
        alert(`Warning: Some bill items have invalid or missing service IDs. You can still edit the bill, but these items may need correction.`);
      }

      let servicePromise = $.ajax({
        url: serviceIds.length > 0
          ? `${API_BASE_URL}/service/list/?service_ids=${serviceIds.join(',')}`
          : `${API_BASE_URL}/service/list/`,
        type: "GET",
        headers: getAuthHeaders(),
        success: function (data) {
          console.log(`✅ Service list response:`, data);
          if (!data.services || data.services.length === 0) {
            console.warn(`⚠️ No services returned`);
          }
        },
        error: function (xhr) {
          console.error(`❌ Service list fetch failed:`, xhr.responseJSON || xhr.statusText);
          throw new Error(`Service list fetch failed: ${xhr.responseJSON?.error || xhr.statusText}`);
        }
      });

      let allServicesPromise = new Promise((resolve, reject) => {
        if (services.length > 0) {
          console.log(`✅ Using cached services: ${services.length} entries`);
          resolve({ services });
        } else {
          console.log("🟡 Fetching services as cache is empty");
          fetchServices()
            .then(() => {
              console.log(`✅ Services fetched: ${services.length} entries`);
              resolve({ services });
            })
            .catch(error => {
              console.error("❌ Failed to fetch services:", error);
              reject(error);
            });
        }
      });

      let appointmentPromise = bill.appointment_id
        ? $.ajax({
            url: `${API_BASE_URL}/appointments/list/?appointment_id=${encodeURIComponent(bill.appointment_id)}`,
            type: "GET",
            headers: getAuthHeaders(),
            success: function (data) {
              console.log(`✅ Appointment fetch response for ID ${bill.appointment_id}:`, data);
            },
            error: function (xhr) {
              console.error(`❌ Appointment fetch failed for ID ${bill.appointment_id}:`, xhr.responseJSON || xhr.statusText);
              throw new Error(`Appointment fetch failed: ${xhr.responseJSON?.error || xhr.statusText}`);
            }
          })
        : Promise.resolve({ appointments: [] });

      Promise.all([servicePromise, allServicesPromise, appointmentPromise])
        .then(([serviceData, allServicesData, appointmentData]) => {
          const services = (serviceData.services || []).filter(service => serviceIds.includes(service.id));
          const allServices = allServicesData.services || [];
          let appointment = appointmentData.appointments && appointmentData.appointments.length > 0
            ? appointmentData.appointments[0]
            : null;

          const missingServices = bill.items.filter(
            item => item.service_id_read && Number.isInteger(Number(item.service_id_read)) && !services.find(s => s.id === Number(item.service_id_read))
          );
          if (missingServices.length > 0) {
            console.error(`❌ Missing services for bill items:`, missingServices);
            alert(`Cannot edit bill: Some services are missing or invalid (Service IDs: ${missingServices.map(item => item.service_id_read).join(', ')}).`);
            return;
          }

          if (appointment && appointment.appointment_date) {
            const apptDate = new Date(appointment.appointment_date);
            appointment.date = apptDate.toISOString().split('T')[0];
            appointment.time = apptDate.toTimeString().slice(0, 5);
            appointment.appointment_id = appointment.id;
          }

          const serviceMap = {};
          services.forEach(service => {
            serviceMap[service.id] = {
              id: service.id,
              service_id: service.service_id || service.code || service.id,
              name: service.name || 'Unknown Service',
              price: service.price || 0,
              doctors: service.doctor_details || []
            };
          });

          const patientId = bill.patient_id_read || (appointment && appointment.patient ? appointment.patient.patient_id : '');

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
                        <input type="text" class="form-control" id="editBillPatientId" value="${patientId}" required>
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
                          <h6>Associated Appointment</h6>
                          <div class="mb-3">
                            <label for="editAppointmentId" class="form-label">Appointment ID</label>
                            <input type="text" class="form-control" id="editAppointmentId" value="${appointment.appointment_id || ''}" readonly>
                          </div>
                          <div class="mb-3">
                            <label for="editAppointmentDate" class="form-label">Appointment Date</label>
                            <input type="text" class="form-control" id="editAppointmentDate" value="${appointment.date || ''}" placeholder="YYYY-MM-DD">
                          </div>
                          <div class="mb-3">
                            <label for="editAppointmentTime" class="form-label">Appointment Time</label>
                            <input type="text" class="form-control" id="editAppointmentTime" value="${appointment.time || ''}" placeholder="HH:mm">
                          </div>
                          <div class="mb-3">
                            <label for="editAppointmentStatus" class="form-label">Appointment Status</label>
                            <select class="form-control" id="editAppointmentStatus">
                              <option value="booked" ${appointment.status === 'booked' ? 'selected' : ''}>Scheduled</option>
                              <option value="reviewed" ${appointment.status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                              <option value="on-going" ${appointment.status === 'on-going' ? 'selected' : ''}>On-Going</option>
                              <option value="arrived" ${appointment.status === 'arrived' ? 'selected' : ''}>Arrived</option>
                            </select>
                          </div>
                          `
                          : ''
                      }
                      <h6>Bill Items</h6>
                      <div id="editBillItems">
                        ${bill.items.map((item, index) => {
                          const service = serviceMap[item.service_id_read];
                          const doctorNames = service && service.doctors && service.doctors.length > 0
                            ? service.doctors.map(d => `${d.first_name} ${d.last_name}`).join(', ')
                            : 'No doctors assigned';
                          return `
                            <div class="row mb-2 bill-item-row">
                              <div class="col-md-3">
                                <input type="hidden" class="service-id" name="item_service_id_${index}" value="${item.service_id_read || ''}">
                                <input type="text" class="form-control service-search" name="item_service_name_${index}" value="${service ? `${service.name} (${service.service_id})` : (item.service_id_read ? `Service ID ${item.service_id_read} (Invalid)` : 'Select Service')}" placeholder="Search Service" required>
                                <small class="form-text text-muted">Doctors: ${doctorNames}</small>
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

          modal.find('.service-search').each(function () {
            const $input = $(this);
            const $row = $input.closest('.bill-item-row');
            if (typeof $.fn.autocomplete === 'function') {
              $input.autocomplete({
                source: function (request, response) {
                  const term = request.term.toLowerCase();
                  const filteredServices = allServices.filter(service =>
                    service.name.toLowerCase().includes(term) ||
                    (service.code && service.code.toLowerCase().includes(term)) ||
                    (service.service_id && service.service_id.toLowerCase().includes(term))
                  );
                  response(filteredServices.map(service => ({
                    label: `${service.name} (${service.service_id || service.code || service.id})`,
                    value: service.name,
                    id: service.id,
                    code: service.service_id || service.code || service.id
                  })));
                },
                minLength: 2,
                select: function (event, ui) {
                  $row.find('.service-id').val(ui.item.id);
                  $row.find('.item-unit-price').val(ui.item.id in serviceMap ? serviceMap[ui.item.id].price : 0);
                  $input.val(`${ui.item.value} (${ui.item.code})`);
                  calculateTotalAmount();
                  return false;
                },
                change: function (event, ui) {
                  if (!ui.item) {
                    $row.find('.service-id').val('');
                    $input.val('');
                  }
                }
              });
            } else {
              console.warn('⚠️ jQuery UI Autocomplete not available. Falling back to select dropdown.');
              const $select = $(`
                <select class="form-control service-select" name="${$input.attr('name')}">
                  <option value="">Select Service</option>
                  ${allServices.map(service => `
                    <option value="${service.id}" ${service.id === Number($input.prev('.service-id').val()) ? 'selected' : ''}>
                      ${service.name} (${service.service_id || service.code || service.id})
                    </option>
                  `).join('')}
                </select>
              `);
              $input.replaceWith($select);
              $select.on('change', function () {
                const serviceId = $(this).val();
                $row.find('.service-id').val(serviceId);
                const service = allServices.find(s => s.id === Number(serviceId));
                $row.find('.item-unit-price').val(service ? service.price : 0);
                calculateTotalAmount();
              });
            }
          });

          modal.find('.add-item').on('click', function () {
            const itemCount = modal.find('#editBillItems .row').length;
            const newItem = `
              <div class="row mb-2 bill-item-row">
                <div class="col-md-3">
                  <input type="hidden" class="service-id" name="item_service_id_${itemCount}">
                  <input type="text" class="form-control service-search" name="item_service_name_${itemCount}" placeholder="Search Service" required>
                  <small class="form-text text-muted">Doctors: No doctors assigned</small>
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

            const $newInput = modal.find(`[name="item_service_name_${itemCount}"]`);
            $newInput.autocomplete({
              source: function (request, response) {
                const term = request.term.toLowerCase();
                const filteredServices = allServices.filter(service =>
                  service.name.toLowerCase().includes(term) ||
                  (service.code && service.code.toLowerCase().includes(term)) ||
                  (service.service_id && service.service_id.toLowerCase().includes(term))
                );
                response(filteredServices.map(service => ({
                  label: `${service.name} (${service.service_id || service.code || service.id})`,
                  value: service.name,
                  id: service.id,
                  code: service.service_id || service.code || service.id
                })));
              },
              minLength: 2,
              select: function (event, ui) {
                const $row = $(this).closest('.bill-item-row');
                $row.find('.service-id').val(ui.item.id);
                $row.find('.item-unit-price').val(ui.item.id in serviceMap ? serviceMap[ui.item.id].price : 0);
                $(this).val(`${ui.item.value} (${ui.item.code})`);
                calculateTotalAmount();
                return false;
              },
              change: function (event, ui) {
                if (!ui.item) {
                  $(this).closest('.bill-item-row').find('.service-id').val('');
                  $(this).val('');
                }
              }
            });
          });

          modal.find('#editBillItems').on('click', '.remove-item', function () {
            const $row = $(this).closest('.row');
            if (modal.find('.bill-item-row').length === 1) {
              alert("A bill must have at least one item.");
              return;
            }
            $row.remove();
            calculateTotalAmount();
          });

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

          modal.find('#saveBillChanges').on('click', function () {
            let hasErrors = false;

            if (appointment && modal.find('#editAppointmentId').val()) {
              const date = modal.find('#editAppointmentDate').val();
              const time = modal.find('#editAppointmentTime').val();
              if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                alert("Please enter a valid appointment date in format YYYY-MM-DD.");
                hasErrors = true;
                return;
              }
              if (!time || !/^\d{2}:\d{2}$/.test(time)) {
                alert("Please enter a valid appointment time in format HH:mm.");
                hasErrors = true;
                return;
              }
              const appointmentDateTime = new Date(`${date}T${time}:00`);
              const now = new Date();
              if (appointmentDateTime <= now) {
                alert("Appointment date and time must be in the future.");
                hasErrors = true;
                return;
              }
            }

            const updatedBill = {
              bill_id: bill.bill_id,
              patient_id: modal.find('#editBillPatientId').val(),
              status: modal.find('#editBillStatus').val(),
              total_amount: parseFloat(modal.find('#editBillTotalAmount').val()) || 0,
              deposit_amount: parseFloat(modal.find('#editBillDepositAmount').val()) || 0,
              notes: modal.find('#editBillNotes').val(),
              items: []
            };

            modal.find('.bill-item-row').each(function (index) {
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
                service_id: Number(serviceId),
                quantity: quantity,
                unit_price: unitPrice,
                gst: gst,
                discount: discount,
                total_price: totalPrice
              });
            });

            if (hasErrors || updatedBill.items.length === 0) {
              alert("Please ensure at least one valid item is included.");
              return;
            }

            console.log(`📤 Sending updated bill:`, updatedBill);

            $.ajax({
              url: `${API_BASE_URL}/bills/update/`,
              type: "PUT",
              headers: getAuthHeaders(),
              data: JSON.stringify(updatedBill),
              contentType: "application/json",
              beforeSend: function (xhr) {
                console.log(`📤 Request payload:`, JSON.stringify(updatedBill, null, 2));
              },
              success: function (response) {
                console.log(`✅ Bill ${billId} updated successfully:`, response);
                if (appointment && modal.find('#editAppointmentId').val()) {
                  const updatedAppointment = {
                    appointment_id: modal.find('#editAppointmentId').val(),
                    date: modal.find('#editAppointmentDate').val(),
                    time: modal.find('#editAppointmentTime').val(),
                    status: modal.find('#editAppointmentStatus').val()
                  };
                  $.ajax({
                    url: `${API_BASE_URL}/appointments/edit/${updatedAppointment.appointment_id}/`,
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
                      alert(`Failed to update appointment: ${xhr.responseJSON?.error || "Server Unavailable"}`);
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
                alert(`Failed to update bill: ${xhr.responseJSON?.error || "Server Unavailable"}`);
              }
            });
          });

          modal.on('hidden.bs.modal', function () {
            modal.remove();
          });
        })
        .catch(error => {
          console.error(`❌ Failed to fetch services or appointment for bill ${billId}:`, error);
          alert(`Failed to fetch services or appointment: ${error.message}.`);
        });
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch bill ${billId}:`, xhr.responseJSON || xhr.statusText);
      alert(`Failed to fetch bill details: ${xhr.responseJSON?.error || "Server Unavailable"}`);
    }
  });
}

function bindBillFilters() {
  $('#billsNav .nav-link').on('click', function (e) {
    e.preventDefault();
    const filter = $(this).data('filter');
    console.log(`🖱️ Bill filter clicked: ${filter}`);

    $('#billsNav .nav-link').removeClass('active');
    $(this).addClass('active');

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

      currentPage = 1;
      populateBillsTable(currentBills, currentPage, pageSize);
      
      console.log(`✅ Fetched ${currentBills.length} bills with filter ${filter}`);
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch bills: ${xhr.responseJSON?.error || "Server Unavailable"}`);
      alert(`Failed to fetch bills: ${xhr.responseJSON?.error || "Server Unavailable"}`);
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

function postSubmissionAppointment(appointmentId) {
  console.log(`🔍 Entering postSubmissionAppointment with appointmentId: ${appointmentId}`);
  if (!appointmentId) {
    console.warn("⚠️ No appointment ID provided, skipping status update.");
    return;
  }

  console.log(`📅 Sending PATCH request to update appointment ID ${appointmentId} status to Booked...`);

  const appointmentUpdateData = {
    status: "Booked"
  };

  $.ajax({
    url: `${API_BASE_URL}/appointments/edit/${appointmentId}/`,
    type: "PATCH",
    headers: getAuthHeaders(),
    data: JSON.stringify(appointmentUpdateData),
    contentType: "application/json",
    success: function (response) {
      console.log(`✅ Appointment ID ${appointmentId} status updated to Booked:`, response);
    },
    error: function (xhr) {
      console.error(`❌ Failed to update appointment status for ID ${appointmentId}: ${xhr.responseJSON?.error || xhr.statusText}`);
      alert(`Failed to update appointment status: ${xhr.responseJSON?.error || "Server Unavailable"}`);
    }
  });
}

$("#addBillsForm").submit(function (e) {
  e.preventDefault();

  const patientId = $("#patientIdForBill").val() || sessionStorage.getItem("billPatientId");
  if (!patientId || isNaN(parseInt(patientId))) {
    alert("Please select a valid patient.");
    return;
  }

  const billDate = $("#billDate").val();
  if (!billDate || !/^\d{4}-\d{2}-\d{2}$/.test(billDate)) {
    alert("Please enter a valid bill date in format YYYY-MM-DD.");
    return;
  }
  const billDateObj = new Date(billDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (billDateObj < now) {
    alert("Bill date cannot be in the past.");
    return;
  }

  const items = [];
  let hasErrors = false;
  $("#billItemsTableBody tr").each(function () {
    const $row = $(this);
    const serviceId = $row.find(".service-id").val();
    const quantity = parseInt($row.find(".item-quantity").val()) || 0;
    const unitPrice = parseFloat($row.find(".item-unit-price").val()) || 0;
    const gst = parseFloat($row.find(".item-gst").val()) || 0;
    const discount = parseFloat($row.find(".item-discount").val()) || 0;
    const totalPrice = parseFloat($row.find(".item-total-price").val()) || 0;

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

    items.push({
      service_id: Number(serviceId),
      quantity: quantity,
      unit_price: unitPrice,
      gst: gst,
      discount: discount,
      total_price: totalPrice
    });
  });

  if (hasErrors || items.length === 0) {
    alert("Please add at least one valid item.");
    return;
  }

  const totalAmount = parseFloat($("#totalAmount").val()) || 0;
  const depositAmount = parseFloat($("#depositAmount").val()) || 0;
  const status = depositAmount >= totalAmount ? 'Paid' : (depositAmount > 0 ? 'Partially Paid' : 'Pending');
  const notes = $("#billNotes").val();

  const billData = {
    patient: Number(patientId), // Changed from patient_id to patient
    bill_date: billDate,
    total_amount: totalAmount,
    deposit_amount: depositAmount,
    status: status,
    notes: notes,
    items: items
  };

  showAppointmentDatePopup(function (appointmentDate, doctorId) {
    if (!doctorId || isNaN(parseInt(doctorId))) {
      alert("Please select a valid doctor.");
      return;
    }

    // Add appointment data (flat structure)
    billData.appointment_date = appointmentDate;
    billData.doctor = Number(doctorId); // Changed from doctor_id to doctor

    // Log the data being sent for debugging
    console.log("📤 Sending bill data:", JSON.stringify(billData, null, 2));

    $.ajax({
      url: `${API_BASE_URL}/bills/create/`,
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(billData),
      contentType: "application/json",
      success: function (response) {
        console.log("✅ Bill created successfully:", response);
        console.log("🔍 Bill creation response:", JSON.stringify(response, null, 2));

        $("#addBillsForm")[0].reset();
        $("#newActionModal").modal("hide");
        sessionStorage.removeItem("billPatientId");
        alert("Bill and appointment created successfully!");

        let appointmentId = response.appointment?.id || response.appointment_id;
        if (appointmentId && (!response.appointment || response.appointment.status !== "Booked")) {
          console.log(`🔄 Calling postSubmissionAppointment for appointment ID: ${appointmentId}`);
          postSubmissionAppointment(appointmentId);
        } else {
          console.log(`ℹ️ Appointment ID ${appointmentId} already has status 'Booked' or no ID found, skipping update.`);
        }

        let appointmentDateStr = response.appointment?.appointment_date
          ? new Date(response.appointment.appointment_date).toISOString().split('T')[0]
          : appointmentDate.split(' ')[0];

        fetchBills();
        if (appointmentDateStr) {
          console.log(`📅 Refreshing appointments for date: ${appointmentDateStr}`);
          fetchAppointmentsByDate(appointmentDateStr);
        } else {
          console.warn("⚠️ No appointment date found, refreshing with current filter");
          fetchAppointmentsByDate();
        }
      },
      error: function (xhr) {
        console.error(`❌ Failed to create bill: ${xhr.responseJSON?.error || xhr.statusText}`);
        console.error("🔍 Error response:", JSON.stringify(xhr.responseJSON, null, 2));
        alert(`Failed to create bill: ${xhr.responseJSON?.error || "Server Unavailable"}`);
      }
    });
  });
});

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


function updateBillDetails(patientId) {
  const effectivePatientId = patientId || selectedPatientId || $("#patientIdForBill").val() || sessionStorage.getItem("billPatientId");
  if (!effectivePatientId) {
    console.warn("No patient ID found for bill details update");
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
      const firstRowService = $("#billItemsTableBody tr:first .service-select");
      $("#billServiceName").val(firstRowService.length ? firstRowService.find('option:selected').text() || "" : "");
      $("#billDoctorName").val(
        patient.primary_doctor
          ? `${patient.primary_doctor.first_name} ${patient.primary_doctor.last_name || ""}`
          : ""
      );
      $("#billAppointmentDate").val("");
      $("#billDuration").val("30");
      $("#patientIdForBill").val(patient.patient_id);
      sessionStorage.setItem("billPatientId", patient.patient_id);
      selectedPatientId = patient.patient_id;
      console.log(`Updated bill details for patient ${patient.patient_id}`);
    },
    error: function (xhr) {
      console.error(`Failed to fetch patient for bill details: ${xhr.status} ${xhr.statusText}`, xhr.responseJSON);
      $("#billServiceName").val("");
      $("#billDoctorName").val("");
      $("#billAppointmentDate").val("");
      $("#billDuration").val("");
      alert(`Failed to fetch patient details: ${xhr.responseJSON?.error || "Server Unavailable"}`);
    }
  });
}

$("#addBillsTab").on("shown.bs.tab", function () {
  const patientId = $("#patientIdForBill").val() || sessionStorage.getItem("billPatientId") || selectedPatientId;
  const $form = $("#addBillsForm");
  const $alert = $form.find(".alert-warning");
  $alert.remove();
  if (patientId) {
    $("#patientIdForBill").val(patientId);
    sessionStorage.setItem("billPatientId", patientId);
    selectedPatientId = patientId;
    updateBillDetails(patientId);
    $form.find("input, button, select").prop("disabled", false);
    $("#createBillBtn, #addBillItem").prop("disabled", false);
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
  }
});

function populateDoctorDropdown(selectId, specialtyId) {
  const doctorSelect = $(`#${selectId}`);
  doctorSelect.empty().append('<option value="" disabled>Loading doctors...</option>');
  $.ajax({
    url: `${API_BASE_URL}/appointments/doctors/list/`,
    type: "GET",
    headers: getAuthHeaders(),
    success: function (data) {
      console.log(`🟢 Doctor API response for ${selectId}:`, data);
      doctorSelect.empty();
      if (selectId === "serviceDoctors") {
        doctorSelect.append('<option value="all">All Doctors</option>');
        doctorSelect.prop('multiple', true);
        doctorSelect.addClass('form-select');
      } else {
        doctorSelect.append('<option value="" selected disabled>Select Doctor</option>');
        doctorSelect.prop('multiple', false);
        doctorSelect.addClass('form-select');
      }
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
      if (specialtyId) {
        doctorSelect.off('change.specialty').on('change.specialty', function () {
          const selectedDoctor = doctors.find(d => d.id == $(this).val());
          $(`#${specialtyId}`).val(selectedDoctor ? selectedDoctor.specialization : '');
        });
      }
      doctorSelect.trigger('change');
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch doctors for ${selectId}: ${xhr.status}`, xhr.responseJSON);
      doctorSelect.empty().append('<option value="" disabled>Failed to load doctors</option>');
      alert("Failed to fetch doctors. Please check your connection or try again.");
    }
  });
}

$('#newActionModal').on('shown.bs.modal', function () {
  console.log("🔍 Modal shown, ensuring tab visibility...");
  const role = `${sessionStorage.getItem("user_type")?.toLowerCase()}-${sessionStorage.getItem("role_level")?.toLowerCase()}`;
  if (role === "doctor-senior") {
    $("#newActionTabs .nav-item").show();
    $("#newActionTabContent .tab-pane").find("input, select, button, textarea").prop("disabled", false);
    console.log("✅ All modal tabs visible and elements enabled for doctor-senior");
  } else {
    const permittedTabs = $("#newActionTabs .nav-item:visible");
    permittedTabs.show();
    $("#addServiceTab").closest(".nav-item").hide();
    if ($("#addServiceTab").hasClass("active")) {
      $("#addServiceTab").closest(".nav-item").show();
    }
  }
  if ($("#addPatientTab").hasClass("active") && !selectedPatientId) {
    $('#addPatientForm')[0].reset();
    $('#patientPhone').val('').trigger('change');
    $('#mobile2').val('').trigger('change');
    $('#patientDOB').val('');
    $('#maritalSince').val('');
    $('#appointmentDate').val('');
    $('#addPatientForm').removeData('edit-mode').removeData('patient-id').removeData('appointment-id');
    $('#personalDetailsCollapse').addClass('show');
    $('#contactDetailsCollapse, #medicalInfoCollapse, #additionalPersonalDetailsCollapse, #appointmentDetailsCollapse, #insuranceDetailsCollapse, #imageUploadCollapse').removeClass('show');
    updateDetailsSection(null);
  }
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
  $('#patientDOB').val('');
  $('#maritalSince').val('');
  $('#appointmentDate').val('');
  $('#addPatientForm').removeData('edit-mode').removeData('patient-id').removeData('appointment-id');
  $('#personalDetailsCollapse').addClass('show');
  $('#contactDetailsCollapse, #medicalInfoCollapse, #additionalPersonalDetailsCollapse, #appointmentDetailsCollapse, #insuranceDetailsCollapse, #imageUploadCollapse').removeClass('show');
});

document.addEventListener('DOMContentLoaded', () => {
  const tableBtn = document.getElementById('tableViewBtn');
  const calendarBtn = document.getElementById('calendarViewBtn');
  if (!tableBtn || !calendarBtn) {
    console.error('❌ Toggle buttons not found:', {
      tableBtn: !!tableBtn,
      calendarBtn: !!calendarBtn
    });
    return;
  }
  tableBtn.addEventListener('click', () => {
    console.log('🖱️ Table button clicked');
    toggleView('table');
  });
  calendarBtn.addEventListener('click', () => {
    console.log('🖱️ Calendar button clicked');
    toggleView('calendar');
  });
  document.getElementById('doctorFilter')?.addEventListener('change', (e) => {
    const doctorId = e.target.value || 'all';
    const selectedDate = $("#dateFilter").val();
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      alert("Please enter a valid date in format YYYY-MM-DD.");
      return;
    }
    console.log(`🔍 Doctor filter changed to: ${doctorId}, date: ${selectedDate}`);
    fetchAppointmentsByDate(selectedDate, 'all', doctorId);
  });
  console.log('🚀 Initializing table view');
  toggleView('table');
});

console.log("🚀 Initializing Dashboard...");
checkAuthentication();
bindDateFilterButtons();
bindNavFilters();
populateDoctorDropdown("doctor", "doctorSpecialty");
populateDoctorDropdownForFilter();
bindDoctorFilter();
bindBillFilters();
bindPagination();
initializePatientForm();

$('#newActionTabs a').on('click', function(e) {
  e.preventDefault();
  $(this).tab('show');
  if ($(this).attr('id') === 'addBillsTab') {
    fetchServices().then(() => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      $('#billDate').val(todayStr);
    }).catch(error => {
      console.error('❌ Failed to load services:', error);
      alert('Failed to load services. Please try again.');
    });
  }
});

$('#addBillItem').on('click', addBillItem);
$(document).on('click', '.remove-item', function() {
  if ($('#billItemsTableBody tr').length === 1) {
    alert('A bill must have at least one item.');
    return;
  }
  $(this).closest('tr').remove();
  calculateBillTotal();
});
$(document).on('input', '.item-quantity, .item-unit-price, .item-gst, .item-discount', calculateBillTotal);

$('#todayBillBtn').on('click', function() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  $('#billDate').val(todayStr);
});

$("#addServiceTab").on("shown.bs.tab", function () {
  console.log("Add Service tab shown, populating doctors...");
  populateDoctorDropdown("serviceDoctors");
  populateServicesTable();
});

// const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
fetchAppointmentsByDate(todayStr);
console.log("✅ Dashboard Initialization Complete");

});