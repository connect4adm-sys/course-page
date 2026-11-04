// functions/api/admin/setup.js
// GET/POST /api/admin/setup — One-time secure admin credential initialization (Zero default passwords)

import { hashPassword, createAdminJwt } from '../../utils/auth.js';
import { getAdminUser, hasAnyAdminUser, createAdminUser } from '../../utils/db.js';

function isSetupAllowed(env) {
  // If ADMIN_PASSWORD_HASH is set via Cloudflare environment variables, setup is already locked
  if (env?.ADMIN_PASSWORD_HASH && env.ADMIN_PASSWORD_HASH !== 'generate_with_admin_setup_utility') {
    return false;
  }
  return true;
}

export async function onRequestGet(context) {
  const { env } = context;

  const envLocked = !isSetupAllowed(env);
  const dbHasAdmin = await hasAnyAdminUser(env);
  const setupAllowed = !envLocked && !dbHasAdmin;

  return new Response(JSON.stringify({
    setupAllowed,
    message: setupAllowed 
      ? 'First-time admin setup is required. Please create your administrator credentials.' 
      : 'Admin account is already configured. Setup is locked.'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const envLocked = !isSetupAllowed(env);
  const dbHasAdmin = await hasAnyAdminUser(env);

  if (envLocked || dbHasAdmin) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Security Alert: Admin setup is locked because an administrator account is already configured.'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { username, password, confirmPassword } = await request.json();

    const cleanUser = (username || '').trim();
    if (cleanUser.length < 3) {
      return new Response(JSON.stringify({ success: false, message: 'Username must be at least 3 characters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!password || password.length < 10) {
      return new Response(JSON.stringify({ success: false, message: 'Password must be at least 10 characters long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Require strong password complexity
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Password must include at least one uppercase letter, one lowercase letter, one digit, and one special character'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (password !== confirmPassword) {
      return new Response(JSON.stringify({ success: false, message: 'Passwords do not match' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash password with PBKDF2-SHA256 (100,000 iterations)
    const { hash, salt } = await hashPassword(password);

    // Save in database
    await createAdminUser(env, {
      username: cleanUser,
      passwordHash: hash,
      salt
    });

    // Create session JWT cookie
    const secretKey = env?.ADMIN_JWT_SECRET || 'fallback_admin_jwt_secret_findcollegeai_2026';
    const token = await createAdminJwt(cleanUser, secretKey);

    const isLocalhost = request.url.includes('localhost') || request.url.includes('127.0.0.1');
    const secureFlag = isLocalhost ? '' : 'Secure; ';
    const cookieHeader = `fcai_admin_token=${token}; HttpOnly; ${secureFlag}SameSite=Strict; Path=/; Max-Age=86400`;

    return new Response(JSON.stringify({
      success: true,
      username: cleanUser,
      message: 'Admin account successfully configured and authenticated'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader
      }
    });
  } catch (err) {
    console.error('Admin setup error:', err.message);
    return new Response(JSON.stringify({ success: false, message: 'Failed to initialize admin credentials' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
