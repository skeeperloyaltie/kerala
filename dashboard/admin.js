$(document).ready(function () {
    const API_BASE_URL = "http://smarthospitalmaintain.com:8000";
  
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
        redirectToLogin();
        return;
      }
      $.ajax({
        url: `${API_BASE_URL}/users/profile/`,
        type: "GET",
        headers: getAuthHeaders(),
        success: function (data) {
          if (data.is_superuser || data.user_type === "Admin") {
            $("#usernameDisplay").text(data.username);
            localStorage.setItem("user_id", data.id);
            adjustUIForAdmin();
            fetchUsers(); // Initial load
          } else {
            alert("Access denied: Admin rights required.");
            redirectToLogin();
          }
        },
        error: redirectToLogin
      });
    }
  
    function redirectToLogin() {
      localStorage.clear();
      window.location.href = "../login/login.html";
    }
  
    // Adjust UI for Admin
    function adjustUIForAdmin() {
      $(".navbar-secondary .nav-link").on("click", function (e) {
        e.preventDefault();
        const section = $(this).data("section");
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
        }
      });
  
      $("[data-toggle='form']").on("click", function () {
        const formId = $(this).data("form");
        $(`#${formId}`).collapse("toggle");
      });
  
      bindFormSubmissions();
      bindLogoutEvent();
      setupSearch();
      $("#todayBtn").on("click", () => $("#dateFilter").val(new Date().toISOString().split("T")[0]).trigger("change"));
    }
  
    // Fetch Functions
    function fetchUsers() {
      $.ajax({
        url: `${API_BASE_URL}/users/list/`,
        headers: getAuthHeaders(),
        success: data => populateTable("usersTableBody", data, userColumns),
        error: () => alert("Failed to fetch users.")
      });
    }
  
    function fetchPatients() {
      $.ajax({
        url: `${API_BASE_URL}/patients/list/`,
        headers: getAuthHeaders(),
        success: data => populateTable("patientsTableBody", data.results || data, patientColumns),
        error: () => alert("Failed to fetch patients.")
      });
      populateDoctorSelect();
    }
  
    function fetchAppointments() {
      $.ajax({
        url: `${API_BASE_URL}/appointments/list/`,
        headers: getAuthHeaders(),
        success: data => populateTable("appointmentsTableBody", data, appointmentColumns),
        error: () => alert("Failed to fetch appointments.")
      });
      populatePatientSelect();
      populateDoctorSelect();
    }
  
    function fetchVitals() {
      $.ajax({
        url: `${API_BASE_URL}/vitals/list/`,
        headers: getAuthHeaders(),
        success: data => populateTable("vitalsTableBody", data, vitalsColumns),
        error: () => alert("Failed to fetch vitals.")
      });
      populateAppointmentSelect();
    }
  
    function fetchGroups() {
      $.ajax({
        url: `${API_BASE_URL}/groups/list/`,
        headers: getAuthHeaders(),
        success: data => populateTable("groupsTableBody", data, groupColumns),
        error: () => alert("Failed to fetch groups.")
      });
    }
  
    function fetchLogs() {
      $.ajax({
        url: `${API_BASE_URL}/monitor/logs/`,
        headers: getAuthHeaders(),
        success: data => populateTable("logsTableBody", data, logColumns),
        error: () => alert("Failed to fetch logs.")
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
      if (!data.length) $tbody.append("<tr><td colspan='100' class='text-center'>No data found</td></tr>");
      data.forEach((item, index) => {
        const cols = columnFn(item);
        const $row = $(`<tr><td>${index + 1}</td>${cols.map(col => `<td>${col}</td>`).join("")}</tr>`);
        $tbody.append($row);
      });
    }
  
    // Populate Selects
    function populateDoctorSelect() {
      $.ajax({
        url: `${API_BASE_URL}/users/list/?user_type=Doctor`,
        headers: getAuthHeaders(),
        success: data => {
          const $select = $("#doctorSelect, #primaryDoctorSelect");
          $select.empty().append("<option value='' disabled selected>Select Doctor</option>");
          data.forEach(doc => $select.append(`<option value="${doc.id}">${doc.username}</option>`));
        }
      });
    }
  
    function populatePatientSelect() {
      $.ajax({
        url: `${API_BASE_URL}/patients/list/`,
        headers: getAuthHeaders(),
        success: data => {
          const $select = $("#patientSelect");
          $select.empty().append("<option value='' disabled selected>Select Patient</option>");
          data.results.forEach(p => $select.append(`<option value="${p.patient_id}">${p.first_name} ${p.last_name || ""}</option>`));
        }
      });
    }
  
    function populateAppointmentSelect() {
      $.ajax({
        url: `${API_BASE_URL}/appointments/list/`,
        headers: getAuthHeaders(),
        success: data => {
          const $select = $("#appointmentSelect");
          $select.empty().append("<option value='' disabled selected>Select Appointment</option>");
          data.forEach(a => $select.append(`<option value="${a.id}">${a.patient.first_name} - ${a.appointment_date}</option>`));
        }
      });
    }
  
    // Form Submissions
    function bindFormSubmissions() {
      $("#userForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        $.ajax({
          url: id ? `${API_BASE_URL}/users/${id}/` : `${API_BASE_URL}/users/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => { fetchUsers(); $(this)[0].reset(); $(this).closest(".collapse").collapse("hide"); },
          error: xhr => alert(`Failed to ${id ? "update" : "create"} user: ${xhr.responseJSON?.error || "Unknown error"}`)
        });
      });
  
      $("#patientForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        $.ajax({
          url: id ? `${API_BASE_URL}/patients/patients/${id}/` : `${API_BASE_URL}/patients/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => { fetchPatients(); $(this)[0].reset(); $(this).closest(".collapse").collapse("hide"); },
          error: xhr => alert(`Failed to ${id ? "update" : "create"} patient: ${xhr.responseJSON?.error || "Unknown error"}`)
        });
      });
  
      $("#appointmentForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        data.is_emergency = data.is_emergency === "on";
        $.ajax({
          url: id ? `${API_BASE_URL}/appointments/${id}/` : `${API_BASE_URL}/appointments/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => { fetchAppointments(); $(this)[0].reset(); $(this).closest(".collapse").collapse("hide"); },
          error: xhr => alert(`Failed to ${id ? "update" : "create"} appointment: ${xhr.responseJSON?.error || "Unknown error"}`)
        });
      });
  
      $("#vitalsForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        $.ajax({
          url: id ? `${API_BASE_URL}/vitals/${id}/` : `${API_BASE_URL}/vitals/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => { fetchVitals(); $(this)[0].reset(); $(this).closest(".collapse").collapse("hide"); },
          error: xhr => alert(`Failed to ${id ? "update" : "create"} vitals: ${xhr.responseJSON?.error || "Unknown error"}`)
        });
      });
  
      $("#groupForm").submit(function (e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        const id = $(this).data("id");
        $.ajax({
          url: id ? `${API_BASE_URL}/groups/${id}/` : `${API_BASE_URL}/groups/create/`,
          type: id ? "PATCH" : "POST",
          headers: getAuthHeaders(),
          data: JSON.stringify(data),
          contentType: "application/json",
          success: () => { fetchGroups(); $(this)[0].reset(); $(this).closest(".collapse").collapse("hide"); },
          error: xhr => alert(`Failed to ${id ? "update" : "create"} group: ${xhr.responseJSON?.error || "Unknown error"}`)
        });
      });
  
      $(document).on("click", "[data-action]", function () {
        const action = $(this).data("action");
        const id = $(this).data("id");
        const $form = $(`#${action.split("-")[1]}Form`);
        if (action.startsWith("edit-")) {
          $.ajax({
            url: `${API_BASE_URL}/${action.split("-")[1]}s/${id}/`,
            headers: getAuthHeaders(),
            success: data => {
              $form.data("id", id).find(":input").each(function () {
                const name = $(this).attr("name");
                if (data[name]) $(this).val(data[name]);
              });
              $form.collapse("show");
            },
            error: () => alert("Failed to load data for editing.")
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
        $.ajax({
          url: urlMap[section],
          headers: getAuthHeaders(),
          success: data => populateTable(`${section}TableBody`, data, window[`${section}Columns`]),
          error: () => alert(`Failed to fetch ${section} by date.`)
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
          $.ajax({
            url: urlMap[section],
            headers: getAuthHeaders(),
            success: data => populateTable(`${section}TableBody`, data.results || data, window[`${section}Columns`]),
            error: () => alert(`Failed to search ${section}.`)
          });
        }
      }, 300));
    }
  
    // Logout
    function bindLogoutEvent() {
      $("#logoutBtn").on("click", function (e) {
        e.preventDefault();
        $.ajax({
          url: `${API_BASE_URL}/users/logout/`,
          type: "POST",
          headers: getAuthHeaders(),
          success: redirectToLogin,
          error: redirectToLogin
        });
      });
    }
  
    // Serialize Object Helper
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
      return radiofrequency;
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
    checkAuthentication();
  });