function initializeDatePickers() {
  console.log("Initializing Flatpickr for .custom-datetime-picker elements and #dateFilter...");

  // Handle .custom-datetime-picker elements (patientDOB, maritalSince, billDate, appointmentDate)
  $(".custom-datetime-picker").each(function() {
    const $input = $(this);
    const inputId = $input.attr("id");

    if (!inputId) {
      console.warn("Skipping Flatpickr initialization for element without id:", $input);
      return;
    }

    if (!$input.length) {
      console.warn(`Element not found for Flatpickr initialization: #${inputId}`);
      return;
    }

    console.log(`Processing input: #${inputId}`);

    const isDateOnly = ["patientDOB", "maritalSince", "billDate"].includes(inputId);

    // Destroy any existing instance to prevent duplicates
    if ($input[0]._flatpickr) {
      $input[0]._flatpickr.destroy();
      console.log(`Destroyed existing Flatpickr instance for #${inputId}`);
    }

    // Base configuration for custom-datetime-picker
    let config = {
      altInput: true,
      altFormat: isDateOnly ? "F j, Y" : "F j, Y, h:i K", // Readable format
      dateFormat: isDateOnly ? "Y-m-d" : "Y-m-d H:i",     // Backend format
      enableTime: !isDateOnly,
      time_24hr: false,
      allowInput: true, // Explicitly allow manual input
      clickOpens: true, // Allow clicking to open the calendar
      minDate: ["appointmentDate"].includes(inputId)
        ? new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        : null,
      maxDate: ["patientDOB", "maritalSince"].includes(inputId) ? "today" : null,
      defaultDate: ["billDate"].includes(inputId) ? "today" : null,
      appendTo: document.body,
      position: "auto",
      // Enable year and month dropdowns for all inputs
      yearDropdown: true, // Show year dropdown
      monthDropdown: true, // Show month dropdown
      // Set year range for all inputs (1900 to current year + 10 for future appointments)
      minYear: 1900,
      maxYear: new Date().getFullYear() + 10,
      onReady: function(selectedDates, dateStr, instance) {
        const calendar = instance.calendarContainer;
        const inputRect = $input[0].getBoundingClientRect();
        const calendarRect = calendar.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Position calendar to avoid overflow
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

        // Add OK and Clear buttons
        const buttonContainer = document.createElement("div");
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "center";
        buttonContainer.style.gap = "10px";
        buttonContainer.style.padding = "5px";

        const confirmButton = document.createElement("button");
        confirmButton.innerText = "OK";
        confirmButton.className = "flatpickr-confirm btn btn-sm btn-primary";
        confirmButton.onclick = function() {
          if (selectedDates.length > 0) {
            instance.close();
            $input.removeClass("is-invalid");
          }
        };

        const clearButton = document.createElement("button");
        clearButton.innerText = "Clear";
        clearButton.className = "flatpickr-clear btn btn-sm btn-secondary";
        clearButton.onclick = function() {
          instance.clear();
          $input.val("");
          $input.removeClass("is-invalid");
          instance.close();
        };

        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(clearButton);
        instance.calendarContainer.appendChild(buttonContainer);

        // Ensure the hidden input isn’t readonly unless explicitly set
        if (!$input.attr("readonly")) {
          instance.altInput.removeAttribute("readonly");
        }
      },
      onChange: function(selectedDates, dateStr, instance) {
        console.log(`#${inputId} changed - Selected Date:`, selectedDates[0], "Formatted:", dateStr);
      },
      onClose: function(selectedDates, dateStr, instance) {
        if (selectedDates.length === 0) {
          $input.val("");
          console.log(`Cleared #${inputId} on close due to no selection`);
        }
      }
    };

    // Initialize Flatpickr
    const instance = flatpickr($input[0], config);
    console.log(`Flatpickr initialized for #${inputId} with config:`, config);

    // Ensure readonly state is respected for the visible altInput
    if ($input.attr("readonly")) {
      $input.next(".flatpickr-input").prop("readonly", true);
    } else {
      $input.next(".flatpickr-input").prop("readonly", false);
    }
  });

  // Handle #dateFilter separately
  const $dateFilter = $("#dateFilter");
  if (!$dateFilter.length) {
    console.warn("Skipping Flatpickr initialization for #dateFilter: Element not found");
    return;
  }

  console.log("Processing input: #dateFilter");

  // Destroy any existing instance
  if ($dateFilter[0]._flatpickr) {
    $dateFilter[0]._flatpickr.destroy();
    console.log("Destroyed existing Flatpickr instance for #dateFilter");
  }

  // Initialize appointmentsData for highlighting
  let appointmentsData = [];

  // Configuration for #dateFilter
  const dateFilterConfig = {
    dateFormat: "Y-m-d",
    defaultDate: new Date(),
    allowInput: true, // Explicitly allow manual input
    clickOpens: true, // Allow clicking to open the calendar
    minDate: "1900-01-01",
    altInput: true,
    altFormat: "F j, Y",
    appendTo: document.body,
    position: "auto",
    // Enable year and month dropdowns
    yearDropdown: true, // Show year dropdown
    monthDropdown: true, // Show month dropdown
    // Set year range
    minYear: 1900,
    maxYear: new Date().getFullYear() + 10,
    onChange: function(selectedDates, dateStr, instance) {
      console.log("📅 Date Filter Changed - Selected date:", dateStr);
      if (dateStr) {
        const doctorId = $("#doctorFilter").val() || "all";
        const filter = $(".navbar-secondary .nav-item a.active").data("section") || "all";
        fetchAppointmentsByDate(dateStr, filter, doctorId);
      }
    },
    onOpen: function(selectedDates, dateStr, instance) {
      const currentDate = dateStr || instance.formatDate(new Date(), "Y-m-d");
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6); // End on Saturday
      const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
      const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      let url = `${API_BASE_URL}/appointments/list/?start_date=${startDateStr}&end_date=${endDateStr}`;
      const doctorId = $("#doctorFilter").val() || "all";
      if (doctorId !== "all") {
        url += `&doctor_id=${doctorId}`;
      }

      $.ajax({
        url: url,
        type: "GET",
        headers: getAuthHeaders(),
        success: function(data) {
          appointmentsData = Array.isArray(data.appointments)
            ? data.appointments
            : Array.isArray(data.results)
            ? data.results
            : Array.isArray(data)
            ? data
            : [];
          console.log(`📅 Loaded ${appointmentsData.length} appointments for calendar picker`);
          instance.redraw();
        },
        error: function(xhr) {
          console.warn(`⚠️ Failed to load appointments for calendar: ${xhr.responseJSON?.error || "Unknown error"}`);
          appointmentsData = [];
          instance.redraw();
        }
      });
    },
    onDayCreate: function(dObj, dStr, fp, dayElem) {
      const date = dayElem.dateObj;
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const hasAppointments = appointmentsData.some(appt => {
        if (!appt.appointment_date) return false;
        const apptDate = new Date(appt.appointment_date);
        const apptDateStr = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, "0")}-${String(apptDate.getDate()).padStart(2, "0")}`;
        return apptDateStr === dateStr;
      });
      if (hasAppointments) {
        dayElem.classList.add("has-appointment");
        dayElem.style.backgroundColor = "#e3f2fd";
        dayElem.style.border = "1px solid #2196f3";
      }
    },
    onReady: function(selectedDates, dateStr, instance) {
      const calendar = instance.calendarContainer;
      const inputRect = $dateFilter[0].getBoundingClientRect();
      const calendarRect = calendar.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Position calendar to avoid overflow
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
    }
  };

  // Initialize Flatpickr for #dateFilter
  const dateFilterInstance = flatpickr($dateFilter[0], dateFilterConfig);
  console.log("Flatpickr initialized for #dateFilter with config:", dateFilterConfig);

  // Ensure readonly state is respected
  if ($dateFilter.attr("readonly")) {
    $dateFilter.next(".flatpickr-input").prop("readonly", true);
  } else {
    $dateFilter.next(".flatpickr-input").prop("readonly", false);
  }
}

// Initialize on page load and modal show
$(document).ready(function() {
  initializeDatePickers();

  $("#newActionModal").on("shown.bs.modal", function() {
    initializeDatePickers();
  });
});