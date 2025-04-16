$(document).ready(function () {
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

  // Initialize Flatpickr for Date Filter
  flatpickr("#dateFilter", {
    dateFormat: "Y-m-d",
    defaultDate: new Date(),
    allowInput: true,
    minDate: "1900-01-01",
    onReady: function(selectedDates, dateStr, instance) {
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let year = currentYear; year >= 1900; year--) {
        years.push(year);
      }
      instance.yearElements[0].innerHTML = years.map(year => 
        `<option value="${year}" ${year === currentYear ? "selected" : ""}>${year}</option>`
      ).join("");
    },
    onChange: function (selectedDates, dateStr) {
      console.log("📅 Date Filter Changed - Selected date:", dateStr);
      fetchAppointmentsByDate(dateStr);
    }
  });
  console.log("🟢 Flatpickr Initialized for #dateFilter with default date: Today");

  // Initialize Flatpickr for Bill Date
  flatpickr("#billDate", {
    dateFormat: "Y-m-d",
    defaultDate: new Date(),
    allowInput: true
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
        fetchAppointmentsByDate();
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
        console.log(`✅ Loaded ${indianCities.length} Indian cities`, indianCities.slice(0, 10));
        isFetchingCities = false;
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
          console.log(`🔄 Retryingස්ටැප්මින්ට් Retry fetch (attempt ${attempt + 1})...`);
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

  fetchIndianCities();
  setupCityAutocomplete("patientCity");
  setupCityAutocomplete("profileCity");

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
    modalTabs.show();

    const role = `${userType}-${roleLevel}`.toLowerCase();
    const permissions = JSON.parse(localStorage.getItem("permissions") || "[]");

    switch (role) {
      case "doctor-senior":
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
        modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
        break;
      case "nurse-senior":
        navItems.filter(":contains('Add Services'), :contains('Tele Consults')").hide();
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
        modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
        break;
      case "nurse-basic":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.hide();
        searchInput.hide();
        dateFilter.hide();
        secondaryNavItems.filter(":contains('Booked'), :contains('On-Going'), :contains('Reviewed')").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
        break;
      case "receptionist-senior":
        navItems.filter(":contains('Add Services'), :contains('Tele Consults')").hide();
        secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").not(":contains('Filter')").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service')").hide();
        break;
      case "receptionist-medium":
        navItems.filter(":contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.filter(":contains('Support')").hide();
        secondaryNavItems.filter(":contains('On-Going'), :contains('Reviewed')").hide();
        $(".navbar-secondary .btn-circle").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
        break;
      case "receptionist-basic":
        navItems.filter(":contains('All Bills'), :contains('Add Services'), :contains('Tele Consults')").hide();
        buttons.hide();
        searchInput.hide();
        dateFilter.hide();
        secondaryNavItems.filter(":contains('Arrived'), :contains('On-Going'), :contains('Reviewed')").hide();
        dashboardDropdown.hide();
        modalTabs.filter(":contains('Add Service'), :contains('Add Bills')").hide();
        break;
      default:
        console.warn("⚠️ Unknown role combination:", role);
        alert("Unknown role detected. Access restricted.");
        navItems.hide();
        secondaryNavItems.hide();
        buttons.hide();
        modalTabs.hide();
    }

    if (permissions.can_add_bill === true) {
      modalTabs.filter(":contains('Add Bills')").show();
    } else if (permissions.can_add_bill !== true && role !== "doctor-senior" && role !== "receptionist-senior") {
      modalTabs.filter(":contains('Add Bills')").hide();
    }

    console.log("🔍 Final Nav Items Visibility:", navItems.filter(":visible").map((i, el) => $(el).text().trim()).get());
    console.log("🔍 Final Modal Tabs Visibility:", modalTabs.filter(":visible").map((i, el) => $(el).text().trim()).get());
    bindLogoutEvent();
    bindModalActions();
    setupPatientSearch();
  }

  let appointmentsData = [];
  const dateFilter = flatpickr("#dateFilter", {
    enableTime: true,
    time_24hr: false,
    dateFormat: "Y-m-d H:i",
    minuteIncrement: 5,
    defaultDate: null,
    onChange: function (selectedDates, dateStr) {
      const dateOnly = dateStr.split(' ')[0];
      fetchAppointmentsByDate(dateOnly);
    },
    onDayCreate: function (dObj, dStr, fp, dayElem) {
      const date = dayElem.dateObj;
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      appointmentsData.forEach(appt => {
        if (!appt.appointment_date) return;
        const apptDate = new Date(appt.appointment_date);
        const apptDateStr = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}-${String(apptDate.getDate()).padStart(2, '0')}`;
        if (apptDateStr === dateStr) {
          const apptTime = apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
          dayElem.classList.add('has-appointment');
          dayElem.setAttribute('data-appointment-time', apptTime);
        }
      });
    },
    onOpen: function (selectedDates, dateStr, instance) {
      const currentDate = dateStr ? dateStr.split(' ')[0] : instance.formatDate(new Date(), 'Y-m-d');
      $.ajax({
        url: `${API_BASE_URL}/appointments/list/?date=${currentDate}`,
        type: "GET",
        headers: getAuthHeaders(),
        success: function (data) {
          appointmentsData = Array.isArray(data.appointments) ? data.appointments : [];
          console.log(`📅 Loaded appointments for calendar:`, appointmentsData);
          if (appointmentsData.length) {
            instance.setDate(appointmentsData[0].appointment_date, false);
          }
          instance.redraw();
        },
        error: function (xhr) {
          console.warn(`⚠️ Failed to load appointments for calendar: ${xhr.responseJSON?.error || "Unknown error"}`);
          appointmentsData = [];
          instance.redraw();
        }
      });
    }
  });

  $("#calendarTrigger").on("click", function () {
    dateFilter.open();
    console.log("🗓️ Calendar button clicked, opening date picker");
  });

  $(".btn:contains('Set')").on("click", function () {
    const dateStr = $("#dateFilter").val();
    if (dateStr) {
      const dateOnly = dateStr.split(' ')[0];
      fetchAppointmentsByDate(dateOnly);
    }
  });

  $(".btn:contains('Today')").on("click", function () {
    const today = new Date();
    const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    fetchAppointmentsByDate(defaultDate);
    dateFilter.setDate(defaultDate, false);
  });

  function bindNavFilters() {
    $('.navbar-secondary .nav-item a').on('click', function (e) {
      e.preventDefault();
      const section = $(this).data('section');
      console.log(`🖱️ Filter clicked: ${section}`);
      
      $('.navbar-secondary .nav-item a').removeClass('active');
      $(this).addClass('active');
      
      const dateStr = $("#dateFilter").val();
      const dateOnly = dateStr ? dateStr.split(' ')[0] : null;
      fetchAppointmentsByDate(dateOnly, section);
    });
  }

  function fetchAppointmentsByDate(dateStr = null, filter = 'all') {
    const today = new Date();
    const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedDate = dateStr || defaultDate;

    if (dateStr) {
      $("#dateFilter").val(selectedDate);
      flatpickr("#dateFilter").setDate(selectedDate, false);
      console.log(`📅 Updated #dateFilter to: ${selectedDate}`);
    }

    $.ajax({
      url: `${API_BASE_URL}/appointments/list/?date=${selectedDate}`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        console.log(`📥 Raw API response for ${selectedDate}:`, data);
        populateAppointmentsTable(data, selectedDate, filter);
        console.log(`✅ Fetched appointments for ${selectedDate} with filter ${filter}`);
      },
      error: function (xhr) {
        alert(`Failed to fetch appointments: ${xhr.responseJSON?.error || "Unknown error"}`);
        populateAppointmentsTable([], selectedDate, filter);
      }
    });
  }

  function updateAppointmentStatus(appointmentId, newStatus, $row, selectedDate) {
    $.ajax({
      url: `${API_BASE_URL}/appointments/edit/${appointmentId}/`,
      type: "PATCH",
      headers: getAuthHeaders(),
      data: JSON.stringify({ status: newStatus }),
      contentType: "application/json",
      success: function (updatedAppointment) {
        console.log(`✅ Updated appointment ${appointmentId} to status ${newStatus}`);
        const statusClass = newStatus ? `status-${newStatus.toLowerCase().replace(' ', '-')}` : 'status-unknown';
        $row.find('.status-select').val(newStatus);
        $row.find('.status-cell').html(`<span class="${statusClass}">${newStatus.toUpperCase()}</span>`);
      },
      error: function (xhr) {
        console.error(`❌ Failed to update appointment ${appointmentId}:`, xhr.responseJSON || xhr.statusText);
        alert(`Failed to update status: ${xhr.responseJSON?.error || "Unknown error"}`);
        $row.find('.status-select').val($row.find('.status-select').data('original-status'));
      }
    });
  }

  function populateAppointmentsTable(appointments, date, filter = 'all') {
    const $tbody = $('.table-appointments tbody');
    $tbody.empty();

    console.log(`📥 Received appointments data:`, appointments);

    let appointmentsArray = [];
    if (Array.isArray(appointments)) {
      appointmentsArray = appointments;
    } else if (appointments && typeof appointments === 'object') {
      if (Array.isArray(appointments.appointments)) {
        appointmentsArray = appointments.appointments;
      } else if (Array.isArray(appointments.results)) {
        appointmentsArray = appointments.results;
      } else if (!Array.isArray(appointments)) {
        appointmentsArray = [appointments];
      }
    } else {
      console.warn(`⚠️ Appointments data is not an array or valid object:`, appointments);
    }

    const statusMap = {
      'all': ['waiting', 'scheduled', 'pending', 'active', 'completed', 'canceled', 'rescheduled'],
      'booked': ['scheduled', 'pending'],
      'arrived': ['waiting'],
      'on-going': ['active'],
      'reviewed': ['completed']
    };
    const allowedStatuses = statusMap[filter.toLowerCase()] || statusMap['all'];

    appointmentsArray = appointmentsArray.filter(appt => {
      if (!appt || !appt.status) return false;
      return allowedStatuses.includes(appt.status.toLowerCase());
    });

    if (!appointmentsArray.length) {
      $tbody.append(`<tr><td colspan="8" class="text-center">No appointments found for ${date} (${filter})</td></tr>`);
      console.log(`ℹ️ No appointments to display for ${date} with filter ${filter}`);
      return;
    }

    const groupedByPatient = appointmentsArray.reduce((acc, appt) => {
      if (!appt || typeof appt !== 'object' || !appt.id || !appt.patient || !appt.patient.patient_id) {
        console.warn(`⚠️ Skipping invalid appointment at index ${appointmentsArray.indexOf(appt)}:`, appt);
        return acc;
      }
      const patientId = appt.patient.patient_id;
      if (!acc[patientId]) {
        acc[patientId] = {
          patient: appt.patient,
          appointments: []
        };
      }
      acc[patientId].appointments.push(appt);
      return acc;
    }, {});

    let patientIndex = 0;
    let totalAppointments = 0;
    const patientEntries = Object.entries(groupedByPatient).sort((a, b) => {
      const nameA = `${a[1].patient.first_name} ${a[1].patient.last_name || ''}`.toLowerCase();
      const nameB = `${b[1].patient.first_name} ${b[1].patient.last_name || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    if (!patientEntries.length) {
      $tbody.append(`<tr><td colspan="8" class="text-center">No valid appointments found for ${date} (${filter})</td></tr>`);
      console.log(`ℹ️ No valid appointments to display for ${date} with filter ${filter}`);
      return;
    }

    const STATUS_CHOICES = [
      { value: 'waiting', label: 'Waiting' },
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'pending', label: 'Pending' },
      { value: 'active', label: 'Active' },
      { value: 'completed', label: 'Completed' },
      { value: 'canceled', label: 'Canceled' },
      { value: 'rescheduled', label: 'Rescheduled' }
    ];

    patientEntries.forEach(([patientId, { patient, appointments }]) => {
      patientIndex++;
      appointments.sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
      const patientName = patient.first_name
        ? `${patient.first_name} ${patient.last_name || ''}`
        : 'Unknown Patient';
      const $patientRow = $(`
        <tr class="patient-row" style="background-color: #f8f9fa;">
          <td>${patientIndex}</td>
          <td>${patientId}</td>
          <td colspan="6"><strong>${patientName}</strong></td>
        </tr>
      `);
      $tbody.append($patientRow);

      appointments.forEach((appt) => {
        const doctorName = appt.doctor && appt.doctor.first_name
          ? `${appt.doctor.first_name} ${appt.doctor.last_name || ''}`
          : 'N/A';
        const appointmentDate = appt.appointment_date
          ? new Date(appt.appointment_date)
          : null;
        const timeStr = appointmentDate && !isNaN(appointmentDate)
          ? appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
          : 'N/A';
        const statusClass = appt.status
          ? `status-${appt.status.toLowerCase().replace(' ', '-')}`
          : 'status-unknown';
        const apptDateStr = appointmentDate
          ? `${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, '0')}-${String(appointmentDate.getDate()).padStart(2, '0')}`
          : null;
        if (apptDateStr && apptDateStr !== date) {
          console.warn(`⚠️ Appointment ID ${appt.id} date (${apptDateStr}) does not match filter date (${date})`);
        }

        let statusOptions = STATUS_CHOICES.map(choice => 
          `<option value="${choice.value}" ${appt.status === choice.value ? 'selected' : ''}>${choice.label}</option>`
        ).join('');
        const $apptRow = $(`
          <tr class="appointment-row">
            <td></td>
            <td></td>
            <td></td>
            <td>${appt.id}</td>
            <td>${timeStr}</td>
            <td class="status-cell">
              <select class="form-select form-select-sm status-select" data-appointment-id="${appt.id}" data-original-status="${appt.status}">
                ${statusOptions}
              </select>
            </td>
            <td>${doctorName}</td>
            <td>${appt.notes || 'N/A'}</td>
          </tr>
        `);
        $tbody.append($apptRow);
        totalAppointments++;

        if (!appt.patient || !appt.patient.first_name) {
          console.warn(`⚠️ Appointment ID ${appt.id} has incomplete patient data:`, appt.patient);
        }
        if (!appt.doctor) {
          console.warn(`⚠️ Appointment ID ${appt.id} has no doctor data:`, appt.doctor);
        }
      });
    });

    $('.status-select').off('change').on('change', function () {
      const $select = $(this);
      const appointmentId = $select.data('appointment-id');
      const newStatus = $select.val();
      const $row = $select.closest('tr');
      console.log(`🖱️ Status change for appointment ${appointmentId} to ${newStatus}`);
      updateAppointmentStatus(appointmentId, newStatus, $row, date);
    });

    console.log(`✅ Populated appointments table with ${totalAppointments} appointments across ${patientEntries.length} patients for ${date} (${filter})`);
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

    $("#todayBillBtn").on("click", function () {
      $("#billDate").val(new Date().toISOString().split("T")[0]);
      console.log("Bill date set to today");
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

  let selectedPatientId = null;

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

      // Determine if query is a phone number (numeric with possible + or spaces)
      const isPhoneQuery = /^\+?\d[\d\s]*$/.test(query.replace(/\s/g, ''));

      let searchUrl;
      if (isPhoneQuery) {
        // Clean phone number for search
        const cleanPhone = query.replace(/\s/g, '');
        searchUrl = `${API_BASE_URL}/patients/search/?phone=${encodeURIComponent(cleanPhone)}`;
      } else {
        searchUrl = `${API_BASE_URL}/patients/search/?query=${encodeURIComponent(query)}`;
      }

      $.ajax({
        url: searchUrl,
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
            console.log("🕳️ No patients found, showing create patient prompt");
            showCreatePatientPrompt(query, isPhoneQuery);
          }
        },
        error: function (xhr) {
          console.error("❌ Search error:", xhr.status, xhr.statusText, xhr.responseText);
          $dropdown.hide();
          showCreatePatientPrompt(query, isPhoneQuery);
        }
      });
    }, 300));

    $dropdown.on('click', 'li', function () {
      const patientId = $(this).data('patient-id');
      $searchInput.val($(this).text());
      $dropdown.hide();
      selectedPatientId = patientId;
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
        selectedPatientId = (data.patient || data).patient_id;
        populateProfileTab(data);
        $('#newActionModal').modal('show');
        $('#profileTab').tab('show');
        updateDetailsSection(data);
        // Pre-set bill patient ID for seamless transition to bill tab
        $("#patientIdForBill").val(selectedPatientId);
        sessionStorage.setItem("billPatientId", selectedPatientId);
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
  
    // Populate doctor dropdown
    const doctor = patient.primary_doctor || (appointment && appointment.doctor) || {};
    populateDoctorDropdownForProfile(doctor.id || null);
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
  
    const $profileFields = $('#profileCity, #profileAddress, #profilePin, #profileDoctor');
    $profileFields.prop('readonly', true);
    $('#profileDoctor').prop('disabled', true); // Ensure dropdown aligns with readonly state
  
    if (!$('#toggleProfileEdit').length) {
      const $editButton = $('<button class="btn btn-sm btn-outline-primary ms-2" id="toggleProfileEdit">Edit</button>');
      $('#profileCity').closest('.input-group').append($editButton);
  
      $editButton.on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
  
        const isReadonly = $profileFields.prop('readonly') || $('#profileDoctor').prop('disabled');
        $profileFields.prop('readonly', !isReadonly);
        $('#profileDoctor').prop('disabled', !isReadonly);
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
            pincode: $('#profilePin').val(),
            primary_doctor: $('#profileDoctor').val() || null
          };
          $.ajax({
            url: `${API_BASE_URL}/patients/patients/${patientId}/`,
            type: "PATCH",
            headers: getAuthHeaders(),
            data: JSON.stringify(updatedData),
            contentType: "application/json",
            success: function () {
              console.log(`✅ Updated patient ${patientId} address and doctor details`);
              alert("Details updated successfully!");
            },
            error: function (xhr) {
              console.error(`❌ Failed to update patient ${patientId}:`, xhr.responseJSON || xhr.statusText);
              alert(`Failed to update details: ${xhr.responseJSON?.error || "Unknown error"}`);
            }
          });
        }
      });
    }
  
    setupCityAutocomplete("profileCity");
  
    $('#editProfileBtn').off('click').on('click', function () {
      populateAddPatientForm(patient, appointment);
      $('#addPatientTab').tab('show');
    });
  
    $('#viewAppointmentsBtn').off('click').on('click', function () {
      alert('View Appointments functionality TBD');
    });
  
    $('#addBillFromProfileBtn').off('click').on('click', function () {
      selectedPatientId = patient.patient_id;
      $('#patientIdForBill').val(patient.patient_id || '');
      sessionStorage.setItem("billPatientId", patient.patient_id || '');
      $('#addBillsTab').tab('show');
    });
  
    console.log("✅ Profile tab populated with patient data:", patient);
  }

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

  function populateDoctorDropdownForProfile(selectedDoctorId = null) {
    const $doctorSelect = $("#profileDoctor");
    
    // Ensure the field is a select element
    if (!$doctorSelect.is("select")) {
      $doctorSelect.replaceWith(
        '<select class="form-control form-control-sm" id="profileDoctor" readonly></select>'
      );
    }
  
    $.ajax({
      url: `${API_BASE_URL}/appointments/doctors/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        const $select = $("#profileDoctor");
        $select.empty();
        $select.append('<option value="" selected>Select Doctor</option>');
  
        if (data.doctors && Array.isArray(data.doctors)) {
          data.doctors.forEach(doctor => {
            const isSelected = selectedDoctorId && doctor.id === selectedDoctorId ? "selected" : "";
            $select.append(
              `<option value="${doctor.id}" ${isSelected}>${doctor.first_name} ${doctor.last_name || ''}</option>`
            );
          });
        } else {
          console.warn("⚠️ No doctors found in response:", data);
          $select.append('<option value="">No doctors available</option>');
        }
  
        // Set readonly state to match profile fields
        $select.prop("disabled", $("#profileCity").prop("readonly"));
      },
      error: function (xhr) {
        console.error("❌ Failed to fetch doctors for profile:", xhr.responseJSON || xhr.statusText);
        $("#profileDoctor")
          .empty()
          .append('<option value="">Failed to load doctors</option>')
          .prop("disabled", true);
      }
    });
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

  function showCreatePatientPrompt(query, isPhoneQuery) {
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
      $('#addPatientForm')[0].reset();
      flatpickr("#patientDOB").clear();
      flatpickr("#maritalSince").clear();
      flatpickr("#appointmentDate").clear();

      if (isPhoneQuery) {
        $('#patientPhone').val(query.replace(/\s/g, ''));
      } else {
        const [firstName, ...lastNameParts] = query.split(' ');
        const lastName = lastNameParts.join(' ');
        $('#patientFirstName').val(firstName);
        $('#patientLastName').val(lastName);
      }

      resetModalView();
      updateDetailsSection(null);
    });

    $modal.on('hidden.bs.modal', function () {
      $modal.remove();
    });
  }

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
    if (!/^\+?\d+$/.test(phoneValue) || phoneValue.length > 15) {
      errors.push("Phone Number must be numeric and up to 15 digits (including country code).");
    }

    const mobile2Value = itiMobile2.getNumber();
    if (mobile2Value && (!/^\+?\d+$/.test(mobile2Value) || mobile2Value.length > 15)) {
      errors.push("Mobile 2 must be numeric and up to 15 digits (including country code).");
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
          selectedPatientId = newPatient.patient_id; // Update global patient ID
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
      selectedPatientId = data.patient_id; // Ensure global variable is updated
    } else if (activeButton === 'addAndCreateAppointment') {
      toggleSplitView('addPatient');
      $('#addPatientTab').tab('show');
      $('#addPatientForm')[0].reset();
      flatpickr("#patientDOB").clear();
      flatpickr("#maritalSince").clear();
      flatpickr("#appointmentDate").clear();
      $('#addPatientForm').data('patient-id', data.patient_id);
      selectedPatientId = data.patient_id; // Ensure global variable is updated
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

  $("#addServiceForm").submit(function (e) {
    e.preventDefault();
    const data = {
      service_name: $("#serviceName").val(),
      service_price: parseFloat($("#servicePrice").val()),
      code: $("#serviceCode").val(),
      color_code: $("#serviceColorCode").val(),
      owner_id: $("#serviceOwner").val() || localStorage.getItem("doctor_id") || null
    };
    console.log("Submitting add service form...", data);

    if (!data.owner_id && localStorage.getItem("user_type") !== "doctor") {
      console.error("No doctor selected and logged-in user is not a doctor.");
      alert("Please select a doctor or log in as a doctor.");
      return;
    }

    $.ajax({
      url: `${API_BASE_URL}/service/create/`,
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(data),
      contentType: "application/json",
      success: () => {
        console.log("Service added successfully");
        $(this)[0].reset();
        $("#newActionModal").modal("hide");
        alert("Service added successfully");
        fetchServices();
        populateServicesTable();
      },
      error: xhr => {
        console.error(`Failed to add service: ${xhr.responseJSON?.error || xhr.statusText}`, xhr.responseJSON);
        alert(`Failed to add service: ${xhr.responseJSON?.error || "Unknown error"}`);
      }
    });
  });

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
          code: service.code || ""
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
          const ownerName = service.owner
            ? `${service.owner.first_name || ''} ${service.owner.last_name || ''}`.trim() || 'N/A'
            : 'N/A';
          const $row = $(`
            <tr>
              <td>${index + 1}</td>
              <td>${service.service_name || service.name || 'Unknown Service'}</td>
              <td>${service.code || 'N/A'}</td>
              <td>₹${parseFloat(service.service_price || service.price || 0).toFixed(2)}</td>
              <td>
                <span style="display: inline-block; width: 20px; height: 20px; background-color: ${service.color_code || '#000000'}; border: 1px solid #ccc;"></span>
              </td>
              <td>${ownerName}</td>
            </tr>
          `);
          $tbody.append($row);
        });

        console.log(`Populated services table with ${rawServices.length} entries`);
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

  $(document).on("input", ".service-search", function () {
    const $input = $(this);
    const query = $input.val().toLowerCase().trim();
    const $dropdown = $input.closest(".input-group").find(".autocomplete-dropdown");

    populateServiceDropdown($dropdown, query ? services.filter(s => s.name && s.name.toLowerCase().includes(query)) : services);
    $dropdown.addClass("show");
  });

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

  $("#addServiceTab").on("shown.bs.tab", function () {
    populateServicesTable();
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

  function populateDoctorDropdownForBill() {
    $.ajax({
      url: `${API_BASE_URL}/appointments/doctors/list/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function (data) {
        const doctorSelect = $("#billDoctor");
        doctorSelect.empty();
        doctorSelect.append('<option value="" selected>Select Doctor</option>');
        data.doctors.forEach(doctor => {
          doctorSelect.append(`<option value="${doctor.id}">${doctor.first_name} ${doctor.last_name}</option>`);
        });
      },
      error: function () {
        alert("Failed to fetch doctors.");
      }
    });
  }

  let itemCount = 0;
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

  $(document).on("click", ".remove-bill-item", function () {
    $(this).closest("tr").remove();
    itemCount--;
    renumberBillItems();
    updateTotalBillAmount();
    updateDepositColor();
    console.log(`Removed bill item. New count: ${itemCount}`);
  });

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
                <input type="text" class="form-control" id="appointmentDateInput" required>
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
    const appointmentDatePicker = flatpickr("#appointmentDateInput", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      minDate: "today",
      defaultDate: new Date(),
      time_24hr: true,
      allowInput: true
    });
  
    const bsModal = new bootstrap.Modal(modal[0], {
      backdrop: 'static',
      keyboard: true
    });
    bsModal.show();
  
    $('#confirmAppointmentDate').on('click', function () {
      const selectedDate = appointmentDatePicker.selectedDates[0];
      if (selectedDate) {
        const formattedDate = flatpickr.formatDate(selectedDate, "Y-m-d H:i") + ":00+05:30";
        callback(formattedDate);
        bsModal.hide();
      } else {
        alert("Please select a valid date and time.");
      }
    });
  
    modal.on('hidden.bs.modal', function () {
      appointmentDatePicker.destroy();
      modal.remove();
    });
  }
  
  $("#addBillForm").submit(function (e) {
    e.preventDefault();
    console.log("📋 Submitting Add Bill Form...");
  
    const patientId = $("#patientIdForBill").val() || sessionStorage.getItem("billPatientId");
    if (!patientId) {
      alert("Please select a patient before creating a bill.");
      return;
    }
  
    const billDateInput = $("#billDate")[0]?._flatpickr?.selectedDates[0];
    const billDate = billDateInput ? flatpickr.formatDate(billDateInput, "Y-m-d") : new Date().toISOString().split("T")[0];
  
    const items = [];
    $("#billItemsTableBody tr").each(function () {
      const $row = $(this);
      const serviceId = $row.find(".service-id").val();
      const quantity = parseInt($row.find("[name='quantity[]']").val()) || 1;
      const unitPrice = parseFloat($row.find(".unit-price").val()) || 0;
      const gst = parseFloat($row.find(".gst").val()) || 0;
      const discount = parseFloat($row.find(".discount").val()) || 0;
      const totalPrice = parseFloat($row.find(".total-price").val()) || 0;
  
      if (serviceId) {
        items.push({
          service_id: serviceId,
          quantity: quantity,
          unit_price: unitPrice,
          gst_percentage: gst,
          discount: discount,
          total_price: totalPrice
        });
      }
    });
  
    if (items.length === 0) {
      alert("Please add at least one service to the bill.");
      return;
    }
  
    const billData = {
      patient_id: patientId,
      doctor_id: $("#billDoctor").val() || null,
      bill_date: billDate,
      total_amount: parseFloat($("#totalAmount").val()) || 0,
      deposit_amount: parseFloat($("#depositAmount").val()) || 0,
      payment_status: $("#paymentStatus").val() || "pending",
      notes: $("#billNotes").val(),
      items: items
    };
  
    console.log("📦 Bill Data to Submit:", billData);
  
    const activeButton = e.originalEvent?.submitter?.id || "saveBill";
    console.log(`🖱️ Bill form submitted by button: ${activeButton}`);
  
    // Disable submit buttons to prevent multiple submissions
    const $submitButtons = $("#saveBill, #saveAndCreateAppointment");
    $submitButtons.prop("disabled", true);
  
    $.ajax({
      url: `${API_BASE_URL}/billing/bills/create/`,
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(billData),
      contentType: "application/json",
      success: function (response) {
        console.log("✅ Bill created successfully:", response);
        alert("Bill created successfully!");
  
        // Reset form and clear items
        $("#addBillForm")[0].reset();
        $("#billItemsTableBody").empty();
        itemCount = 0;
        sessionStorage.removeItem("billPatientId");
  
        if (activeButton === "saveAndCreateAppointment") {
          showAppointmentDatePopup(function (appointmentDate) {
            const appointmentData = {
              patient_id: patientId,
              doctor_id: $("#billDoctor").val() || null,
              appointment_date: appointmentDate,
              notes: $("#billNotes").val(),
              is_emergency: false
            };
  
            $.ajax({
              url: `${API_BASE_URL}/appointments/create/`,
              type: "POST",
              headers: getAuthHeaders(),
              data: JSON.stringify(appointmentData),
              contentType: "application/json",
              success: function (apptResponse) {
                console.log("✅ Appointment created successfully:", apptResponse);
                alert("Appointment created successfully!");
                $("#newActionModal").modal("hide");
                fetchAppointmentsByDate();
              },
              error: function (xhr) {
                console.error("❌ Failed to create appointment:", xhr.responseJSON || xhr.statusText);
                alert(`Failed to create appointment: ${xhr.responseJSON?.error || "Unknown error"}`);
              }
            });
          });
        } else {
          // Close modal for saveBill
          $("#newActionModal").modal("hide");
        }
      },
      error: function (xhr) {
        console.error("❌ Failed to create bill:", xhr.responseJSON || xhr.statusText);
        alert(`Failed to create bill: ${xhr.responseJSON?.error || "Unknown error"}`);
      },
      complete: function () {
        // Re-enable submit buttons
        $submitButtons.prop("disabled", false);
      }
    });
  });
  
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  $("#newActionModal").on("show.bs.modal", function () {
    resetModalView();
    updateDetailsSection(null);
    populateDoctorDropdownForBill();
  });
  
  $("#newActionModal").on("hidden.bs.modal", function () {
    resetModalView();
    $("#addPatientForm")[0].reset();
    $("#addBillForm")[0].reset();
    $("#addServiceForm")[0].reset();
    $("#billItemsTableBody").empty();
    itemCount = 0;
    flatpickr("#patientDOB").clear();
    flatpickr("#maritalSince").clear();
    flatpickr("#appointmentDate").clear();
    flatpickr("#billDate").setDate(new Date());
    sessionStorage.removeItem("billPatientId");
  });
  
  $(document).on("click", "#savePatient, #addAndCreateBill, #addAndCreateAppointment", function () {
    const $form = $("#addPatientForm");
    if ($form[0].checkValidity()) {
      $form.submit();
    } else {
      $form[0].reportValidity();
    }
  });
  
  $(document).on("click", "#saveBill, #saveAndCreateAppointment", function () {
    const $form = $("#addBillForm");
    if ($form[0].checkValidity()) {
      $form.submit();
    } else {
      $form[0].reportValidity();
    }
  });
  
  $("#addBillsTab").on("shown.bs.tab", function () {
    const patientId = sessionStorage.getItem("billPatientId") || selectedPatientId;
    if (patientId) {
      $("#patientIdForBill").val(patientId);
      $.ajax({
        url: `${API_BASE_URL}/patients/patients/${patientId}/`,
        type: "GET",
        headers: getAuthHeaders(),
        success: function (data) {
          updateDetailsSection(data);
        },
        error: function () {
          console.warn("⚠️ Failed to fetch patient details for bill tab");
        }
      });
    }
    populateDoctorDropdownForBill();
  });
  
  checkAuthentication();
  bindNavFilters();
  bindDateFilterButtons();
  });