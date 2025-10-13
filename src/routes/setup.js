const express = require('express');
const { loadConfig, saveConfig } = require('../config');
const { isGoogleAuthenticated } = require('../services/googleCalendar');
const { renderSetupPage } = require('../views');

const router = express.Router();

/**
 * GET /setup - Display setup page
 */
router.get('/setup', (req, res) => {
  const config = loadConfig();
  const googleAuthenticated = isGoogleAuthenticated();
  const twilioConfigured = config.twilio && config.twilio.sid && config.twilio.auth_token;
  
  res.send(renderSetupPage(googleAuthenticated, twilioConfigured));
});

/**
 * POST /save-twilio - Save Twilio credentials and clinic phone
 */
router.post('/save-twilio', (req, res) => {
  const config = loadConfig();

  config.twilio = {
    sid: req.body.twilio_sid,
    auth_token: req.body.twilio_auth_token,
    phone: req.body.twilio_phone,
  };
  
  // Save clinic phone number for reschedule messages
  if (req.body.clinic_phone) {
    config.clinic = config.clinic || {};
    config.clinic.phone = req.body.clinic_phone;
  }

  saveConfig(config);

  res.redirect('/setup');
});

/**
 * POST /revoke-twilio - Remove Twilio credentials
 */
router.post('/revoke-twilio', (req, res) => {
  const config = loadConfig();
  delete config.twilio;
  saveConfig(config);
  res.redirect('/setup');
});

module.exports = router;