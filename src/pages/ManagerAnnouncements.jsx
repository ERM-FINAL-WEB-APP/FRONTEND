import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Send, Tag, Calendar, Trash2, AlertCircle, CheckCircle, X, Megaphone } from 'lucide-react';
import { managerAPI } from '../services/api';
import './Announcements.css';

import { useConfirm } from '../components/ConfirmDialog';
/**
 * ManagerAnnouncements — used inside the Manager Access section.
 * Lets the signed-in manager:
 *   • POST an announcement that targets ONLY their direct team
 *     (audience='manager-team', audienceUserIds snapshotted at post time)
 *   • View their own past team posts
 *   • Delete one of their posts (soft delete on the backend)
 *
 * Backend endpoints:
 *   POST   /api/manager/announcements   { title, body, category }
 *   GET    /api/manager/announcements   → { items: [...] }
 *   DELETE /api/manager/announcements/:id
 */

const CATEGORIES = ['general', 'event', 'policy', 'holiday'];

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

const ManagerAnnouncements = () => {
  const [items, setItems] = useState([]);
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await managerAPI.myAnnouncements();
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const handlePost = async (e) => {
    e?.preventDefault();
    setError('');
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await managerAPI.postAnnouncement({
        title:    title.trim(),
        body:     body.trim(),
        category,
      });
      const n = res.data?.teamSize || 0;
      setSuccess(`Announcement sent to ${n} team member${n === 1 ? '' : 's'}.`);
      setModalOpen(false);
      setTitle('');
      setBody('');
      setCategory('general');
      load();
    } catch (err) {
      setError(err?.message || 'Could not post announcement.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement? Team members who haven\'t opened it yet won\'t see it.')) return;
    try {
      await managerAPI.deleteAnnouncement(id);
      setItems((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      setError(err?.message || 'Could not delete announcement.');
    }
  };

  return (
    <div className="mgr-announcements-page page-enter" style={{ padding: '16px 24px' }}>
      <div className="ann-header">
        <div>
          <h1 className="ann-title">Team Announcements</h1>
          <p className="ann-subtitle">
            Posts here go ONLY to your assigned team — not to the company-wide feed.
          </p>
        </div>
        <button className="btn-post-ann" onClick={() => { setError(''); setModalOpen(true); }}>
          <Plus size={16} /> Post Team Announcement
        </button>
      </div>

      {success && (
        <div style={{
          margin: '12px 0', padding: '10px 14px', borderRadius: 8,
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          color: '#15803D', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CheckCircle size={16} /> {success}
        </div>
      )}
      {error && !modalOpen && (
        <div style={{
          margin: '12px 0', padding: '10px 14px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="ann-grid">
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#334155', gridColumn: '1 / -1' }}>
            Loading…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div style={{
            padding: 40, textAlign: 'center', color: '#334155', gridColumn: '1 / -1',
            background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1',
          }}>
            <Megaphone size={32} color="#475569" style={{ marginBottom: 8 }} />
            <div>You haven't posted any team announcements yet.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click "Post Team Announcement" to send the first one.</div>
          </div>
        )}
        {!loading && items.map((a) => (
          <div className="ann-card" key={a._id} style={{ borderLeftColor: '#4CAA17' }}>
            <div className="ann-card-top">
              <div className="ann-tags">
                <span className="ann-tag" style={{ color: '#4CAA17', backgroundColor: '#4CAA1715' }}>
                  <Tag size={12} /> {String(a.category || 'GENERAL').toUpperCase()}
                </span>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                  background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                  textTransform: 'uppercase', letterSpacing: 0.4,
                }}>TEAM ONLY</span>
              </div>
              <button
                onClick={() => handleDelete(a._id)}
                title="Delete"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#475569', padding: 4,
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <h3 className="ann-card-title">{a.title}</h3>
            <p className="ann-card-content">{a.body}</p>
            <div className="ann-card-footer">
              <div className="ann-footer-left">
                <span className="ann-date"><Calendar size={12} /> {fmtDate(a.createdAt)}</span>
              </div>
              <span style={{ fontSize: 11, color: '#334155' }}>
                Reached {Array.isArray(a.audienceUserIds) ? a.audienceUserIds.length : 0} people
              </span>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="ann-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ann-modal-header">
              <h2>Post Team Announcement</h2>
              <button className="btn-close" onClick={() => setModalOpen(false)}><X size={20} /></button>
            </div>
            <form className="ann-form" onSubmit={handlePost}>
              {error && (
                <div style={{
                  margin: '8px 0', padding: '8px 12px', borderRadius: 6,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  color: '#991B1B', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  placeholder="e.g. Team meeting moved to Friday"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea
                  placeholder="Share the details with your team…"
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 800))}
                  required
                />
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  {body.length} / 800 characters
                </div>
              </div>
              <div style={{
                fontSize: 11, color: '#334155', background: '#F8FAFC',
                padding: '8px 10px', borderRadius: 6,
                border: '1px solid #E2E8F0', marginTop: 8,
              }}>
                This will go ONLY to people currently assigned to you in HRMS — not to the company-wide announcement feed.
              </div>
            </form>
            <div className="ann-modal-footer">
              <button className="btn-cancel" onClick={() => setModalOpen(false)} type="button">Cancel</button>
              <button
                className="btn-post-now"
                onClick={handlePost}
                disabled={busy || !title.trim() || !body.trim()}
                type="button"
              >
                <Send size={14} /> {busy ? 'Posting…' : 'Post Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerAnnouncements;
