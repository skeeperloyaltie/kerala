
    // Mock patient data (simulating a database)
    const patients = [
        { firstName: "Gopi", lastName: "Krishnan", phone: "9876543210" },
        { firstName: "Gopi", lastName: "Nair", phone: "9123456789" },
        { firstName: "Suresh", lastName: "Kumar", phone: "9988776655" },
        { firstName: "Anita", lastName: "Gopi", phone: "9876541230" },
        { firstName: "Gopi", lastName: "Sharma", phone: "9765432109" }
        ];
        
        // Autocomplete for First Name
        const firstNameInput = document.getElementById('patientFirstName');
        const firstNameSuggestions = document.getElementById('firstNameSuggestions');
        const lastNameInput = document.getElementById('patientLastName');
        const lastNameSuggestions = document.getElementById('lastNameSuggestions');
        
        firstNameInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        firstNameSuggestions.innerHTML = '';
        firstNameSuggestions.style.display = 'none';
        
        if (query.length > 0) {
            const matches = patients.filter(patient => patient.firstName.toLowerCase().includes(query));
            if (matches.length > 0) {
                matches.forEach(patient => {
                    const li = document.createElement('li');
                    li.classList.add('dropdown-item');
                    li.textContent = `${patient.firstName} ${patient.lastName} (${patient.phone})`;
                    li.addEventListener('click', () => {
                        firstNameInput.value = patient.firstName;
                        lastNameInput.value = patient.lastName;
                        document.getElementById('patientPhone').value = patient.phone;
                        firstNameSuggestions.style.display = 'none';
                        lastNameSuggestions.style.display = 'none';
                    });
                    firstNameSuggestions.appendChild(li);
                });
                firstNameSuggestions.style.display = 'block';
            }
        }
        });
        
        // Autocomplete for Last Name
        lastNameInput.addEventListener('input', function () {
        const query = this.value.toLowerCase();
        lastNameSuggestions.innerHTML = '';
        lastNameSuggestions.style.display = 'none';
        
        if (query.length > 0) {
            const matches = patients.filter(patient => patient.lastName.toLowerCase().includes(query));
            if (matches.length > 0) {
                matches.forEach(patient => {
                    const li = document.createElement('li');
                    li.classList.add('dropdown-item');
                    li.textContent = `${patient.firstName} ${patient.lastName} (${patient.phone})`;
                    li.addEventListener('click', () => {
                        firstNameInput.value = patient.firstName;
                        lastNameInput.value = patient.lastName;
                        document.getElementById('patientPhone').value = patient.phone;
                        firstNameSuggestions.style.display = 'none';
                        lastNameSuggestions.style.display = 'none';
                    });
                    lastNameSuggestions.appendChild(li);
                });
                lastNameSuggestions.style.display = 'block';
            }
        }
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', function (e) {
        if (!firstNameInput.contains(e.target) && !firstNameSuggestions.contains(e.target)) {
            firstNameSuggestions.style.display = 'none';
        }
        if (!lastNameInput.contains(e.target) && !lastNameSuggestions.contains(e.target)) {
            lastNameSuggestions.style.display = 'none';
        }
        });
        
        // Initialize Flatpickr for date fields
        flatpickr("#maritalSince", {
        dateFormat: "Y-m-d"
        });