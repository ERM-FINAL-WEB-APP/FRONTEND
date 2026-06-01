import React, { useEffect, useState, useCallback } from 'react';
import { Search, Tag, User, Calendar } from 'lucide-react';
import { announcementAPI } from '../services/api';
import './Announcements.css';

/**
 * Announcements — READ-ONLY for employees. The HRMS admin portal is the
 * source of truth: HR creates / edits / deletes announcements there and
 * they appear here automatically (shared `announcements` collection).
 *
 * (The old version of this page had a "Post Announcement" button that
 * only updated local state — it never reached the backend. Removed for
 * the web app since posting is HR-only.)
 */

const PRIORITY_COLOR = {
  high:    '#EF4444',
  medium:  '#EAB308',
  low:     '#4CAA17',
  urgent:  '#DC2626',
  normal:  '#4CAA17',
};

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

function isRecent(iso) {
  if (!iso) return false;
  try {
    return Date.now() - new Date(iso).getTime() < 1000 * 60 * 60 * 24 * 3; // 3 days
  } catch { return false; }
}

const Announcements = () => {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await announcementAPI.list(50);
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setItems(list);
    } catch (err) {
      setError(err?.message || 'Could not load announcements.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((a) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      String(a.title || '').toLowerCase().includes(s) ||
      String(a.body || a.description || '').toLowerCase().includes(s) ||
      String(a.category || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="mgr-announcements-page page-enter">
      <div className="ann-header">
        <div>
          <h1 className="ann-title">Company Announcements</h1>
          <p className="ann-subtitle">Stay updated with the latest news and updates across the organization.</p>
        </div>
      </div>

      <div className="ann-controls">
        <div className="search-bar-ann">
          <Search size={16} className="text-secondary" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="ann-grid">
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748B', gridColumn: '1 / -1' }}>
            Loading announcements…
          </div>
        )}
        {!loading && error && (
          <div style={{
            padding: 16, color: '#991B1B', background: '#FEF2F2',
            border: '1px solid #FECACA', borderRadius: 8,
            gridColumn: '1 / -1',
          }}>
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748B', gridColumn: '1 / -1' }}>
            No announcements{search ? ' match your search' : ' yet'}.
          </div>
        )}
        {!loading && !error && filtered.map((a) => {
          const priority = String(a.priority || 'Normal');
          const color = PRIORITY_COLOR[priority.toLowerCase()] || PRIORITY_COLOR.normal;
          const dateStr = fmtDate(a.publishDate || a.createdAt);
          return (
            <div className="ann-card" key={a._id} style={{ borderLeftColor: color }}>
              <div className="ann-card-top">
                <div className="ann-tags">
                  <span
                    className="ann-tag"
                    style={{ color, backgroundColor: `${color}15` }}
                  >
                    <Tag size={12} /> {String(a.category || 'General').toUpperCase()}
                  </span>
                  {isRecent(a.publishDate || a.createdAt) && (
                    <span className="ann-new-badge">New</span>
                  )}
                </div>
              </div>
              <h3 className="ann-card-title">{a.title || '(untitled)'}</h3>
              <p className="ann-card-content">{a.body || a.description || ''}</p>
              {/* Attachments — images preview inline plus an explicit
                  "View document" button so employees know they can
                  open the file in a new tab; non-image files surface
                  as a row with View + Download buttons. HR uploads
                  them via HRMS; we read the same `attachments` array
                  off the shared announcement doc. */}
              {Array.isArray(a.attachments) && a.attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {a.attachments.map((att, i) => {
                    const src = att.dataBase64
                      ? `data:${att.mimeType || 'application/octet-stream'};base64,${att.dataBase64}`
                      : (att.url || '');
                    if (!src) return null;
                    const isImage = String(att.mimeType || '').startsWith('image/') ||
                                    /\.(png|jpe?g|gif|webp|svg)$/i.test(att.name || '');
                    const sizeLbl = att.size ? `(${Math.round(att.size / 1024)} KB)` : '';
                    if (isImage) {
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <a href={src} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                            <img
                              src={src}
                              alt={att.name || 'attachment'}
                              style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8, border: '1px solid #E2E8F0' }}
                            />
                          </a>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <a
                              href={src}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', borderRadius: 8,
                                background: '#EFF6FF', border: '1px solid #BFDBFE',
                                fontSize: 12, fontWeight: 700, color: '#1D4ED8',
                                textDecoration: 'none',
                              }}
                            >
                              👁  View document
                            </a>
                            <a
                              href={src}
                              download={att.name || 'attachment.png'}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '6px 12px', borderRadius: 8,
                                background: '#F8FAFC', border: '1px solid #E2E8F0',
                                fontSize: 12, fontWeight: 700, color: '#0F172A',
                                textDecoration: 'none',
                              }}
                            >
                              ⬇  Download {sizeLbl}
                            </a>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, padding: '10px 12px', borderRadius: 10,
                        background: '#F8FAFC', border: '1px solid #E2E8F0',
                      }}>
                        <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          📎 {att.name || 'Attachment'} {sizeLbl && <span style={{ color: '#64748B', fontWeight: 500, marginLeft: 4 }}>{sizeLbl}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <a
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '6px 12px', borderRadius: 8,
                              background: '#EFF6FF', border: '1px solid #BFDBFE',
                              fontSize: 12, fontWeight: 700, color: '#1D4ED8',
                              textDecoration: 'none',
                            }}
                          >
                            👁  View
                          </a>
                          <a
                            href={src}
                            download={att.name || 'attachment'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '6px 12px', borderRadius: 8,
                              background: '#fff', border: '1px solid #CBD5E1',
                              fontSize: 12, fontWeight: 700, color: '#0F172A',
                              textDecoration: 'none',
                            }}
                          >
                            ⬇  Download
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="ann-card-footer">
                <div className="ann-footer-left">
                  <span className="ann-author">
                    <User size={12} /> {a.createdByName || a.postedBy || 'HR'}
                  </span>
                  <span className="ann-date">
                    <Calendar size={12} /> {dateStr}
                  </span>
                </div>
                <span className={`ann-priority badge-${priority.toLowerCase()}`}>
                  <span className="p-dot">!</span> {priority}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Announcements;
