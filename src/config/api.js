/**
 * Central API base URL for the ERM Web frontend.
 *
 * Read once from the Vite env at build time, then normalised so the
 * rest of the codebase can just write `${API}/auth/login` without
 * worrying about trailing slashes or whether the operator remembered
 * to append `/api` to VITE_API_URL.
 */
function normalizeApiBase(raw) {
  const fallback = 'http://localhost:5001/api';
  const value = (raw && String(raw).trim()) || fallback;
  const trimmed = value.replace(/\/+$/, '');
  return /\/api$/i.test(trimmed) ? trimmed : trimmed + '/api';
}

export const API = normalizeApiBase(import.meta.env.VITE_API_URL);

if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[ERM Web] API base URL →', API);
}
