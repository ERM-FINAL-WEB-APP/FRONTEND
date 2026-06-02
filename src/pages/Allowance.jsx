import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, AlertCircle, CheckCircle } from 'lucide-react';
import { allowanceAPI } from '../services/api';
import { useConfirm } from '../components/ConfirmDialog';
import './Allowance.css';

/* ─── Custom Dropdown ─────────────────────────────── */
const Dropdown = ({ options, defaultSelected, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(defaultSelected);
  const ref = useRef(null);

  useEffect(() => { setSelected(defaultSelected); }, [defaultSelected]);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="al-dropdown" ref={ref}>
      <button type="button" className={`al-dd-btn ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        {selected} <ChevronDown size={13} className={open ? 'spin' : ''} />
      </button>
      {open && (
        <div className="al-dd-menu">
          {options.map(o => (
            <div key={o} className={`al-dd-item ${selected === o ? 'sel' : ''}`}
              onClick={() => { setSelected(o); setOpen(false); onSelect?.(o); }}>{o}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function todayISO() { return new Date().toISOString().split('T')[0]; }
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
function titleCase(s) {
  s = String(s || '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1) || 'Pending';
}

/* ─── Travel History Card ─────────────────────────── */
const TravelCard = ({ date, from, to, amount, status, note }) => (
  <div className="al-hist-card">
    <div className="ahc-row-top">
      <span className="ahc-date">{date}</span>
      <span className={`ahc-badge badge-${status.toLowerCase()}`}>{status}</span>
    </div>
    <div className="ahc-metrics">
      <div className="ahc-col">
        <span className="ahc-col-label">From</span>
        <span className="ahc-col-val">{from}</span>
      </div>
      <div className="ahc-col">
        <span className="ahc-col-label">To</span>
        <span className="ahc-col-val">{to}</span>
      </div>
      <div className="ahc-col">
        <span className="ahc-col-label">Amount</span>
        <span className="ahc-col-val">₹{amount}</span>
      </div>
    </div>
    {note && <div className="ahc-note"><b>Notes:</b> {note}</div>}
  </div>
);

/* ─── Petrol History Card ─────────────────────────── */
const PetrolCard = ({ date, distance, amount, status }) => (
  <div className="al-hist-card petrol-card">
    <div className="ahc-row-top">
      <span className="ahc-date">{date}</span>
    </div>
    <div className="ahc-metrics align-center">
      <div className="ahc-col">
        <span className="ahc-col-label">Distance</span>
        <span className="ahc-col-val-sm">{distance} Km</span>
      </div>
      <div className="ahc-col">
        <span className="ahc-col-label">Amount</span>
        <span className="ahc-col-val-sm">₹{amount}</span>
      </div>
      <span className={`ahc-badge badge-${status.toLowerCase()}`}>{status}</span>
    </div>
  </div>
);

/* ─── Main Allowance Page ─────────────────────────── */
const Allowance = () => {
  const [type, setType] = useState('travel');

  // Form state (shared between travel/petrol — distance only used for petrol)
  const [fromLoc,  setFromLoc]  = useState('');
  const [toLoc,    setToLoc]    = useState('');
  const [date,     setDate]     = useState(todayISO());
  const [amount,   setAmount]   = useState('');
  const [distance, setDistance] = useState('');
  const [notes,    setNotes]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const confirm = useConfirm();

  // Filters + history
  // ERM rolled out company-wide in June 2026 — pre-launch months have
  // no records, so the pickers AND the initial state floor at June
  // 2026 instead of "today".
  const LAUNCH_MONTH = 6;
  const LAUNCH_YEAR  = 2026;
  const now = new Date();
  const _curM = now.getMonth() + 1;
  const _curY = now.getFullYear();
  const _atOrAfterLaunch =
    _curY > LAUNCH_YEAR || (_curY === LAUNCH_YEAR && _curM >= LAUNCH_MONTH);
  const [month, setMonth] = useState(_atOrAfterLaunch ? _curM : LAUNCH_MONTH);
  const [year,  setYear]  = useState(_atOrAfterLaunch ? _curY : LAUNCH_YEAR);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ approved: 0, pending: 0, rejected: 0, totalDistance: 0 });

  const loadHistory = useCallback(async () => {
    try {
      const [listRes, sumRes] = await Promise.all([
        allowanceAPI.getMyAllowances({ month, year, type }),
        allowanceAPI.getSummary({ month, year, type }),
      ]);
      setItems(Array.isArray(listRes.data) ? listRes.data : (listRes.data?.items || []));
      setSummary(sumRes.data || {});
    } catch {
      setItems([]);
      setSummary({ approved: 0, pending: 0, rejected: 0, totalDistance: 0 });
    }
  }, [month, year, type]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Clear feedback after a few seconds.
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const submitClaim = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!fromLoc.trim() || !toLoc.trim()) { setError('Enter both From and To locations.'); return; }
    if (!date) { setError('Pick a date.'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return; }
    if (type === 'petrol' && (!distance || Number(distance) <= 0)) {
      setError('Enter the distance travelled (km).'); return;
    }
    setBusy(true);
    try {
      if (!(await confirm({ title: 'Submit allowance claim?', message: 'HR will review the claim once you confirm.', confirmLabel: 'Submit' }))) { setBusy(false); return; }
      await allowanceAPI.submit({
        type,
        fromLocation: fromLoc.trim(),
        toLocation:   toLoc.trim(),
        date,
        amount:       amt,
        distance:     type === 'petrol' ? Number(distance) : undefined,
        notes:        notes.trim(),
        purpose:      type === 'petrol' ? 'Daily Commute' : 'Client Meeting',
        transport:    type === 'petrol' ? 'Bike' : 'Car',
      });
      setSuccess(`${type === 'petrol' ? 'Petrol' : 'Travel'} claim submitted. HR has been notified.`);
      setFromLoc(''); setToLoc(''); setAmount(''); setDistance(''); setNotes('');
      loadHistory();
    } catch (err) {
      setError(err?.message || 'Could not submit claim.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="al-page">
      <div className="al-layout">

        {/* ══════════ LEFT PANEL ══════════ */}
        <div className="al-left">
          {/* Type Selector */}
          <p className="al-type-title">Select Allowance Type</p>
          <div className="al-type-row">
            <button type="button" className={`al-type-btn ${type === 'travel' ? 'active' : ''}`} onClick={() => setType('travel')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="2"/><path d="m16 8 5 0 2 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
              <span className="al-type-name">Travel</span>
              <span className="al-type-sub">Official Meetings</span>
            </button>
            <button type="button" className={`al-type-btn ${type === 'petrol' ? 'active' : ''}`} onClick={() => setType('petrol')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 22h12M4 9h10M4 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3"/><path d="M14 12.5V14a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L16 7"/>
              </svg>
              <span className="al-type-name">Petrol</span>
              <span className="al-type-sub">Daily Commute</span>
            </button>
          </div>

          {/* For Petrol the mobile app shows NO form — petrol is auto-derived
              from travel records. Mirror that here: no From / To / Date /
              Distance / Amount inputs when the user is on the Petrol tab. */}
          {type === 'petrol' && (
            <div
              style={{
                margin: '8px 0 16px',
                padding: '18px 18px',
                borderRadius: 12,
                background: '#F8FAFC',
                border: '1px dashed #CBD5E1',
                color: '#475569',
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', marginBottom: 4 }}>
                Petrol is calculated from your Travel claims
              </div>
              You don't need to submit a separate petrol request. The distance
              and amount from your approved Travel records are reimbursed at
              the company's per-km rate — review the breakdown on the right.
            </div>
          )}

          {/* Submit form — Travel only; Petrol uses the derived summary above. */}
          {type === 'travel' && (
          <form className="al-form" onSubmit={submitClaim}>
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

            <div className="al-form-group">
              <label>From</label>
              <div className="al-input-wrap">
                <svg className="al-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAA17" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                <input className="al-input" placeholder="e.g. Office HQ" value={fromLoc} onChange={(e) => setFromLoc(e.target.value)} />
              </div>
            </div>
            <div className="al-form-group">
              <label>To</label>
              <div className="al-input-wrap">
                <svg className="al-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                <input className="al-input" placeholder="Enter Destination" value={toLoc} onChange={(e) => setToLoc(e.target.value)} />
              </div>
            </div>
            <div className="al-form-group">
              <label>Date</label>
              <div className="al-input-wrap">
                <svg className="al-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                <input type="date" className="al-input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            {type === 'petrol' && (
              <div className="al-form-group">
                <label>Distance (Km)</label>
                <input className="al-input no-icon" placeholder="e.g. 15" type="number" min="0" step="0.1"
                  value={distance} onChange={(e) => setDistance(e.target.value)} />
              </div>
            )}
            <div className="al-form-group">
              <label>Amount (₹)</label>
              <input className="al-input no-icon" placeholder="Enter Amount" type="number" min="0"
                value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            {type === 'travel' && (
              <div className="al-form-group">
                <label>Notes</label>
                <textarea className="al-input no-icon al-textarea" rows={3} placeholder="Add details about the visit..."
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            )}
            <button type="submit" className="al-submit-btn" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </form>
          )}
        </div>

        {/* ══════════ RIGHT PANEL ══════════ */}
        <div className="al-right">
          <h3 className="al-hist-title">History</h3>
          <div className="al-filter-row mb-16">
            <span className="al-this-month">Month</span>
            <Dropdown
              options={year === LAUNCH_YEAR ? MONTHS_SHORT.slice(LAUNCH_MONTH - 1) : MONTHS_SHORT}
              defaultSelected={MONTHS_SHORT[month - 1]}
              onSelect={(m) => setMonth(MONTHS_SHORT.indexOf(m) + 1)}
            />
            <Dropdown
              options={Array.from({ length: 4 }, (_, i) => String(LAUNCH_YEAR + i))}
              defaultSelected={String(year)}
              onSelect={(y) => setYear(parseInt(y, 10))}
            />
          </div>

          {type === 'travel' && (
            <div className="al-stats-3col">
              <div className="al-stat-3 al-green">
                <div className="al-s-label">APPROVED AMOUNT</div>
                <div className="al-s-value">₹{Number(summary.approved || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="al-stat-3 al-red">
                <div className="al-s-label">REJECTED AMOUNT</div>
                <div className="al-s-value">₹{Number(summary.rejected || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="al-stat-3 al-orange">
                <div className="al-s-label">PENDING AMOUNT</div>
                <div className="al-s-value">₹{Number(summary.pending || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}

          {type === 'petrol' && (
            <div className="al-stats-grid-2x2">
              <div className="al-stat-card al-blue">
                <div className="al-s-label">TRAVEL DISTANCE</div>
                <div className="al-s-value">{Number(summary.totalDistance || 0)} km</div>
              </div>
              <div className="al-stat-card al-green">
                <div className="al-s-label">APPROVED AMOUNT</div>
                <div className="al-s-value">₹{Number(summary.approved || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="al-stat-card al-orange">
                <div className="al-s-label">PENDING AMOUNT</div>
                <div className="al-s-value">₹{Number(summary.pending || 0).toLocaleString('en-IN')}</div>
              </div>
              <div className="al-stat-card al-red">
                <div className="al-s-label">REJECTED AMOUNT</div>
                <div className="al-s-value">₹{Number(summary.rejected || 0).toLocaleString('en-IN')}</div>
              </div>
            </div>
          )}

          <div className="al-cards-list" style={{ marginTop: 16 }}>
            {items.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                No {type} claims for {MONTHS_SHORT[month - 1]} {year}.
              </div>
            )}
            {items.map((a) =>
              type === 'travel'
                ? <TravelCard
                    key={a._id}
                    date={fmtDate(a.date)}
                    from={a.fromLocation}
                    to={a.toLocation}
                    amount={a.amount}
                    status={titleCase(a.status)}
                    note={a.notes || a.hrComment}
                  />
                : <PetrolCard
                    key={a._id}
                    date={fmtDate(a.date)}
                    distance={a.distance || 0}
                    amount={a.amount}
                    status={titleCase(a.status)}
                  />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Allowance;
