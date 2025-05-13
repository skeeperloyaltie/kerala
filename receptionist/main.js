$(document).ready(function () {
  // main.js (Receptionist Implementation)

  // Ensure global dependencies are available
  const moment = window.moment;
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
    $('.btn-group label').removeClass('active');
    $(this).next('label').addClass('active');
  });

  // Initialize Bootstrap for Bill Date and DOB
  function validateDateInput(inputId, format = 'YYYY-MM-DD') {
    const $input = $(`#${inputId}`);
    $input.on('input', function() {
      const value = $input.val();
      const regex = format === 'YYYY-MM-DD' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
      if (value && !regex.test(value)) {
        $input.next('.invalid-feedback').remove();
      } else {
        $input.next('.invalid-feedback').remove();
      }
    });
  }

  validateDateInput('billDate');
  validateDateInput('patientDOB');
  validateDateInput('appointmentDate', 'YYYY-MM-DD HH:mm');

  // Get Authentication Headers
  function getAuthHeaders() {
    const token = sessionStorage.getItem("token");
    return token ? { "Authorization": `Token ${token}` } : {};
  }

  // Authentication Check
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
      console.error('❌ Missing authentication data in sessionStorage');
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
        adjustUIForRole(userType, roleLevel, data.username || 'Unknown User');
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        fetchAppointmentsByDate(todayStr);
      },
      error: function (xhr) {
        console.error('❌ Authentication Error:', xhr.responseJSON || xhr.statusText);
        sessionStorage.clear();
        alert('Authentication failed: Invalid token. Please log in again.');
        window.location.href = '../login/login.html';
      },
    });
  }

  // Fetch Indian Cities for Autocomplete
  let indianCities = [];
  let isFetchingCities = false;

  const fallbackCities = [
    { name: "Mumbai", state: "Maharashtra" },
    { name: "Delhi", state: "Delhi" },
    { name: "Bengaluru", state: "Karnataka" },
    { name: "Chennai", state: "Tamil Nadu" },
    { name: "Kolkata", state: "West Bengal" },
    { name: "Rajkot", state: "Gujarat" },
    { name: "Bhopal", state: "Madhya Pradesh" }
  ];

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
          .filter(city => city.name && typeof city.name === "string")
          .map(city => ({
            name: city.name.trim().replace(/\s+/g, " "),
            state: city.state ? city.state.trim() : ""
          }));
        console.log(`✅ Loaded ${indianCities.length} Indian cities`);
        isFetchingCities = false;
      },
      error: function (xhr, status, error) {
        console.error(`❌ Failed to fetch Indian cities (attempt ${attempt}):`, { status, error });
        isFetchingCities = false;
        if (attempt < maxAttempts) {
          console.log(`🔄 Retrying fetch (attempt ${attempt + 1})...`);
          setTimeout(() => fetchIndianCities(attempt + 1, maxAttempts), 1000);
        } else {
          console.warn("⚠️ Using fallback city list");
          indianCities = fallbackCities;
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
        fetchIndianCities();
        $dropdown.append('<li class="dropdown-item disabled">Loading cities...</li>');
        $dropdown.show();
        return;
      }

      const filteredCities = indianCities.filter(city => city.name.toLowerCase().includes(query));

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

    $dropdown.on("click", "li:not(.disabled)", function () {
      const cityName = $(this).data("city");
      $input.val(cityName);
      $dropdown.hide();
      console.log(`✅ Selected city for ${inputId}: ${cityName}`);
    });

    $(document).on("click", function (e) {
      if (!$(e.target).closest(`#${inputId}, .city-autocomplete`).length) {
        $dropdown.hide();
      }
    });

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

  // Role-Based UI Adjustments for Receptionists
  function adjustUIForRole(userType, roleLevel, username) {
    console.log(`🎭 Adjusting UI for UserType: ${userType}, RoleLevel: ${roleLevel}`);
    if (userType.toLowerCase() !== 'receptionist') {
      console.error('❌ Invalid user type for receptionist dashboard:', userType);
      alert('Access restricted: This dashboard is for receptionists only.');
      window.location.href = '../login/login.html';
      return;
    }

    const dashboardTypeElement = document.getElementById('dashboardType');
    const usernameElement = document.getElementById('usernameDisplay');

    if (dashboardTypeElement) {
      dashboardTypeElement.textContent = 'Receptionist Dashboard';
      console.log(`📊 Updated dashboard type to: Receptionist Dashboard`);
    }

    if (usernameElement) {
      usernameElement.textContent = username;
      console.log(`👤 Updated username to: ${username}`);
    }

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
    modalTabs.show();

    const role = `${userType}-${roleLevel}`.toLowerCase();

    switch (role) {
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
        console.warn("⚠️ Unknown receptionist role:", role);
        alert("Unknown role detected. Access restricted.");
        navItems.hide();
        secondaryNavItems.hide();
        buttons.hide();
        modalTabs.hide();
    }

    bindLogoutEvent();
    bindModalActions();
    bindNavActions();
    setupPatientSearch();
  }

  // Mark appointments for a given date
  function markAppointmentsForDate(dateStr) {
    if (!appointmentsData || !Array.isArray(appointmentsData)) return;

    const $dateFilter = $("#dateFilter");
    $dateFilter.removeAttr('data-appointment-times').removeClass('has-appointment');

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

    if (appointmentTimes.length > 0) {
      $dateFilter.addClass('has-appointment');
      $dateFilter.attr('data-appointment-times', appointmentTimes.join(', '));
      console.log(`🟢 Marked appointments for ${dateStr}:`, appointmentTimes);
    } else {
      console.log(`ℹ️ No appointments for ${dateStr}`);
    }
  }

  let appointmentsData = [];

  validateDateInput('dateFilter', function(dateStr) {
    $.ajax({
      url: `${API_BASE_URL}/appointments/list/?date=${dateStr}`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function(data) {
        appointmentsData = Array.isArray(data.appointments) ? data.appointments : [];
        console.log(`📅 Loaded appointments for ${dateStr}:`, appointmentsData);
        fetchAppointmentsByDate(dateStr);
        markAppointmentsForDate(dateStr);
      },
      error: function(xhr) {
        console.warn(`⚠️ Failed to load appointments for ${dateStr}: ${xhr.responseJSON?.error || "Server Unavailable"}`);
        appointmentsData = [];
        markAppointmentsForDate(dateStr);
      }
    });
  });

  function bindDateFilterButtons() {
    $(".btn:contains('Set')").on("click", function() {
      const dateStr = $("#dateFilter").val();
      console.log("🖱️ Set Date Clicked:", dateStr);
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        fetchAppointmentsByDate(dateStr);
      } else {
        alert("Please enter a valid date in YYYY-MM-DD format.");
      }
    });

    $(".btn:contains('Today')").on("click", function() {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      console.log("🖱️ Today Clicked:", todayStr);
      $("#dateFilter").val(todayStr).trigger('input');
    });

    $("#calendarTrigger").on("click", function() {
      console.log("🗓️ Calendar button clicked");
      alert("Calendar view is not available for receptionists. Please enter a date manually in YYYY-MM-DD format.");
    });
  }

  // Fetch Appointments by Date (Table View Only for Receptionists)
  function fetchAppointmentsByDate(dateStr = null, filter = 'all') {
    const today = new Date();
    const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedDate = dateStr || defaultDate;

    console.log(`📅 Fetching appointments for date: ${selectedDate}, filter: ${filter}`);

    $("#dateFilter").val(selectedDate).trigger('input');

    const url = `${API_BASE_URL}/appointments/list/?date=${selectedDate}`;

    $.ajax({
      url: url,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        let appointmentsArray = Array.isArray(data.appointments) ? data.appointments : [];
        const statusMap = {
          'all': ['booked', 'arrived', 'on-going', 'reviewed', 'scheduled'],
          'booked': ['booked'],
          'arrived': ['arrived'],
          'on-going': ['on-going'],
          'reviewed': ['reviewed'],
          'scheduled': ['scheduled']
        };
        const allowedStatuses = statusMap[filter.toLowerCase()] || statusMap['all'];
        appointmentsArray = appointmentsArray.filter(appt => appt && appt.status && allowedStatuses.includes(appt.status.toLowerCase()));
        populateAppointmentsTable(appointmentsArray, selectedDate);
        console.log(`✅ Fetched ${appointmentsArray.length} appointments for ${selectedDate}`);
      },
      error: function (xhr) {
        console.error(`❌ Failed to fetch appointments: ${xhr.responseJSON?.error || "Server Unavailable"}`);
        alert(`Failed to fetch appointments: ${xhr.responseJSON?.error || "Server Unavailable"}`);
        populateAppointmentsTable([], selectedDate);
      }
    });
  }

  // Bind Navigation Filters
  function bindNavFilters() {
    $(".navbar-secondary .nav-item a").on("click", function (e) {
      e.preventDefault();
      const section = $(this).data("section");
      console.log(`🖱️ Filter clicked: ${section}`);
      $(".navbar-secondary .nav-item a").removeClass("active");
      $(this).addClass("active");
      const dateStr = $("#dateFilter").val();
      fetchAppointmentsByDate(dateStr || null, section);
    });
  }

  // Populate Appointments Table
  function populateAppointmentsTable(appointments, dateStr) {
    const tableBody = document.getElementById('appointmentsTableBody');
    tableBody.innerHTML = '';

    const targetDate = new Date(dateStr);
    if (isNaN(targetDate)) {
      tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Invalid date selected.</td></tr>';
      return;
    }

    const dateStrFormatted = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
    console.log(`📅 Populating table for ${dateStrFormatted}`);

    const filteredAppointments = appointments.filter(appt => {
      if (!appt || !appt.appointment_date) return false;
      const apptDateStr = appt.appointment_date.split('T')[0];
      return apptDateStr === dateStrFormatted;
    });

    if (filteredAppointments.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No appointments found for ${dateStrFormatted}.</td></tr>`;
      return;
    }

    filteredAppointments.sort((a, b) => {
      const timeA = a.appointment_date.split('T')[1];
      const timeB = b.appointment_date.split('T')[1];
      return timeA.localeCompare(timeB);
    });

    filteredAppointments.forEach(appt => {
      const row = document.createElement('tr');
      const time = appt.appointment_date.split('T')[1].split(':').slice(0, 2).join(':');
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

    document.querySelectorAll('.view-details').forEach(button => {
      button.addEventListener('click', () => {
        const appointmentId = button.dataset.appointmentId;
        showAppointmentDetails(appointmentId);
      });
    });

    console.log(`✅ Populated table with ${filteredAppointments.length} appointments for ${dateStrFormatted}`);
  }

  // Show Appointment Details
  function showAppointmentDetails(appointmentId) {
    console.log(`🔍 Fetching details for appointment ID: ${appointmentId}`);
    $.ajax({
      url: `${API_BASE_URL}/appointments/list/?appointment_id=${appointmentId}`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (response) {
        if (!response.appointments || !response.appointments.length) {
          alert('No appointment details found.');
          return;
        }
        const appointment = response.appointments[0];
        const patientName = appointment.patient && appointment.patient.first_name
          ? `${appointment.patient.first_name} ${appointment.patient.last_name || ''}`
          : 'Unnamed';
        const doctorName = appointment.doctor && appointment.doctor.first_name
          ? `${appointment.doctor.first_name} ${appointment.doctor.last_name || ''}`
          : 'N/A';
        const apptDate = new Date(appointment.appointment_date);
        const formattedDate = apptDate.toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });

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

        $('#appointmentDetailsModal').remove();
        $('body').append(modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('appointmentDetailsModal'), {
          backdrop: 'static',
          keyboard: true
        });
        modal.show();

        $('#appointmentDetailsModal').on('hidden.bs.modal', function () {
          $(this).remove();
        });
      },
      error: function (xhr) {
        console.error(`❌ Failed to fetch appointment details for ID ${appointmentId}: ${xhr.responseJSON?.error || xhr.statusText}`);
        alert(`Failed to load appointment details: ${xhr.responseJSON?.error || 'Server unavailable.'}`);
      }
    });
  }

  // Update Appointment Status
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
          const statusClass = newStatus ? `status-${newStatus.toLowerCase().replace(' ', '-')}` : 'status-unknown';
          $row.find('.status-select').val(newStatus);
          $row.find('.status-cell').html(`<span class="${statusClass}">${newStatus.toUpperCase()}</span>`);
        }
        if (callback) {
          callback();
        }
      },
      error: function (xhr) {
        console.error(`❌ Failed to update appointment ${appointmentId}:`, xhr.responseJSON || xhr.statusText);
        alert(`Failed to update status: ${xhr.responseJSON?.error || "Server Unavailable"}`);
      }
    });
  }

  // Logout Function
  function logoutUser() {
    const headers = getAuthHeaders();
    if (!headers['Authorization']) {
      console.warn("No authorization token found. Forcing logout...");
      sessionStorage.clear();
      window.location.href = "../login/login.html";
      return;
    }

    $.ajax({
      url: `${API_BASE_URL}/users/logout/`,
      type: "POST",
      headers: headers,
      success: function () {
        console.log("✅ Logout successful");
        sessionStorage.clear();
        alert("Logged out successfully.");
        window.location.href = "../login/login.html";
      },
      error: function (xhr) {
        console.error("❌ Logout failed:", xhr.status, xhr.responseText);
        sessionStorage.clear();
        window.location.href = "../login/login.html";
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

  // Apply role-based restrictions
  const userType = sessionStorage.getItem("user_type") || "unknown";
  const roleLevel = sessionStorage.getItem("role_level") || "unknown";
  const role = `${userType}-${roleLevel}`.toLowerCase();

  // Restrict tabs based on action
  switch (action) {
    case "patient-search":
    case "new":
      modalTabs.show();
      modalTabs.filter("#addServiceTab, #billsTab").hide();
      $("#addPatient").addClass("show active");
      break;
    default:
      modalTabs.show();
      $("#addPatient").addClass("show active");
  }

  // Apply receptionist-specific restrictions
  switch (role) {
    case "receptionist-senior":
      modalTabs.filter(":contains('Add Service')").hide();
      break;
    case "receptionist-medium":
    case "receptionist-basic":
      modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
      break;
    default:
      console.warn(`⚠️ Unknown receptionist role: ${role}`);
      modalTabs.hide();
      modalTabs.filter("#addPatientTab").show();
  }

  console.log("🔍 Final Modal Tabs Visibility:", modalTabs.filter(":visible").map((i, el) => $(el).text().trim()).get());
}

// Function to open modal with specific action
function openModalWithAction(action) {
  currentModalAction = action;
  console.log(`🖱️ Opening modal for action: ${action}`);

  $("#newActionModal").modal("show");
  adjustModalTabs(action);

  if (action === "patient-search") {
    $(".patient-search").focus();
    setupPatientSearch();
  }
}

// Bind navigation click events
function bindNavActions() {
  $(".navbar-top .nav-link").on("click", function (e) {
    e.preventDefault();
    const action = $(this).data("action");
    console.log(`🖱️ Nav item clicked: ${action}`);

    const navItem = $(this).closest(".nav-item");
    if (navItem.is(":visible")) {
      openModalWithAction(action);
    } else {
      console.warn(`⚠️ User lacks permission for action: ${action}`);
      alert("You do not have permission to perform this action.");
    }
  });

  $(".navbar-top .btn[data-action='new']").on("click", function (e) {
    e.preventDefault();
    openModalWithAction("new");
  });

  $(".patient-search").on("search", function () {
    const query = $(this).val().trim();
    if (query) {
      console.log(`🔍 Patient search triggered: ${query}`);
      openModalWithAction("patient-search");
      setupPatientSearch(query);
    }
  });
}

// Bind Modal Actions
function bindModalActions() {
  console.log("🔍 Found elements with data-action:", $("[data-action]").length, $("[data-action]").map((i, el) => $(el).data("action")).get());

  const actionToTabMap = {
    "new": "addPatientTab",
    "patient-q": "addPatientTab",
    "support": "profileTab"
  };

  $("[data-action]").off('click').on('click', function (e) {
    e.preventDefault();
    const action = $(this).data("action");
    console.log(`🖱️ Action Triggered: ${action}`);

    const tabId = actionToTabMap[action] || "addPatientTab";
    const modal = $('#newActionModal');
    const tabElement = $(`#${tabId}`);
    const navItem = $(this).closest(".nav-item");

    if (navItem.length && !navItem.is(":visible")) {
      console.error(`❌ Nav item for action ${action} is not visible. User lacks access.`);
      alert("You do not have permission to access this feature.");
      return;
    }

    modal.modal('show');

    const role = `${sessionStorage.getItem("user_type")?.toLowerCase()}-${sessionStorage.getItem("role_level")?.toLowerCase()}`;
    const permittedTabs = $("#newActionTabs .nav-item:visible");
    permittedTabs.show();

    if (tabElement.length) {
      tabElement.closest(".nav-item").show();
      tabElement.tab('show');
      console.log(`✅ Successfully switched to tab: ${tabId}`);
    } else {
      console.error(`❌ Tab with ID ${tabId} not found! Falling back to Add Patient tab`);
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

  const role = `${sessionStorage.getItem("user_type")?.toLowerCase()}-${sessionStorage.getItem("role_level")?.toLowerCase()}`;

  $("#newActionTabs .nav-item:visible").show();
  if (!$("#addServiceTab").closest(".nav-item").is(":visible")) {
    $("#addServiceTab").closest(".nav-item").hide();
  }
  if (role === "receptionist-medium" || role === "receptionist-basic") {
    $("#billsTab").closest(".nav-item").hide();
  }

  $("#addPatientTab").tab("show");
}

// Setup Patient Search with Autocomplete
let selectedPatientId = null;

function setupPatientSearch(query = null) {
  console.log("🔍 Setting up patient search...");
  const $searchInput = $('.navbar-top .form-control.patient-search');
  const $dropdown = $('<ul class="autocomplete-dropdown"></ul>').hide();
  $searchInput.after($dropdown);

  $searchInput.on('input', debounce(function () {
    const searchQuery = $searchInput.val().trim();
    console.log("✨ Search input triggered:", searchQuery);
    if (searchQuery.length < 1) {
      $dropdown.hide().empty();
      return;
    }

    $.ajax({
      url: `${API_BASE_URL}/patients/search/?query=${encodeURIComponent(searchQuery)}`,
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
          $dropdown.hide();
          showCreatePatientPrompt(searchQuery);
        }
      },
      error: function (xhr) {
        console.error("❌ Search error:", xhr.status, xhr.statusText);
        $dropdown.hide();
      }
    });
  }, 300));

  $dropdown.on('click', 'li', function () {
    const patientId = $(this).data('patient-id');
    $searchInput.val($(this).text());
    $dropdown.hide();
    console.log("👤 Patient selected, ID:", patientId);
    selectedPatientId = patientId;
    fetchPatientDetails(patientId, 'addPatientTab');
  });

  $(document).on('click', function (e) {
    if (!$(e.target).closest('.navbar-top .form-control.patient-search, .autocomplete-dropdown').length) {
      $dropdown.hide();
    }
  });

  if (query) {
    $searchInput.val(query).trigger('input');
  }
}

