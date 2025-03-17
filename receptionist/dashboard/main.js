// Ensure this is defined globally before any function that uses it
function initializeDatePickers() {
    $(".custom-datetime-picker").each(function() {
      const $input = $(this);
      if (!$input.length) return; // Prevent initializing on non-existing elements
  
      const inputId = $input.attr("id");
      const isDateOnly = inputId === "searchDob" || inputId === "searchDate" || inputId === "patientDob" || inputId === "dateOfBirth" || inputId === "editDateOfBirth";
      const isEditDob = inputId === "editDateOfBirth";
  
      // Base configuration
      let config = {
        altInput: true,
        altFormat: isDateOnly ? "F j, Y" : "F j, Y, h:i K", // Readable format
        dateFormat: isDateOnly ? "Y-m-d" : "Y-m-d H:i",     // Backend format
        enableTime: !isDateOnly,
        time_24hr: false,
        minDate: inputId === "appointmentDate" || inputId === "editAppointmentDate" || inputId === "newAppointmentDate" ? "today" : null,
        maxDate: inputId === "dateOfBirth" || inputId === "editDateOfBirth" || inputId === "patientDob" ? "today" : null,
        appendTo: document.body,
        position: "auto",
        onOpen: function(selectedDates, dateStr, instance) {
          const calendar = instance.calendarContainer;
          const inputRect = $input[0].getBoundingClientRect();
          const calendarRect = calendar.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
  
          calendar.style.top = "";
          calendar.style.left = "";
          calendar.style.bottom = "";
          calendar.style.right = "";
  
          if (inputRect.bottom + calendarRect.height > viewportHeight) {
            calendar.style.top = "auto";
            calendar.style.bottom = (viewportHeight - inputRect.top) + "px";
          } else {
            calendar.style.top = inputRect.bottom + "px";
            calendar.style.bottom = "auto";
          }
  
          if (inputRect.left + calendarRect.width > viewportWidth) {
            calendar.style.left = "auto";
            calendar.style.right = (viewportWidth - inputRect.right) + "px";
          } else {
            calendar.style.left = inputRect.left + "px";
            calendar.style.right = "auto";
          }
        },
        onReady: function(selectedDates, dateStr, instance) {
          if (isEditDob) return; // Skip buttons for readonly editDateOfBirth
  
          // Add confirm and clear buttons
          const buttonContainer = document.createElement("div");
          buttonContainer.style.display = "flex";
          buttonContainer.style.justifyContent = "center";
          buttonContainer.style.gap = "10px";
          buttonContainer.style.padding = "5px";
  
          const confirmButton = document.createElement("button");
          confirmButton.innerText = "OK";
          confirmButton.className = "flatpickr-confirm";
          confirmButton.onclick = function() {
            if (selectedDates.length > 0) {
              instance.close();
              $input.removeClass("is-invalid");
            } else {
              instance.close();
            }
          };
  
          const clearButton = document.createElement("button");
          clearButton.innerText = "Clear";
          clearButton.className = "flatpickr-clear";
          clearButton.onclick = function() {
            instance.clear();
            $input.val("");
            $input.removeClass("is-invalid");
            instance.close();
          };
  
          buttonContainer.appendChild(confirmButton);
          buttonContainer.appendChild(clearButton);
          instance.calendarContainer.appendChild(buttonContainer);
  
          // Add months dropdown
          if (!instance.monthsDropdownContainer) {
            instance.monthsDropdownContainer = document.createElement("div");
            instance.monthsDropdownContainer.className = "flatpickr-months";
            instance.innerContainer.insertBefore(
              instance.monthsDropdownContainer,
              instance.daysContainer
            );
          }
        },
        onClose: function(selectedDates, dateStr, instance) {
          if (!isEditDob && selectedDates.length === 0) {
            $input.val("");
          }
        }
      };
  
      if (isEditDob) {
        const dobFlatpickr = flatpickr($input[0], {
            noCalendar: true,
            enableTime: false,
            clickOpens: false,
            allowInput: false,
            static: true
        });
    
        // Function to set the date manually
        function setEditDob(dateStr) {
            if (dateStr) {
                // Format the date using Flatpickr's format function
                const formattedDate = flatpickr.formatDate(new Date(dateStr), "F j, Y");
                $input.val(formattedDate); // Set the value manually
            }
        }
    return; // Stop further execution for readonly fields
    }
    
  
      // Destroy existing instance if it exists
      if ($input[0]._flatpickr) return;
  
      // Initialize Flatpickr with the updated config
      flatpickr($input[0], config);
  
      // Ensure readonly state is respected
      if ($input.attr("readonly")) {
        $input.next(".flatpickr-input").prop("readonly", true);
      }
    });
  }
  

