const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');

/**
 * Authentication Middleware
 * Protects admin pages with basic username/password authentication
 */

/**
 * Session configuration
 */
function getSessionConfig() {
  const sessionDir = path.join(__dirname, '../../sessions');
  
  // In production on Railway, trust the proxy (HTTPS is handled by Railway's reverse proxy)
  // In development, use non-secure cookies
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
  
  console.log(`\n🔐 ===== SESSION CONFIG =====`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT}`);
  console.log(`isProduction: ${isProduction}`);
  console.log(`Session store: FileStore at ${sessionDir}`);
  console.log(`=============================\n`);
  
  return session({
    store: new FileStore({
      path: sessionDir,
      ttl: 24 * 60 * 60, // 24 hours in seconds
      reapInterval: 60 * 60 // Clean up old sessions every hour
    }),
    secret: process.env.SESSION_SECRET || 'calendar-reminder-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false, // Don't save empty sessions
    name: 'calendarReminderId', // Custom cookie name
    cookie: {
      path: '/',
      httpOnly: true,
      secure: isProduction, // Only HTTPS in production
      // Use 'lax' so OAuth GET redirects (third-party navigations) include the cookie
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
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
  console.log(`   Cookie: ${req.get('cookie')?.substring(0, 50)}...`);
  
  // Check if session exists and user is authenticated
  const isAuth = req.session && req.session.authenticated === true;
  console.log(`   Session exists: ${!!req.session}`);
  console.log(`   Authenticated: ${isAuth}`);
  
  if (isAuth) {
    console.log(`   ✅ AUTHENTICATED - allowing request`);
    return next();
  }
  
  // Not authenticated - redirect to login
  console.log(`   ❌ NOT AUTHENTICATED - redirecting to /login`);
  res.redirect('/login');
}

/**
 * Login route handler
 */
function handleLogin(req, res) {
  const { username, password } = req.body;
  
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'riverpointeyeclinic2000';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@hmed2008';
  
  console.log(`\n🔐 ===== LOGIN ATTEMPT =====`);
  console.log(`Username provided: ${username}`);
  console.log(`Session ID before auth: ${req.sessionID}`);
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    console.log(`✅ Credentials valid`);
    
    // Set session properties
    req.session.authenticated = true;
    req.session.loginTime = new Date().toISOString();
    req.session.username = username;
    
    console.log(`✅ Session authenticated: true`);
    console.log(`✅ Session ID: ${req.sessionID}`);
    
    // Save session with callback
    req.session.save((err) => {
      if (err) {
        console.error('❌ Error saving session:', err);
        console.log(`===== END LOGIN ATTEMPT (ERROR) =====\n`);
        return res.status(500).send(`<h1>Authentication Error</h1><p>Failed to save session: ${err.message}</p><a href="/login">Retry</a>`);
      }
      
      console.log(`✅ Session saved to disk`);
      console.log(`✅ Redirecting to /setup`);
      console.log(`===== END LOGIN ATTEMPT (SUCCESS) =====\n`);
      
      // Redirect with explicit status
      res.redirect('/setup');
    });
  } else {
    console.log(`❌ Invalid credentials provided`);
    console.log(`===== END LOGIN ATTEMPT (INVALID) =====\n`);
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