// Fetch Patient Details
function fetchPatientDetails(patientId, targetTab = 'addPatientTab') {
  $.ajax({
    url: `${API_BASE_URL}/patients/patients/${patientId}/`,
    type: "GET",
    headers: getAuthHeaders(),
    success: function (data) {
      selectedPatientId = (data.patient || data).patient_id;
      const patient = data.patient || data;
      const appointment = patient.appointments && patient.appointments.length > 0 ? patient.appointments[0] : null;

      populateProfileTab(patient);
      populateAddPatientForm(patient, appointment);
      updateDetailsSection(data);

      $('#newActionModal').modal('show');
      $(`#${targetTab}`).tab('show');

      if (targetTab === 'addPatientTab') {
        $('#personalDetailsCollapse, #contactDetailsCollapse, #medicalInfoCollapse, #additionalPersonalDetailsCollapse, #appointmentDetailsCollapse, #insuranceDetailsCollapse, #imageUploadCollapse').addClass('show');
      }

      console.log(`✅ Fetched and populated details for patient ${patientId}, switched to ${targetTab}`);
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch patient details for ${patientId}:`, xhr.responseJSON);
      alert(`Failed to fetch patient details: ${xhr.responseJSON?.error || "Server Unavailable"}`);
    }
  });
}

// Display Patient Appointments in APPT Tab
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
      $('#visitsTab').tab('show');
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch appointments for patient ${patientId}:`, xhr.responseJSON);
      alert(`Failed to fetch appointments: ${xhr.responseJSON?.error || "Server Unavailable"}`);
    }
  });
}

