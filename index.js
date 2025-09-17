const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const axios = require('axios');

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

          <h3>WhatsApp Business API</h3>
          <label>API Token:</label>
          <input type="password" name="whatsapp_token" required />
          <label>Phone Number ID:</label>
          <input type="text" name="whatsapp_phone_id" required />
          <label>Business Account ID:</label>
          <input type="text" name="whatsapp_business_id" required />

          <h3>Email Configuration</h3>
          <label>SMTP Host:</label>
          <input type="text" name="email_host" required />
          <label>SMTP Port:</label>
          <input type="number" name="email_port" value="587" required />
          <label>Email:</label>
          <input type="email" name="email_user" required />
          <label>Password:</label>
          <input type="password" name="email_password" required />

          <h3>Notification Settings</h3>
          <label>Receptionist Email:</label>
          <input type="email" name="receptionist_email" required />
          <label>Receptionist WhatsApp:</label>
          <input type="text" name="receptionist_whatsapp" placeholder="+1234567890" required />

          <button type="submit">Save</button>
        </form>
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

  config.whatsapp = {
    token: req.body.whatsapp_token,
    phone_id: req.body.whatsapp_phone_id,
    business_id: req.body.whatsapp_business_id,
  };

  config.email = {
    host: req.body.email_host,
    port: parseInt(req.body.email_port),
    user: req.body.email_user,
    password: req.body.email_password,
  };

  config.notifications = {
    receptionist_email: req.body.receptionist_email,
    receptionist_whatsapp: req.body.receptionist_whatsapp,
  };

  saveConfig(config);

  res.send("✅ Keys saved successfully! Restart the app and you're good to go.");
});

// ========= GOOGLE CALENDAR AUTH =========
function getOAuthClient() {
  const config = loadConfig();
  if (!config.google) throw new Error("Google Calendar API keys not set. Go to /setup first.");
  
  return new google.auth.OAuth2(
    config.google.client_id,
    config.google.client_secret,
    config.google.redirect_uri
  );
}

app.get('/auth', (req, res) => {
  const oAuth2Client = getOAuthClient();
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
  });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  const oAuth2Client = getOAuthClient();
  const { code } = req.query;
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  const config = loadConfig();
  config.google.tokens = tokens;
  saveConfig(config);

  res.send("✅ Google authentication successful! Tokens stored.");
});

// ========= SAMPLE EVENT FETCH =========
app.get('/events', async (req, res) => {
  const config = loadConfig();
  if (!config.google || !config.google.tokens) {
    return res.send("❌ Google not authenticated. Go to /auth first.");
  }

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials(config.google.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 5,
    singleEvents: true,
    orderBy: 'startTime',
  });

  res.json(events.data.items);
});

// ========= MESSAGING SERVICES =========

