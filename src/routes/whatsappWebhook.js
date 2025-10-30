const express = require('express');
const router = express.Router();
const conversationState = require('../services/conversationState');
const whatsapp = require('../services/whatsapp');
const { updateEventTitle } = require('../services/googleCalendar');

/**
 * WhatsApp Webhook Routes
 * Handles incoming messages and webhook verification
 */

// Log webhook requests
router.use((req, res, next) => {
  console.log(`[Webhook] ${req.method} ${req.originalUrl}`);
  next();
});

/**
 * GET /webhook/whatsapp - Webhook verification
 * Meta sends this to verify your webhook URL
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Get verify token from environment variable (Vercel) or config file (local)
  const { loadConfig } = require('../config');
  const config = loadConfig();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || config.whatsapp?.verify_token;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('[ERROR] Webhook verification failed - token mismatch');
    res.sendStatus(403);
  }
});

/**
 * POST /webhook/whatsapp - Receive incoming messages
 * Meta sends this when users send messages
 */
router.post('/', async (req, res) => {
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

    if (!value || !value?.messages) {
      return; // Status update or no messages
    }

    const message = value.messages[0];
    
    if (!message || !message.from) {
      return;
    }

    const from = message.from; // Patient's phone number
    const messageId = message.id;
    const messageType = message.type;

    // Handle text messages and button responses
    let messageText = '';
    
    if (messageType === 'text') {
      if (!message.text || !message.text.body) {
        return;
      }
      messageText = message.text.body.trim().toLowerCase();
    } else if (messageType === 'button') {
      if (!message.button || !message.button.text) {
        return;
      }
      messageText = message.button.text.trim().toLowerCase();
    } else {
      return; // Ignore other message types
    }

    console.log(`📱 Message from ${from}: "${messageText}"`);

    // Mark message as read (fire-and-forget)
    whatsapp.markAsRead(messageId).catch(err => {
      console.warn('⚠️  markAsRead failed:', err.message);
    });

    // Get conversation context
    const context = conversationState.getConversation(from);

    if (!context) {
      console.log(`⚠️  Unknown number: ${from}`);
      return;
    }

    // Parse user intent from message
    const intent = parseIntent(messageText);

    if (!intent) {
      await whatsapp.sendTextMessage(
        from,
        `I didn't understand that. Please reply with:\nCONFIRM to confirm your appointment\nRESCHEDULE to reschedule`
      );
      return;
    }

    // Handle the intent
    await handleAppointmentAction(from, context, intent);

  } catch (error) {
    console.error('[ERROR] Webhook processing failed:', error?.message);
    if (error?.response) {
      console.error('[ERROR] HTTP Status:', error.response.status);
    }
  } finally {
    // CRITICAL: Respond to Meta AFTER all processing is done
    // This ensures Vercel doesn't kill the function mid-execution
    if (!res.headersSent) {
      res.sendStatus(200);
    }
  }
});

/**
 * Parse user intent from message text
 * Handles both button clicks and typed messages
 * @param {string} text - Message text (will be converted to lowercase)
 * @returns {string|null} 'confirm' or 'reschedule', or null
 */
function parseIntent(text) {
  const lowerText = text.toLowerCase();
  
  // Handle button clicks (exact matches first)
  if (lowerText === 'confirm') return 'confirm';
  if (lowerText === 'reschedule') return 'reschedule';
  
  // Handle typed responses (fuzzy matching)
  // Confirm keywords
  if (/\b(confirm|yes|ok|okay|sure|yep|yeah|correct)\b/.test(lowerText)) {
    return 'confirm';
  }

  // Reschedule keywords
  if (/\b(reschedule|change|move|different time|another time|no|cancel|nope|not coming|can't make it)\b/.test(lowerText)) {
    return 'reschedule';
  }

  return null;
}

/**
 * Handle appointment action based on user intent
 * @param {string} phoneNumber - Patient's phone number
 * @param {Object} context - Conversation context
 * @param {string} intent - User intent ('confirm' or 'reschedule')
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

    case 'reschedule':
      emoji = '🔄';
      action = 'marked for rescheduling';
      replyMessage = `🔄 Our receptionist will call you shortly regarding rescheduling, thank you!`;
      break;
  }

  try {
    // Update Google Calendar event title
    await updateEventTitle(eventId, emoji);

    // Send confirmation message to patient
    await whatsapp.sendTextMessage(phoneNumber, replyMessage);

    // If reschedule, send notification to clinic
    if (intent === 'reschedule') {
      await sendRescheduleNotificationToClinic(patientName, phoneNumber, appointmentTime, config);
    }

    // Clear conversation state
    conversationState.clearConversation(phoneNumber);

    console.log(`✅ Appointment ${action} for ${patientName}`);

  } catch (error) {
    console.error('[ERROR] Failed to handle appointment action:', error.message);
    
    try {
      await whatsapp.sendTextMessage(
        phoneNumber,
        'Sorry, there was an error processing your request. Please call us directly.'
      );
    } catch (sendError) {
      console.error('[ERROR] Could not send error message:', sendError.message);
    }
    
    throw error;
  }
}

/**
 * Send reschedule notification to clinic
 * @param {string} patientName - Patient name
 * @param {string} patientPhone - Patient phone number
 * @param {string} appointmentTime - Original appointment time (ISO string)
 * @param {Object} config - App configuration
 */
async function sendRescheduleNotificationToClinic(patientName, patientPhone, appointmentTime, config) {
  const clinicNotificationPhone = '+353871240142';
  const formattedDate = formatDateTime(appointmentTime);
  
  const message = `📌 RESCHEDULE REQUEST:\n\nPatient: ${patientName}\nPhone: ${patientPhone}\nOriginal Appointment: ${formattedDate}`;

  try {
    await whatsapp.sendTextMessage(clinicNotificationPhone, message);
    console.log(`✅ Reschedule notification sent to clinic`);
  } catch (error) {
    console.error('[ERROR] Failed to send reschedule notification:', error.message);
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
