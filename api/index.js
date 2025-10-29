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
  if (config.whatsapp) {
    whatsapp.initialize(config.whatsapp);
  }
}

// Initialize WhatsApp on startup
initializeWhatsApp();

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

// Main routes (with authentication required)
app.use('/', setupRoutes);
app.use('/', authRoutes);

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export app for Vercel serverless
module.exports = app;