// Render Appointments Table in APPT Tab
function renderAppointmentsTable(appointments, patientId) {
  const $visitsTabContent = $('#visitsTabContent');
  $visitsTabContent.empty();

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

  $visitsTabContent.find('.edit-appointment').on('click', function () {
    const appointmentId = $(this).data('appointment-id');
    editAppointment(appointmentId);
  });

  console.log(`✅ Rendered appointments table for patient ${patientId} with ${appointments.length} entries`);
}

// Edit Appointment
function editAppointment(appointmentId) {
  $.ajax({
    url: `${API_BASE_URL}/appointments/edit/${appointmentId}/`,
    type: "GET",
    headers: getAuthHeaders(),
    success: function (appt) {
      console.log(`📋 Fetched appointment ${appointmentId} for editing:`, appt);

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

      $("#editApptDate").on("input", function () {
        const date = $(this).val();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          $(this).addClass("is-invalid");
        } else {
          $(this).removeClass("is-invalid");
        }
      });

      $("#editApptTime").on("input", function () {
        const time = $(this).val();
        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
          $(this).addClass("is-invalid");
        } else {
          $(this).removeClass("is-invalid");
        }
      });

      populateDoctorDropdown('editApptDoctor');
      $('#editApptDoctor').val(appt.doctor?.id || '');

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
            showPatientAppointments(selectedPatientId);
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
  $('#profileCity').val(patient.city || '');
  $('#profileAddress').val(patient.address || '');
  $('#profilePin').val(patient.pincode || '');
  $('#profileMaritalSince').val(patient.marital_since || '');
  $('#profileBloodGroup').val(patient.blood_group || '');
  $('#profileReferredBy').val(patient.referred_by || '');
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

  const $profileFields = $('#profileCity, #profileAddress, #profilePin');
  $profileFields.prop('readonly', true);

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
            console.error(`❌ Failed to update patient ${patientId}:`, xhr.responseJSON);
            alert(`Failed to update address: ${xhr.responseJSON?.error || "Server Unavailable"}`);
          }
        });
      }
    });
  }

  setupCityAutocomplete("profileCity");

  $('#editProfileBtn').off('click').on('click', function () {
    populateAddPatientForm(patient, null);
    $('#addPatientTab').tab('show');
  });

  $('#viewAppointmentsBtn').off('click').on('click', function () {
    showPatientAppointments(patient.patient_id);
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
  if ($('#noPatientFoundModal').length > 0) {
    console.log("ℹ️ No Patient Found modal already exists, skipping creation.");
    return;
  }

  const [firstName, ...lastNameParts] = query.split(' ');
  const lastName = lastNameParts.join(' ');

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

  const $modal = $(modalHtml);
  $('body').append($modal);

  const promptModal = new bootstrap.Modal($modal[0], {
    backdrop: 'static',
    keyboard: true,
    focus: true
  });

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

  $modal.on('hidden.bs.modal', function () {
    $modal.remove();
  });
}

// Populate Doctor Dropdown (used in editAppointment)
function populateDoctorDropdown(selectId) {
  const $select = $(`#${selectId}`);
  $select.empty().append('<option value="">Select Doctor</option>');

  $.ajax({
    url: `${API_BASE_URL}/appointments/doctors/list/`,
    type: "GET",
    headers: getAuthHeaders(),
    success: function (data) {
      console.log("✅ Doctor dropdown data:", data);
      const doctors = Array.isArray(data.doctors) ? data.doctors : [];
      if (doctors.length === 0) {
        $select.append('<option value="" disabled>No doctors available</option>');
      } else {
        doctors.forEach(doctor => {
          if (doctor.id && doctor.first_name) {
            $select.append(
              `<option value="${doctor.id}">${doctor.first_name} ${doctor.last_name || ''}</option>`
            );
          }
        });
      }
    },
    error: function (xhr) {
      console.error(`❌ Failed to fetch doctors for dropdown: ${xhr.status}`);
      $select.empty().append('<option value="" disabled>Failed to load doctors</option>');
    }
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
    { id: 'referredBy', name: 'Referred By' }
  ];

  let errors = [];

  requiredFields.forEach(field => {
    let value;
    if (field.id === 'patientPhone') {
      value = itiPhone.getNumber();
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
    primary_doctor: $("#doctor").val() || null
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
  let activeButton = 'savePatient';
  if (e.originalEvent && e.originalEvent.submitter) {
    activeButton = e.originalEvent.submitter.id;
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

// Initialize Patient Form
function initializePatientForm() {
  console.log("🔄 Initializing patient form...");

  if (!$('#addPatientForm').data('edit-mode')) {
    $('#addPatientForm')[0].reset();
    $('#patientPhone').val('');
    $('#mobile2').val('');
    if (itiPhone) itiPhone.setNumber('');
    if (itiMobile2) itiMobile2.setNumber('');
  }

  $("#doctor").val('');
  console.log("ℹ️ Primary Doctor set to empty for receptionist");
}

// Handle Post-Submission
function handlePostSubmission(data, activeButton) {
  updateDetailsSection(data);
  populateProfileTab(data);
  $('#profileTab').tab('show');

  if (activeButton === 'addAndCreateAppointment') {
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

// Show Appointment Date Popup
function showAppointmentDatePopup(callback) {
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

  $('body').append(modal);
  const bsModal = new bootstrap.Modal(modal[0], {
    backdrop: 'static',
    keyboard: true,
  });
  bsModal.show();

  populateDoctorDropdown('billDoctor');

  function validateDate(dateStr) {
    const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (!regex.test(dateStr)) {
      return { valid: false, message: 'Date must be in YYYY-MM-DD format (e.g., 2025-01-01).' };
    }

    const [, year, month, day] = dateStr.match(regex);
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    const currentYear = new Date().getFullYear();
    if (yearNum < currentYear) {
      return { valid: false, message: `Year must be ${currentYear} or later.` };
    }

    if (monthNum < 1 || monthNum > 12) {
      return { valid: false, message: 'Month must be between 01 and 12.' };
    }

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

  $('#confirmAppointmentDate').on('click', function () {
    const dateStr = $('#appointmentDateInput').val().trim();
    const timeStr = $('#appointmentTimeInput').val().trim();
    const doctorId = $('#billDoctor').val();

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

    const dateValidation = validateDate(dateStr);
    if (!dateValidation.valid) {
      alert(dateValidation.message);
      return;
    }

    const timeValidation = validateTime(timeStr);
    if (!timeValidation.valid) {
      alert(timeValidation.message);
      return;
    }

    const dateTimeStr = `${dateStr}T${timeStr}`;
    const selectedDate = new Date(dateTimeStr);

    if (isNaN(selectedDate.getTime())) {
      alert('Invalid date or time. Please check your input.');
      return;
    }

    const now = new Date();
    if (selectedDate <= now) {
      alert('Selected date/time is in the past or current time. Please choose a future date.');
      return;
    }

    const formattedDate = `${dateStr} ${timeStr}`;
    console.log(`Confirmed appointment date: ${formattedDate}, doctorId: ${doctorId}`);

    callback(formattedDate, doctorId);

    bsModal.hide();
  });

  modal.on('hidden.bs.modal', function () {
    bsModal.dispose();
    modal.remove();
  });
}
// Update Appointment Status Post-Submission
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

// Navigate Back to Add Patient Tab
$("#goBackBtn").on("click", function () {
  $("#newActionTabs .nav-link.active").removeClass("active");
  $("#addPatientTab").addClass("active");
  $("#newActionTabContent .tab-pane.active").removeClass("show active");
  $("#addPatient").addClass("show active");
  console.log("Navigated back to Add Patient tab");
});

// Modal Shown Event
$('#newActionModal').on('shown.bs.modal', function () {
  console.log("🔍 Modal shown, ensuring tab visibility...");
  const role = `${sessionStorage.getItem("user_type")?.toLowerCase()}-${sessionStorage.getItem("role_level")?.toLowerCase()}`;
  if (role !== "doctor-senior") {
    $("#addServiceTab, #addBillsTab").closest(".nav-item").hide();
    console.log("ℹ️ Hid service and bills tabs for receptionist");
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

// Modal Hidden Event
$('#newActionModal').on('hidden.bs.modal', function () {
  console.log("🔄 Modal hidden, resetting view and search input...");
  resetModalView();
  updateDetailsSection(null);
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

// Dashboard Initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Initializing Dashboard...");
  checkAuthentication();
  bindDateFilterButtons();
  bindNavFilters();
  populateDoctorDropdown("doctor", "doctorSpecialty");
  initializePatientForm();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  fetchAppointmentsByDate(todayStr);
  console.log("✅ Dashboard Initialization Complete");
});

// Tab Navigation
$('#newActionTabs a').on('click', function (e) {
  e.preventDefault();
  $(this).tab('show');
  console.log(`🖱️ Switched to tab: ${$(this).attr('id')}`);
});
});