// functions/utils/storage.js
// Cloudflare R2 private storage and expiring tokenized download generator

import { saveDownloadToken, getDownloadToken, incrementDownloadCount } from './db.js';

export function isR2Configured(env) {
  return Boolean(env && env.BUCKET);
}

export async function generateDownloadToken({ env, orderId, courseId, fileKey, customerEmail, hoursValid = 24 }) {
  const randBytes = new Uint8Array(16);
  crypto.getRandomValues(randBytes);
  const randHex = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const token = `fcdl_${Date.now().toString(36)}_${randHex}`;

  const expiresAt = new Date(Date.now() + hoursValid * 3600 * 1000).toISOString();

  await saveDownloadToken(env, {
    token,
    orderId,
    courseId,
    fileKey,
    customerEmail,
    expiresAt
  });

  return { token, expiresAt };
}

export async function resolveFileDownload(env, token) {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid download token', status: 400 };
  }

  const tokenRecord = await getDownloadToken(env, token);
  if (!tokenRecord) {
    return { error: 'Download link is invalid or does not exist', status: 404 };
  }

  const now = Date.now();
  const expiry = new Date(tokenRecord.expires_at).getTime();
  if (now > expiry) {
    return { 
      error: 'This download link has expired for security. Please request a fresh download link from support.', 
      status: 410 
    };
  }

  await incrementDownloadCount(env, token);

  const fileKey = tokenRecord.file_key;
  const isPdf = fileKey.endsWith('.pdf');
  const filename = fileKey.split('/').pop() || 'study-materials.pdf';

  // Check if real R2 bucket is bound and holds the object
  if (isR2Configured(env)) {
    try {
      const object = await env.BUCKET.get(fileKey);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        headers.set('Content-Type', isPdf ? 'application/pdf' : 'application/zip');
        return { response: new Response(object.body, { headers }) };
      }
    } catch (err) {
      console.warn('R2 retrieval exception:', err.message);
    }
  }

  // Fallback demo/preview package for when master course files are being uploaded to R2:
  // Delivers an official branded entitlement certificate / study guide
  const sampleContent = generateFallbackDocument({
    courseId: tokenRecord.course_id,
    customerEmail: tokenRecord.customer_email,
    filename,
    token
  });

  return {
    response: new Response(sampleContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename.replace(/\.pdf|\.zip/, '')}-preview.html"`,
        'Cache-Control': 'no-store'
      }
    })
  };
}

function generateFallbackDocument({ courseId, customerEmail, filename, token }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>FindCollege.ai — Digital Study Material Access</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f0728; color: #fff; padding: 40px 20px; line-height: 1.6; text-align: center; }
    .card { max-width: 650px; margin: 0 auto; background: #1c104c; border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 32px; box-shadow: 0 16px 40px rgba(0,0,0,0.5); text-align: left; }
    h1 { color: #ffdb3b; margin-top: 0; font-size: 24px; }
    .badge { display: inline-block; background: #10b981; color: #042f1f; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: bold; margin-bottom: 16px; }
    .item { background: rgba(255,255,255,0.06); padding: 14px 18px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px; }
    .note { font-size: 13px; color: #bcaef0; margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Verified Entitlement</span>
    <h1>🎓 FindCollege.ai Course Material Access</h1>
    <p>This secure link confirms active access for: <strong>${customerEmail}</strong></p>
    
    <div class="item"><strong>Package:</strong> ${filename}</div>
    <div class="item"><strong>Course:</strong> ${courseId.toUpperCase()}</div>
    <div class="item"><strong>Token:</strong> ${token}</div>

    <p style="margin-top: 20px;">
      Welcome to your study package! Your enrollment is securely verified. To download the high-resolution master study PDF, please upload the master bundle to your Cloudflare R2 bucket as outlined in <code>SETUP_GUIDE.md</code>.
    </p>

    <div class="note">
      Need assistance? Contact our academic team at <strong>support@findcollege.ai</strong>.
    </div>
  </div>
</body>
</html>`;
}

