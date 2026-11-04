// functions/api/admin/settings.js
// GET /api/admin/settings — Configuration health check (Secrets never exposed)

import { requireAdminAuth } from '../../utils/auth.js';
import { isRazorpayConfigured } from '../../utils/razorpay.js';
import { isResendConfigured } from '../../utils/email.js';
import { isR2Configured } from '../../utils/storage.js';

export async function onRequestGet(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  const { env } = context;

  const razorpayOk = isRazorpayConfigured(env);
  const webhookOk = Boolean(env?.RAZORPAY_WEBHOOK_SECRET && !env.RAZORPAY_WEBHOOK_SECRET.includes('YourWebhookSecretHere'));
  const resendOk = isResendConfigured(env);
  const d1Ok = Boolean(env?.DB);
  const r2Ok = isR2Configured(env);
  const pixelId = env?.META_PIXEL_ID || '';
  const pixelOk = Boolean(pixelId && pixelId.trim() !== '');

  return new Response(JSON.stringify({
    success: true,
    services: {
      razorpay: {
        configured: razorpayOk,
        status: razorpayOk ? 'Live/Test API Keys Connected' : 'Sandbox Demonstration Mode',
        keyIdPrefix: env?.RAZORPAY_KEY_ID ? env.RAZORPAY_KEY_ID.substring(0, 8) + '...' : 'Not set',
        webhookConfigured: webhookOk
      },
      resend: {
        configured: resendOk,
        status: resendOk ? 'Resend API Key Connected' : 'Simulation Mode (Key Pending)',
        senderEmail: env?.EMAIL_FROM || 'FindCollege.ai <onboarding@resend.dev>'
      },
      databaseD1: {
        configured: d1Ok,
        status: d1Ok ? 'Cloudflare D1 Binding Active' : 'In-Memory Fallback Active'
      },
      storageR2: {
        configured: r2Ok,
        status: r2Ok ? 'Cloudflare R2 Bucket Bound' : 'Secure Token Virtualization Active'
      },
      metaPixel: {
        configured: pixelOk,
        pixelId: pixelOk ? pixelId : null,
        status: pixelOk ? 'Meta Pixel Tracking Active' : 'Pixel ID Pending'
      }
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
