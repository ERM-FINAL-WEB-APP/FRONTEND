import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Allowance from './pages/Allowance';
import Payslip from './pages/Payslip';
import Announcements from './pages/Announcements';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import RaiseComplaint from './pages/RaiseComplaint';
import ManagerAccess from './pages/ManagerAccess';
import Auth from './pages/Auth';

import { AuthProvider, useAuth } from './context/AuthContext';
import { managerAPI } from './services/api';

/** Route guard: require a signed-in user. */
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Route guard for /manager — only employees with at least one
 * subordinate (assigned via HRMS) can reach this page. Typing the URL
 * directly as a non-manager redirects to /dashboard.
 *
 * The managerAPI.team() call is the source of truth; we cache the
 * result in sessionStorage so refreshes don't show a flash.
 */
function RequireManager({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const [status, setStatus] = useState(() => {
    try {
      const cached = sessionStorage.getItem('erm_web_is_manager');
      if (cached === '1') return 'manager';
      if (cached === '0') return 'non-manager';
      return 'checking';
    } catch { return 'checking'; }
  });

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await managerAPI.team();
        const has = Array.isArray(res.data?.team) && res.data.team.length > 0;
        if (cancelled) return;
        setStatus(has ? 'manager' : 'non-manager');
        try { sessionStorage.setItem('erm_web_is_manager', has ? '1' : '0'); } catch {}
      } catch {
        if (!cancelled) setStatus('non-manager');
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, loading]);

  if (loading || status === 'checking') return null;
  if (status !== 'manager') return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <MainLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route
              path="manager"
              element={<RequireManager><ManagerAccess /></RequireManager>}
            />
            <Route path="attendance"    element={<Attendance />} />
            <Route path="leave"         element={<Leave />} />
            <Route path="allowance"     element={<Allowance />} />
            <Route path="payslip"       element={<Payslip />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="complaint"     element={<RaiseComplaint />} />
            <Route path="profile"       element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
