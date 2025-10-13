const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Import routes
const setupRoutes = require('./src/routes/setup');
const authRoutes = require('./src/routes/auth');
const appointmentsRoutes = require('./src/routes/appointments');
const { loadConfig } = require('./src/config');
const { isGoogleAuthenticated, getCalendarEvents, markEventAsReminded } = require('./src/services/googleCalendar');
const twilio = require('twilio');
const { createAppointmentLink, cleanupOldAppointments } = require('./src/services/appointmentLinks');

/**
 * Process and send SMS to a calendar event
 * @param {Object} event - Calendar event object
 * @param {Object} twilioClient - Initialized Twilio client
 * @param {string} twilioPhone - Twilio phone number to send from
 * @param {boolean} verbose - Whether to log detailed info (for manual endpoint)
 * @returns {Object} Result object with status, message, etc.
 */
async function processSMSForEvent(event, twilioClient, twilioPhone, verbose = false) {
  const title = event.summary || '';
  const logPrefix = verbose ? '' : '   ';
  
  if (verbose) {
    console.log(`\n--- Processing Event ---`);
    console.log(`Title: ${title}`);
  } else {
    console.log(`\n${logPrefix}📌 Processing: ${title}`);
    const eventStart = event.start.dateTime || event.start.date;
    console.log(`${logPrefix}Appointment time: ${new Date(eventStart).toLocaleString()}`);
  }
  
  // Split by # to get the parts
  const parts = title.split('#');
  
  if (parts.length < 2) {
    console.log(`${logPrefix}⚠️  No content after "#", skipping...`);
    return {
      title,
      status: 'skipped',
      reason: 'No content after #'
    };
  }
  
  const beforeHash = parts[0].trim(); // Everything before #
  const afterHash = parts[1].trim();  // Everything after # (phone number)
  
  // Extract and format phone number
  let phoneNumber = afterHash.replace(/[\s\-\(\)]/g, '');
  let fullPhoneNumber;
  
  if (phoneNumber.startsWith('+')) {
    fullPhoneNumber = phoneNumber;
  } else {
    // Add Ireland prefix (+353) by default
    fullPhoneNumber = `+353${phoneNumber}`;
  }
  
  // Generate unique appointment link
  const eventStart = event.start.dateTime || event.start.date;
  const appointmentLink = createAppointmentLink(event.id, beforeHash, eventStart);
  const fullUrl = `http://localhost:3000/appointment/${appointmentLink}`;
  
  // Create message with appointment link
  const message = `Hello ${beforeHash}! Manage your appointment: ${fullUrl}`;
  
  if (verbose) {
    console.log(`📝 Message: "${message}"`);
    console.log(`📞 Raw Phone: ${afterHash}`);
    console.log(`📞 Formatted: ${fullPhoneNumber}`);
    console.log(`📤 Attempting to send SMS...`);
  } else {
    console.log(`${logPrefix}📝 Message: "${message}"`);
    console.log(`${logPrefix}📞 Phone: ${fullPhoneNumber}`);
  }
  
  try {
    // Send SMS via Twilio
    const smsResult = await twilioClient.messages.create({
      body: message,
      from: twilioPhone,
      to: fullPhoneNumber
    });
    
    console.log(`${logPrefix}✅ SMS sent! SID: ${smsResult.sid}`);
    
    // Mark the calendar event as reminded by adding 🔔 emoji
    try {
      await markEventAsReminded(event.id, title);
      console.log(`${logPrefix}🔔 Event marked as reminded in calendar`);
    } catch (markError) {
      console.error(`${logPrefix}⚠️  Could not mark event: ${markError.message}`);
    }
    
    return {
      title,
      beforeHash,
      phoneNumber: afterHash,
      fullPhoneNumber,
      message,
      status: 'sent',
      sid: smsResult.sid
    };
    
  } catch (smsError) {
    console.error(`${logPrefix}❌ Failed: ${smsError.message}`);
    
    // Check for common Twilio errors (only in verbose mode)
    if (verbose && smsError.message.includes('Permission to send an SMS has not been enabled')) {
      console.error(`💡 TIP: This number's region may not be enabled in your Twilio account.`);
      console.error(`   - For trial accounts: Verify this number in Twilio Console`);
      console.error(`   - Or upgrade your Twilio account to enable this region`);
    }
    
    return {
      title,
      beforeHash,
      phoneNumber: afterHash,
      fullPhoneNumber,
      message,
      status: 'failed',
      error: smsError.message,
      errorCode: smsError.code
    };
  }
}

