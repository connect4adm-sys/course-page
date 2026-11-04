// functions/api/admin/logout.js
// POST /api/admin/logout — Invalidate admin session cookie

export async function onRequestPost(context) {
  const { request } = context;
  const isLocalhost = request.url.includes('localhost') || request.url.includes('127.0.0.1');
  const secureFlag = isLocalhost ? '' : 'Secure; ';

  const cookieHeader = `fcai_admin_token=; HttpOnly; ${secureFlag}SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

  return new Response(JSON.stringify({ success: true, message: 'Logged out successfully' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }
  });
}
