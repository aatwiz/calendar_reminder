const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ========= STORE API KEYS =========
const CONFIG_FILE = 'config.json';

// Load saved config if exists
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE));
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ========= ROUTES =========

// Serve a simple HTML form for inputting keys
app.get('/setup', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Setup API Keys</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f6f8;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 100%;
        }
        h2, h3 {
          margin-top: 0;
          color: #333;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: bold;
          color: #555;
        }
        input {
          width: 100%;
          padding: 0.5rem;
          margin-bottom: 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        button {
          width: 100%;
          padding: 0.75rem;
          background-color: #007bff;
          border: none;
          color: white;
          font-size: 1rem;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background-color: #0056b3;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Setup API Keys</h2>
        <form method="post" action="/save-keys">
          <h3>Google Calendar</h3>
          <label>Client ID:</label>
          <input type="text" name="google_client_id" required />
          <label>Client Secret:</label>
          <input type="text" name="google_client_secret" required />
          <label>Redirect URI:</label>
          <input type="text" name="google_redirect_uri" required />

          <h3>Twilio</h3>
          <label>Account SID:</label>
          <input type="text" name="twilio_sid" required />
          <label>Auth Token:</label>
          <input type="password" name="twilio_auth_token" required />
          <label>Phone Number:</label>
          <input type="text" name="twilio_phone" required />

          <h3>Gmail SMTP (for Doctor Notifications)</h3>
          <label>Gmail Address:</label>
          <input type="email" name="gmail_user" required placeholder="clinic@example.com" />
          <label>Gmail App Password:</label>
          <input type="password" name="gmail_password" required />
          <small style="color: #666; font-size: 0.9em; display: block; margin-bottom: 1rem;">
            Use an App Password, not your regular Gmail password. 
            <a href="https://support.google.com/accounts/answer/185833" target="_blank">Learn how to create one</a>
          </small>

          <button type="submit">Save</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Update the /setup page to include a "Sign in with Google" button
app.get('/setup', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Setup API Keys</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f6f8;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 100%;
        }
        h2 {
          margin-top: 0;
          color: #333;
        }
        button {
          width: 100%;
          padding: 0.75rem;
          background-color: #4285F4;
          border: none;
          color: white;
          font-size: 1rem;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background-color: #357ae8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Setup Google Calendar Access</h2>
        <button onclick="window.location.href='/auth'">Sign in with Google</button>
      </div>
    </body>
    </html>
  `);
});

// Save keys to config.json
app.post('/save-keys', (req, res) => {
  const config = loadConfig();

  config.google = {
    client_id: req.body.google_client_id,
    client_secret: req.body.google_client_secret,
    redirect_uri: req.body.google_redirect_uri,
  };

  config.twilio = {
    sid: req.body.twilio_sid,
    auth_token: req.body.twilio_auth_token,
    phone: req.body.twilio_phone,
  };

  config.gmail = {
    user: req.body.gmail_user,
    password: req.body.gmail_password,
  };

  saveConfig(config);

  res.send('✅ Keys saved successfully! Restart the app and you\'re good to go.');
});

// ========= GOOGLE CALENDAR AUTH =========
// Update getOAuthClient to use environment variables
function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Calendar API keys not set. Ensure .env file contains GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Enhance OAuth flow to support reading and writing Google Calendar events
app.get('/auth', (req, res) => {
  const oAuth2Client = getOAuthClient();
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events', // Read and write access to calendar events
      'https://www.googleapis.com/auth/calendar'
    ],
  });
  res.redirect(url);
});

// Update /oauth2callback to store user's tokens securely
app.get('/oauth2callback', async (req, res) => {
  const oAuth2Client = getOAuthClient();
  const { code } = req.query;
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  const config = loadConfig();
  config.google.tokens = tokens;
  saveConfig(config);

  res.send('✅ Google authentication successful! Tokens stored.');
});

// ========= GMAIL TRANSPORTER =========
function getGmailTransporter() {
  const config = loadConfig();
  if (!config.gmail) throw new Error('Gmail SMTP credentials not set. Go to /setup first.');
  
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: config.gmail.user,
      pass: config.gmail.password
    }
  });
}

// ========= EMAIL FUNCTIONS =========
async function sendDoctorNotification(doctorEmail, patientInfo, appointmentDetails) {
  const transporter = getGmailTransporter();
  const config = loadConfig();
  
  const mailOptions = {
    from: config.gmail.user,
    to: doctorEmail,
    subject: `Appointment Reminder - ${patientInfo.name}`,
    html: `
      <h2>Appointment Reminder</h2>
      <p><strong>Patient:</strong> ${patientInfo.name}</p>
      <p><strong>Phone:</strong> ${patientInfo.phone}</p>
      <p><strong>Contact Method:</strong> ${patientInfo.method}</p>
      <p><strong>Appointment:</strong> ${appointmentDetails.summary || 'No title'}</p>
      <p><strong>Start:</strong> ${appointmentDetails.start}</p>
      <p><strong>End:</strong> ${appointmentDetails.end}</p>
      <hr>
      <p><em>This is an automated notification from the Calendar Reminder System.</em></p>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return { success: true, info };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

// ========= SAMPLE EVENT FETCH =========
app.get('/events', async (req, res) => {
  const config = loadConfig();
  if (!config.google || !config.google.tokens) {
    return res.send('❌ Google not authenticated. Go to /auth first.');
  }

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials(config.google.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  try {
    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10, // Fetch more events for notifications
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json(events.data.items);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

// ========= RESCHEDULE EVENT =========
app.post('/reschedule-event', async (req, res) => {
  const config = loadConfig();
  if (!config.google || !config.google.tokens) {
    return res.send('❌ Google not authenticated. Go to /auth first.');
  }

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials(config.google.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  const { eventId, newStartTime, newEndTime } = req.body;

  try {
    const updatedEvent = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        start: { dateTime: newStartTime },
        end: { dateTime: newEndTime },
      },
    });

    res.json({ message: 'Event rescheduled successfully', event: updatedEvent.data });
  } catch (error) {
    console.error('Error rescheduling event:', error);
    res.status(500).json({ error: 'Failed to reschedule event', details: error.message });
  }
});

// ========= PATIENT METHOD MANAGEMENT =========
// Endpoint to send a test doctor notification
app.post('/send-doctor-notification', async (req, res) => {
  try {
    const { doctorEmail, patientName, patientPhone, patientMethod, appointmentSummary, appointmentStart, appointmentEnd } = req.body;
    
    // Validate method (case insensitive)
    const validMethods = ['whatsapp', 'wa', 'sms'];
    const normalizedMethod = patientMethod.toLowerCase();
    if (!validMethods.includes(normalizedMethod)) {
      return res.status(400).json({ error: 'Invalid method. Use WhatsApp, WA, or SMS (case insensitive)' });
    }
    
    // Format method for display
    const displayMethod = normalizedMethod === 'wa' ? 'WhatsApp' : 
                         normalizedMethod === 'whatsapp' ? 'WhatsApp' : 'SMS';
    
    const patientInfo = {
      name: patientName,
      phone: patientPhone,
      method: displayMethod
    };
    
    const appointmentDetails = {
      summary: appointmentSummary,
      start: appointmentStart,
      end: appointmentEnd
    };
    
    const result = await sendDoctorNotification(doctorEmail, patientInfo, appointmentDetails);
    
    if (result.success) {
      res.json({ message: 'Doctor notification sent successfully', info: result.info });
    } else {
      res.status(500).json({ error: 'Failed to send notification', details: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========= TEST EMAIL ENDPOINT =========
app.get('/test-email', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Doctor Email Notification</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f6f8;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 500px;
          width: 100%;
        }
        h2 {
          margin-top: 0;
          color: #333;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: bold;
          color: #555;
        }
        input, select {
          width: 100%;
          padding: 0.5rem;
          margin-bottom: 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        button {
          width: 100%;
          padding: 0.75rem;
          background-color: #28a745;
          border: none;
          color: white;
          font-size: 1rem;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background-color: #218838;
        }
        .method-info {
          font-size: 0.9em;
          color: #666;
          margin-bottom: 1rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Test Doctor Email Notification</h2>
        <div class="method-info">
          <strong>Patient Method Options:</strong> WhatsApp, WA, or SMS (case insensitive)<br>
          <em>Note: Only doctors receive email notifications, never patients</em>
        </div>
        <form id="emailForm">
          <label>Doctor Email:</label>
          <input type="email" id="doctorEmail" value="dr.smith@clinic.com" required />
          
          <label>Patient Name:</label>
          <input type="text" id="patientName" value="John Doe" required />
          
          <label>Patient Phone:</label>
          <input type="text" id="patientPhone" value="+1234567890" required />
          
          <label>Contact Method:</label>
          <select id="patientMethod" required>
            <option value="WhatsApp">WhatsApp</option>
            <option value="WA">WA</option>
            <option value="SMS">SMS</option>
          </select>
          
          <label>Appointment Summary:</label>
          <input type="text" id="appointmentSummary" value="Annual Checkup" required />
          
          <label>Appointment Start:</label>
          <input type="datetime-local" id="appointmentStart" required />
          
          <label>Appointment End:</label>
          <input type="datetime-local" id="appointmentEnd" required />
          
          <button type="submit">Send Test Email</button>
        </form>
        
        <div id="result" style="margin-top: 1rem;"></div>
        
        <script>
          // Set default datetime values
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(10, 0, 0, 0);
          const endTime = new Date(tomorrow);
          endTime.setHours(11, 0, 0, 0);
          
          document.getElementById('appointmentStart').value = tomorrow.toISOString().slice(0, 16);
          document.getElementById('appointmentEnd').value = endTime.toISOString().slice(0, 16);
          
          document.getElementById('emailForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
              doctorEmail: document.getElementById('doctorEmail').value,
              patientName: document.getElementById('patientName').value,
              patientPhone: document.getElementById('patientPhone').value,
              patientMethod: document.getElementById('patientMethod').value,
              appointmentSummary: document.getElementById('appointmentSummary').value,
              appointmentStart: document.getElementById('appointmentStart').value,
              appointmentEnd: document.getElementById('appointmentEnd').value
            };
            
            try {
              const response = await fetch('/send-doctor-notification', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
              });
              
              const result = await response.json();
              
              const resultDiv = document.getElementById('result');
              if (response.ok) {
                resultDiv.innerHTML = '<div style="color: green; font-weight: bold;">✅ Email sent successfully!</div>';
              } else {
                resultDiv.innerHTML = '<div style="color: red; font-weight: bold;">❌ Error: ' + (result.error || 'Unknown error') + '</div>';
              }
            } catch (error) {
              document.getElementById('result').innerHTML = '<div style="color: red; font-weight: bold;">❌ Network error: ' + error.message + '</div>';
            }
          });
        </script>
      </div>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`➡ Go to http://localhost:${port}/setup to enter API keys`);
  console.log(`📧 Go to http://localhost:${port}/test-email to test doctor notifications`);
});