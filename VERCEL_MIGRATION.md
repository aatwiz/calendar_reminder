# Vercel Migration Guide

## ⚠️ Important Considerations

Vercel uses **serverless functions**, which means:
- ❌ Long-running processes (cron jobs) won't work
- ❌ File-based session storage may not persist
- ✅ HTTP requests/webhooks work great
- ✅ Static files are served from CDN

## Changes Made

### 1. **vercel.json** - Tells Vercel how to run your app
- Configured for Node.js runtime
- Routes all requests to index.js

### 2. **api/index.js** - Serverless function entry point
- Vercel runs this as a serverless function
- It exports your Express app

## ⚠️ What Won't Work on Vercel

### Cron Jobs (Automated Reminders)
Your app uses `node-cron` to send reminders every 15 minutes. This won't run on Vercel because:
- Serverless functions only run when triggered
- They stop after responding to a request

**Solutions:**
1. **Best**: Use Vercel Cron Jobs (requires Vercel Pro or hobby tier)
2. **Alternative**: Use external service like IFTTT, Zapier, or AWS Lambda
3. **Alternative**: Use a separate Railway dyno just for cron jobs

### File-based Session Storage
Your app stores sessions in `sessions/` folder via `session-file-store`. On Vercel:
- Files are ephemeral (deleted between deployments)
- Multiple instances won't share session data

**Solutions:**
1. Switch to environment variable-based auth (simple)
2. Use Redis/database for sessions
3. Keep Railway just for cron, use Vercel for main app

## Environment Variables Setup

Before deploying to Vercel, add these to your project:

1. Go to your Vercel project settings
2. Add all variables from your `.env`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` → Change to `https://your-vercel-app.vercel.app/oauth2callback`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_VERIFY_TOKEN`

## Deployment Steps

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy your app:
   ```bash
   vercel
   ```

3. Follow prompts to set project name and environment

## Recommended Setup

For full functionality, consider a **hybrid approach**:
- **Vercel**: Main app (web UI, webhooks, OAuth, real-time responses)
- **Railway**: Background service (cron jobs for automated reminders)

This way you get the best of both worlds!
