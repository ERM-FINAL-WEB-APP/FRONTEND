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
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
    });
  } catch { return ''; }
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
