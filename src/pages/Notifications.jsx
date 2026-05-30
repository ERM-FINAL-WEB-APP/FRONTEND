import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Info, AlertCircle, Megaphone, CheckCheck } from 'lucide-react';
import { notificationAPI, announcementAPI } from '../services/api';
import './Notifications.css';

/**
 * Notifications — live feed from the backend.
 *
 * Three tabs:
 *   • All           — notifications + announcements merged, newest first
 *   • Notifications — only personal notifications (HR actions, leave/
 *                     allowance/complaint status updates, etc.)
 *   • Announcements — only company-wide announcements
 *
 * Backend shapes:
 *   GET /api/notification        → { items: [...], unreadCount: N }
 *   GET /api/notification/unread-count → { unreadCount: N }
 *   GET /api/announcement?limit  → [ ... ] OR { data: [ ... ] }
 *
 * Notification fields used:
 *   _id, title, body, type, read, createdAt
 *     where type ∈ leave | attendance | allowance | payslip | announcement | general
 */

function relTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60)     return 'Just now';
    if (diffSec < 3600)   return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400)  return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return (() => { const __d = d; if (!__d || isNaN(__d.getTime?.() ?? new Date(__d).getTime())) return '—'; const __dd = (__d instanceof Date) ? __d : new Date(__d); const __day = String(__dd.getDate()).padStart(2,'0'); const __mo  = String(__dd.getMonth()+1).padStart(2,'0'); const __yr  = __dd.getFullYear(); return __day + '-' + __mo + '-' + __yr; })();
  } catch { return ''; }
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

// Map backend `type` → UI icon + category label.
function typeToUi(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'leave')        return { icon: 'check',     category: 'LEAVE' };
  if (t === 'attendance')   return { icon: 'info',      category: 'ATTENDANCE' };
  if (t === 'allowance')    return { icon: 'check',     category: 'ALLOWANCE' };
  if (t === 'payslip')      return { icon: 'info',      category: 'PAYSLIP' };
  if (t === 'announcement') return { icon: 'megaphone', category: 'ANNOUNCEMENT' };
  if (t === 'complaint')    return { icon: 'alert',     category: 'COMPLAINT' };
  if (t === 'general')      return { icon: 'info',      category: 'GENERAL' };
  return { icon: 'info', category: (t.toUpperCase() || 'INFO') };
}

const Notifications = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notifsRes, annsRes] = await Promise.all([
        notificationAPI.list({ limit: 100 }).catch(() => ({ data: {} })),
        announcementAPI.list(20).catch(() => ({ data: [] })),
      ]);

      // Notification list comes back as { items, unreadCount }
      const notifRows = Array.isArray(notifsRes.data?.items)
        ? notifsRes.data.items
        : (Array.isArray(notifsRes.data) ? notifsRes.data : []);
      const notifs = notifRows.map((n) => {
        const ui = typeToUi(n.type);
        return {
          id:        n._id,
          title:     n.title || '(no title)',
          message:   n.body || n.message || '',
          createdAt: n.createdAt,
          unread:    !n.read,
          kind:      'notification',
          icon:      ui.icon,
          category:  ui.category,
        };
      });

      // Announcement list — accept array, { data }, or { items }
      const annRows = Array.isArray(annsRes.data)
        ? annsRes.data
        : (annsRes.data?.data || annsRes.data?.items || []);
      const anns = annRows.map((a) => ({
        id:        a._id,
        title:     a.title || '(no title)',
        message:   a.body || a.description || '',
        createdAt: a.publishDate || a.createdAt,
        unread:    false,
        kind:      'announcement',
        icon:      'megaphone',
        category:  'ANNOUNCEMENT',
      }));

      const merged = [...notifs, ...anns].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setItems(merged);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(it => {
    if (activeTab === 'Notifications') return it.kind === 'notification';
    if (activeTab === 'Announcements') return it.kind === 'announcement';
    return true;
  });

  const unreadCount = items.filter((n) => n.kind === 'notification' && n.unread).length;

  const getIcon = (iconStr) => {
    switch (iconStr) {
      case 'check':     return <CheckCircle size={20} className="icon-check" />;
      case 'info':      return <Info        size={20} className="icon-info" />;
      case 'alert':     return <AlertCircle size={20} className="icon-alert" />;
      case 'megaphone': return <Megaphone   size={20} className="icon-megaphone" />;
      default:          return <Info        size={20} />;
    }
  };

  const markRead = async (notif) => {
    if (notif.kind !== 'notification' || !notif.unread) return;
    setItems(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
    try { await notificationAPI.markAsRead(notif.id); } catch { /* optimistic */ }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setBusy(true);
    // Optimistic — flip every notif in state to read, then call backend.
    setItems(prev => prev.map(n => n.kind === 'notification' ? { ...n, unread: false } : n));
    try { await notificationAPI.markAllRead(); }
    catch { /* leave UI as-is; next poll will reconcile */ }
    finally { setBusy(false); }
  };

  return (
    <div className="notif-page-new">
      <div className="notif-top-tabs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {['All', 'Notifications', 'Announcements'].map(tab => (
          <button
            key={tab}
            className={`notif-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={busy}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8,
              background: '#F1F9EE', color: '#15803D',
              border: '1px solid #BBF7D0', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
            }}
          >
            <CheckCheck size={14} /> Mark all read ({unreadCount})
          </button>
        )}
      </div>

      <div className="notif-list-container">
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
            No {activeTab === 'All' ? 'notifications or announcements' : activeTab.toLowerCase()} yet.
          </div>
        )}
        {!loading && filtered.map(n => (
          <div
            key={n.kind + '-' + n.id}
            className={`notif-card-new ${n.unread ? 'unread' : ''}`}
            onClick={() => markRead(n)}
          >
            <div className={`notif-icon-box bg-${n.icon}`}>
              {getIcon(n.icon)}
            </div>
            <div className="notif-content">
              <div className="notif-header-row">
                <div className="notif-title-wrap">
                  <h3 className="notif-title">{n.title}</h3>
                  {n.unread && <span className="notif-unread-dot"></span>}
                </div>
                <div className="notif-date">{fmtDate(n.createdAt)}</div>
              </div>
              <p className="notif-message">{n.message}</p>
              <div className="notif-footer-row">
                <span className={`notif-badge badge-${n.icon}`}>{n.category}</span>
                <span className="notif-rel-time">• {relTime(n.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
