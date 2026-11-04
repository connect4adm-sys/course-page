// functions/api/verify-payment.js
// POST /api/verify-payment — Cryptographic HMAC-SHA256 verification and automatic course fulfillment

import { verifyPaymentSignature } from '../utils/razorpay.js';
import { getOrderByOrderId, updateOrderStatusToPaid, updateOrderDeliveryStatus, createCourseEntitlement, getProductById, logEmail } from '../utils/db.js';
import { generateDownloadToken } from '../utils/storage.js';
import { sendCourseDeliveryEmail } from '../utils/email.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, is_demo } = body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return new Response(JSON.stringify({ success: false, message: 'Missing transaction identifiers' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 1. Retrieve order from database
    const order = await getOrderByOrderId(env, razorpay_order_id);
    if (!order) {
      return new Response(JSON.stringify({ success: false, message: 'Order reference not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Cryptographic signature check
    const isValidSignature = await verifyPaymentSignature({
      env,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      isDemo: Boolean(is_demo || razorpay_order_id.startsWith('order_demo_'))
    });

    if (!isValidSignature) {
      console.warn(`Suspicious payment signature mismatch for order: ${razorpay_order_id}`);
      return new Response(JSON.stringify({ success: false, message: 'Payment signature verification failed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. Idempotency Check: if order is already paid, do not re-send emails or duplicate records
    if (order.payment_status === 'paid') {
      return new Response(JSON.stringify({
        success: true,
        verified: true,
        orderId: order.order_id,
        paymentId: order.payment_id,
        accessCode: order.access_code,
        message: 'Payment already verified! Your course materials have been sent to your email.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Generate unique student access code
    const courseCode = (order.course_id.split('-')[0] || 'CRSE').toUpperCase();
    const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const accessCode = `FCAI-${courseCode}-${randPart}`;

    // 5. Update order to paid in D1
    await updateOrderStatusToPaid(env, order.order_id, razorpay_payment_id, accessCode);

    // 6. Record Course Entitlement in D1
    await createCourseEntitlement(env, {
      orderId: order.order_id,
      customerEmail: order.email,
      courseId: order.course_id
    });

    // 7. Strict Course File Safety Rule: Verify full course bundle is configured in DB for this exact course
    const product = await getProductById(env, order.course_id);
    const bundleKey = product?.full_course_file_keys ? product.full_course_file_keys.trim() : '';

    if (!bundleKey) {
      console.error(`Missing complete course bundle file key for course ${order.course_id}`);
      await updateOrderDeliveryStatus(env, order.order_id, 'failed');
      await logEmail(env, {
        recipient: order.email,
        emailType: 'purchase',
        referenceId: order.order_id,
        deliveryStatus: 'failed',
        errorMessage: `Admin Alert: Missing complete bundle assignment for paid course ${order.course_id}. Payment verified, delivery pending admin upload.`
      });

      return new Response(JSON.stringify({
        success: true,
        verified: true,
        orderId: order.order_id,
        paymentId: razorpay_payment_id,
        accessCode,
        deliveryPending: true,
        message: 'Payment verified! Your course package is being prepared by our academic team and will be delivered shortly to your email.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { token } = await generateDownloadToken({
      env,
      orderId: order.order_id,
      courseId: order.course_id,
      fileKey: bundleKey,
      customerEmail: order.email,
      hoursValid: 24
    });

    const reqUrl = new URL(request.url);
    const downloadUrl = `${reqUrl.protocol}//${reqUrl.host}/api/download/${token}`;

    // 8. Automatic course delivery email via Resend
    const amountInr = Math.round(order.amount_paise / 100);
    const emailRes = await sendCourseDeliveryEmail(env, {
      studentName: order.student_name,
      email: order.email,
      course: product,
      orderId: order.order_id,
      paymentId: razorpay_payment_id,
      accessCode,
      downloadUrl,
      amountInr
    });

    if (emailRes.success) {
      await updateOrderDeliveryStatus(env, order.order_id, 'sent');
    } else {
      await updateOrderDeliveryStatus(env, order.order_id, 'failed');
      console.warn(`Course delivery email failed for paid order ${order.order_id}:`, emailRes.error);
    }

    return new Response(JSON.stringify({
      success: true,
      verified: true,
      orderId: order.order_id,
      paymentId: razorpay_payment_id,
      accessCode,
      message: 'Payment successful! Your course materials have been sent to your email.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Unhandled error in /api/verify-payment:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Server error verifying payment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

