const nodemailer = require('nodemailer');
const { loadConfig } = require('../config');

/**
 * Get Gmail transporter for sending emails
 * @returns {Transporter} Nodemailer transporter
 */
function getGmailTransporter() {
  const config = loadConfig();
  if (!config.gmail) {
    throw new Error('Gmail SMTP credentials not set. Go to /setup first.');
  }
  
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: config.gmail.user,
      pass: config.gmail.password
    }
  });
}

/**
 * Send doctor notification email
 * @param {string} doctorEmail - Doctor's email address
 * @param {Object} patientInfo - Patient information
 * @param {Object} appointmentDetails - Appointment details
 * @returns {Promise<Object>} Email send result
 */
async function sendDoctorNotification(doctorEmail, patientInfo, appointmentDetails) {
  const transporter = getGmailTransporter();
  const config = loadConfig();
  
  const mailOptions = {
    from: config.gmail.user,
    to: doctorEmail,
    subject: `Appointment Reminder - ${patientInfo.name}`,
    html: `
      <h2>Appointment Reminder</h2>
      <p><strong>Patient:</strong> ${patientInfo.name}</p>
      <p><strong>Phone:</strong> ${patientInfo.phone}</p>
      <p><strong>Contact Method:</strong> ${patientInfo.method}</p>
      <p><strong>Appointment:</strong> ${appointmentDetails.summary || 'No title'}</p>
      <p><strong>Start:</strong> ${appointmentDetails.start}</p>
      <p><strong>End:</strong> ${appointmentDetails.end}</p>
      <hr>
      <p><em>This is an automated notification from the Calendar Reminder System.</em></p>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return { success: true, info };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

module.exports = {
  getGmailTransporter,
  sendDoctorNotification
};