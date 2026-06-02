import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, AlertCircle, Inbox } from 'lucide-react';
import { managerAPI } from '../services/api';
import './Reports.css';

/**
 * Manager → Team Attendance Report tab.
 * Per-employee summary of present/late/absent/permission/halfday for
 * the chosen month. Backed by /api/manager/attendance-summary which
 * filters by assignedTo === logged-in manager's name.
 */

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const Reports = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await managerAPI.attendanceSummary({ month, year });
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      setError(err?.message || 'Could not load report.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  // Aggregate totals across team
  const totals = items.reduce((acc, r) => {
    acc.present    += r.present    || 0;
    acc.late       += r.late       || 0;
    acc.absent     += r.absent     || 0;
    acc.permission += r.permission || 0;
    acc.halfday    += r.halfday    || 0;
    acc.hours      += Number(r.totalWorkedHours || 0);
    return acc;
  }, { present: 0, late: 0, absent: 0, permission: 0, halfday: 0, hours: 0 });

  return (
    <div className="reports-page" style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 8,
          background: '#fff', border: '1px solid #E2E8F0',
        }}>
          <Calendar size={14} color="#334155" />
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 600 }}
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 600 }}
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 12px', borderRadius: 8, marginBottom: 12,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Team totals row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10, marginBottom: 16,
      }}>
        <Stat label="Team size"   value={items.length} color="#4299E1" />
        <Stat label="Present"     value={totals.present}    color="#16A34A" />
        <Stat label="Late"        value={totals.late}       color="#F97316" />
        <Stat label="Permission"  value={totals.permission} color="#EAB308" />
        <Stat label="Absent"      value={totals.absent}     color="#DC2626" />
        <Stat label="Half day"    value={totals.halfday}    color="#8B5CF6" />
        <Stat label="Total hours" value={totals.hours.toFixed(1)} color="#0EA5E9" />
      </div>

      {loading && <div style={{ padding: 40, color: '#334155' }}>Loading report…</div>}

      {!loading && items.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#334155', fontSize: 14,
          background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1',
        }}>
          <Inbox size={32} color="#475569" style={{ marginBottom: 8 }} />
          <div>No employees are assigned to you, or no attendance data for {MONTHS[month - 1]} {year}.</div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 12, overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <Th>Employee</Th>
                  <Th>Designation</Th>
                  <Th align="center">Present</Th>
                  <Th align="center">Late</Th>
                  <Th align="center">Permission</Th>
                  <Th align="center">Absent</Th>
                  <Th align="center">Half day</Th>
                  <Th align="right">Total hours</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.userId} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <Td>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: '#334155' }}>{r.employeeId || ''}</div>
                    </Td>
                    <Td>{r.designation || '—'}</Td>
                    <Td align="center"><Pill bg="#F1F9EE" fg="#15803D" text={r.present || 0} /></Td>
                    <Td align="center"><Pill bg="#FFF7ED" fg="#C2410C" text={r.late    || 0} /></Td>
                    <Td align="center"><Pill bg="#FEFCE8" fg="#A16207" text={r.permission || 0} /></Td>
                    <Td align="center"><Pill bg="#FEF2F2" fg="#B91C1C" text={r.absent  || 0} /></Td>
                    <Td align="center"><Pill bg="#F5F3FF" fg="#7C3AED" text={r.halfday || 0} /></Td>
                    <Td align="right" mono>{(Number(r.totalWorkedHours || 0)).toFixed(1)} hrs</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

function Stat({ label, value, color }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12,
      background: '#fff', border: '1px solid #E2E8F0',
    }}>
      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function Th({ children, align = 'left' }) {
  return (
    <th style={{
      padding: '10px 14px', textAlign: align,
      fontSize: 11, fontWeight: 700, color: '#334155',
      textTransform: 'uppercase', letterSpacing: 0.4,
    }}>{children}</th>
  );
}
function Td({ children, align = 'left', mono = false }) {
  return (
    <td style={{
      padding: '10px 14px', textAlign: align,
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      color: '#0F172A',
    }}>{children}</td>
  );
}
function Pill({ bg, fg, text }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      background: bg, color: fg, fontWeight: 700, fontSize: 12,
      minWidth: 28, textAlign: 'center',
    }}>{text}</span>
  );
}

export default Reports;
