$(document).ready(function () {
    // Initialize intl-tel-input for phone numbers
    const phoneInput = document.querySelector("#patientPhone");
    const mobile2Input = document.querySelector("#mobile2");
    
    const itiPhone = intlTelInput(phoneInput, {
      initialCountry: "in", // Default to India
      separateDialCode: true, // Show dial code separately
      utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js" // For formatting/validation
    });
    
    const itiMobile2 = intlTelInput(mobile2Input, {
      initialCountry: "in", // Default to India
      separateDialCode: true,
      utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js"
    });
  
    // Validation Functions
    function validateField($input, condition, errorMessage) {
      if (condition) {
        $input.removeClass("is-invalid").addClass("is-valid");
        $input.next(".invalid-feedback").remove();
      } else {
        $input.removeClass("is-valid").addClass("is-invalid");
        if (!$input.next(".invalid-feedback").length) {
          $input.after(`<div class="invalid-feedback">${errorMessage}</div>`);
        }
      }
    }
  
    // Real-time Validation
    $("#patientFirstName, #patientLastName, #fatherName").on("input", function () {
      const $this = $(this);
      validateField($this, $this.val().trim().length > 0, "This field is required.");
    });
  
    $("#patientPhone").on("input", function () {
      const $this = $(this);
      const fullNumber = itiPhone.getNumber(); // Includes country code
      validateField(
        $this,
        fullNumber.length <= 13 && /^\+?\d+$/.test(fullNumber),
        "Phone number must be numeric and up to 13 digits (including country code)."
      );
    });
  
    $("#mobile2").on("input", function () {
      const $this = $(this);
      const fullNumber = itiMobile2.getNumber();
      validateField(
        $this,
        fullNumber.length <= 13 && /^\+?\d+$/.test(fullNumber),
        "Mobile 2 must be numeric and up to 13 digits (including country code)."
      );
    });
  
    $("#aadharNumber").on("input", function () {
      const $this = $(this);
      const value = $this.val().trim();
      validateField(
        $this,
        /^\d{12}$/.test(value),
        "Aadhar number must be exactly 12 digits."
      );
    });
  
    $("#patientGender, #preferredLanguage, #maritalStatus, #paymentPreference").on("change", function () {
      const $this = $(this);
      validateField($this, $this.val() !== "", "Please select an option.");
    });
  
    $("#patientDOB").on("change", function () {
      const $this = $(this);
      validateField($this, $this.val().trim().length > 0, "Date of Birth is required.");
    });
  
 
});
