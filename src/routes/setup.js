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
  const clicksendConfigured = config.clicksend && config.clicksend.username && config.clicksend.api_key;
  
  res.send(renderSetupPage(googleAuthenticated, clicksendConfigured));
});

/**
 * POST /save-clicksend - Save ClickSend credentials
 */
router.post('/save-clicksend', (req, res) => {
  const config = loadConfig();

  config.clicksend = {
    username: req.body.clicksend_username,
    api_key: req.body.clicksend_api_key,
  };

  saveConfig(config);

  res.redirect('/setup');
});

/**
 * POST /revoke-clicksend - Remove ClickSend credentials
 */
router.post('/revoke-clicksend', (req, res) => {
  const config = loadConfig();
  delete config.clicksend;
  saveConfig(config);
  res.redirect('/setup');
});

module.exports = router;