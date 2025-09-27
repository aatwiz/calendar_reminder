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
 * @returns {Promise<Array>} Array of calendar events
 */
async function getCalendarEvents() {
  const config = loadConfig();
  if (!config.google || !config.google.tokens) {
    throw new Error('Google not authenticated');
  }

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials(config.google.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  
  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

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
  isGoogleAuthenticated
};