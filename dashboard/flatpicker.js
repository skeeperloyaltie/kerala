function initializeDatePickers() {
  console.log("Initializing Flatpickr for .custom-datetime-picker elements...");
  $(".custom-datetime-picker").each(function() {
    const $input = $(this);
    const inputId = $input.attr("id");

    if (!inputId) {
      console.warn("Skipping Flatpickr initialization for element without id:", $input);
      return;
    }

    if (!$input.length) {
      console.warn("Element not found for Flatpickr initialization:", inputId);
      return;
    }

    console.log("Processing input:", inputId);

    const isDateOnly = ["patientDOB", "maritalSince", "billDate"].includes(inputId);

    if ($input[0]._flatpickr) {
      $input[0]._flatpickr.destroy();
      console.log(`Destroyed existing Flatpickr instance for #${inputId}`);
    }

    // Base configuration
    let config = {
      altInput: true,
      altFormat: isDateOnly ? "F j, Y" : "F j, Y, h:i K", // Readable format
      dateFormat: isDateOnly ? "Y-m-d" : "Y-m-d H:i",     // Backend format
      enableTime: !isDateOnly,
      time_24hr: false,
      minDate: ["appointmentDate"].includes(inputId) ? new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }) : null,
      maxDate: ["patientDOB", "maritalSince"].includes(inputId) ? "today" : null,
      defaultDate: ["billDate"].includes(inputId) ? "today" : null, // Set default to today for billDate
      appendTo: document.body,
      position: "auto",
      allowInput: true, // Allow manual input of dates
      // clickOpens: false, // Optional: Uncomment if you want to disable click-to-open
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
      },
      onClose: function(selectedDates, dateStr, instance) {
        if (selectedDates.length === 0) {
          $input.val("");
          console.log(`Cleared #${inputId} on close due to no selection`);
        }
      },
      onChange: function(selectedDates, dateStr, instance) {
        console.log(`#${inputId} changed - Selected Date:`, selectedDates[0], "Formatted:", dateStr);
      }
    };

    // Initialize Flatpickr
    const instance = flatpickr($input[0], config);
    console.log(`Flatpickr initialized for #${inputId} with config:`, config);

    // Ensure readonly state is respected
    if ($input.attr("readonly")) {
      $input.next(".flatpickr-input").prop("readonly", true);
    }
  });
}

// Initialize on page load and modal show
$(document).ready(function() {
  initializeDatePickers();

  $("#newActionModal").on("shown.bs.modal", function() {
    initializeDatePickers();
  });
});