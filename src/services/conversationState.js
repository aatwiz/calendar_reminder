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
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      stateCache = JSON.parse(data);
      console.log(`📖 Loaded conversation state: ${Object.keys(stateCache).length} active conversations`);
    } else {
      stateCache = {};
    }
  } catch (error) {
    console.error('❌ Error loading conversation state:', error.message);
    stateCache = {};
  }
}

/**
 * Save conversation state to file
 */
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(stateCache, null, 2));
  } catch (error) {
    console.error('❌ Error saving conversation state:', error.message);
  }
}

/**
 * Store conversation context when sending a reminder
 * @param {string} phoneNumber - Patient's phone number (E.164 format)
 * @param {Object} context - Appointment context
 */
function setConversation(phoneNumber, context) {
  stateCache[phoneNumber] = {
    eventId: context.eventId,
    patientName: context.patientName,
    appointmentTime: context.appointmentTime,
    lastReminderSent: new Date().toISOString()
  };
  saveState();
  console.log(`💾 Stored conversation for ${phoneNumber}`);
}

/**
 * Get conversation context for a phone number
 * @param {string} phoneNumber - Patient's phone number
 * @returns {Object|null} Conversation context or null if not found
 */
function getConversation(phoneNumber) {
  return stateCache[phoneNumber] || null;
}

/**
 * Remove conversation after it's been handled
 * @param {string} phoneNumber - Patient's phone number
 */
function clearConversation(phoneNumber) {
  if (stateCache[phoneNumber]) {
    delete stateCache[phoneNumber];
    saveState();
    console.log(`🗑️  Cleared conversation for ${phoneNumber}`);
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
    console.log(`🧹 Cleaned up ${cleaned} old conversation(s)`);
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
