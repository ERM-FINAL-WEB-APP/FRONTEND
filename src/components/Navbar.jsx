import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Bell, Moon, Sun, MapPin, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationAPI } from '../services/api';
import './Navbar.css';

/**
 * Navbar — search + clock + presence chip + dark-mode toggle + bell
 * (with unread count badge) + profile-avatar dropdown.
 *
 * Dark mode toggles a `data-theme="dark"` attribute on <html>, persisted
 * to localStorage so it survives refresh. CSS variables in index.css /
 * Navbar.css listen for that attribute and swap colours.
 *
 * Bell shows the live unread count from /api/notification/unread-count
 * and polls every 30s. Clicking it navigates to /notifications which
 * auto-marks them as read.
 */
const THEME_KEY = 'erm_web_theme';

const Navbar = ({ toggleSidebar }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [time,        setTime]        = useState(new Date());
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [unread,      setUnread]      = useState(0);
  const [theme,       setTheme]       = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
      // Honour the OS preference on first visit.
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {}
    return 'light';
  });
  const menuRef = useRef(null);

  // Apply theme to <html data-theme="..."> so CSS variables can swap.
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  // ─── Unread notification count ─────────────────────────────────────
  // Refresh on mount, then every 30s. Also refreshes when the user
  // returns to the tab — catches "I just acted on a notif from another
  // tab" cases.
  const refreshUnread = useCallback(async () => {
    try {
      const res = await notificationAPI.unreadCount();
      const n = Number(res?.data?.unreadCount ?? res?.data?.count ?? res?.data?.unread ?? 0);
      setUnread(Number.isFinite(n) ? n : 0);
    } catch { /* keep last value */ }
  }, []);
  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 30_000);
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [refreshUnread]);

  const formatDate = (date) =>
    (() => { const __d = date; if (!__d || isNaN(__d.getTime?.() ?? new Date(__d).getTime())) return '—'; const __dd = (__d instanceof Date) ? __d : new Date(__d); const __day = String(__dd.getDate()).padStart(2,'0'); const __mo  = String(__dd.getMonth()+1).padStart(2,'0'); const __yr  = __dd.getFullYear(); return __day + '-' + __mo + '-' + __yr; })();
  const formatTime = (date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const displayName =
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email ||
    'Employee';
  const gender = String(user?.gender || '').toLowerCase();
  const palette = gender === 'female'
    ? { bg: 'EC4899', fg: 'fff' }
    : gender === 'male'
    ? { bg: '3B82F6', fg: 'fff' }
    : { bg: '4CAA17', fg: 'fff' };
  const avatarUrl =
    user?.photoUrl ||
    `https://ui-avatars.com/api/?background=${palette.bg}&color=${palette.fg}&name=${encodeURIComponent(displayName)}`;

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const goToNotifications = () => {
    navigate('/notifications');
    // Optimistic — the Notifications page will auto-mark them read on view,
    // but the bell badge should disappear immediately to feel responsive.
    setTimeout(refreshUnread, 1500);
  };

  return (
    <header className="navbar glass">
      <div className="navbar-left">
        <div className="search-bar">
          <Search className="search-icon" size={18} />
          <input type="text" placeholder="Search employees, reports..." />
        </div>
      </div>

      <div className="navbar-right">
        <div className="datetime-widget">
          <div className="time">{formatTime(time)}</div>
          <div className="date">{formatDate(time)}</div>
        </div>

        <div className="status-chip present">
          <MapPin size={14} />
          <span>At Office</span>
        </div>

        <button
          className="icon-btn theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button
          className="icon-btn notification-btn"
          onClick={goToNotifications}
          title={unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications'}
          style={{ position: 'relative' }}
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="badge" style={{
              position: 'absolute',
              top: -2, right: -2,
              minWidth: 18, height: 18, padding: '0 5px',
              borderRadius: 999, background: '#DC2626', color: '#fff',
              fontSize: 10, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--navbar-bg, #fff)',
            }}>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        <div className="profile-dropdown" ref={menuRef} style={{ position: 'relative' }}>
          <img
            src={avatarUrl}
            alt="Profile"
            className="profile-img"
            style={{ cursor: 'pointer' }}
            onClick={() => setMenuOpen((v) => !v)}
          />
          {menuOpen && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                minWidth: 220, padding: '6px 0',
                background: 'var(--dropdown-bg, #fff)',
                color: 'var(--text-main, #1a1a1a)',
                borderRadius: 10,
                boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                border: '1px solid var(--border-color, #E2E8F0)',
                zIndex: 1000,
              }}
            >
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color, #F1F5F9)' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{displayName}</div>
                {user?.email && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{user.email}</div>}
                {user?.employeeId && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>ID: {user.employeeId}</div>}
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: 'inherit', textAlign: 'left',
                }}
              >
                <UserIcon size={15} /> My Profile
              </button>
              {/* Logout intentionally NOT here — it lives in the Sidebar */}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
