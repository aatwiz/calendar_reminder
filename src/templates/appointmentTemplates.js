/**
 * Template helper functions for rendering HTML pages
 */

/**
 * Render appointment action page
 */
function renderAppointmentPage(token, appointment, clinicPhone) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Confirmation</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 Appointment Confirmation</h1>
          <p>Please choose an action for your appointment</p>
        </div>
        
        <div class="content">
          <div class="appointment-info">
            <h2>Appointment Details</h2>
            <div class="info-row">
              <span class="info-icon">👤</span>
              <span><strong>Patient:</strong> ${appointment.patientName}</span>
            </div>
            <div class="info-row">
              <span class="info-icon">📅</span>
              <span><strong>Time:</strong> ${new Date(appointment.appointmentTime).toLocaleString()}</span>
            </div>
          </div>
          
          <div class="actions" id="actions">
            <button class="btn btn-confirm" onclick="handleAction('confirm')">
              ✅ Confirm Appointment
            </button>
            <button class="btn btn-cancel" onclick="handleAction('cancel')">
              ❌ Cancel Appointment
            </button>
            <button class="btn btn-reschedule" onclick="handleAction('reschedule')">
              ❓ Reschedule Appointment
            </button>
          </div>
          
          <div class="loading" id="loading">
            <div class="spinner"></div>
            <p style="margin-top: 1rem; color: #666;">Processing...</p>
          </div>
          
          <div class="result-message" id="result"></div>
        </div>
      </div>
      
      <script>
        const clinicPhone = '${clinicPhone || '(Please contact reception)'}';
        
        async function handleAction(action) {
          const actions = document.getElementById('actions');
          const loading = document.getElementById('loading');
          const result = document.getElementById('result');
          
          // Hide buttons, show loading
          actions.style.display = 'none';
          loading.classList.add('show');
          
          try {
            const response = await fetch('/appointment/${token}/action', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ action })
            });
            
            const data = await response.json();
            
            loading.classList.remove('show');
            
            if (response.ok && data.success) {
              if (action === 'confirm') {
                result.innerHTML = '✅ <strong>Appointment Confirmed!</strong><br>See you at your appointment.';
                result.className = 'result-message success show';
              } else if (action === 'cancel') {
                result.innerHTML = '❌ <strong>Appointment Cancelled</strong><br>Your appointment has been cancelled.';
                result.className = 'result-message success show';
              } else if (action === 'reschedule') {
                result.innerHTML = '❓ <strong>Need to Reschedule?</strong><br>Please call the reception at <strong>' + clinicPhone + '</strong> to reschedule your appointment.';
                result.className = 'result-message info show';
              }
            } else {
              result.innerHTML = '❌ <strong>Error:</strong> ' + (data.error || 'Something went wrong');
              result.className = 'result-message error show';
            }
          } catch (error) {
            loading.classList.remove('show');
            result.innerHTML = '❌ <strong>Error:</strong> Failed to process your request';
            result.className = 'result-message error show';
          }
        }
      </script>
    </body>
    </html>
  `;
}

/**
 * Render already used page
 */
function renderAlreadyUsedPage(appointment) {
  let actionText = '';
  let emoji = '';
  
  switch (appointment.action) {
    case 'confirm':
      emoji = '✅';
      actionText = 'confirmed';
      break;
    case 'cancel':
      emoji = '❌';
      actionText = 'cancelled';
      break;
    case 'reschedule':
      emoji = '❓';
      actionText = 'marked for rescheduling';
      break;
  }
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Link Already Used</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="used-container">
        <div class="emoji">${emoji}</div>
        <h1>Already Processed</h1>
        <p>This appointment has already been <strong>${actionText}</strong>.</p>
        <p style="margin-top: 2rem; font-size: 0.9rem;">If you need to make changes, please contact the clinic directly.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Render error page
 */
function renderErrorPage(title, message) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="error-container">
        <div class="emoji">🚫</div>
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  renderAppointmentPage,
  renderAlreadyUsedPage,
  renderErrorPage
};
