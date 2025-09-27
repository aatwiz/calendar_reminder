const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../config.json');

/**
 * Load saved configuration if it exists
 * @returns {Object} Configuration object
 */
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE));
  }
  return {};
}

/**
 * Save configuration to file
 * @param {Object} config - Configuration object to save
 */
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

module.exports = {
  loadConfig,
  saveConfig
};