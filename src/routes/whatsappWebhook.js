const express = require('express');
const router = express.Router();
const conversationState = require('../services/conversationState');
const whatsapp = require('../services/whatsapp');
const { updateEventTitle } = require('../services/googleCalendar');

/**
 * WhatsApp Webhook Routes
 * Handles incoming messages and webhook verification
 */

/**
 * GET /webhook/whatsapp - Webhook verification
 * Meta sends this to verify your webhook URL
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const { loadConfig } = require('../config');
  const config = loadConfig();

  if (mode === 'subscribe' && token === config.whatsapp?.verify_token) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * POST /webhook/whatsapp - Receive incoming messages
 * Meta sends this when users send messages
 */
router.post('/', async (req, res) => {
  // Always respond quickly to Meta
  res.sendStatus(200);

  try {
    const body = req.body;

    // Check if this is a WhatsApp message event
    if (body.object !== 'whatsapp_business_account') {
      return;
    }

    // Extract message data
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) {
      return; // No messages in this webhook
    }

    const message = value.messages[0];
    const from = message.from; // Patient's phone number
    const messageId = message.id;
    const messageType = message.type;

    // Only handle text messages
    if (messageType !== 'text') {
      console.log(`ℹ️  Ignoring non-text message type: ${messageType}`);
      return;
    }

    const messageText = message.text.body.trim().toLowerCase();

    console.log(`\n📱 ===== INCOMING WHATSAPP MESSAGE =====`);
    console.log(`From: ${from}`);
    console.log(`Message: "${messageText}"`);
    console.log(`========================================\n`);

    // Mark message as read
    await whatsapp.markAsRead(messageId);

    // Get conversation context
    const context = conversationState.getConversation(from);

    if (!context) {
      // No active conversation for this number
      console.log(`⚠️  No active appointment conversation for ${from}`);
      await whatsapp.sendTextMessage(
        from,
        'Sorry, I don\'t have any pending appointment for this number. Please call us if you need assistance.'
      );
      return;
    }

    // Parse user intent from message
    const intent = parseIntent(messageText);

    if (!intent) {
      // Didn't understand the message
      await whatsapp.sendTextMessage(
        from,
        `I didn't understand that. Please reply with:\n✅ CONFIRM to confirm\n❌ CANCEL to cancel\n🔄 RESCHEDULE to reschedule`
      );
      return;
    }

    // Handle the intent
    await handleAppointmentAction(from, context, intent);

  } catch (error) {
    console.error('❌ Error processing WhatsApp webhook:', error);
  }
});

/**
 * Parse user intent from message text
 * @param {string} text - Message text (lowercase)
 * @returns {string|null} 'confirm', 'cancel', 'reschedule', or null
 */
function parseIntent(text) {
  // Confirm keywords
  if (/\b(confirm|yes|ok|okay|sure|yep|yeah|correct)\b/.test(text)) {
    return 'confirm';
  }

  // Cancel keywords
  if (/\b(cancel|no|nope|not coming|can't make it)\b/.test(text)) {
    return 'cancel';
  }

  // Reschedule keywords
  if (/\b(reschedule|change|move|different time|another time)\b/.test(text)) {
    return 'reschedule';
  }

  return null;
}

/**
 * Handle appointment action based on user intent
 * @param {string} phoneNumber - Patient's phone number
 * @param {Object} context - Conversation context
 * @param {string} intent - User intent ('confirm', 'cancel', 'reschedule')
 */
async function handleAppointmentAction(phoneNumber, context, intent) {
  const { eventId, patientName, appointmentTime } = context;
  const { loadConfig } = require('../config');
  const config = loadConfig();

  let emoji = '';
  let action = '';
  let replyMessage = '';

  switch (intent) {
    case 'confirm':
      emoji = '✅';
      action = 'confirmed';
      replyMessage = `✅ Your appointment is confirmed!\n\nSee you on ${formatDateTime(appointmentTime)}.\n\nThank you!`;
      break;

    case 'cancel':
      emoji = '❌';
      action = 'cancelled';
      replyMessage = `❌ Your appointment has been cancelled.\n\nIf you need to book again, please call us at ${config.clinic_phone || 'the clinic'}.`;
      break;

    case 'reschedule':
      emoji = '❓';
      action = 'marked for rescheduling';
      replyMessage = `🔄 We'll help you reschedule.\n\nPlease call us at ${config.clinic_phone || 'the clinic'} to arrange a new time.\n\nThank you!`;
      break;
  }

  try {
    // Update Google Calendar event title
    console.log(`📅 Updating calendar event ${eventId} with ${emoji} emoji`);
    await updateEventTitle(eventId, emoji);

    // Send confirmation message to patient
    await whatsapp.sendTextMessage(phoneNumber, replyMessage);

    // Clear conversation state
    conversationState.clearConversation(phoneNumber);

    console.log(`✅ Appointment ${action} for ${patientName} (${phoneNumber})`);

  } catch (error) {
    console.error(`❌ Error handling ${intent}:`, error);
    await whatsapp.sendTextMessage(
      phoneNumber,
      'Sorry, there was an error processing your request. Please call us directly.'
    );
  }
}

/**
 * Format date/time for display
 * @param {string} isoDateTime - ISO date string
 * @returns {string} Formatted date/time
 */
function formatDateTime(isoDateTime) {
  const date = new Date(isoDateTime);
  return date.toLocaleString('en-IE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Dublin'
  });
}

module.exports = router;
