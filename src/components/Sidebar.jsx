import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  Umbrella,
  Wallet,
  ReceiptText,
  Bell,
  LogOut,
  Menu,
  ChevronLeft,
  UserCircle,
  MessageSquare,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileAPI, managerAPI } from '../services/api';
import ermLogo from '../Assets/ERM_logo.svg';
import './Sidebar.css';

/**
 * Base nav items everyone sees. The Manager Access link is appended
 * dynamically only if the signed-in user has subordinates assigned to
 * them in HRMS (`assignedTo === my name` on at least one Employee row).
 */
const baseNavItems = [
  { path: '/dashboard',     label: 'Dashboard',         icon: LayoutDashboard },
  { path: '/attendance',    label: 'Attendance',        icon: CalendarCheck },
  { path: '/leave',         label: 'Leave Management',  icon: Umbrella },
  { path: '/allowance',     label: 'Allowance',         icon: Wallet },
  { path: '/payslip',       label: 'Payslip',           icon: ReceiptText },
  { path: '/notifications', label: 'Notifications',     icon: Bell },
  { path: '/complaint',     label: 'Raise Complaint',   icon: MessageSquare },
];
const managerNavItem = { path: '/manager', label: 'Manager Access', icon: Shield };
const profileNavItem = { path: '/profile', label: 'Profile',        icon: UserCircle };

// Cache the manager flag in sessionStorage so the link doesn't flash in
// and out between page navigations within the same session. Cleared on
// logout (we wipe localStorage there, but session items survive — that's
// fine: a fresh login refetches anyway).
const MANAGER_FLAG_KEY = 'erm_web_is_manager';

function pickLabel(value, sidecar) {
  const isHexId = (s) => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);
  if (value && typeof value === 'object') {
    const t = value.title || value.name || '';
    if (t && !isHexId(t)) return t;
  }
  if (typeof value === 'string' && value && !isHexId(value)) return value;
  if (sidecar && typeof sidecar === 'string' && !isHexId(sidecar)) return sidecar;
  return '';
}

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Hydrate profile name + designation.
  const [profile, setProfile] = useState(user || null);

  // Manager flag — seeded from sessionStorage so the link doesn't blink,
  // then verified via /api/manager/team on mount.
  const [isManager, setIsManager] = useState(() => {
    try { return sessionStorage.getItem(MANAGER_FLAG_KEY) === '1'; }
    catch { return false; }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Profile refresh — keeps designation in sync with HRMS edits.
      try {
        const res = await profileAPI.getProfile();
        const u = res.data?.user || res.data?.profile || res.data;
        if (!cancelled && u) setProfile(u);
      } catch { /* keep cached */ }

      // Team check — determines whether the Manager Access link appears.
      // Server-side this filters by `assignedTo === <my name>`, so we
      // never have to maintain a manager allowlist on the frontend.
      try {
        const res  = await managerAPI.team();
        const has  = Array.isArray(res.data?.team) && res.data.team.length > 0;
        if (!cancelled) {
          setIsManager(has);
          try { sessionStorage.setItem(MANAGER_FLAG_KEY, has ? '1' : '0'); } catch {}
        }
      } catch {
        // Don't blow away the cached flag on a transient network error;
        // a refresh will recheck.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const p = profile || {};
  const displayName =
    p.name ||
    [p.firstName, p.lastName].filter(Boolean).join(' ') ||
    p.email ||
    'Employee';
  const designation =
    pickLabel(p.designation, p.designationTitle) ||
    p.role ||
    '';
  const initial = (displayName.match(/\S/) || ['E'])[0].toUpperCase();

  // Build the final nav list, inserting Manager Access right before
  // Profile if the user has subordinates.
  const navItems = isManager
    ? [...baseNavItems, managerNavItem, profileNavItem]
    : [...baseNavItems, profileNavItem];

  const handleLogout = () => {
    if (!window.confirm('Are you sure you want to log out?')) return;
    try { sessionStorage.removeItem(MANAGER_FLAG_KEY); } catch {}
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className={`sidebar glass ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        {isOpen && <img src={ermLogo} alt="TESCO ERM Logo" style={{ height: '56px' }} className="logo" />}
        <button className="toggle-btn" onClick={toggleSidebar}>
          {isOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {isOpen && (
        <div className="user-profile-mini">
          <div className="avatar">{initial}</div>
          <div className="user-info">
            <h4 title={displayName}>{displayName}</h4>
            <p title={designation}>{designation || '—'}</p>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={!isOpen ? item.label : ''}
          >
            <item.icon className="nav-icon" size={20} />
            {isOpen && <span className="nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="nav-item logout-btn"
          title={!isOpen ? 'Logout' : ''}
          onClick={handleLogout}
        >
          <LogOut className="nav-icon" size={20} />
          {isOpen && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
