import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, X, AlertCircle, CheckCircle } from 'lucide-react';
import { attendanceAPI } from '../services/api';
import './Attendance.css';

/**
 * Attendance — live calendar view + per-day attendance history.
 *
 *   • Calendar pulls from GET /api/attendance/calendar?month=&year=
 *     and colours each cell by status (present/late/absent/permission/halfday).
 *   • Right panel shows monthly summary counts + per-day history cards.
 *   • The "Request" button on a history card opens a modal that POSTs
 *     to /api/attendance/request for HR to review on the HRMS side
 *     (regularization, missing-checkout etc.).
 */

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtTime12(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}
function fmtDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return dt.toDateString();
  } catch { return ''; }
}
function statusColor(status) {
  switch (String(status || '').toLowerCase()) {
    case 'present':    return '#4CAA17';
    case 'absent':     return '#EF4444';
    case 'permission': return '#FACC15';
    case 'late':       return '#F97316';
    case 'halfday':    return '#8B5CF6';
    case 'half-day':   return '#8B5CF6';
    case 'leave':      return '#EF4444';
    default:           return 'transparent';
  }
}
function badgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'present')  return 'badge-present';
  if (s === 'absent')   return 'badge-absent';
  if (s === 'late')     return 'badge-late';
  if (s === 'permission') return 'badge-permission';
  return 'badge-present';
}
function titleCase(s) {
  const x = String(s || '').toLowerCase();
  return x.charAt(0).toUpperCase() + x.slice(1) || 'Present';
}

