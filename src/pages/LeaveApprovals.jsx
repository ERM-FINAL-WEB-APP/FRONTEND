import React, { useEffect, useState, useCallback } from 'react';
import { Check, X, Clock, AlertCircle, Inbox, Filter } from 'lucide-react';
import { managerAPI } from '../services/api';
import './LeaveApprovals.css';

/**
 * Manager → Approvals tab.
 * Shows leave + permission requests AND allowance claims from the
 * subordinates of the logged-in manager. Tap Approve / Reject —
 * the manager-status flip is persisted to MongoDB, so HR sees it
 * on their HRMS Approvals page (gates the HR Approve/Reject buttons).
 */

const TABS = [
  { key: 'leaves',     label: 'Leave & Permission' },
  { key: 'allowances', label: 'Allowance' },
];

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
  if (!e || s === e) return fmtDate(s);
  return `${fmtDate(s)} → ${fmtDate(e)}`;
}
function statusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved') return { txt: 'Approved', bg: '#F0FDF4', fg: '#16A34A', bd: '#BBF7D0' };
  if (s === 'rejected') return { txt: 'Rejected', bg: '#FEF2F2', fg: '#DC2626', bd: '#FECACA' };
  return                       { txt: 'Pending',  bg: '#FFFBEB', fg: '#D97706', bd: '#FDE68A' };
}

const LeaveApprovals = () => {
  const [tab,   setTab]   = useState('leaves');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [acting,  setActing]  = useState(null);   // id of row currently being patched

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = tab === 'leaves'
        ? await managerAPI.leaves()
        : await managerAPI.allowances();
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      setError(err?.message || 'Could not load approvals.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, status) => {
    setActing(id);
    try {
      if (tab === 'leaves') await managerAPI.actLeave(id, status);
      else                  await managerAPI.actAllowance(id, status);
      setItems((prev) => prev.map((r) =>
        r._id === id ? { ...r, managerStatus: status } : r
      ));
    } catch (err) {
      setError(err?.message || `Could not ${status.toLowerCase()} the request.`);
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="leave-approvals-page" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              border: tab === t.key ? '1px solid #4CAA17' : '1px solid #E2E8F0',
              background: tab === t.key ? '#F1F9EE' : '#fff',
              color: tab === t.key ? '#15803D' : '#475569',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
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

      {loading && <div style={{ padding: 40, color: '#64748B' }}>Loading approvals…</div>}

      {!loading && items.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#64748B', fontSize: 14,
          background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1',
        }}>
          <Inbox size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
          <div>No {tab === 'leaves' ? 'leave or permission' : 'allowance'} requests from your team yet.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {!loading && items.map((r) => {
          const employeeName =
            r.user?.name ||
            [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') ||
            r.user?.employeeId || '—';
          const employeeId = r.user?.employeeId || '';
          const b = statusBadge(r.managerStatus);
          const isPerm = r.requestType === 'permission';
          const headline = tab === 'leaves'
            ? (isPerm ? (r.permissionType || 'Permission') : (r.leaveType || 'Leave'))
            : (r.type === 'travel' ? 'Travel claim' : 'Petrol claim');
          const sub = tab === 'leaves'
            ? (isPerm
                ? `${fmtDate(r.date)} · ${r.startTime || ''} – ${r.endTime || ''}`
                : fmtRange(r.startDate, r.endDate))
            : `${r.fromLocation || '—'} → ${r.toLocation || '—'} · ₹${r.amount || 0}`;

          return (
            <div key={r._id} style={{
              background: '#fff', borderRadius: 12, padding: 16,
              border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{employeeName}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{employeeId}</div>
                </div>
                <span style={{
                  alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 999,
                  fontSize: 10, fontWeight: 800,
                  background: b.bg, color: b.fg, border: `1px solid ${b.bd}`,
                  textTransform: 'uppercase', letterSpacing: 0.4,
                }}>{b.txt}</span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937' }}>{headline}</div>
              <div style={{ fontSize: 12, color: '#475569' }}>{sub}</div>

              {(r.reason || r.notes || r.purpose) && (
                <div style={{ fontSize: 12, color: '#475569', borderTop: '1px dashed #E2E8F0', paddingTop: 8 }}>
                  <b>Reason:</b> {r.reason || r.notes || r.purpose}
                </div>
              )}

              {!r.managerStatus || /pending/i.test(r.managerStatus) ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    onClick={() => act(r._id, 'Approved')}
                    disabled={acting === r._id}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8,
                      background: '#F0FDF4', color: '#15803D',
                      border: '1px solid #BBF7D0', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    onClick={() => act(r._id, 'Rejected')}
                    disabled={acting === r._id}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8,
                      background: '#FEF2F2', color: '#DC2626',
                      border: '1px solid #FECACA', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  Manager decision logged — HR will finalise.
                </div>
              )}

              <div style={{ fontSize: 10, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Clock size={10} /> Submitted {fmtDate(r.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeaveApprovals;
