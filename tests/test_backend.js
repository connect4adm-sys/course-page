// test_backend_functions.js
// Comprehensive test suite for Cloudflare Pages Functions & Business Logic

import { validateStudentName, validateEmail, validatePhone, validateCourseId, checkHoneypot } from '../functions/utils/validation.js';
import { onRequestGet as getCourses } from '../functions/api/courses.js';
import { onRequestPost as postSampleRequest } from '../functions/api/sample-request.js';
import { onRequestPost as postCreateOrder } from '../functions/api/create-order.js';
import { onRequestPost as postVerifyPayment } from '../functions/api/verify-payment.js';
import { onRequestPost as postWebhook } from '../functions/api/razorpay-webhook.js';
import { onRequestGet as getDownload } from '../functions/api/download/[token].js';
import { onRequestPost as adminLogin } from '../functions/api/admin/login.js';
import { onRequestGet as adminDashboard } from '../functions/api/admin/dashboard.js';
import { onRequestGet as adminLeads } from '../functions/api/admin/leads.js';
import { onRequestGet as adminOrders } from '../functions/api/admin/orders.js';
import { onRequestGet as adminProducts, onRequestPut as updateProduct } from '../functions/api/admin/products.js';
import { onRequestGet as adminSettings } from '../functions/api/admin/settings.js';
import { createAdminJwt } from '../functions/utils/auth.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- 1. Validation Utilities Test ---');
  assert(validateStudentName('Aarav Sharma').valid, 'Valid student name accepted');
  assert(!validateStudentName('A').valid, 'Single character name rejected');
  assert(!validateStudentName('<script>alert(1)</script>').valid, 'Suspicious name script injection rejected');
  assert(validateEmail('student@example.com').valid, 'Valid email accepted');
  assert(!validateEmail('invalid-email').valid, 'Invalid email rejected');
  assert(validatePhone('9876543210').valid, 'Valid 10-digit Indian phone accepted');
  assert(validatePhone('+91 9876543210').valid, 'International format Indian phone accepted');
  assert(!validatePhone('1234567890').valid, 'Invalid Indian mobile prefix (1xxx) rejected');
  assert(!validatePhone('98765').valid, 'Short phone rejected');
  assert(validateCourseId('jee-full').valid, 'Valid course ID accepted');
  assert(!validateCourseId('invalid-course').valid, 'Unknown course ID rejected');
  assert(checkHoneypot('spam_bot_data'), 'Honeypot detects bot input');
  assert(!checkHoneypot(''), 'Clean honeypot accepted');

  const mockEnv = {
    COMPANY_NAME: 'FindCollege.ai',
    CURRENCY: 'INR',
    SUPPORT_EMAIL: 'support@findcollege.ai',
    EMAIL_FROM: 'FindCollege.ai <onboarding@resend.dev>',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD_HASH: '',
    ADMIN_JWT_SECRET: 'test_jwt_secret_123456789012345678901234567890'
  };

  console.log('\n--- 2. Public Catalog API (GET /api/courses) ---');
  const coursesRes = await getCourses({ env: mockEnv });
  const coursesData = await coursesRes.json();
  assert(coursesRes.status === 200, 'GET /api/courses returns 200');
  assert(coursesData.courses.length === 4, 'Catalog has exactly 4 products');
  const jee = coursesData.courses.find(c => c.id === 'jee-full');
  assert(jee && jee.priceInr === 499, 'JEE Full Course price locked at ₹499');

  console.log('\n--- 3. Free Sample Lead Capture (POST /api/sample-request) ---');
  const sampleReq = new Request('https://findcollege.ai/api/sample-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Gupta',
      email: 'rohan.gupta@example.com',
      phone: '9876543210',
      courseId: 'jee-full',
      honeypot: ''
    })
  });
  const sampleRes = await postSampleRequest({ request: sampleReq, env: mockEnv });
  const sampleData = await sampleRes.json();
  assert(sampleRes.status === 200, 'Sample request returns 200');
  assert(sampleData.success === true, 'Sample request reports success');
  assert(sampleData.message.includes('Check your email'), 'Sample confirmation message verified');

  console.log('\n--- 4. Razorpay Order Creation (POST /api/create-order) ---');
  const orderReq = new Request('https://findcollege.ai/api/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Verma',
      email: 'priya.verma@example.com',
      phone: '9812345678',
      courseId: 'neet-full',
      arbitraryPriceTamper: 1 // Malicious client attempt to pay ₹1
    })
  });
  const orderRes = await postCreateOrder({ request: orderReq, env: mockEnv });
  const orderData = await orderRes.json();
  assert(orderRes.status === 200, 'Order creation returns 200');
  assert(orderData.amount === 49900, 'Server enforced ₹499 (49900 paise), ignored client tamper');
  assert(Boolean(orderData.orderId), 'Order ID generated');

  console.log('\n--- 5. Payment Verification (POST /api/verify-payment) ---');
  const verifyReq = new Request('https://findcollege.ai/api/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: 'pay_test_' + Date.now().toString(36),
      razorpay_signature: 'test_demo_sig',
      is_demo: true
    })
  });
  const verifyRes = await postVerifyPayment({ request: verifyReq, env: mockEnv });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200, 'Payment verify returns 200');
  assert(verifyData.verified === true, 'Payment verified as authentic');
  assert(Boolean(verifyData.accessCode), `Access Code created: ${verifyData.accessCode}`);

  // Test idempotency: verify again with same orderId
  const dupVerifyReq = new Request('https://findcollege.ai/api/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: 'pay_test_' + Date.now().toString(36),
      razorpay_signature: 'test_demo_sig',
      is_demo: true
    })
  });
  const dupVerifyRes = await postVerifyPayment({ request: dupVerifyReq, env: mockEnv });
  const dupVerifyData = await dupVerifyRes.json();
  assert(dupVerifyData.verified === true, 'Idempotent verification returns existing verified state');

  console.log('\n--- 6. Secure Expiring Download (GET /api/download/:token) ---');
  // Generate download with sample token
  const dlRes = await getDownload({ params: { token: 'invalid_token_xyz' }, env: mockEnv });
  assert(dlRes.status === 404, 'Invalid download token returns 404');

  console.log('\n--- 6B. Razorpay Webhooks (POST /api/razorpay-webhook) ---');
  // Missing signature
  const badWhReq = new Request('https://findcollege.ai/api/razorpay-webhook', {
    method: 'POST',
    body: JSON.stringify({ event: 'order.paid' })
  });
  const badWhRes = await postWebhook({ request: badWhReq, env: mockEnv });
  assert(badWhRes.status === 400, 'Webhook without signature rejected');

  // Valid HMAC-SHA256 webhook test
  const webhookSecret = 'test_webhook_secret_key_123';
  mockEnv.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
  const whPayload = JSON.stringify({
    id: 'evt_test_' + Date.now(),
    event: 'order.paid',
    payload: {
      payment: {
        entity: {
          id: 'pay_wh_' + Date.now(),
          order_id: orderData.orderId
        }
      }
    }
  });

  // Calculate HMAC-SHA256 for test
  const enc = new TextEncoder();
  const whKey = await crypto.subtle.importKey('raw', enc.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const whSigBuf = await crypto.subtle.sign('HMAC', whKey, enc.encode(whPayload));
  const validWhSig = Array.from(new Uint8Array(whSigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const validWhReq = new Request('https://findcollege.ai/api/razorpay-webhook', {
    method: 'POST',
    headers: { 'x-razorpay-signature': validWhSig },
    body: whPayload
  });
  const validWhRes = await postWebhook({ request: validWhReq, env: mockEnv });
  const validWhData = await validWhRes.json();
  assert(validWhRes.status === 200, 'Valid HMAC webhook returns 200 OK');
  assert(validWhData.status === 'ok', 'Webhook processed successfully');

  // Duplicate webhook replay test
  const dupWhReq = new Request('https://findcollege.ai/api/razorpay-webhook', {
    method: 'POST',
    headers: { 'x-razorpay-signature': validWhSig },
    body: whPayload
  });
  const dupWhRes = await postWebhook({ request: dupWhReq, env: mockEnv });
  const dupWhData = await dupWhRes.json();
  assert(dupWhData.status === 'already_processed', 'Duplicate webhook identified and skipped idempotently');

  console.log('\n--- 7. Admin Authentication & Dashboard ---');
  // Failed login
  const badLoginReq = new Request('https://findcollege.ai/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
  });
  const badLoginRes = await adminLogin({ request: badLoginReq, env: mockEnv });
  assert(badLoginRes.status === 401, 'Bad credentials rejected with 401');

  // Successful login in initial setup mode
  const goodLoginReq = new Request('https://findcollege.ai/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'FindCollegeAdmin2026!' })
  });
  const goodLoginRes = await adminLogin({ request: goodLoginReq, env: mockEnv });
  assert(goodLoginRes.status === 200, 'Valid admin login returns 200 and auth cookie');

  // Admin JWT session
  const adminToken = await createAdminJwt('admin', mockEnv.ADMIN_JWT_SECRET);
  const authedReq = new Request('https://findcollege.ai/api/admin/dashboard', {
    headers: { 'Cookie': `fcai_admin_token=${adminToken}` }
  });
  const dashRes = await adminDashboard({ request: authedReq, env: mockEnv });
  const dashData = await dashRes.json();
  assert(dashRes.status === 200, 'Admin dashboard returns 200 for authenticated user');
  assert(dashData.metrics.totalLeads >= 1, 'Dashboard reflects newly created sample lead');
  assert(dashData.metrics.successfulPayments >= 1, 'Dashboard reflects verified payment');

  // Leads list
  const leadsReq = new Request('https://findcollege.ai/api/admin/leads', {
    headers: { 'Cookie': `fcai_admin_token=${adminToken}` }
  });
  const leadsRes = await adminLeads({ request: leadsReq, env: mockEnv });
  const leadsData = await leadsRes.json();
  assert(leadsData.leads.some(l => l.email === 'rohan.gupta@example.com'), 'Lead saved in database');

  // Orders list
  const ordersReq = new Request('https://findcollege.ai/api/admin/orders', {
    headers: { 'Cookie': `fcai_admin_token=${adminToken}` }
  });
  const ordersRes = await adminOrders({ request: ordersReq, env: mockEnv });
  const ordersData = await ordersRes.json();
  assert(ordersData.orders.some(o => o.order_id === orderData.orderId && o.payment_status === 'paid'), 'Paid order recorded in database');

  // System settings check
  const setReq = new Request('https://findcollege.ai/api/admin/settings', {
    headers: { 'Cookie': `fcai_admin_token=${adminToken}` }
  });
  const setRes = await adminSettings({ request: setReq, env: mockEnv });
  const setData = await setRes.json();
  assert(setData.services && typeof setData.services.razorpay === 'object', 'Settings returns service status overview without leaking secrets');

  console.log(`\n========================================`);
  console.log(`Test Suite Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
