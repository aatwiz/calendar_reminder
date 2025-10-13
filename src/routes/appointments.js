const express = require('express');
const { getAppointmentByToken, markLinkAsUsed } = require('../services/appointmentLinks');
const { getCalendarEvents } = require('../services/googleCalendar');
const { google } = require('googleapis');
const { loadConfig } = require('../config');
const { 
  renderAppointmentPage, 
  renderAlreadyUsedPage, 
  renderErrorPage 
} = require('../templates/appointmentTemplates');

const router = express.Router();

/**
 * GET /appointment/:token - Display appointment action page
 */
router.get('/appointment/:token', async (req, res) => {
  const { token } = req.params;
  const appointment = getAppointmentByToken(token);
  const config = loadConfig();
  const clinicPhone = config.clinic?.phone || '';
  
  if (!appointment) {
    return res.status(404).send(renderErrorPage('Invalid or expired link', 'This appointment link is not valid or has expired.'));
  }
  
  if (appointment.used) {
    return res.send(renderAlreadyUsedPage(appointment));
  }
  
  res.send(renderAppointmentPage(token, appointment, clinicPhone));
});

/**
 * POST /appointment/:token/action - Handle appointment action
 */
router.post('/appointment/:token/action', async (req, res) => {
  const { token } = req.params;
  const { action } = req.body;
  
  const appointment = getAppointmentByToken(token);
  
  if (!appointment) {
    return res.status(404).json({ error: 'Invalid or expired link' });
  }
  
  if (appointment.used) {
    return res.status(400).json({ error: 'This link has already been used' });
  }
  
  try {
    // Load Google Calendar credentials
    const config = loadConfig();
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(config.google.tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Get the event
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId: appointment.eventId
    });
    
    let currentTitle = event.data.summary;
    
    // Remove the 🔔 emoji if present (from reminder)
    if (currentTitle.startsWith('🔔 ')) {
      currentTitle = currentTitle.substring(2); // Remove "🔔 " (emoji + space)
    }
    
    let newTitle;
    let emoji;
    
    switch (action) {
      case 'confirm':
        emoji = '✅';
        newTitle = `✅ ${currentTitle}`;
        break;
      case 'cancel':
        emoji = '❌';
        newTitle = `❌ ${currentTitle}`;
        break;
      case 'reschedule':
        emoji = '❓';
        newTitle = `❓ ${currentTitle}`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Update the event title
    await calendar.events.patch({
      calendarId: 'primary',
      eventId: appointment.eventId,
      requestBody: {
        summary: newTitle
      }
    });
    
    // Mark link as used
    markLinkAsUsed(token, action);
    
    res.json({ 
      success: true, 
      action,
      message: 'Appointment updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ success: false, error: 'Failed to update appointment' });
  }
});

module.exports = router;
