/**
 * AttendanceRequestsManager — Manager view of every regularisation
 * request filed by their direct subordinates.
 *
 * Mounted as a tab inside ManagerAccess. Backed by:
 *   GET   /api/manager/attendance-requests?status=
 *   PATCH /api/manager/attendance-requests/:id  { status, hrComment? }
 *
 * Mirrors the LeaveApprovals page's UX so managers don't have to
 * relearn a different layout for the same flow.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Check, X, Clock, Search, Inbox } from 'lucide-react';
import { managerAPI } from '../services/api';
import { useConfirm } from '../components/ConfirmDialog';

const TABS = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function fmtDDMMYYYY(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso);
}

export default function AttendanceRequestsManager() {
  const confirm = useConfirm();
  const [items, setItems]     = useState([]);
  const [tab, setTab]         = useState('pending');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(null);
  const [error, setError]     = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await managerAPI.attendanceRequests({ status: tab });
      setItems(Array.isArray(r.data?.items) ? r.data.items : []);
    } catch (err) {
      setError(err?.message || 'Could not load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const u = it.user || {};
      const blob = [
        u.name, u.firstName, u.lastName, u.employeeId, u.email, u.department, u.designation,
        it.reason, it.date,
      ].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [items, search]);

  const act = async (row, status) => {
    const name = row.user?.name ||
      [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ') ||
      row.user?.employeeId || 'this employee';
    const ok = await confirm({
      title: `${status === 'approved' ? 'Approve' : 'Reject'} attendance request?`,
      message: `${name} — ${fmtDDMMYYYY(row.date)}\n\n${row.reason || 'No reason given'}`,
      confirmLabel: status === 'approved' ? 'Approve' : 'Reject',
      destructive: status === 'rejected',
    });
    if (!ok) return;
    setActing(row._id);
    try {
      await managerAPI.actAttendanceRequest(row._id, status);
      load();
    } catch (err) {
      setError(err?.message || 'Could not save decision');
    } finally {
      setActing(null);
    }
  };

  return (
    <div style={{ padding: '12px 16px 24px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              border: '1px solid ' + (tab === t.key ? '#16A34A' : '#E2E8F0'),
              background: tab === t.key ? '#16A34A' : '#fff',
              color: tab === t.key ? '#fff' : '#475569', cursor: 'pointer',
            }}
          >{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          border: '1px solid #E2E8F0', background: '#fff', minWidth: 240,
        }}>
          <Search size={14} color="#94A3B8" />
          <input
            placeholder="Search name / id / reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13 }}
          />
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', fontSize: 13, marginBottom: 12,
        }}>{error}</div>
      )}

      {loading && <div style={{ padding: 40, color: '#64748B' }}>Loading requests…</div>}

      {!loading && filtered.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#64748B', fontSize: 14,
          background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1',
        }}>
          <Inbox size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
          <div>No {tab} requests from your team.</div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((r) => {
            const u = r.user || {};
            const name = u.name ||
              [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
            return (
              <div key={r._id} style={{
                background: '#fff', borderRadius: 12,
                border: '1px solid #E2E8F0',
                padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{name}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      {u.employeeId || ''}{u.designation ? ` · ${u.designation}` : ''}
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: r.status === 'approved' ? '#F0FDF4'
                              : r.status === 'rejected' ? '#FEF2F2' : '#FFFBEB',
                    color:      r.status === 'approved' ? '#16A34A'
                              : r.status === 'rejected' ? '#DC2626' : '#D97706',
                  }}>
                    {r.status === 'approved' ? <Check size={12} /> :
                     r.status === 'rejected' ? <X size={12} /> : <Clock size={12} />}
                    {r.status[0].toUpperCase() + r.status.slice(1)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 16 }}>
                  <div><b>Date:</b> {fmtDDMMYYYY(r.date)}</div>
                  <div><b>Filed:</b> {fmtDDMMYYYY(r.createdAt)}</div>
                </div>
                {r.reason && (
                  <div style={{
                    fontSize: 12, color: '#475569',
                    borderTop: '1px dashed #E2E8F0', paddingTop: 8,
                  }}>
                    <b>Reason:</b> {r.reason}
                  </div>
                )}
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => act(r, 'approved')}
                      disabled={acting === r._id}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8,
                        background: '#F0FDF4', color: '#15803D',
                        border: '1px solid #BBF7D0', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    ><Check size={14} /> Approve</button>
                    <button
                      onClick={() => act(r, 'rejected')}
                      disabled={acting === r._id}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8,
                        background: '#FEF2F2', color: '#DC2626',
                        border: '1px solid #FECACA', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    ><X size={14} /> Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
