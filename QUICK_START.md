# Quick Start Guide - Interactive Appointments

## 🚀 Getting Started

### 1. Start the Server
```bash
node index.js
```
Server will start on: http://localhost:3000

### 2. Configure (if not already done)
Visit: http://localhost:3000/setup

Fill in:
- ✅ Google Calendar credentials (OAuth)
- ✅ Twilio SMS credentials
- ✅ **NEW:** Clinic reception phone number

### 3. Create Test Appointment
In Google Calendar, create an event with format:
```
Patient Name #0871234567
```

Example:
```
John Doe #0871234567
```

### 4. How It Works

#### Every 15 minutes, the system:
1. ✅ Checks for appointments in next 48 hours
2. ✅ Filters out already reminded (🔔 emoji)
3. ✅ Generates unique link for each patient
4. ✅ Sends SMS: `Hello [Name]! Manage your appointment: [link]`
5. ✅ Marks event with 🔔 emoji

#### Patient receives SMS:
```
Hello John Doe! Manage your appointment: http://localhost:3000/appointment/a1b2c3d4e5f6...
```

#### Patient clicks link and sees:
```
🏥 Appointment Confirmation

Appointment Details
👤 Patient: John Doe
📅 Time: 10/15/2025, 2:30:00 PM

[✅ Confirm Appointment]
[❌ Cancel Appointment]
[❓ Reschedule Appointment]
```

#### Calendar Updates:
- **Confirm**: `✅ John Doe #0871234567`
- **Cancel**: `❌ John Doe #0871234567`
- **Reschedule**: `❓ John Doe #0871234567` + shows clinic phone

## 📋 Manual Testing

### Test SMS Sending:
1. Visit: http://localhost:3000/send-reminders
2. Check console for generated link
3. Copy link and test in browser

### Test Appointment Page:
```bash
# Invalid token (should show error)
curl http://localhost:3000/appointment/invalid-token

# Valid token (replace with real token from console)
curl http://localhost:3000/appointment/REAL_TOKEN_HERE
```

## 🔧 Configuration Files

### config.json
```json
{
  "google": {
    "tokens": { ... }
  },
  "twilio": {
    "sid": "AC...",
    "auth_token": "...",
    "phone": "+17752583835"
  },
  "clinic": {
    "phone": "+353123456789"
  }
}
```

### appointment_links.json (auto-generated)
```json
{
  "a1b2c3d4...": {
    "eventId": "google-event-id",
    "patientName": "John Doe",
    "appointmentTime": "2025-10-15T14:30:00.000Z",
    "createdAt": "2025-10-13T11:00:00.000Z",
    "used": false,
    "action": null
  }
}
```

## 📱 SMS Format

### Before (old):
```
Hello John Doe!
```

### After (new):
```
Hello John Doe! Manage your appointment: http://localhost:3000/appointment/a1b2c3d4e5f6...
```

## ✨ Key Features

1. ✅ **Unique Links**: Each patient gets a secure, one-time-use link
2. ✅ **Three Actions**: Confirm, Cancel, or Request Reschedule
3. ✅ **Calendar Updates**: Automatic emoji marking (✅/❌/❓)
4. ✅ **Responsive UI**: Works on mobile, tablet, and desktop
5. ✅ **Security**: Cryptographically secure tokens, one-time use
6. ✅ **User Feedback**: Clear success/error messages
7. ✅ **Link Expiry**: Already-used links show "processed" page

## 🐛 Troubleshooting

### Server won't start?
```bash
# Check if port 3000 is in use
lsof -ti:3000

# Kill process on port 3000
kill $(lsof -ti:3000)

# Start again
node index.js
```

### SMS not sending?
- ✅ Check Twilio credentials in `/setup`
- ✅ Verify phone number format: +353871234567
- ✅ Check Twilio console for delivery status
- ✅ Trial accounts: Verify recipient numbers in Twilio

### Link not working?
- ✅ Check token exists in `appointment_links.json`
- ✅ Verify token hasn't been used (`"used": false`)
- ✅ Check server logs for errors
- ✅ Ensure Google Calendar API is authenticated

### Calendar not updating?
- ✅ Check Google tokens in config.json
- ✅ Re-authenticate at `/auth` if needed
- ✅ Verify eventId exists in Google Calendar
- ✅ Check console for API errors

## 📊 Monitoring

### Check Appointment Links:
```bash
cat appointment_links.json | jq '.'
```

### Check Used Links:
```bash
cat appointment_links.json | jq 'to_entries[] | select(.value.used == true)'
```

### Count Confirmations/Cancellations:
```bash
# Confirmations
cat appointment_links.json | jq 'to_entries[] | select(.value.action == "confirm")' | wc -l

# Cancellations
cat appointment_links.json | jq 'to_entries[] | select(.value.action == "cancel")' | wc -l

# Reschedule requests
cat appointment_links.json | jq 'to_entries[] | select(.value.action == "reschedule")' | wc -l
```

## 🎨 Customization

### Change Base URL (for production):
In `index.js`, find:
```javascript
const fullUrl = `http://localhost:3000/appointment/${appointmentLink}`;
```

Change to:
```javascript
const fullUrl = `https://your-domain.com/appointment/${appointmentLink}`;
```

### Customize SMS Message:
In `index.js`, find:
```javascript
const message = `Hello ${beforeHash}! Manage your appointment: ${fullUrl}`;
```

Change to your preferred message format.

### Update Button Colors:
In `src/routes/appointments.js`, find:
```css
.btn-confirm { background: #34a853; }
.btn-cancel { background: #ea4335; }
.btn-reschedule { background: #fbbc04; }
```

### Add Link Expiration:
In `src/services/appointmentLinks.js`, add TTL check:
```javascript
function getAppointmentByToken(token) {
  const links = loadLinks();
  const appointment = links[token];
  
  if (!appointment) return null;
  
  // Add expiry check (e.g., 7 days)
  const expiryDate = new Date(appointment.createdAt);
  expiryDate.setDate(expiryDate.getDate() + 7);
  
  if (new Date() > expiryDate) {
    return null; // Expired
  }
  
  return appointment;
}
```

## 🧹 Automatic Cleanup

The system automatically cleans up old appointment links:

- **Schedule**: Daily at midnight
- **Criteria**: Deletes appointments >7 days old
- **Manual cleanup**: `curl http://localhost:3000/cleanup-appointments`
- **Safe**: Only cleans appointment_links.json, not calendar events

Response:
```json
{
  "success": true,
  "statistics": {
    "totalBefore": 15,
    "removed": 3,
    "remaining": 12
  },
  "removedAppointments": [...]
}
```

## 📝 Tips

1. **Test with your own number first** before sending to patients
2. **Use trial Twilio account** for testing (verify your number)
3. **Check calendar event format**: Must have `#` separator
4. **Monitor server logs** for debugging
5. **Backup config.json** (contains sensitive data)
6. **Never commit config.json** to version control
7. **Old data auto-cleaned**: Appointment links deleted after 7 days

## 🚀 Production Checklist

- [ ] Change localhost URL to production domain
- [ ] Enable HTTPS
- [ ] Set up proper error monitoring
- [ ] Configure link expiration (recommended: 7 days)
- [ ] Migrate from JSON file to database
- [ ] Set up automated backups
- [ ] Configure production environment variables
- [ ] Test SMS delivery rates
- [ ] Monitor link click rates
- [ ] Set up alerts for failures

---

Need help? Check the full documentation in `INTERACTIVE_APPOINTMENTS.md`
