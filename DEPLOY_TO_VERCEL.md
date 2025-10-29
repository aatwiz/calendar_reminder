# Deploy to Vercel - Quick Start

## Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

## Step 2: Login to Vercel
```bash
vercel login
```

## Step 3: Deploy Your App
```bash
cd /Users/abdullatwair/Documents/Coding/Github/calendar_reminder
vercel
```

Follow the prompts and answer:
- **Project name**: `calendar-reminder` (or your choice)
- **Which scope**: Your personal account
- **Link to existing project**: No (first time)
- **Build command**: Leave default (press enter)
- **Output directory**: Leave default (press enter)

## Step 4: Set Environment Variables

After deployment, go to your **Vercel Dashboard**:

1. Navigate to your project: https://vercel.com/dashboard
2. Click on your **calendar-reminder** project
3. Go to **Settings → Environment Variables**
4. Add all these variables (get values from your `.env`):

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Your Google Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google Client Secret |
| `GOOGLE_REDIRECT_URI` | `https://YOUR_VERCEL_URL.vercel.app/oauth2callback` |
| `ADMIN_USERNAME` | riverpointeyeclinic2000 |
| `ADMIN_PASSWORD` | @hmed2008 |
| `WHATSAPP_ACCESS_TOKEN` | Your WhatsApp token |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Your Business Account ID |
| `WHATSAPP_PHONE_NUMBER_ID` | Your Phone Number ID |
| `WHATSAPP_VERIFY_TOKEN` | Your Verify Token |

## Step 5: Update Google OAuth Redirect URI

1. Go to https://console.cloud.google.com
2. Select your project
3. Go to **APIs & Services → Credentials**
4. Click on your OAuth 2.0 Client ID
5. Update **Authorized redirect URIs**:
   - Remove: `http://localhost:3000/oauth2callback`
   - Add: `https://YOUR_VERCEL_URL.vercel.app/oauth2callback`
6. Click **Save**

## Step 6: Update WhatsApp Webhook URL

1. Go to your Meta Developer Console
2. Select your WhatsApp app
3. Go to **Configuration**
4. Update **Webhook URL** to:
   ```
   https://YOUR_VERCEL_URL.vercel.app/webhook/whatsapp
   ```
5. Keep the **Verify Token** the same

## Step 7: Redeploy with Environment Variables

```bash
vercel --prod
```

## ⚠️ Important: Automated Reminders

Your cron jobs (automated reminders every 15 minutes) **will NOT work** on Vercel's serverless platform.

### Options:

1. **Keep Railway for Cron Only** (Recommended)
   - Keep your current Railway app running for just the cron jobs
   - Disable the web server on Railway (or reduce dyno size)
   - This costs ~$5/month for a small background worker

2. **Use Vercel Cron Jobs** (Requires Pro)
   - Available with Vercel Pro ($20/month)
   - Set up in `vercel.json`

3. **Use External Service**
   - IFTTT, Zapier, or AWS Lambda
   - Set up external webhooks to trigger reminders

## Test Your Deployment

1. Visit: `https://YOUR_VERCEL_URL.vercel.app/`
2. Login with credentials
3. Go to `/setup` and verify everything works
4. Test WhatsApp webhook functionality

## Rollback to Railway

If you want to go back, your Railway app is still running. Just update your DNS/domain to point back there.

## Troubleshooting

**"Cannot find module"**: Make sure all environment variables are set in Vercel dashboard

**"Webhook verification failed"**: Check that `WHATSAPP_VERIFY_TOKEN` is correct

**"Google authentication failed"**: Verify `GOOGLE_REDIRECT_URI` matches in both Vercel and Google Console

**Need help?** Check the full `VERCEL_MIGRATION.md` file for more details.
