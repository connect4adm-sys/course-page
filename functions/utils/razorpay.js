// functions/utils/razorpay.js
// Cloudflare Pages Functions Razorpay helper using Web Crypto API

export function isRazorpayConfigured(env) {
  const keyId = env?.RAZORPAY_KEY_ID || '';
  const keySecret = env?.RAZORPAY_KEY_SECRET || '';
  return Boolean(
    keyId &&
    keySecret &&
    !keyId.includes('YourKeyIdHere') &&
    !keySecret.includes('YourKeySecretHere')
  );
}

export async function createRazorpayOrder({ env, course, studentName, email, phone }) {
  const isConfigured = isRazorpayConfigured(env);
  const amountPaise = course.price_paise;
  const currency = 'INR';
  const receipt = `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  if (isConfigured) {
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`);

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt,
        notes: {
          course_id: course.id,
          course_name: course.course_name,
          student_name: studentName,
          email,
          phone
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Razorpay order creation failed:', data);
      throw new Error(data.error?.description || 'Failed to create Razorpay order');
    }

    return {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId,
      isDemo: false
    };
  }

  // Safe Sandbox Demonstration / Local Testing mode when real keys are pending
  const demoOrderId = 'order_demo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    orderId: demoOrderId,
    amount: amountPaise,
    currency,
    keyId: env?.RAZORPAY_KEY_ID || 'rzp_test_SANDBOX_DEMO',
    isDemo: true
  };
}

export async function verifyPaymentSignature({ env, orderId, paymentId, signature, isDemo = false }) {
  if (isDemo && (!isRazorpayConfigured(env) || orderId.startsWith('order_demo_'))) {
    return true; // Allow safe sandbox checkout demonstration
  }

  const keySecret = env?.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new Error('Razorpay Key Secret is not configured');
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(keySecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const dataToSign = `${orderId}|${paymentId}`;
  const signedBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));
  const expectedSignature = Array.from(new Uint8Array(signedBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(expectedSignature, signature || '');
}

export async function verifyWebhookSignature({ env, rawBody, signature }) {
  const webhookSecret = env?.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('Razorpay Webhook Secret is not configured');
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signedBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expectedSignature = Array.from(new Uint8Array(signedBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(expectedSignature, signature || '');
}

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