// Basic displayAlert function
function displayAlert(message, type = "danger", duration = 4000) {
  const alertId = `alert-${Date.now()}`;
  const alertHtml = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert" id="${alertId}">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  $("#alertContainer").prepend(alertHtml);
  
  if (duration > 0) {
    setTimeout(() => $(`#${alertId}`).alert("close"), duration);
  }
  
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// Helper to extract error messages from AJAX responses
function getErrorMessage(xhr, defaultMsg) {
  const errorMsg = xhr.responseJSON?.error || xhr.responseText || defaultMsg;
  console.error(`AJAX Error: ${xhr.status} - ${errorMsg}`, xhr);
  return errorMsg;
}

// Document ready handler
$(document).ready(function() {
  // Initial call to initialize date pickers on page load
  initializeDatePickers();

  // Re-initialize for modals when shown
  $("#createPatientModal, #appointmentFormContainer, #rescheduleAppointmentModal, #editAppointmentModal").on("shown.bs.modal", function() {
    initializeDatePickers();
  });

  checkSessionOnLoad();
  $("#logoutButton, #logoutDropdown").on("click", logoutUser);
});

// Utility Functions
function getAuthHeaders() {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const username = sessionStorage.getItem('username') || localStorage.getItem('username');
  const csrftoken = sessionStorage.getItem('csrftoken') || localStorage.getItem('csrftoken');
  if (!token || !username || !csrftoken) {
    console.warn("Missing authentication details");
    return {};
  }
  return {
    'Authorization': 'Token ' + token,
    'X-CSRFToken': csrftoken,
    'Username': username
  };
}

function formatDateTime(dateTimeString) {
  return new Date(dateTimeString).toISOString().slice(0, 16);
}

function calculateAge(dob) {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Session Management
function checkSessionOnLoad() {
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const userType = localStorage.getItem('user_type');
  console.log("Checking session:", { token, username, userType });
  if (!token || !username || !userType) {
    console.warn("Session data missing. Redirecting to login...");
    window.location.href = 'http://smarthospitalmaintain.com';
    return;
  }
  validateUserSession();
}

function validateUserSession() {
  const headers = getAuthHeaders();
  if (!headers['Authorization']) {
    console.warn("No authorization token found. Redirecting...");
    window.location.href = 'http://smarthospitalmaintain.com';
    return;
  }
  $.ajax({
    url: 'http://smarthospitalmaintain.com:8000/cookie/check/',
    type: 'GET',
    headers: headers,
    success: function(response) {
      console.log("Session validation response:", response);
      if (response.message !== 'Cookie is valid.') {
        displayAlert('Invalid session. Logging out.', 'error');
        attemptLogout();
      } else {
        $("#logged_in_user_name, #logged_in_user_name_breadcrumb").text(response.name);
        $("#timeOfDay").text(getGreetingTime());
        const statuses = ["Waiting", "Scheduled", "Pending", "Completed", "Canceled", "Rescheduled"];
        statuses.forEach(fetchAppointments);
        loadDoctors();
      }
    },
    error: function(xhr) {
      console.error("Session validation failed:", xhr.status, xhr.responseText);
      attemptLogout();
    }
  });
}

function attemptLogout() {
  console.log("Attempting logout...");
  logoutUser();
  setTimeout(() => {
    if (sessionStorage.getItem('authToken') || localStorage.getItem('authToken')) {
      forceLogout();
    }
  }, 3000);
}

function forceLogout() {
  console.log("Forcing logout...");
  sessionStorage.clear();
  localStorage.clear();
  document.cookie = "sessionid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  window.location.href = 'http://smarthospitalmaintain.com/';
}

function logoutUser() {
  const headers = getAuthHeaders();
  if (!headers['Authorization']) {
    console.warn("No authorization for logout. Redirecting...");
    window.location.href = 'http://smarthospitalmaintain.com/';
    return;
  }
  $.ajax({
    url: 'http://smarthospitalmaintain.com:8000/users/logout/',
    type: 'POST',
    headers: headers,
    success: function() {
      console.log("Logout successful");
      sessionStorage.clear();
      localStorage.clear();
      document.cookie = "sessionid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      window.location.href = 'http://smarthospitalmaintain.com/';
    },
    error: function(xhr) {
      console.error("Logout failed:", xhr.status, xhr.responseText);
    }
  });
}

function getGreetingTime() {
  const hours = new Date().getHours();
  return hours < 12 ? "Morning" : hours < 18 ? "Afternoon" : "Evening";
}

// Appointment Management
function fetchAppointments(status) {
  console.log(`Fetching appointments for status: ${status}`);
  $.ajax({
    url: `http://smarthospitalmaintain.com:8000/appointments/list/?status=${status}`,
    type: 'GET',
    headers: getAuthHeaders(),
    success: function(response) {
      console.log(`Appointments fetched for ${status}:`, response.appointments);
      populateAppointmentsTable(status, response.appointments);
    },
    error: function(xhr) {
      console.error(`Failed to fetch ${status} appointments:`, xhr.status, xhr.responseText);
      displayAlert(`Error fetching ${status} appointments`, 'error');
    }
  });
}

let filteredAppointments = [];

function populateAppointmentsTable(status, appointments) {
  let tbodyId = `${status}-tbody`;
  let tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";

  filteredAppointments = appointments;

  if (!document.getElementById(`${status}-select-all`)) {
    let thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th><input type="checkbox" id="${status}-select-all" onclick="toggleAll('${status}')"></th>
        <th>#</th>
        <th>Patient ID</th>
        <th>Patient Name</th>
        <th>Age</th>
        <th>Contact Number</th>
        <th>Current Illness</th>
        <th>Notes</th>
        <th>Appointment Time</th>
        <th>Doctor</th>
        <th>Created By</th>
        <th>Updated By</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    `;
    tbody.parentElement.insertBefore(thead, tbody);
  }

  appointments.forEach((appointment, index) => {
    let patient = appointment.patient || {};
    let doctor = appointment.doctor || {};
    let doctorName = `${doctor.first_name || ''} ${doctor.last_name || ''}` || "Unknown Doctor";
    let appointmentTime = formatDateTimeForTable(appointment.appointment_date);
    let currentIllness = patient.current_medications || "No Current Illness";

    let row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="checkbox" class="${status}-checkbox" value="${appointment.id}" onclick="updateBulkSelection('${status}')"></td>
      <td>${index + 1}</td>
      <td>${patient.patient_id || "N/A"}</td>
      <td>${patient.first_name} ${patient.last_name}</td>
      <td>${patient.age >= 0 ? patient.age : "N/A"}</td>
      <td>${patient.mobile_number || "N/A"}</td>
      <td>${currentIllness}</td>
      <td>${appointment.notes || "N/A"}</td>
      <td>${appointmentTime}</td>
      <td>Dr. ${doctorName} (${doctor.specialization || "N/A"})</td>
      <td>${appointment.created_by_username || "N/A"}</td>
      <td>${appointment.updated_by ? `${appointment.updated_by_username} updated` : "Not Updated"}</td>
      <td>${appointment.status || "N/A"}</td>
      <td>${getActionButton(appointment.status, appointment, index)}</td>
    `;
    tbody.appendChild(row);
  });

  filterTable();
}

// Helper function to format date/time like Flatpickr's altFormat
function formatDateTimeForTable(date, includeTime = true) {
  const dateObj = (typeof date === 'string') ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    console.error("Invalid date provided:", date);
    return "Invalid Date";
  }

  // Force IST
  const istOffset = 5.5 * 60; // 330 minutes
  const utcDate = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
  const istDate = new Date(utcDate.getTime() + (istOffset * 60000));

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  let month = months[istDate.getMonth()];
  let day = istDate.getDate();
  let year = istDate.getFullYear();

  if (!includeTime) {
    return `${month} ${day}, ${year}`;
  }

  let hours = istDate.getHours();
  let minutes = istDate.getMinutes();
  let period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  minutes = minutes < 10 ? `0${minutes}` : minutes;

  return `${month} ${day}, ${year}, ${hours}:${minutes} ${period}`;
}

function toggleAll(status) {
  const selectAllCheckbox = document.getElementById(`${status}-select-all`);
  const checkboxes = document.querySelectorAll(`.${status}-checkbox`);
  const selectedIds = [];

  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
    if (checkbox.checked) selectedIds.push(checkbox.value);
  });

  console.log(`Toggle all for ${status}:`, selectedIds);
  updateBulkActions(status, selectedIds);
}

function updateBulkSelection(status) {
  const checkboxes = document.querySelectorAll(`.${status}-checkbox`);
  const selectAllCheckbox = document.getElementById(`${status}-select-all`);
  const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

  selectAllCheckbox.checked = checkboxes.length > 0 && selectedIds.length === checkboxes.length;
  console.log(`Updated selection for ${status}:`, selectedIds);
  updateBulkActions(status, selectedIds);
}

function updateBulkActions(status, selectedIds) {
  const cancelBtn = document.getElementById("cancelBtn");
  const rescheduleBtn = document.getElementById("rescheduleBtn");

  if (!cancelBtn || !rescheduleBtn) {
    console.warn("Bulk action buttons not found");
    return;
  }

  const shouldShow = selectedIds.length > 0;
  cancelBtn.classList.toggle("d-none", !shouldShow);
  rescheduleBtn.classList.toggle("d-none", !shouldShow);
}

function bulkCancel() {
  const status = $("#appointmentTabs .nav-link.active").attr("href").substring(1).charAt(0).toUpperCase() + $("#appointmentTabs .nav-link.active").attr("href").substring(2);
  const selectedIds = Array.from(document.querySelectorAll(`.${status}-checkbox:checked`)).map(cb => cb.value);
  console.log("Bulk cancel selected IDs:", selectedIds);

  if (selectedIds.length === 0) {
    displayAlert("No appointments selected for cancellation", "error");
    return;
  }
  cancelAppointment(selectedIds, null, status);
}

function bulkReschedule() {
  const status = $("#appointmentTabs .nav-link.active").attr("href").substring(1).charAt(0).toUpperCase() + $("#appointmentTabs .nav-link.active").attr("href").substring(2);
  const selectedIds = Array.from(document.querySelectorAll(`.${status}-checkbox:checked`)).map(cb => cb.value);
  console.log("Bulk reschedule selected IDs:", selectedIds);

  if (selectedIds.length === 0) {
    displayAlert("No appointments selected for rescheduling", "error");
    return;
  }
  openRescheduleModal(selectedIds, null, status);
}

