/**
 * Generate setup page HTML
 * @param {boolean} isGoogleAuthenticated - Google authentication status
 * @param {boolean} isWhatsAppAuthenticated - WhatsApp Business authentication status
 * @returns {string} HTML content
 */
function renderSetupPage(isGoogleAuthenticated, isWhatsAppAuthenticated) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Setup API Keys</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 Clinic Appointment Reminder</h1>
          <p>Connect your services to send WhatsApp reminders to patients</p>
          <div style="margin-top: 10px;">
            <a href="/" class="btn" style="display: inline-block;">🏠 Back to Home</a>
          </div>
        </div>
        
        <div class="form-container">
          
          <!-- Google Calendar Section -->
          <div class="section">
            <div class="google-auth-section ${isGoogleAuthenticated ? 'authenticated' : ''}">
              <div class="section-title">
                <span class="section-icon google-icon"></span>
                Google Calendar
              </div>
              
              ${isGoogleAuthenticated ? `
                <div class="status-badge status-connected">✅ Connected</div>
                <p>Your Google Calendar is successfully connected. We can now access your appointment schedule.</p>
                <div class="buttons" style="margin-top: 1rem;">
                  <a href="/revoke-google" class="btn btn-danger" style="flex: none;">
                    🚫 Disconnect
                  </a>
                </div>
              ` : `
                <div class="status-badge status-disconnected">❌ Not Connected</div>
                <p>Connect your Google Calendar to access patient appointments.</p>
                <a href="/auth" class="btn btn-success">
                  � Sign in with Google
                </a>
              `}
            </div>
          </div>

          <!-- WhatsApp Business Section -->
          <div class="section">
            ${isWhatsAppAuthenticated ? `
              <div class="google-auth-section authenticated">
                <div class="section-title">
                  <span class="section-icon twilio-icon"></span>
                  WhatsApp Business API
                </div>
                <div class="status-badge status-connected">✅ Configured</div>
                <p>WhatsApp Business is successfully configured. You can now send WhatsApp reminders to patients.</p>
                <form method="POST" action="/revoke-whatsapp" style="margin-top: 1rem;">
                  <button type="submit" class="btn btn-danger" style="width: auto;">
                    🚫 Remove Credentials
                  </button>
                </form>
              </div>
            ` : `
              <div class="section-title">
                <span class="section-icon twilio-icon">�</span>
                WhatsApp Business API
              </div>
              
              <form method="POST" action="/save-whatsapp">
                <div class="form-group">
                  <label for="phone_number_id">Phone Number ID</label>
                  <input type="text" id="phone_number_id" name="phone_number_id" required placeholder="123456789012345" />
                  <div class="help-text">
                    Found in <a href="https://developers.facebook.com/" target="_blank">Meta Developer Console</a> → Your App → WhatsApp → Phone Numbers
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="business_account_id">Business Account ID (WABA ID)</label>
                  <input type="text" id="business_account_id" name="business_account_id" required placeholder="123456789012345" />
                  <div class="help-text">Your WhatsApp Business Account ID from Meta Business Manager</div>
                </div>
                
                <div class="form-group">
                  <label for="access_token">Access Token</label>
                  <input type="password" id="access_token" name="access_token" required />
                  <div class="help-text">Permanent access token - generate via System Users in Business Settings</div>
                </div>
                
                <div class="form-group">
                  <label for="template_name">Template Name</label>
                  <input type="text" id="template_name" name="template_name" placeholder="appointment_reminder" />
                  <div class="help-text">Name of your approved message template (default: appointment_reminder)</div>
                </div>
                
                <div class="form-group">
                  <label for="clinic_phone">Clinic Phone Number</label>
                  <input type="text" id="clinic_phone" name="clinic_phone" placeholder="+353871234567" />
                  <div class="help-text">Phone number patients call to reschedule - shown in messages</div>
                </div>
                
                <button type="submit" class="btn btn-primary" style="width: 100%;">
                  💾 Save WhatsApp Credentials
                </button>
              </form>
            `}
          </div>

          ${isGoogleAuthenticated && isWhatsAppAuthenticated ? `
            <div class="section" style="background-color: #e8f5e8; border: 2px solid #c8e6c9; border-radius: 8px; padding: 1.5rem; text-align: center;">
              <h3 style="color: #34a853; margin: 0 0 0.5rem 0;">🎉 Setup Complete!</h3>
              <p style="color: #555; margin: 0;">Both services are connected. Your clinic can now send automated WhatsApp reminders for appointments!</p>
            </div>
          ` : ''}
          
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate success page HTML
 * @param {string} title - Page title
 * @param {string} message - Success message
 * @param {string} buttonText - Button text
 * @param {string} buttonLink - Button link
 * @returns {string} HTML content
 */
function renderSuccessPage(title, message, buttonText = '⚙️ Back to Setup', buttonLink = '/setup') {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <div class="success-icon">✅</div>
        <h1>${title}!</h1>
        <p>${message}</p>
        <a href="${buttonLink}" class="btn">${buttonText}</a>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate error page HTML
 * @param {string} title - Page title
 * @param {string} message - Error message
 * @returns {string} HTML content
 */
function renderErrorPage(title, message) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <div class="error-icon">❌</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/setup" class="btn">⚙️ Back to Setup</a>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  renderSetupPage,
  renderSuccessPage,
  renderErrorPage
};