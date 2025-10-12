# ⏰ Automated SMS Reminder System

**Status:** ✅ Active and Running  
**Last Updated:** October 11, 2025

---

## 🎯 How It Works

The system automatically:
1. **Checks every 15 minutes** for upcoming appointments
2. **Scans 48 hours ahead** from the current time
3. **Finds events with "#"** in the title (patient appointments)
4. **Sends SMS reminders** to the phone numbers found after "#"

---

## ⏱️ Schedule

- **Frequency:** Every 15 minutes
- **Timezone:** Europe/Amsterdam
- **Check Window:** Next 48 hours from current time
- **Runs:** 24/7 while server is running

---

## 📅 Calendar Event Format

```
Title: [Patient Name] #[Phone Number]

Examples:
- "John Doe #612345678" → Sends to +31612345678
- "Jane Smith #+31698765432" → Sends to +31698765432 (uses as-is)
- "Regular Meeting" → Skipped (no #)
```

---

## 📱 SMS Message Format

```
"Hello [Patient Name]!"
```

Example: For event "John Doe #612345678"  
Message sent: **"Hello John Doe!"**

---

## 🔍 Console Output Example

```
⏰ ===== AUTOMATED REMINDER CHECK =====
📅 Time: 10/11/2025, 11:16:29 PM
🔍 Checking for events between:
   From: 10/11/2025, 11:16:29 PM
   To:   10/13/2025, 11:16:29 PM
✅ Found 5 total event(s) in next 48 hours
🔍 Found 2 event(s) with "#" (patient appointments)

📌 Processing: John Doe #612345678
   Appointment time: 10/12/2025, 2:00:00 PM
   📝 Message: "Hello John Doe!"
   📞 Phone: +31612345678
   ✅ SMS sent! SID: SM...

📌 Processing: Jane Smith #698765432
   Appointment time: 10/13/2025, 10:00:00 AM
   📝 Message: "Hello Jane Smith!"
   📞 Phone: +31698765432
   ✅ SMS sent! SID: SM...

📊 Automated Check Summary:
   Events checked: 5
   Patient appointments: 2
   SMS sent: 2
   Failed: 0
===== END OF AUTOMATED CHECK =====
```

---

## 🚀 Starting the System

```bash
cd /Users/abdullatwair/Documents/Coding/Github/calendar_reminder
node index.js
```

The server will:
- ✅ Start on `http://localhost:3000`
- ✅ Run an immediate check on startup
- ✅ Schedule checks every 15 minutes
- ✅ Continue running until stopped

---

## 🛑 Stopping the System

```bash
# Find and kill the Node.js process
pkill -f "node index.js"

# Or press Ctrl+C in the terminal where it's running
```

---

## 🔧 Configuration

### Current Settings:
- **Country Code:** +31 (Netherlands)
- **Check Interval:** 15 minutes
- **Look-ahead Window:** 48 hours
- **Timezone:** Europe/Amsterdam

### To Change:

**Country Code:**
Edit `index.js` line with `+31${phoneNumber}` to your country code

**Check Interval:**
Edit cron schedule in `index.js`:
```javascript
cron.schedule('*/15 * * * *', ...) // Every 15 minutes
cron.schedule('*/30 * * * *', ...) // Every 30 minutes
cron.schedule('0 * * * *', ...)    // Every hour
```

**Look-ahead Window:**
Edit in `sendAutomatedReminders()`:
```javascript
const fortyEightHoursLater = new Date(now.getTime() + (48 * 60 * 60 * 1000));
// Change 48 to desired hours
```

**Timezone:**
Edit in cron.schedule():
```javascript
timezone: "Europe/Amsterdam"
// Change to your timezone (e.g., "America/New_York", "Asia/Dubai")
```

---

## 📊 Manual Testing

You can still manually trigger reminders:
- Visit: `http://localhost:3000/send-reminders`
- Or click "📱 Send SMS Reminders" from the dashboard

---

## ✅ Prerequisites

Make sure these are configured:
- [x] Google Calendar OAuth authenticated
- [x] Twilio credentials saved
- [x] Server running (`node index.js`)

---

## 💡 Best Practices

1. **Keep server running** - Use PM2 or similar for production:
   ```bash
   npm install -g pm2
   pm2 start index.js --name clinic-reminders
   pm2 save
   pm2 startup
   ```

2. **Monitor logs** - Watch for failed sends or errors

3. **Test first** - Create test appointments to verify SMS delivery

4. **Verify numbers** - For Twilio trial accounts, verify recipient numbers

---

## 🔔 Production Deployment Tips

### Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start index.js --name clinic-reminders

# View logs
pm2 logs clinic-reminders

# Restart if needed
pm2 restart clinic-reminders

# Stop
pm2 stop clinic-reminders
```

### Environment Variables
Create a `.env` file with:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
```

---

## 🎉 Success!

Your automated clinic appointment reminder system is now:
- ✅ Running every 15 minutes
- ✅ Checking appointments 48 hours ahead
- ✅ Sending SMS to patients automatically
- ✅ Logging all activities to console

**No manual intervention needed!** 🚀