function getActionButton(status, appointment, rowIndex) {
  let buttons = "";
  const appointmentData = encodeURIComponent(JSON.stringify(appointment));
  switch (status) {
    case 'Waiting':
      buttons += `<button class="btn btn-primary btn-sm" onclick='openEditModal("${appointmentData}", ${rowIndex})'>Edit</button> `;
      buttons += `<button class="btn btn-danger btn-sm" onclick="cancelAppointment(${appointment.id}, ${rowIndex})">Cancel</button> `;
      buttons += `<button class="btn btn-success btn-sm">Start Consulting</button>`;
      break;
    case 'Scheduled':
      buttons += `<button class="btn btn-primary btn-sm" onclick='openEditModal("${appointmentData}", ${rowIndex})'>Edit</button> `;
      buttons += `<button class="btn btn-danger btn-sm" onclick="cancelAppointment(${appointment.id}, ${rowIndex})">Cancel</button> `;
      buttons += `<button class="btn btn-warning btn-sm" onclick="openRescheduleModal(${appointment.id})">Reschedule</button>`;
      buttons += `<button class="btn btn-success btn-sm">Start Consulting</button>`;
      break;
    case 'Pending':
      buttons += `<button class="btn btn-primary btn-sm" onclick='openEditModal("${appointmentData}", ${rowIndex})'>Edit</button> `;
      buttons += `<button class="btn btn-warning btn-sm" onclick="openRescheduleModal(${appointment.id})">Reschedule</button>`;
      break;
    case 'Canceled':
      buttons += `<button class="btn btn-primary btn-sm" onclick='openEditModal("${appointmentData}", ${rowIndex})'>Edit</button> `;
      buttons += `<button class="btn btn-warning btn-sm" onclick="openRescheduleModal(${appointment.id})">Reschedule</button>`;
      break;
    case 'Completed':
      buttons += `<button class="btn btn-secondary btn-sm">Review</button>`;
      break;
    case 'Rescheduled':
      buttons += `<button class="btn btn-primary btn-sm" onclick='openEditModal("${appointmentData}", ${rowIndex})'>Edit</button> `;
      buttons += `<button class="btn btn-danger btn-sm" onclick="cancelAppointment(${appointment.id}, ${rowIndex})">Cancel</button> `;
      buttons += `<button class="btn btn-warning btn-sm" onclick="openRescheduleModal(${appointment.id})">Reschedule</button>`;
      break;
    default:
      buttons += `<button class="btn btn-light btn-sm">No Action</button>`;
  }
  return buttons;
}

// Form Handling
$("#makeAppointmentBtn").on("click", function() {
  const patientId = $("#newPatientIdInput").val().trim();
  console.log("Make appointment with patient ID:", patientId);
  if (!patientId) {
    displayAlert("Patient ID is missing", "error");
    return;
  }
  $(".modal").modal("hide");
  showAppointmentForm(patientId);
  fetchPatientDetails(patientId);
});

function showAppointmentForm(patientId = null) {
  console.log("Showing appointment form with patient ID:", patientId);
  $("#appointmentFormContainer").show();
  $(".tab-pane").removeClass("show active");
  $("#appointmentTabs .nav-link").removeClass("active");
  $("#appointmentForm")[0].reset();
  $("#appointmentForm .form-control").removeClass("is-invalid");
  if (patientId) {
    $("#patientID").val(patientId);
    $("#patientID").trigger("blur");
  }
}

function hideAppointmentForm() {
  console.log("Hiding appointment form");
  $("#appointmentFormContainer").hide();
  $("#appointmentForm")[0].reset();
  const activeTab = localStorage.getItem("activeTab") || "#waiting";
  $(`#appointmentTabs a[href="${activeTab}"]`).tab("show");
}

function fetchPatientDetails(patientId) {
    console.log("Starting fetchPatientDetails with patientId:", patientId);

    if (!patientId) {
        console.log("No patientId provided, clearing form fields.");
        $("#firstName, #lastName, #contactNumber, #dateOfBirth, #age").val("");
        const flatpickrInstance = $("#dateOfBirth")[0]?._flatpickr;
        if (flatpickrInstance) {
            console.log("Clearing Flatpickr instance due to no patientId.");
            flatpickrInstance.clear();
        } else {
            console.warn("No Flatpickr instance found for #dateOfBirth when clearing.");
        }
        return;
    }

    console.log("Making AJAX request to fetch patient details for ID:", patientId);
    $.ajax({
        url: `http://smarthospitalmaintain.com:8000/appointments/get-patient-details/${patientId}/`,
        type: "GET",
        headers: getAuthHeaders(),
        success: function(response) {
            console.log("AJAX success - Raw response:", response);

            if (response.patient) {
                console.log("Patient data received:", response.patient);

                $("#firstName").val(response.patient.first_name || "");
                $("#lastName").val(response.patient.last_name || "");
                $("#contactNumber").val(response.patient.mobile_number || "");
                console.log("Set basic fields - firstName:", response.patient.first_name, 
                           "lastName:", response.patient.last_name, 
                           "contactNumber:", response.patient.mobile_number);

                const dateOfBirthStr = response.patient.date_of_birth || "";
                console.log("Raw dateOfBirth from response:", dateOfBirthStr);

                const $dobInput = $("#dateOfBirth");
                const flatpickrInstance = $dobInput[0]?._flatpickr;
                console.log("Flatpickr instance exists:", !!flatpickrInstance);

                if (!flatpickrInstance) {
                    console.error("Flatpickr instance not initialized for #dateOfBirth. Ensure initializeDatePickers() was called.");
                }

                if (dateOfBirthStr) {
                    const dob = new Date(dateOfBirthStr);
                    console.log("Parsed DOB as Date object:", dob);

                    if (!isNaN(dob.getTime())) {
                        // Format the date using Flatpickr's format function
                        const formattedDob = flatpickr.formatDate(dob, "F j, Y");
                        console.log("Formatted DOB for display (F j, Y):", formattedDob);

                        $dobInput.val(formattedDob); // Set the formatted value directly
                        console.log("Set #dateOfBirth input value to:", $dobInput.val());

                        if (flatpickrInstance) {
                            flatpickrInstance.setDate(dob, true); // Update Flatpickr's internal state
                            console.log("Flatpickr setDate called with:", dob);
                            console.log("Flatpickr altInput value after setDate:", $dobInput.next(".flatpickr-input").val());
                        } else {
                            console.warn("Cannot set Flatpickr date - instance missing.");
                        }

                        const age = calculateAge(dateOfBirthStr);
                        $("#age").val(age);
                        console.log("Calculated and set age:", age);
                    } else {
                        console.warn("Invalid date of birth detected:", dateOfBirthStr);
                        if (flatpickrInstance) {
                            flatpickrInstance.clear();
                            console.log("Cleared Flatpickr due to invalid DOB.");
                        }
                        $("#age").val("");
                        console.log("Cleared age field due to invalid DOB.");
                    }
                } else {
                    console.log("No dateOfBirth provided in response, clearing DOB and age.");
                    if (flatpickrInstance) {
                        flatpickrInstance.clear();
                        console.log("Cleared Flatpickr due to no DOB.");
                    }
                    $("#age").val("");
                    console.log("Cleared age field.");
                }
            } else {
                console.warn("No patient data in response:", response);
                displayAlert("Patient not found.", "error");
                $("#firstName, #lastName, #contactNumber, #dateOfBirth, #age").val("");
                const flatpickrInstance = $("#dateOfBirth")[0]?._flatpickr;
                if (flatpickrInstance) {
                    flatpickrInstance.clear();
                    console.log("Cleared Flatpickr due to no patient data.");
                }
            }
        },
        error: function(xhr) {
            console.error("AJAX error fetching patient details - Status:", xhr.status, 
                         "Response:", xhr.responseText);
            displayAlert("Failed to fetch patient details.", "error");
            $("#firstName, #lastName, #contactNumber, #dateOfBirth, #age").val("");
            const flatpickrInstance = $("#dateOfBirth")[0]?._flatpickr;
            if (flatpickrInstance) {
                flatpickrInstance.clear();
                console.log("Cleared Flatpickr due to AJAX error.");
            }
        }
    });
}

