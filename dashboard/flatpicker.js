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