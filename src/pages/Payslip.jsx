import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, ChevronDown, Pointer } from 'lucide-react';
import { payslipAPI } from '../services/api';
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

const HistoryCard = ({ month, dateRange, amount, colorIndex, onClick, active, downloadUrl }) => {
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
        {downloadUrl && (
          <a className="ps-dl-btn" href={downloadUrl} download onClick={(e) => e.stopPropagation()}>
            <Download size={15} />
          </a>
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

/* ─── Main Payslip Component ─────────────────────── */
const Payslip = () => {
  const { user } = useAuth();
  const [year,     setYear]     = useState(new Date().getFullYear());
  const [payslips, setPayslips] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [reqBusy,  setReqBusy]  = useState(false);
  const [reqDone,  setReqDone]  = useState('');

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
      }));
      // Newest first.
      normalised.sort((a, b) => {
        const k = (x) => `${x.year || 0}-${String(x.month || 0).padStart(2, '0')}`;
        return k(b).localeCompare(k(a));
      });
      setPayslips(normalised);
      setSelected(0);
    } catch (err) {
      setError(err?.message || 'Could not load payslips.');
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const current = payslips[selected];

  const requestPayslip = async () => {
    setReqBusy(true);
    setReqDone('');
    try {
      const now = new Date();
      await payslipAPI.request(now.getMonth() + 1, now.getFullYear());
      setReqDone('Request sent to HR.');
      setTimeout(() => setReqDone(''), 3000);
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
              options={['2024', '2025', '2026', '2027']}
              defaultSelected={String(year)}
              onSelect={(y) => setYear(parseInt(y, 10))}
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
            {loading && <div style={{ padding: 20, color: '#64748B' }}>Loading…</div>}
            {!loading && payslips.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                No payslips for {year} yet. Click "Request" below to ask HR to generate one.
              </div>
            )}
            {!loading && payslips.map((p, i) => (
              <HistoryCard
                key={p._id || `${p.year}-${p.month}-${i}`}
                month={`${MONTH_SHORT[(parseInt(p.month, 10) || 1) - 1]} ${p.year}`}
                dateRange={fmtRange(p.month, p.year)}
                amount={inr(p.netPay || p.grossPay)}
                colorIndex={i}
                active={selected === i}
                onClick={() => setSelected(i)}
                downloadUrl={p.downloadUrl}
              />
            ))}
          </div>
        </div>

        {/* ══ RIGHT: Summary ══════════════════════════ */}
        <div className="ps-right">
          <h3 className="ps-summary-title">Payslip Summary</h3>

          {current && (
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

          <div className="ps-actions">
            <button className="ps-btn-request" onClick={requestPayslip} disabled={reqBusy} type="button">
              <Pointer size={18} />
              {reqBusy ? 'Requesting…' : 'Request'}
            </button>
            {current?.downloadUrl ? (
              <a className="ps-btn-download" href={current.downloadUrl} download>
                <Download size={17} /> Download
              </a>
            ) : (
              <button className="ps-btn-download" type="button" disabled>
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