let doctorMap = {};
function loadDoctors(selectedId = null) {
  console.log("Loading doctors...");
  $.ajax({
    url: "http://smarthospitalmaintain.com:8000/appointments/doctors/list/",
    type: "GET",
    headers: getAuthHeaders(),
    success: function(response) {
      console.log("Doctors loaded:", response.doctors);
      $("#doctor, #editDoctor, #patientPrimaryDoctor").empty().append('<option value="" disabled selected>Select a doctor</option>');
      response.doctors.forEach(doctor => {
        doctorMap[doctor.id] = doctor;
        const option = `<option value="${doctor.id}">Dr. ${doctor.first_name} ${doctor.last_name} - ${doctor.specialization}</option>`;
        $("#doctor, #editDoctor, #patientPrimaryDoctor").append(option);
      });
      if (selectedId) $("#editDoctor").val(selectedId);
    },
    error: function(xhr) {
      console.error("Failed to load doctors:", xhr.status, xhr.responseText);
      displayAlert("Failed to load doctors list", "error");
    }
  });
}

function addAppointment() {
    const patientId = $("#patientID").val().trim();
    const doctorId = $("#doctor").val();
    const appointmentDate = $("#appointmentDate").val();
    const formattedDate = appointmentDate + ":00";
    const notes = $("#notes").val().trim();
    const currentIllness = $("#currentIllness").val().trim();
  
    // Clear previous validation
    $(".form-control").removeClass("is-invalid");
    $(".invalid-feedback").text("");
  
    let isValid = true;
    let errorMessages = [];
  
    // Validation checks
    if (!patientId) {
      $("#patientID").addClass("is-invalid");
      $("#patientIDFeedback").text("Patient ID is required.");
      errorMessages.push("Patient ID is required.");
      isValid = false;
    }
  
    if (!doctorId) {
      $("#doctor").addClass("is-invalid");
      $("#doctorFeedback").text("Doctor selection is required.");
      errorMessages.push("Doctor selection is required.");
      isValid = false;
    }
  
    if (!appointmentDate) {
      $("#appointmentDate").addClass("is-invalid");
      $("#appointmentDateFeedback").text("Appointment date is required.");
      errorMessages.push("Appointment date is required.");
      isValid = false;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const apptDate = new Date(appointmentDate);
      if (apptDate < today) {
        $("#appointmentDate").addClass("is-invalid");
        $("#appointmentDateFeedback").text("Appointment date cannot be in the past.");
        errorMessages.push("Appointment date cannot be in the past.");
        isValid = false;
      } else if (isNaN(apptDate.getTime())) {
        $("#appointmentDate").addClass("is-invalid");
        $("#appointmentDateFeedback").text("Invalid date format.");
        errorMessages.push("Invalid appointment date format.");
        isValid = false;
      }
    }
  
    if (!isValid) {
      // Construct detailed error message
      const errorMessage = "Please correct the following errors:\n- " + errorMessages.join("\n- ");
      displayAlert(errorMessage, "danger");
      console.log("Validation errors:", errorMessages); // Log for debugging
      return;
    }
  
    const appointmentData = {
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_date: formattedDate,
      notes: notes,
      current_illness: currentIllness
    };
  
    $.ajax({
      url: "http://smarthospitalmaintain.com:8000/appointments/create/",
      type: "POST",
      headers: getAuthHeaders(),
      data: JSON.stringify(appointmentData),
      contentType: "application/json",
      success: function(response) {
        const appointmentId = response.appointment?.id;
        if (!appointmentId) {
          displayAlert("Error: Appointment ID missing from response.", "danger");
          return;
        }
        hideAppointmentForm();
        fetchAppointments("Scheduled");
        $("#vitalsModal").modal("show").data("appointmentId", appointmentId);
        displayAlert("Appointment created successfully!", "success");
      },
      error: function(xhr) {
        // Enhance error reporting from server response
        const serverError = getErrorMessage(xhr, "Failed to create appointment.");
        displayAlert(serverError, "danger");
        console.error("AJAX Error Details:", {
          status: xhr.status,
          response: xhr.responseJSON || xhr.responseText,
          dataSent: appointmentData
        });
      }
    });
  }
$(document).ready(function() {
    initializeDatePickers();
  });

  let currentAppointment = null;
  function openEditModal(appointmentData, rowIndex) {
      currentAppointment = JSON.parse(decodeURIComponent(appointmentData));
  
      // Log the appointment data for debugging
      console.log("Current Appointment Data:", currentAppointment);
  
      // Check for required DOM elements
      if (!$("#editDateOfBirth").length || !$("#editAppointmentDate").length) {
          console.error("Required DOM elements not found: #editDateOfBirth or #editAppointmentDate");
          displayAlert("Error: Modal elements missing", "error");
          return;
      }
  
      // Populate static fields
      $("#editFirstName").val(currentAppointment.patient?.first_name || "");
      $("#editLastName").val(currentAppointment.patient?.last_name || "");
      $("#editContactNumber").val(currentAppointment.patient?.mobile_number || "");
      $("#editCurrentIllness").val(currentAppointment.patient?.current_medications || "No Current Illness");
      $("#editAppointmentStatus").val(currentAppointment.status || "");
      $("#editNotes").val(currentAppointment.notes || "");
      $("#editAppointmentID").val(currentAppointment.id);
      $("#editPatientID").val(currentAppointment.patient?.patient_id || "");
  
      $("#editFirstName, #editLastName, #editContactNumber, #editPatientID, #editDateOfBirth").prop("readonly", true);
      $("#editAge").prop("readonly", true);
      $("#editCurrentIllness, #editNotes, #editAppointmentDate, #editAppointmentStatus").prop("readonly", false);
  
      let previousDoctorId = currentAppointment.doctor?.id || "";
      loadDoctors(previousDoctorId);
  
      // Show the modal and initialize date pickers once fully rendered
      $("#editAppointmentModal")
          .off("shown.bs.modal") // Remove existing handlers to prevent duplicates
          .on("shown.bs.modal", function () {
              const $dobInput = $("#editDateOfBirth");
              const $appointmentInput = $("#editAppointmentDate");
  
              // Reset and initialize Flatpickr for Date of Birth (readonly)
              if ($dobInput[0]._flatpickr) {
                  $dobInput[0]._flatpickr.destroy();
              }
              flatpickr($dobInput[0], {
                  noCalendar: true,
                  enableTime: false,
                  clickOpens: false,
                  allowInput: false,
                  static: true
              });
              const dobStr = currentAppointment.patient?.date_of_birth || "";
              if (dobStr) {
                  const formattedDob = flatpickr.formatDate(new Date(dobStr), "F j, Y");
                  $dobInput.val(formattedDob);
                  $("#editAge").val(calculateAge(dobStr));
              } else {
                  $dobInput.val("");
                  $("#editAge").val("");
              }
  
              // Reset and initialize Flatpickr for Appointment Date
              if ($appointmentInput[0]._flatpickr) {
                  $appointmentInput[0]._flatpickr.destroy();
                  console.log("Destroyed existing Flatpickr instance for #editAppointmentDate");
              }
              const appointmentFlatpickr = flatpickr($appointmentInput[0], {
                  altInput: true,
                  altFormat: "F j, Y, h:i K",
                  dateFormat: "Y-m-d H:i",
                  enableTime: true,
                  time_24hr: false,
                  minDate: "today",
                  appendTo: document.body,
                  position: "auto"
              });
  
              // Set the appointment date
              const appointmentDateStr = currentAppointment.appointment_date; // e.g., "2025-03-21T01:52:00+05:30"
              console.log("Raw appointment_date from API:", appointmentDateStr);
              if (appointmentDateStr) {
                  const appointmentDate = new Date(appointmentDateStr);
                  if (!isNaN(appointmentDate.getTime())) {
                      // Adjust to IST explicitly
                      const istOffset = 5.5 * 60 * 60000; // IST is UTC+05:30 in milliseconds
                      const utcDate = new Date(appointmentDate.getTime() - (appointmentDate.getTimezoneOffset() * 60000));
                      const istDate = new Date(utcDate.getTime() + istOffset);
                      console.log("IST Adjusted Date:", istDate);
  
                      try {
                          appointmentFlatpickr.setDate(istDate, true);
                          console.log("Appointment Date Set in Flatpickr:", istDate);
                          console.log("Formatted Display Value:", $appointmentInput.val());
                          console.log("Visible altInput Value:", $appointmentInput.next(".flatpickr-input").val());
                      } catch (e) {
                          console.error("Failed to set appointment date:", e);
                          appointmentFlatpickr.clear();
                      }
                  } else {
                      console.warn("Invalid appointment date:", appointmentDateStr);
                      appointmentFlatpickr.clear();
                  }
              } else {
                  console.log("No appointment date provided, clearing picker.");
                  appointmentFlatpickr.clear();
              }
          })
          .modal("show");
  }
