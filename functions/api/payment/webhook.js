// functions/api/payment/webhook.js
// POST /api/payment/webhook — Official Razorpay Webhook endpoint configured in dashboard
// Delegates directly to authoritative razorpay-webhook handler

export { onRequestPost } from '../razorpay-webhook.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Razorpay-Signature'
    }
  });
}
