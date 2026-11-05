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

export async function sendCourseDeliveryEmail(env, { studentName, email, phone, course, orderId, paymentId, accessCode, downloadUrl, amountInr }) {
  const subject = `Tax Invoice & Course Materials: ${course.course_name} — FindCollege.ai`;
  const supportEmail = env?.SUPPORT_EMAIL || 'support@findcollege.ai';
  const invoiceNo = `INV-2026-${String(orderId).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
  const invoiceDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const regularPrice = amountInr >= 499 ? 4990 : 3990;
  const discountAmount = regularPrice - amountInr;
  const gstInclusive = Math.round((amountInr * 18) / 118);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0c0520; color: #ffffff; margin: 0; padding: 24px 12px; }
    .card { max-width: 620px; margin: 0 auto; background: #160c38; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #230f60 0%, #15093d 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .logo { font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; }
    .logo span { color: #8c38f4; }
    .body { padding: 28px 24px; line-height: 1.6; color: #e2dbf7; }
    h1 { color: #ffffff; font-size: 22px; margin-top: 0; margin-bottom: 10px; }
    .badge-paid { display: inline-block; background: #10b981; color: #042f1f; padding: 4px 12px; border-radius: 50px; font-size: 11.5px; font-weight: 800; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    
    /* INVOICE STYLES */
    .invoice-card { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,215,0,0.35); border-radius: 12px; padding: 20px; margin: 20px 0; }
    .invoice-header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 14px; }
    .invoice-title { font-size: 16px; font-weight: 800; color: #ffd700; text-transform: uppercase; letter-spacing: 0.5px; }
    .invoice-meta { font-size: 12px; color: #bcaee3; text-align: right; line-height: 1.5; }
    
    .customer-box { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 16px; line-height: 1.5; }
    .customer-col { max-width: 48%; }
    .customer-label { font-size: 11px; text-transform: uppercase; color: #9c8fc2; font-weight: 700; margin-bottom: 4px; }
    
    .invoice-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 14px 0; }
    .invoice-table th { text-align: left; padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.15); color: #bcaee3; font-weight: 600; font-size: 11.5px; text-transform: uppercase; }
    .invoice-table td { padding: 9px 6px; border-bottom: 1px dashed rgba(255,255,255,0.08); }
    .text-right { text-align: right; }
    .text-green { color: #34d399; }
    .invoice-total-row { font-weight: 800; font-size: 15px; color: #ffffff; border-top: 1.5px solid rgba(255,215,0,0.5); }
    
    .access-key-box { background: rgba(140,56,244,0.15); border: 1.5px dashed #a855f7; border-radius: 10px; padding: 14px; text-align: center; margin: 20px 0; }
    .access-key { font-family: monospace; font-size: 18px; font-weight: 800; color: #ffd700; letter-spacing: 1.5px; margin-top: 4px; }
    
    .btn-download { display: block; background: linear-gradient(135deg, #ffcf11 0%, #ff9800 100%); color: #160a45 !important; font-weight: 800; font-size: 16px; text-decoration: none; padding: 15px 28px; border-radius: 50px; text-align: center; margin: 24px 0; box-shadow: 0 4px 16px rgba(255,152,0,0.4); }
    .footer { text-align: center; padding: 20px; font-size: 11.5px; color: #8e83be; border-top: 1px solid rgba(255,255,255,0.08); line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">FINDCOLLEGE<span>.AI</span></div>
      <div style="font-size: 11.5px; color: #bcaee3; margin-top: 4px;">Digital Education & Exam Preparation Resources</div>
    </div>
    <div class="body">
      <span class="badge-paid">Payment Verified ✓</span>
      <h1>Congratulations, ${studentName}!</h1>
      <p style="margin-bottom: 18px;">Thank you for your purchase. Your payment has been verified and your complete course materials are unlocked with <strong>Lifetime Access</strong>.</p>
      
      <!-- FORMAL INVOICE CARD -->
      <div class="invoice-card">
        <div class="invoice-header-row">
          <div>
            <div class="invoice-title">Tax Invoice / Receipt</div>
            <div style="font-size: 11.5px; color: #9c8fc2; margin-top: 2px;">Official Proof of Purchase</div>
          </div>
          <div class="invoice-meta">
            <div><strong>Invoice No:</strong> ${invoiceNo}</div>
            <div><strong>Date:</strong> ${invoiceDate}</div>
            <div><strong>Status:</strong> <span style="color: #34d399; font-weight: 700;">PAID</span></div>
          </div>
        </div>

        <div class="customer-box">
          <div class="customer-col">
            <div class="customer-label">Billed To</div>
            <div style="font-weight: 700; color: #fff;">${studentName}</div>
            <div>Email: ${email}</div>
            <div>Phone: ${phone || 'Provided at checkout'}</div>
          </div>
          <div class="customer-col text-right">
            <div class="customer-label">Transaction Reference</div>
            <div><strong>Order ID:</strong> ${orderId}</div>
            <div><strong>Payment ID:</strong> ${paymentId || 'Verified'}</div>
            <div><strong>Mode:</strong> Razorpay Online</div>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Regular</th>
              <th class="text-right">Discount</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong style="color: #fff;">${course.course_name}</strong><br>
                <span style="font-size: 11px; color: #a99ed6;">2026 Complete Study Materials, Notes, Q&amp;A, Tests &amp; Mind Maps</span>
              </td>
              <td class="text-right"><del>₹${regularPrice.toLocaleString('en-IN')}</del></td>
              <td class="text-right text-green">-₹${discountAmount.toLocaleString('en-IN')} (90%)</td>
              <td class="text-right" style="font-weight: 700; color: #fff;">₹${amountInr.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td colspan="3" style="font-size: 11.5px; color: #a99ed6;">Applicable GST (18% Inclusive)</td>
              <td class="text-right" style="font-size: 11.5px; color: #a99ed6;">₹${gstInclusive}</td>
            </tr>
            <tr class="invoice-total-row">
              <td colspan="3" style="padding-top: 10px;">Total Amount Paid</td>
              <td class="text-right" style="padding-top: 10px; color: #ffd700;">₹${amountInr.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
        
        <div style="font-size: 11px; color: #8e83be; margin-top: 6px; text-align: center;">
          This is a computer-generated tax invoice and digital goods receipt.
        </div>
      </div>

      <!-- ACCESS CODE -->
      <div class="access-key-box">
        <span style="font-size: 12.5px; color: #d8b4fe; font-weight: 600;">Your Student Lifetime Access Code:</span>
        <div class="access-key">${accessCode}</div>
      </div>

      <!-- DOWNLOAD BUTTON -->
      <div style="text-align: center;">
        <a href="${downloadUrl}" class="btn-download" target="_blank">🚀 Download Full Course Materials</a>
      </div>

      <p style="font-size: 12.5px; color: #c4b9ee; line-height: 1.5;">
        <strong>How to access:</strong> Click the download button above to securely stream your full package. If your download link expires after 24 hours, you can request a fresh access link anytime using your registered email and Access Code.
      </p>

      <p style="font-size: 12px; color: #8e83be; margin-top: 20px;">
        For any support, reach us at <a href="mailto:${supportEmail}" style="color: #ffdb3b;">${supportEmail}</a>.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} FindCollege.ai. All rights reserved.<br>
      Digital Study Materials Platform • India
    </div>
  </div>
</body>
</html>
`;

  const text = `FindCollege.ai — Tax Invoice & Course Materials
==============================================
Invoice No: ${invoiceNo}
Date: ${invoiceDate}
Status: PAID (₹${amountInr})

Student Name: ${studentName}
Email: ${email}
Phone: ${phone || 'N/A'}
Course: ${course.course_name}
Order ID: ${orderId}
Payment ID: ${paymentId || 'Verified'}
Access Code: ${accessCode}

Regular Price: ₹${regularPrice}
Diwali Discount (90% OFF): -₹${discountAmount}
Amount Paid (GST Inclusive): ₹${amountInr}

Download your course materials:
${downloadUrl}

Support: ${supportEmail}
FindCollege.ai`;

  return sendViaResend(env, {
    to: email,
    subject,
    html,
    text,
    referenceId: orderId,
    emailType: 'purchase'
  });
}

