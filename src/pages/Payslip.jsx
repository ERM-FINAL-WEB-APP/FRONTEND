import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, ChevronDown, Pointer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { payslipAPI, profileAPI } from '../services/api';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import './Payslip.css';

/**
 * Payslip — list employee's payslips and show a breakdown for the
 * selected one. Pulls from GET /api/payslip/history. Each card has
 * its own download link (server-rendered PDF when available, else
 * a JSON fallback). The "Request" button posts to /payslip/request
 * which queues an HR action (HRMS sees this in their queue).
 */

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Date-range helpers ───────────────────────────────────────────
// Payslip dropdown is anchored to the EMPLOYEE's joining date — they
// can't have payslips from before they joined the company. The year
// dropdown runs from joiningYear → currentYear; the month dropdown
// inside any given year is clamped to [joinMonth..now].
//
// Hard floor of April 2025 (when company payroll actually started)
// applies if the user's joining date is somehow older than that.
const PAYROLL_ABS_FLOOR_YEAR  = 2025;
const PAYROLL_ABS_FLOOR_MONTH = 4;

function buildYearOptions(joinYear) {
  const current = new Date().getFullYear();
  const start = Math.max(joinYear || PAYROLL_ABS_FLOOR_YEAR, PAYROLL_ABS_FLOOR_YEAR);
  const out = [];
  for (let y = start; y <= current; y++) out.push(String(y));
  return out;
}
function buildMonthOptions(year, joinYear, joinMonth) {
  const now      = new Date();
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth() + 1;     // 1-12, current in-progress month
  // Lower bound this year: joinMonth if it's the joining year, else 1.
  // Also respect the absolute April-2025 floor for users whose joining
  // date predates company payroll.
  let startMonth = 1;
  if (year === joinYear) startMonth = Math.max(joinMonth || 1, year === PAYROLL_ABS_FLOOR_YEAR ? PAYROLL_ABS_FLOOR_MONTH : 1);
  else if (year === PAYROLL_ABS_FLOOR_YEAR) startMonth = PAYROLL_ABS_FLOOR_MONTH;
  // Upper bound: payslips are only available for FULLY COMPLETED months,
  // so the current month is never offered. In the current year we stop
  // at curMonth - 1; in past years we stop at 12.
  const endMonth = (year === curYear) ? Math.max(0, curMonth - 1) : 12;
  const out = [];
  for (let m = startMonth; m <= endMonth; m++) out.push(MONTH_SHORT[m - 1]);
  return out;
}

// Parse an ISO joining date into { year, month }. Tolerant of empty
// values (falls back to the absolute floor so the dropdown never blanks).
function parseJoiningDate(iso) {
  if (!iso) return { year: PAYROLL_ABS_FLOOR_YEAR, month: PAYROLL_ABS_FLOOR_MONTH };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { year: PAYROLL_ABS_FLOOR_YEAR, month: PAYROLL_ABS_FLOOR_MONTH };
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function inr(n) {
  return Number(n || 0).toLocaleString('en-IN');
}
function fmtRange(month, year) {
  if (!month || !year) return '';
  const m = parseInt(month, 10);
  const lastDay = new Date(year, m, 0).getDate();
  const pad = (x) => String(x).padStart(2, '0');
  return `${pad(1)}/${pad(m)}/${year} - ${pad(lastDay)}/${pad(m)}/${year}`;
}

/* ─── Dropdown ───────────────────────────────────── */
const Dropdown = ({ options, defaultSelected, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(defaultSelected);
  const ref = useRef(null);
  useEffect(() => { setSel(defaultSelected); }, [defaultSelected]);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div className="ps-dd" ref={ref}>
      <button type="button" className={`ps-dd-btn ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        {sel} <ChevronDown size={13} className={open ? 'spin' : ''} />
      </button>
      {open && (
        <div className="ps-dd-menu">
          {options.map(o => (
            <div key={o} className={`ps-dd-item ${sel === o ? 'sel' : ''}`}
              onClick={() => { setSel(o); setOpen(false); onSelect?.(o); }}>{o}</div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Donut Chart ─────────────────────────────────── */
const DonutChart = ({ size = 260, strokeWidth = 28, earnings, deductions }) => {
  const total = Math.max(1, (Number(earnings) || 0) + (Number(deductions) || 0));
  const earningsPct = ((Number(earnings) || 0) / total) * 100;
  const deductionsPct = ((Number(deductions) || 0) / total) * 100;

  const chartData = [
    { value: earningsPct,   color: '#4CAA17' },
    { value: deductionsPct, color: '#DC2626' },
  ].filter(c => c.value > 0);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  let currentAngle = -Math.PI / 2 + 0.03;

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ filter: 'drop-shadow(2px 8px 12px rgba(0,0,0,0.25))', overflow: 'visible' }}>
        {chartData.map((item, i) => {
          const fraction = item.value / 100;
          const angle = fraction * 2 * Math.PI - (chartData.length > 1 ? 0.06 : 0);
          const nextAngle = currentAngle + angle;
          const startX = cx + Math.cos(currentAngle) * r;
          const startY = cy + Math.sin(currentAngle) * r;
          const endX = cx + Math.cos(nextAngle) * r;
          const endY = cy + Math.sin(nextAngle) * r;
          const largeArcFlag = fraction > 0.5 ? 1 : 0;
          const pathData = `M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
          currentAngle = nextAngle + 0.06;
          return (
            <path key={i} d={pathData} fill="none" stroke={item.color}
              strokeWidth={strokeWidth} strokeLinecap="butt" />
          );
        })}
      </svg>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ fontSize: '36px', fontWeight: '800', color: '#222' }}>
          ₹{inr(earnings)}
        </div>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#888', marginTop: '4px' }}>Gross Pay</div>
      </div>
    </div>
  );
};

