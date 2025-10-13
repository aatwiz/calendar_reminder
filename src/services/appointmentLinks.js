const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LINKS_FILE = path.join(__dirname, '../../appointment_links.json');

/**
 * Load appointment links from file
 */
function loadLinks() {
  try {
    if (fs.existsSync(LINKS_FILE)) {
      const data = fs.readFileSync(LINKS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading appointment links:', error);
  }
  return {};
}

/**
 * Save appointment links to file
 */
function saveLinks(links) {
  try {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving appointment links:', error);
  }
}

/**
 * Generate a unique token for an appointment
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a unique link for an appointment
 * @param {string} eventId - Google Calendar event ID
 * @param {string} patientName - Patient name
 * @param {string} appointmentTime - Appointment date/time
 * @returns {string} Unique token for the appointment
 */
function createAppointmentLink(eventId, patientName, appointmentTime) {
  const links = loadLinks();
  const token = generateToken();
  
  links[token] = {
    eventId,
    patientName,
    appointmentTime,
    createdAt: new Date().toISOString(),
    used: false
  };
  
  saveLinks(links);
  return token;
}

/**
 * Get appointment details by token
 * @param {string} token - Unique appointment token
 * @returns {Object|null} Appointment details or null if not found
 */
function getAppointmentByToken(token) {
  const links = loadLinks();
  return links[token] || null;
}

/**
 * Mark appointment link as used
 * @param {string} token - Unique appointment token
 * @param {string} action - Action taken (confirm/cancel/reschedule)
 */
function markLinkAsUsed(token, action) {
  const links = loadLinks();
  if (links[token]) {
    links[token].used = true;
    links[token].action = action;
    links[token].actionAt = new Date().toISOString();
    saveLinks(links);
  }
}

/**
 * Clean up appointment links older than 7 days from appointment time
 * @returns {Object} Cleanup statistics
 */
function cleanupOldAppointments() {
  const links = loadLinks();
  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  let totalLinks = 0;
  let removedLinks = 0;
  const removedAppointments = [];
  
  Object.entries(links).forEach(([token, appointment]) => {
    totalLinks++;
    const appointmentDate = new Date(appointment.appointmentTime);
    const timeSinceAppointment = now - appointmentDate;
    
    // Remove if appointment was more than 7 days ago
    if (timeSinceAppointment > sevenDaysMs) {
      removedAppointments.push({
        patientName: appointment.patientName,
        appointmentTime: appointment.appointmentTime,
        action: appointment.action || 'no-response'
      });
      delete links[token];
      removedLinks++;
    }
  });
  
  // Save updated links if any were removed
  if (removedLinks > 0) {
    saveLinks(links);
  }
  
  return {
    totalBefore: totalLinks,
    removed: removedLinks,
    remaining: totalLinks - removedLinks,
    removedAppointments
  };
}

module.exports = {
  createAppointmentLink,
  getAppointmentByToken,
  markLinkAsUsed,
  cleanupOldAppointments
};
