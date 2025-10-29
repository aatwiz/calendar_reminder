# 🏥 Clinic Appointment Reminder - Setup Guide

Welcome! This guide will walk you through setting up the WhatsApp appointment reminder system for your clinic.

## Quick Overview

The system does two things:
1. **Automatically sends WhatsApp reminders** to patients 24-48 hours before their appointments
2. **Tracks patient responses** (Confirm or Reschedule) and updates your calendar

---

## Step 1: Login to the System

1. Go to: **https://calendar-reminder-tau.vercel.app**
2. Enter your credentials:
   - **Username**: `riverpointeyeclinic2000`
   - **Password**: `@hmed2008`
3. Click **Login**

---

## Step 2: Connect Google Calendar

1. On the home page, click **⚙️ Setup**
2. Under "**Google Calendar**" section, click **📱 Sign in with Google**
3. Select the Google account that has your clinic calendar
4. Grant permissions when asked
5. You'll be redirected back - Google Calendar is now connected! ✅

---

## Step 3: Configure WhatsApp Business API

This is the most important step. You'll need credentials from Meta (Facebook). Follow these instructions carefully:

### Getting Your WhatsApp Credentials

#### 1️⃣ Go to Meta Developer Console
- Visit: https://developers.facebook.com
- Login with your Meta business account (or create one)

#### 2️⃣ Create/Select Your App
- If you don't have an app: Click "Create App" → Choose "Business" type
- If you have one: Select it from the dashboard
- App name suggestion: "Clinic Appointment Reminder"

#### 3️⃣ Add WhatsApp to Your App
- In your app dashboard, find "**Add Product**" or look for WhatsApp
- Click "**Set up**" next to WhatsApp Business Platform
- Follow the setup wizard

#### 4️⃣ Get Your Phone Number ID
This is the WhatsApp Business number you'll use to send messages:

1. Go to: **WhatsApp → Phone Numbers** (in your app dashboard)
2. You should see a phone number listed
3. Click on it to view details
4. Copy the **Phone Number ID** (looks like: `123456789012345`)
   - ℹ️ This is NOT your actual phone number, it's the ID

**Example**: `879664315220602`

#### 5️⃣ Get Your Business Account ID (WABA ID)
1. Go to: **WhatsApp → Getting Started** or **Account Settings**
2. Look for **"Business Account ID"** or **"WABA ID"**
3. Copy this ID (looks like: `123456789012345`)

**Example**: `1307470840675023`

#### 6️⃣ Generate Your Access Token
This is a security token that allows the app to send messages:

1. Go to: **Settings → Business Accounts**
2. Select your business account
3. Go to **Accounts → System Users**
4. Create a new System User (or use existing one)
5. Assign the System User access to your WhatsApp app
6. Generate a **Permanent Access Token** (⚠️ only shows once!)
7. Copy the token carefully

**Example**: `EAAVrDwi50qEBP9ex7T9ptr8qdIdXuDATxxbUxZCJ4nlRxQHw7hgyDM3dhWdOdVjNKM95oZB4IVqpE6POcphB7cbZB54IZBTw3jky2ZAmKjkcZAh1WXcuQB8noGhuyOGB9eaK4LMZCZCnfJic4Pob8JctYn29TlDTnWnoZBBp1R6gLCGTZAf0ZBMezwy78BAZBrgl0V93IQZDZD`

⚠️ **Keep this token safe** - don't share it with anyone!

---

## Step 4: Fill in the Setup Form

Now that you have all your credentials, go back to the clinic app:

1. Click **⚙️ Setup** if you're not already there
2. Scroll down to **"WhatsApp Business API"** section
3. Fill in these fields:

| Field | Value | Example |
|-------|-------|---------|
| **Phone Number ID** | From Step 4 above | `879664315220602` |
| **Business Account ID (WABA ID)** | From Step 5 above | `1307470840675023` |
| **Access Token** | From Step 6 above | `EAAVrDwi50qEBP9ex7T9ptr8qdIdXuDATxxbUxZCJ4nlRxQHw7hgyDM3dhWdOdVjNKM95oZB4IVqpE6POcphB7cbZB54IZBTw3jky2ZAmKjkcZAh1WXcuQB8noGhuyOGB9eaK4LMZCZCnfJic4Pob8JctYn29TlDTnWnoZBBp1R6gLCGTZAf0ZBMezwy78BAZBrgl0V93IQZDZD` |
| **Template Name** | Message template name | `appointment_reminder` |
| **Clinic Phone Number** | Your phone number | `+353871240142` |

4. Click **💾 Save WhatsApp Credentials**
5. You should see **✅ Setup Complete!**

---

## Step 5: Create Your Message Template

WhatsApp requires you to create and approve a message template before sending messages.

### Create Template in Meta:

1. Go to: **Meta Business Manager → WhatsApp → Message Templates**
2. Click **"Create Template"**
3. Fill in:
   - **Template Name**: `appointment_reminder`
   - **Category**: Select "Transactional"
   - **Language**: English

### Template Content:

In the message body, use these placeholders:

```
Hi {{1}},

Your appointment is coming up!

📅 Date & Time: {{2}}

Please confirm if you can make it or let us know if you need to reschedule.

Thank you,
[Your Clinic Name]
```

4. Click **Submit for Review**
5. Meta will review and approve within a few minutes

---

## Step 6: Test It Out

1. Create a test event in your Google Calendar
2. Format the title as: **`Patient Name #PhoneNumber`**
   - Example: `John Smith #+353871234567`
3. Set it for 24-48 hours in the future
4. The system will automatically send a WhatsApp reminder

---

## How It Works - Calendar Event Format

When creating calendar events, use this format:

```
Patient Name #PhoneNumber
```

**Examples:**
- `Sarah Murphy #0871234567` → Will send to +353871234567
- `Mike Johnson #+353891234567` → Will send to +353891234567

The system automatically:
- ✅ Detects patient appointments from your calendar
- ✅ Sends WhatsApp reminders 24-48 hours before
- ✅ Tracks patient responses (Confirm/Reschedule)
- ✅ Updates your calendar with emoji status:
  - `✅` = Confirmed
  - `🔄` = Marked for Rescheduling

---

## Patient Response Flow

When patients receive your reminder, they can reply:

1. **CONFIRM** → Appointment confirmed, calendar gets ✅ emoji
2. **RESCHEDULE** → Clinic gets notified at +353871240142 to follow up

---

## Troubleshooting

### "Template not found" error
- Make sure Meta has approved your template
- Template name must match exactly (case-sensitive): `appointment_reminder`

### "Invalid phone number"
- Phone numbers must include country code
- Ireland: `+353` (remove leading 0)
- Example: `0871234567` → `+353871234567`

### "Access Token expired"
- Generate a new permanent token from Meta
- Update it in the setup form

### Calendar events not sending reminders
- Make sure the event title has `#PhoneNumber`
- Check that the appointment is 24-48 hours away
- Verify WhatsApp is marked as **✅ Configured** on setup page

---

## Security Notes

- ⚠️ **Keep your Access Token private** - never share it
- ⚠️ Don't commit credentials to GitHub (they're git-ignored)
- ⚠️ Change your login password periodically: Settings → Change Password
- ⚠️ Only admins should have access to the setup page

---

## Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Verify all credentials are correct (especially spacing/dashes)
3. Check Meta Developer Console for errors
4. Contact your system administrator

---

## Quick Reference

| Item | Value |
|------|-------|
| **Login URL** | https://calendar-reminder-tau.vercel.app |
| **Username** | riverpointeyeclinic2000 |
| **Template Name** | appointment_reminder |
| **Clinic Phone** | +353871240142 |
| **Reschedule Notifications To** | +353871240142 |

---

**Congratulations! Your clinic appointment reminder system is now set up.** 🎉

The system will automatically send WhatsApp reminders to your patients before each appointment!
