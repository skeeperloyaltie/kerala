// clicks.js

function updateDetailsSection(patientData) {
  const detailsTitle = document.getElementById('detailsTitle');
  const detailsMeta = document.getElementById('detailsMeta');
  const visitPadBtn = document.getElementById('visitPadBtn');

  if (patientData) {
    const fullName = `${patientData.first_name} ${patientData.last_name || ''}`;
    const age = patientData.age || 'N/A';
    const patientId = patientData.patient_id || 'N/A';
    detailsTitle.textContent = `Patient: ${fullName}`;
    detailsMeta.textContent = `${patientData.gender || 'N/A'} | ${age} Years | ${patientId}`;
    visitPadBtn.style.display = 'inline-block';
  } else {
    detailsTitle.textContent = 'No Patient Selected';
    detailsMeta.textContent = 'N/A | N/A | N/A';
    visitPadBtn.style.display = 'none';
  }
}

function toggleSplitView(tabId) {
  const modalBody = document.getElementById('modalBody');
  const sidebarContentArea = document.getElementById('sidebarContentArea');
  const sidebarTabContent = document.getElementById('sidebarTabContent');

  const tabContent = document.querySelector(`#${tabId}`).cloneNode(true);
  sidebarTabContent.innerHTML = '';
  sidebarTabContent.appendChild(tabContent);

  modalBody.classList.add('split-view');
  sidebarContentArea.style.display = 'block';

  const sidebarTabPane = sidebarTabContent.querySelector(`#${tabId}`);
  sidebarTabPane.classList.add('show', 'active');
}

function resetModalView() {
  const modalBody = document.getElementById('modalBody');
  const sidebarContentArea = document.getElementById('sidebarContentArea');
  modalBody.classList.remove('split-view');
  sidebarContentArea.style.display = 'none';
}

document.getElementById('addAndCreateBill').addEventListener('click', function (e) {
  e.preventDefault();
  document.getElementById('addPatientForm').dispatchEvent(new Event('submit'));
});

document.getElementById('addAndCreateAppointment').addEventListener('click', function (e) {
  e.preventDefault();
  document.getElementById('addPatientForm').dispatchEvent(new Event('submit'));
});

$('.navbar-secondary .nav-link').on('click', function (e) {
  e.preventDefault();
  $('.navbar-secondary .nav-link').removeClass('active');
  $(this).addClass('active');
});

$('.dropdown').on('show.bs.dropdown', function () {
  const dropdownMenu = $(this).find('.dropdown-menu');
  const rect = dropdownMenu[0].getBoundingClientRect();
  const windowWidth = window.innerWidth;
  if (rect.right > windowWidth) {
    dropdownMenu.css({ right: '0', left: 'auto' });
  }
});

document.getElementById('newActionModal').addEventListener('hidden.bs.modal', function () {
  resetModalView();
  updateDetailsSection(null);
});