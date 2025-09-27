const express = require('express');
const { loadConfig, saveConfig } = require('../config');
const { isGoogleAuthenticated } = require('../services/googleCalendar');
const { renderSetupPage, renderSuccessPage } = require('../views');

const router = express.Router();

/**
 * GET /setup - Display setup page
 */
router.get('/setup', (req, res) => {
  const authenticated = isGoogleAuthenticated();
  res.send(renderSetupPage(authenticated));
});

/**
 * POST /save-keys - Save Twilio and Gmail configuration
 */
router.post('/save-keys', (req, res) => {
  const config = loadConfig();

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

  const html = renderSuccessPage(
    'Configuration Saved',
    'Your Twilio and Gmail settings have been saved successfully. Now authenticate with Google Calendar to complete the setup.'
  );
  
  res.send(html);
});

module.exports = router;