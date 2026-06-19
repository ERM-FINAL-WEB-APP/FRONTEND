import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Mail, Lock, ArrowLeft,
  CheckCircle, ShieldCheck, RefreshCw, AlertCircle, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

/* ═══ Shared Background ════════════════════════════ */
const AuthBackground = () => (
  <div className="auth-bg">
    <div className="auth-bg-glow glow-1" />
    <div className="auth-bg-glow glow-2" />
    <div className="auth-bg-grid" />
    {Array.from({ length: 18 }).map((_, i) => (
      <div key={i} className="auth-particle" style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 6}s`,
        animationDuration: `${4 + Math.random() * 4}s`,
        width: `${3 + Math.random() * 4}px`,
        height: `${3 + Math.random() * 4}px`,
        opacity: 0.15 + Math.random() * 0.3,
      }} />
    ))}
  </div>
);

/* ═══ Logo ══════════════════════════════════════════ */
import ermLogo from '../Assets/ERM_logo.svg';

const TescoLogo = () => (
  <div className="auth-logo">
    <img src={ermLogo} alt="TESCO ERM Logo" style={{ height: '64px' }} />
  </div>
);

/* ═══ Inline error banner ═══════════════════════════ */
const ErrorBanner = ({ message }) => {
  if (!message) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: '#FEF2F2', border: '1px solid #FECACA',
      color: '#991B1B', fontSize: 13, marginBottom: 12,
    }}>
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
};

/* ═══ SCREEN 1 – LOGIN ══════════════════════════════ */
const LoginScreen = ({ onForgotPassword, setSharedEmail }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await login(email, password);
      setSharedEmail(email);
      navigate('/dashboard');
    } catch (err) {
      // Common server messages: "Invalid credentials" (401), "User not found",
      // or network errors. Surface whichever the server sent.
      setError(err?.message || 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card auth-card-enter">
      <TescoLogo />
      <h1 className="auth-title">Sign In to your Account</h1>
      <p className="auth-subtitle">Enter your credentials to log in</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <ErrorBanner message={error} />

        <div className="auth-input-wrap">
          <Mail size={17} className="auth-input-icon" />
          <input
            type="email"
            placeholder="john.doe@tesco.com"
            required
            className="auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="auth-input-wrap">
          <Lock size={17} className="auth-input-icon" />
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Enter password"
            required
            className="auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="button" className="auth-eye" onClick={() => setShowPw(v => !v)}>
            {showPw ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        </div>

        <div className="auth-row">
          <label className="auth-remember">
            <input type="checkbox" /> <span>Remember me</span>
          </label>
          <button
            type="button"
            className="auth-link"
            onClick={() => { setSharedEmail(email); onForgotPassword(); }}
          >
            Forgot Password?
          </button>
        </div>

        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? 'Signing in…' : 'Log In'}
        </button>

        {/* #320 — Privacy Policy link required by Play Store and a
            standard trust signal on any login screen. Sits below the
            primary action so it doesn't compete with it, but is
            visible without scrolling. Opens in a new tab so the user
            doesn't lose their typed credentials. */}
        <a
          href="/privacy-policy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="auth-privacy-link"
        >
          <FileText size={14} />
          <span>Privacy Policy</span>
        </a>
      </form>
    </div>
  );
};

/* ═══ SCREEN 2 – FORGOT PASSWORD ════════════════════ */
const ForgotScreen = ({ onBack, onOtpSent, sharedEmail, setSharedEmail, setDevOtp }) => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState(sharedEmail || '');
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Enter your registered email address.');
      return;
    }
    setBusy(true);
    try {
      const data = await forgotPassword(email);
      setSharedEmail(email);
      // If the backend couldn't actually email (dev SendGrid failure),
      // it returns the OTP under `devOtp`. Pass it up so the OTP
      // screen can pre-fill and show a "fallback" notice.
      if (data?.devOtp) setDevOtp(String(data.devOtp));
      onOtpSent();
    } catch (err) {
      setError(err?.message || 'Could not send OTP.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card auth-card-enter">
      <button className="auth-back-btn" onClick={onBack}>
        <ArrowLeft size={18} /> Back
      </button>
      <TescoLogo />
      <h1 className="auth-title">Change your Password</h1>
      <p className="auth-subtitle">We'll send an OTP to your work email</p>

      <form className="auth-form" onSubmit={handleSendOtp}>
        <ErrorBanner message={error} />
        <label className="auth-label">Your registered email</label>
        <div className="auth-input-wrap">
          <Mail size={17} className="auth-input-icon" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@tesco.com"
            required
            className="auth-input"
          />
        </div>

        <p className="auth-info-text">
          An OTP will be sent to this email to verify your identity before setting a new password.
        </p>

        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? 'Sending OTP…' : 'Send OTP'}
        </button>
      </form>
    </div>
  );
};

/* ═══ SCREEN 3 – OTP VERIFICATION ══════════════════ */
const OtpScreen = ({ onBack, onVerified, sharedEmail, setSharedResetToken, devOtp }) => {
  const { verifyOtp, forgotPassword } = useAuth();
  const [otp, setOtp] = useState(() => {
    if (devOtp && /^\d{6}$/.test(devOtp)) return devOtp.split('');
    return ['', '', '', '', '', ''];
  });
  const [shaking, setShaking] = useState(false);
  const [timer, setTimer] = useState(600);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
    const interval = setInterval(() => setTimer(t => t > 0 ? t - 1 : 0), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otp];
    paste.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    inputRefs.current[Math.min(paste.length, 5)]?.focus();
    e.preventDefault();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    const code = otp.join('');
    if (code.length < 6) {
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }
    setBusy(true);
    try {
      const data = await verifyOtp(sharedEmail, code);
      // Backend returns { success, resetToken } on success. Stash the
      // resetToken so the next screen can pass it to /reset-password.
      const token = data?.resetToken;
      if (!token) {
        throw new Error('Verify succeeded but no reset token was returned by the server.');
      }
      setSharedResetToken(token);
      onVerified();
    } catch (err) {
      setError(err?.message || 'OTP verification failed.');
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await forgotPassword(sharedEmail);
      setTimer(600);
    } catch (err) {
      setError(err?.message || 'Could not resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-card auth-card-enter">
      <button className="auth-back-btn" onClick={onBack}>
        <ArrowLeft size={18} /> Back
      </button>
      <div className="auth-otp-icon">
        <ShieldCheck size={36} className="auth-otp-shield" />
      </div>
      <h1 className="auth-title">Enter OTP</h1>
      <p className="auth-subtitle">Sent to <strong>{sharedEmail || '—'}</strong></p>
      {devOtp && (
        <div style={{
          margin: '8px auto 12px', padding: '8px 12px',
          background: '#FEF3C7', border: '1px solid #FCD34D',
          borderRadius: 8, color: '#92400E', fontSize: 12,
          maxWidth: 320, textAlign: 'center',
        }}>
          Email service is offline — your OTP is <strong>{devOtp}</strong> (auto-filled below).
        </div>
      )}

      <form className="auth-form" onSubmit={handleVerify}>
        <ErrorBanner message={error} />
        <div className={`otp-boxes ${shaking ? 'otp-shake' : ''}`} onPaste={handlePaste}>
          {otp.map((d, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`otp-box ${d ? 'otp-box-filled' : ''}`}
            />
          ))}
        </div>

        <p className="auth-timer">
          {timer > 0
            ? <>OTP valid for <span className="timer-green">{formatTime(timer)}</span></>
            : <span className="timer-expired">OTP expired</span>}
        </p>

        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? 'Verifying…' : 'Verify OTP'}
        </button>

        <button type="button" className="auth-resend-btn" onClick={handleResend} disabled={timer > 540 || resending}>
          <RefreshCw size={14} className={resending ? 'spin-icon' : ''} />
          {resending ? 'Sending…' : 'Resend OTP'}
          {timer > 540 && <span className="resend-cooldown"> ({formatTime(timer - 540)})</span>}
        </button>
      </form>
    </div>
  );
};

/* ═══ SCREEN 4 – SET NEW PASSWORD ═══════════════════ */
const SetPasswordScreen = ({ onBack, onSet, sharedResetToken }) => {
  const { resetPassword } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  const getStrength = (p) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const strength = getStrength(pw);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', '#EF4444', '#F59E0B', '#3B82F6', '#4CAA17'][strength];

  const match    = confirm && pw === confirm;
  const mismatch = confirm && pw !== confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!match || strength < 2) return;
    setBusy(true);
    try {
      await resetPassword(sharedResetToken, pw);
      onSet();
    } catch (err) {
      setError(err?.message || 'Could not set new password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card auth-card-enter">
      <button className="auth-back-btn" onClick={onBack}>
        <ArrowLeft size={18} /> Back
      </button>
      <TescoLogo />
      <h1 className="auth-title">Set New Password</h1>
      <p className="auth-subtitle">Choose a strong password</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <ErrorBanner message={error} />

        <label className="auth-label">New Password</label>
        <div className="auth-input-wrap">
          <Lock size={17} className="auth-input-icon" />
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Enter new password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            required
            className="auth-input"
          />
          <button type="button" className="auth-eye" onClick={() => setShowPw(v => !v)}>
            {showPw ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        </div>

        {pw && (
          <div className="pw-strength-wrap">
            <div className="pw-strength-bar">
              {[1, 2, 3, 4].map(n => (
                <div
                  key={n}
                  className="pw-strength-seg"
                  style={{ background: n <= strength ? strengthColor : '#E5E7EB' }}
                />
              ))}
            </div>
            <span className="pw-strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
          </div>
        )}

        <label className="auth-label">Confirm Password</label>
        <div className={`auth-input-wrap ${match ? 'input-success' : mismatch ? 'input-error' : ''}`}>
          <Lock size={17} className="auth-input-icon" />
          <input
            type={showCf ? 'text' : 'password'}
            placeholder="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            className="auth-input"
          />
          <button type="button" className="auth-eye" onClick={() => setShowCf(v => !v)}>
            {showCf ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        </div>
        {mismatch && <p className="auth-error">Passwords do not match</p>}
        {match && <p className="auth-success-msg">✓ Passwords match</p>}

        <p className="pw-rules">Min 8 chars &bull; 1 uppercase &bull; 1 number &bull; 1 symbol</p>

        <button type="submit" className="auth-btn" disabled={!match || strength < 2 || busy}>
          {busy ? 'Saving…' : 'Set Password'}
        </button>
      </form>
    </div>
  );
};

/* ═══ SCREEN 5 – SUCCESS ════════════════════════════ */
const SuccessScreen = ({ onGoLogin }) => (
  <div className="auth-card auth-card-enter">
    <div className="success-icon-wrap">
      <div className="success-glow" />
      <CheckCircle size={72} className="success-check" />
    </div>
    <h1 className="auth-title success-title">All done!</h1>
    <p className="auth-subtitle">
      Your password has been changed successfully.<br />
      Use your new password to log in.
    </p>
    <button className="auth-btn" style={{ marginTop: '12px' }} onClick={onGoLogin}>
      Go to Login
    </button>
  </div>
);

/* ═══ MAIN AUTH FLOW ════════════════════════════════ */
const Auth = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('login');
  const [sharedEmail,       setSharedEmail]       = useState('');
  // Reset-token returned by /verify-otp — passed to /reset-password.
  const [sharedResetToken,  setSharedResetToken]  = useState('');
  // Set to the dev-OTP returned by the backend when email is offline.
  // Threaded into OtpScreen so the input boxes auto-fill and a yellow
  // notice appears explaining what's happening.
  const [sharedDevOtp,      setSharedDevOtp]      = useState('');

  // If already signed in, bounce straight to the dashboard.
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const screens = {
    login: (
      <LoginScreen
        onForgotPassword={() => setStep('forgot')}
        setSharedEmail={setSharedEmail}
      />
    ),
    forgot: (
      <ForgotScreen
        onBack={() => setStep('login')}
        onOtpSent={() => setStep('otp')}
        sharedEmail={sharedEmail}
        setSharedEmail={setSharedEmail}
        setDevOtp={setSharedDevOtp}
      />
    ),
    otp: (
      <OtpScreen
        onBack={() => setStep('forgot')}
        onVerified={() => setStep('setpw')}
        sharedEmail={sharedEmail}
        setSharedResetToken={setSharedResetToken}
        devOtp={sharedDevOtp}
      />
    ),
    setpw: (
      <SetPasswordScreen
        onBack={() => setStep('otp')}
        onSet={() => setStep('success')}
        sharedResetToken={sharedResetToken}
      />
    ),
    success: <SuccessScreen onGoLogin={() => setStep('login')} />,
  };

  return (
    <div className="auth-page">
      <AuthBackground />
      <div className="auth-center">
        {screens[step]}
      </div>

      {/* #320 — Persistent privacy-policy footer. Visible on every
          auth step (login, forgot, OTP, reset, success) so the user
          can review how we handle their data at any point before
          authenticating. */}
      <footer className="auth-footer">
        <span>© {new Date().getFullYear()} Tesco Structures LLP</span>
        <span className="auth-footer-sep">·</span>
        <a
          href="/privacy-policy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="auth-footer-link"
        >
          Privacy Policy
        </a>
      </footer>
    </div>
  );
};

export default Auth;
