// functions/api/sample-request.js
// POST /api/sample-request — Capture student lead and automatically email sample material

import { validateStudentName, validateEmail, validatePhone, validateCourseId, checkHoneypot } from '../utils/validation.js';
import { getProductById, insertSampleLead, updateLeadEmailStatus } from '../utils/db.js';
import { generateDownloadToken } from '../utils/storage.js';
import { sendSampleEmail } from '../utils/email.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid JSON request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { name, email, phone, courseId, honeypot } = body;

    // 1. Honeypot anti-spam check
    if (checkHoneypot(honeypot)) {
      console.warn('Bot detected via honeypot submission');
      // Return simulated success to avoid tipping off spammers
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Check your email! Your sample study material has been sent successfully.',
        email: email || ''
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Validate inputs
    const nameCheck = validateStudentName(name);
    if (!nameCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: nameCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: emailCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: phoneCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const courseCheck = validateCourseId(courseId);
    if (!courseCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: courseCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const product = await getProductById(env, courseCheck.value);
    if (!product) {
      return new Response(JSON.stringify({ success: false, message: 'Requested course not found in catalog' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || null;
    const userAgent = request.headers.get('user-agent') || null;

    // 3. Save Lead in D1
    const leadId = crypto.randomUUID();
    await insertSampleLead(env, {
      id: leadId,
      courseId: product.id,
      studentName: nameCheck.value,
      phone: phoneCheck.value,
      email: emailCheck.value,
      emailStatus: 'pending',
      ipAddress: clientIp,
      userAgent
    });

    // 4. Generate secure tokenized expiring download link for the sample PDF (valid for 48 hours)
    const { token } = await generateDownloadToken({
      env,
      orderId: 'sample_' + leadId,
      courseId: product.id,
      fileKey: product.sample_file_key || `samples/${product.id}-sample.pdf`,
      customerEmail: emailCheck.value,
      hoursValid: 48
    });

    const reqUrl = new URL(request.url);
    const downloadUrl = `${reqUrl.protocol}//${reqUrl.host}/api/download/${token}`;

    // 5. Send automated sample email via Resend
    const emailResult = await sendSampleEmail(env, {
      studentName: nameCheck.value,
      email: emailCheck.value,
      course: product,
      downloadUrl,
      leadId
    });

    if (emailResult.success) {
      await updateLeadEmailStatus(env, leadId, 'sent');
    } else {
      await updateLeadEmailStatus(env, leadId, 'failed');
      console.warn(`Sample email failed to send to ${emailCheck.value}:`, emailResult.error);
      return new Response(JSON.stringify({
        success: false,
        message: 'We recorded your request, but email delivery temporarily failed. Please retry or contact support.',
        email: emailCheck.value
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Return verified confirmation
    return new Response(JSON.stringify({
      success: true,
      message: 'Check your email! Your sample study material has been sent successfully.',
      email: emailCheck.value,
      courseName: product.course_name
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Unhandled error in /api/sample-request:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Server error processing your sample request. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