function updateAppointment() {
  const flatpickrInstance = $("#editAppointmentDate")[0]._flatpickr;
  let appointmentDate = flatpickrInstance.selectedDates[0];
  if (!appointmentDate || isNaN(appointmentDate.getTime())) {
    displayAlert("Please select a valid appointment date and time", "error");
    $("#editAppointmentDate").addClass("is-invalid");
    return;
  }

  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcDate = new Date(appointmentDate.getTime() - (appointmentDate.getTimezoneOffset() * 60 * 1000));
  const istDate = new Date(utcDate.getTime() + istOffset);
  const formattedAppointmentDate = istDate.toISOString().slice(0, 19) + "+05:30";

  const updatedAppointment = {
    id: $("#editAppointmentID").val(),
    patient_id: $("#editPatientID").val(),
    date_of_birth: $("#editDateOfBirth").val(),
    current_illness: $("#editCurrentIllness").val(),
    doctor_id: $("#editDoctor").val() || currentAppointment.doctor?.id || "",
    status: $("#editAppointmentStatus").val(),
    notes: $("#editNotes").val(),
    appointment_date: formattedAppointmentDate
  };

  console.log("updateAppointment - Sending to API:", updatedAppointment);

  fetch(`http://smarthospitalmaintain.com:8000/appointments/edit/${updatedAppointment.id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(updatedAppointment)
  })
    .then(response => {
      if (!response.ok) throw new Error("Failed to update");
      return response.json();
    })
    .then(data => {
      console.log("Appointment updated:", data);
      displayAlert("Appointment updated successfully", "success");
      $("#editAppointmentModal").modal("hide");
      fetchAppointments(updatedAppointment.status);
    })
    .catch(error => {
      console.error("Update failed:", error);
      displayAlert("Failed to update appointment", "error");
    });
}

function cancelAppointment(appointmentIds, rowIndex = null, status = null) {
  const selectedIds = Array.isArray(appointmentIds) ? appointmentIds : [appointmentIds];
  console.log("Canceling appointments:", selectedIds);

  if (selectedIds.length === 0 || !selectedIds[0]) {
    displayAlert("No appointments selected", "error");
    return;
  }

  if (!confirm(`Are you sure you want to cancel ${selectedIds.length} appointment(s)?`)) return;

  fetch("http://smarthospitalmaintain.com:8000/appointments/cancel/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ appointment_ids: selectedIds, status: "Canceled" })
  })
    .then(response => {
      if (!response.ok) throw new Error("Failed to cancel");
      return response.json();
    })
    .then(data => {
      console.log("Appointments canceled:", data);
      displayAlert(`Successfully canceled ${selectedIds.length} appointment(s)`);
      location.reload();
      fetchAppointments(status || "Canceled");
    })
    .catch(error => {
      console.error("Cancel failed:", error);
      displayAlert("Failed to cancel appointments", "error");
    });
}

function openRescheduleModal(appointmentIds = null, date = null, status = null) {
  const selectedIds = Array.isArray(appointmentIds) ? appointmentIds : [appointmentIds];
  console.log("Opening reschedule modal for IDs:", selectedIds);

  if (selectedIds.length === 0) {
    displayAlert("No appointments selected", "error");
    return;
  }

  $("#rescheduleAppointmentID").val(selectedIds.join(","));
  $("#newAppointmentDate").val(date || "");
  $("#rescheduleAppointmentModal").modal("show");
}

function rescheduleAppointment() {
  const appointmentIds = $("#rescheduleAppointmentID").val().split(",");
  const newDate = $("#newAppointmentDate").val().trim();
  console.log("Rescheduling appointments:", { appointmentIds, newDate });

  if (!newDate) {
    displayAlert("Please select a new date and time", "error");
    return;
  }

  fetch("http://smarthospitalmaintain.com:8000/appointments/reschedule/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ appointment_ids: appointmentIds, appointment_date: new Date(newDate + ":00").toISOString() })
  })
    .then(response => {
      if (!response.ok) throw new Error("Failed to reschedule");
      return response.json();
    })
    .then(data => {
      console.log("Appointments rescheduled:", data);
      displayAlert(`Successfully rescheduled ${appointmentIds.length} appointment(s)`);
      $("#rescheduleAppointmentModal").modal("hide");
      fetchAppointments("Rescheduled");
      location.reload();
    })
    .catch(error => {
      console.error("Reschedule failed:", error);
      displayAlert("Try with a later date than today", "error");
    });
}

// Search Filter Logic
function filterTable() {
  const patientId = $("#searchPatientId").val().toLowerCase().trim();
  const name = $("#searchName").val().toLowerCase().trim();
  const mobile = $("#searchMobile").val().trim();
  const dob = $("#searchDob").val();
  const date = $("#searchDate").val();

  $(".tab-pane tbody tr").each(function() {
    const row = $(this);
    const rowPatientId = row.find("td:nth-child(3)").text().toLowerCase().trim();
    const rowName = row.find("td:nth-child(4)").text().toLowerCase().trim();
    const rowMobile = row.find("td:nth-child(6)").text().trim();
    const rowDob = row.find("td:nth-child(5)")?.text() || "";
    const rowDateTime = row.find("td:nth-child(9)").text().trim();

    let formattedRowDate = "";
    if (rowDateTime) {
      const datePart = rowDateTime.split(", ").slice(0, 2).join(", ");
      const dateObj = new Date(datePart);
      if (!isNaN(dateObj.getTime())) {
        formattedRowDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
      }
    }

    const matches = (!patientId || rowPatientId.includes(patientId)) &&
                   (!name || rowName.includes(name)) &&
                   (!mobile || rowMobile.includes(mobile)) &&
                   (!dob || rowDob.includes(dob)) &&
                   (!date || formattedRowDate === date);

    row.toggle(matches);
  });
}

$("#searchPatientId, #searchName, #searchMobile, #searchDob, #searchDate").on("input change", filterTable);

// Initialization
document.addEventListener("DOMContentLoaded", function() {
  ["#contactNumber", "#editContactNumber"].forEach(selector => {
    const input = document.querySelector(selector);
    if (input) {
      const iti = window.intlTelInput(input, {
        initialCountry: "in",
        preferredCountries: ["in", "us", "gb", "ke", "ng"],
        separateDialCode: true
      });
      input.addEventListener("blur", () => console.log(`Phone number (${selector}):`, iti.getNumber()));
    }
  });

  $("#dateOfBirth").attr("max", new Date().toISOString().split("T")[0]);
  const now = new Date();
  const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  $("#appointmentDate").attr("min", formattedNow);

  $("#dateOfBirth, #editDateOfBirth").on("change", function() {
    const age = calculateAge(this.value);
    $(this.id === "dateOfBirth" ? "#age" : "#editAge").val(age >= 0 ? age : "");
  });

  $("#appointmentTabs a").on("shown.bs.tab", function(e) {
    localStorage.setItem("activeTab", $(e.target).attr("href"));
  });
  const activeTab = localStorage.getItem("activeTab");
  if (activeTab) $("#appointmentTabs a[href='" + activeTab + "']").tab("show");

  $("#logoutButton, #logoutDropdown").on("click", function(e) {
    e.preventDefault();
    logoutUser();
  });

  checkSessionOnLoad();
});

// Patient Management
$(document).ready(function() {
  $('#createPatientModal').on('shown.bs.modal', function() {
    $("#createPatientForm")[0].reset();
    $("#createPatientForm .form-control, #createPatientForm .form-select").removeClass('is-invalid');
    $('#collapseBasic').addClass('show');
    $('#collapseMedical, #collapseEmergency, #collapseInsurance').removeClass('show');
    loadDoctorsForPatientModal();
  });

  $("#patientDob").on("change", function() {
    const dob = new Date(this.value);
    if (isNaN(dob.getTime())) {
      $("#patientAge").val("");
      return;
    }
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
      age--;
    }
    $("#patientAge").val(age >= 0 ? age : "");
  });

  $('#savePatientBtn').on('click', function() {
    if (validateBasicInfo()) {
      savePatient();
    } else {
      displayAlert('Please fill all required fields in Basic Information correctly.', 'error');
    }
  });

  function validateBasicInfo() {
    let isValid = true;
    const requiredFields = {
      'patientFirstName': { value: $('#patientFirstName').val().trim(), message: "First name is required." },
      'patientLastName': { value: $('#patientLastName').val().trim(), message: "Last name is required." },
      'patientGender': { value: $('#patientGender').val(), message: "Gender is required." },
      'patientDob': { value: $('#patientDob').val(), message: "Date of birth is required." },
      'patientFatherName': { value: $('#patientFatherName').val().trim(), message: "Father's name is required." },
      'patientMobile': { value: $('#patientMobile').val().trim(), message: "Mobile number is required." },
      'admissionType': { value: $('#admissionType').val(), message: "Admission type is required." }
    };

    Object.entries(requiredFields).forEach(([id, { value, message }]) => {
      const $input = $(`#${id}`);
      const $feedback = $(`#${id}Feedback`);
      if (!value) {
        $input.addClass('is-invalid');
        $feedback.text(message);
        isValid = false;
      } else {
        $input.removeClass('is-invalid');
        $feedback.text('');
      }
    });

    const mobile = requiredFields.patientMobile.value;
    if (mobile && !/^\d{10}$/.test(mobile)) {
      $('#patientMobile').addClass('is-invalid');
      $('#patientMobileFeedback').text("Mobile number must be exactly 10 digits.");
      isValid = false;
    }

    return isValid;
  }

  $('#savePatientBtn').on('click', function() {
    if (!validateBasicInfo()) {
      displayAlert("Please fill all required fields correctly.", "danger");
      return;
    }
    savePatient();
  });
});

