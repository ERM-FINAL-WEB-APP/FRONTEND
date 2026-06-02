import React, { useState, useEffect } from 'react';
import { Users, AlertCircle } from 'lucide-react';
import LiveTracking from './LiveTracking';
import LeaveApprovals from './LeaveApprovals';
import Reports from './Reports';
import ManagerAnnouncements from './ManagerAnnouncements';
import AttendanceRequestsManager from './AttendanceRequestsManager';
import { managerAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './ManagerAccess.css';

/**
 * Manager Access — gated team-view for any employee who has subordinates
 * assigned to them (via HRMS Employee form's "Manager" dropdown).
 *
 * On mount it fetches GET /api/manager/team. If the response has zero
 * subordinates we show a friendly "you don't have a team" panel; if it
 * has members, we render the tabs:
 *   • Live Tracking — real-time positions of subordinates
 *   • Approvals     — leave + permission + allowance requests
 *   • Reports       — monthly attendance summary
 *   • Announcement  — read-only feed of company announcements
 */
const ManagerAccess = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('approvals');
  const [team,      setTeam]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await managerAPI.team();
        if (cancelled) return;
        setTeam(Array.isArray(res.data?.team) ? res.data.team : []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load your team.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const firstName =
    user?.name?.split(' ')[0] ||
    user?.firstName ||
    'Manager';

  if (loading) {
    return (
      <div className="manager-access-page" style={{ padding: 40, color: '#334155' }}>
        Loading your team…
      </div>
    );
  }

  if (error) {
    return (
      <div className="manager-access-page" style={{ padding: 24 }}>
        <div style={{
          padding: '12px 14px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      </div>
    );
  }

  if (team.length === 0) {
    return (
      <div className="manager-access-page" style={{ padding: 24 }}>
        <div style={{
          padding: 40, textAlign: 'center',
          background: '#F8FAFC', borderRadius: 12,
          border: '1px dashed #CBD5E1',
        }}>
          <Users size={32} color="#475569" style={{ marginBottom: 8 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
            No team assigned yet
          </h3>
          <p style={{ fontSize: 13, color: '#334155', maxWidth: 480, margin: '0 auto' }}>
            You don't have any subordinates linked to you in HRMS. HR sets this
            via the <b>Manager</b> dropdown when creating or editing an employee.
            Once an employee is assigned to <b>{firstName}</b>, they will appear
            here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-access-page">
      <div className="manager-top-nav">
        {/* "Welcome back, Vivek. You manage 6 people: ..." banner removed
            Jun 2026 per HR brief — the manager already knows who they
            manage and the verbose name list pushed the tabs down on
            small laptop screens. */}
        <div className="manager-tabs">
          <button
            className={`manager-tab ${activeTab === 'approvals' ? 'active' : ''}`}
            onClick={() => setActiveTab('approvals')}
          >
            Approvals
          </button>
          <button
            className={`manager-tab ${activeTab === 'tracking' ? 'active' : ''}`}
            onClick={() => setActiveTab('tracking')}
          >
            Live Tracking
          </button>
          <button
            className={`manager-tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Team Attendance Report
          </button>
          <button
            className={`manager-tab ${activeTab === 'attendance-requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendance-requests')}
          >
            Attendance Requests
          </button>
          <button
            className={`manager-tab ${activeTab === 'announcements' ? 'active' : ''}`}
            onClick={() => setActiveTab('announcements')}
          >
            Announcement
          </button>
        </div>
      </div>
      <div className="manager-content">
        {activeTab === 'approvals'     && <LeaveApprovals />}
        {activeTab === 'tracking'      && <LiveTracking />}
        {activeTab === 'reports'       && <Reports />}
        {activeTab === 'attendance-requests' && <AttendanceRequestsManager />}
        {activeTab === 'announcements' && <ManagerAnnouncements />}
      </div>
    </div>
  );
};

export default ManagerAccess;
