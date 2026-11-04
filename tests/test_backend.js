// test_backend.js
// Comprehensive test suite for FindCollege.ai Backend, Strict File Delivery, and Admin Security

import { validateStudentName, validateEmail, validatePhone, validateCourseId, checkHoneypot } from '../functions/utils/validation.js';
import { onRequestGet as getCourses } from '../functions/api/courses.js';
import { onRequestPost as postSampleRequest } from '../functions/api/sample-request.js';
import { onRequestPost as postCreateOrder } from '../functions/api/create-order.js';
import { onRequestPost as postVerifyPayment } from '../functions/api/verify-payment.js';
import { onRequestPost as postWebhook } from '../functions/api/razorpay-webhook.js';
import { onRequestGet as getDownload } from '../functions/api/download/[token].js';
import { onRequestPost as adminSetup, onRequestGet as getAdminSetup } from '../functions/api/admin/setup.js';
import { onRequestPost as adminLogin } from '../functions/api/admin/login.js';
import { onRequestGet as adminDashboard } from '../functions/api/admin/dashboard.js';
import { onRequestGet as adminLeads } from '../functions/api/admin/leads.js';
import { onRequestGet as adminOrders } from '../functions/api/admin/orders.js';
import { onRequestGet as adminProducts, onRequestPut as updateProduct } from '../functions/api/admin/products.js';
import { onRequestGet as adminSettings } from '../functions/api/admin/settings.js';
import { createAdminJwt } from '../functions/utils/auth.js';
import { getProductById, updateProduct as dbUpdateProduct, getOrderByOrderId } from '../functions/utils/db.js';

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
  console.log('\n======================================================');
  console.log('--- 1. Validation & Honeypot Bot Prevention ---');
  console.log('======================================================');
  assert(validateStudentName('Aarav Sharma').valid, 'Valid student name accepted');
  assert(!validateStudentName('A').valid, 'Single character name rejected');
  assert(!validateStudentName('<script>alert(1)</script>').valid, 'Suspicious script injection rejected');
  assert(validateEmail('student@example.com').valid, 'Valid email accepted');
  assert(!validateEmail('invalid-email').valid, 'Invalid email rejected');
  assert(validatePhone('9876543210').valid, 'Valid 10-digit Indian phone accepted');
  assert(validatePhone('+91 9876543210').valid, 'International format Indian phone accepted');
  assert(!validatePhone('1234567890').valid, 'Invalid Indian mobile prefix (1xxx) rejected');
  assert(!validatePhone('98765').valid, 'Short phone rejected');
  assert(validateCourseId('jee-full').valid, 'Valid course ID jee-full accepted');
  assert(validateCourseId('neet-full').valid, 'Valid course ID neet-full accepted');
  assert(validateCourseId('foundation-9-10').valid, 'Valid course ID foundation-9-10 accepted');
  assert(validateCourseId('junior-6-8').valid, 'Valid course ID junior-6-8 accepted');
  assert(!validateCourseId('unauthorized-course').valid, 'Unknown course ID rejected');
  assert(checkHoneypot('spam_bot_input'), 'Honeypot detects automated bot filler');
  assert(!checkHoneypot(''), 'Clean honeypot accepted');

  const mockEnv = {
    COMPANY_NAME: 'FindCollege.ai',
    CURRENCY: 'INR',
    SUPPORT_EMAIL: 'support@findcollege.ai',
    EMAIL_FROM: 'FindCollege.ai <onboarding@resend.dev>',
    ADMIN_USERNAME: 'admin',
    ADMIN_JWT_SECRET: 'test_super_secret_jwt_key_findcollegeai_2026_safe'
  };

  console.log('\n======================================================');
  console.log('--- 2. Public Catalog API & Strict Pricing Verification ---');
  console.log('======================================================');
  const coursesRes = await getCourses({ env: mockEnv });
  const coursesData = await coursesRes.json();
  assert(coursesRes.status === 200, 'GET /api/courses returns HTTP 200');
  assert(coursesData.courses.length === 4, 'Catalog contains exactly 4 approved products');

  const approvedPrices = {
    'jee-full': 499,
    'neet-full': 499,
    'foundation-9-10': 399,
    'junior-6-8': 399
  };

  for (const c of coursesData.courses) {
    assert(c.priceInr === approvedPrices[c.id], `Price for ${c.id} strictly verified at ₹${approvedPrices[c.id]}`);
    assert(c.originalPriceInr === undefined, `No fake originalPriceInr displayed for ${c.id}`);
    assert(c.discountPercent === undefined, `No fake discountPercent displayed for ${c.id}`);
  }

  console.log('\n======================================================');
  console.log('--- 3. Strict Course-to-File Free Sample Delivery ---');
  console.log('======================================================');
  const studentNames = {
    'jee-full': 'Aarav JEE Student',
    'neet-full': 'Diya NEET Student',
    'foundation-9-10': 'Rohan Foundation Student',
    'junior-6-8': 'Ananya Junior Student'
  };

  const expectedSampleFiles = {
    'jee-full': 'samples/jee-full-sample.pdf',
    'neet-full': 'samples/neet-full-sample.pdf',
    'foundation-9-10': 'samples/foundation-9-10-sample.pdf',
    'junior-6-8': 'samples/junior-6-8-sample.pdf'
  };

  for (const [courseId, expectedFile] of Object.entries(expectedSampleFiles)) {
    const sampleReq = new Request('https://findcollege.ai/api/sample-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: studentNames[courseId],
        email: `student_${courseId.replace(/[^a-z0-9]/g, '')}@example.com`,
        phone: '9876543210',
        courseId,
        honeypot: ''
      })
    });
    const sampleRes = await postSampleRequest({ request: sampleReq, env: mockEnv });
    const sampleData = await sampleRes.json();

    assert(sampleRes.status === 200, `Sample request for ${courseId} succeeded (200)`);
    assert(sampleData.success === true, `Sample delivery flagged successful for ${courseId}`);

    const product = await getProductById(mockEnv, courseId);
    assert(product.sample_file_key === expectedFile, `${courseId} is mapped strictly to ${expectedFile}`);
  }

  console.log('\n--- 3B. Negative Sample Delivery Test: Missing File Handling ---');
  // Temporarily unset sample_file_key for junior-6-8 to simulate missing sample file
  await dbUpdateProduct(mockEnv, 'junior-6-8', { sampleFileKey: '' });

  const missingSampleReq = new Request('https://findcollege.ai/api/sample-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Unfortunate Student',
      email: 'unfortunate@example.com',
      phone: '9876543210',
      courseId: 'junior-6-8',
      honeypot: ''
    })
  });
  const missingSampleRes = await postSampleRequest({ request: missingSampleReq, env: mockEnv });
  const missingSampleData = await missingSampleRes.json();

  assert(missingSampleRes.status === 422, 'Sample request without configured file is rejected with HTTP 422');
  assert(missingSampleData.success === false, 'Did not pretend to send missing sample file');
  assert(missingSampleData.message.includes('currently being updated'), 'Informs student honestly without sending unrelated sample');

  // Restore sample file for junior-6-8
  await dbUpdateProduct(mockEnv, 'junior-6-8', { sampleFileKey: 'samples/junior-6-8-sample.pdf' });

  console.log('\n======================================================');
  console.log('--- 4. Strict Course-to-File Paid Course Delivery ---');
  console.log('======================================================');
  const expectedBundleFiles = {
    'jee-full': 'courses/jee-full-bundle.zip',
    'neet-full': 'courses/neet-full-bundle.zip',
    'foundation-9-10': 'courses/foundation-9-10-bundle.zip',
    'junior-6-8': 'courses/junior-6-8-bundle.zip'
  };

  const createdOrders = {};

  for (const [courseId, expectedBundle] of Object.entries(expectedBundleFiles)) {
    // 1. Create order
    const orderReq = new Request('https://findcollege.ai/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: studentNames[courseId],
        email: `buyer_${courseId.replace(/[^a-z0-9]/g, '')}@example.com`,
        phone: '9812345678',
        courseId,
        tamperedPrice: 1 // Malicious client attempt to pay ₹1
      })
    });
    const orderRes = await postCreateOrder({ request: orderReq, env: mockEnv });
    const orderData = await orderRes.json();
    createdOrders[courseId] = orderData.orderId;

    assert(orderRes.status === 200, `Order created for ${courseId}`);
    assert(orderData.amount === approvedPrices[courseId] * 100, `Price strictly enforced at ${approvedPrices[courseId] * 100} paise, tampering ignored`);

    // 2. Verify payment
    const verifyReq = new Request('https://findcollege.ai/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: 'pay_test_' + courseId.replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36),
        razorpay_signature: 'test_demo_sig',
        is_demo: true
      })
    });
    const verifyRes = await postVerifyPayment({ request: verifyReq, env: mockEnv });
    const verifyData = await verifyRes.json();

    assert(verifyRes.status === 200, `Payment verified for ${courseId}`);
    assert(verifyData.verified === true, `Payment verified flag is true`);
    assert(Boolean(verifyData.accessCode), `Access Code issued: ${verifyData.accessCode}`);

    // Verify order record in database is marked paid and assigned to exact course
    const orderInDb = await getOrderByOrderId(mockEnv, orderData.orderId);
    assert(orderInDb && orderInDb.payment_status === 'paid', `Order ${orderData.orderId} marked paid in DB`);
    assert(orderInDb && orderInDb.course_id === courseId, `Order in DB strictly matches purchased course ${courseId}`);
    assert(orderInDb && orderInDb.delivery_status === 'sent', `Delivery status is marked sent for ${courseId}`);

    const productInDb = await getProductById(mockEnv, courseId);
    assert(productInDb.full_course_file_keys === expectedBundle, `Product mapping in DB strictly points to ${expectedBundle}`);
  }

  console.log('\n--- 4B. Negative Paid Delivery Test: Missing Course Bundle Handling ---');
  // Temporarily unset full_course_file_keys for foundation-9-10
  await dbUpdateProduct(mockEnv, 'foundation-9-10', { fullCourseFileKeys: '' });

  const fOrderReq = new Request('https://findcollege.ai/api/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Foundation Candidate',
      email: 'foundation_test@example.com',
      phone: '9812345678',
      courseId: 'foundation-9-10'
    })
  });
  const fOrderRes = await postCreateOrder({ request: fOrderReq, env: mockEnv });
  const fOrderData = await fOrderRes.json();

  const fVerifyReq = new Request('https://findcollege.ai/api/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: fOrderData.orderId,
      razorpay_payment_id: 'pay_test_missing_bundle',
      razorpay_signature: 'test_demo_sig',
      is_demo: true
    })
  });
  const fVerifyRes = await postVerifyPayment({ request: fVerifyReq, env: mockEnv });
  const fVerifyData = await fVerifyRes.json();

  assert(fVerifyRes.status === 200, 'Payment verification returns 200 to acknowledge transaction');
  assert(fVerifyData.verified === true, 'Payment record is preserved as authentic');
  assert(fVerifyData.deliveryPending === true, 'Delivery is flagged as pending due to missing bundle');

  const fOrderDb = await getOrderByOrderId(mockEnv, fOrderData.orderId);
  assert(fOrderDb && fOrderDb.payment_status === 'paid', 'Order marked paid even when bundle file was missing');
  assert(fOrderDb && fOrderDb.delivery_status === 'failed', 'Delivery status is logged as failed, never fake success');

  // Restore bundle file
  await dbUpdateProduct(mockEnv, 'foundation-9-10', { fullCourseFileKeys: 'courses/foundation-9-10-bundle.zip' });

  console.log('\n======================================================');
  console.log('--- 5. Admin Security: Password-Only Authentication ---');
  console.log('======================================================');
  // 1. Missing password rejected
  const emptyLoginReq = new Request('https://findcollege.ai/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: '' })
  });
  const emptyLoginRes = await adminLogin({ request: emptyLoginReq, env: mockEnv });
  assert(emptyLoginRes.status === 400, 'Missing password rejected with HTTP 400');

  // 2. Wrong password rejected
  const wrongLoginReq = new Request('https://findcollege.ai/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'WrongPasswordXYZ' })
  });
  const wrongLoginRes = await adminLogin({ request: wrongLoginReq, env: mockEnv });
  assert(wrongLoginRes.status === 401, 'Incorrect password rejected with HTTP 401');

  // 3. Password-only login with standard configured password: Course@2026
  const goodLoginReq = new Request('https://findcollege.ai/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'Course@2026' })
  });
  const goodLoginRes = await adminLogin({ request: goodLoginReq, env: mockEnv });
  const goodLoginData = await goodLoginRes.json();
  assert(goodLoginRes.status === 200, 'Password-only login succeeds with HTTP 200');
  assert(goodLoginData.success === true, 'Admin login reports success without needing username');
  assert(goodLoginRes.headers.get('set-cookie')?.includes('fcai_admin_token='), 'HttpOnly auth cookie is issued');

  // 4. Custom password via env.ADMIN_PASSWORD
  const customEnv = { ...mockEnv, ADMIN_PASSWORD: 'MyCustomSuperSecret999#' };
  const customLoginReq = new Request('https://findcollege.ai/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'MyCustomSuperSecret999#' })
  });
  const customLoginRes = await adminLogin({ request: customLoginReq, env: customEnv });
  assert(customLoginRes.status === 200, 'Custom password via env.ADMIN_PASSWORD succeeds');

  // 5. Admin Products API verification with session
  const adminToken = await createAdminJwt('admin', mockEnv.ADMIN_JWT_SECRET);
  const productsReq = new Request('https://findcollege.ai/api/admin/products', {
    headers: { 'Cookie': `fcai_admin_token=${adminToken}` }
  });
  const productsRes = await adminProducts({ request: productsReq, env: mockEnv });
  const productsData = await productsRes.json();
  assert(productsRes.status === 200, 'Admin products endpoint accessible with session');
  assert(productsData.products.every(p => p.sampleStatus === 'configured' && p.bundleStatus === 'configured'), 'All 4 courses report both Sample and Full Course as configured');

  console.log('\n======================================================');
  console.log('--- 6. Razorpay Webhooks HMAC-SHA256 & Replay Protection ---');
  console.log('======================================================');
  const webhookSecret = 'test_webhook_secret_key_123';
  mockEnv.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

  const whPayload = JSON.stringify({
    id: 'evt_test_' + Date.now(),
    event: 'order.paid',
    payload: {
      payment: {
        entity: {
          id: 'pay_wh_' + Date.now(),
          order_id: fOrderData.orderId
        }
      }
    }
  });

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
  assert(validWhRes.status === 200, 'Valid HMAC webhook accepted (HTTP 200)');

  // Replay attempt
  const replayWhReq = new Request('https://findcollege.ai/api/razorpay-webhook', {
    method: 'POST',
    headers: { 'x-razorpay-signature': validWhSig },
    body: whPayload
  });
  const replayWhRes = await postWebhook({ request: replayWhReq, env: mockEnv });
  const replayWhData = await replayWhRes.json();
  assert(replayWhData.status === 'already_processed', 'Duplicate webhook event rejected idempotently');

  console.log(`\n======================================================`);
  console.log(`Test Suite Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
