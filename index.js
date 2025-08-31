const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const twilio = require('twilio');

// ==== CONFIG ====
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_FROM = process.env.TWILIO_FROM;
const PORT = process.env.PORT || 3000;

// ==== INIT ====
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const client = twilio(TWILIO_SID, TWILIO_TOKEN);
const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

// ==== AUTH ====
function authorize(callback) {
  if (fs.existsSync('token.json')) {
    const token = fs.readFileSync('token.json');
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  } else {
    getAccessToken(oAuth2Client, callback);
  }
}

function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
  console.log('Authorize this app by visiting this url:', authUrl);
}

// ==== CALENDAR ====
function checkEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 20,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.error('The API returned an error: ' + err);

    const events = res.data.items;
    if (!events.length) {
      console.log('No upcoming events found.');
      return;
    }

    events.forEach(event => {
      const start = event.start.dateTime || event.start.date;

      if (is48HoursAway(start)) {
        console.log(`Event: ${event.summary} at ${start}`);
        const details = extractDetails(event.description || "");
        if (details.phone && details.name) {
          sendReminder(details.name, details.phone, start);
        }
      }
    });
  });
}

function is48HoursAway(dateString) {
  const now = new Date();
  const eventDate = new Date(dateString);
  const diffHours = (eventDate - now) / (1000 * 60 * 60);
  return diffHours >= 47 && diffHours <= 49; // +/- 1hr window
}

function extractDetails(description) {
  const nameMatch = description.match(/Name:\s*(.*)/i);
  const phoneMatch = description.match(/Phone:\s*(.*)/i);
  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    phone: phoneMatch ? phoneMatch[1].trim() : null
  };
}

// ==== SMS ====
function sendReminder(name, phone, eventDate) {
  const message = `Hi ${name}, reminder of your appointment on ${eventDate}. 
Reply "cancel" to cancel or "reschedule" to change.`;

  client.messages.create({
    body: message,
    from: TWILIO_FROM,
    to: phone
  }).then(msg => console.log("Message sent:", msg.sid))
    .catch(err => console.error("SMS error:", err));
}

// ==== WEBHOOK ====
app.post('/sms-reply', (req, res) => {
  const incoming = req.body.Body.toLowerCase();
  const from = req.body.From;

  if (incoming.includes("cancel")) {
    console.log(`${from} wants to cancel their appointment.`);
  } else if (incoming.includes("reschedule")) {
    console.log(`${from} wants to reschedule.`);
  } else {
    console.log(`${from} replied with: ${incoming}`);
  }

  // Twilio expects an empty XML <Response>
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
});

// ==== RUN ====
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  authorize(checkEvents); // Kick off once on startup
});