// WhatsApp Business API message sender
async function sendWhatsAppMessage(to, message) {
  const config = loadConfig();
  if (!config.whatsapp) {
    console.log('WhatsApp configuration not set, skipping WhatsApp message');
    return false;
  }
  
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${config.whatsapp.phone_id}/messages`,
      {
        messaging_product: "whatsapp",
        to: to.replace(/[^\d]/g, ''), // Remove non-digits from phone number
        type: "text",
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${config.whatsapp.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('WhatsApp message sent successfully:', response.data);
    return true;
  } catch (error) {
    console.error('WhatsApp message failed:', error.response?.data || error.message);
    return false;
  }
}

// Email sender
async function sendEmail(to, subject, message) {
  const config = loadConfig();
  if (!config.email) {
    console.log('Email configuration not set, skipping email');
    return false;
  }
  
  try {
    const transporter = nodemailer.createTransporter({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });

    const mailOptions = {
      from: config.email.user,
      to: to,
      subject: subject,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    return false;
  }
}

// SMS sender using Twilio
async function sendSMS(to, message) {
  const config = loadConfig();
  if (!config.twilio) {
    console.log('Twilio configuration not set, skipping SMS');
    return false;
  }
  
  try {
    const twilio = require('twilio')(config.twilio.sid, config.twilio.auth_token);
    const result = await twilio.messages.create({
      body: message,
      from: config.twilio.phone,
      to: to
    });
    console.log('SMS sent successfully:', result.sid);
    return true;
  } catch (error) {
    console.error('SMS sending failed:', error.message);
    return false;
  }
}

// ========= APPOINTMENT REMINDER SYSTEM =========

// Get appointments from Google Calendar
async function getUpcomingAppointments() {
  const config = loadConfig();
  if (!config.google || !config.google.tokens) {
    throw new Error('Google Calendar not authenticated');
  }

  const oAuth2Client = getOAuthClient();
  oAuth2Client.setCredentials(config.google.tokens);

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  
  // Get appointments for the next 3 days (to catch 2-day reminders)
  const timeMin = new Date();
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 3);

  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return events.data.items || [];
}

// Check for appointments that need reminders (2 days away)
async function checkAndSendReminders() {
  try {
    console.log('🔍 Checking for appointments that need reminders...');
    
    const appointments = await getUpcomingAppointments();
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    twoDaysFromNow.setHours(0, 0, 0, 0); // Start of day
    
    const endOfTargetDay = new Date(twoDaysFromNow);
    endOfTargetDay.setHours(23, 59, 59, 999); // End of day

    for (const appointment of appointments) {
      const appointmentDate = new Date(appointment.start.dateTime || appointment.start.date);
      
      // Check if appointment is 2 days from now
      if (appointmentDate >= twoDaysFromNow && appointmentDate <= endOfTargetDay) {
        await sendAppointmentReminder(appointment);
      }
    }
  } catch (error) {
    console.error('Error checking appointments:', error.message);
  }
}

// Send reminder for a specific appointment
async function sendAppointmentReminder(appointment) {
  const appointmentDate = new Date(appointment.start.dateTime || appointment.start.date);
  const formattedDate = appointmentDate.toLocaleDateString();
  const formattedTime = appointmentDate.toLocaleTimeString();
  
  // Extract patient info from appointment description or attendees
  let patientPhone = null;
  let patientEmail = null;
  let doctorEmail = null;
  
  // Try to extract contact info from appointment description
  if (appointment.description) {
    const phoneMatch = appointment.description.match(/phone:\s*([+]?[\d\s\-()]+)/i);
    const emailMatch = appointment.description.match(/email:\s*([^\s,]+@[^\s,]+)/i);
    const doctorMatch = appointment.description.match(/doctor:\s*([^\s,]+@[^\s,]+)/i);
    
    patientPhone = phoneMatch ? phoneMatch[1].trim() : null;
    patientEmail = emailMatch ? emailMatch[1].trim() : null;
    doctorEmail = doctorMatch ? doctorMatch[1].trim() : null;
  }

  if (!patientPhone && !patientEmail) {
    console.log('⚠️  No patient contact info found for appointment:', appointment.summary);
    return;
  }

  const message = `Hi! This is a reminder that you have an appointment scheduled for ${formattedDate} at ${formattedTime}. 

Please don't respond if you're coming as planned.

Reply "RESCHEDULE" if you need to reschedule.
Reply "CANCEL" if you need to cancel.

Thank you!`;

  console.log(`📧 Sending reminder for appointment: ${appointment.summary}`);
  
  // Store appointment info for response handling
  const reminderData = {
    appointmentId: appointment.id,
    patientPhone,
    patientEmail,
    doctorEmail,
    appointmentDate: formattedDate,
    appointmentTime: formattedTime,
    summary: appointment.summary
  };
  
  // Store in a simple JSON file for now (in production, use a database)
  const remindersFile = 'active_reminders.json';
  let activeReminders = {};
  if (fs.existsSync(remindersFile)) {
    activeReminders = JSON.parse(fs.readFileSync(remindersFile));
  }
  activeReminders[appointment.id] = reminderData;
  fs.writeFileSync(remindersFile, JSON.stringify(activeReminders, null, 2));

  // Try WhatsApp first, then SMS, then email
  let sent = false;
  
  if (patientPhone) {
    sent = await sendWhatsAppMessage(patientPhone, message);
    if (!sent) {
      sent = await sendSMS(patientPhone, message);
    }
  }
  
  if (!sent && patientEmail) {
    sent = await sendEmail(patientEmail, 'Appointment Reminder', message);
  }
  
  if (sent) {
    console.log('✅ Reminder sent successfully');
  } else {
    console.log('❌ Failed to send reminder');
  }
}

// ========= RESPONSE HANDLING =========

// Webhook for WhatsApp responses
app.post('/whatsapp-webhook', (req, res) => {
  console.log('WhatsApp webhook received:', JSON.stringify(req.body, null, 2));
  
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const messages = changes?.value?.messages;
    
    if (messages && messages.length > 0) {
      messages.forEach(message => {
        if (message.type === 'text') {
          handlePatientResponse(message.from, message.text.body, 'whatsapp');
        }
      });
    }
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error.message);
  }
  
  res.status(200).send('OK');
});

// Webhook for Twilio SMS responses
app.post('/twilio-webhook', (req, res) => {
  console.log('Twilio webhook received:', req.body);
  
  const from = req.body.From;
  const message = req.body.Body;
  
  if (from && message) {
    handlePatientResponse(from, message, 'sms');
  }
  
  res.status(200).send('OK');
});

// Handle patient responses
async function handlePatientResponse(from, message, channel) {
  const responseText = message.toLowerCase().trim();
  
  // Find the appointment associated with this patient
  const remindersFile = 'active_reminders.json';
  if (!fs.existsSync(remindersFile)) {
    console.log('No active reminders found');
    return;
  }
  
  const activeReminders = JSON.parse(fs.readFileSync(remindersFile));
  let matchedAppointment = null;
  let appointmentId = null;
  
  // Find appointment by phone number or email
  for (const [id, reminder] of Object.entries(activeReminders)) {
    if (reminder.patientPhone === from || reminder.patientEmail === from) {
      matchedAppointment = reminder;
      appointmentId = id;
      break;
    }
  }
  
  if (!matchedAppointment) {
    console.log(`No matching appointment found for ${from}`);
    return;
  }
  
  console.log(`📱 Patient response: "${message}" for appointment: ${matchedAppointment.summary}`);
  
  if (responseText.includes('reschedule')) {
    await handleRescheduleRequest(matchedAppointment, from, channel);
  } else if (responseText.includes('cancel')) {
    await handleCancelRequest(matchedAppointment, from, channel);
  }
  
  // Remove from active reminders after handling
  delete activeReminders[appointmentId];
  fs.writeFileSync(remindersFile, JSON.stringify(activeReminders, null, 2));
}

// Handle reschedule requests
async function handleRescheduleRequest(appointment, patientContact, channel) {
  console.log('🔄 Processing reschedule request');
  
  const config = loadConfig();
  const receptionistEmail = config.notifications?.receptionist_email;
  const receptionistWhatsApp = config.notifications?.receptionist_whatsapp;
  
  // Send confirmation to patient
  const patientMessage = `Thank you for letting us know. A doctor will be in touch shortly to discuss rescheduling your appointment.`;
  
  if (channel === 'whatsapp') {
    await sendWhatsAppMessage(patientContact, patientMessage);
  } else if (channel === 'sms') {
    await sendSMS(patientContact, patientMessage);
  }
  
  // Notify receptionist
  const receptionistMessage = `🔄 RESCHEDULE REQUEST

Patient Contact: ${patientContact}
Appointment: ${appointment.summary}
Original Date: ${appointment.appointmentDate} at ${appointment.appointmentTime}

Please contact the patient to arrange a new appointment time.`;

  if (receptionistWhatsApp) {
    await sendWhatsAppMessage(receptionistWhatsApp, receptionistMessage);
  }
  
  if (receptionistEmail) {
    await sendEmail(receptionistEmail, 'Patient Reschedule Request', receptionistMessage);
  }
}

// Handle cancel requests
async function handleCancelRequest(appointment, patientContact, channel) {
  console.log('❌ Processing cancel request');
  
  // Send confirmation to patient
  const patientMessage = `Your appointment has been cancelled. Thank you for letting us know in advance.`;
  
  if (channel === 'whatsapp') {
    await sendWhatsAppMessage(patientContact, patientMessage);
  } else if (channel === 'sms') {
    await sendSMS(patientContact, patientMessage);
  }
  
  // Notify doctor
  const doctorMessage = `❌ APPOINTMENT CANCELLED

Patient Contact: ${patientContact}
Appointment: ${appointment.summary}
Date: ${appointment.appointmentDate} at ${appointment.appointmentTime}

The patient has cancelled their appointment.`;

  if (appointment.doctorEmail) {
    await sendEmail(appointment.doctorEmail, 'Patient Appointment Cancellation', doctorMessage);
    
    // Also try to send WhatsApp if doctor has WhatsApp (assume same as email prefix + phone format)
    // This is a simplified approach - in production, you'd have a proper doctor contact database
  }
}

// ========= SCHEDULER =========

// Run reminder check every hour
cron.schedule('0 * * * *', () => {
  console.log('🕐 Running scheduled reminder check...');
  checkAndSendReminders();
});

// Manual trigger for testing
app.get('/check-reminders', async (req, res) => {
  try {
    await checkAndSendReminders();
    res.send('✅ Reminder check completed');
  } catch (error) {
    res.status(500).send(`❌ Error: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`➡ Go to http://localhost:${port}/setup to enter API keys`);
});