const Attendance = () => {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [byDate, setByDate] = useState({});   // 'YYYY-MM-DD' → record
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, permission: 0, halfday: 0 });
  const [loading, setLoading] = useState(false);

  // Request modal
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestReason,    setRequestReason]    = useState('');
  const [requestDate,      setRequestDate]      = useState('');
  const [reqBusy,          setReqBusy]          = useState(false);
  const [reqError,         setReqError]         = useState('');
  const [reqSuccess,       setReqSuccess]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [calRes, sumRes] = await Promise.all([
        attendanceAPI.getCalendar(month, year),
        attendanceAPI.getSummary(month, year).catch(() => ({ data: {} })),
      ]);
      const cal = Array.isArray(calRes.data) ? calRes.data : (calRes.data?.items || []);
      const idx = {};
      cal.forEach((r) => { if (r.date) idx[r.date] = r; });
      setByDate(idx);
      setSummary(sumRes.data || {});
    } catch {
      setByDate({});
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (reqSuccess) {
      const t = setTimeout(() => setReqSuccess(''), 4000);
      return () => clearTimeout(t);
    }
  }, [reqSuccess]);

  // Build calendar grid: first weekday + day count
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  // previous month tail
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false, iso: '' });
  }
  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, current: true, iso });
  }
  // next month head (fill to multiple of 7)
  while (cells.length % 7 !== 0) {
    const d = cells.length - (firstWeekday + daysInMonth);
    cells.push({ day: d + 1, current: false, iso: '' });
  }

  const history = Object.values(byDate)
    .filter((r) => r.checkIn || r.checkOut)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 12);

  const openRequest = (iso) => {
    setRequestDate(iso || '');
    setRequestReason('');
    setReqError('');
    setRequestModalOpen(true);
  };
  const submitRequest = async () => {
    setReqError('');
    if (!requestReason.trim()) {
      setReqError('Please describe the issue.');
      return;
    }
    setReqBusy(true);
    try {
      await attendanceAPI.createRequest({
        date:    requestDate || new Date().toISOString().split('T')[0],
        reason:  requestReason.trim(),
        requestType: 'regularize',
      });
      setReqSuccess('Request submitted. HR has been notified.');
      setRequestModalOpen(false);
    } catch (err) {
      setReqError(err?.message || 'Could not submit request.');
    } finally {
      setReqBusy(false);
    }
  };

  const stepMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1)  { m = 12; y -= 1; }
    if (m > 12) { m = 1;  y += 1; }
    setMonth(m); setYear(y);
  };

  return (
    <div className="attendance-dashboard">

      <div className="dashboard-layout">

        {/* LEFT COLUMN: Calendar */}
        <div className="dashboard-left">
          <div className="calendar-card card">
            <div className="calendar-header">
              <h2>{MONTHS[month - 1]} {year}</h2>
              <div className="calendar-nav">
                <button className="icon-btn-minimal" onClick={() => stepMonth(-1)} type="button"><ChevronLeft size={20} /></button>
                <button className="icon-btn-minimal" onClick={() => stepMonth(+1)} type="button"><ChevronRight size={20} /></button>
              </div>
            </div>

            <div className="calendar-grid mt-6">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} className="weekday">{d}</div>
              ))}
              {cells.map((c, i) => {
                const rec = c.iso ? byDate[c.iso] : null;
                const status = rec?.status;
                return (
                  <div key={i} className={`calendar-cell ${c.current ? '' : 'empty'}`}>
                    <span className="date-num">{c.day}</span>
                    <div className="status-dots">
                      {status && (
                        <div className="s-dot" style={{ backgroundColor: statusColor(status) }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="calendar-legend-container mt-6">
              <div className="legend-row">
                <LegendItem color="#4CAA17" label="Present" />
                <LegendItem color="#EF4444" label="Absent" />
                <LegendItem color="#FACC15" label="Permission" />
              </div>
              <div className="legend-row mt-4">
                <LegendItem color="#F97316" label="Late" />
                <LegendItem color="#8B5CF6" label="Half day" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Stats & History */}
        <div className="dashboard-right">

          <div className="section-header-compact">
            <h3 className="section-title">Attendance</h3>
            <div className="filters">
              <CustomDropdown
                options={MONTHS}
                defaultSelected={MONTHS[month - 1]}
                onSelect={(label) => setMonth(MONTHS.indexOf(label) + 1)}
              />
              <CustomDropdown
                options={['2024','2025','2026','2027']}
                defaultSelected={String(year)}
                onSelect={(label) => setYear(parseInt(label, 10))}
              />
            </div>
          </div>

          {reqSuccess && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 12,
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              color: '#15803D', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <CheckCircle size={16} /> {reqSuccess}
            </div>
          )}

          <div className="analytics-grid">
            <div className="stat-card bg-present text-white shadow-present">
              <div className="s-card-title">PRESENT</div>
              <div className="s-card-value">{String(summary.present || 0).padStart(2, '0')}</div>
            </div>
            <div className="stat-card bg-absent text-white shadow-absent">
              <div className="s-card-title">ABSENTS</div>
              <div className="s-card-value">{String(summary.absent || 0).padStart(2, '0')}</div>
            </div>
            <div className="stat-card bg-late text-white shadow-late">
              <div className="s-card-title">LATE IN</div>
              <div className="s-card-value">{String(summary.late || 0).padStart(2, '0')}</div>
            </div>
            <div className="stat-card bg-permissions text-white shadow-permissions">
              <div className="s-card-title">PERMISSIONS</div>
              <div className="s-card-value">{String(summary.permission || 0).padStart(2, '0')}</div>
            </div>
          </div>

          <div className="section-header-compact mt-6">
            <h3 className="section-title">History</h3>
          </div>

          <div className="history-cards-container">
            {loading && <div style={{ padding: 20, color: '#64748B' }}>Loading…</div>}
            {!loading && history.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                No attendance records for {MONTHS[month - 1]} {year}.
              </div>
            )}
            {!loading && history.map((r) => {
              const wh = Number(r.workedHours || 0);
              const hh = String(Math.floor(wh)).padStart(2, '0');
              const mm = String(Math.round((wh - Math.floor(wh)) * 60)).padStart(2, '0');
              return (
                <HistoryCard
                  key={r.date}
                  date={fmtDate(r.date)}
                  status={titleCase(r.status)}
                  statusClass={badgeClass(r.status)}
                  checkIn={fmtTime12(r.checkIn)}
                  checkOut={fmtTime12(r.checkOut)}
                  workingHrs={`${hh}:${mm}`}
                  onRequest={() => openRequest(r.date)}
                />
              );
            })}
          </div>

        </div>
      </div>

      {requestModalOpen && (
        <div className="attendance-modal-overlay">
          <div className="attendance-modal-content">
            <div className="attendance-modal-header">
              <h2>Request Regularization</h2>
              <button className="btn-close-modal" onClick={() => setRequestModalOpen(false)} type="button">
                <X size={20} />
              </button>
            </div>
            <div className="attendance-modal-body">
              {reqError && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, marginBottom: 10,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  color: '#991B1B', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <AlertCircle size={14} /> {reqError}
                </div>
              )}
              {requestDate && (
                <div style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>
                  For date: <strong>{requestDate}</strong>
                </div>
              )}
              <textarea
                placeholder="Enter your reason — e.g. forgot to check out, joined a client meeting outside, …"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={6}
              />
            </div>
            <div className="attendance-modal-footer">
              <button className="btn-submit-request" onClick={submitRequest} disabled={reqBusy} type="button">
                {reqBusy ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CustomDropdown = ({ options, defaultSelected, onSelect }) => {
  const [isOpen,   setIsOpen]   = useState(false);
  const [selected, setSelected] = useState(defaultSelected);
  const dropdownRef = useRef(null);
  useEffect(() => { setSelected(defaultSelected); }, [defaultSelected]);
  useEffect(() => {
    const onClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <button type="button" className={`dropdown-toggle ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <span>{selected}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? 'rotate' : ''}`} />
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          {options.map((opt) => (
            <div
              key={opt}
              className={`dropdown-item ${selected === opt ? 'selected' : ''}`}
              onClick={() => { setSelected(opt); setIsOpen(false); onSelect?.(opt); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LegendItem = ({ color, label }) => (
  <div className="legend-item">
    <div className="s-dot" style={{ backgroundColor: color }}></div>
    <span>{label}</span>
  </div>
);

const HistoryCard = ({ date, status, statusClass, checkIn, checkOut, workingHrs, onRequest }) => (
  <div className="history-detail-card card">
    <div className="h-card-header mb-4">
      <span className="h-date">{date}</span>
      <span className={`h-badge ${statusClass}`}>{status}</span>
    </div>
    <div className="h-card-metrics mb-4">
      <div className="h-metric">
        <div className="h-metric-val text-green">{checkIn}</div>
        <div className="h-metric-lbl">Check In</div>
      </div>
      <div className="h-metric">
        <div className="h-metric-val text-green">{checkOut}</div>
        <div className="h-metric-lbl">Check Out</div>
      </div>
      <div className="h-metric">
        <div className="h-metric-val text-green">{workingHrs}</div>
        <div className="h-metric-lbl">Working HR's</div>
      </div>
    </div>
    <button className="btn-request" onClick={onRequest} type="button">Request</button>
  </div>
);

export default Attendance;