// Root route - redirect to setup if not configured
app.get('/', (req, res) => {
  const config = loadConfig();
  const googleAuth = isGoogleAuthenticated();
  const twilioConfigured = config.twilio && config.twilio.sid && config.twilio.auth_token;
  
  // If nothing is configured, go to setup
  if (!googleAuth && !twilioConfigured) {
    return res.redirect('/setup');
  }
  
  // If partially configured, go to setup
  if (!googleAuth || !twilioConfigured) {
    return res.redirect('/setup');
  }
  
  // If fully configured, show dashboard
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Clinic Appointment Reminders</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          max-width: 600px;
          width: 100%;
          padding: 2rem;
          text-align: center;
        }
        h1 { color: #4285f4; margin-bottom: 1rem; }
        p { color: #666; margin-bottom: 2rem; }
        .btn {
          display: inline-block;
          margin: 0.5rem;
          padding: 0.875rem 1.5rem;
          background-color: #4285f4;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .btn:hover {
          background-color: #3367d6;
          transform: translateY(-1px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🏥 Clinic Appointment Reminders</h1>
        <p>✅ System is configured and ready!</p>
        <a href="/test-calendar" class="btn">🧪 Test Calendar (Console)</a>
        <a href="/send-reminders" class="btn" style="background-color: #34a853;">📱 Send SMS Reminders</a>
        <a href="/events" class="btn">📅 View Calendar Events</a>
        <a href="/setup" class="btn">⚙️ Settings</a>
      </div>
    </body>
    </html>
  `);
});

// Test endpoint to fetch and log calendar events
app.get('/test-calendar', async (req, res) => {
  try {
    console.log('\n📅 ===== FETCHING CALENDAR EVENTS =====');
    const events = await getCalendarEvents();
    
    if (!events || events.length === 0) {
      console.log('📭 No upcoming events found.');
      return res.json({ 
        message: 'No upcoming events found',
        events: []
      });
    }
    
    // Filter events that have "#" in the title
    const filteredEvents = events.filter(event => {
      const title = event.summary || '';
      return title.includes('#');
    });
    
    console.log(`\n✅ Found ${events.length} total event(s)`);
    console.log(`🔍 Filtered to ${filteredEvents.length} event(s) with "#" in title:\n`);
    
    if (filteredEvents.length === 0) {
      console.log('📭 No events with "#" in title found.');
      return res.json({ 
        message: 'No events with "#" in title found',
        totalEvents: events.length,
        filteredCount: 0,
        events: []
      });
    }
    
    filteredEvents.forEach((event, index) => {
      console.log(`--- Event ${index + 1} ---`);
      console.log(`Title: ${event.summary || 'No title'}`);
      console.log(`Description: ${event.description || 'No description'}`);
      console.log(`Location: ${event.location || 'No location'}`);
      console.log(`Start: ${event.start.dateTime || event.start.date}`);
      console.log(`End: ${event.end.dateTime || event.end.date}`);
      console.log(`Event ID: ${event.id}`);
      console.log(`Status: ${event.status}`);
      
      // Log attendees if any
      if (event.attendees && event.attendees.length > 0) {
        console.log('Attendees:');
        event.attendees.forEach(attendee => {
          console.log(`  - ${attendee.email} (${attendee.responseStatus})`);
        });
      }
      
      console.log(''); // Empty line for readability
    });
    
    console.log('===== END OF FILTERED EVENTS =====\n');
    
    // Send response
    res.json({
      message: `Successfully fetched ${filteredEvents.length} event(s) with "#" in title`,
      totalEvents: events.length,
      filteredCount: filteredEvents.length,
      events: filteredEvents.map(event => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        location: event.location,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        status: event.status,
        attendees: event.attendees
      }))
    });
    
  } catch (error) {
    console.error('❌ Error fetching calendar events:', error.message);
    
    if (error.message === 'Google not authenticated') {
      return res.status(401).json({ 
        error: 'Not authenticated', 
        message: 'Please authenticate with Google first at /auth' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch events', 
      details: error.message 
    });
  }
});

// Send SMS reminders for events with # in title
app.get('/send-reminders', async (req, res) => {
  try {
    console.log('\n📱 ===== SENDING SMS REMINDERS =====');
    
    // Check if Twilio is configured
    const config = loadConfig();
    if (!config.twilio || !config.twilio.sid || !config.twilio.auth_token) {
      console.log('❌ Twilio not configured');
      return res.status(400).json({ 
        error: 'Twilio not configured',
        message: 'Please configure Twilio credentials at /setup'
      });
    }
    
    // Initialize Twilio client
    const twilioClient = twilio(config.twilio.sid, config.twilio.auth_token);
    
    // Fetch calendar events
    console.log('📅 Fetching calendar events...');
    const events = await getCalendarEvents();
    
    if (!events || events.length === 0) {
      console.log('📭 No upcoming events found.');
      return res.json({ 
        message: 'No upcoming events found',
        sentMessages: []
      });
    }
    
    // Filter events with # in title
    const eventsWithHash = events.filter(event => {
      const title = event.summary || '';
      return title.includes('#');
    });
    
    console.log(`✅ Found ${events.length} total event(s)`);
    console.log(`🔍 Found ${eventsWithHash.length} event(s) with "#" in title\n`);
    
    if (eventsWithHash.length === 0) {
      console.log('📭 No events with "#" found.');
      return res.json({ 
        message: 'No events with "#" found',
        totalEvents: events.length,
        sentMessages: []
      });
    }
    
    const results = [];
    
    // Process each event using shared function
    for (const event of eventsWithHash) {
      const result = await processSMSForEvent(event, twilioClient, config.twilio.phone, true);
      results.push(result);
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total events: ${events.length}`);
    console.log(`   Events with #: ${eventsWithHash.length}`);
    console.log(`   SMS sent: ${results.filter(r => r.status === 'sent').length}`);
    console.log(`   Failed: ${results.filter(r => r.status === 'failed').length}`);
    console.log(`   Skipped: ${results.filter(r => r.status === 'skipped').length}`);
    console.log('\n===== END OF SMS SENDING =====\n');
    
    res.json({
      message: 'SMS sending completed',
      totalEvents: events.length,
      eventsProcessed: eventsWithHash.length,
      sentCount: results.filter(r => r.status === 'sent').length,
      failedCount: results.filter(r => r.status === 'failed').length,
      skippedCount: results.filter(r => r.status === 'skipped').length,
      results
    });
    
  } catch (error) {
    console.error('❌ Error in send-reminders:', error.message);
    
    if (error.message === 'Google not authenticated') {
      return res.status(401).json({ 
        error: 'Not authenticated', 
        message: 'Please authenticate with Google first at /auth' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send reminders', 
      details: error.message 
    });
  }
});

/**
 * GET /cleanup-appointments - Manual cleanup of old appointment links
 * Removes appointments older than 7 days from appointment time
 */
app.get('/cleanup-appointments', (req, res) => {
  try {
    console.log('\n🧹 Manual cleanup triggered...');
    const result = cleanupOldAppointments();
    
    console.log(`📊 Cleanup completed:`);
    console.log(`   Total: ${result.totalBefore}, Removed: ${result.removed}, Remaining: ${result.remaining}`);
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      statistics: {
        totalBefore: result.totalBefore,
        removed: result.removed,
        remaining: result.remaining
      },
      removedAppointments: result.removedAppointments
    });
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    res.status(500).json({
      success: false,
      error: 'Cleanup failed',
      details: error.message
    });
  }
});

