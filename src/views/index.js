/**
 * Generate setup page HTML
 * @param {boolean} isGoogleAuthenticated - Google authentication status
 * @returns {string} HTML content
 */
function renderSetupPage(isGoogleAuthenticated) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Setup API Keys</title>
      <style>
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          max-width: 500px;
          width: 100%;
          overflow: hidden;
        }
        
        .header {
          background-color: #4285f4;
          color: white;
          padding: 2rem;
          text-align: center;
        }
        
        .header h1 {
          margin: 0;
          font-size: 1.8rem;
          font-weight: 600;
        }
        
        .header p {
          margin: 0.5rem 0 0 0;
          opacity: 0.9;
          font-size: 0.95rem;
        }
        
        .form-container {
          padding: 2rem;
        }
        
        .section {
          margin-bottom: 2rem;
        }
        
        .section:last-child {
          margin-bottom: 0;
        }
        
        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #333;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #f0f0f0;
          display: flex;
          align-items: center;
        }
        
        .section-icon {
          width: 20px;
          height: 20px;
          margin-right: 10px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        
        .twilio-icon { background-color: #f22f46; color: white; }
        .gmail-icon { background-color: #ea4335; color: white; }
        .google-icon { background-color: #4285f4; color: white; }
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #555;
          font-size: 0.9rem;
        }
        
        input[type="text"],
        input[type="email"],
        input[type="password"] {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          font-size: 0.95rem;
          transition: border-color 0.2s ease;
          background: #fafbfc;
        }
        
        input[type="text"]:focus,
        input[type="email"]:focus,
        input[type="password"]:focus {
          outline: none;
          border-color: #4285f4;
          background: white;
          box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
        }
        
        .help-text {
          font-size: 0.8rem;
          color: #666;
          margin-top: 0.25rem;
          line-height: 1.4;
        }
        
        .help-text a {
          color: #4285f4;
          text-decoration: none;
        }
        
        .help-text a:hover {
          text-decoration: underline;
        }
        
        .buttons {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }
        
        .btn {
          flex: 1;
          padding: 0.875rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        
        .btn-primary {
          background-color: #4285f4;
          color: white;
        }
        
        .btn-primary:hover {
          background-color: #3367d6;
          transform: translateY(-1px);
        }
        
        .btn-secondary {
          background-color: #f8f9fa;
          color: #5f6368;
          border: 2px solid #e8eaed;
        }
        
        .btn-secondary:hover {
          background-color: #e8f0fe;
          border-color: #4285f4;
          color: #4285f4;
        }
        
        .btn-success {
          background-color: #34a853;
          color: white;
        }
        
        .btn-success:hover {
          background-color: #2d8f47;
        }
        
        .btn-danger {
          background-color: #ea4335;
          color: white;
        }
        
        .btn-danger:hover {
          background-color: #d33b2c;
        }
        
        .google-auth-section {
          background-color: #f8f9ff;
          border: 2px solid #e8f0fe;
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        }
        
        .google-auth-section.authenticated {
          background-color: #e8f5e8;
          border-color: #c8e6c9;
        }
        
        .google-auth-section h3 {
          margin: 0 0 0.5rem 0;
          color: #4285f4;
        }
        
        .google-auth-section.authenticated h3 {
          color: #34a853;
        }
        
        .google-auth-section p {
          margin: 0 0 1rem 0;
          color: #666;
          font-size: 0.9rem;
        }
        
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
          margin-bottom: 1rem;
        }
        
        .status-connected {
          background-color: #e8f5e8;
          color: #2e7d32;
        }
        
        .status-disconnected {
          background-color: #ffebee;
          color: #c62828;
        }
        
        @media (max-width: 600px) {
          body {
            padding: 10px;
          }
          
          .buttons {
            flex-direction: column;
          }
          
          .header {
            padding: 1.5rem;
          }
          
          .form-container {
            padding: 1.5rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Calendar Reminder Setup</h1>
          <p>Configure your API keys and services</p>
        </div>
        
        <div class="form-container">
          <form method="POST" action="/save-keys">
            
            <div class="section">
              <div class="section-title">
                <span class="section-icon twilio-icon">📱</span>
                Twilio SMS Service
              </div>
              
              <div class="form-group">
                <label for="twilio_sid">Account SID</label>
                <input type="text" id="twilio_sid" name="twilio_sid" required placeholder="AC..." />
                <div class="help-text">Found in your Twilio Console dashboard</div>
              </div>
              
              <div class="form-group">
                <label for="twilio_auth_token">Auth Token</label>
                <input type="password" id="twilio_auth_token" name="twilio_auth_token" required />
                <div class="help-text">Keep this secure - it's like your password</div>
              </div>
              
              <div class="form-group">
                <label for="twilio_phone">Phone Number</label>
                <input type="text" id="twilio_phone" name="twilio_phone" required placeholder="+1234567890" />
                <div class="help-text">Your Twilio phone number in E.164 format</div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">
                <span class="section-icon gmail-icon">📧</span>
                Gmail SMTP (Doctor Notifications)
              </div>
              
              <div class="form-group">
                <label for="gmail_user">Gmail Address</label>
                <input type="email" id="gmail_user" name="gmail_user" required placeholder="clinic@example.com" />
                <div class="help-text">The Gmail account to send notifications from</div>
              </div>
              
              <div class="form-group">
                <label for="gmail_password">Gmail App Password</label>
                <input type="password" id="gmail_password" name="gmail_password" required />
                <div class="help-text">
                  Use an App Password, not your regular Gmail password. 
                  <a href="https://support.google.com/accounts/answer/185833" target="_blank">Learn how to create one</a>
                </div>
              </div>
            </div>
            
            <div class="buttons">
              <button type="submit" class="btn btn-primary">
                💾 Save Configuration
              </button>
              <a href="/test-email" class="btn btn-secondary">
                🧪 Test Email
              </a>
            </div>
            
          </form>
          
          <div class="section">
            <div class="google-auth-section ${isGoogleAuthenticated ? 'authenticated' : ''}">
              <div class="section-title">
                <span class="section-icon google-icon">📅</span>
                Google Calendar Access
              </div>
              
              ${isGoogleAuthenticated ? `
                <div class="status-badge status-connected">✅ Connected</div>
                <p>Your Google Calendar is successfully connected and ready to use.</p>
                <div class="buttons" style="margin-top: 1rem;">
                  <a href="/revoke-google" class="btn btn-danger" style="flex: none;">
                    🚫 Revoke Access
                  </a>
                </div>
              ` : `
                <div class="status-badge status-disconnected">❌ Not Connected</div>
                <p>Connect your Google Calendar to enable calendar reminders and notifications.</p>
                <a href="/auth" class="btn btn-success">
                  🔐 Sign in with Google
                </a>
              `}
            </div>
          </div>
          
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
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          width: 100%;
          padding: 2rem;
          text-align: center;
        }
        .success-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        h1 {
          color: #34a853;
          margin-bottom: 1rem;
        }
        p {
          color: #666;
          margin-bottom: 2rem;
        }
        .btn {
          display: inline-block;
          padding: 0.875rem 1.5rem;
          background-color: #4285f4;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .btn:hover {
          background-color: #3367d6;
          transform: translateY(-1px);
        }
      </style>
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
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          width: 100%;
          padding: 2rem;
          text-align: center;
        }
        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        h1 {
          color: #ea4335;
          margin-bottom: 1rem;
        }
        p {
          color: #666;
          margin-bottom: 2rem;
        }
        .btn {
          display: inline-block;
          padding: 0.875rem 1.5rem;
          background-color: #4285f4;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .btn:hover {
          background-color: #3367d6;
          transform: translateY(-1px);
        }
      </style>
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