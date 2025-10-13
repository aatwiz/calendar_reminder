# Automatic Cleanup Feature

## 🧹 Overview

The system automatically deletes appointment link data **7 days after the appointment time** to prevent unnecessary data accumulation. This helps maintain privacy and keeps the `appointment_links.json` file manageable.

## ⏰ When Cleanup Happens

### Automatic Cleanup
- **Schedule**: Every day at midnight (00:00)
- **Timezone**: Europe/Amsterdam
- **Criteria**: Removes appointments where the appointment time was more than 7 days ago

### Manual Cleanup
You can also trigger cleanup manually at any time:
```bash
curl http://localhost:3000/cleanup-appointments
```

Or visit in browser: `http://localhost:3000/cleanup-appointments`

## 📊 What Gets Deleted

Appointment links are deleted when:
- ✅ The appointment date/time was **more than 7 days ago**
- ✅ Regardless of whether the link was used or not

Example:
```
Today: October 13, 2025
Appointment: October 5, 2025 (8 days ago)
Result: DELETED ✅

Appointment: October 8, 2025 (5 days ago)
Result: KEPT (still within 7 days)
```

## 🔍 Cleanup Details

### What Happens During Cleanup
1. Loads all appointment links from `appointment_links.json`
2. Checks each appointment's date/time
3. Calculates days since appointment
4. Removes links older than 7 days
5. Saves updated links back to file
6. Logs cleanup statistics

### Console Output
```
🧹 ===== APPOINTMENT CLEANUP =====
📅 Time: 10/14/2025, 12:00:00 AM
🗑️  Removing appointments older than 7 days...
📊 Cleanup Summary:
   Total links before: 15
   Links removed: 3
   Links remaining: 12

🗑️  Removed appointments:
   - John Doe (10/5/2025, 2:30:00 PM) - confirm
   - Jane Smith (10/4/2025, 10:00:00 AM) - cancel
   - Bob Johnson (10/3/2025, 3:45:00 PM) - no-response
===== END OF CLEANUP =====
```

## 📋 Manual Testing

### Test the Cleanup Endpoint

**Using curl:**
```bash
curl http://localhost:3000/cleanup-appointments
```

**Response:**
```json
{
  "success": true,
  "message": "Cleanup completed successfully",
  "statistics": {
    "totalBefore": 15,
    "removed": 3,
    "remaining": 12
  },
  "removedAppointments": [
    {
      "patientName": "John Doe",
      "appointmentTime": "2025-10-05T14:30:00.000Z",
      "action": "confirm"
    },
    {
      "patientName": "Jane Smith",
      "appointmentTime": "2025-10-04T10:00:00.000Z",
      "action": "cancel"
    }
  ]
}
```

### Create Test Data

To test cleanup with old appointments, manually edit `appointment_links.json`:

```json
{
  "test-token-123": {
    "eventId": "test-event-id",
    "patientName": "Test Patient",
    "appointmentTime": "2025-10-01T10:00:00.000Z",
    "createdAt": "2025-09-28T10:00:00.000Z",
    "used": true,
    "action": "confirm"
  }
}
```

Then run cleanup:
```bash
curl http://localhost:3000/cleanup-appointments
```

The old appointment should be removed.

## 🔧 Configuration

### Change Retention Period

Currently set to **7 days**. To change this, edit `src/services/appointmentLinks.js`:

```javascript
function cleanupOldAppointments() {
  const links = loadLinks();
  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  // Change to 14 days:
  const retentionMs = 14 * 24 * 60 * 60 * 1000; // 14 days
  
  // Or 30 days:
  const retentionMs = 30 * 24 * 60 * 60 * 1000; // 30 days
```

### Change Cleanup Schedule

Currently runs **daily at midnight**. To change this, edit `index.js`:

```javascript
// Current: Daily at midnight (00:00)
const cleanupCronJob = cron.schedule('0 0 * * *', () => {

// Every Sunday at 2 AM:
const cleanupCronJob = cron.schedule('0 2 * * 0', () => {

// Every 12 hours:
const cleanupCronJob = cron.schedule('0 */12 * * *', () => {

// Weekly on Monday at 3 AM:
const cleanupCronJob = cron.schedule('0 3 * * 1', () => {
```

