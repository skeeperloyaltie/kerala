// main.js
$(document).ready(function () {
    const API_BASE_URL = "http://localhost:8000/api"; // Adjust to your Django API base URL
    let currentUser = null;
    let selectedAppointments = [];
    let currentPatientId = null;
  
    // Utility Functions
    function showNotification(message, type = "success") {
      const modal = $("#customNotification");
      const messageEl = $("#notificationMessage");
      modal.removeClass("success-message error-message");
      modal.addClass(`${type}-message`);
      messageEl.text(message);
      modal.modal("show");
      setTimeout(() => modal.modal("hide"), 2000);
    }
  
    function showAlert(message, type = "success") {
      const alert = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>`;
      $("#alertContainer").prepend(alert);
      setTimeout(() => $(".alert").alert("close"), 2000);
    }
  
    function getTimeOfDay() {
      const hour = new Date().getHours();
      return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
    }
  
    // Authentication Check
    function checkAuthentication() {
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "../profiling/login.html";
        return;
      }
      axios.defaults.headers.common["Authorization"] = `Token ${token}`;
      fetchUserProfile();
    }
  
    // Fetch User Profile
    function fetchUserProfile() {
      axios
        .get(`${API_BASE_URL}/users/profile/`)
        .then((response) => {
          currentUser = response.data;
          $("#logged_in_user_name, #logged_in_user_name_breadcrumb").text(
            `${currentUser.first_name} ${currentUser.last_name}`
          );
          $("#timeOfDay").text(getTimeOfDay());
          adjustUIForRole(currentUser.role);
          fetchDoctors();
          fetchAppointments();
        })
        .catch((error) => {
          console.error("Error fetching profile:", error);
          localStorage.removeItem("token");
          window.location.href = "../profiling/login.html";
        });
    }
  
    // Role-Based UI Adjustments
    function adjustUIForRole(role) {
      $(".nav-item").show(); // Show all by default
      if (role === "patient") {
        $(
          ".nav-item:contains('Patients'), .nav-item:contains('Medical Records'), .nav-item:contains('Prescriptions'), .nav-item:contains('Reports'), .nav-item:contains('Lab Tests')"
        ).hide();
        $("#cancelBtn, #rescheduleBtn").hide();
      } else if (role === "doctor") {
        $(".nav-item:contains('Reports')").hide();
      }
      // Admin sees all features
    }
  
    // Initialize Date Pickers
    flatpickr(".custom-datetime-picker", {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      time_24hr: true,
      minuteIncrement: 15,
      confirmButton: true,
      clearButton: true,
      onReady: function (selectedDates, dateStr, instance) {
        const confirmBtn = document.createElement("button");
        confirmBtn.innerText = "OK";
        confirmBtn.className = "flatpickr-confirm";
        confirmBtn.onclick = () => instance.close();
  
        const clearBtn = document.createElement("button");
        clearBtn.innerText = "Clear";
        clearBtn.className = "flatpickr-clear";
        clearBtn.onclick = () => instance.clear();
  
        instance.calendarContainer.appendChild(clearBtn);
        instance.calendarContainer.appendChild(confirmBtn);
      },
    });
  
    // Logout
    $("#logoutButton, #logoutDropdown").click(function (e) {
      e.preventDefault();
      localStorage.removeItem("token");
      window.location.href = "../profiling/login.html";
    });
  
    // Fetch Doctors
    function fetchDoctors() {
      axios
        .get(`${API_BASE_URL}/doctors/`)
        .then((response) => {
          const doctors = response.data;
          const doctorSelect = $("#doctor, #editDoctor, #patientPrimaryDoctor");
          doctorSelect.empty().append('<option value="" disabled selected>Select a doctor</option>');
          doctors.forEach((doctor) =>
            doctorSelect.append(
              `<option value="${doctor.id}">${doctor.first_name} ${doctor.last_name} - ${doctor.specialization}</option>`
            )
          );
        })
        .catch((error) => console.error("Error fetching doctors:", error));
    }
  
    // Patient Search
    $("#patientSearchInput").on("input", function () {
      const query = $(this).val();
      if (query.length < 2) {
        $("#patientSearchResults").hide();
        return;
      }
      axios
        .get(`${API_BASE_URL}/patients/search/?q=${query}`)
        .then((response) => {
          const results = response.data;
          const resultDiv = $("#patientSearchResults");
          resultDiv.empty();
          if (results.length > 0) {
            results.forEach((patient) => {
              resultDiv.append(
                `<div data-id="${patient.id}">${patient.first_name} ${patient.last_name} (ID: ${patient.id}, Mobile: ${patient.mobile}, DOB: ${patient.dob})</div>`
              );
            });
            resultDiv.show();
          } else {
            resultDiv.append("<div>No patients found</div>");
            resultDiv.show();
          }
        })
        .catch((error) => console.error("Error searching patients:", error));
    });
  
    $("#patientSearchResults").on("click", "div", function () {
      const patientId = $(this).data("id");
      if (patientId) {
        fetchPatientDetails(patientId);
        $("#patientSearchInput").val($(this).text());
        $("#patientSearchResults").hide();
      }
    });
  
    function fetchPatientDetails(patientId) {
      axios
        .get(`${API_BASE_URL}/patients/${patientId}/`)
        .then((response) => {
          const patient = response.data;
          currentPatientId = patient.id;
          $("#patientDetailsContent").html(`
            <p><strong>Name:</strong> ${patient.first_name} ${patient.last_name}</p>
            <p><strong>ID:</strong> ${patient.id}</p>
            <p><strong>Mobile:</strong> ${patient.mobile}</p>
            <p><strong>DOB:</strong> ${patient.dob}</p>
            <p><strong>Address:</strong> ${patient.address || "N/A"}</p>
          `);
          $("#patientDetailsModal").modal("show");
        })
        .catch((error) => console.error("Error fetching patient details:", error));
    }
  
    $("#makeAppointmentFromPatientBtn").click(function () {
      $("#patientDetailsModal").modal("hide");
      showAppointmentForm(currentPatientId);
    });
  
    // Fetch Appointments
    function fetchAppointments() {
      axios
        .get(`${API_BASE_URL}/appointments/`)
        .then((response) => {
          const appointments = response.data;
          const tabs = ["Waiting", "Scheduled", "Pending", "Completed", "Canceled", "Rescheduled"];
          tabs.forEach((status) => {
            const filtered = appointments.filter((appt) => appt.status === status);
            renderAppointments(filtered, status);
          });
        })
        .catch((error) => console.error("Error fetching appointments:", error));
    }
  
    function renderAppointments(appointments, status) {
      const tbody = $(`#${status}-tbody`);
      const thead = $(`#${status} thead tr`);
      tbody.empty();
      thead.empty();
  
      const headers = [
        currentUser.role !== "patient" ? '<th><input type="checkbox" id="selectAll"></th>' : "",
        "<th>Appointment ID</th>",
        "<th>Patient ID</th>",
        "<th>Patient Name</th>",
        "<th>Contact Number</th>",
        "<th>Date of Birth</th>",
        "<th>Age</th>",
        "<th>Current Illness</th>",
        "<th>Appointment Date</th>",
        "<th>Doctor</th>",
        "<th>Notes</th>",
        "<th>Actions</th>",
      ].filter(Boolean);
      thead.append(headers.join(""));
  
      appointments.forEach((appt) => {
        const row = `
          <tr>
            ${currentUser.role !== "patient" ? `<td><input type="checkbox" class="appointment-checkbox" data-id="${appt.id}"></td>` : ""}
            <td>${appt.id}</td>
            <td>${appt.patient_id}</td>
            <td>${appt.patient_first_name} ${appt.patient_last_name}</td>
            <td>${appt.patient_contact_number}</td>
            <td>${appt.patient_dob}</td>
            <td>${appt.patient_age}</td>
            <td>${appt.current_illness || "N/A"}</td>
            <td>${appt.appointment_date}</td>
            <td>${appt.doctor_name}</td>
            <td>${appt.notes || "N/A"}</td>
            <td>
              <button class="btn btn-info btn-sm" onclick="editAppointment(${appt.id})">Edit</button>
              ${currentUser.role !== "patient" ? `
                <button class="btn btn-primary btn-sm" onclick="showVitalsModal(${appt.id})">Vitals</button>
                <button class="btn btn-warning btn-sm" onclick="rescheduleModal(${appt.id})">Reschedule</button>
                <button class="btn btn-danger btn-sm" onclick="cancelAppointment(${appt.id})">Cancel</button>
              ` : ""}
            </td>
          </tr>`;
        tbody.append(row);
      });
  
      $("#selectAll").change(function () {
        const checked = $(this).is(":checked");
        $(`#${status}-tbody .appointment-checkbox`).prop("checked", checked).trigger("change");
      });
  
      $(`#${status}-tbody .appointment-checkbox`).change(function () {
        selectedAppointments = $(`#${status}-tbody .appointment-checkbox:checked`)
          .map((_, el) => $(el).data("id"))
          .get();
        $("#cancelBtn, #rescheduleBtn").toggleClass("d-none", selectedAppointments.length === 0);
      });
    }
  
    // Appointment Form Handling
    function showAppointmentForm(patientId = null) {
      $("#appointmentFormContainer").show();
      $("#appointmentForm")[0].reset();
      if (patientId) {
        axios
          .get(`${API_BASE_URL}/patients/${patientId}/`)
          .then((response) => {
            const patient = response.data;
            $("#patientID").val(patient.id);
            $("#firstName").val(patient.first_name);
            $("#lastName").val(patient.last_name);
            $("#contactNumber").val(patient.mobile);
            $("#dateOfBirth").val(patient.dob);
            $("#age").val(calculateAge(patient.dob));
          })
          .catch((error) => console.error("Error fetching patient:", error));
      }
    }
  
    function hideAppointmentForm() {
      $("#appointmentFormContainer").hide();
      $("#appointmentForm")[0].reset();
    }
  
    function calculateAge(dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
      return age;
    }
  
    function addAppointment() {
      const patientID = $("#patientID").val();
      const appointmentDate = $("#appointmentDate").val();
      const doctor = $("#doctor").val();
      const notes = $("#notes").val();
      const currentIllness = $("#currentIllness").val();
  
      axios
        .post(`${API_BASE_URL}/appointments/`, {
          patient_id: patientID,
          appointment_date: appointmentDate,
          doctor_id: doctor,
          notes,
          current_illness: currentIllness,
          status: "Scheduled",
        })
        .then((response) => {
          showVitalsModal(response.data.id);
          hideAppointmentForm();
          fetchAppointments();
          showNotification("Appointment created successfully!");
        })
        .catch((error) => {
          console.error("Error creating appointment:", error);
          showNotification("Failed to create appointment.", "error");
        });
    }
  
    // Vitals Handling
    function showVitalsModal(appointmentId) {
      $("#vitalsModal").data("appointmentId", appointmentId);
      $("#vitalsForm")[0].reset();
      $("#vitalsModal").modal("show");
    }
  
    function saveVitals() {
      const appointmentId = $("#vitalsModal").data("appointmentId");
      const vitals = {
        blood_pressure: $("#modalBloodPressure").val(),
        heart_rate: $("#modalHeartRate").val(),
        temperature: $("#modalTemperature").val(),
        respiratory_rate: $("#modalRespiratoryRate").val(),
        oxygen_saturation: $("#modalOxygenSaturation").val(),
        weight: $("#modalWeight").val(),
        height: $("#modalHeight").val(),
      };
  
      axios
        .post(`${API_BASE_URL}/vitals/`, { appointment_id: appointmentId, ...vitals })
        .then(() => {
          $("#vitalsModal").modal("hide");
          showNotification("Vitals saved successfully!");
        })
        .catch((error) => {
          console.error("Error saving vitals:", error);
          showNotification("Failed to save vitals.", "error");
        });
    }
  
    // Edit Appointment
    window.editAppointment = function (appointmentId) {
      axios
        .get(`${API_BASE_URL}/appointments/${appointmentId}/`)
        .then((response) => {
          const appt = response.data;
          $("#editAppointmentID").val(appt.id);
          $("#editPatientID").val(appt.patient_id);
          $("#editFirstName").val(appt.patient_first_name);
          $("#editLastName").val(appt.patient_last_name);
          $("#editContactNumber").val(appt.patient_contact_number);
          $("#editDateOfBirth").val(appt.patient_dob);
          $("#editAge").val(appt.patient_age);
          $("#editCurrentIllness").val(appt.current_illness);
          $("#editAppointmentDate").val(appt.appointment_date);
          $("#editDoctor").val(appt.doctor_id);
          $("#editNotes").val(appt.notes);
          $("#editAppointmentStatus").val(appt.status);
          $("#editIsEmergency").prop("checked", appt.is_emergency);
          $("#editAppointmentModal").modal("show");
        })
        .catch((error) => console.error("Error fetching appointment:", error));
    };
  
    function updateAppointment() {
      const appointmentId = $("#editAppointmentID").val();
      const data = {
        patient_id: $("#editPatientID").val(),
        first_name: $("#editFirstName").val(),
        last_name: $("#editLastName").val(),
        contact_number: $("#editContactNumber").val(),
        dob: $("#editDateOfBirth").val(),
        current_illness: $("#editCurrentIllness").val(),
        appointment_date: $("#editAppointmentDate").val(),
        doctor_id: $("#editDoctor").val(),
        notes: $("#editNotes").val(),
        status: $("#editAppointmentStatus").val(),
        is_emergency: $("#editIsEmergency").is(":checked"),
      };
  
      axios
        .put(`${API_BASE_URL}/appointments/${appointmentId}/`, data)
        .then(() => {
          $("#editAppointmentModal").modal("hide");
          fetchAppointments();
          showNotification("Appointment updated successfully!");
        })
        .catch((error) => {
          console.error("Error updating appointment:", error);
          showNotification("Failed to update appointment.", "error");
        });
    }
  
    // Reschedule Appointment
    window.rescheduleModal = function (appointmentId) {
      $("#rescheduleAppointmentID").val(appointmentId);
      $("#newAppointmentDate").val("");
      $("#rescheduleAppointmentModal").modal("show");
    };
  
    window.rescheduleAppointment = function () {
      const appointmentId = $("#rescheduleAppointmentID").val();
      const newDate = $("#newAppointmentDate").val();
  
      axios
        .patch(`${API_BASE_URL}/appointments/${appointmentId}/`, {
          appointment_date: newDate,
          status: "Rescheduled",
        })
        .then(() => {
          $("#rescheduleAppointmentModal").modal("hide");
          fetchAppointments();
          showNotification("Appointment rescheduled successfully!");
        })
        .catch((error) => {
          console.error("Error rescheduling appointment:", error);
          showNotification("Failed to reschedule appointment.", "error");
        });
    };
  
    // Cancel Appointment
    window.cancelAppointment = function (appointmentId) {
      if (confirm("Are you sure you want to cancel this appointment?")) {
        axios
          .patch(`${API_BASE_URL}/appointments/${appointmentId}/`, { status: "Canceled" })
          .then(() => {
            fetchAppointments();
            showNotification("Appointment canceled successfully!");
          })
          .catch((error) => {
            console.error("Error canceling appointment:", error);
            showNotification("Failed to cancel appointment.", "error");
          });
      }
    };
  
    // Bulk Actions
    window.bulkCancel = function () {
      if (selectedAppointments.length === 0) return;
      if (confirm(`Cancel ${selectedAppointments.length} appointments?`)) {
        Promise.all(
          selectedAppointments.map((id) =>
            axios.patch(`${API_BASE_URL}/appointments/${id}/`, { status: "Canceled" })
          )
        )
          .then(() => {
            selectedAppointments = [];
            $("#cancelBtn, #rescheduleBtn").addClass("d-none");
            fetchAppointments();
            showNotification("Selected appointments canceled successfully!");
          })
          .catch((error) => {
            console.error("Error in bulk cancel:", error);
            showNotification("Failed to cancel appointments.", "error");
          });
      }
    };
  
    window.bulkReschedule = function () {
      if (selectedAppointments.length === 0) return;
      $("#rescheduleAppointmentModal").modal("show");
      $("#rescheduleForm").off("submit").on("submit", function (e) {
        e.preventDefault();
        const newDate = $("#newAppointmentDate").val();
        Promise.all(
          selectedAppointments.map((id) =>
            axios.patch(`${API_BASE_URL}/appointments/${id}/`, {
              appointment_date: newDate,
              status: "Rescheduled",
            })
          )
        )
          .then(() => {
            $("#rescheduleAppointmentModal").modal("hide");
            selectedAppointments = [];
            $("#cancelBtn, #rescheduleBtn").addClass("d-none");
            fetchAppointments();
            showNotification("Selected appointments rescheduled successfully!");
          })
          .catch((error) => {
            console.error("Error in bulk reschedule:", error);
            showNotification("Failed to reschedule appointments.", "error");
          });
      });
    };
  
    // Create Patient
    $("#savePatientBtn").click(function () {
      const patientData = {
        first_name: $("#patientFirstName").val(),
        last_name: $("#patientLastName").val(),
        gender: $("#patientGender").val(),
        dob: $("#patientDob").val(),
        father_name: $("#patientFatherName").val(),
        address: $("#patientAddress").val(),
        city: $("#patientCity").val(),
        pincode: $("#patientPincode").val(),
        email: $("#patientEmail").val(),
        mobile: $("#patientMobile").val(),
        alt_mobile: $("#patientAltMobile").val(),
        aadhar: $("#patientAadhar").val(),
        admission_type: $("#admissionType").val(),
        blood_group: $("#patientBloodGroup").val(),
        allergies: $("#patientAllergies").val(),
        medications: $("#patientMedications").val(),
        past_history: $("#patientPastHistory").val(),
        notes: $("#patientNotes").val(),
        primary_doctor: $("#patientPrimaryDoctor").val(),
        emergency_name: $("#emergencyName").val(),
        emergency_relation: $("#emergencyRelation").val(),
        emergency_number: $("#emergencyNumber").val(),
        insurance_provider: $("#insuranceProvider").val(),
        policy_number: $("#policyNumber").val(),
        payment_preference: $("#paymentPreference").val(),
      };
  
      axios
        .post(`${API_BASE_URL}/patients/`, patientData)
        .then((response) => {
          $("#createPatientModal").modal("hide");
          $("#newPatientIdInput").val(response.data.id);
          $("#patientIdPopupModal").modal("show");
          showNotification("Patient created successfully!");
        })
        .catch((error) => {
          console.error("Error creating patient:", error);
          showNotification("Failed to create patient.", "error");
        });
    });
  
    $("#copyPatientIdBtn").click(function () {
      const patientId = $("#newPatientIdInput").val();
      navigator.clipboard.writeText(patientId).then(() => {
        $("#copySuccessMsg").show();
        setTimeout(() => $("#copySuccessMsg").hide(), 2000);
      });
    });
  
    $("#makeAppointmentBtn").click(function () {
      $("#patientIdPopupModal").modal("hide");
      showAppointmentForm($("#newPatientIdInput").val());
    });
  
    // Search Filter
    $(".search-filter input").on("input", function () {
      const filters = {
        patient_id: $("#searchPatientId").val(),
        name: $("#searchName").val(),
        mobile: $("#searchMobile").val(),
        dob: $("#searchDob").val(),
        date: $("#searchDate").val(),
      };
      axios
        .get(`${API_BASE_URL}/appointments/`, { params: filters })
        .then((response) => {
          const appointments = response.data;
          const tabs = ["Waiting", "Scheduled", "Pending", "Completed", "Canceled", "Rescheduled"];
          tabs.forEach((status) => {
            const filtered = appointments.filter((appt) => appt.status === status);
            renderAppointments(filtered, status);
          });
        })
        .catch((error) => console.error("Error filtering appointments:", error));
    });
  
    // Initial Setup
    checkAuthentication();
  });