// functions/api/admin/login.js
// POST /api/admin/login — Rate-limited admin authentication with HttpOnly JWT

import { checkLoginRateLimit, resetLoginRateLimit, verifyPassword, hashPassword, createAdminJwt } from '../../utils/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';

  // 1. Rate limiting
  if (!checkLoginRateLimit(clientIp)) {
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Too many failed login attempts. Please wait 15 minutes before trying again.' 
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ success: false, message: 'Username and password required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const expectedUsername = env?.ADMIN_USERNAME || 'admin';
    const storedHash = env?.ADMIN_PASSWORD_HASH;
    const storedSalt = env?.ADMIN_SALT;

    let isAuthenticated = false;

    // A. Production check with Web Crypto PBKDF2 hash
    if (storedHash && storedSalt && storedHash !== 'generate_with_admin_setup_utility') {
      if (username === expectedUsername) {
        isAuthenticated = await verifyPassword(password, storedHash, storedSalt);
      }
    } else {
      // B. Initial Setup Mode when ADMIN_PASSWORD_HASH is not yet generated
      // Allows default temporary setup password 'FindCollegeAdmin2026!' and warns admin to set custom hash
      if (username === expectedUsername && password === 'FindCollegeAdmin2026!') {
        isAuthenticated = true;
      }
    }

    if (!isAuthenticated) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid admin credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Reset rate limiter on successful authentication
    resetLoginRateLimit(clientIp);

    const secretKey = env?.ADMIN_JWT_SECRET || 'fallback_admin_jwt_secret_findcollegeai_2026';
    const token = await createAdminJwt(username, secretKey);

    const isLocalhost = request.url.includes('localhost') || request.url.includes('127.0.0.1');
    const secureFlag = isLocalhost ? '' : 'Secure; ';
    const cookieHeader = `fcai_admin_token=${token}; HttpOnly; ${secureFlag}SameSite=Strict; Path=/; Max-Age=86400`;

    return new Response(JSON.stringify({
      success: true,
      username,
      message: 'Login successful'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader
      }
    });
  } catch (err) {
    console.error('Admin login error:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Authentication error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
