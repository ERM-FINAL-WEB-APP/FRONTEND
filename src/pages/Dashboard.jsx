import React, { useState, useEffect, useCallback } from 'react';
import { LogIn, LogOut, Hourglass, Megaphone } from 'lucide-react';
import { attendanceAPI, announcementAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

/**
 * Dashboard — employee's home screen.
 *
 *   • Live clock + greeting using the signed-in user's name.
 *   • Check-In / Check-Out button hits the real attendance endpoints
 *     and the row appears immediately on HRMS Attendance Logs.
 *   • "Working HR's" counts hours since check-in in real time.
 *   • Bottom card shows the latest two announcements from the
 *     shared announcements collection.
 */

function fmtClock(d) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtHM(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}
function relTime(iso) {
  if (!iso) return '';
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60)    return 'Just now';
  if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return (() => { const __d = new Date(iso); if (!__d || isNaN(__d.getTime?.() ?? new Date(__d).getTime())) return '—'; const __dd = (__d instanceof Date) ? __d : new Date(__d); const __day = String(__dd.getDate()).padStart(2,'0'); const __mo  = String(__dd.getMonth()+1).padStart(2,'0'); const __yr  = __dd.getFullYear(); return __day + '-' + __mo + '-' + __yr; })();
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const Dashboard = () => {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [today, setToday] = useState({ checkIn: null, checkOut: null, workedHours: 0, shiftName: 'General Shift' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcements, setAnnouncements] = useState([]);

  // Live clock — 1s tick.
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pull today's attendance.
  const refreshToday = useCallback(async () => {
    try {
      const res = await attendanceAPI.today();
      setToday({
        shiftName:   res.data?.shiftName   || 'General Shift',
        checkIn:     res.data?.checkIn     || null,
        checkOut:    res.data?.checkOut    || null,
        workedHours: res.data?.workedHours || 0,
      });
    } catch { /* keep existing state */ }
  }, []);
  useEffect(() => { refreshToday(); }, [refreshToday]);

  // Pull latest 3 announcements.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await announcementAPI.list(3);
        if (!cancelled) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
          setAnnouncements(list);
        }
      } catch { /* leave empty */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const checkedIn  = !!today.checkIn;
  const checkedOut = !!today.checkOut;
  const buttonLabel = !checkedIn ? 'Check In' : !checkedOut ? 'Check Out' : 'Done';

  const handleAttendance = async () => {
    setError('');
    setBusy(true);
    try {
      if (!checkedIn) {
        // Optionally collect geolocation — browser-only and fast.
        let coords;
        try {
          const fix = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
              (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
              (_) => resolve(null),
              { timeout: 5000, maximumAge: 60000 }
            );
          });
          coords = fix || undefined;
        } catch { /* no geo, fine */ }
        await attendanceAPI.checkIn('office', coords);
      } else if (!checkedOut) {
        await attendanceAPI.checkOut();
      } else {
        return; // already done
      }
      await refreshToday();
    } catch (err) {
      setError(err?.message || 'Could not update attendance.');
    } finally {
      setBusy(false);
    }
  };

  // Working hours display — live tick while checked in, otherwise saved value.
  const workedHrs = (() => {
    if (today.checkIn && !today.checkOut) {
      const ms = time.getTime() - new Date(today.checkIn).getTime();
      const totalMin = Math.max(0, Math.floor(ms / 60000));
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const wh = Number(today.workedHours || 0);
    const h = Math.floor(wh);
    const m = Math.round((wh - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  })();

  const firstName = user?.name?.split(' ')[0] || user?.firstName || 'there';

  return (
    <div className="mobile-dashboard-container">
      {/* Green Header Background Area */}
      <div className="mobile-header-bg">
        <div className="mobile-greeting">
          <h1>Hey {firstName} 👋</h1>
          <p>{greeting()}! Mark Your Attendance 👊</p>
        </div>
      </div>

      {/* Overlapping Card */}
      <div className="attendance-overlap-card card">
        <div className="shift-pill-wrapper">
          <span className="shift-pill">{(today.shiftName || 'GENERAL SHIFT').toUpperCase()}</span>
        </div>

        <div className="time-action-row">
          <div className="live-clock">{fmtClock(time)}</div>
          <button
            className={checkedIn ? "btn-checkout" : "btn-checkin"}
            onClick={handleAttendance}
            disabled={busy || (checkedIn && checkedOut)}
          >
            {busy ? '…' : buttonLabel}
          </button>
        </div>

        {error && (
          <div style={{
            margin: '8px 0', padding: '8px 12px',
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 8, color: '#991B1B', fontSize: 12,
          }}>{error}</div>
        )}

        <div className="attendance-metrics">
          <div className="metric-item">
            <LogIn size={24} className="metric-icon color-green" />
            <span className="metric-time">{fmtHM(today.checkIn)}</span>
            <span className="metric-label color-green">Check In</span>
          </div>
          <div className="metric-item">
            <LogOut size={24} className="metric-icon color-blue" />
            <span className="metric-time">{fmtHM(today.checkOut)}</span>
            <span className="metric-label color-blue">Check Out</span>
          </div>
          <div className="metric-item">
            <Hourglass size={24} className="metric-icon color-purple" />
            <span className="metric-time">{workedHrs}</span>
            <span className="metric-label color-purple">Working HR's</span>
          </div>
        </div>
      </div>

      {/* Announcements Section */}
      <div className="mobile-announcements">
        <div className="section-header">
          <div className="header-title">
            <h2>Announcement</h2>
            <Megaphone size={18} />
          </div>
        </div>
        <p className="section-subtitle">Latest company updates and important notices</p>

        <div className="announcement-cards">
          {announcements.length === 0 && (
            <div className="a-card" style={{ textAlign: 'center', color: '#64748B' }}>
              <p>No announcements yet.</p>
            </div>
          )}
          {announcements.map((a) => (
            <div className="a-card" key={a._id}>
              <h3>{a.title || '(untitled)'}</h3>
              <p>{(a.body || a.description || '').slice(0, 120)}{(a.body || a.description || '').length > 120 ? '…' : ''}</p>
              <div className="a-card-footer">
                <span>Posted by {a.createdByName || a.postedBy || 'HR'}</span>
                <span className="dot">•</span>
                <span>{relTime(a.publishDate || a.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
