const fs = require('fs');
const path = require('path');

/**
 * Conversation State Manager
 * Tracks which appointment each phone number is responding about
 * Stores mapping: phone_number -> { eventId, patientName, appointmentTime, lastReminder }
 */

const STATE_FILE = path.join(__dirname, '../../conversation_state.json');

// In-memory cache
let stateCache = {};

/**
 * Load conversation state from file
 */
function loadState() {
  const isVercel = !!process.env.VERCEL;
  
  try {
    if (isVercel) {
      stateCache = {};
    } else if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      stateCache = JSON.parse(data);
    } else {
      stateCache = {};
    }
  } catch (error) {
    console.error('[ERROR] Loading conversation state:', error.message);
    stateCache = {};
  }
}

/**
 * Save conversation state to file
 */
function saveState() {
  const isVercel = !!process.env.VERCEL;
  
  try {
    if (!isVercel) {
      fs.writeFileSync(STATE_FILE, JSON.stringify(stateCache, null, 2));
    }
  } catch (error) {
    console.error('[ERROR] Saving conversation state:', error.message);
  }
}

/**
 * Normalize phone number for consistent lookup
 * Handles E.164 format and country-specific quirks
 * Many European countries drop the leading 0 in international format,
 * which WhatsApp reflects in sender IDs
 * @param {string} phoneNumber - Raw phone number
 * @returns {string} Normalized phone number
 */
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  let normalized = phoneNumber.replace(/\D/g, '');
  
  // Handle countries with area code 0 that gets dropped in international format
  // Pattern: +XXX0 (country code + leading 0) should become XXX (just country code)
  const countryCodesToHandle = [
    { code: '310', normalized: '31' },    // Netherlands
    { code: '320', normalized: '32' },    // Belgium
    { code: '330', normalized: '33' },    // France
    { code: '340', normalized: '34' },    // Spain
    { code: '390', normalized: '39' },    // Italy
    { code: '400', normalized: '40' },    // Romania
    { code: '410', normalized: '41' },    // Switzerland
    { code: '430', normalized: '43' },    // Austria
    { code: '440', normalized: '44' },    // UK
    { code: '450', normalized: '45' },    // Denmark
    { code: '460', normalized: '46' },    // Sweden
    { code: '470', normalized: '47' },    // Norway
    { code: '480', normalized: '48' },    // Poland
    { code: '490', normalized: '49' },    // Germany
    { code: '3530', normalized: '353' }   // Ireland
  ];
  
  for (const { code, normalized: replacement } of countryCodesToHandle) {
    if (normalized.startsWith(code)) {
      normalized = replacement + normalized.substring(code.length);
      break;
    }
  }
  
  // Remove other leading zeros (for numbers that don't start with country code)
  while (normalized.startsWith('0') && normalized.length > 1) {
    normalized = normalized.substring(1);
  }
  
  return normalized;
}

/**
 * Store conversation context when sending a reminder
 * @param {string} phoneNumber - Patient's phone number (E.164 format)
 * @param {Object} context - Appointment context
 */
function setConversation(phoneNumber, context) {
  const normalized = normalizePhoneNumber(phoneNumber);
  stateCache[normalized] = {
    eventId: context.eventId,
    patientName: context.patientName,
    appointmentTime: context.appointmentTime,
    lastReminderSent: new Date().toISOString(),
    originalPhone: phoneNumber
  };
  saveState();
}

/**
 * Get conversation context for a phone number
 * @param {string} phoneNumber - Patient's phone number
 * @returns {Object|null} Conversation context or null if not found
 */
function getConversation(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  return stateCache[normalized] || null;
}

/**
 * Remove conversation after it's been handled
 * @param {string} phoneNumber - Patient's phone number
 */
function clearConversation(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (stateCache[normalized]) {
    delete stateCache[normalized];
    saveState();
  }
}

/**
 * Clean up old conversations (older than 7 days)
 */
function cleanupOldConversations() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  let cleaned = 0;
  for (const [phone, context] of Object.entries(stateCache)) {
    const reminderDate = new Date(context.lastReminderSent);
    if (reminderDate < sevenDaysAgo) {
      delete stateCache[phone];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    saveState();
  }
}

/**
 * Get all active conversations
 * @returns {Object} All conversation states
 */
function getAllConversations() {
  return { ...stateCache };
}

// Load state on module initialization
loadState();

module.exports = {
  setConversation,
  getConversation,
  clearConversation,
  cleanupOldConversations,
  getAllConversations
};
