// functions/utils/email.js
// Resend API transactional email sender with branded responsive HTML templates

import { logEmail } from './db.js';

export function isResendConfigured(env) {
  const key = env?.RESEND_API_KEY || '';
  return Boolean(key && !key.includes('YourResendApiKeyHere'));
}

async function sendViaResend(env, { to, subject, html, text, referenceId, emailType }) {
  const fromEmail = env?.EMAIL_FROM || 'FindCollege.ai <onboarding@resend.dev>';
  const isConfigured = isResendConfigured(env);

  if (!isConfigured) {
    console.log(`[SIMULATED EMAIL - Resend API key pending] To: ${to} | Subject: ${subject}`);
    await logEmail(env, {
      recipient: to,
      emailType,
      referenceId,
      deliveryStatus: 'sent',
      providerMessageId: 'simulated_' + Date.now().toString(36),
      errorMessage: null
    });
    return { success: true, simulated: true, id: 'simulated_' + Date.now().toString(36) };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
        text
      })
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.message || (typeof data === 'string' ? data : JSON.stringify(data));
      console.error('Resend API failed:', errMsg);
      await logEmail(env, {
        recipient: to,
        emailType,
        referenceId,
        deliveryStatus: 'failed',
        providerMessageId: null,
        errorMessage: errMsg
      });
      return { success: false, error: errMsg };
    }

    await logEmail(env, {
      recipient: to,
      emailType,
      referenceId,
      deliveryStatus: 'sent',
      providerMessageId: data.id || null,
      errorMessage: null
    });
    return { success: true, id: data.id };
  } catch (err) {
    console.error('Email dispatch exception:', err.message);
    await logEmail(env, {
      recipient: to,
      emailType,
      referenceId,
      deliveryStatus: 'failed',
      providerMessageId: null,
      errorMessage: err.message
    });
    return { success: false, error: err.message };
  }
}

