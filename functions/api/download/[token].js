// functions/api/download/[token].js
// GET /api/download/:token — Secure tokenized expiring file streaming

import { resolveFileDownload } from '../../utils/storage.js';

export async function onRequestGet(context) {
  const { params, env } = context;
  const token = params.token;

  try {
    const result = await resolveFileDownload(env, token);

    if (result.error) {
      return new Response(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Download Link Error — FindCollege.ai</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f0728; color: #fff; text-align: center; padding: 60px 20px; }
    .box { max-width: 480px; margin: 0 auto; background: #1b1049; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 32px; }
    h2 { color: #f87171; margin-top: 0; }
    p { color: #cbd5e1; font-size: 15px; line-height: 1.5; }
    a { color: #ffdb3b; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box">
    <h2>⚠️ Access Restricted</h2>
    <p>${result.error}</p>
    <p style="margin-top: 24px;"><a href="/">← Return to FindCollege.ai</a></p>
  </div>
</body>
</html>
`, {
        status: result.status || 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return result.response;
  } catch (err) {
    console.error('Error handling download token:', err.message);
    return new Response('An unexpected error occurred during download processing', { status: 500 });
  }
}
