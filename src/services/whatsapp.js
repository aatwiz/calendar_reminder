const axios = require('axios');

/**
 * WhatsApp Business Cloud API Service
 * Uses Meta's official WhatsApp Business Platform
 */

let config = null;

/**
 * Initialize WhatsApp service with credentials
 * @param {Object} whatsappConfig - WhatsApp configuration
 */
function initialize(whatsappConfig) {
  config = whatsappConfig;
}

/**
 * Send a template message (for business-initiated messages like reminders)
 * Templates must be pre-approved by Meta
 * 
 * @param {string} to - Recipient phone number in E.164 format (e.g., +353871234567)
 * @param {string} templateName - Name of approved template
 * @param {Array} parameters - Template parameter values
 * @returns {Promise<Object>} Message response from WhatsApp API
 */
async function sendTemplateMessage(to, templateName, parameters = []) {
  if (!config || !config.phone_number_id || !config.access_token) {
    throw new Error('WhatsApp not configured. Please add credentials in /setup');
  }

  const url = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: 'en' // Change to 'en_GB' or 'en_US' based on your template language
      },
      components: [
        {
          type: 'body',
          parameters: parameters.map(value => ({
            type: 'text',
            text: value
          }))
        }
      ]
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ WhatsApp message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ WhatsApp send failed:', error.response?.data || error.message);
    console.error('📋 Full error details:', JSON.stringify({
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: url,
      phoneNumberId: config.phone_number_id,
      to: to
    }, null, 2));
    throw new Error(`Failed to send WhatsApp message: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Send a text message (for replies within 24-hour customer service window)
 * Can only be sent in response to a user message within 24 hours
 * 
 * @param {string} to - Recipient phone number in E.164 format
 * @param {string} message - Message text to send
 * @returns {Promise<Object>} Message response from WhatsApp API
 */
async function sendTextMessage(to, message) {
  if (!config || !config.phone_number_id || !config.access_token) {
    throw new Error('WhatsApp not configured. Please add credentials in /setup');
  }

  const url = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      preview_url: false,
      body: message
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ WhatsApp reply sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ WhatsApp reply failed:', error.response?.data || error.message);
    console.error('📋 Full error details:', JSON.stringify({
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: url,
      phoneNumberId: config.phone_number_id
    }, null, 2));
    throw new Error(`Failed to send WhatsApp reply: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Mark a message as read
 * @param {string} messageId - Message ID to mark as read
 */
async function markAsRead(messageId) {
  if (!config || !config.phone_number_id || !config.access_token) {
    return;
  }

  const url = `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`;

  try {
    await axios.post(url, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    }, {
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Failed to mark message as read:', error.message);
  }
}

/**
 * Check if WhatsApp is configured
 * @returns {boolean}
 */
function isConfigured() {
  return !!(config && config.phone_number_id && config.access_token);
}

module.exports = {
  initialize,
  sendTemplateMessage,
  sendTextMessage,
  markAsRead,
  isConfigured
};
