// functions/api/razorpay-webhook.js
// POST /api/razorpay-webhook — Authoritative, idempotent webhook handler for Razorpay

import { verifyWebhookSignature } from '../utils/razorpay.js';
import { 
  getOrderByOrderId, 
  updateOrderStatusToPaid, 
  updateOrderDeliveryStatus, 
  createCourseEntitlement, 
  getProductById,
  isWebhookProcessed,
  markWebhookProcessed,
  logEmail
} from '../utils/db.js';
import { generateDownloadToken } from '../utils/storage.js';
import { sendCourseDeliveryEmail, sendAdminPaymentAlertEmail } from '../utils/email.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature) {
      console.warn('Webhook request received without x-razorpay-signature header');
      return new Response(JSON.stringify({ error: 'Missing webhook signature' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 1. Verify webhook signature
    const isValid = await verifyWebhookSignature({ env, rawBody, signature });
    if (!isValid) {
      console.warn('Invalid Razorpay webhook signature detected');
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const event = JSON.parse(rawBody);
    const eventId = event?.id || `evt_${Date.now()}`;
    const eventType = event?.event || 'unknown';

    // 2. Idempotency Check: Prevent duplicate processing of the same webhook event
    const alreadyProcessed = await isWebhookProcessed(env, eventId);
    if (alreadyProcessed) {
      console.log(`Webhook event ${eventId} already processed. Skipping duplicate.`);
      return new Response(JSON.stringify({ status: 'already_processed' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. Process payment events
    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      const paymentEntity = event?.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || event?.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        const order = await getOrderByOrderId(env, orderId);
        if (order) {
          // If the order was not marked paid yet (e.g. user closed browser before frontend verify completed)
          if (order.payment_status !== 'paid') {
            console.log(`Authoritative fulfillment triggered via webhook for order ${orderId}`);
            
            const courseCode = (order.course_id.split('-')[0] || 'CRSE').toUpperCase();
            const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
            const accessCode = `FCAI-${courseCode}-${randPart}`;

            await updateOrderStatusToPaid(env, order.order_id, paymentId || order.payment_id, accessCode);
            await createCourseEntitlement(env, {
              orderId: order.order_id,
              customerEmail: order.email,
              courseId: order.course_id
            });

            const product = await getProductById(env, order.course_id);
            const bundleKey = product?.full_course_file_keys ? product.full_course_file_keys.trim() : '';

            if (!bundleKey) {
              console.error(`Missing complete course bundle file key for course ${order.course_id} on webhook`);
              await updateOrderDeliveryStatus(env, order.order_id, 'failed');
              await logEmail(env, {
                recipient: order.email,
                emailType: 'purchase',
                referenceId: order.order_id,
                deliveryStatus: 'failed',
                errorMessage: `Admin Alert: Missing complete bundle assignment for paid course ${order.course_id} on webhook. Payment verified, delivery pending admin upload.`
              });
            } else {
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
              const amountInr = Math.round(order.amount_paise / 100);

              const emailRes = await sendCourseDeliveryEmail(env, {
                studentName: order.student_name,
                email: order.email,
                phone: order.phone,
                course: product,
                orderId: order.order_id,
                paymentId,
                accessCode,
                downloadUrl,
                amountInr
              });

              if (emailRes.success) {
                await updateOrderDeliveryStatus(env, order.order_id, 'sent');
              } else {
                await updateOrderDeliveryStatus(env, order.order_id, 'failed');
              }

              // Instant notification to Admin
              try {
                await sendAdminPaymentAlertEmail(env, {
                  studentName: order.student_name,
                  email: order.email,
                  phone: order.phone,
                  course: product,
                  orderId: order.order_id,
                  paymentId,
                  accessCode,
                  amountInr
                });
              } catch (adminErr) {
                console.warn('Webhook admin alert error:', adminErr.message);
              }
            }
          } else {
            console.log(`Order ${orderId} is already marked paid. No duplicate delivery sent.`);
          }
        } else {
          console.warn(`Webhook received for unknown order: ${orderId}`);
        }
      }
    }

    // 4. Record event as successfully handled
    await markWebhookProcessed(env, eventId, eventType, 'processed', `Event ${eventType} for order ${event?.payload?.payment?.entity?.order_id || 'N/A'}`);

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Unhandled webhook error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

