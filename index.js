const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');

require('dotenv').config();

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

const { loadConfig } = require('./src/config');
const { isGoogleAuthenticated, getCalendarEvents, markEventAsReminded } = require('./src/services/googleCalendar');
const whatsapp = require('./src/services/whatsapp');
const conversationState = require('./src/services/conversationState');

const setupRoutes = require('./src/routes/setup');
const authRoutes = require('./src/routes/auth');
const whatsappWebhookRoutes = require('./src/routes/whatsappWebhook');

function initializeWhatsApp() {
  const config = loadConfig();
  if (config.whatsapp) {
    whatsapp.initialize(config.whatsapp);
    console.log('✅ WhatsApp service initialized');
  } else {
    console.log('⚠️  WhatsApp not configured yet - visit /setup');
  }
}

async function processWhatsAppReminder(event, verbose = false) {
  const title = event.summary || '';
  const logPrefix = verbose ? '' : '   ';
  
  if (verbose) {
    console.log('\n--- Processing Event ---');
    console.log(`Title: ${title}`);
  } else {
    console.log(`\n${logPrefix}📌 Processing: ${title}`);
    const eventStart = event.start.dateTime || event.start.date;
    console.log(`${logPrefix}Appointment time: ${new Date(eventStart).toLocaleString()}`);
  }
  
  const parts = title.split('#');
  
  if (parts.length < 2) {
    console.log(`${logPrefix}⚠️  No content after "#", skipping...`);
    return {
      title,
      status: 'skipped',
      reason: 'No content after #'
    };
  }
  
  const patientName = parts[0].trim();
  const phoneNumber = parts[1].trim();
  
  let fullPhoneNumber;
  if (phoneNumber.startsWith('+')) {
    fullPhoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
  } else {
    fullPhoneNumber = `+353${phoneNumber.replace(/[\s\-\(\)]/g, '')}`;
  }
  
  const eventStart = event.start.dateTime || event.start.date;
  const appointmentDate = new Date(eventStart);
  const formattedDate = appointmentDate.toLocaleString('en-IE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Dublin'
  });
  
  const config = loadConfig();
  const clinicPhone = config.clinic_phone || '+353 (call clinic)';
  const templateName = config.template_name || 'appointment_reminder';
  
  if (verbose) {
    console.log(`📝 Patient: ${patientName}`);
    console.log(`📞 Raw Phone: ${phoneNumber}`);
    console.log(`📞 Formatted: ${fullPhoneNumber}`);
    console.log(`📅 Appointment: ${formattedDate}`);
    console.log('📤 Attempting to send WhatsApp...');
  } else {
    console.log(`${logPrefix}📝 Patient: ${patientName}`);
    console.log(`${logPrefix}📞 Phone: ${fullPhoneNumber}`);
  }
  
  try {
    const result = await whatsapp.sendTemplateMessage(
      fullPhoneNumber,
      templateName,
      [patientName, formattedDate]
    );
    
    console.log(`${logPrefix}✅ WhatsApp sent! Message ID: ${result.messages[0].id}`);
    
    conversationState.setConversation(fullPhoneNumber, {
      eventId: event.id,
      patientName: patientName,
      appointmentTime: eventStart
    });
    
    await markEventAsReminded(event.id, title);
    console.log(`${logPrefix}🔔 Calendar event marked as reminded`);
    
    return {
      title,
      patient: patientName,
      phone: fullPhoneNumber,
      status: 'sent',
      messageId: result.messages[0].id
    };
    
  } catch (error) {
    console.error(`${logPrefix}❌ Failed to send WhatsApp:`, error.message);
    return {
      title,
      patient: patientName,
      phone: fullPhoneNumber,
      status: 'failed',
      error: error.message
    };
  }
}