/* ─── History Card ────────────────────────────────── */
const historyColors = ['#F59E0B', '#F97316', '#8B5CF6', '#3B82F6', '#4CAA17', '#EF4444'];

const HistoryCard = ({ month, dateRange, amount, colorIndex, onClick, active, downloadUrl, onDownload }) => {
  const color = historyColors[colorIndex % historyColors.length];
  return (
    <div
      className={`ps-hist-card ${active ? 'ps-hist-active' : ''}`}
      style={{ borderLeftColor: color }}
      onClick={onClick}
    >
      <div className="ps-hc-left">
        <div className="ps-hc-icon" style={{ background: color }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          </svg>
        </div>
        <div className="ps-hc-info">
          <span className="ps-hc-month">{month}</span>
          <span className="ps-hc-dates">{dateRange}</span>
        </div>
      </div>
      <div className="ps-hc-right">
        <span className="ps-hc-amount">₹{amount}</span>
        {(downloadUrl || onDownload) && (
          <button
            type="button"
            className="ps-dl-btn"
            onClick={(e) => { e.stopPropagation(); if (downloadUrl) { window.open(downloadUrl, '_blank'); } else { onDownload(); } }}
            title="Download PDF"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Download size={15} />
          </button>
        )}
      </div>
    </div>
  );
};

const DetailRow = ({ label, amount }) => (
  <div className="ps-detail-row">
    <span>{label}</span>
    <span>₹{inr(amount)}</span>
  </div>
);

// ── Client-side PDF generator ───────────────────────────────────────
// The backend stores earnings + deductions but no PDF file, so the
// download button used to be permanently dark. Instead of plumbing a
// server-side renderer (puppeteer / pdfkit), we build the PDF in the
// browser from the same payslip object the page is already showing.
// Works for every payslip whose status is 'processed' / 'uploaded'.
function generatePayslipPdf(payslip, employee) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();
  let y = 40;
  const rupee = (n) => 'INR ' + Number(n || 0).toLocaleString('en-IN');
  const M = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('Tesco ERM — Payslip', 40, y); y += 28;
  doc.setFontSize(12); doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${M[Number(payslip.month)||0] || ''} ${payslip.year || ''}`, 40, y); y += 18;
  if (employee?.name)        { doc.text('Employee: ' + employee.name, 40, y); y += 16; }
  if (employee?.employeeId)  { doc.text('Employee ID: ' + employee.employeeId, 40, y); y += 16; }
  if (employee?.designation) { doc.text('Designation: ' + employee.designation, 40, y); y += 16; }
  y += 12;
  doc.setDrawColor(220); doc.line(40, y, W - 40, y); y += 18;

  // Earnings
  doc.setFont('helvetica', 'bold'); doc.text('Earnings', 40, y); y += 16;
  doc.setFont('helvetica', 'normal');
  const earnings = payslip.earnings || {};
  const earningRows = Object.entries(earnings);
  if (earningRows.length === 0) earningRows.push(['Basic', payslip.grossPay || 0]);
  for (const [k, v] of earningRows) {
    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    doc.text(label, 40, y);
    doc.text(rupee(v), W - 40, y, { align: 'right' });
    y += 14;
  }
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Gross Pay', 40, y);
  doc.text(rupee(payslip.grossPay || 0), W - 40, y, { align: 'right' });
  y += 22;

  // Deductions
  doc.setFont('helvetica', 'bold'); doc.text('Deductions', 40, y); y += 16;
  doc.setFont('helvetica', 'normal');
  const dd = payslip.deductionsDetail || {};
  const dRows = Object.entries(dd);
  if (dRows.length === 0) dRows.push(['Total Deductions', payslip.deductions || 0]);
  for (const [k, v] of dRows) {
    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    doc.text(label, 40, y);
    doc.text(rupee(v), W - 40, y, { align: 'right' });
    y += 14;
  }
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Deductions', 40, y);
  doc.text(rupee(payslip.deductions || 0), W - 40, y, { align: 'right' });
  y += 28;

  // Net pay
  doc.setFillColor(241, 249, 238);
  doc.rect(40, y - 16, W - 80, 36, 'F');
  doc.setFontSize(13);
  doc.text('Net Pay', 50, y + 6);
  doc.text(rupee(payslip.netPay || (payslip.grossPay - payslip.deductions) || 0), W - 50, y + 6, { align: 'right' });

  const fname = `Payslip_${M[Number(payslip.month)||0] || ''}_${payslip.year || ''}.pdf`;
  doc.save(fname);
}

/* ─── Main Payslip Component ─────────────────────── */
const Payslip = () => {
  const { user } = useAuth();
  // Joining info — seeded from the cached auth user (filled by AuthContext
  // at login) and refreshed via /api/profile on mount so the dropdown
  // always reflects the latest HRMS data.
  const seedJoining = parseJoiningDate(user?.joiningDate);
  const [joining, setJoining] = useState(seedJoining);
  const [year,     setYear]     = useState(() => new Date().getFullYear());
  const [month,    setMonth]    = useState(() => new Date().getMonth() + 1);
  const [payslips, setPayslips] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [reqBusy,  setReqBusy]  = useState(false);
  const [reqDone,  setReqDone]  = useState('');
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await payslipAPI.getHistory(year);
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || []);
      // Normalise to a consistent shape.
      const normalised = list.map((p) => ({
        _id:         p._id,
        month:       p.month || (p.period?.split('-')?.[1]),
        year:        p.year  || (p.period?.split('-')?.[0]),
        netPay:      p.netPay      ?? p.amount ?? 0,
        grossPay:    p.grossPay    ?? p.totalEarnings ?? p.amount ?? 0,
        deductions:  p.totalDeductions ?? p.deductions ?? 0,
        earnings:    p.earnings    || {},
        deductionsDetail: p.deductionsDetail || p.deductionsBreakdown || {},
        downloadUrl: p.downloadUrl || p.pdfUrl || '',
        status:      String(p.status || '').toLowerCase(),
      }));
      // Filter to the selected month — payslip backend may return
      // the entire year and we only want one month at a time.
      //
      // Also drop any row whose month hasn't ended yet (payslips are
      // generated only AFTER the calendar month is over, so a row for
      // June while today is June 1 is a leftover stub from an early
      // request and we shouldn't surface it).
      const now = new Date();
      const curMonth = now.getMonth() + 1;
      const curYear  = now.getFullYear();
      const isMonthOver = (m, y) =>
        !m || !y || y < curYear || (y === curYear && m < curMonth);
      const filtered = normalised.filter((row) => {
        const m = parseInt(row.month, 10);
        const y = parseInt(row.year,  10);
        if (m && y && !isMonthOver(m, y)) return false; // hide current/future months
        return !m || m === month;
      });
      // Newest first.
      filtered.sort((a, b) => {
        const k = (x) => `${x.year || 0}-${String(x.month || 0).padStart(2, '0')}`;
        return k(b).localeCompare(k(a));
      });
      setPayslips(filtered);
      setSelected(0);
    } catch (err) {
      setError(err?.message || 'Could not load payslips.');
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // Refresh joining date from the profile endpoint on EVERY mount —
  // the backend response carries the user object spread at the root so
  // `res.data.joiningDate` is the canonical field. We also try a few
  // legacy shapes (.user, .profile) so this works whether the backend
  // gets refactored or not. If none of them yield a value we log a
  // warning so it's obvious why the dropdown defaulted to April 2025.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await profileAPI.getProfile();
        const j = res?.data?.joiningDate
               || res?.data?.user?.joiningDate
               || res?.data?.profile?.joiningDate
               || res?.data?.employee?.joiningDate
               || null;
        if (!cancelled) {
          if (j) {
            setJoining(parseJoiningDate(j));
          } else {
            console.warn('[payslip] profile response has no joiningDate; ' +
              'dropdown will fall back to the payroll floor (April 2025).');
          }
        }
      } catch (err) {
        console.warn('[payslip] could not refresh joining date:', err?.message || err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const current = payslips[selected];

  // What state is the selected month in?
  //   • 'ready'      — HR has uploaded; downloadUrl present (or status=processed).
  //   • 'requested'  — employee already filed a request; HR hasn't acted yet.
  //   • 'none'       — nothing on file; employee can request a new payslip.
  // The Request button is disabled in the first two states, and a hint
  // tells the user why. Once HR uploads, the row will arrive on the next
  // /payslip/history poll with downloadUrl populated and the Download
  // button lights up.
  const monthState = (() => {
    // The currently-selected month isn't over yet → don't pretend to
    // have a payslip story for it. Block both "ready" and "requested".
    const now = new Date();
    const _cm = now.getMonth() + 1, _cy = now.getFullYear();
    const monthNotOverYet = (year > _cy) || (year === _cy && month >= _cm);
    if (monthNotOverYet) return 'tooEarly';
    if (!current) return 'none';
    const status = String(current.status || '').toLowerCase();
    if (current.downloadUrl || status === 'processed' || status === 'uploaded') return 'ready';
    if (status === 'requested' || status === 'pending')                          return 'requested';
    // Anything else (rejected, cancelled, empty status, garbage) → let
    // the employee re-file. Earlier we returned 'requested' here, which
    // locked the Request button forever after a rejection.
    return 'none';
  })();

  const requestPayslip = async () => {
    // Belt-and-braces — the button is disabled in non-'none' states, but
    // someone could still trigger it via keyboard. Block the duplicate
    // server-side too.
    if (monthState !== 'none') {
      setError(monthState === 'ready'
        ? 'Payslip for this month is already generated. You can download it on the right.'
        : 'You have already requested this payslip. HR will be notified.');
      setTimeout(() => setError(''), 3500);
      return;
    }
    setReqBusy(true);
    setReqDone('');
    try {
      // Request the SELECTED month/year, not the current month — the
      // employee may be scrolling back through their history.
      if (!(await confirm({ title: 'Request payslip?', message: `HR will be notified for ${MONTH_SHORT[month-1]} ${year}.`, confirmLabel: 'Request' }))) { setReqBusy(false); return; }
      await payslipAPI.request(month, year);
      setReqDone('Request sent to HR.');
      setTimeout(() => setReqDone(''), 3000);
      // Refresh the history so the row shows up immediately as
      // "requested" and the button locks.
      load();
    } catch (err) {
      setError(err?.message || 'Could not send request.');
    } finally {
      setReqBusy(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || user?.firstName || 'there';

  return (
    <div className="ps-page">
      <div className="ps-layout">

        {/* ══ LEFT: History ══════════════════════════ */}
        <div className="ps-left">
          <div className="ps-greeting">
            <h2 className="ps-hey">Hey {firstName} 👋</h2>
            <p className="ps-sub">Welcome to your pay summary</p>
          </div>

          <div className="ps-hist-header">
            <span className="ps-hist-title">Payslip History</span>
            <Dropdown
              options={buildMonthOptions(year, joining.year, joining.month)}
              defaultSelected={MONTH_SHORT[month - 1]}
              onSelect={(m) => setMonth(MONTH_SHORT.indexOf(m) + 1)}
            />
            <Dropdown
              options={buildYearOptions(joining.year)}
              defaultSelected={String(year)}
              onSelect={(y) => {
                const newYear = parseInt(y, 10);
                setYear(newYear);
                const valid = buildMonthOptions(newYear, joining.year, joining.month);
                const currentLabel = MONTH_SHORT[month - 1];
                if (!valid.includes(currentLabel)) {
                  const fallback = valid[valid.length - 1] || MONTH_SHORT[joining.month - 1];
                  setMonth(MONTH_SHORT.indexOf(fallback) + 1);
                }
              }}
            />
          </div>

          {error && (
            <div style={{
              margin: '12px 0', padding: '10px 12px',
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 8, color: '#991B1B', fontSize: 13,
            }}>{error}</div>
          )}

          <div className="ps-hist-list">
            {loading && <div style={{ padding: 20, color: '#334155' }}>Loading…</div>}
            {(() => {
              // Hide pending stubs from the visible cards. The mobile
              // backend creates a pending row whenever the employee
              // hits "Request"; it has no real amounts so showing it
              // looked like a fake "sample" payslip in the history.
              // We still keep the row in `payslips` so monthState can
              // detect "requested" — only the visible list filters it
              // out.
              const _ready = payslips.filter(
                (r) => r.downloadUrl || r.status === 'processed' || r.status === 'uploaded'
              );
              if (!loading && _ready.length === 0) {
                return (
                  <div style={{ padding: 24, textAlign: 'center', color: '#334155', fontSize: 13 }}>
                    No payslips for {year} yet. Click "Request" below to ask HR to generate one.
                  </div>
                );
              }
              return _ready.map((p, i) => (
                <HistoryCard
                  key={p._id || `${p.year}-${p.month}-${i}`}
                  month={`${MONTH_SHORT[(parseInt(p.month, 10) || 1) - 1]} ${p.year}`}
                  dateRange={fmtRange(p.month, p.year)}
                  amount={inr(p.netPay || p.grossPay)}
                  colorIndex={i}
                  active={selected === i}
                  onClick={() => setSelected(i)}
                  downloadUrl={p.downloadUrl}
                  onDownload={() => generatePayslipPdf(p, user || {})}
                />
              ));
            })()}
          </div>
        </div>

        {/* ══ RIGHT: Summary ══════════════════════════ */}
        <div className="ps-right">
          {/* The summary panel only fills in once HR has uploaded the
              actual payslip (monthState === 'ready'). For 'requested'
              and 'none' we show a placeholder card so the employee
              doesn't see meaningless ₹0 figures. */}
          {monthState === 'ready' ? (
            <h3 className="ps-summary-title">Payslip Summary</h3>
          ) : null}

          {monthState !== 'ready' && (
            <div style={{
              marginTop: 40, padding: '40px 24px',
              background: '#F8FAFC', border: '1px dashed #CBD5E1',
              borderRadius: 12, textAlign: 'center',
            }}>
              <div style={{ fontSize: 38, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
                {monthState === 'requested'
                  ? `Requested for ${MONTH_SHORT[month - 1]} ${year}`
                  : monthState === 'tooEarly'
                  ? `${MONTH_SHORT[month - 1]} ${year} is not over yet`
                  : `No payslip yet for ${MONTH_SHORT[month - 1] || ''} ${year}`}
              </div>
              <div style={{ fontSize: 13, color: '#334155', maxWidth: 360, margin: '0 auto', lineHeight: 1.55 }}>
                {monthState === 'requested'
                  ? 'HR has been notified. Your payslip will appear here once it has been uploaded — you will be able to download it from this page.'
                  : monthState === 'tooEarly'
                  ? 'Payslips are generated after the calendar month ends. Come back on the 1st of next month to request your payslip.'
                  : 'Hit the Request button on the left to ask HR to generate this payslip.'}
              </div>
            </div>
          )}

          {monthState === 'ready' && current && (
            <>
              <div className="ps-chart-wrap" style={{ marginTop: '20px' }}>
                <DonutChart
                  size={280}
                  strokeWidth={24}
                  earnings={current.grossPay}
                  deductions={current.deductions}
                />
              </div>

              <div className="ps-legend" style={{ display: 'flex', justifyContent: 'space-around', marginTop: '40px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#4CAA17', marginTop: '6px' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '22px', fontWeight: '800', color: '#222', lineHeight: '1.2' }}>
                      ₹{inr(current.grossPay)}
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#888' }}>Earnings</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#DC2626', marginTop: '6px' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '22px', fontWeight: '800', color: '#222', lineHeight: '1.2' }}>
                      ₹{inr(current.deductions)}
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#888' }}>Deductions</span>
                  </div>
                </div>
              </div>

              <h4 className="ps-section-title">Earning Details</h4>
              <div className="ps-detail-card">
                {Object.entries(current.earnings || {}).length === 0 && (
                  <DetailRow label="Basic" amount={current.grossPay} />
                )}
                {Object.entries(current.earnings || {}).map(([label, amount]) => (
                  <DetailRow
                    key={label}
                    label={label.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                    amount={amount}
                  />
                ))}
              </div>

              <h4 className="ps-section-title mt-6">Deductions</h4>
              <div className="ps-detail-card">
                {Object.entries(current.deductionsDetail || {}).length === 0 && (
                  <DetailRow label="Total Deductions" amount={current.deductions} />
                )}
                {Object.entries(current.deductionsDetail || {}).map(([label, amount]) => (
                  <DetailRow
                    key={label}
                    label={label.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                    amount={amount}
                  />
                ))}
              </div>
            </>
          )}

          {reqDone && (
            <div style={{
              margin: '12px 0', padding: '10px 12px',
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: 8, color: '#15803D', fontSize: 13,
            }}>{reqDone}</div>
          )}

          {monthState === 'requested' && (
            <div style={{
              margin: '12px 0', padding: '10px 12px',
              background: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: 8, color: '#92400E', fontSize: 13,
            }}>
              Request already sent. HR will upload this payslip — you'll be notified.
            </div>
          )}
          {monthState === 'tooEarly' && (
            <div style={{
              margin: '12px 0', padding: '10px 12px',
              background: '#F1F5F9', border: '1px solid #CBD5E1',
              borderRadius: 8, color: '#475569', fontSize: 13,
            }}>
              This month isn't over yet — payslips can only be requested after the calendar month ends.
            </div>
          )}
          {monthState === 'ready' && (
            <div style={{
              margin: '12px 0', padding: '10px 12px',
              background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: 8, color: '#15803D', fontSize: 13,
            }}>
              Payslip ready — use Download on the right.
            </div>
          )}
          <div className="ps-actions">
            <button
              className="ps-btn-request"
              onClick={requestPayslip}
              disabled={reqBusy || monthState !== 'none'}
              type="button"
              title={
                monthState === 'ready' ? 'Payslip already generated for this month'
                : monthState === 'requested' ? 'Already requested — wait for HR to upload'
                : monthState === 'tooEarly' ? 'Month not over yet'
                : ''
              }
            >
              <Pointer size={18} />
              {reqBusy ? 'Requesting…'
                : monthState === 'ready'      ? 'Already generated'
                : monthState === 'requested'  ? 'Requested'
                : monthState === 'tooEarly'   ? 'Not yet available'
                : 'Request'}
            </button>
            {current?.downloadUrl ? (
              <a className="ps-btn-download" href={current.downloadUrl} download={`Payslip_${MONTH_SHORT[month-1]}_${year}.pdf`}>
                <Download size={17} /> Download
              </a>
            ) : current && monthState === 'ready' ? (
              <button
                className="ps-btn-download"
                type="button"
                onClick={() => generatePayslipPdf(current, user || {})}
              >
                <Download size={17} /> Download
              </button>
            ) : (
              <button className="ps-btn-download" type="button" disabled title="Payslip not yet generated by HR">
                <Download size={17} /> Download
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Payslip;