### Cron Schedule Format
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (0 = Sunday)
│ │ │ │ │
* * * * *
```

Examples:
- `0 0 * * *` - Daily at midnight
- `0 2 * * 0` - Every Sunday at 2 AM
- `0 3 * * 1` - Every Monday at 3 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 1 * *` - First day of every month at midnight

## 📊 Monitoring Cleanup

### Check When Next Cleanup Will Run
The server logs show cleanup schedule on startup:
```
🧹 Cleanup scheduled: Daily at midnight (removes appointments >7 days old)
```

### Monitor Cleanup Logs
```bash
# Watch server logs in real-time
tail -f server.log

# Search for cleanup events
grep "APPOINTMENT CLEANUP" server.log

# Count cleanups performed
grep "APPOINTMENT CLEANUP" server.log | wc -l
```

### Check Appointment Links File
```bash
# View all appointments
cat appointment_links.json | jq '.'

# Count total appointments
cat appointment_links.json | jq 'length'

# Find oldest appointment
cat appointment_links.json | jq 'to_entries | sort_by(.value.appointmentTime) | .[0]'

# Find appointments older than 7 days (manual check)
node -e "
const links = require('./appointment_links.json');
const now = new Date();
const sevenDays = 7 * 24 * 60 * 60 * 1000;
Object.entries(links).forEach(([token, apt]) => {
  const age = now - new Date(apt.appointmentTime);
  if (age > sevenDays) {
    console.log(\`OLD: \${apt.patientName} - \${apt.appointmentTime}\`);
  }
});
"
```

## 🔐 Privacy & Data Retention

### Why 7 Days?

**Pros:**
- ✅ Complies with GDPR data minimization principles
- ✅ Reduces storage requirements
- ✅ Protects patient privacy
- ✅ Prevents indefinite data accumulation
- ✅ Allows reasonable time for follow-up or auditing

**Reasoning:**
- Appointments are in the past after the appointment date
- No need to keep confirmation/cancellation data indefinitely
- 7 days allows for any immediate follow-up or dispute resolution

### What's Kept vs Deleted

**Calendar Events (Google Calendar):**
- ✅ **KEPT** - Events remain in Google Calendar with emoji status (✅/❌/❓)
- ✅ This is your permanent record

**Appointment Links (appointment_links.json):**
- ❌ **DELETED** after 7 days - Only temporary mapping between tokens and appointments
- ❌ No longer needed once appointment has passed

## ⚠️ Important Notes

1. **Data is permanently deleted** - Cannot be recovered after cleanup
2. **Calendar events are NOT affected** - Only appointment_links.json is cleaned
3. **Used and unused links are both deleted** - Based only on appointment time
4. **Cleanup runs automatically** - No manual intervention needed
5. **Can trigger manual cleanup** - Useful for testing or immediate cleanup

## 🧪 Testing Scenarios

### Scenario 1: Recent Appointments (Should Keep)
```json
{
  "token123": {
    "appointmentTime": "2025-10-12T10:00:00.000Z",
    "patientName": "John Doe"
  }
}
```
**Current Date**: October 13, 2025  
**Result**: KEPT (only 1 day old)

### Scenario 2: Old Appointments (Should Delete)
```json
{
  "token456": {
    "appointmentTime": "2025-10-01T10:00:00.000Z",
    "patientName": "Jane Smith"
  }
}
```
**Current Date**: October 13, 2025  
**Result**: DELETED (12 days old)

### Scenario 3: Exactly 7 Days (Should Keep)
```json
{
  "token789": {
    "appointmentTime": "2025-10-06T10:00:00.000Z",
    "patientName": "Bob Johnson"
  }
}
```
**Current Date**: October 13, 2025  
**Result**: KEPT (exactly 7 days, not "more than" 7)

## 📝 Summary

- ⏰ **Automatic**: Runs daily at midnight
- 🗑️ **Criteria**: Deletes appointments >7 days old
- 🔧 **Manual**: Can trigger via `/cleanup-appointments`
- 📊 **Logging**: Full statistics and deleted appointments listed
- 🔐 **Privacy**: Reduces data retention, protects patient info
- ✅ **Safe**: Only affects appointment_links.json, not calendar events

---

**Created**: October 13, 2025  
**Version**: 1.0.0
