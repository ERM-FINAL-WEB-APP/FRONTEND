/**
 * Central API base URL for the ERM Web frontend.
 *
 * Read once from the Vite env at build time, then normalised so the
 * rest of the codebase can just write `${API}/auth/login` without
 * worrying about trailing slashes or whether the operator remembered
 * to append `/api` to VITE_API_URL.
 *
 * MISCONFIG SAFETY (Jun 2026)
 * ──────────────────────────
 * Production hit "Login failed (HTTP 405)" because the deployed bundle
 * was built without VITE_API_URL set — the fallback resolved to the
 * same origin as the frontend (Hostinger static site), so POST
 * /api/auth/login hit the static host and got 405 "Method Not
 * Allowed".  To make this impossible to misdiagnose again:
 *   1. We log the resolved base URL prominently on app load.
 *   2. If the base URL resolves to the same origin as the page (i.e.
 *      VITE_API_URL was empty at build time), we throw a loud warning
 *      and short-circuit fetch calls with a clear error.
 */
function normalizeApiBase(raw) {
  const fallback = 'http://localhost:5001/api';
  const value = (raw && String(raw).trim()) || fallback;
  const trimmed = value.replace(/\/+$/, '');
  return /\/api$/i.test(trimmed) ? trimmed : trimmed + '/api';
}

const RAW_ENV = import.meta.env.VITE_API_URL;
export const API = normalizeApiBase(RAW_ENV);

// Diagnostic: print everything you need to verify the bundle picked
// up the right env at build time. Visible in DevTools → Console on
// any page load.
if (typeof window !== 'undefined') {
  /* eslint-disable no-console */
  console.log('[ERM Web] VITE_API_URL (raw) →', RAW_ENV || '(unset)');
  console.log('[ERM Web] API base URL →', API);

  // Self-check: if the API origin matches the page origin, the bundle
  // is misconfigured. We can't recover from this at runtime (the env
  // is baked in at build time) but we WILL surface a loud banner so
  // the operator knows exactly what to do.
  try {
    const apiOrigin = new URL(API, window.location.href).origin;
    const pageOrigin = window.location.origin;
    if (apiOrigin === pageOrigin) {
      console.error(
        '%c[ERM Web] CRITICAL: API base URL matches the page origin (' + apiOrigin + ').\n' +
        'This bundle was built without VITE_API_URL set, so all API calls are\n' +
        'going to the static host (e.g. Hostinger), which returns 405 / 404.\n' +
        'FIX: set VITE_API_URL=<your Render backend URL> in Frontend/.env\n' +
        '     (or Frontend/.env.production), then run `npm run build` again\n' +
        '     and upload the new dist/ folder.',
        'color:#fff; background:#b91c1c; padding:6px 10px; font-weight:600; font-size:13px;'
      );
    }
  } catch { /* URL parse failed — non-fatal */ }
  /* eslint-enable no-console */
}