function savePatient() {
  const patientData = {
    first_name: $("#patientFirstName").val().trim(),
    last_name: $("#patientLastName").val().trim(),
    gender: $("#patientGender").val(),
    date_of_birth: $("#patientDob").val(),
    father_name: $("#patientFatherName").val().trim(),
    address: $("#patientAddress").val().trim() || null,
    city: $("#patientCity").val().trim() || null,
    pincode: $("#patientPincode").val() || null,
    email: $("#patientEmail").val().trim() || null,
    mobile_number: $("#patientMobile").val().trim(),
    alternate_mobile_number: $("#patientAltMobile").val().trim() || null,
    aadhar_number: $("#patientAadhar").val().trim() || null,
    blood_group: $("#patientBloodGroup").val() || null,
    known_allergies: $("#patientAllergies").val().trim() || null,
    current_medications: $("#patientMedications").val().trim() || null,
    past_medical_history: $("#patientPastHistory").val().trim() || null,
    specific_notes: $("#patientNotes").val().trim() || null,
    primary_doctor: $("#patientPrimaryDoctor").val() || null,
    emergency_contact_name: $("#emergencyName").val().trim() || null,
    emergency_contact_relationship: $("#emergencyRelation").val().trim() || null,
    emergency_contact_number: $("#emergencyNumber").val().trim() || null,
    insurance_provider: $("#insuranceProvider").val().trim() || null,
    policy_number: $("#policyNumber").val().trim() || null,
    payment_preference: $("#paymentPreference").val() || null,
    admission_type: $("#admissionType").val()
  };

  const requiredFields = {
    'patientFirstName': patientData.first_name,
    'patientLastName': patientData.last_name,
    'patientGender': patientData.gender,
    'patientDob': patientData.date_of_birth,
    'patientFatherName': patientData.father_name,
    'patientMobile': patientData.mobile_number,
    'admissionType': patientData.admission_type
  };

  let isValid = true;
  Object.keys(requiredFields).forEach(id => {
    if (!requiredFields[id]) {
      $(`#${id}`).addClass('is-invalid');
      isValid = false;
    } else {
      $(`#${id}`).removeClass('is-invalid');
    }
  });

  if (!/^\d{10}$/.test(patientData.mobile_number)) {
    $("#patientMobile").addClass('is-invalid');
    displayAlert("Mobile number must be exactly 10 digits.", "error");
    return;
  }

  if (patientData.alternate_mobile_number && !/^\d{10}$/.test(patientData.alternate_mobile_number)) {
    $("#patientAltMobile").addClass('is-invalid');
    displayAlert("Alternate mobile number must be exactly 10 digits.", "error");
    return;
  }

  if (patientData.emergency_contact_number && !/^\d{10}$/.test(patientData.emergency_contact_number)) {
    $("#emergencyNumber").addClass('is-invalid');
    displayAlert("Emergency contact number must be exactly 10 digits.", "error");
    return;
  }

  if (patientData.aadhar_number && !/^\d{12}$/.test(patientData.aadhar_number)) {
    $("#patientAadhar").addClass('is-invalid');
    displayAlert("Aadhar number must be exactly 12 digits.", "error");
    return;
  }

  if (!isValid) {
    displayAlert("Please fill all required fields.", "error");
    return;
  }

  console.log("Submitting patient data:", patientData);

  $.ajax({
    url: "http://smarthospitalmaintain.com:8000/appointments/patients/create/",
    type: "POST",
    headers: getAuthHeaders(),
    data: JSON.stringify(patientData),
    contentType: "application/json",
    success: function(response) {
      displayAlert("Patient created successfully!", "success");
      $("#createPatientModal").modal("hide");
      $("#newPatientIdInput").val(response.patient.patient_id);
      $("#patientIdPopupModal").modal("show");
    },
    error: function(xhr) {
      const errorMsg = getErrorMessage(xhr, "Failed to create patient.");
      displayAlert(errorMsg, "danger");
      console.error("Patient creation failed:", {
        status: xhr.status,
        response: xhr.responseJSON || xhr.responseText,
        dataSent: patientData
      });
    }
  });
}

