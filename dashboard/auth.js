// main.js
$(document).ready(function () {
    // if (!sessionStorage.getItem("token")) {
    //   console.warn("⚠️ No session token found. Redirecting to login...");
    //   window.location.href = "../login/login.html";
    //   return;
    // }
    
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
  
    
  
    // Initialize Flatpickr for Bill Date
    flatpickr("#billDate", {
      dateFormat: "Y-m-d",
      defaultDate: new Date(),
      allowInput: true
    });
  
    // Get Authentication Headers
    function getAuthHeaders() {
      const token = sessionStorage.getItem("token");
      return token ? { "Authorization": `Token ${token}` } : {};
    }
  
    // Authentication Check
    function checkAuthentication() {
      const token = sessionStorage.getItem("token");
      const userType = sessionStorage.getItem("user_type");
      const roleLevel = sessionStorage.getItem("role_level");
      const permissions = sessionStorage.getItem("permissions");
    
      console.log("🔍 Checking Authentication - Stored Data:", {
        token: token ? "Present" : "Missing",
        userType: userType || "Missing",
        roleLevel: roleLevel || "Missing",
        permissions: permissions ? "Present" : "Missing"
      });
    
      if (!token || !userType || !roleLevel || !permissions) {
        console.error("❌ Missing authentication data in sessionStorage:", {
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
          if (data.doctor_id) {
            sessionStorage.setItem("doctor_id", data.doctor_id);
            console.log(`👨‍⚕️ Stored Doctor ID: ${data.doctor_id}`);
          }
          adjustUIForRole(userType, roleLevel);
          if (data.doctor_code) {
            console.log(`👨‍⚕️ Updating Doctor Code: ${data.doctor_code}`);
            $(".doctor-code").text(`Doctor Code: ${data.doctor_code}`);
          }
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          fetchAppointmentsByDate(todayStr); // Explicitly fetch today's appointments
        },
        error: function (xhr) {
          console.error("❌ Authentication Error:", xhr.responseJSON || xhr.statusText);
          sessionStorage.clear();
          console.log("🗑️ Cleared sessionStorage due to authentication failure");
          alert("Authentication failed: Invalid token. Please log in again.");
          window.location.href = "../login/login.html";
        }
      });
    }
  
    // Fetch Indian Cities for Autocomplete
      /// Global variable to track city fetch status
    // Global variable to track city fetch status
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
      modalTabs.show(); // Ensure all modal tabs, including Visits, are shown by default
    
      const role = `${userType}-${roleLevel}`.toLowerCase();
      const permissions = JSON.parse(sessionStorage.getItem("permissions") || "[]");
    
      // Explicitly ensure full access for doctor-senior
      if (role === "doctor-senior") {
        console.log("✅ Granting full access to doctor-senior");
        modalTabs.show();
        $("#newActionTabContent .tab-pane").find("input, select, button, textarea").prop("disabled", false);
        console.log("🔍 Doctor-Senior Modal Tabs Visible:", modalTabs.filter(":visible").map((i, el) => $(el).text().trim()).get());
        bindLogoutEvent();
        bindModalActions();
        setupPatientSearch();
        return;
      }
    
      // Apply restrictions for other roles
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
    
      console.log("🔍 Final Nav Items Visibility:", navItems.filter(":visible").map((i, el) => $(el).text().trim()).get());
      console.log("🔍 Final Modal Tabs Visibility:", modalTabs.filter(":visible").map((i, el) => $(el).text().trim()).get());
      bindLogoutEvent();
      bindModalActions();
      setupPatientSearch();
    }
    // main.js (replace relevant sections)
    let appointmentsData = [];
    // Initialize Flatpickr for Date Filter
    flatpickr("#dateFilter", {
      dateFormat: "Y-m-d",
      defaultDate: new Date(), // Default to today
      allowInput: true,
      minDate: "1900-01-01",
      altInput: true,
      altFormat: "F j, Y", // Readable format for display
      onChange: function (selectedDates, dateStr) {
        console.log("📅 Date Filter Changed - Selected date:", dateStr);
        if (dateStr) {
          fetchAppointmentsByDate(dateStr); // Fetch appointments immediately
        }
      },
      onOpen: function (selectedDates, dateStr, instance) {
        const currentDate = dateStr || instance.formatDate(new Date(), "Y-m-d");
        $.ajax({
          url: `${API_BASE_URL}/appointments/list/?date=${currentDate}`,
          type: "GET",
          headers: getAuthHeaders(),
          success: function (data) {
            appointmentsData = Array.isArray(data.appointments) ? data.appointments : [];
            console.log(`📅 Loaded appointments for calendar:`, appointmentsData);
            instance.redraw();
          },
          error: function (xhr) {
            console.warn(`⚠️ Failed to load appointments for calendar: ${xhr.responseJSON?.error || "Unknown error"}`);
            appointmentsData = [];
            instance.redraw();
          }
        });
      },
      onDayCreate: function (dObj, dStr, fp, dayElem) {
        const date = dayElem.dateObj;
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        appointmentsData.forEach(appt => {
          if (!appt.appointment_date) return;
          const apptDate = new Date(appt.appointment_date);
          const apptDateStr = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, "0")}-${String(apptDate.getDate()).padStart(2, "0")}`;
          if (apptDateStr === dateStr) {
            const apptTime = apptDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
            dayElem.classList.add("has-appointment");
            dayElem.setAttribute("data-appointment-time", apptTime);
          }
        });
      }
    });
    console.log("🟢 Flatpickr Initialized for #dateFilter with default date: Today");
  
    // Bind Date Filter Buttons
    function bindDateFilterButtons() {
      $(".btn:contains('Set')").on("click", function () {
        const dateStr = $("#dateFilter").val();
        console.log("🖱️ Set Date Clicked:", dateStr);
        if (dateStr) {
          fetchAppointmentsByDate(dateStr);
        } else {
          alert("Please select a date.");
        }
      });
  
      $(".btn:contains('Today')").on("click", function () {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        console.log("🖱️ Today Clicked:", todayStr);
        $("#dateFilter").val(todayStr);
        flatpickr("#dateFilter").setDate(todayStr, false);
        fetchAppointmentsByDate(todayStr);
      });
  
      $("#calendarTrigger").on("click", function () {
        flatpickr("#dateFilter").open();
        console.log("🗓️ Calendar button clicked, opening date picker");
      });
    }
  
    function fetchAppointmentsByDate(dateStr = null, filter = 'all', doctorId = 'all') {
      const today = new Date();
      const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const selectedDate = dateStr || defaultDate;
    
      console.log(`📅 Fetching appointments for date: ${selectedDate}, filter: ${filter}, doctorId: ${doctorId}`);
    
      // Update #dateFilter to reflect the selected date
      $("#dateFilter").val(selectedDate);
      flatpickr("#dateFilter").setDate(selectedDate, false);
    
      // Calculate the start and end of the week
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6); // End on Saturday
    
      const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    
      // Build the API URL with date range and optional doctor filter
      let url = `${API_BASE_URL}/appointments/list/?start_date=${startDateStr}&end_date=${endDateStr}`;
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
            'all': ['booked', 'arrived', 'on-going', 'reviewed'],
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
    
          // Populate calendar view
          populateAppointmentsCalendar(appointmentsArray, startDateStr, doctorId);
    
          console.log(`✅ Fetched ${appointmentsArray.length} appointments for ${startDateStr} to ${endDateStr} with filter ${filter} and doctorId ${doctorId}`);
        },
        error: function (xhr) {
          console.error(`❌ Failed to fetch appointments: ${xhr.responseJSON?.error || "Unknown error"}`);
          alert(`Failed to fetch appointments: ${xhr.responseJSON?.error || "Unknown error"}`);
          populateAppointmentsCalendar([], startDateStr, doctorId); // Show empty calendar
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
          alert(`Failed to update status: ${xhr.responseJSON?.error || "Unknown error"}`);
          if ($row) {
            $row.find('.status-select').val($row.find('.status-select').data('original-status'));
          }
        }
      });
    }
  
  
    function showAppointmentDetails(appointmentId) {
      $.ajax({
        url: `${API_BASE_URL}/appointments/edit/${appointmentId}/`,
        type: "GET",
        headers: getAuthHeaders(),
        success: function (appt) {
          console.log(`📋 Fetched appointment details for ID ${appointmentId}:`, appt);
          const patientName = appt.patient && appt.patient.first_name
            ? `${appt.patient.first_name} ${appt.patient.last_name || ''}`
            : 'Unnamed';
          const doctorName = appt.doctor && appt.doctor.first_name
            ? `${appt.doctor.first_name} ${appt.doctor.last_name || ''}`
            : 'N/A';
          const apptDate = appt.appointment_date
            ? new Date(appt.appointment_date).toLocaleString()
            : 'N/A';
    
          // Create modal
          const modal = $(`
            <div class="modal fade" id="appointmentDetailsModal" tabindex="-1">
              <div class="modal-dialog">
                <div class="modal-content">
                  <div class="modal-header">
                    <h5 class="modal-title">Appointment Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                  </div>
                  <div class="modal-body">
                    <p><strong>Patient:</strong> ${patientName}</p>
                    <p><strong>Doctor:</strong> ${doctorName}</p>
                    <p><strong>Date & Time:</strong> ${apptDate}</p>
                    <p><strong>Status:</strong> 
                      <select class="form-select status-select" data-appointment-id="${appt.id}">
                        <option value="booked" ${appt.status.toLowerCase() === 'booked' ? 'selected' : ''}>Booked</option>
                        <option value="arrived" ${appt.status.toLowerCase() === 'arrived' ? 'selected' : ''}>Arrived</option>
                        <option value="on-going" ${appt.status.toLowerCase() === 'on-going' ? 'selected' : ''}>On-Going</option>
                        <option value="reviewed" ${appt.status.toLowerCase() === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                      </select>
                    </p>
                    <p><strong>Notes:</strong> ${appt.notes || 'N/A'}</p>
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
    
          // Bind status change
          modal.find('.status-select').on('change', function () {
            const newStatus = $(this).val();
            updateAppointmentStatus(appointmentId, newStatus, null, null, () => {
              // Refresh calendar
              const dateStr = $("#dateFilter").val();
              const doctorFilter = $("#doctorFilter").val();
              fetchAppointmentsByDate(dateStr, 'all', doctorFilter);
            });
          });
    
          modal.on('hidden.bs.modal', function () {
            modal.remove();
          });
        },
        error: function (xhr) {
          console.error(`❌ Failed to fetch appointment ${appointmentId}:`, xhr.responseJSON || xhr.statusText);
          alert(`Failed to fetch appointment details: ${xhr.responseJSON?.error || "Unknown error"}`);
        }
      });
    }
    
    // Populate Appointments Table
    function populateAppointmentsCalendar(appointments, weekStartDateStr, doctorId = 'all') {
      const calendarBody = document.getElementById("calendarBody");
      const calendarHeader = document.querySelector(".calendar-header");
      calendarBody.innerHTML = "";
      calendarHeader.innerHTML = "<div>Time</div>"; // Reset header
    
      // Parse week start date
      const weekStart = new Date(weekStartDateStr);
      if (isNaN(weekStart)) {
        console.error("Invalid weekStartDateStr:", weekStartDateStr);
        calendarBody.innerHTML = '<div class="text-center">Invalid date selected.</div>';
        return;
      }
    
      // Define hours (8 AM to 8 PM)
      const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 to 20:00
    
      // Define days (Sunday to Saturday)
      const days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        return {
          dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          display: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]} ${date.getDate()}/${date.getMonth() + 1}`
        };
      });
    
      // Populate header with days
      days.forEach(day => {
        const headerCell = document.createElement("div");
        headerCell.innerText = day.display;
        calendarHeader.appendChild(headerCell);
      });
    
      // Get logged-in doctor's ID from sessionStorage
      const loggedInDoctorId = sessionStorage.getItem("doctor_id");
      console.log(`🔍 Logged-in Doctor ID: ${loggedInDoctorId}, Requested Doctor ID: ${doctorId}`);
    
      // Filter appointments by doctor
      let filteredAppointments = appointments;
      if (doctorId !== 'all') {
        filteredAppointments = appointments.filter(appt => 
          appt.doctor && appt.doctor.id == doctorId
        );
      } else if (loggedInDoctorId && loggedInDoctorId !== 'null') {
        // If no specific doctorId is provided and user is a doctor, show only their appointments
        filteredAppointments = appointments.filter(appt => 
          appt.doctor && appt.doctor.id == loggedInDoctorId
        );
        console.log(`🔍 Filtering for logged-in doctor's appointments (ID: ${loggedInDoctorId})`);
      }
    
      // Early check for no appointments
      if (filteredAppointments.length === 0) {
        calendarBody.innerHTML = `<div class="text-center">No appointments found for ${doctorId === 'all' && loggedInDoctorId ? 'your schedule' : doctorId === 'all' ? 'the selected week' : 'this doctor'}.</div>`;
        console.log(`ℹ️ No appointments to display for week starting ${weekStartDateStr}, doctorId: ${doctorId}`);
        return;
      }
    
      // Log filtered appointments for debugging
      console.log(`📅 Filtered appointments (${filteredAppointments.length}):`, filteredAppointments);
    
      // Populate calendar rows
      hours.forEach(hour => {
        const row = document.createElement("div");
        row.classList.add("calendar-row");
    
        // Time label
        const hourLabel = document.createElement("div");
        hourLabel.innerText = `${hour}:00`;
        row.appendChild(hourLabel);
    
        // Slots for each day
        days.forEach(day => {
          const slot = document.createElement("div");
          slot.classList.add("calendar-slot");
          slot.style.position = "relative"; // Ensure relative positioning for appointment blocks
          slot.style.overflowY = "auto"; // Allow scrolling for multiple appointments
          slot.style.maxHeight = "60px"; // Limit height to prevent overlap
    
          // Find appointments for this day and hour
          const slotAppointments = filteredAppointments.filter(appt => {
            if (!appt || !appt.appointment_date) {
              console.warn(`⚠️ Invalid appointment:`, appt);
              return false;
            }
    
            // Parse appointment date, assuming it's in ISO format (e.g., "2025-04-24T08:00:00+05:30")
            const apptDate = new Date(appt.appointment_date);
            if (isNaN(apptDate)) {
              console.warn(`⚠️ Invalid appointment_date for ID ${appt.id}:`, appt.appointment_date);
              return false;
            }
    
            // Extract date in YYYY-MM-DD format
            const apptDateStr = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}-${String(apptDate.getDate()).padStart(2, '0')}`;
    
            // Check if date matches
            if (apptDateStr !== day.dateStr) return false;
    
            // Get hours and minutes
            const apptHour = apptDate.getHours();
            const apptMinute = apptDate.getMinutes();
    
            // Match appointments within the hour (e.g., 8:00–8:59)
            const isInHour = apptHour === hour;
    
            console.log(`🔍 Checking appointment ID ${appt.id}: Date=${apptDateStr}, Hour=${apptHour}:${apptMinute}, Matches=${isInHour ? 'Yes' : 'No'}`);
    
            return isInHour;
          });
    
          // Add appointment blocks
          slotAppointments.forEach((appt, index) => {
            const block = document.createElement("div");
            block.classList.add("appointment-block");
            block.dataset.appointmentId = appt.id;
    
            // Stack appointments vertically with slight offset
            block.style.marginTop = `${index * 22}px`; // Adjust based on block height
            block.style.zIndex = index + 1; // Ensure later blocks are on top
    
            const patientName = appt.patient && appt.patient.first_name
              ? `${appt.patient.first_name} ${appt.patient.last_name || ''}`
              : 'Unnamed';
            const statusClass = appt.status ? `status-${appt.status.toLowerCase().replace(' ', '-')}` : 'status-unknown';
    
            // Format appointment time for display
            const apptTime = new Date(appt.appointment_date).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
    
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
    
      // Add click event for appointment blocks
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
});
