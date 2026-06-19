import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, X, AlertCircle, CheckCircle } from 'lucide-react';
import { attendanceAPI } from '../services/api';
import Spinner from '../components/Spinner';
import SubmitLoader from '../components/SubmitLoader';
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

  // The request window closes 2 days after the date the request is FOR.
  // Past that, the employee cannot file a regularization request for it.
  // Match the backend sweeper: pending requests older than 2 days are
  // auto-expired, so blocking the submit at the UI keeps the contract
  // consistent on both sides.
  const REQUEST_WINDOW_DAYS = 2;
  const isRequestWindowClosed = (() => {
    if (!requestDate) return false;
    const target = new Date(requestDate + 'T00:00:00');
    if (isNaN(target.getTime())) return false;
    const cutoff = Date.now() - REQUEST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return target.getTime() < cutoff;
  })();
  const requestWindowMessage = (() => {
    if (!requestDate || !isRequestWindowClosed) return '';
    const target = new Date(requestDate + 'T00:00:00');
    const daysAgo = Math.floor((Date.now() - target.getTime()) / 86400000);
    return 'Request window closed for this date (' + daysAgo + ' days ago). ' +
           'Regularization requests can only be filed within 2 days of the attendance date.';
  })();
  const [reqBusy,          setReqBusy]          = useState(false);
  const [reqError,         setReqError]         = useState('');
  const [reqSuccess,       setReqSuccess]       = useState('');

  // Map<YYYY-MM-DD, 'pending'|'approved'|'rejected'> of attendance
  // requests the user has already filed. Drives the per-row button
  // label so it mirrors ERM Mobile exactly — a request filed on mobile
  // shows "Requested" on web (and vice versa) without anyone refreshing.
  // Refreshed on mount + every time a new request is saved.
  const [requestedDates, setRequestedDates] = useState(new Map());
  const refreshRequestedDates = useCallback(async () => {
    try {
      const r = await attendanceAPI.listRequests();
      const items = Array.isArray(r?.data) ? r.data : [];
      const next = new Map();
      for (const x of items) {
        const date   = x?.date;
        const status = String(x?.status || '').toLowerCase();
        if (!date) continue;
        // Keep the most recent non-rejected status; a rejected row is
        // still recorded so the button shows "Rejected — tap to re-file".
        if (status === 'pending' || status === 'approved' || status === 'rejected') {
          const existing = next.get(date);
          if (!existing || existing === 'rejected') next.set(date, status);
        }
      }
      setRequestedDates(next);
    } catch { /* keep previous map on failure */ }
  }, []);
  useEffect(() => { refreshRequestedDates(); }, [refreshRequestedDates]);

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

  // #318 — Refetch when the browser tab regains focus. Without this, the
  // calendar+history shown on ERM Web stayed pinned to whatever state it
  // had at initial mount; a check-in performed from ERM Mobile while
  // ERM Web was open in another tab never appeared on Web until the
  // user reloaded the page. The window 'focus' event fires whenever the
  // user clicks back onto this tab, so we re-pull calendar + summary
  // every time. Cheap (two API calls, gated by month/year) and matches
  // the useFocusEffect we added on mobile.
  useEffect(() => {
    const onFocus = () => { load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  useEffect(() => {
    if (reqSuccess) {
      const t = setTimeout(() => setReqSuccess(''), 4000);
      return () => clearTimeout(t);
    }
  }, [reqSuccess]);

  // Build calendar grid: ONLY the selected month's dates (Jun 2026 —
  // mirror mobile behaviour at HR's request):
  //   • Leading offset cells are EMPTY placeholders so the first day
  //     falls in the correct weekday column.
  //   • Grid STOPS at the last day of the current month — NO greyed-out
  //     trailing dates from the next month appear below.
  //   • Final row is padded with empty cells to keep the 7-column track.
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  // Leading empty placeholders.
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: 0, current: false, iso: '' });
  }
  // Current month days.
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, current: true, iso });
  }
  // Trailing empty placeholders to complete the last row.
  while (cells.length % 7 !== 0) {
    cells.push({ day: 0, current: false, iso: '' });
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
    if (isRequestWindowClosed) {
      setReqError(requestWindowMessage);
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
      // Optimistic update + server reload so the row's button flips to
      // "Requested" immediately (mirrors mobile behaviour).
      setRequestedDates((prev) => {
        const next = new Map(prev);
        next.set(requestDate, 'pending');
        return next;
      });
      refreshRequestedDates();
      // Reload calendar + summary so the day's card now reflects the
      // newly-filed request. Uses the existing load() useCallback.
      try { await load(); } catch { /* non-fatal — toast already showed */ }
    } catch (err) {
      setReqError(err?.message || 'Could not submit request.');
    } finally {
      setReqBusy(false);
    }
  };

  // "Today" used by the future-gating logic below: forward navigation
  // is blocked once cursor reaches the current month, the forward
  // chevron is dimmed, the month/year dropdowns hide future options,
  // and in-month future days render as empty (no status colour).
  const todayRef = new Date();
  const curYear  = todayRef.getFullYear();
  const curMonth = todayRef.getMonth() + 1; // 1-indexed
  const curDay   = todayRef.getDate();
  const canGoForward = !(
    year > curYear || (year === curYear && month >= curMonth)
  );

  const stepMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1)  { m = 12; y -= 1; }
    if (m > 12) { m = 1;  y += 1; }
    // Block forward navigation past the current month — picking a
    // future month would just show "No attendance records" with no
    // explanation. Better to disable the action entirely.
    if (delta > 0 && (y > curYear || (y === curYear && m > curMonth))) return;
    setMonth(m); setYear(y);
  };

  // Dropdown options: only show months <= current month when the
  // selected year IS the current year. Years dropdown is clamped at
  // curYear so 2027 etc never appears.
  // Historical floor — the app launched June 2026. Disallow any
  // months/years before that (HR request — there are no records to
  // show pre-launch, so picking them confused employees).
  const YEAR_FLOOR  = 2026;
  const MONTH_FLOOR = 5; // June (0-indexed)
  const monthOptions = MONTHS.filter((_, i) => {
    if (year < YEAR_FLOOR) return false;
    if (year === YEAR_FLOOR && i < MONTH_FLOOR) return false;
    if (year < curYear) return true;
    if (year === curYear) return i <= curMonth - 1;
    return false;
  });
  const yearOptions = (() => {
    const out = [];
    for (let y = YEAR_FLOOR; y <= curYear; y++) out.push(String(y));
    return out;
  })();

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
                <button
                  className="icon-btn-minimal"
                  onClick={() => stepMonth(+1)}
                  type="button"
                  disabled={!canGoForward}
                  style={!canGoForward ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                ><ChevronRight size={20} /></button>
              </div>
            </div>

            <div className="calendar-grid mt-6">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <div key={d} className="weekday">{d}</div>
              ))}
              {cells.map((c, i) => {
                // Empty placeholder cell (leading offset or trailing
                // padding to complete the final row). Render blank so
                // the grid stays a perfect 7-column track but doesn't
                // show day numbers from adjacent months.
                if (!c.current || c.day === 0) {
                  return <div key={i} className="calendar-cell empty" />;
                }
                const rec = c.iso ? byDate[c.iso] : null;
                let status = rec?.status;
                // A future in-month day — keep the number visible but
                // dimmed and skip the status dot so the calendar reads
                // as "this hasn't happened yet", not "absent".
                const isFuture =
                  year > curYear ||
                  (year === curYear && month > curMonth) ||
                  (year === curYear && month === curMonth && c.day > curDay);
                // Past weekday with no record AND not a Sunday →
                // surface as Absent so HR's question "why is the
                // calendar blank?" goes away. Mirrors mobile #242.
                const cellDate = new Date(year, month - 1, c.day);
                const isPastWeekday =
                  !isFuture &&
                  cellDate.getDay() !== 0 &&
                  !(year === curYear && month === curMonth && c.day === curDay);
                if (isPastWeekday && !status) {
                  status = 'absent';
                }
                return (
                  <div key={i} className="calendar-cell">
                    <span
                      className="date-num"
                      style={isFuture ? { color: '#C7CDD6' } : undefined}
                    >{c.day}</span>
                    <div className="status-dots">
                      {status && !isFuture && (
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
                options={monthOptions}
                defaultSelected={MONTHS[month - 1]}
                onSelect={(label) => setMonth(MONTHS.indexOf(label) + 1)}
              />
              <CustomDropdown
                options={yearOptions}
                defaultSelected={String(year)}
                onSelect={(label) => {
                  const y = parseInt(label, 10);
                  setYear(y);
                  // If switching to current year while a future month is
                  // selected, clamp the month back to the current month so
                  // the user doesn't land on an empty future view.
                  if (y === curYear && month > curMonth) setMonth(curMonth);
                  // If switching to the floor year (2026) while a month
                  // before June is selected, clamp forward to June.
                  if (y === YEAR_FLOOR && month - 1 < MONTH_FLOOR) setMonth(MONTH_FLOOR + 1);
                }}
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
            {loading && <div style={{ padding: 20, color: '#334155' }}>Loading…</div>}
            {!loading && history.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#334155', fontSize: 13 }}>
                No attendance records for {MONTHS[month - 1]} {year}.
              </div>
            )}
            {!loading && history.map((r) => {
              const wh = Number(r.workedHours || 0);
              const hh = String(Math.floor(wh)).padStart(2, '0');
              const mm = String(Math.round((wh - Math.floor(wh)) * 60)).padStart(2, '0');
              const reqStatus = requestedDates.get(r.date) || '';
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
                  reqStatus={reqStatus}
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
                <div style={{ fontSize: 13, color: '#334155', marginBottom: 8 }}>
                  For date: <strong>{requestDate}</strong>
                </div>
              )}
              {isRequestWindowClosed && (
                <div style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 10,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  color: '#991B1B', fontSize: 12,
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{requestWindowMessage}</span>
                </div>
              )}
              <textarea
                placeholder="Enter your reason — e.g. forgot to check out, joined a client meeting outside, …"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={6}
                disabled={isRequestWindowClosed}
                style={isRequestWindowClosed ? { background: '#F8FAFC', color: '#475569' } : undefined}
              />
            </div>
            <div className="attendance-modal-footer">
              <button
                className="btn-submit-request"
                onClick={submitRequest}
                /* #305 — disable until the reason text reaches a usable length AND the window is open. */
                disabled={reqBusy || isRequestWindowClosed || (requestReason || '').trim().length < 3}
                type="button"
                title={isRequestWindowClosed ? 'Request window closed — past the 2-day cutoff' : ''}
                style={{ backgroundColor: (reqBusy || isRequestWindowClosed || (requestReason || '').trim().length < 3) ? '#94A3B8' : '#16A34A', color: '#fff', cursor: (reqBusy || isRequestWindowClosed || (requestReason || '').trim().length < 3) ? 'not-allowed' : 'pointer', opacity: (reqBusy || isRequestWindowClosed || (requestReason || '').trim().length < 3) ? 0.7 : 1, transition: 'background-color .15s, opacity .15s' }}
              >
                {reqBusy ? <Spinner size={14} label="Submitting…" /> : isRequestWindowClosed ? 'Window Closed' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Premium centered loader during attendance-request submit
          (#298). Driven by reqBusy which already disables the button. */}
      <SubmitLoader
        visible={reqBusy}
        label="Submitting attendance request"
        sub="Sending the request to your manager for review…"
      />
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

const HistoryCard = ({ date, status, statusClass, checkIn, checkOut, workingHrs, onRequest, reqStatus }) => {
  // Per-row button lifecycle (mirrors ERM Mobile):
  //   pending  → "Requested" (disabled, grey)
  //   approved → "Approved"  (disabled, green)
  //   rejected → "Rejected — tap to re-file" (enabled, red)
  //   none     → "Request" (enabled, primary)
  const isPending  = reqStatus === 'pending';
  const isApproved = reqStatus === 'approved';
  const isRejected = reqStatus === 'rejected';
  const btnDisabled = isPending || isApproved;
  let label = 'Request';
  if (isApproved)      label = 'Approved';
  else if (isRejected) label = 'Rejected — tap to re-file';
  else if (isPending)  label = 'Requested';
  const tintStyle =
    isPending  ? { background: '#E2E8F0', color: '#475569', cursor: 'not-allowed' } :
    isApproved ? { background: '#DCFCE7', color: '#15803D', cursor: 'not-allowed' } :
    isRejected ? { background: '#FCE4E4', color: '#B91C1C' } :
    undefined;
  return (
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
      <button
        className="btn-request"
        onClick={onRequest}
        type="button"
        disabled={btnDisabled}
        style={tintStyle}
      >
        {label}
      </button>
    </div>
  );
};

export default Attendance;
