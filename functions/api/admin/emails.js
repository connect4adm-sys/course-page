// functions/api/admin/emails.js
// GET /api/admin/emails — Delivery logs and error tracing

import { requireAdminAuth } from '../../utils/auth.js';
import { getEmailLogsList } from '../../utils/db.js';

export async function onRequestGet(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  const url = new URL(context.request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  try {
    const logs = await getEmailLogsList(context.env, { limit, offset });
    return new Response(JSON.stringify({ success: true, count: logs.length, logs }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    console.error('Error fetching email logs:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Failed to retrieve email logs' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
