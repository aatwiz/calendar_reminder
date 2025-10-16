const express = require('express');
const crypto = require('crypto');
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
  const whatsappConfigured = config.whatsapp && config.whatsapp.phone_number_id && config.whatsapp.access_token;
  
  res.send(renderSetupPage(googleAuthenticated, whatsappConfigured));
});

/**
 * POST /save-whatsapp - Save WhatsApp Business credentials
 */
router.post('/save-whatsapp', (req, res) => {
  const config = loadConfig();

  // Generate verify token if not provided
  const verifyToken = req.body.verify_token || crypto.randomBytes(32).toString('hex');

  config.whatsapp = {
    phone_number_id: req.body.phone_number_id,
    business_account_id: req.body.business_account_id,
    access_token: req.body.access_token,
    verify_token: verifyToken
  };
  
  // Save clinic phone number for patient messages
  if (req.body.clinic_phone) {
    config.clinic_phone = req.body.clinic_phone;
  }

  // Save template name
  if (req.body.template_name) {
    config.template_name = req.body.template_name;
  }

  saveConfig(config);

  res.redirect('/setup');
});

/**
 * POST /revoke-whatsapp - Remove WhatsApp credentials
 */
router.post('/revoke-whatsapp', (req, res) => {
  const config = loadConfig();
  delete config.whatsapp;
  saveConfig(config);
  res.redirect('/setup');
});

module.exports = router;