function loadDoctorsForPatientModal() {
  $.ajax({
    url: "http://smarthospitalmaintain.com:8000/appointments/doctors/list/",
    type: "GET",
    headers: getAuthHeaders(),
    success: function(response) {
      $("#patientPrimaryDoctor").empty().append('<option value="" disabled selected>Select</option>');
      response.doctors.forEach(doctor => {
        $("#patientPrimaryDoctor").append(`<option value="${doctor.id}">Dr. ${doctor.first_name} ${doctor.last_name} - ${doctor.specialization}</option>`);
      });
    },
    error: function() {
      displayAlert("Failed to load doctors.", "error");
    }
  });
}

$("#patientDob, #dateOfBirth, #editDateOfBirth").on("change", function() {
  const dob = new Date(this.value);
  if (isNaN(dob.getTime())) {
    $(this.id === "dateOfBirth" ? "#age" : this.id === "editDateOfBirth" ? "#editAge" : "#patientAge").val("");
    return;
  }
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
    age--;
  }
  $(this.id === "dateOfBirth" ? "#age" : this.id === "editDateOfBirth" ? "#editAge" : "#patientAge").val(age >= 0 ? age : "");
});

$("#patientID").on("blur", function() {
  let patientId = $(this).val().trim();
  if (patientId) {
    $.ajax({
      url: `http://smarthospitalmaintain.com:8000/appointments/get-patient-details/${patientId}/`,
      type: "GET",
      headers: getAuthHeaders(),
      success: function(response) {
        if (response.patient) {
          $("#firstName").val(response.patient.first_name || "");
          $("#lastName").val(response.patient.last_name || "");
          $("#contactNumber").val(response.patient.mobile_number || "");

          const dateOfBirthStr = response.patient.date_of_birth || "";
          const flatpickrInstance = $("#dateOfBirth")[0]._flatpickr;
          if (dateOfBirthStr) {
            const dob = new Date(dateOfBirthStr);
            if (!isNaN(dob.getTime())) {
              flatpickrInstance.setDate(dob, true, "Y-m-d");
              $("#age").val(calculateAge(dateOfBirthStr));
            } else {
              flatpickrInstance.clear();
              $("#age").val("");
            }
          } else {
            flatpickrInstance.clear();
            $("#age").val("");
          }
        } else {
          displayAlert("Patient not found.", "error");
          $("#firstName, #lastName, #contactNumber, #dateOfBirth, #age").val("");
          const flatpickrInstance = $("#dateOfBirth")[0]._flatpickr;
          flatpickrInstance.clear();
        }
      },
      error: function(xhr) {
        displayAlert("Failed to fetch patient details.", "error");
        $("#firstName, #lastName, #contactNumber, #dateOfBirth, #age").val("");
        const flatpickrInstance = $("#dateOfBirth")[0]._flatpickr;
        flatpickrInstance.clear();
      }
    });
  } else {
    $("#firstName, #lastName, #contactNumber, #dateOfBirth, #age").val("");
    const flatpickrInstance = $("#dateOfBirth")[0]._flatpickr;
    flatpickrInstance.clear();
  }
});

// Ensure intl-tel-input works for patient mobile numbers
$(document).ready(function() {
  ["#patientMobile", "#patientAltMobile", "#emergencyNumber"].forEach(selector => {
    const input = document.querySelector(selector);
    if (input) {
      window.intlTelInput(input, {
        initialCountry: "in",
        preferredCountries: ["in", "us", "gb", "ke", "ng"],
        separateDialCode: true
      });
    }
  });
});

// New Patient Search Functionality
let allPatients = [];
function searchPatients(query) {
  if (!query.trim()) {
    $('#patientSearchResults').hide().empty();
    return;
  }

  $.ajax({
    url: `http://smarthospitalmaintain.com:8000/patients/search/?query=${encodeURIComponent(query)}`,
    type: 'GET',
    headers: getAuthHeaders(),
    success: function(response) {
      console.log('✅ Patients search response:', response);
      allPatients = response.patients || [];
      const resultsContainer = $('#patientSearchResults');
      resultsContainer.empty();

      if (allPatients.length === 0) {
        resultsContainer.append('<div>No patients found.</div>');
      } else {
        allPatients.forEach(patient => {
          resultsContainer.append(`
            <div data-patient-id="${patient.patient_id}" onclick="showPatientDetails('${patient.patient_id}')">
              ${patient.first_name} ${patient.last_name || ''} (ID: ${patient.patient_id}, Mobile: ${patient.mobile_number || 'N/A'})
            </div>
          `);
        });
      }
      resultsContainer.show();
    },
    error: function(xhr) {
      console.error('❌ Patient search error:', xhr.responseText);
      $('#patientSearchResults').hide().empty();
      displayAlert('Failed to search patients.', 'error');
    }
  });
}

function showPatientDetails(patientId) {
  const patient = allPatients.find(p => p.patient_id === patientId);
  if (!patient) {
    displayAlert('Patient not found.', 'error');
    return;
  }

  $('#patientDetailsContent').html(`
    <h6>Basic Information</h6>
    <table class="table table-bordered">
      <tr><th>Patient ID</th><td>${patient.patient_id}</td></tr>
      <tr><th>Name</th><td>${patient.first_name} ${patient.last_name || ''}</td></tr>
      <tr><th>Gender</th><td>${patient.gender || 'N/A'}</td></tr>
      <tr><th>DOB</th><td>${patient.date_of_birth || 'N/A'}</td></tr>
      <tr><th>Age</th><td>${patient.age || calculateAge(patient.date_of_birth) || 'N/A'}</td></tr>
      <tr><th>Mobile Number</th><td>${patient.mobile_number || 'N/A'}</td></tr>
      <tr><th>Email</th><td>${patient.email || 'N/A'}</td></tr>
      <tr><th>Address</th><td>${patient.address || 'N/A'}, ${patient.city || 'N/A'}, ${patient.pincode || 'N/A'}</td></tr>
    </table>
  `);

  $('#patientDetailsModal').modal('show');
  $('#patientSearchResults').hide();

  $('#makeAppointmentFromPatientBtn').off('click').on('click', function() {
    $('.modal').modal('hide');
    showAppointmentForm(patient.patient_id);
    fetchPatientDetails(patient.patient_id);
  });
}

$(document).ready(function() {
  checkSessionOnLoad();
  $("#logoutButton, #logoutDropdown").on("click", logoutUser);

  $('#patientSearchInput').on('input', function() {
    const query = $(this).val();
    searchPatients(query);
  });

  $(document).on('click', function(e) {
    if (!$(e.target).closest('.patient-search-container').length) {
      $('#patientSearchResults').hide();
    }
  });
});

// Store original values and units
const originalVitals = {};

$("#vitalsModal").on("show.bs.modal", function() {
  $("#vitalsForm")[0].reset();
  $("#vitalsForm .form-control").removeClass("is-invalid");
  $(".invalid-feedback").text("");

  const vitalFields = [
    "modalBloodPressure", "modalHeartRate", "modalTemperature", "modalRespiratoryRate",
    "modalOxygenSaturation", "modalWeight", "modalHeight"
  ];
  vitalFields.forEach(id => {
    const input = document.getElementById(id);
    const select = document.querySelector(`.unit-select[data-input="${id}"]`);
    originalVitals[id] = {
      value: input.value || "",
      unit: select ? select.options[0].value : null
    };
    if (select) select.setAttribute("data-prev-unit", originalVitals[id].unit);
  });
});

$(".unit-select").on("change", function() {
  const inputId = this.dataset.input;
  const toUnit = this.value;
  this.setAttribute("data-prev-unit", toUnit);
  console.log(`Unit for ${inputId} changed to ${toUnit}`);
});

