// functions/utils/auth.js
// Cloudflare Pages Functions Admin Authentication (Web Crypto PBKDF2 & HMAC-SHA256 JWT)

const loginAttempts = new Map();

export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const newSaltHex = saltHex || bytesToHex(salt);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  const hashHex = bytesToHex(new Uint8Array(derivedBits));
  return { hash: hashHex, salt: newSaltHex };
}

export async function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = await hashPassword(password, storedSalt);
  return timingSafeEqual(hash, storedHash);
}

export async function createAdminJwt(username, secretKey) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: username,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
  };

  const enc = new TextEncoder();
  const b64Header = base64UrlEncode(JSON.stringify(header));
  const b64Payload = base64UrlEncode(JSON.stringify(payload));
  const data = `${b64Header}.${b64Payload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const b64Signature = base64UrlEncode(new Uint8Array(signature));

  return `${data}.${b64Signature}`;
}

export async function verifyAdminJwt(token, secretKey) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [b64Header, b64Payload, b64Sig] = parts;
  const data = `${b64Header}.${b64Payload}`;
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = base64UrlDecode(b64Sig);
  const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data));
  if (!isValid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(b64Payload)));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

export function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 900000 }); // 15 mins
    return true;
  }
  if (now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 900000 });
    return true;
  }
  if (entry.count >= 5) {
    return false; // Rate limited after 5 failed attempts in 15 mins
  }
  entry.count++;
  return true;
}

export function resetLoginRateLimit(ip) {
  loginAttempts.delete(ip);
}

export function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = {};
  cookieHeader.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k && v) cookies[k] = decodeURIComponent(v);
  });
  return cookies;
}

export async function requireAdminAuth(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const token = cookies['fcai_admin_token'];
  const secretKey = env?.ADMIN_JWT_SECRET || 'fallback_admin_jwt_secret_findcollegeai_2026';

  if (!token) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Unauthorized: Admin login required' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
  }

  const payload = await verifyAdminJwt(token, secretKey);
  if (!payload) {
    return { authorized: false, response: new Response(JSON.stringify({ error: 'Session expired or invalid: Please log in again' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
  }

  return { authorized: true, user: payload };
}

// Helpers
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function base64UrlEncode(data) {
  let str = '';
  if (typeof data === 'string') {
    str = btoa(unescape(encodeURIComponent(data)));
  } else {
    str = btoa(String.fromCharCode(...data));
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
