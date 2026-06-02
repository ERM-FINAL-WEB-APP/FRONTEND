/**
 * AttendanceRequestsManager — Manager-side queue for attendance
 * regularisation requests filed by direct reports from ERM Mobile.
 *
 * Visual layout deliberately mirrors LeaveApprovals so both manager
 * tabs feel the same: filter tabs row, then a responsive grid of
 * cards with name + employee id + status pill, headline (date),
 * subtitle (reason), and Approve / Reject buttons.
 *
 * API:
 *   GET   /api/manager/attendance-requests?status=
 *   PATCH /api/manager/attendance-requests/:id  { status, hrComment? }
 */
import React, { useEffect, useState } from 'react';
import { Check, X, Clock, AlertCircle, Inbox } from 'lucide-react';
import { managerAPI } from '../services/api';
import { useConfirm } from '../components/ConfirmDialog';

const STATUSES = ['pending', 'approved', 'rejected'];

function fmtDate(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso);
}

function statusBadge(status) {
  const s = String(status || 'pending').toLowerCase();
  if (s === 'approved') return { txt: 'Approved', bg: '#F0FDF4', fg: '#15803D', bd: '#BBF7D0' };
  if (s === 'rejected') return { txt: 'Rejected', bg: '#FEF2F2', fg: '#DC2626', bd: '#FECACA' };
  return { txt: 'Pending', bg: '#FFFBEB', fg: '#D97706', bd: '#FDE68A' };
}

export default function AttendanceRequestsManager() {
  const confirm = useConfirm();
  const [tab, setTab]         = useState('pending');
  const [items, setItems]     = useState([]);
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

  const act = async (row, status) => {
    const name =
      row.user?.name ||
      [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ').trim() ||
      row.user?.employeeId || 'this employee';
    const ok = await confirm({
      title: `${status === 'approved' ? 'Approve' : 'Reject'} attendance request?`,
      message: `${name} — ${fmtDate(row.date)}\n\n${row.reason || 'No reason given'}`,
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
    <div style={{ padding: '16px 20px 24px' }}>
      {/* Filter tabs — same chip style as LeaveApprovals */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            style={{
              padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
              border: '1px solid ' + (tab === s ? '#16A34A' : '#E2E8F0'),
              background: tab === s ? '#16A34A' : '#fff',
              color: tab === s ? '#fff' : '#334155',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >{s}</button>
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

      {loading && <div style={{ padding: 40, color: '#334155' }}>Loading requests…</div>}

      {!loading && items.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#334155', fontSize: 14,
          background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1',
        }}>
          <Inbox size={32} color="#475569" style={{ marginBottom: 8 }} />
          <div>No {tab} attendance requests from your team.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {!loading && items.map((r) => {
          const employeeName =
            r.user?.name ||
            [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') ||
            r.user?.employeeId || '—';
          const employeeId = r.user?.employeeId || '';
          const designation = r.user?.designation || '';
          const b = statusBadge(r.status);

          return (
            <div key={r._id} style={{
              background: '#fff', borderRadius: 12, padding: 16,
              border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{employeeName}</div>
                  <div style={{ fontSize: 11, color: '#334155' }}>
                    {employeeId}{designation ? ` · ${designation}` : ''}
                  </div>
                </div>
                <span style={{
                  alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 999,
                  fontSize: 10, fontWeight: 800,
                  background: b.bg, color: b.fg, border: `1px solid ${b.bd}`,
                  textTransform: 'uppercase', letterSpacing: 0.4,
                }}>{b.txt}</span>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937' }}>
                Regularisation · {fmtDate(r.date)}
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                Filed {fmtDate(r.createdAt)}
              </div>

              {r.reason && (
                <div style={{
                  fontSize: 12, color: '#475569',
                  borderTop: '1px dashed #E2E8F0', paddingTop: 8,
                }}>
                  <b>Reason:</b> {r.reason}
                </div>
              )}

              {!r.status || /pending/i.test(r.status) ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
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
                  >
                    <Check size={14} /> Approve
                  </button>
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
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  Decision logged{r.reviewedBy ? ` by ${r.reviewedBy}` : ''}.
                </div>
              )}

              <div style={{ fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Clock size={10} /> Filed {fmtDate(r.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
