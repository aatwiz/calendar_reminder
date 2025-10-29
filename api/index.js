// Vercel serverless handler - exports the Express app without listening
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');

require('dotenv').config();

const app = express();

// Trust proxy - important for HTTPS cookies on Vercel and other platforms
app.set('trust proxy', 1);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from public folder (relative to project root)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Initialize session and authentication
const { getSessionConfig, isAuthenticated, handleLogin, handleLogout, getLoginPage } = require('../src/middleware/auth');
app.use(getSessionConfig());

const { loadConfig } = require('../src/config');
const { isGoogleAuthenticated, getCalendarEvents, markEventAsReminded } = require('../src/services/googleCalendar');
const whatsapp = require('../src/services/whatsapp');
const conversationState = require('../src/services/conversationState');

const setupRoutes = require('../src/routes/setup');
const authRoutes = require('../src/routes/auth');
const whatsappWebhookRoutes = require('../src/routes/whatsappWebhook');

function initializeWhatsApp() {
  const config = loadConfig();
  // Try to initialize from config.whatsapp first (set via /setup)
  if (config.whatsapp) {
    whatsapp.initialize(config.whatsapp);
    console.log('✅ WhatsApp service initialized from config');
  }
  // Also check environment variables (for Vercel deployment)
  else if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
    const whatsappEnvConfig = {
      phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
      business_account_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      access_token: process.env.WHATSAPP_ACCESS_TOKEN,
      verify_token: process.env.WHATSAPP_VERIFY_TOKEN
    };
    whatsapp.initialize(whatsappEnvConfig);
    // Store in config for consistency
    const config = loadConfig();
    config.whatsapp = whatsappEnvConfig;
    if (process.env.CLINIC_PHONE) config.clinic_phone = process.env.CLINIC_PHONE;
    if (process.env.TEMPLATE_NAME) config.template_name = process.env.TEMPLATE_NAME;
    console.log('✅ WhatsApp service initialized from environment variables');
  }
}

// Initialize WhatsApp on startup
initializeWhatsApp();

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
    console.log(`Patient: ${patientName}`);
    console.log(`Raw Phone: ${phoneNumber}`);
    console.log(`Formatted: ${fullPhoneNumber}`);
    console.log(`Appointment: ${formattedDate}`);
    console.log('Attempting to send WhatsApp...');
  } else {
    console.log(`${logPrefix}Patient: ${patientName}`);
    console.log(`${logPrefix}Phone: ${fullPhoneNumber}`);
  }
  
  try {
    const result = await whatsapp.sendTemplateMessage(
      fullPhoneNumber,
      templateName,
      [patientName, formattedDate]
    );
    
    console.log(`${logPrefix}✅ WhatsApp sent! Message ID: ${result.messages[0].id}`);
    
    // Store conversation - the setConversation function will normalize the phone number
    // This ensures the webhook can find it when the patient replies
    console.log(`${logPrefix}💾 Storing conversation for webhook matching...`);
    conversationState.setConversation(fullPhoneNumber, {
      eventId: event.id,
      patientName: patientName,
      appointmentTime: eventStart
    });
    console.log(`${logPrefix}✅ Conversation stored`);
    
    await markEventAsReminded(event.id, title);
    console.log(`${logPrefix}Calendar event marked as reminded`);
    
    return {
      title,
      patient: patientName,
      phone: fullPhoneNumber,
      status: 'sent',
      messageId: result.messages[0].id
    };
    
  } catch (error) {
    console.error(`${logPrefix}Failed to send WhatsApp:`, error.message);
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
  console.log('\n===== AUTOMATED REMINDER CHECK =====');
  const now = new Date();
  console.log(`Time: ${now.toLocaleString()}`);
  
  if (!isGoogleAuthenticated()) {
    console.log('Google Calendar not authenticated. Go to /auth first.');
    console.log('===== END OF AUTOMATED CHECK =====\n');
    return;
  }
  
  if (!whatsapp.isConfigured()) {
    console.log('WhatsApp not configured. Go to /setup to add credentials.');
    console.log('===== END OF AUTOMATED CHECK =====\n');
    return;
  }
  
  try {
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setHours(timeMax.getHours() + 48);
    
    console.log('Checking for events between:');
    console.log(`   From: ${timeMin.toLocaleString()}`);
    console.log(`   To:   ${timeMax.toLocaleString()}`);
    
    const allEvents = await getCalendarEvents({
      timeMin,
      timeMax,
      maxResults: 50
    });
    
    console.log(`Found ${allEvents.length} total event(s) in next 48 hours`);
    
    const eventsToRemind = allEvents.filter(event => {
      const title = event.summary || '';
      const hasHash = title.includes('#');
      const hasStatusEmoji = /^[✅❌🔄]/.test(title);
      return hasHash && !hasStatusEmoji;
    });
    
    console.log(`Found ${eventsToRemind.length} event(s) with "#" (patient appointments, not yet reminded)`);
    
    if (eventsToRemind.length === 0) {
      console.log('No patient appointments to remind.');
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
    
    console.log(`\nSummary:`);
    console.log(`   Sent: ${sentCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log('===== END OF AUTOMATED CHECK =====\n');
    
  } catch (error) {
    console.error('Error in automated reminders:', error);
    console.log('===== END OF AUTOMATED CHECK =====\n');
  }
}

// Authentication routes (no auth required)
app.get('/login', getLoginPage);
app.post('/login', handleLogin);
app.get('/logout', handleLogout);

// Webhook routes FIRST (no authentication required - WhatsApp needs to access)
app.use('/webhook/whatsapp', whatsappWebhookRoutes);

// Apply authentication middleware to all other routes
app.use(isAuthenticated);

// Root route (with authentication required)
app.get('/', (req, res) => {
  const config = loadConfig();
  const googleAuth = isGoogleAuthenticated();
  const whatsappConfig = whatsapp.isConfigured();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
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
            <a href="/logout" class="btn btn-danger">🚪 Logout</a>
          </div>
          
          <h2>How It Works</h2>
          <ol style="text-align: left; margin: 20px auto; max-width: 500px;">
            <li>Create calendar events with format: <code>Patient Name #PhoneNumber</code></li>
            <li>System sends WhatsApp reminders 24-48h before appointment</li>
            <li>Patients reply with: CONFIRM or RESCHEDULE</li>
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
        <meta charset="UTF-8">
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
    'Content-Type': 'text/html; charset=utf-8',
    'Transfer-Encoding': 'chunked'
  });
  
  res.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
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

// Main routes (with authentication required)
app.use('/', setupRoutes);
app.use('/', authRoutes);

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export app for Vercel serverless
module.exports = app;
