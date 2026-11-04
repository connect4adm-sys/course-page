// functions/api/admin/me.js
// GET /api/admin/me — Verify active admin session

import { requireAdminAuth } from '../../utils/auth.js';

export async function onRequestGet(context) {
  const auth = await requireAdminAuth(context);
  if (!auth.authorized) {
    return auth.response;
  }

  return new Response(JSON.stringify({
    authenticated: true,
    username: auth.user.sub,
    role: auth.user.role
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

