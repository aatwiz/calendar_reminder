const { google } = require('googleapis');
const { loadConfig, saveConfig } = require('../config');

/**
 * Get OAuth2 client using environment variables
 * @returns {OAuth2Client} Google OAuth2 client
 */
function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Calendar API keys not set. Ensure .env file contains GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate Google OAuth authorization URL
 * @returns {string} Authorization URL
 */
function getAuthUrl() {
  const oAuth2Client = getOAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar'
    ],
  });
}

/**
 * Handle OAuth callback and store tokens
 * @param {string} code - Authorization code from Google
 * @returns {Promise<Object>} Token information
 */
async function handleOAuthCallback(code) {
  const oAuth2Client = getOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  const config = loadConfig();
  
  if (!config.google) {
    config.google = {};
  }

  // Preserve existing refresh token if Google doesn't return a new one
  const existingRefreshToken = config.google.tokens?.refresh_token;
  if (!tokens.refresh_token && existingRefreshToken) {
    tokens.refresh_token = existingRefreshToken;
  }

  config.google.tokens = tokens;
  saveConfig(config);

  return tokens;
}

/**
 * Revoke Google Calendar access
 * @returns {Promise<void>}
 */
async function revokeGoogleAccess() {
  const config = loadConfig();
  
  if (config.google && config.google.tokens) {
    const oAuth2Client = getOAuthClient();
    oAuth2Client.setCredentials(config.google.tokens);
    
    try {
      await oAuth2Client.revokeCredentials();
    } catch (error) {
      console.log('Error revoking credentials with Google:', error.message);
    }
    
    delete config.google;
    saveConfig(config);
  }
}

/**
 * Get calendar events
 * @param {Object} options - Options for fetching events
 * @param {Date} options.timeMin - Minimum time for events (default: now)
 * @param {Date} options.timeMax - Maximum time for events (default: none)
 * @param {number} options.maxResults - Maximum number of results (default: 10)
 * @returns {Promise<Array>} Array of calendar events
 */
async function getCalendarEvents(options = {}) {
  const config = loadConfig();
  if (!config.google || !config.google.tokens) {
    throw new Error('Google not authenticated');
  }

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials(config.google.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  
  const queryParams = {
    calendarId: 'primary',
    timeMin: (options.timeMin || new Date()).toISOString(),
    maxResults: options.maxResults || 10,
    singleEvents: true,
    orderBy: 'startTime',
  };
  
  // Add timeMax if provided
  if (options.timeMax) {
    queryParams.timeMax = options.timeMax.toISOString();
  }
  
  const events = await calendar.events.list(queryParams);

  return events.data.items;
}

/**
 * Reschedule a calendar event
 * @param {string} eventId - Event ID to reschedule
 * @param {string} newStartTime - New start time
 * @param {string} newEndTime - New end time
 * @returns {Promise<Object>} Updated event
 */
async function rescheduleEvent(eventId, newStartTime, newEndTime) {
  const config = loadConfig();
  if (!config.google || !config.google.tokens) {
    throw new Error('Google not authenticated');
  }

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials(config.google.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  
  const updatedEvent = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: {
      start: { dateTime: newStartTime },
      end: { dateTime: newEndTime },
    },
  });

  return updatedEvent.data;
}

/**
 * Mark event as reminded by adding emoji to title
 * @param {string} eventId - Event ID to update
 * @param {string} currentTitle - Current event title
 * @returns {Promise<Object>} Updated event
 */
async function markEventAsReminded(eventId, currentTitle) {
  const config = loadConfig();
  if (!config.google || !config.google.tokens) {
    throw new Error('Google not authenticated');
  }

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials(config.google.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  
  // Add 🔔 emoji to the beginning of the title
  const newTitle = `🔔 ${currentTitle}`;
  
  const updatedEvent = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: {
      summary: newTitle,
    },
  });

  return updatedEvent.data;
}

/**
 * Update event title with emoji (for appointment actions)
 * Removes existing status emoji and adds new one
 * @param {string} eventId - Event ID to update
 * @param {string} emoji - Emoji to add (✅, ❌, ❓)
 * @returns {Promise<Object>} Updated event
 */
async function updateEventTitle(eventId, emoji) {
  console.log(`[updateEventTitle] START - eventId: ${eventId}, emoji: ${emoji}`);
  const config = loadConfig();
  if (!config.google || !config.google.tokens) {
    throw new Error('Google not authenticated');
  }

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials(config.google.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  
  try {
    // Get current event
    console.log(`[updateEventTitle] Fetching event ${eventId}...`);
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId
    });
    console.log(`[updateEventTitle] Event fetched`);

    let currentTitle = event.data.summary;
    
    // Remove any existing status emoji from the beginning
    // Match: emoji followed by space(s) at start of string
    currentTitle = currentTitle.replace(/^\S+\s+/, '').trim();
    
    // If it still starts with an emoji pattern, clean it more aggressively
    if (/^\W/.test(currentTitle.charAt(0))) {
      currentTitle = currentTitle.replace(/^\W+\s*/, '').trim();
    }
    
    // Add new emoji
    const newTitle = `${emoji} ${currentTitle}`;
    
    console.log(`📝 Updating title: "${currentTitle}" → "${newTitle}"`);
    console.log(`[updateEventTitle] Patching event...`);
    
    const updatedEvent = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary: newTitle,
      },
    });

    console.log(`[updateEventTitle] SUCCESS - Event updated`);
    return updatedEvent.data;
  } catch (error) {
    console.error(`[updateEventTitle] ERROR:`, error.message);
    console.error(`[updateEventTitle] Stack:`, error.stack);
    throw error;
  }
}

/**
 * Check if Google Calendar is authenticated
 * @returns {boolean} Authentication status
 */
function isGoogleAuthenticated() {
  const config = loadConfig();
  return config.google && config.google.tokens;
}

module.exports = {
  getOAuthClient,
  getAuthUrl,
  handleOAuthCallback,
  revokeGoogleAccess,
  getCalendarEvents,
  rescheduleEvent,
  markEventAsReminded,
  updateEventTitle,
  isGoogleAuthenticated
};