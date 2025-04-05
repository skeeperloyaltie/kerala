$(document).ready(function () {
    const API_BASE_URL = "http://smarthospitalmaintain.com:8000";
  
    // Logger Setup
    const log = {
      info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
      warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
      error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`)
    };
  
    // Initialize Flatpickr
    flatpickr("#dateFilter", { dateFormat: "Y-m-d", defaultDate: new Date(), onChange: fetchDataByDate });
    flatpickr("input[name='date_of_birth']", { dateFormat: "Y-m-d" });
    flatpickr("input[name='appointment_date']", { enableTime: true, dateFormat: "Y-m-d H:i" });
  
    // Authentication Headers
    function getAuthHeaders() {
      return { "Authorization": `Token ${localStorage.getItem("token")}` };
    }
  
    // Authentication Check
    function checkAuthentication() {
      const token = localStorage.getItem("token");
      if (!token) {
        log.warn("No token found, redirecting to login.");
        redirectToLogin();
        return;
      }
      log.info("Checking authentication...");
      $.ajax({
        url: `${API_BASE_URL}/users/profile/`,
        type: "GET",
        headers: getAuthHeaders(),
        success: function (data) {
          if (data.is_superuser || data.user_type === "Admin") {
            log.info(`User ${data.username} authenticated as ${data.is_superuser ? "Superuser" : "Admin"}`);
            $("#usernameDisplay").text(data.username);
            localStorage.setItem("user_id", data.id);
            adjustUIForAdmin();
            fetchUsers(); // Initial load
          } else {
            log.warn(`Access denied for user ${data.username}: Admin rights required.`);
            alert("Access denied: Admin rights required.");
            redirectToLogin();
          }
        },
        error: function (xhr) {
          log.error(`Authentication check failed: ${xhr.status} - ${xhr.statusText}`);
          redirectToLogin();
        }
      });
    }
  
    function redirectToLogin() {
      log.info("Redirecting to login page.");
      localStorage.clear();
      window.location.href = "../login/login.html";
    }
  
    // Adjust UI for Admin
    function adjustUIForAdmin() {
      log.info("Adjusting UI for admin.");
      $(".navbar-secondary .nav-link").on("click", function (e) {
        e.preventDefault();
        const section = $(this).data("section");
        log.info(`Section clicked: ${section}`);
        $(".section").hide();
        $(`#${section}Section`).show();
        $(".navbar-secondary .nav-link").removeClass("active");
        $(this).addClass("active");
        switch (section) {
          case "users": fetchUsers(); break;
          case "patients": fetchPatients(); break;
          case "appointments": fetchAppointments(); break;
          case "vitals": fetchVitals(); break;
          case "groups": fetchGroups(); break;
          case "logs": fetchLogs(); break;
          default: log.warn(`Unknown section: ${section}`);
        }
      });
  
      $("[data-toggle='form']").on("click", function () {
        const formId = $(this).data("form");
        log.info(`Toggling form: ${formId}`);
        $(`#${formId}`).collapse("toggle");
      });
  
      bindFormSubmissions();
      bindLogoutEvent();
      setupSearch();
      $("#todayBtn").on("click", () => {
        log.info("Today button clicked.");
        $("#dateFilter").val(new Date().toISOString().split("T")[0]).trigger("change");
      });
    }
  
    // Fetch Functions with Logging
    function fetchUsers() {
      log.info("Fetching users...");
      $.ajax({
        url: `${API_BASE_URL}/users/list/`,
        headers: getAuthHeaders(),
        success: data => {
          log.info(`Fetched ${data.length} users.`);
          populateTable("usersTableBody", data, userColumns);
        },
        error: xhr => log.error(`Failed to fetch users: ${xhr.status} - ${xhr.statusText}`)
      });
    }
  
    function fetchPatients() {
      log.info("Fetching patients...");
      $.ajax({
        url: `${API_BASE_URL}/patients/list/`,
        headers: getAuthHeaders(),
        success: data => {
          log.info(`Fetched ${data.results ? data.results.length : data.length} patients.`);
          populateTable("patientsTableBody", data.results || data, patientColumns);
        },
        error: xhr => log.error(`Failed to fetch patients: ${xhr.status} - ${xhr.statusText}`)
      });
      populateDoctorSelect();
    }
  
    function fetchAppointments() {
      log.info("Fetching appointments...");
      $.ajax({
        url: `${API_BASE_URL}/appointments/list/`,
        headers: getAuthHeaders(),
        success: data => {
          log.info(`Fetched ${data.length} appointments.`);
          populateTable("appointmentsTableBody", data, appointmentColumns);
        },
        error: xhr => log.error(`Failed to fetch appointments: ${xhr.status} - ${xhr.statusText}`)
      });
      populatePatientSelect();
      populateDoctorSelect();
    }
  
    function fetchVitals() {
      log.info("Fetching vitals...");
      $.ajax({
        url: `${API_BASE_URL}/vitals/list/`,
        headers: getAuthHeaders(),
        success: data => {
          log.info(`Fetched ${data.length} vitals.`);
          populateTable("vitalsTableBody", data, vitalsColumns);
        },
        error: xhr => log.error(`Failed to fetch vitals: ${xhr.status} - ${xhr.statusText}`)
      });
      populateAppointmentSelect();
    }
  
    function fetchGroups() {
      log.info("Fetching groups...");
      $.ajax({
        url: `${API_BASE_URL}/groups/list/`,
        headers: getAuthHeaders(),
        success: data => {
          log.info(`Fetched ${data.length} groups.`);
          populateTable("groupsTableBody", data, groupColumns);
        },
        error: xhr => log.error(`Failed to fetch groups: ${xhr.status} - ${xhr.statusText}`)
      });
    }
  
    function fetchLogs() {
      log.info("Fetching logs...");
      $.ajax({
        url: `${API_BASE_URL}/monitor/logs/`,
        headers: getAuthHeaders(),
        success: data => {
          log.info(`Fetched ${data.length} logs.`);
          populateTable("logsTableBody", data, logColumns);
        },
        error: xhr => log.error(`Failed to fetch logs: ${xhr.status} - ${xhr.statusText}`)
      });
    }
  
    // Table Columns
    const userColumns = user => [
      user.id, user.username, user.user_type || "N/A", user.role_level || "N/A", user.first_name || "N/A", user.last_name || "N/A",
      `<button class="btn btn-sm btn-primary" data-id="${user.id}" data-action="edit-user">Edit</button>`
    ];
  
    const patientColumns = patient => [
      patient.id, patient.patient_id, `${patient.first_name} ${patient.last_name || ""}`, patient.gender, patient.age || "N/A", patient.mobile_number,
      `<button class="btn btn-sm btn-primary" data-id="${patient.patient_id}" data-action="edit-patient">Edit</button>`
    ];
  
    const appointmentColumns = appt => [
      appt.id, appt.id, `${appt.patient.first_name} ${appt.patient.last_name || ""}`, appt.doctor.user.username, appt.appointment_date, appt.status,
      `<button class="btn btn-sm btn-primary" data-id="${appt.id}" data-action="edit-appointment">Edit</button>`
    ];
  
    const vitalsColumns = vital => [
      vital.id, vital.appointment.id, vital.blood_pressure || "N/A", vital.heart_rate || "N/A", vital.temperature || "N/A", vital.height || "N/A", vital.weight || "N/A", vital.oxygen_saturation || "N/A",
      `<button class="btn btn-sm btn-primary" data-id="${vital.id}" data-action="edit-vital">Edit</button>`
    ];
  
    const groupColumns = group => [
      group.id, group.name, group.permissions.join(", ") || "None",
      `<button class="btn btn-sm btn-primary" data-id="${group.id}" data-action="edit-group">Edit</button>`
    ];
  
    const logColumns = log => [
      log.id, log.user?.username || "N/A", log.action || log.user_agent, log.timestamp || log.login_time
    ];
  
    // Populate Table
    function populateTable(tbodyId, data, columnFn) {
      const $tbody = $(`#${tbodyId}`);
      $tbody.empty();
      if (!data.length) {
        $tbody.append("<tr><td colspan='100' class='text-center'>No data found</td></tr>");
        log.info(`No data found for ${tbodyId}`);
      }
      data.forEach((item, index) => {
        const cols = columnFn(item);
        const $row = $(`<tr><td>${index + 1}</td>${cols.map(col => `<td>${col}</td>`).join("")}</tr>`);
        $tbody.append($row);
      });
      log.info(`Populated table ${tbodyId} with ${data.length} rows`);
    }
  
    // Populate Selects with Logging
    function populateDoctorSelect() {
      log.info("Populating doctor select...");
      $.ajax({
        url: `${API_BASE_URL}/users/list/?user_type=Doctor`,
        headers: getAuthHeaders(),
        success: data => {
          const $select = $("#doctorSelect, #primaryDoctorSelect");
          $select.empty().append("<option value='' disabled selected>Select Doctor</option>");
          data.forEach(doc => $select.append(`<option value="${doc.id}">${doc.username}</option>`));
          log.info(`Populated doctor select with ${data.length} options`);
        },
        error: xhr => log.error(`Failed to populate doctor select: ${xhr.status}`)
      });
    }
  
    function populatePatientSelect() {
      log.info("Populating patient select...");
      $.ajax({
        url: `${API_BASE_URL}/patients/list/`,
        headers: getAuthHeaders(),
        success: data => {
          const $select = $("#patientSelect");
          $select.empty().append("<option value='' disabled selected>Select Patient</option>");
          data.results.forEach(p => $select.append(`<option value="${p.patient_id}">${p.first_name} ${p.last_name || ""}</option>`));
          log.info(`Populated patient select with ${data.results.length} options`);
        },
        error: xhr => log.error(`Failed to populate patient select: ${xhr.status}`)
      });
    }
  
    function populateAppointmentSelect() {
      log.info("Populating appointment select...");
      $.ajax({
        url: `${API_BASE_URL}/appointments/list/`,
        headers: getAuthHeaders(),
        success: data => {
          const $select = $("#appointmentSelect");
          $select.empty().append("<option value='' disabled selected>Select Appointment</option>");
          data.forEach(a => $select.append(`<option value="${a.id}">${a.patient.first_name} - ${a.appointment_date}</option>`));
          log.info(`Populated appointment select with ${data.length} options`);
        },
        error: xhr => log.error(`Failed to populate appointment select: ${xhr.status}`)
      });
    }
  
    // Form Submissions with Logging
    function bindFormSubmissions() {
      $("#userForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        log.info(`Submitting user form: ${id ? "Update" : "Create"} ID=${id || "new"}`);
        $.ajax({
          url: id ? `${API_BASE_URL}/users/${id}/` : `${API_BASE_URL}/users/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => {
            log.info(`User ${id ? "updated" : "created"} successfully`);
            fetchUsers();
            $(this)[0].reset();
            $(this).closest(".collapse").collapse("hide");
          },
          error: xhr => log.error(`Failed to ${id ? "update" : "create"} user: ${xhr.responseJSON?.error || xhr.statusText}`)
        });
      });
  
      $("#patientForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        log.info(`Submitting patient form: ${id ? "Update" : "Create"} ID=${id || "new"}`);
        $.ajax({
          url: id ? `${API_BASE_URL}/patients/patients/${id}/` : `${API_BASE_URL}/patients/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => {
            log.info(`Patient ${id ? "updated" : "created"} successfully`);
            fetchPatients();
            $(this)[0].reset();
            $(this).closest(".collapse").collapse("hide");
          },
          error: xhr => log.error(`Failed to ${id ? "update" : "create"} patient: ${xhr.responseJSON?.error || xhr.statusText}`)
        });
      });
  
      $("#appointmentForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        data.is_emergency = data.is_emergency === "on";
        log.info(`Submitting appointment form: ${id ? "Update" : "Create"} ID=${id || "new"}`);
        $.ajax({
          url: id ? `${API_BASE_URL}/appointments/${id}/` : `${API_BASE_URL}/appointments/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => {
            log.info(`Appointment ${id ? "updated" : "created"} successfully`);
            fetchAppointments();
            $(this)[0].reset();
            $(this).closest(".collapse").collapse("hide");
          },
          error: xhr => log.error(`Failed to ${id ? "update" : "create"} appointment: ${xhr.responseJSON?.error || xhr.statusText}`)
        });
      });
  
      $("#vitalsForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        log.info(`Submitting vitals form: ${id ? "Update" : "Create"} ID=${id || "new"}`);
        $.ajax({
          url: id ? `${API_BASE_URL}/vitals/${id}/` : `${API_BASE_URL}/vitals/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => {
            log.info(`Vitals ${id ? "updated" : "created"} successfully`);
            fetchVitals();
            $(this)[0].reset();
            $(this).closest(".collapse").collapse("hide");
          },
          error: xhr => log.error(`Failed to ${id ? "update" : "create"} vitals: ${xhr.responseJSON?.error || xhr.statusText}`)
        });
      });
  
      $("#groupForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        log.info(`Submitting group form: ${id ? "Update" : "Create"} ID=${id || "new"}`);
        $.ajax({
          url: id ? `${API_BASE_URL}/groups/${id}/` : `${API_BASE_URL}/groups/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => {
            log.info(`Group ${id ? "updated" : "created"} successfully`);
            fetchGroups();
            $(this)[0].reset();
            $(this).closest(".collapse").collapse("hide");
          },
          error: xhr => log.error(`Failed to ${id ? "update" : "create"} group: ${xhr.responseJSON?.error || xhr.statusText}`)
        });
      });
  
      $(document).on("click", "[data-action]", function () {
        const action = $(this).data("action");
        const id = $(this).data("id");
        const $form = $(`#${action.split("-")[1]}Form`);
        if (action.startsWith("edit-")) {
          log.info(`Editing ${action.split("-")[1]} with ID=${id}`);
          $.ajax({
            url: `${API_BASE_URL}/${action.split("-")[1]}s/${id}/`,
            headers: getAuthHeaders(),
            success: data => {
              $form.data("id", id).find(":input").each(function () {
                const name = $(this).attr("name");
                if (data[name]) $(this).val(data[name]);
              });
              $form.collapse("show");
              log.info(`Loaded data for editing ${action.split("-")[1]} ID=${id}`);
            },
            error: xhr => log.error(`Failed to load data for editing ${action.split("-")[1]}: ${xhr.status}`)
          });
        }
      });
    }
  
    // Fetch Data by Date
    function fetchDataByDate(selectedDates, dateStr) {
      const section = $(".navbar-secondary .nav-link.active").data("section");
      const urlMap = {
        appointments: `${API_BASE_URL}/appointments/list/?date=${dateStr}`,
        vitals: `${API_BASE_URL}/vitals/list/?date=${dateStr}`
      };
      if (urlMap[section]) {
        log.info(`Fetching ${section} for date: ${dateStr}`);
        $.ajax({
          url: urlMap[section],
          headers: getAuthHeaders(),
          success: data => populateTable(`${section}TableBody`, data, window[`${section}Columns`]),
          error: xhr => log.error(`Failed to fetch ${section} by date: ${xhr.status}`)
        });
      }
    }
  
    // Search
    function setupSearch() {
      $("#globalSearch").on("input", debounce(function () {
        const query = $(this).val().trim();
        if (query.length < 1) return;
        const section = $(".navbar-secondary .nav-link.active").data("section");
        const urlMap = {
          users: `${API_BASE_URL}/users/search/?query=${query}`,
          patients: `${API_BASE_URL}/patients/search/?query=${query}`,
          appointments: `${API_BASE_URL}/appointments/search/?query=${query}`
        };
        if (urlMap[section]) {
          log.info(`Searching ${section} with query: ${query}`);
          $.ajax({
            url: urlMap[section],
            headers: getAuthHeaders(),
            success: data => populateTable(`${section}TableBody`, data.results || data, window[`${section}Columns`]),
            error: xhr => log.error(`Failed to search ${section}: ${xhr.status}`)
          });
        }
      }, 300));
    }
  
    // Logout
    function bindLogoutEvent() {
      $("#logoutBtn").on("click", function (e) {
        e.preventDefault();
        log.info("Logout initiated.");
        $.ajax({
          url: `${API_BASE_URL}/users/logout/`,
          type: "POST",
          headers: getAuthHeaders(),
          success: () => log.info("Logout successful."),
          error: xhr => log.error(`Logout failed: ${xhr.status}`),
          complete: redirectToLogin
        });
      });
    }
  
    // Serialize Object Helper (Fixed Typo)
    $.fn.serializeObject = function () {
      const o = {};
      const a = this.serializeArray();
      $.each(a, function () {
        if (o[this.name] !== undefined) {
          if (!o[this.name].push) o[this.name] = [o[this.name]];
          o[this.name].push(this.value || "");
        } else {
          o[this.name] = this.value || "";
        }
      });
      return o; // Fixed from 'radiofrequency' to 'o'
    };
  
    // Debounce
    function debounce(func, wait) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
  
    // Initialize
    log.info("Initializing admin dashboard...");
    checkAuthentication();
  });