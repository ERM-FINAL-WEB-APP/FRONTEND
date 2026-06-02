import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, AlertCircle, CheckCircle } from 'lucide-react';
import { leaveAPI } from '../services/api';
import './Leave.css';

/**
 * Leave — apply for leave/permission and view personal history.
 *
 * Submits land in the shared `leaves` collection (same DB HRMS reads),
 * so the request appears on the HRMS Leave Approvals page within
 * seconds of being filed here.
 *
 * Rules ported from the mobile app:
 *   • Past dates are disabled — only today + future days allowed.
 *   • Submitting a leave/permission for a date that already has a
 *     non-rejected request shows "Already requested for this date".
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function fmtDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch { return String(iso); }
}
function fmtRange(s, e) {
  if (!s) return '';
  const sf = fmtDate(s);
  if (!e || s === e) return sf;
  return `${sf} - ${fmtDate(e)}`;
}
function fmtTime(t) {
  if (!t) return '';
  // Accept "09:00" or "9:00 AM"
  if (/AM|PM/i.test(t)) return t;
  try {
    const [h, m] = t.split(':');
    const hh = parseInt(h, 10);
    const ap = hh >= 12 ? 'PM' : 'AM';
    const hh12 = hh % 12 || 12;
    return `${String(hh12).padStart(2,'0')}:${m} ${ap}`;
  } catch { return t; }
}

const Leave = () => {
  const [activeTab, setActiveTab] = useState('leave');

  // ── Leave form state ─────────────────────────────────────────────
  const [leaveType,   setLeaveType]   = useState('Casual Leave');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [isHalfDay,   setIsHalfDay]   = useState(false);
  const [reason,      setReason]      = useState('');

  // ── Permission form state ────────────────────────────────────────
  const [permDate,        setPermDate]        = useState('');
  const [startTime,       setStartTime]       = useState('');
  const [endTime,         setEndTime]         = useState('');
  const [permReason,      setPermReason]      = useState('');
  const [permissionType,  setPermissionType]  = useState('Medical Permission');

  // ── Shared submit state ──────────────────────────────────────────
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // ── History ──────────────────────────────────────────────────────
  // Production launch: ERM went live for all employees in June 2026,
  // so there is no leave history before then. Floor the month/year
  // pickers AND the default state so a fresh user never lands on an
  // empty pre-launch month.
  const LAUNCH_MONTH = 6;
  const LAUNCH_YEAR  = 2026;
  const now = new Date();
  const _curM = now.getMonth() + 1;
  const _curY = now.getFullYear();
  const _atOrAfterLaunch =
    _curY > LAUNCH_YEAR || (_curY === LAUNCH_YEAR && _curM >= LAUNCH_MONTH);
  const [histMonth, setHistMonth] = useState(_atOrAfterLaunch ? _curM : LAUNCH_MONTH);
  const [histYear,  setHistYear]  = useState(_atOrAfterLaunch ? _curY : LAUNCH_YEAR);
  const [history,   setHistory]   = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await leaveAPI.getMyLeaves({
        month: histMonth,
        year:  histYear,
        type:  activeTab, // 'leave' or 'permission'
      });
      setHistory(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, [histMonth, histYear, activeTab]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Auto-clear feedback after a few seconds.
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  /**
   * Block duplicate submissions BEFORE hitting the backend — return
   * the first overlapping date string or null. Rejected/cancelled
   * rows don't block re-application.
   */
  const findOverlap = (from, to) => {
    if (!from) return null;
    const want = new Set();
    const s = new Date(from + 'T00:00:00');
    const e = new Date((to || from) + 'T00:00:00');
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      want.add(d.toISOString().split('T')[0]);
    }
    for (const h of history) {
      const st = String(h.status || '').toLowerCase();
      if (st === 'rejected' || st === 'cancelled') continue;
      if (h.requestType === 'permission' && h.date) {
        if (want.has(String(h.date).split('T')[0])) return String(h.date).split('T')[0];
      } else if (h.startDate && h.endDate) {
        const ss = new Date(String(h.startDate).split('T')[0] + 'T00:00:00');
        const ee = new Date(String(h.endDate).split('T')[0]   + 'T00:00:00');
        for (let d = new Date(ss); d <= ee; d.setDate(d.getDate() + 1)) {
          const iso = d.toISOString().split('T')[0];
          if (want.has(iso)) return iso;
        }
      }
    }
    return null;
  };

  const submitLeave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!startDate || !endDate || !reason.trim()) {
      setError('Fill leave type, start date, end date and reason.');
      return;
    }
    if (startDate < todayISO()) {
      setError('Start date must be today or later.');
      return;
    }
    if (endDate < startDate) {
      setError('End date cannot be before start date.');
      return;
    }
    const dup = findOverlap(startDate, endDate);
    if (dup) {
      setError(`You have already submitted a request for ${dup}. Wait for HR to act or cancel the existing one first.`);
      return;
    }
    setBusy(true);
    try {
      if (!window.confirm('Submit this leave request to HR?')) { setBusy(false); return; }
      await leaveAPI.applyLeave({
        leaveType,
        startDate,
        endDate,
        isHalfDay,
        reason: reason.trim(),
      });
      setSuccess('Leave request submitted. HR has been notified.');
      setStartDate('');
      setEndDate('');
      setReason('');
      setIsHalfDay(false);
      loadHistory();
    } catch (err) {
      setError(err?.message || 'Could not submit leave.');
    } finally {
      setBusy(false);
    }
  };

  const submitPermission = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!permDate || !startTime || !endTime || !permReason.trim()) {
      setError('Fill date, start time, end time and reason.');
      return;
    }
    if (permDate < todayISO()) {
      setError('Permission date must be today or later.');
      return;
    }
    if (endTime <= startTime) {
      setError('End time must be after start time.');
      return;
    }
    const dup = findOverlap(permDate, permDate);
    if (dup) {
      setError(`You have already submitted a request for ${dup}.`);
      return;
    }
    setBusy(true);
    try {
      if (!window.confirm('Submit this permission request to HR?')) { setBusy(false); return; }
      await leaveAPI.applyPermission({
        permissionType,
        date:      permDate,
        startTime,
        endTime,
        reason:    permReason.trim(),
      });
      setSuccess('Permission request submitted. HR has been notified.');
      setPermDate('');
      setStartTime('');
      setEndTime('');
      setPermReason('');
      loadHistory();
    } catch (err) {
      setError(err?.message || 'Could not submit permission.');
    } finally {
      setBusy(false);
    }
  };

  const min = todayISO();

  return (
    <div className="leave-dashboard">
      <div className="dashboard-layout">

        {/* Left Column: Form */}
        <div className="dashboard-left">
          <div className="tabs-container">
            <button
              className={`tab-btn ${activeTab === 'leave' ? 'active' : ''}`}
              onClick={() => { setActiveTab('leave'); setError(''); setSuccess(''); }}
            >
              Apply Leave
            </button>
            <button
              className={`tab-btn ${activeTab === 'permission' ? 'active' : ''}`}
              onClick={() => { setActiveTab('permission'); setError(''); setSuccess(''); }}
            >
              Permission
            </button>
          </div>

          <div className="leave-form-container">
            {error && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, marginBottom: 12 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{error}</span>
              </div>
            )}
            {success && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D', fontSize: 13, marginBottom: 12 }}>
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{success}</span>
              </div>
            )}

            {activeTab === 'leave' ? (
              <form className="leave-form" onSubmit={submitLeave}>
                <div className="form-group">
                  <label>Leave Type</label>
                  <div className="custom-select-wrapper">
                    <select
                      className="form-control form-select"
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                    >
                      <option>Casual Leave</option>
                      <option>Sick Leave</option>
                      <option>Annual Leave</option>
                      <option>Earned Leave</option>
                      <option>Unpaid Leave</option>
                    </select>
                    <ChevronDown className="select-icon" size={16} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      min={min}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      min={startDate || min}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group half-day-group">
                  <label>Applying for Half Day?</label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isHalfDay}
                      onChange={(e) => setIsHalfDay(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Reason for leave</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Enter reason for leave..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-submit-green" disabled={busy}>
                    {busy ? 'Submitting…' : 'Submit Leave Request'}
                  </button>
                </div>
              </form>
            ) : (
              <form className="leave-form" onSubmit={submitPermission}>
                <div className="form-group">
                  <label>Permission Type</label>
                  <div className="custom-select-wrapper">
                    <select
                      className="form-control form-select"
                      value={permissionType}
                      onChange={(e) => setPermissionType(e.target.value)}
                    >
                      <option>Medical Permission</option>
                      <option>Personal Permission</option>
                      <option>Family Function</option>
                      <option>Other</option>
                    </select>
                    <ChevronDown className="select-icon" size={16} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Permission Date</label>
                  <input
                    type="date"
                    className="form-control"
                    min={min}
                    value={permDate}
                    onChange={(e) => setPermDate(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason for permission</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Enter reason for permission..."
                    value={permReason}
                    onChange={(e) => setPermReason(e.target.value)}
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-submit-green" disabled={busy}>
                    {busy ? 'Submitting…' : 'Submit Permission Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: History */}
        <div className="dashboard-right">
          <div className="section-header-compact">
            <h3 className="section-title">{activeTab === 'leave' ? 'Leave History' : 'Permission History'}</h3>
            <div className="filters">
              <CustomDropdown
                options={histYear === LAUNCH_YEAR ? MONTHS.slice(LAUNCH_MONTH - 1) : MONTHS}
                defaultSelected={MONTHS[histMonth - 1]}
                onSelect={(label) => setHistMonth(MONTHS.indexOf(label) + 1)}
              />
              <CustomDropdown
                options={Array.from({ length: 4 }, (_, i) => String(LAUNCH_YEAR + i))}
                defaultSelected={String(histYear)}
                onSelect={(label) => setHistYear(parseInt(label, 10))}
              />
            </div>
          </div>

          <div className="leave-history-list mt-6">
            {histLoading && <div style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>Loading…</div>}
            {!histLoading && history.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
                No {activeTab === 'leave' ? 'leave' : 'permission'} requests for {MONTHS[histMonth - 1]} {histYear}.
              </div>
            )}
            {!histLoading && history.map((h) => {
              const status = (h.status || 'Pending').charAt(0).toUpperCase() + (h.status || 'Pending').slice(1).toLowerCase();
              const color = status === 'Approved' ? 'green'
                          : status === 'Rejected' ? 'red'
                          : 'orange';
              const isPerm = h.requestType === 'permission';
              return (
                <HistoryCard
                  key={h._id}
                  type={isPerm ? (h.permissionType || 'Permission') : (h.leaveType || 'Leave')}
                  reason={h.reason || (isPerm ? fmtDate(h.date) : '')}
                  status={status}
                  statusColor={color}
                  durationLabel={isPerm ? 'Time Slot' : 'Duration'}
                  durationValue={isPerm
                    ? `${fmtTime(h.startTime)} - ${fmtTime(h.endTime)}`
                    : fmtRange(h.startDate, h.endDate)}
                  daysLabel={isPerm ? 'Duration' : 'Days'}
                  daysValue={isPerm
                    ? `${h.durationHours || ''} Hour${h.durationHours === 1 ? '' : 's'}`
                    : (h.isHalfDay ? 'Half Day' : `${h.daysCount || 1} Day${(h.daysCount || 1) === 1 ? '' : 's'}`)}
                  hrNote={h.hrComment ? `HR: ${h.hrComment}` : ''}
                />
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

// Sub-components

const CustomDropdown = ({ options, defaultSelected, onSelect }) => {
  const [isOpen,   setIsOpen]   = useState(false);
  const [selected, setSelected] = useState(defaultSelected);
  const dropdownRef = useRef(null);

  useEffect(() => { setSelected(defaultSelected); }, [defaultSelected]);

  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <button
        className={`dropdown-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span>{selected}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? 'rotate' : ''}`} />
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          {options.map((opt) => (
            <div
              key={opt}
              className={`dropdown-item ${selected === opt ? 'selected' : ''}`}
              onClick={() => {
                setSelected(opt);
                setIsOpen(false);
                onSelect?.(opt);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const HistoryCard = ({ type, reason, status, statusColor, durationLabel, durationValue, daysLabel, daysValue, hrNote }) => (
  <div className={`leave-card border-${statusColor}`}>
    <div className="leave-card-header">
      <div className="leave-info">
        <h4>{type}</h4>
        <p>{reason}</p>
      </div>
      <span className={`status-badge badge-${statusColor}`}>{status}</span>
    </div>
    <div className="leave-card-divider"></div>
    <div className="leave-card-footer">
      <div className="lc-metric">
        <span className="lc-label">{durationLabel}</span>
        <span className="lc-value">{durationValue}</span>
      </div>
      <div className="lc-metric text-right">
        <span className="lc-label">{daysLabel}</span>
        <span className="lc-value">{daysValue}</span>
      </div>
    </div>
    {hrNote && (
      <div className={`leave-card-hr hr-border-${statusColor}`}>
        {hrNote}
      </div>
    )}
  </div>
);

export default Leave;
