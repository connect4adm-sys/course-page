// functions/api/admin/dashboard.js
// GET /api/admin/dashboard — Real-time metrics overview with date filtering

import { requireAdminAuth } from '../../utils/auth.js';
import { getDashboardMetrics } from '../../utils/db.js';

export async function onRequestGet(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  const url = new URL(context.request.url);
  const filter = url.searchParams.get('filter') || 'all';

  try {
    const metrics = await getDashboardMetrics(context.env, filter);
    return new Response(JSON.stringify({ success: true, filter, metrics }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    console.error('Error compiling dashboard metrics:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Failed to compute dashboard metrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

