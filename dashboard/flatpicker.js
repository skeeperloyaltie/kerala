  //flatpicker.js
  // Initialize Flatpickr for date pickers
  flatpickr("#dateFilter", {
    dateFormat: "Y-m-d",
    defaultDate: "2025-03-17"
  });

  // Navigation Tab Switching
  document.querySelectorAll('.navbar-secondary .nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelectorAll('.navbar-secondary .nav-link').forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Ensure dropdowns adjust to window width
  document.querySelectorAll('.dropdown').forEach(dropdown => {
    dropdown.addEventListener('show.bs.dropdown', function () {
      const dropdownMenu = this.querySelector('.dropdown-menu');
      const rect = dropdownMenu.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      if (rect.right > windowWidth) {
        dropdownMenu.style.right = '0';
        dropdownMenu.style.left = 'auto';
      }
    });
  });


  // Initialize Flatpickr for Date of Birth
flatpickr("#patientDOB", {
  dateFormat: "Y-m-d",
  maxDate: "today",
  onChange: function (selectedDates, dateStr) {
    console.log("📅 Patient DOB Changed - Selected date:", dateStr);
  }
});

// Initialize Flatpickr for Marital Since
flatpickr("#maritalSince", {
  dateFormat: "Y-m-d",
  maxDate: "today",
  onChange: function (selectedDates, dateStr) {
    console.log("📅 Marital Since Changed - Selected date:", dateStr);
  }
});

// Initialize Flatpickr for Appointment Date
flatpickr("#appointmentDate", {
  enableTime: true,
  dateFormat: "Y-m-d\\TH:i:S",
  minDate: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }), // Set minDate to current time in Asia/Kolkata
  defaultDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }), // Default to tomorrow
  onChange: function (selectedDates, dateStr) {
    console.log("📅 Appointment Date Changed - Selected date:", dateStr);
  }
});