// ─────────────────────────────────────────────────────────────────────────────
// security.js — client-side security utilities
//
// These are the last line of client-side defence. Real enforcement is done
// at the DB layer via RLS policies and SECURITY DEFINER functions.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Input sanitization ─────────────────────────────────────────────────────

/**
 * Strip HTML tags and dangerous characters from a string.
 * Prevents stored XSS when user input is rendered directly.
 */
export const sanitizeText = (str = '') =>
  String(str)
    .replace(/<[^>]*>/g, '')          // strip HTML tags
    .replace(/javascript:/gi, '')     // kill JS protocol
    .replace(/on\w+=/gi, '')          // strip inline event handlers
    .trim();

/**
 * Sanitize an entire object's string values (shallow).
 * Use before sending form data to Supabase.
 */
export const sanitizeObject = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? sanitizeText(v) : v])
  );

/**
 * Validate and sanitize an email address.
 * Returns the lowercased, trimmed email or throws.
 */
export const validateAndSanitizeEmail = (email = '') => {
  const clean = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new Error('Invalid email address.');
  }
  return clean;
};

// ── 2. Client-side rate limiter ───────────────────────────────────────────────

/**
 * Simple in-memory rate limiter.
 * Prevents rapid repeated actions (e.g. spam-clicking "Send Invite").
 *
 * Usage:
 *   const limiter = createRateLimiter(5, 60_000); // 5 calls per 60s
 *   if (!limiter.allow('invite')) throw new Error('Too many requests');
 */
export const createRateLimiter = (maxCalls = 5, windowMs = 60_000) => {
  const calls = {};

  return {
    allow(key) {
      const now = Date.now();
      if (!calls[key]) calls[key] = [];

      // Purge old entries outside the window
      calls[key] = calls[key].filter((ts) => now - ts < windowMs);

      if (calls[key].length >= maxCalls) return false;

      calls[key].push(now);
      return true;
    },
    reset(key) {
      delete calls[key];
    },
  };
};

// Shared rate limiters — import these in components
export const inviteLimiter = createRateLimiter(5, 60_000);  // 5 invites / min
export const commentLimiter = createRateLimiter(20, 60_000);  // 20 comments / min
export const uploadLimiter = createRateLimiter(10, 60_000);  // 10 uploads / min
export const authLimiter = createRateLimiter(5, 300_000); // 5 login attempts / 5 min

// ── 3. Content Security Policy meta-tag helper ────────────────────────────────

/**
 * Inject a Content-Security-Policy meta tag into <head>.
 * Call once in main.jsx.
 *
 * NOTE: A proper CSP header at the server/CDN level is always preferred.
 * This is a best-effort client-side supplement.
 */
export const injectCSPMeta = () => {
  if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return;

  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' blob: https://checkout.razorpay.com",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${import.meta.env?.VITE_SUPABASE_URL || ''} https://*.supabase.co wss://*.supabase.co https://api.brevo.com`,
    "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
    "frame-src 'none'",
    "object-src 'none'",
  ].join('; ');

  document.head.appendChild(meta);
};

// ── 4. Secure paste handler ──────────────────────────────────────────────────

/**
 * Strips HTML from paste events — use as onPaste on <input> / <textarea>.
 * Prevents paste-based XSS.
 */
export const securePasteHandler = (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, sanitizeText(text));
};

// ── 5. Token utilities ────────────────────────────────────────────────────────

/**
 * Check if a JWT is expired (client-side, no signature verification).
 * @param {string} token  Raw JWT string
 * @returns {boolean}
 */
export const isTokenExpired = (token) => {
  try {
    const [, payload] = token.split('.');
    const { exp } = JSON.parse(atob(payload));
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
};
