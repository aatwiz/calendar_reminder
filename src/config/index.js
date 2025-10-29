const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../config.json');

// In-memory config for Vercel (read-only filesystem)
let memoryConfig = {};

/**
 * Load saved configuration if it exists
 * Falls back to environment variables for production deployment
 * @returns {Object} Configuration object
 */
function loadConfig() {
  const isVercel = !!process.env.VERCEL;
  
  // On Vercel, use in-memory store
  if (isVercel) {
    return memoryConfig;
  }
  
  // First try to load from file (local development)
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE));
  }
  
  // If on production (Railway), build config from environment variables
  if (process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return {
      whatsapp: {
        phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
        business_account_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
        access_token: process.env.WHATSAPP_ACCESS_TOKEN,
        verify_token: process.env.WHATSAPP_VERIFY_TOKEN
      },
      google: {}
    };
  }
  
  return {};
}

/**
 * Save configuration to file
 * On Vercel, saves to memory only (tokens persist for the function lifetime)
 * @param {Object} config - Configuration object to save
 */
function saveConfig(config) {
  const isVercel = !!process.env.VERCEL;
  
  if (isVercel) {
    // Vercel: save to memory only
    memoryConfig = config;
    console.log('💾 Config saved to memory (Vercel serverless)');
    return;
  }
  
  // Local/Railway: save to file
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

module.exports = {
  loadConfig,
  saveConfig
};