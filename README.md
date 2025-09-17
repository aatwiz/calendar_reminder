# Calendar Reminder System

A web application for a clinic to automatically send appointment reminders to patients via WhatsApp, SMS, or Email, with response handling for rescheduling and cancellations.

## Features

- 📅 Google Calendar integration for appointment management
- 📱 WhatsApp Business API for messaging
- 📧 Email notifications with SMTP
- 📲 SMS fallback via Twilio
- 🔄 Automatic reminders 2 days before appointments
- ↩️ Patient response handling (reschedule/cancel)
- 👩‍⚕️ Staff notifications for appointment changes

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the application:**
   ```bash
   node index.js
   ```

3. **Configure API keys:**
   - Navigate to `http://localhost:3000/setup`
   - Fill in all required API credentials:
     - Google Calendar API credentials
     - Twilio account details
     - WhatsApp Business API tokens
     - Email SMTP settings
     - Staff notification contacts

4. **Authenticate with Google:**
   - Visit `http://localhost:3000/auth`
   - Complete OAuth flow to authorize calendar access

## Google Calendar Appointment Format

For the system to work properly, appointments in Google Calendar should include patient contact information in the description field:

```
Patient: John Doe
Phone: +1234567890
Email: john.doe@example.com
Doctor: dr.smith@clinic.com
```

The system will extract:
- `phone:` - Patient's phone number for WhatsApp/SMS
- `email:` - Patient's email address  
- `doctor:` - Doctor's email for cancellation notifications

## How It Works

1. **Scheduled Reminders**: Every hour, the system checks for appointments 2 days away
2. **Message Sending**: Tries WhatsApp first, then SMS, then email
3. **Response Handling**: Patients can reply "RESCHEDULE" or "CANCEL"
4. **Staff Notifications**: 
   - Reschedule requests notify the receptionist
   - Cancellations notify the assigned doctor

## API Endpoints

- `GET /setup` - Configuration form
- `POST /save-keys` - Save API credentials
- `GET /auth` - Google Calendar OAuth
- `GET /events` - View upcoming appointments
- `GET /check-reminders` - Manual reminder check
- `POST /whatsapp-webhook` - WhatsApp Business webhook
- `POST /twilio-webhook` - Twilio SMS webhook

## Webhook Setup

### WhatsApp Business API
Configure webhook URL: `https://your-domain.com/whatsapp-webhook`

### Twilio SMS
Configure webhook URL: `https://your-domain.com/twilio-webhook`

## File Structure

- `index.js` - Main application
- `config.json` - API credentials (created after setup)
- `active_reminders.json` - Tracks pending appointment reminders
- `test-functionality.js` - Basic functionality tests

## Security Notes

- Keep `config.json` secure and never commit to version control
- Use environment variables for production deployments
- Implement proper authentication for production use
- Set up HTTPS for webhook endpoints

## Development

Run tests:
```bash
node test-functionality.js
```

Manual reminder check:
```bash
curl http://localhost:3000/check-reminders
```