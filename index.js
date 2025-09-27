const express = require('express');
const bodyParser = require('body-parser');
const { sendDoctorNotification } = require('./src/services/email');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Import routes
const setupRoutes = require('./src/routes/setup');
const authRoutes = require('./src/routes/auth');

// Use routes
app.use('/', setupRoutes);
app.use('/', authRoutes);

// ========= EMAIL TESTING ENDPOINTS =========

/**
 * POST /send-doctor-notification - Send test doctor notification
 */
app.post('/send-doctor-notification', async (req, res) => {
  try {
    const { 
      doctorEmail, 
      patientName, 
      patientPhone, 
      patientMethod, 
      appointmentSummary, 
      appointmentStart, 
      appointmentEnd 
    } = req.body;
    
    // Validate method (case insensitive)
    const validMethods = ['whatsapp', 'wa', 'sms'];
    const normalizedMethod = patientMethod.toLowerCase();
    if (!validMethods.includes(normalizedMethod)) {
      return res.status(400).json({ 
        error: 'Invalid method. Use WhatsApp, WA, or SMS (case insensitive)' 
      });
    }
    
    // Format method for display
    const displayMethod = normalizedMethod === 'wa' ? 'WhatsApp' : 
                         normalizedMethod === 'whatsapp' ? 'WhatsApp' : 'SMS';
    
    const patientInfo = {
      name: patientName,
      phone: patientPhone,
      method: displayMethod
    };
    
    const appointmentDetails = {
      summary: appointmentSummary,
      start: appointmentStart,
      end: appointmentEnd
    };
    
    const result = await sendDoctorNotification(doctorEmail, patientInfo, appointmentDetails);
    
    if (result.success) {
      res.json({ message: 'Doctor notification sent successfully', info: result.info });
    } else {
      res.status(500).json({ error: 'Failed to send notification', details: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /test-email - Test email interface
 */
app.get('/test-email', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Doctor Email Notification</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background-color: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          max-width: 500px;
          width: 100%;
        }
        h2 {
          margin-top: 0;
          color: #333;
          text-align: center;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #555;
          font-size: 0.9rem;
        }
        input, select {
          width: 100%;
          padding: 0.75rem;
          margin-bottom: 1rem;
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          font-size: 0.95rem;
          transition: border-color 0.2s ease;
          background: #fafbfc;
        }
        input:focus, select:focus {
          outline: none;
          border-color: #4285f4;
          background: white;
          box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
        }
        button {
          width: 100%;
          padding: 0.875rem;
          background-color: #34a853;
          border: none;
          color: white;
          font-size: 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        button:hover {
          background-color: #2d8f47;
          transform: translateY(-1px);
        }
        .method-info {
          font-size: 0.9em;
          color: #666;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background-color: #f8f9ff;
          border-radius: 8px;
          border-left: 4px solid #4285f4;
        }
        .back-link {
          display: block;
          text-align: center;
          margin-top: 1.5rem;
          color: #4285f4;
          text-decoration: none;
          font-size: 0.9rem;
        }
        .back-link:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🧪 Test Doctor Email Notification</h2>
        <div class="method-info">
          <strong>Patient Method Options:</strong> WhatsApp, WA, or SMS (case insensitive)<br>
          <em>Note: Only doctors receive email notifications, never patients</em>
        </div>
        <form id="emailForm">
          <label>Doctor Email:</label>
          <input type="email" id="doctorEmail" value="dr.smith@clinic.com" required />
          
          <label>Patient Name:</label>
          <input type="text" id="patientName" value="John Doe" required />
          
          <label>Patient Phone:</label>
          <input type="text" id="patientPhone" value="+1234567890" required />
          
          <label>Contact Method:</label>
          <select id="patientMethod" required>
            <option value="WhatsApp">WhatsApp</option>
            <option value="WA">WA</option>
            <option value="SMS">SMS</option>
          </select>
          
          <label>Appointment Summary:</label>
          <input type="text" id="appointmentSummary" value="Annual Checkup" required />
          
          <label>Appointment Start:</label>
          <input type="datetime-local" id="appointmentStart" required />
          
          <label>Appointment End:</label>
          <input type="datetime-local" id="appointmentEnd" required />
          
          <button type="submit">📧 Send Test Email</button>
        </form>
        
        <div id="result" style="margin-top: 1rem;"></div>
        
        <a href="/setup" class="back-link">← Back to Setup</a>
        
        <script>
          // Set default datetime values
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(10, 0, 0, 0);
          const endTime = new Date(tomorrow);
          endTime.setHours(11, 0, 0, 0);
          
          document.getElementById('appointmentStart').value = tomorrow.toISOString().slice(0, 16);
          document.getElementById('appointmentEnd').value = endTime.toISOString().slice(0, 16);
          
          document.getElementById('emailForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const button = document.querySelector('button[type="submit"]');
            const originalText = button.textContent;
            button.textContent = '📧 Sending...';
            button.disabled = true;
            
            const formData = {
              doctorEmail: document.getElementById('doctorEmail').value,
              patientName: document.getElementById('patientName').value,
              patientPhone: document.getElementById('patientPhone').value,
              patientMethod: document.getElementById('patientMethod').value,
              appointmentSummary: document.getElementById('appointmentSummary').value,
              appointmentStart: document.getElementById('appointmentStart').value,
              appointmentEnd: document.getElementById('appointmentEnd').value
            };
            
            try {
              const response = await fetch('/send-doctor-notification', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
              });
              
              const result = await response.json();
              
              const resultDiv = document.getElementById('result');
              if (response.ok) {
                resultDiv.innerHTML = '<div style="color: #34a853; font-weight: 500; padding: 1rem; background: #e8f5e8; border-radius: 8px; border-left: 4px solid #34a853;">✅ Email sent successfully!</div>';
              } else {
                resultDiv.innerHTML = '<div style="color: #ea4335; font-weight: 500; padding: 1rem; background: #ffebee; border-radius: 8px; border-left: 4px solid #ea4335;">❌ Error: ' + (result.error || 'Unknown error') + '</div>';
              }
            } catch (error) {
              document.getElementById('result').innerHTML = '<div style="color: #ea4335; font-weight: 500; padding: 1rem; background: #ffebee; border-radius: 8px; border-left: 4px solid #ea4335;">❌ Network error: ' + error.message + '</div>';
            } finally {
              button.textContent = originalText;
              button.disabled = false;
            }
          });
        </script>
      </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`➡ Go to http://localhost:${port}/setup to enter API keys`);
  console.log(`📧 Go to http://localhost:${port}/test-email to test doctor notifications`);
});

module.exports = app;