function convertMeasurement(inputId) {
  const inputField = document.getElementById(inputId);
  const select = document.querySelector(`.unit-select[data-input="${inputId}"]`);
  const toUnit = select.value;
  const fromUnit = select.getAttribute("data-prev-unit") || select.options[0].value;
  const currentValue = inputField.value.trim();

  if (!currentValue) {
    displayAlert(`Enter a value for ${inputId} before converting.`, "error");
    return;
  }

  let newValue;
  if (inputId === "modalBloodPressure") {
    const [systolic, diastolic] = currentValue.split("/").map(v => parseFloat(v.trim()));
    if (isNaN(systolic) || isNaN(diastolic)) {
      displayAlert("Invalid blood pressure format. Use 'systolic/diastolic'.", "error");
      inputField.classList.add("is-invalid");
      document.getElementById(`${inputId}Feedback`).textContent = "Use format 'systolic/diastolic' (e.g., 120/80).";
      return;
    }
    const convertedSystolic = convertValue(systolic, fromUnit, toUnit, inputId);
    const convertedDiastolic = convertValue(diastolic, fromUnit, toUnit, inputId);
    newValue = `${convertedSystolic}/${convertedDiastolic}`;
  } else {
    const numericValue = parseFloat(currentValue);
    if (isNaN(numericValue)) {
      displayAlert(`Invalid value for ${inputId}. Enter a number.`, "error");
      inputField.classList.add("is-invalid");
      document.getElementById(`${inputId}Feedback`).textContent = "Enter a valid number.";
      return;
    }
    newValue = convertValue(numericValue, fromUnit, toUnit, inputId);
  }

  inputField.value = newValue;
  select.setAttribute("data-prev-unit", toUnit);
  inputField.classList.remove("is-invalid");
  document.getElementById(`${inputId}Feedback`).textContent = "";
}

function convertValue(value, fromUnit, toUnit, inputId) {
  if (fromUnit === toUnit) return value;

  const conversions = {
    "mmHg": { "kPa": v => v * 0.1333223684 },
    "kPa": { "mmHg": v => v / 0.1333223684 },
    "°C": { "°F": v => (v * 9/5) + 32 },
    "°F": { "°C": v => (v - 32) * 5/9 },
    "kg": { "lbs": v => v * 2.2046226218 },
    "lbs": { "kg": v => v / 2.2046226218 },
    "cm": { "in": v => v / 2.54 },
    "in": { "cm": v => v * 2.54 }
  };

  const conversionFunc = conversions[fromUnit]?.[toUnit];
  if (!conversionFunc) return value;

  const result = conversionFunc(value);
  return inputId === "modalBloodPressure" ? result.toFixed(2) : result.toFixed(2);
}

function validateVitals() {
  const validations = {
    "modalBloodPressure": {
      validate: val => {
        if (!val) return true;
        const [systolic, diastolic] = val.split("/").map(v => parseFloat(v));
        return !isNaN(systolic) && !isNaN(diastolic) && systolic >= 50 && systolic <= 250 && diastolic >= 30 && diastolic <= 150 && systolic > diastolic;
      },
      message: "Blood Pressure must be in 'systolic/diastolic' format (e.g., 120/80), with systolic 50-250 and diastolic 30-150 mmHg."
    },
    "modalHeartRate": {
      validate: val => !val || (!isNaN(val) && val >= 30 && val <= 200),
      message: "Heart Rate must be between 30-200 bpm."
    },
    "modalTemperature": {
      validate: val => {
        if (!val) return true;
        const temp = parseFloat(val);
        const unit = document.querySelector(`.unit-select[data-input="modalTemperature"]`).value;
        return !isNaN(temp) && (
          (unit === "°C" && temp >= 35 && temp <= 42) ||
          (unit === "°F" && temp >= 95 && temp <= 107.6)
        );
      },
      message: "Temperature must be 35-42°C or 95-107.6°F."
    },
    "modalRespiratoryRate": {
      validate: val => !val || (!isNaN(val) && val >= 8 && val <= 40),
      message: "Respiratory Rate must be between 8-40 breaths/min."
    },
    "modalOxygenSaturation": {
      validate: val => !val || (!isNaN(val) && val >= 70 && val <= 100),
      message: "Oxygen Saturation must be between 70-100%."
    },
    "modalWeight": {
      validate: val => {
        if (!val) return true;
        const weight = parseFloat(val);
        const unit = document.querySelector(`.unit-select[data-input="modalWeight"]`).value;
        return !isNaN(weight) && (
          (unit === "kg" && weight >= 2 && weight <= 300) ||
          (unit === "lbs" && weight >= 4.4 && weight <= 661)
        );
      },
      message: "Weight must be 2-300 kg or 4.4-661 lbs."
    },
    "modalHeight": {
      validate: val => {
        if (!val) return true;
        const height = parseFloat(val);
        const unit = document.querySelector(`.unit-select[data-input="modalHeight"]`).value;
        return !isNaN(height) && (
          (unit === "cm" && height >= 20 && height <= 250) ||
          (unit === "in" && height >= 7.9 && height <= 98.4)
        );
      },
      message: "Height must be 20-250 cm or 7.9-98.4 in."
    }
  };

  let isValid = true;
  Object.keys(validations).forEach(id => {
    const input = document.getElementById(id);
    const value = input.value.trim();
    const feedback = document.getElementById(`${id}Feedback`);
    if (!validations[id].validate(value)) {
      input.classList.add("is-invalid");
      feedback.textContent = validations[id].message;
      isValid = false;
    } else {
      input.classList.remove("is-invalid");
      feedback.textContent = "";
    }
  });
  return isValid;
}

function saveVitals() {
  if (!validateVitals()) {
    displayAlert("Please correct the invalid fields.", "error");
    return;
  }

  const appointmentId = $("#vitalsModal").data("appointmentId");
  if (!appointmentId) {
    displayAlert("Appointment ID is missing.", "error");
    return;
  }

  const vitalsData = {
    appointment: appointmentId,
    blood_pressure: $("#modalBloodPressure").val().trim() || null,
    heart_rate: $("#modalHeartRate").val().trim() || null,
    temperature: $("#modalTemperature").val().trim() || null,
    respiratory_rate: $("#modalRespiratoryRate").val().trim() || null,
    oxygen_saturation: $("#modalOxygenSaturation").val().trim() || null,
    weight: $("#modalWeight").val().trim() || null,
    height: $("#modalHeight").val().trim() || null,
    blood_pressure_unit: document.querySelector(`.unit-select[data-input="modalBloodPressure"]`).value,
    temperature_unit: document.querySelector(`.unit-select[data-input="modalTemperature"]`).value,
    weight_unit: document.querySelector(`.unit-select[data-input="modalWeight"]`).value,
    height_unit: document.querySelector(`.unit-select[data-input="modalHeight"]`).value
  };

  Object.keys(vitalsData).forEach(key => { if (vitalsData[key] === null) delete vitalsData[key]; });

  console.log("Saving vitals with data:", vitalsData);

  $.ajax({
    url: `http://smarthospitalmaintain.com:8000/appointments/vitals/${appointmentId}/`,
    type: "POST",
    headers: getAuthHeaders(),
    data: JSON.stringify(vitalsData),
    contentType: "application/json",
    success: function(response) {
      $("#vitalsModal").modal("hide");
      displayAlert("Vitals saved successfully!", "success");
      location.reload();
    },
    error: function(xhr) {
      const errorMsg = getErrorMessage(xhr, "Failed to save vitals.");
      displayAlert(errorMsg, "error");
    }
  });
}