async function sendAutomatedReminders() {
  console.log('\n⏰ ===== AUTOMATED REMINDER CHECK =====');
  const now = new Date();
  console.log(`📅 Time: ${now.toLocaleString()}`);
  
  if (!isGoogleAuthenticated()) {
    console.log('❌ Google Calendar not authenticated. Go to /auth first.');
    console.log('===== END OF AUTOMATED CHECK =====\n');
    return;
  }
  
  if (!whatsapp.isConfigured()) {
    console.log('❌ WhatsApp not configured. Go to /setup to add credentials.');
    console.log('===== END OF AUTOMATED CHECK =====\n');
    return;
  }
  
  try {
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setHours(timeMax.getHours() + 48);
    
    console.log('🔍 Checking for events between:');
    console.log(`   From: ${timeMin.toLocaleString()}`);
    console.log(`   To:   ${timeMax.toLocaleString()}`);
    
    const allEvents = await getCalendarEvents({
      timeMin,
      timeMax,
      maxResults: 50
    });
    
    console.log(`✅ Found ${allEvents.length} total event(s) in next 48 hours`);
    
    const eventsToRemind = allEvents.filter(event => {
      const title = event.summary || '';
      const hasHash = title.includes('#');
      const hasStatusEmoji = /^[🔔✅❌❓]/.test(title);
      return hasHash && !hasStatusEmoji;
    });
    
    console.log(`🔍 Found ${eventsToRemind.length} event(s) with "#" (patient appointments, not yet reminded)`);
    
    if (eventsToRemind.length === 0) {
      console.log('📭 No patient appointments to remind.');
      console.log('===== END OF AUTOMATED CHECK =====\n');
      return;
    }
    
    let sentCount = 0;
    let failedCount = 0;
    
    for (const event of eventsToRemind) {
      const result = await processWhatsAppReminder(event);
      if (result.status === 'sent') {
        sentCount++;
      } else {
        failedCount++;
      }
    }
    
    console.log(`\n�� Summary:`);
    console.log(`   ✅ Sent: ${sentCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log('===== END OF AUTOMATED CHECK =====\n');
    
  } catch (error) {
    console.error('❌ Error in automated reminders:', error);
    console.log('===== END OF AUTOMATED CHECK =====\n');
  }
}

app.get('/', (req, res) => {
  const config = loadConfig();
  const googleAuth = isGoogleAuthenticated();
  const whatsappConfig = whatsapp.isConfigured();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Clinic Appointment Reminder</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 Clinic Appointment Reminder</h1>
          <p>WhatsApp-based appointment reminder system</p>
        </div>
        <div class="content">
          <h2>System Status</h2>
          <p>Google Calendar: ${googleAuth ? '✅ Connected' : '❌ Not connected'}</p>
          <p>WhatsApp Business: ${whatsappConfig ? '✅ Configured' : '❌ Not configured'}</p>
          
          <h2>Quick Actions</h2>
          <div class="actions">
            <a href="/setup" class="btn btn-primary">⚙️ Setup</a>
            ${googleAuth && whatsappConfig ? '<a href="/send-reminders" class="btn btn-confirm">📤 Send Reminders Now</a>' : ''}
            ${googleAuth ? '<a href="/test-calendar" class="btn">📅 Test Calendar</a>' : ''}
          </div>
          
          <h2>How It Works</h2>
          <ol style="text-align: left; margin: 20px auto; max-width: 500px;">
            <li>Create calendar events with format: <code>Patient Name #PhoneNumber</code></li>
            <li>System sends WhatsApp reminders 24-48h before appointment</li>
            <li>Patients reply with: CONFIRM, CANCEL, or RESCHEDULE</li>
            <li>Calendar automatically updates with emoji status</li>
          </ol>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/test-calendar', async (req, res) => {
  if (!isGoogleAuthenticated()) {
    return res.send('❌ Google Calendar not authenticated. <a href="/auth">Authenticate</a>');
  }
  
  try {
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 7);
    
    const events = await getCalendarEvents({ timeMin, timeMax, maxResults: 20 });
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Calendar Events</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Calendar Events (Next 7 Days)</h1>
          </div>
          <div class="content">
            <p>Found ${events.length} event(s)</p>
    `;
    
    events.forEach(event => {
      const start = event.start.dateTime || event.start.date;
      const title = event.summary || 'No title';
      const hasHash = title.includes('#');
      
      html += `
        <div class="appointment-info" style="margin-bottom: 10px;">
          <strong>${title}</strong><br/>
          ${new Date(start).toLocaleString()}<br/>
          ${hasHash ? '✅ Patient appointment' : '⚪ Regular event'}
        </div>
      `;
    });
    
    html += `
            <a href="/" class="btn btn-primary">Back to Home</a>
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    res.send(`<h1>Error</h1><p>${error.message}</p><a href="/">Back</a>`);
  }
});

app.get('/send-reminders', async (req, res) => {
  if (!isGoogleAuthenticated()) {
    return res.send('❌ Google Calendar not authenticated. <a href="/auth">Authenticate</a>');
  }
  
  if (!whatsapp.isConfigured()) {
    return res.send('❌ WhatsApp not configured. <a href="/setup">Configure WhatsApp</a>');
  }
  
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Transfer-Encoding': 'chunked'
  });
  
  res.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sending Reminders</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📤 Sending WhatsApp Reminders</h1>
        </div>
        <div class="content">
          <pre style="text-align: left; background: #000; color: #0f0; padding: 20px; border-radius: 8px; overflow-x: auto;">
  `);
  
  const originalLog = console.log;
  console.log = (...args) => {
    originalLog(...args);
    res.write(args.join(' ') + '\n');
  };
  
  try {
    await sendAutomatedReminders();
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log = originalLog;
  
  res.write(`
          </pre>
          <a href="/" class="btn btn-primary" style="margin-top: 20px;">Back to Home</a>
        </div>
      </div>
    </body>
    </html>
  `);
  
  res.end();
});

cron.schedule('*/15 * * * *', () => {
  sendAutomatedReminders();
}, {
  scheduled: true,
  timezone: 'Europe/Dublin'
});

cron.schedule('0 0 * * *', () => {
  console.log('\n🧹 ===== CLEANING UP OLD CONVERSATIONS =====');
  conversationState.cleanupOldConversations();
  console.log('===== END OF CLEANUP =====\n');
}, {
  scheduled: true,
  timezone: 'Europe/Dublin'
});

app.use('/', setupRoutes);
app.use('/', authRoutes);
app.use('/webhook/whatsapp', whatsappWebhookRoutes);

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`➡ Go to http://localhost:${port}/setup to configure authentication`);
  console.log('⏰ Automated reminders scheduled: Every 15 minutes');
  console.log('🧹 Cleanup scheduled: Daily at midnight (removes old conversations)');
  console.log('🌍 Timezone: Europe/Dublin');
  console.log('📱 Checking for appointments in next 48 hours\n');
  
  initializeWhatsApp();
  
  // Run initial check asynchronously without blocking server startup
  console.log('🔄 Running initial check (async)...');
  sendAutomatedReminders().catch(err => {
    console.error('Error during initial check:', err.message);
  });
});

module.exports = app;
