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
//
// Session policy: the backend signs the JWT with a 10-day expiry. When
// the token expires (or is otherwise rejected) the next API call comes
// back as 401 — we catch that here, wipe local auth, and force a hard
// reload to /login so React state is fully reset. Skip the auth routes
// themselves so a wrong-password 401 stays a normal form error.
let _originalFetch = null;
let _sessionExpiring = false;
function _isAuthRoute(url) {
  return /\/auth\/(login|send-otp|verify-otp|reset-password|change-password)/i.test(String(url || ''));
}
function _handleSessionExpired() {
  if (_sessionExpiring) return;
  _sessionExpiring = true;
  try {
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_TOKEN);
  } catch { /* */ }
  // Hard-reload to /login so every component remounts with a clean slate.
  // Defer slightly so the in-flight render finishes painting first.
  setTimeout(() => {
    try { window.location.replace('/login'); }
    catch { /* */ }
  }, 50);
}
function installFetchInterceptor(token) {
  if (typeof window === 'undefined') return;
  if (!_originalFetch) _originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const headers = new Headers(
      init.headers || (typeof input !== 'string' ? input.headers : undefined) || {}
    );
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await _originalFetch(input, { ...init, headers });
    // 401 → session has expired. Bounce to login (unless this WAS a
    // login/OTP/reset call, in which case let the form show the error).
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (res && res.status === 401 && !_isAuthRoute(url)) {
      _handleSessionExpired();
    }
    return res;
  };
}

// Pure-client check: decode the JWT payload (no signature verify — the
// server reverifies on every call) and read `exp` to detect expiry
// without making a network round-trip. Used on app hydrate so a stale
// token doesn't even get a chance to fire a 401.
function isJwtExpired(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return true;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const json = atob(b64 + pad);
    const payload = JSON.parse(json);
    if (!payload || typeof payload.exp !== 'number') return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true; // malformed → treat as expired
  }
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
      if (isJwtExpired(t)) {
        // 10-day session window has elapsed — wipe stale auth and let
        // the routes guard send the user to /login.
        clearAuth();
        setUser(null);
      } else {
        setUser(u);
        installFetchInterceptor(t);
      }
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
