// clicks.js

// Function to update the details section to Appointment Details
function updateDetailsSection(patientData) {
    const detailsTitle = document.getElementById('detailsTitle');
    const detailsMeta = document.getElementById('detailsMeta');
    const visitPadBtn = document.getElementById('visitPadBtn');

    if (patientData) {
        const fullName = `${patientData.firstName} ${patientData.lastName}`;
        const age = patientData.age || 'N/A';
        const patientId = patientData.id || 'N/A';
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
    const patientData = {
        firstName: document.getElementById('patientFirstName').value,
        lastName: document.getElementById('patientLastName').value,
        gender: document.getElementById('patientGender').value,
        age: document.getElementById('patientAge').value,
        id: '12345' // Mock ID; replace with actual patient ID from API response
    };

    // Update the details section
    updateDetailsSection(patientData);

    // Switch to split view and show Add Bills tab in the sidebar
    toggleSplitView('addBills');

    // Optionally, switch the main tab to another tab (e.g., Profile)
    document.getElementById('profileTab').click();
});

document.getElementById('addAndCreateAppointment').addEventListener('click', function (e) {
    e.preventDefault();
    const patientData = {
        firstName: document.getElementById('patientFirstName').value,
        lastName: document.getElementById('patientLastName').value,
        gender: document.getElementById('patientGender').value,
        age: document.getElementById('patientAge').value,
        id: '12345' // Mock ID; replace with actual patient ID from API response
    };

    // Update the details section
    updateDetailsSection(patientData);

    // Switch to split view and show Appt tab in the sidebar
    toggleSplitView('addPatient');

    // Optionally, switch the main tab to another tab (e.g., Profile)
    document.getElementById('profileTab').click();
});

// Reset the modal view when the modal is closed
document.getElementById('newActionModal').addEventListener('hidden.bs.modal', function () {
    resetModalView();
    updateDetailsSection(null); // Reset the details section
});