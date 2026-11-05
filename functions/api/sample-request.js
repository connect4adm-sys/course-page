// functions/api/sample-request.js
// POST /api/sample-request — Capture student lead and automatically email sample material

import { validateStudentName, validateEmail, validatePhone, validateCourseId, checkHoneypot } from '../utils/validation.js';
import { getProductById, insertSampleLead, updateLeadEmailStatus, getRecentSampleLead, logEmail } from '../utils/db.js';
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
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Your sample resources have arrived! Please check your email inbox.',
        email: email || ''
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Validate email strictly (only email is required for free sample)
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: emailCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. Validate course ID
    const courseCheck = validateCourseId(courseId);
    if (!courseCheck.valid) {
      return new Response(JSON.stringify({ success: false, message: courseCheck.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const product = await getProductById(env, courseCheck.value);
    if (!product) {
      return new Response(JSON.stringify({ success: false, message: 'Requested resource not found in catalog' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Name & Phone are completely optional for free sample — zero friction!
    let studentName = 'Student';
    if (name && typeof name === 'string' && name.trim().length >= 2) {
      const nameCheck = validateStudentName(name);
      if (nameCheck.valid) studentName = nameCheck.value;
    } else if (emailCheck.value) {
      const prefix = emailCheck.value.split('@')[0];
      if (/^[a-zA-Z]/.test(prefix)) {
        studentName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      }
    }

    let studentPhone = 'N/A';
    if (phone && (typeof phone === 'string' || typeof phone === 'number')) {
      const phoneCheck = validatePhone(phone);
      if (phoneCheck.valid) studentPhone = phoneCheck.value;
    }

    // 4. Rate-limit & duplicate spam protection: prevent repeated clicks for same email + course within 15 mins
    const recentLead = await getRecentSampleLead(env, emailCheck.value, product.id, 15);
    if (recentLead) {
      return new Response(JSON.stringify({
        success: true,
        alreadySent: true,
        message: 'Your sample resources have already arrived! Please check your email inbox.',
        email: emailCheck.value,
        courseName: product.course_name
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || null;
    const userAgent = request.headers.get('user-agent') || null;

    // 5. Save Lead in D1
    const leadId = crypto.randomUUID();
    await insertSampleLead(env, {
      id: leadId,
      courseId: product.id,
      studentName,
      phone: studentPhone,
      email: emailCheck.value,
      emailStatus: 'pending',
      ipAddress: clientIp,
      userAgent
    });

    // 4. Strict File Safety Rule: Verify sample file is configured in DB for this exact course
    const sampleKey = product.sample_file_key ? product.sample_file_key.trim() : '';
    if (!sampleKey) {
      console.error(`Missing sample file configuration for course ${product.id}`);
      await updateLeadEmailStatus(env, leadId, 'failed');
      await logEmail(env, {
        recipient: emailCheck.value,
        emailType: 'sample',
        referenceId: leadId,
        deliveryStatus: 'failed',
        errorMessage: `Admin Alert: Missing sample file assignment for course ${product.id}`
      });
      return new Response(JSON.stringify({
        success: false,
        message: 'Sample study materials for this course are currently being updated by the academic team. Please contact support.',
        email: emailCheck.value
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate secure tokenized expiring download link for this exact course sample PDF only (valid for 48 hours)
    const { token } = await generateDownloadToken({
      env,
      orderId: 'sample_' + leadId,
      courseId: product.id,
      fileKey: sampleKey,
      customerEmail: emailCheck.value,
      hoursValid: 48
    });

    const reqUrl = new URL(request.url);
    const downloadUrl = `${reqUrl.protocol}//${reqUrl.host}/api/download/${token}`;

    // 5. Send automated sample email via Resend
    const emailResult = await sendSampleEmail(env, {
      studentName,
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
      message: 'Your sample resources have arrived! Please check your email inbox.',
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

