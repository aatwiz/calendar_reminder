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
const { loadConfig } = require('./src/config');
const { isGoogleAuthenticated, getCalendarEvents, markEventAsReminded } = require('./src/services/googleCalendar');
const axios = require('axios');

// Root route - redirect to setup if not configured
app.get('/', (req, res) => {
  const config = loadConfig();
  const googleAuth = isGoogleAuthenticated();
  const clicksendConfigured = config.clicksend && config.clicksend.username && config.clicksend.api_key;
  
  // If nothing is configured, go to setup
  if (!googleAuth && !clicksendConfigured) {
    return res.redirect('/setup');
  }
  
  // If partially configured, go to setup
  if (!googleAuth || !clicksendConfigured) {
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
    
    // Check if ClickSend is configured
    const config = loadConfig();
    if (!config.clicksend || !config.clicksend.username || !config.clicksend.api_key) {
      console.log('❌ ClickSend not configured');
      return res.status(400).json({ 
        error: 'ClickSend not configured',
        message: 'Please configure ClickSend credentials at /setup'
      });
    }
    
    // ClickSend API credentials
    const clicksendAuth = Buffer.from(`${config.clicksend.username}:${config.clicksend.api_key}`).toString('base64');
    
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
    
    // Process each event
    for (const event of eventsWithHash) {
      const title = event.summary || '';
      console.log(`\n--- Processing Event ---`);
      console.log(`Title: ${title}`);
      
      // Split by # to get the parts
      const parts = title.split('#');
      
      if (parts.length < 2) {
        console.log('⚠️  No content after "#", skipping...');
        results.push({
          title,
          status: 'skipped',
          reason: 'No content after #'
        });
        continue;
      }
      
      const beforeHash = parts[0].trim(); // Everything before #
      const afterHash = parts[1].trim();  // Everything after # (phone number)
      
      // Extract phone number (everything after #)
      let phoneNumber = afterHash;
      
      // Format: Remove any spaces, hyphens, or special characters
      phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
      
      let fullPhoneNumber;
      if (phoneNumber.startsWith('+')) {
        // Already has country code
        fullPhoneNumber = phoneNumber;
      } else {
        // Add Ireland prefix (+353) by default
        fullPhoneNumber = `+353${phoneNumber}`;
      }
      
      // Create message
      const message = `Hello ${beforeHash}!`;
      
      console.log(`📝 Message: "${message}"`);
      console.log(`📞 Raw Phone: ${afterHash}`);
      console.log(`📞 Formatted: ${fullPhoneNumber}`);
      
      try {
        // Send SMS via ClickSend REST API
        console.log(`📤 Attempting to send SMS...`);
        
        const smsResult = await axios.post(
          'https://rest.clicksend.com/v3/sms/send',
          {
            messages: [
              {
                to: fullPhoneNumber,
                body: message,
                source: 'sdk'
              }
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${clicksendAuth}`
            }
          }
        );
        
        console.log(`✅ SMS sent successfully! Message ID: ${smsResult.data.data.messages[0].message_id}`);
        
        // Mark the calendar event as reminded by adding 🔔 emoji
        try {
          await markEventAsReminded(event.id, title);
          console.log(`🔔 Event marked as reminded in calendar`);
        } catch (markError) {
          console.error(`⚠️  Could not mark event: ${markError.message}`);
        }
        
        results.push({
          title,
          beforeHash,
          phoneNumber: afterHash,
          fullPhoneNumber,
          message,
          status: 'sent',
          messageId: smsResult.data.data.messages[0].message_id
        });
        
      } catch (smsError) {
        console.error(`❌ Failed to send SMS: ${smsError.response?.data?.response_msg || smsError.message}`);
        
        // Check for common ClickSend errors
        if (smsError.response?.data?.response_msg) {
          console.error(`💡 ClickSend Error: ${smsError.response.data.response_msg}`);
        }
        
        results.push({
          title,
          beforeHash,
          phoneNumber: afterHash,
          fullPhoneNumber,
          message,
          status: 'failed',
          error: smsError.message,
          errorCode: smsError.code
        });
      }
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
    
    if (!config.clicksend || !config.clicksend.username || !config.clicksend.api_key) {
      console.log('⚠️  ClickSend not configured. Skipping...');
      return;
    }
    
    // ClickSend API credentials
    const clicksendAuth = Buffer.from(`${config.clicksend.username}:${config.clicksend.api_key}`).toString('base64');
    
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
    
    // Process each event
    for (const event of eventsWithHash) {
      const title = event.summary || '';
      const eventStart = event.start.dateTime || event.start.date;
      
      console.log(`\n📌 Processing: ${title}`);
      console.log(`   Appointment time: ${new Date(eventStart).toLocaleString()}`);
      
      // Split by # to get the parts
      const parts = title.split('#');
      
      if (parts.length < 2) {
        console.log('⚠️  No content after "#", skipping...');
        continue;
      }
      
      const beforeHash = parts[0].trim();
      const afterHash = parts[1].trim();
      
      // Extract and format phone number
      let phoneNumber = afterHash.replace(/[\s\-\(\)]/g, '');
      let fullPhoneNumber;
      
      if (phoneNumber.startsWith('+')) {
        fullPhoneNumber = phoneNumber;
      } else {
        // Add Ireland prefix (+353) by default
        fullPhoneNumber = `+353${phoneNumber}`;
      }
      
      // Create message
      const message = `Hello ${beforeHash}!`;
      
      console.log(`   📝 Message: "${message}"`);
      console.log(`   📞 Phone: ${fullPhoneNumber}`);
      
      try {
        // Send SMS via ClickSend REST API
        const smsResult = await axios.post(
          'https://rest.clicksend.com/v3/sms/send',
          {
            messages: [
              {
                to: fullPhoneNumber,
                body: message,
                source: 'sdk'
              }
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${clicksendAuth}`
            }
          }
        );
        
        console.log(`   ✅ SMS sent! ID: ${smsResult.data.data.messages[0].message_id}`);
        
        // Mark the calendar event as reminded by adding 🔔 emoji
        try {
          await markEventAsReminded(event.id, title);
          console.log(`   🔔 Event marked as reminded in calendar`);
        } catch (markError) {
          console.error(`   ⚠️  Could not mark event: ${markError.message}`);
        }
        
        sentCount++;
        
      } catch (smsError) {
        console.error(`   ❌ Failed: ${smsError.response?.data?.response_msg || smsError.message}`);
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
const cronJob = cron.schedule('*/15 * * * *', () => {
  sendAutomatedReminders();
}, {
  scheduled: true,
  timezone: "Europe/Amsterdam" // Adjust to your timezone
});

// Use routes
app.use('/', setupRoutes);
app.use('/', authRoutes);

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`➡ Go to http://localhost:${port}/setup to configure authentication`);
  console.log(`⏰ Automated reminders scheduled: Every 15 minutes`);
  console.log(`🌍 Timezone: Europe/Amsterdam`);
  console.log(`📱 Checking for appointments in next 48 hours\n`);
  
  // Run once on startup (optional - remove if you don't want immediate check)
  console.log('🔄 Running initial check...');
  sendAutomatedReminders();
});

module.exports = app;