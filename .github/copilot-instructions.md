# Calendar SMS Reminder Application

Calendar SMS Reminder is a Node.js Express web application that integrates with Google Calendar API and Twilio SMS to provide calendar event notifications via text message.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the information provided here.**

## Working Effectively

### Bootstrap and Setup
- Install Node.js v20+ (current version: v20.19.5)
- Bootstrap the repository:
  ```bash
  npm install  # takes under 1 second when cached
  npm audit fix  # fix security vulnerabilities if any exist
  ```
- **NEVER CANCEL**: All commands in this application complete quickly (under 5 seconds). No timeouts needed.

### Build and Development
- **NO BUILD STEP REQUIRED**: This is a simple Node.js application with no compilation step
- Dependencies install quickly: `npm install` takes approximately 0.7 seconds
- **Security**: Always run `npm audit fix` after `npm install` to address security vulnerabilities

### Run the Application
- Start the server: `node index.js`
- Server starts on port 3000 within 2-3 seconds
- Access the application at `http://localhost:3000`
- Setup interface available at `http://localhost:3000/setup`

### Available Endpoints
- `GET /setup` - Web interface for configuring Google Calendar and Twilio API keys
- `POST /save-keys` - Save API configuration
- `GET /auth` - Google OAuth flow initiation
- `GET /oauth2callback` - Google OAuth callback handler
- `GET /events` - Fetch upcoming calendar events (requires authentication)

## Validation

### Manual Testing Requirements
After making any changes, **ALWAYS** perform these validation steps:

1. **Application Startup Test**:
   ```bash
   node index.js
   # Should see: "🚀 Server running at http://localhost:3000"
   # Should see: "➡ Go to http://localhost:3000/setup to enter API keys"
   ```

2. **Setup Page Test** (CRITICAL):
   - Navigate to `http://localhost:3000/setup`
   - Verify the form displays with fields for:
     - Google Calendar (Client ID, Client Secret, Redirect URI)
     - Twilio (Account SID, Auth Token, Phone Number)
   - Form should have clean, responsive styling
   - Save button should be functional

3. **API Endpoints Test**:
   ```bash
   curl http://localhost:3000/events
   # Should return: "❌ Google not authenticated. Go to /auth first."
   ```

4. **Code Quality** (when making code changes):
   ```bash
   npx eslint index.js  # Basic linting check available
   ```

### Expected Behavior
- Application must start successfully and serve the setup page
- All endpoints must return appropriate responses
- Configuration must persist in `config.json` file
- No build artifacts or compiled files exist in this project

## Development Guidelines

### Code Quality
- Run basic linting: `npx eslint index.js`
- ESLint v9.35.0 is available via npx for code quality checks
- **NEVER commit `node_modules/`** - it's excluded via `.gitignore`
- **NEVER commit `config.json`** - contains sensitive API keys

### File Structure
```
├── index.js           # Main application file (194 lines)
├── package.json       # Dependencies and project metadata
├── package-lock.json  # Dependency lock file
└── config.json        # API configuration (created at runtime, git-ignored)
```

### Dependencies
- **express**: Web framework (v5.1.0)
- **body-parser**: Request parsing (v2.2.0)
- **googleapis**: Google Calendar API client (v156.0.0)
- **twilio**: SMS service integration (v5.8.0)

### Important Code Locations
- **API key management**: Lines 12-25 in `index.js` (`loadConfig()`, `saveConfig()`)
- **Google OAuth flow**: Lines 135-167 in `index.js`
- **Setup UI**: Lines 30-112 in `index.js` (embedded HTML form)
- **Calendar integration**: Lines 169-189 in `index.js`

## Common Tasks

### Adding New Features
1. Always test the basic application flow first
2. Modify `index.js` - it's the single application file
3. Test endpoints using curl or browser
4. Verify setup page still functions correctly

### Debugging Issues
1. Check if server starts: `node index.js`
2. Verify setup page loads: `http://localhost:3000/setup`
3. Test API endpoints: `curl http://localhost:3000/events`
4. Check `config.json` exists if authentication issues occur

### Environment Requirements
- **Node.js**: v20+ required
- **NPM**: v10+ required
- **No additional system dependencies**
- **No Docker or containerization setup**

## Critical Notes

### Security
- API keys are stored in `config.json` (git-ignored)
- Always run `npm audit fix` to address vulnerabilities
- Never commit sensitive configuration data

### Performance
- Startup time: ~2-3 seconds
- Dependency installation: ~0.7 seconds (cached)
- No long-running processes or builds
- **NEVER CANCEL commands** - all operations complete quickly

### Limitations
- Single file application architecture
- No automated tests configured (`npm test` returns error)
- No CI/CD pipeline configured
- Configuration only via web interface

## Troubleshooting

### Common Issues
1. **"Google Calendar API keys not set"**: Visit `/setup` to configure API keys
2. **"Google not authenticated"**: Complete OAuth flow via `/auth` endpoint
3. **Port 3000 in use**: Kill existing process or change port in `index.js`
4. **Dependencies missing**: Run `npm install`

### Quick Health Check
```bash
cd /path/to/calendar_reminder
npm install
node index.js &
SERVER_PID=$!
sleep 2
curl -s http://localhost:3000/setup | grep -q "Setup API Keys" && echo "✅ Application healthy"
kill $SERVER_PID
```

Always ensure these validation steps pass before considering any changes complete.