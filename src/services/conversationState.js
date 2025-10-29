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
      // On Vercel, start fresh with empty state (read-only filesystem)
      stateCache = {};
      console.log('📖 Using in-memory conversation state (Vercel serverless)');
    } else if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      stateCache = JSON.parse(data);
      console.log(`📖 Loaded conversation state: ${Object.keys(stateCache).length} active conversations`);
    } else {
      stateCache = {};
    }
  } catch (error) {
    console.error('Error loading conversation state:', error.message);
    stateCache = {};
  }
}

/**
 * Save conversation state to file
 */
function saveState() {
  const isVercel = !!process.env.VERCEL;
  
  try {
    if (isVercel) {
      // Vercel: save to memory only (read-only filesystem)
      console.log('💾 Conversation state saved to memory (Vercel serverless)');
    } else {
      // Local/Railway: save to file
      fs.writeFileSync(STATE_FILE, JSON.stringify(stateCache, null, 2));
    }
  } catch (error) {
    console.error('Error saving conversation state:', error.message);
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
  
  console.log(`📞 Phone normalization starting: "${phoneNumber}" → digits only: "${normalized}"`);
  
  // Handle countries with area code 0 that gets dropped in international format
  // Pattern: +XXX0 (country code + leading 0) should become XXX (just country code)
  // This applies to most European countries
  const countryCodesToHandle = [
    { code: '310', normalized: '31' },    // Netherlands: +310 → 31
    { code: '320', normalized: '32' },    // Belgium: +320 → 32
    { code: '330', normalized: '33' },    // France: +330 → 33
    { code: '340', normalized: '34' },    // Spain: +340 → 34
    { code: '390', normalized: '39' },    // Italy: +390 → 39
    { code: '400', normalized: '40' },    // Romania: +400 → 40
    { code: '410', normalized: '41' },    // Switzerland: +410 → 41
    { code: '430', normalized: '43' },    // Austria: +430 → 43
    { code: '440', normalized: '44' },    // UK: +440 → 44
    { code: '450', normalized: '45' },    // Denmark: +450 → 45
    { code: '460', normalized: '46' },    // Sweden: +460 → 46
    { code: '470', normalized: '47' },    // Norway: +470 → 47
    { code: '480', normalized: '48' },    // Poland: +480 → 48
    { code: '490', normalized: '49' },    // Germany: +490 → 49
    { code: '3530', normalized: '353' }   // Ireland: +3530 → 353
  ];
  
  for (const { code, normalized: replacement } of countryCodesToHandle) {
    if (normalized.startsWith(code)) {
      normalized = replacement + normalized.substring(code.length);
      console.log(`📞 Matched country code: ${code} → ${replacement}`);
      break;
    }
  }
  
  // Remove other leading zeros that might be at the very start
  // (for numbers that don't start with country code)
  while (normalized.startsWith('0') && normalized.length > 1) {
    normalized = normalized.substring(1);
    console.log(`📞 Removed leading 0 → "${normalized}"`);
  }
  
  console.log(`📞 Phone normalization: "${phoneNumber}" → "${normalized}"`);
  
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
  console.log(`Stored conversation for ${phoneNumber} (normalized: ${normalized})`);
}

/**
 * Get conversation context for a phone number
 * @param {string} phoneNumber - Patient's phone number
 * @returns {Object|null} Conversation context or null if not found
 */
function getConversation(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  const result = stateCache[normalized];
  if (!result) {
    console.log(`❌ No conversation found for ${phoneNumber} (normalized: ${normalized})`);
    console.log(`📋 Available conversations:`, Object.keys(stateCache));
  } else {
    console.log(`✅ Found conversation for ${phoneNumber} (normalized: ${normalized})`);
  }
  return result || null;
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
    console.log(`🗑️  Cleared conversation for ${phoneNumber} (normalized: ${normalized})`);
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
