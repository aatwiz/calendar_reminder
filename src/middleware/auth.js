const session = require('express-session');

/**
 * Authentication Middleware
 * Protects admin pages with basic username/password authentication
 */

/**
 * Session configuration
 */
function getSessionConfig() {
  return session({
    secret: process.env.SESSION_SECRET || 'calendar-reminder-session-secret-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  });
}

/**
 * Login page HTML
 */
function getLoginPageHTML() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Calendar Reminder - Login</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: #f5f5f5;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        
        .login-container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          width: 100%;
          max-width: 400px;
        }
        
        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .login-header h1 {
          color: #1a1a1a;
          font-size: 28px;
          margin-bottom: 10px;
        }
        
        .login-header p {
          color: #666;
          font-size: 14px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        label {
          display: block;
          margin-bottom: 8px;
          color: #1a1a1a;
          font-weight: 500;
          font-size: 14px;
        }
        
        input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.2s;
        }
        
        input:focus {
          outline: none;
          border-color: #1a1a1a;
          box-shadow: 0 0 0 3px rgba(26, 26, 26, 0.1);
        }
        
        button {
          width: 100%;
          padding: 12px;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        button:hover {
          background: #333;
        }
        
        button:active {
          background: #000;
        }
        
        .error-message {
          background: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 20px;
          display: none;
        }
        
        .error-message.show {
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="login-header">
          <h1>🔐 Riverpoint Eye Clinic</h1>
          <p>Calendar Reminder System</p>
        </div>
        
        <form method="POST" action="/login" id="loginForm">
          <div class="error-message" id="errorMessage"></div>
          
          <div class="form-group">
            <label for="username">Username</label>
            <input 
              type="text" 
              id="username" 
              name="username" 
              placeholder="Enter username" 
              required 
              autocomplete="username"
            >
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              placeholder="Enter password" 
              required 
              autocomplete="current-password"
            >
          </div>
          
          <button type="submit">Login</button>
        </form>
      </div>
    </body>
    </html>
  `;
}

/**
 * Middleware to check if user is authenticated
 */
function isAuthenticated(req, res, next) {
  console.log(`\n🔐 Auth check for ${req.method} ${req.path}`);
  console.log(`   Session ID: ${req.sessionID}`);
  console.log(`   Authenticated: ${req.session?.authenticated || false}`);
  console.log(`   Session data keys: ${Object.keys(req.session || {}).join(', ')}`);
  
  // Check authentication
  if (req.session && req.session.authenticated) {
    console.log(`   ✅ Authenticated - allowing`);
    return next();
  }
  
  // Not authenticated - redirect to login
  console.log(`   ❌ Not authenticated - redirecting to /login`);
  res.redirect('/login');
}

/**
 * Login route handler
 */
function handleLogin(req, res) {
  const { username, password } = req.body;
  
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'riverpointeyeclinic2000';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@hmed2008';
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.loginTime = new Date().toISOString();
    console.log(`✅ User authenticated at ${req.session.loginTime}`);
    console.log(`✅ Session ID: ${req.sessionID}`);
    console.log(`✅ Session data:`, req.session);
    
    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('❌ Error saving session:', err);
        return res.status(500).send('Error saving session');
      }
      console.log(`✅ Session saved, redirecting to /setup`);
      res.redirect('/setup');
    });
  } else {
    console.log(`❌ Failed login attempt with username: ${username}`);
    res.status(401).send(getLoginPageHTML());
  }
}

/**
 * Logout route handler
 */
function handleLogout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/login');
  });
}

/**
 * GET /login - Display login page
 */
function getLoginPage(req, res) {
  if (req.session && req.session.authenticated) {
    return res.redirect('/setup');
  }
  res.send(getLoginPageHTML());
}

module.exports = {
  getSessionConfig,
  isAuthenticated,
  handleLogin,
  handleLogout,
  getLoginPage
};
