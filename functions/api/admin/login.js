// functions/api/admin/login.js
// POST /api/admin/login — Rate-limited admin authentication with PBKDF2 & HttpOnly JWT (No default passwords)

import { checkLoginRateLimit, resetLoginRateLimit, verifyPassword, createAdminJwt } from '../../utils/auth.js';
import { getAdminUser, hasAnyAdminUser } from '../../utils/db.js';

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

    const cleanUsername = username.trim();
    const envUser = env?.ADMIN_USERNAME || 'admin';
    const envHash = env?.ADMIN_PASSWORD_HASH;
    const envSalt = env?.ADMIN_SALT;

    let isAuthenticated = false;

    // A. Check Cloudflare environment variables
    if (envHash && envSalt && envHash !== 'generate_with_admin_setup_utility') {
      if (cleanUsername === envUser) {
        isAuthenticated = await verifyPassword(password, envHash, envSalt);
      }
    }

    // B. Check D1 admin_users table
    if (!isAuthenticated) {
      const dbAdmin = await getAdminUser(env, cleanUsername);
      if (dbAdmin && dbAdmin.password_hash && dbAdmin.salt) {
        isAuthenticated = await verifyPassword(password, dbAdmin.password_hash, dbAdmin.salt);
      }
    }

    // C. If no admin account exists in either env or DB, prompt for secure setup
    const hasDbAdmin = await hasAnyAdminUser(env);
    const hasEnvAdmin = Boolean(envHash && envSalt && envHash !== 'generate_with_admin_setup_utility');

    if (!hasDbAdmin && !hasEnvAdmin) {
      return new Response(JSON.stringify({
        success: false,
        needsSetup: true,
        message: 'No administrator account has been initialized yet. Please complete initial setup to create your credentials.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
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
    const token = await createAdminJwt(cleanUsername, secretKey);

    const isLocalhost = request.url.includes('localhost') || request.url.includes('127.0.0.1');
    const secureFlag = isLocalhost ? '' : 'Secure; ';
    const cookieHeader = `fcai_admin_token=${token}; HttpOnly; ${secureFlag}SameSite=Strict; Path=/; Max-Age=86400`;

    return new Response(JSON.stringify({
      success: true,
      username: cleanUsername,
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