// Automated reminder function
async function sendAutomatedReminders() {
  try {
    console.log('\n⏰ ===== AUTOMATED REMINDER CHECK =====');
    console.log(`📅 Time: ${new Date().toLocaleString()}`);
    
    // Check if services are configured
    const config = loadConfig();
    if (!isGoogleAuthenticated()) {
      console.log('⚠️  Google Calendar not authenticated. Skipping...');
      return;
    }
    
    if (!config.twilio || !config.twilio.sid || !config.twilio.auth_token) {
      console.log('⚠️  Twilio not configured. Skipping...');
      return;
    }
    
    // Initialize Twilio client
    const twilioClient = twilio(config.twilio.sid, config.twilio.auth_token);
    
    // Calculate time range: now to 48 hours from now
    const now = new Date();
    const fortyEightHoursLater = new Date(now.getTime() + (48 * 60 * 60 * 1000));
    
    console.log(`🔍 Checking for events between:`);
    console.log(`   From: ${now.toLocaleString()}`);
    console.log(`   To:   ${fortyEightHoursLater.toLocaleString()}`);
    
    // Fetch events in the next 48 hours
    const events = await getCalendarEvents({
      timeMin: now,
      timeMax: fortyEightHoursLater,
      maxResults: 50
    });
    
    if (!events || events.length === 0) {
      console.log('📭 No events found in the next 48 hours.');
      console.log('===== END OF AUTOMATED CHECK =====\n');
      return;
    }
    
    // Filter events with # in title (patient appointments)
    // Exclude events that already have 🔔 (already reminded)
    const eventsWithHash = events.filter(event => {
      const title = event.summary || '';
      return title.includes('#') && !title.startsWith('🔔');
    });
    
    console.log(`✅ Found ${events.length} total event(s) in next 48 hours`);
    console.log(`🔍 Found ${eventsWithHash.length} event(s) with "#" (patient appointments, not yet reminded)`);
    
    if (eventsWithHash.length === 0) {
      console.log('📭 No patient appointments to remind.');
      console.log('===== END OF AUTOMATED CHECK =====\n');
      return;
    }
    
    let sentCount = 0;
    let failedCount = 0;
    
    // Process each event using shared function
    for (const event of eventsWithHash) {
      const result = await processSMSForEvent(event, twilioClient, config.twilio.phone, false);
      
      if (result.status === 'sent') {
        sentCount++;
      } else if (result.status === 'failed') {
        failedCount++;
      }
    }
    
    console.log(`\n📊 Automated Check Summary:`);
    console.log(`   Events checked: ${events.length}`);
    console.log(`   Patient appointments: ${eventsWithHash.length}`);
    console.log(`   SMS sent: ${sentCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log('===== END OF AUTOMATED CHECK =====\n');
    
  } catch (error) {
    console.error('❌ Error in automated reminders:', error.message);
  }
}

// Schedule automated reminders every 15 minutes
// Cron format: */15 * * * * = every 15 minutes
const reminderCronJob = cron.schedule('*/15 * * * *', () => {
  sendAutomatedReminders();
}, {
  scheduled: true,
  timezone: "Europe/Amsterdam" // Adjust to your timezone
});

// Schedule cleanup of old appointments daily at midnight
// Cron format: 0 0 * * * = every day at 00:00
const cleanupCronJob = cron.schedule('0 0 * * *', () => {
  console.log('\n🧹 ===== APPOINTMENT CLEANUP =====');
  console.log(`📅 Time: ${new Date().toLocaleString()}`);
  console.log('🗑️  Removing appointments older than 7 days...');
  
  const result = cleanupOldAppointments();
  
  console.log(`📊 Cleanup Summary:`);
  console.log(`   Total links before: ${result.totalBefore}`);
  console.log(`   Links removed: ${result.removed}`);
  console.log(`   Links remaining: ${result.remaining}`);
  
  if (result.removed > 0) {
    console.log(`\n🗑️  Removed appointments:`);
    result.removedAppointments.forEach(apt => {
      console.log(`   - ${apt.patientName} (${new Date(apt.appointmentTime).toLocaleString()}) - ${apt.action}`);
    });
  } else {
    console.log('   ✨ No old appointments to remove');
  }
  
  console.log('===== END OF CLEANUP =====\n');
}, {
  scheduled: true,
  timezone: "Europe/Amsterdam"
});

// Use routes
app.use('/', setupRoutes);
app.use('/', authRoutes);
app.use('/', appointmentsRoutes);

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`➡ Go to http://localhost:${port}/setup to configure authentication`);
  console.log(`⏰ Automated reminders scheduled: Every 15 minutes`);
  console.log(`🧹 Cleanup scheduled: Daily at midnight (removes appointments >7 days old)`);
  console.log(`🌍 Timezone: Europe/Amsterdam`);
  console.log(`📱 Checking for appointments in next 48 hours\n`);
  
  // Run once on startup (optional - remove if you don't want immediate check)
  console.log('🔄 Running initial check...');
  sendAutomatedReminders();
});

module.exports = app;