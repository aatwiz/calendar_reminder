const express = require('express');
const { 
  getAuthUrl, 
  handleOAuthCallback, 
  revokeGoogleAccess,
  getCalendarEvents,
  rescheduleEvent
} = require('../services/googleCalendar');
const { renderSuccessPage, renderErrorPage } = require('../views');

const router = express.Router();

/**
 * GET /auth - Initiate Google OAuth flow
 */
router.get('/auth', (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).send(renderErrorPage('Authentication Error', 'Failed to initiate Google authentication.'));
  }
});

/**
 * GET /oauth2callback - Handle OAuth callback
 */
router.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;
    await handleOAuthCallback(code);
    res.redirect('/setup');
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.status(500).send(renderErrorPage('Authentication Error', 'Failed to complete Google authentication.'));
  }
});

/**
 * GET /revoke-google - Revoke Google Calendar access
 */
router.get('/revoke-google', async (req, res) => {
  try {
    await revokeGoogleAccess();
    const html = renderSuccessPage(
      'Google Access Revoked',
      'Your Google Calendar access has been successfully revoked. You can re-authenticate anytime from the setup page.',
      '⚙️ Back to Setup',
      '/setup'
    );
    res.send(html);
  } catch (error) {
    console.error('Error revoking Google access:', error);
    res.status(500).send(renderErrorPage('Error Revoking Access', 'There was an error revoking your Google Calendar access. Please try again.'));
  }
});

/**
 * GET /events - Fetch calendar events
 */
router.get('/events', async (req, res) => {
  try {
    const events = await getCalendarEvents();
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    
    if (error.message === 'Google not authenticated') {
      return res.status(401).send('❌ Google not authenticated. Go to /auth first.');
    }
    
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

/**
 * POST /reschedule-event - Reschedule a calendar event
 */
router.post('/reschedule-event', async (req, res) => {
  try {
    const { eventId, newStartTime, newEndTime } = req.body;
    const updatedEvent = await rescheduleEvent(eventId, newStartTime, newEndTime);
    res.json({ message: 'Event rescheduled successfully', event: updatedEvent });
  } catch (error) {
    console.error('Error rescheduling event:', error);
    
    if (error.message === 'Google not authenticated') {
      return res.status(401).send('❌ Google not authenticated. Go to /auth first.');
    }
    
    res.status(500).json({ error: 'Failed to reschedule event', details: error.message });
  }
});

module.exports = router;