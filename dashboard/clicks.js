// clicks.js

// Function to update the details section to Appointment Details
function updateDetailsSection(patientData) {
    const detailsTitle = document.getElementById('detailsTitle');
    const detailsMeta = document.getElementById('detailsMeta');
    const visitPadBtn = document.getElementById('visitPadBtn');
  
    if (patientData) {
      const fullName = `${patientData.first_name} ${patientData.last_name}`;
      const age = patientData.age || 'N/A';
      const patientId = patientData.patient_id || 'N/A';
      detailsTitle.textContent = `Appointment for ${fullName}`;
      detailsMeta.textContent = `${patientData.gender || 'N/A'} | ${age} Years | ${patientId}`;
      visitPadBtn.style.display = 'inline-block';
    } else {
      detailsTitle.textContent = 'No Patient Selected';
      detailsMeta.textContent = 'N/A | N/A | N/A';
      visitPadBtn.style.display = 'none';
    }
  }
  
  // Function to toggle the split view and populate the sidebar
  function toggleSplitView(tabId) {
    const modalBody = document.getElementById('modalBody');
    const sidebarContentArea = document.getElementById('sidebarContentArea');
    const sidebarTabContent = document.getElementById('sidebarTabContent');
  
    // Clone the tab content to the sidebar
    const tabContent = document.querySelector(`#${tabId}`).cloneNode(true);
    sidebarTabContent.innerHTML = '';
    sidebarTabContent.appendChild(tabContent);
  
    // Show the split view
    modalBody.classList.add('split-view');
    sidebarContentArea.style.display = 'block';
  
    // Activate the tab in the sidebar
    const sidebarTabPane = sidebarTabContent.querySelector(`#${tabId}`);
    sidebarTabPane.classList.add('show', 'active');
  }
  
  // Function to reset the modal to single view
  function resetModalView() {
    const modalBody = document.getElementById('modalBody');
    const sidebarContentArea = document.getElementById('sidebarContentArea');
    modalBody.classList.remove('split-view');
    sidebarContentArea.style.display = 'none';
  }
  
  // Bind click events for Add & Create Bill and Add & Create Appointment
  document.getElementById('addAndCreateBill').addEventListener('click', function (e) {
    e.preventDefault();
    // Trigger form submission (handled in main.js)
    document.getElementById('addPatientForm').dispatchEvent(new Event('submit'));
  
    // After successful submission, this will be called in main.js success callback
    // The split view toggle will be handled after the API response
  });
  
  document.getElementById('addAndCreateAppointment').addEventListener('click', function (e) {
    e.preventDefault();
    // Trigger form submission (handled in main.js)
    document.getElementById('addPatientForm').dispatchEvent(new Event('submit'));
  
    // After successful submission, this will be called in main.js success callback
    // The split view toggle will be handled after the API response
  });
  
  // Reset the modal view when the modal is closed
  document.getElementById('newActionModal').addEventListener('hidden.bs.modal', function () {
    resetModalView();
    updateDetailsSection(null); // Reset the details section
  });