export async function sendSampleEmail(env, { studentName, email, course, downloadUrl, leadId }) {
  const subject = `Your Free Sample for ${course.course_name} — FindCollege.ai`;
  const supportEmail = env?.SUPPORT_EMAIL || 'support@findcollege.ai';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0728; color: #ffffff; margin: 0; padding: 24px 12px; }
    .card { max-width: 580px; margin: 0 auto; background: #1a0f44; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #27146e 0%, #160a45 100%); padding: 32px 28px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .logo { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; }
    .logo span { color: #8c38f4; }
    .body { padding: 32px 28px; line-height: 1.6; color: #e2dbf7; }
    h1 { color: #ffffff; font-size: 22px; margin-top: 0; margin-bottom: 16px; }
    .course-badge { display: inline-block; background: rgba(140, 56, 244, 0.2); border: 1px solid #8c38f4; color: #ffdb3b; padding: 6px 14px; border-radius: 50px; font-size: 13px; font-weight: 700; margin-bottom: 18px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #ffcf11 0%, #ffb800 100%); color: #160a45 !important; font-weight: 800; font-size: 16px; text-decoration: none; padding: 14px 28px; border-radius: 50px; text-align: center; margin: 24px 0; }
    .box { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #8e83be; border-top: 1px solid rgba(255,255,255,0.08); }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">FINDCOLLEGE<span>.AI</span></div>
    </div>
    <div class="body">
      <span class="course-badge">${course.course_name}</span>
      <h1>Hello ${studentName}!</h1>
      <p>Thank you for requesting sample study materials for <strong>${course.course_name}</strong>. Here is your free sample preview containing chapter notes and practice questions.</p>
      
      <div style="text-align: center;">
        <a href="${downloadUrl}" class="btn" target="_blank">📥 Download Free Sample PDF</a>
      </div>

      <div class="box">
        <h4 style="margin: 0 0 8px 0; color: #ffffff;">✨ What's inside the Full Course?</h4>
        <ul style="margin: 0; padding-left: 20px; color: #c4b9ee; font-size: 14px;">
          <li>Complete Chapter-wise Concept Notes & Formula Sheets</li>
          <li>Curated Question Banks with Step-by-Step Solutions</li>
          <li>Topic-based Practice Tests & Full Mock Examinations</li>
          <li>Mind Maps & Quick Revision Summary Sheets</li>
          <li>Lifetime Access with Instant Digital Delivery</li>
        </ul>
      </div>

      <p style="font-size: 13px; color: #a99ed6;">This sample link is secured for your email (${email}). If you ever have any questions, write to us anytime at <a href="mailto:${supportEmail}" style="color: #ffdb3b;">${supportEmail}</a>.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} FindCollege.ai. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

  const text = `Hello ${studentName},\n\nThank you for requesting sample study materials for ${course.course_name}.\n\nDownload your free sample PDF here:\n${downloadUrl}\n\nWhat is inside the full course:\n- Chapter-wise Study Notes\n- Comprehensive Question Banks\n- Topic Tests & Full Mocks\n- Mind Maps & Revision Sheets\n- Lifetime Access\n\nNeed help? Email ${supportEmail}\nFindCollege.ai`;

  return sendViaResend(env, {
    to: email,
    subject,
    html,
    text,
    referenceId: leadId,
    emailType: 'sample'
  });
}

export async function sendCourseDeliveryEmail(env, { studentName, email, course, orderId, paymentId, accessCode, downloadUrl, amountInr }) {
  const subject = 'Your FindCollege.ai Course Materials Are Ready!';
  const supportEmail = env?.SUPPORT_EMAIL || 'support@findcollege.ai';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f0728; color: #ffffff; margin: 0; padding: 24px 12px; }
    .card { max-width: 600px; margin: 0 auto; background: #1a0f44; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #27146e 0%, #160a45 100%); padding: 32px 28px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; }
    .logo span { color: #8c38f4; }
    .body { padding: 32px 28px; line-height: 1.6; color: #e2dbf7; }
    h1 { color: #ffffff; font-size: 24px; margin-top: 0; margin-bottom: 12px; }
    .badge-success { display: inline-block; background: #10b981; color: #042f1f; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: 800; margin-bottom: 16px; text-transform: uppercase; }
    .receipt-box { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 18px; margin: 20px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed rgba(255,255,255,0.08); }
    .receipt-row:last-child { border-bottom: none; font-weight: 700; color: #ffffff; }
    .access-key { background: #2a156e; border: 1px dashed #a855f7; border-radius: 8px; padding: 12px; text-align: center; font-family: monospace; font-size: 18px; font-weight: 800; color: #ffdb3b; letter-spacing: 1.5px; margin: 16px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #ffcf11 0%, #ffb800 100%); color: #160a45 !important; font-weight: 800; font-size: 16px; text-decoration: none; padding: 15px 32px; border-radius: 50px; text-align: center; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #8e83be; border-top: 1px solid rgba(255,255,255,0.08); }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">FINDCOLLEGE<span>.AI</span></div>
    </div>
    <div class="body">
      <span class="badge-success">Payment Verified ✓</span>
      <h1>Congratulations ${studentName}!</h1>
      <p>Your payment of <strong>₹${amountInr}</strong> was successful. You now have <strong>Lifetime Access</strong> to the complete <strong>${course.course_name}</strong> materials.</p>
      
      <div class="receipt-box">
        <div style="font-weight: 700; margin-bottom: 8px; color: #ffffff;">Order Receipt</div>
        <div class="receipt-row"><span>Course</span><span>${course.course_name}</span></div>
        <div class="receipt-row"><span>Order ID</span><span>${orderId}</span></div>
        <div class="receipt-row"><span>Payment ID</span><span>${paymentId || 'Verified'}</span></div>
        <div class="receipt-row"><span>Amount Paid</span><span>₹${amountInr}</span></div>
      </div>

      <div style="margin: 20px 0;">
        <span style="font-size: 13px; color: #a99ed6;">Your Unique Student Access Code:</span>
        <div class="access-key">${accessCode}</div>
      </div>

      <div style="text-align: center;">
        <a href="${downloadUrl}" class="btn" target="_blank">🚀 Download Full Course Materials</a>
      </div>

      <p style="font-size: 13px; color: #c4b9ee; line-height: 1.5;">
        <strong>How to access:</strong> Clicking the button above will securely stream your complete course package. If the download link expires after 24 hours, you can always request a fresh secure link directly from our support team using your registered email and Access Code.
      </p>

      <p style="font-size: 12px; color: #8e83be; margin-top: 24px;">
        For any academic assistance or technical questions, email us at <a href="mailto:${supportEmail}" style="color: #ffdb3b;">${supportEmail}</a>.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} FindCollege.ai. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

  const text = `Congratulations ${studentName}!\n\nYour payment of ₹${amountInr} for ${course.course_name} has been verified.\n\nOrder ID: ${orderId}\nPayment ID: ${paymentId}\nAccess Code: ${accessCode}\n\nDownload your full course materials here:\n${downloadUrl}\n\nLifetime Access is guaranteed for your registered email (${email}).\n\nSupport: ${supportEmail}\nFindCollege.ai`;

  return sendViaResend(env, {
    to: email,
    subject,
    html,
    text,
    referenceId: orderId,
    emailType: 'purchase'
  });
}
