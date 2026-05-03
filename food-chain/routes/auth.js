import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.js';

const router = new Hono();

/**
 * POST /api/auth/register
 * Body: { username, password }
 *
 * Creates a new user account with username + password only.
 * Email is auto-generated internally — users never see it.
 */
router.post('/register', async (c) => {
  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ message: 'Invalid JSON body' }, 400);
  }

  const { username, password } = body ?? {};

  if (!username) return c.json({ message: 'Missing required field: username' }, 400);
  if (!password) return c.json({ message: 'Missing required field: password' }, 400);
  if (password.length < 6) return c.json({ message: 'Password must be at least 6 characters' }, 400);
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    return c.json({ message: 'Username must be 3–30 characters (letters, numbers, _ or -)' }, 400);
  }

  // Auto-generate internal email from username
  const email = `${username.toLowerCase()}@ecosystem-builder.internal`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  if (error) {
    // Map "already registered" to a friendly message
    if (error.message?.toLowerCase().includes('already registered') ||
        error.status === 422) {
      return c.json({ message: 'Username already taken' }, 409);
    }
    return c.json({ message: error.message }, 400);
  }

  return c.json({
    user: {
      id: data.user.id,
      username: data.user.user_metadata?.username,
    },
    session: data.session ? {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    } : null,
    message: 'Account created',
  }, 201);
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 *
 * Signs in with username and password.
 */
router.post('/login', async (c) => {
  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ message: 'Invalid JSON body' }, 400);
  }

  const { username, password } = body ?? {};

  if (!username) return c.json({ message: 'Missing required field: username' }, 400);
  if (!password) return c.json({ message: 'Missing required field: password' }, 400);

  // Reconstruct the internal email
  const email = `${username.toLowerCase()}@ecosystem-builder.internal`;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return c.json({ message: 'Invalid username or password' }, 401);
  }

  return c.json({
    user: {
      id: data.user.id,
      username: data.user.user_metadata?.username ?? username,
    },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  });
});

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <accessToken>
 *
 * Signs out the current user.
 */
router.post('/logout', async (c) => {
  const token = extractToken(c);
  if (!token) return c.json({ message: 'Not authenticated' }, 401);

  const client = supabase;
  await client.auth.admin; // no-op, just using the token below

  const { error } = await supabase.auth.signOut();
  if (error) return c.json({ message: error.message }, 400);

  return c.json({ message: 'Logged out' });
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <accessToken>
 *
 * Returns the current user's profile.
 */
router.get('/me', async (c) => {
  const token = extractToken(c);
  if (!token) return c.json({ message: 'Not authenticated' }, 401);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return c.json({ message: 'Invalid or expired token' }, 401);

  return c.json({
    id: data.user.id,
    username: data.user.user_metadata?.username,
    createdAt: data.user.created_at,
  });
});

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 *
 * Exchanges a refresh token for a new access token.
 */
router.post('/refresh', async (c) => {
  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ message: 'Invalid JSON body' }, 400);
  }

  const { refreshToken } = body ?? {};
  if (!refreshToken) return c.json({ message: 'Missing required field: refreshToken' }, 400);

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) return c.json({ message: 'Invalid or expired refresh token' }, 401);

  return c.json({
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  });
});

// Helper — extract Bearer token from Authorization header
export function extractToken(c) {
  const header = c.req.header('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export default router;
