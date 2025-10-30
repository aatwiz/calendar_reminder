const express = require('express');
const router = express.Router();
const conversationState = require('../services/conversationState');
const whatsapp = require('../services/whatsapp');
const { updateEventTitle } = require('../services/googleCalendar');

/**
 * WhatsApp Webhook Routes
 * Handles incoming messages and webhook verification
 */

// Log ALL requests to this webhook
router.use((req, res, next) => {
  console.log(`\n🌐 ===== WEBHOOK REQUEST RECEIVED =====`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.originalUrl}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Content-Type: ${req.get('content-type')}`);
  console.log(`Query params: ${JSON.stringify(req.query)}`);
  console.log(`Body size: ${JSON.stringify(req.body || {}).length} bytes`);
  console.log(`========================================\n`);
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

  console.log(`\n🔐 ===== WEBHOOK VERIFICATION REQUEST =====`);
  console.log(`Raw req.query: ${JSON.stringify(req.query)}`);
  console.log(`Mode: ${mode}`);
  console.log(`Challenge: ${challenge?.substring(0, 20)}...`);
  console.log(`Token received: ${token?.substring(0, 20)}...`);

  // Get verify token from environment variable (Railway) or config file (local)
  const { loadConfig } = require('../config');
  const config = loadConfig();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || config.whatsapp?.verify_token;

  console.log(`Expected token: ${verifyToken?.substring(0, 20)}...`);
  console.log(`Env var set: ${process.env.WHATSAPP_VERIFY_TOKEN ? 'YES' : 'NO'}`);
  console.log(`Config file has token: ${config.whatsapp?.verify_token ? 'YES' : 'NO'}`);
  console.log(`========================================\n`);

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log(`❌ Webhook verification failed`);
    res.sendStatus(403);
  }
});

/**
 * POST /webhook/whatsapp - Receive incoming messages
 * Meta sends this when users send messages
 */
router.post('/', async (req, res) => {
  console.log(`\n📨 ===== WEBHOOK POST RECEIVED =====`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Raw body keys: ${Object.keys(req.body || {}).join(', ')}`);

  console.log(`\n📨 ===== INCOMING WEBHOOK REQUEST =====`);
  console.log(`Received POST request`);
  console.log(`Body object: ${req.body?.object}`);
  console.log(`Has entry: ${req.body?.entry ? 'YES' : 'NO'}`);
  console.log(`========================================\n`);

  try {
    const body = req.body;
    console.log(`[WEBHOOK-DEBUG] Inside try block, body keys: ${Object.keys(body || {}).join(',')}`);

    // Check if this is a WhatsApp message event
    if (body.object !== 'whatsapp_business_account') {
      console.log(`ℹ️  Ignoring webhook (object: ${body.object})`);
      return;
    }
    console.log(`[WEBHOOK-DEBUG] Body object is correct`);

    // Extract message data
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) {
      console.log(`⚠️  No value in webhook`);
      return;
    }

    // Debug: Show what's in the value object
    const valueKeys = Object.keys(value || {});
    console.log(`📊 Webhook value contains: ${valueKeys.join(', ')}`);
    
    if (value?.statuses) {
      console.log(`📈 Status update: ${JSON.stringify(value.statuses[0])}`);
    }

    if (!value?.messages) {
      console.log(`ℹ️  No messages in this webhook (statuses: ${value?.statuses ? 'YES' : 'NO'})`);
      return; // No messages in this webhook
    }

    const message = value.messages[0];
    
    if (!message || !message.from) {
      console.log(`⚠️  Message structure invalid`);
      return;
    }

    const from = message.from; // Patient's phone number
    const messageId = message.id;
    const messageType = message.type;

    console.log(`ℹ️  Message type: ${messageType}, ID: ${messageId}`);

    // Handle text messages and button responses
    let messageText = '';
    
    if (messageType === 'text') {
      if (!message.text || !message.text.body) {
        console.log(`⚠️  Message text body is missing`);
        return;
      }
      messageText = message.text.body.trim().toLowerCase();
    } else if (messageType === 'button') {
      // When user clicks a button, WhatsApp sends it as button type with payload
      if (!message.button || !message.button.text) {
        console.log(`⚠️  Button text is missing`);
        return;
      }
      messageText = message.button.text.trim().toLowerCase();
      console.log(`📌 Button clicked: ${messageText}`);
    } else {
      console.log(`ℹ️  Ignoring non-text/button message type: ${messageType}`);
      return;
    }

    console.log(`\n📱 ===== INCOMING WHATSAPP MESSAGE =====`);
    console.log(`From: ${from}`);
    console.log(`Message: "${messageText}"`);
    console.log(`========================================\n`);

    console.log(`[WEBHOOK-DEBUG] About to mark message as read`);
    // Mark message as read (fire-and-forget, don't await)
    // This prevents a slow Meta API from blocking the main flow
    whatsapp.markAsRead(messageId).catch(err => {
      console.warn(`[WEBHOOK-DEBUG] markAsRead error (non-blocking):`, err.message);
    });
    console.log(`[WEBHOOK-DEBUG] markAsRead called (non-blocking), continuing...`);

    // Get conversation context
    console.log(`\n🔍 Attempting to find conversation for phone: ${from}`);
    let context;
    try {
      context = conversationState.getConversation(from);
      console.log(`✅ getConversation() completed`);
    } catch (convError) {
      console.error(`❌ Error calling getConversation():`, convError.message);
      console.error(`Stack:`, convError.stack);
      throw convError;
    }

    if (!context) {
      // No active conversation for this number
      console.log(`\n⚠️  ===== NEW CUSTOMER / UNKNOWN NUMBER =====`);
      console.log(`Phone: ${from}`);
      console.log(`Message: "${messageText}"`);
      console.log(`Timestamp: ${new Date().toISOString()}`);
      console.log(`❓ This phone number doesn't have an active appointment reminder.`);
      console.log(`❓ Reminders must be sent first via /send-reminders for webhook to work.`);
      console.log(`========================================\n`);
      
      // Only send greeting to truly new customers, not to users who already responded
      // The receptionist will see this logged and can handle it manually if needed
      return;
    }

    console.log(`Found conversation context:`, JSON.stringify(context));

    // Parse user intent from message
    const intent = parseIntent(messageText);

    console.log(`Parsed intent: ${intent}`);

    if (!intent) {
      // Didn't understand the message
      console.log(`❌ Intent parsing returned null`);
      await whatsapp.sendTextMessage(
        from,
        `I didn't understand that. Please reply with:\n✅ CONFIRM to confirm\n🔄 RESCHEDULE to reschedule`
      );
      return;
    }

    console.log(`About to handle appointment action with intent: ${intent}`);

    // Handle the intent
    console.log(`[WEBHOOK] Calling handleAppointmentAction()...`);
    try {
      await handleAppointmentAction(from, context, intent);
      console.log(`[WEBHOOK] handleAppointmentAction() completed SUCCESSFULLY`);
    } catch (actionError) {
      console.error(`[WEBHOOK] handleAppointmentAction() THREW ERROR`);
      console.error(`[WEBHOOK] Error type: ${actionError?.constructor?.name}`);
      console.error(`[WEBHOOK] Error message: ${actionError?.message}`);
      console.error(`[WEBHOOK] Error stack: ${actionError?.stack}`);
      throw actionError;
    }
    
    console.log(`Appointment action completed successfully`);

  } catch (error) {
    console.error('❌ ===== CRITICAL ERROR PROCESSING WEBHOOK =====');
    console.error('Error occurred at:', new Date().toISOString());
    console.error('Error constructor:', error?.constructor?.name || 'Unknown');
    console.error('Error message:', error?.message || 'No message');
    console.error('Error code:', error?.code || 'No code');
    console.error('Error stack:', error?.stack || 'No stack');
    if (error?.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('HTTP Data:', JSON.stringify(error.response.data));
    }
    console.error('Full error object keys:', Object.keys(error || {}));
    console.error('Full error:', JSON.stringify(error, (key, value) => {
      if (value instanceof Error) {
        return {
          message: value.message,
          stack: value.stack,
          constructor: value.constructor.name
        };
      }
      return value;
    }));
    console.error('=========================================');
  } finally {
    // CRITICAL: Respond to Meta AFTER all processing is done
    // This ensures Vercel doesn't kill the function mid-execution
    console.log(`[WEBHOOK] Sending 200 OK to Meta (after processing)`);
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
  const fnId = `[handleAppointmentAction-${Date.now()}]`;
  console.log(`${fnId} START - intent: ${intent}, phone: ${phoneNumber}`);
  
  const { eventId, patientName, appointmentTime } = context;
  const { loadConfig } = require('../config');
  const config = loadConfig();
  console.log(`${fnId} Context loaded - eventId: ${eventId}, patient: ${patientName}`);

  let emoji = '';
  let action = '';
  let replyMessage = '';

  switch (intent) {
    case 'confirm':
      emoji = '✅';
      action = 'confirmed';
      replyMessage = `✅ Your appointment is confirmed!\n\nSee you on ${formatDateTime(appointmentTime)}.\n\nThank you!`;
      console.log(`${fnId} Intent is CONFIRM - emoji: ${emoji}`);
      break;

    case 'reschedule':
      emoji = '🔄';
      action = 'marked for rescheduling';
      replyMessage = `🔄 Our receptionist will call you shortly regarding rescheduling, thank you!`;
      console.log(`${fnId} Intent is RESCHEDULE - emoji: ${emoji}`);
      break;
  }

  try {
    // Update Google Calendar event title
    console.log(`${fnId} STEP 1: About to call updateEventTitle(${eventId}, ${emoji})`);
    await updateEventTitle(eventId, emoji);
    console.log(`${fnId} STEP 1 COMPLETE: updateEventTitle() returned successfully`);

    // Send confirmation message to patient
    console.log(`${fnId} STEP 2: About to send reply message to patient (${phoneNumber})`);
    const sendResult = await whatsapp.sendTextMessage(phoneNumber, replyMessage);
    console.log(`${fnId} STEP 2 COMPLETE: Message sent successfully`);

    // If reschedule, send notification to clinic
    if (intent === 'reschedule') {
      console.log(`${fnId} STEP 3: About to send reschedule notification to clinic`);
      await sendRescheduleNotificationToClinic(patientName, phoneNumber, appointmentTime, config);
      console.log(`${fnId} STEP 3 COMPLETE: Reschedule notification sent`);
    } else {
      console.log(`${fnId} STEP 3 SKIPPED: No reschedule notification needed`);
    }

    // Clear conversation state
    console.log(`${fnId} STEP 4: About to clear conversation state`);
    conversationState.clearConversation(phoneNumber);
    console.log(`${fnId} STEP 4 COMPLETE: Conversation state cleared`);

    console.log(`${fnId} SUCCESS: Appointment ${action} for ${patientName}`);

  } catch (error) {
    console.error(`${fnId} CATCH BLOCK - Error caught during action handling`);
    console.error(`${fnId} Error type: ${error?.constructor?.name || 'Unknown'}`);
    console.error(`${fnId} Error message: ${error?.message || 'No message'}`);
    console.error(`${fnId} Error stack: ${error?.stack || 'No stack'}`);
    if (error?.response) {
      console.error(`${fnId} HTTP Error Status: ${error.response.status}`);
      console.error(`${fnId} HTTP Error Data: ${JSON.stringify(error.response.data)}`);
    }
    
    try {
      console.log(`${fnId} Attempting to send error message to patient`);
      await whatsapp.sendTextMessage(
        phoneNumber,
        'Sorry, there was an error processing your request. Please call us directly.'
      );
      console.log(`${fnId} Error message sent to patient`);
    } catch (sendError) {
      console.error(`${fnId} Could not send error message:`, sendError.message);
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
  const clinicNotificationPhone = '+0647593444';
  const formattedDate = formatDateTime(appointmentTime);
  
  const message = `📌 RESCHEDULE REQUEST:\n\nPatient: ${patientName}\nPhone: ${patientPhone}\nOriginal Appointment: ${formattedDate}`;

  try {
    console.log(`Attempting to send notification to clinic at ${clinicNotificationPhone}`);
    console.log(`Message: ${message}`);
    const result = await whatsapp.sendTextMessage(clinicNotificationPhone, message);
    console.log(`📱 Reschedule notification sent to clinic (${clinicNotificationPhone})`);
    console.log(`Clinic notification result:`, JSON.stringify(result));
  } catch (error) {
    console.error(`❌ Failed to send reschedule notification to clinic:`, error.message);
    console.error(`Error details:`, error);
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
