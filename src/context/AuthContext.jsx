/**
 * AuthContext — global authentication state for ERM Web.
 *
 * Backend endpoints (all under /api/auth/...) and the EXACT shapes
 * they expect, derived from Backend/src/controllers/authController.js:
 *
 *   POST /login           { userId, password }       → { token, user }
 *                         (`userId` can be an email — backend accepts either)
 *   POST /send-otp        { email }                  → { success: true }
 *   POST /verify-otp      { email, otp }             → { success, resetToken? }
 *   POST /reset-password  { email, otp, newPassword }→ { success, message }
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { API } from '../config/api';

const AuthContext = createContext(null);

const KEY_USER  = 'erm_web_user';
const KEY_TOKEN = 'erm_web_token';

// ─── Global fetch interceptor ────────────────────────────────────────
// Wrap window.fetch ONCE so every request from anywhere in the app
// carries the JWT in the Authorization header. Idempotent — re-running
// (e.g. after login) doesn't stack wrappers, it just re-binds the token.
let _originalFetch = null;
function installFetchInterceptor(token) {
  if (typeof window === 'undefined') return;
  if (!_originalFetch) _originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const headers = new Headers(
      init.headers || (typeof input !== 'string' ? input.headers : undefined) || {}
    );
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return _originalFetch(input, { ...init, headers });
  };
}

function persistAuth(user, token) {
  try {
    if (user)  localStorage.setItem(KEY_USER,  JSON.stringify(user));
    if (token) localStorage.setItem(KEY_TOKEN, token);
  } catch { /* storage disabled — non-fatal */ }
  installFetchInterceptor(token);
}
function clearAuth() {
  try {
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_TOKEN);
  } catch { /* */ }
  installFetchInterceptor('');
}
function readStoredUser() {
  try {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function readStoredToken() {
  try { return localStorage.getItem(KEY_TOKEN) || ''; }
  catch { return ''; }
}

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on first mount so a refresh doesn't
  // immediately bounce the user back to /login.
  useEffect(() => {
    const u = readStoredUser();
    const t = readStoredToken();
    if (u && t) {
      setUser(u);
      installFetchInterceptor(t);
    }
    setLoading(false);
  }, []);

  /**
   * POST /api/auth/login
   *
   * Backend expects `{ userId, password }` where userId may contain an
   * email or the employee's TES047-style ID — the controller looks up
   * by both. We always pass the entered email/ID through `userId`.
   */
  const login = async (emailOrId, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        userId:   String(emailOrId || '').trim(),
        password,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.message || `Login failed (HTTP ${res.status})`);
    }
    const token = data.token || data?.data?.token || '';
    const u     = data.user  || data?.data?.user  || null;
    if (!token) throw new Error('Login succeeded but no token was returned.');
    persistAuth(u, token);
    setUser(u);
    return u;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  /**
   * POST /api/auth/send-otp
   *
   * Backend accepts ANY email (lenient) and emails an OTP via SendGrid.
   *
   * If SendGrid is broken in a dev environment, the backend returns
   * `success: true` along with `devOtp` in the response body — we
   * pass that through to the caller so the OTP screen can auto-fill it.
   */
  const forgotPassword = async (email) => {
    const res = await fetch(`${API}/auth/send-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: String(email || '').trim().toLowerCase() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Could not send OTP (HTTP ${res.status})`);
    // Return whatever the backend gave us; the OTP screen looks for `devOtp`.
    return data;
  };

  /** POST /api/auth/verify-otp */
  const verifyOtp = async (email, otp) => {
    const res = await fetch(`${API}/auth/verify-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        email: String(email || '').trim().toLowerCase(),
        otp,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `OTP verification failed (HTTP ${res.status})`);
    return data;
  };

  /**
   * POST /api/auth/reset-password
   *
   * Backend signature: { resetToken, newPassword }
   * The resetToken is returned by /verify-otp on success — we get it from
   * the caller (the OTP screen captures it and threads it to the
   * SetPasswordScreen via Auth.jsx state).
   */
  const resetPassword = async (resetToken, newPassword) => {
    if (!resetToken) throw new Error('No reset token — please verify the OTP first.');
    const res = await fetch(`${API}/auth/reset-password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ resetToken, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Could not reset password (HTTP ${res.status})`);
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        forgotPassword,
        verifyOtp,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
