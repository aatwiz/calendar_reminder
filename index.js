const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');

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

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`➡ Go to http://localhost:${port}/setup to enter API keys`);
});