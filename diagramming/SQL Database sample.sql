DROP DATABASE IF EXISTS gopi;
CREATE DATABASE gopi;
USE gopi;

CREATE TABLE doctor (
    doctor_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    last_name VARCHAR(255) NOT NULL,
    specialization VARCHAR(255) NOT NULL,
    contact_number VARCHAR(15) NOT NULL,
    email VARCHAR(255) NOT NULL,
    availability ENUM('Available', 'Unavailable', 'On-Call') NOT NULL,
    schedule JSON
);

CREATE TABLE patient (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    last_name VARCHAR(255),
    date_of_birth DATE,
    age INT,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    mobile_number VARCHAR(15) NOT NULL,
    email_address VARCHAR(255),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    specific_doctor INT,
    appointment_status ENUM('Scheduled', 'Cancelled', 'Completed', 'Rescheduled') NOT NULL,
    queue_number INT,
    booking_type ENUM('Walk-in', 'Call-in', 'Doctor-added') NOT NULL,
    FOREIGN KEY (specific_doctor) REFERENCES doctor(doctor_id)
);

CREATE TABLE receptionist (
    receptionist_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(15) NOT NULL,
    email VARCHAR(255)
);

CREATE TABLE doctor_appointments (
    doctor_appointment_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status ENUM('Scheduled', 'Cancelled', 'Completed', 'Rescheduled') NOT NULL,
    rescheduled_by ENUM('Receptionist', 'Doctor', 'Patient'),
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id)
);

CREATE TABLE receptionist_operations (
    operation_id INT AUTO_INCREMENT PRIMARY KEY,
    action_type ENUM('Add Appointment', 'Reschedule Appointment', 'Cancel Appointment') NOT NULL,
    modified_appointment_id INT,
    modification_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modified_appointment_id) REFERENCES doctor_appointments(doctor_appointment_id)
);

CREATE TABLE patient_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    notification_type ENUM('SMS', 'WhatsApp', 'Email', 'Call') NOT NULL,
    message_content TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Sent', 'Failed', 'Pending') NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
);

CREATE TABLE doctor_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    notification_type ENUM('SMS', 'WhatsApp', 'Email', 'Call') NOT NULL,
    message_content TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Sent', 'Failed', 'Pending') NOT NULL,
    FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id)
);

CREATE TABLE login_otp (
    phone_number VARCHAR(15) NOT NULL,
    email_address VARCHAR(255),
    otp_code INT NOT NULL,
    otp_timestamp TIMESTAMP NOT NULL,
    PRIMARY KEY (phone_number, otp_code),
     user_type ENUM('Receptionist', 'Doctor', 'Patient') NOT NULL,
    -- For linking the login_username to the correct user table
    patient_id INT,
    doctor_id INT,
    receptionist_id INT,
    -- Only one of the following should have a non-null value, depending on the user type
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id),
    FOREIGN KEY (receptionist_id) REFERENCES receptionist(receptionist_id)
);

-- Modified login_username table structure
CREATE TABLE login_username (
    username VARCHAR(255) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    password VARCHAR(255) NOT NULL,
    otp_code INT,
    otp_timestamp TIMESTAMP,
    user_type ENUM('Receptionist', 'Doctor', 'Patient') NOT NULL,
    -- For linking the login_username to the correct user table
    patient_id INT,
    doctor_id INT,
    receptionist_id INT,
    -- Only one of the following should have a non-null value, depending on the user type
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id),
    FOREIGN KEY (receptionist_id) REFERENCES receptionist(receptionist_id)
);