// Instant notification to Admin whenever any user completes payment
export async function sendAdminPaymentAlertEmail(env, { studentName, email, phone, course, orderId, paymentId, accessCode, amountInr }) {
  const adminEmail = env?.ADMIN_NOTIFY_EMAIL || env?.ADMIN_EMAIL || 'kunalpratapsingh1947@gmail.com';
  const subject = `💰 [NEW SALE - ₹${amountInr}] ${course.course_name} — ${studentName}`;
  const invoiceNo = `INV-2026-${String(orderId).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0c0520; color: #fff; padding: 20px;">
  <div style="max-width: 580px; margin: 0 auto; background: #160c38; border: 1px solid rgba(255,215,0,0.4); border-radius: 12px; padding: 24px;">
    <h2 style="color: #ffd700; margin-top: 0;">🎉 New Course Sale Verified!</h2>
    <p>A new customer has successfully completed payment on FindCollege.ai.</p>
    
    <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13.5px; line-height: 1.6;">
      <div><strong>Customer Name:</strong> ${studentName}</div>
      <div><strong>Customer Email:</strong> ${email}</div>
      <div><strong>Customer Phone:</strong> ${phone || 'N/A'}</div>
      <div><strong>Course Purchased:</strong> ${course.course_name}</div>
      <div><strong>Amount Received:</strong> <span style="color: #34d399; font-weight: 800; font-size: 16px;">₹${amountInr}</span></div>
      <div><strong>Invoice Number:</strong> ${invoiceNo}</div>
      <div><strong>Razorpay Order ID:</strong> <code>${orderId}</code></div>
      <div><strong>Payment ID:</strong> <code>${paymentId || 'Verified'}</code></div>
      <div><strong>Access Code:</strong> <code style="color: #ffdb3b;">${accessCode}</code></div>
    </div>
    
    <p style="font-size: 12px; color: #a99ed6;">
      This order has been recorded in the database and the customer has been sent their Tax Invoice and secure download link automatically.
    </p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="${env?.APP_URL || 'https://course-page-17p.pages.dev'}/admin" style="background: #8c38f4; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; display: inline-block;">Open Admin Portal →</a>
    </div>
  </div>
</body>
</html>
`;

  const text = `New Sale Alert - FindCollege.ai
================================
Amount: ₹${amountInr}
Course: ${course.course_name}
Customer: ${studentName} (${email}, ${phone})
Order ID: ${orderId}
Payment ID: ${paymentId}
Access Code: ${accessCode}
Invoice No: ${invoiceNo}`;

  return sendViaResend(env, {
    to: adminEmail,
    subject,
    html,
    text,
    referenceId: orderId,
    emailType: 'admin_alert'
  });
}


