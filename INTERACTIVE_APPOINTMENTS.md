# Interactive Appointment Management System

## 🎯 Overview

This document describes the interactive appointment confirmation system that allows patients to confirm, cancel, or request to reschedule their appointments via unique SMS links.

## 📋 Features

### 1. **Unique Appointment Links**
- Each SMS reminder includes a unique, secure link
- Links are cryptographically generated using `crypto.randomBytes(32)` (64-character hex tokens)
- One-time use: Links become inactive after patient responds
- Stored in `appointment_links.json` with appointment details

### 2. **Patient Actions**
Patients can choose from three actions when they click the link:

#### ✅ **Confirm Appointment**
- Updates calendar event title with ✅ emoji prefix
- Shows success message
- Link is marked as used

#### ❌ **Cancel Appointment**
- Updates calendar event title with ❌ emoji prefix
- Shows cancellation confirmation
- Link is marked as used

#### ❓ **Reschedule Appointment**
- Updates calendar event title with ❓ emoji prefix
- Displays clinic reception phone number
- Instructs patient to call for rescheduling
- Link is marked as used

### 3. **SMS Message Format**
```
Hello [Patient Name]! Manage your appointment: http://localhost:3000/appointment/[unique-token]
```

Example:
```
Hello John Doe! Manage your appointment: http://localhost:3000/appointment/a1b2c3d4e5f6...
```

## 🏗️ Architecture

### Files Created/Modified

#### New Files:
1. **`src/services/appointmentLinks.js`** - Appointment link management service
   - `generateToken()` - Creates secure random tokens
   - `createAppointmentLink(eventId, patientName, appointmentTime)` - Generates unique link
   - `getAppointmentByToken(token)` - Retrieves appointment details
   - `markLinkAsUsed(token, action)` - Records patient action
   - Storage: `appointment_links.json`

2. **`src/routes/appointments.js`** - Appointment action routes
   - `GET /appointment/:token` - Display appointment action page
   - `POST /appointment/:token/action` - Handle appointment actions (confirm/cancel/reschedule)
   - Responsive HTML interface with three action buttons

#### Modified Files:
1. **`index.js`**
   - Imported `appointmentLinks` service
   - Updated `processSMSForEvent()` to generate unique links
   - Modified SMS message to include appointment URL
   - Mounted appointments router

2. **`src/routes/setup.js`**
   - Added clinic phone number field to Twilio setup
   - Saves `config.clinic.phone` for reschedule messages

3. **`src/views/index.js`**
   - Added "Clinic Reception Phone" input field
   - Optional field for reschedule contact number

## 📊 Data Flow

```
1. Automated Check (Every 15 minutes)
   └─> Find appointments in next 48 hours
       └─> Filter out already reminded (🔔 emoji)
           └─> For each appointment:
               ├─> Extract patient name and phone from "Name #Phone" format
               ├─> Generate unique appointment token
               ├─> Create appointment link
               ├─> Send SMS with link
               └─> Mark event with 🔔 emoji

2. Patient Receives SMS
   └─> Clicks link in SMS
       └─> Browser opens: GET /appointment/:token
           └─> Display appointment details and 3 buttons

3. Patient Clicks Button
   └─> AJAX POST /appointment/:token/action
       ├─> Validate token (not used, not expired)
       ├─> Update calendar event title with emoji (✅/❌/❓)
       ├─> Mark link as used
       └─> Show success message (+ phone for reschedule)
```

## 🗃️ Storage Format

### `appointment_links.json`
```json
{
  "a1b2c3d4e5f6...": {
    "eventId": "google-calendar-event-id",
    "patientName": "John Doe",
    "appointmentTime": "2025-10-15T14:30:00.000Z",
    "createdAt": "2025-10-13T11:00:00.000Z",
    "used": true,
    "action": "confirm"
  }
}
```

### Fields:
- **eventId**: Google Calendar event ID
- **patientName**: Extracted from event title (before #)
- **appointmentTime**: Event start date/time
- **createdAt**: Token generation timestamp
- **used**: Boolean indicating if link has been clicked
- **action**: Patient's choice (confirm/cancel/reschedule) or null if not used

## 🎨 User Interface

### Appointment Action Page Features:
- **Responsive Design**: Mobile-first, works on all devices
- **Modern Styling**: Gradient header, card layout, smooth animations
- **Loading States**: Spinner during API calls
- **Success Messages**: Color-coded feedback for each action
- **Single Use**: Shows "Already processed" message if link reused
- **Error Handling**: Graceful error messages for invalid/expired links

### Button Colors:
- **Confirm**: Green (#34a853)
- **Cancel**: Red (#ea4335)
- **Reschedule**: Yellow (#fbbc04)

## 🔧 Configuration

### Setup Page (`/setup`)
Add the following to your Twilio setup:

**Clinic Reception Phone** (Optional)
- Phone number patients should call to reschedule
- Displayed in reschedule confirmation message
- Format: +353123456789
- Stored in: `config.clinic.phone`

Example config.json:
```json
{
  "google": { ... },
  "twilio": { ... },
  "clinic": {
    "phone": "+353123456789"
  }
}
```

## 🔐 Security Features

1. **Cryptographically Secure Tokens**
   - Uses Node.js `crypto.randomBytes(32)`
   - 64-character hexadecimal strings
   - Extremely low collision probability

2. **One-Time Use Links**
   - Token marked as used after patient responds
   - Cannot be reused for different actions
   - Shows "Already processed" page if attempted

3. **Validation Checks**
   - Token existence verification
   - Used status check
   - Event existence in Google Calendar

## 📱 SMS Example Flow

### Step 1: SMS Sent
```
Hello John Doe! Manage your appointment: http://localhost:3000/appointment/a1b2c3d4e5f6...
```

### Step 2: Patient Opens Link
Browser shows:
```
🏥 Appointment Confirmation

Appointment Details
👤 Patient: John Doe
📅 Time: 10/15/2025, 2:30:00 PM

[✅ Confirm Appointment]
[❌ Cancel Appointment]
[❓ Reschedule Appointment]
```

### Step 3: Patient Clicks "Confirm"
```
✅ Appointment Confirmed!
See you at your appointment.
```

Calendar event updated: `✅ John Doe #0871234567`

### Step 3b: If Patient Clicks "Reschedule"
```
❓ Need to Reschedule?
Please call the reception at +353123456789 to reschedule your appointment.
```

Calendar event updated: `❓ John Doe #0871234567`

## 🔍 Monitoring & Debugging

### Console Logs
```bash
# SMS sending with link generation
📝 Message: "Hello John Doe! Manage your appointment: http://..."
📞 Phone: +353871234567
✅ SMS sent! SID: SM...
🔔 Event marked as reminded in calendar

# Appointment action
✅ Appointment confirmed by John Doe
📅 Event updated: ✅ John Doe #0871234567
```

### Check Appointment Links
```javascript
// In Node.js console or terminal
const { getAppointmentByToken } = require('./src/services/appointmentLinks');
console.log(getAppointmentByToken('a1b2c3d4...'));
```

### Check Used Links
```bash
cat appointment_links.json | grep '"used": true'
```

## 🧪 Testing

### Manual Test Flow:
1. Create test event in Google Calendar: `Test Patient #0871234567`
2. Trigger manual SMS: Visit `/send-reminders`
3. Check console for generated link
4. Copy link and paste in browser
5. Test each button action
6. Verify calendar event emoji updates
7. Try reusing link (should show "Already processed")

### Test with curl:
```bash
# Test invalid token
curl http://localhost:3000/appointment/invalid-token

# Test appointment action (replace TOKEN)
curl -X POST http://localhost:3000/appointment/TOKEN/action \
  -H "Content-Type: application/json" \
  -d '{"action":"confirm"}'
```

## 🚀 Production Considerations

1. **URL Configuration**
   - Change `http://localhost:3000` to your production domain
   - Update in `index.js` line where `fullUrl` is created
   - Consider environment variable: `process.env.BASE_URL || 'http://localhost:3000'`

2. **Link Expiration**
   - Currently, links don't expire by time
   - Consider adding TTL (e.g., 7 days)
   - Add `expiresAt` field to appointment_links.json

3. **Storage**
   - JSON file storage is simple but not scalable
   - For production, consider database (MongoDB, PostgreSQL)
   - Implement cleanup of old/used links

4. **SMS Delivery Tracking**
   - Monitor Twilio delivery status
   - Track link click rates
   - Alert on low engagement

5. **HTTPS**
   - Use HTTPS in production
   - Required for security and user trust

## 🧹 Automatic Cleanup

To prevent data accumulation and maintain privacy:

- **Automatic cleanup runs daily at midnight**
- **Deletes appointment links older than 7 days** (from appointment time)
- **Manual cleanup available**: Visit `/cleanup-appointments`
- **Calendar events are NOT affected** - only appointment_links.json is cleaned

See `CLEANUP_FEATURE.md` for detailed information.

## 📝 Notes

- Phone number prefix bug: Line ~265 in old code used `+31` instead of `+353` - now using `+353` for Ireland
- Timezone: Europe/Amsterdam (adjust in cron job settings if needed)
- Emoji filtering: 🔔 prevents duplicate reminders
- Appointment format: `Name #Phone` in calendar event title
- Data retention: Appointment links auto-deleted after 7 days

## 🔄 Future Enhancements

1. **Email Confirmation**
   - Send confirmation email after action
   - Backup communication channel

2. **SMS Confirmation**
   - Send follow-up SMS: "Thanks for confirming!"
   - Two-way communication

3. **Analytics Dashboard**
   - Track confirmation/cancellation rates
   - Monitor no-show predictions

4. **Multi-language Support**
   - Detect patient language preference
   - Send messages in preferred language

5. **Rescheduling Calendar**
   - Show available time slots
   - Allow patients to book directly

6. **Appointment Reminders**
   - Second reminder 24 hours before
   - Final reminder 2 hours before

---

**Created**: October 13, 2025  
**Last Updated**: October 13, 2025  
**Version**: 1.0.0
