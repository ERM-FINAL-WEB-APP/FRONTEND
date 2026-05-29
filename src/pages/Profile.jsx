import React, { useEffect, useState } from 'react';
import { Contact, Phone, Mail, Calendar, Droplet, Laptop, Monitor, Smartphone, CreditCard, Cpu, Mouse, Keyboard, Briefcase, Building2, CheckCircle, Package } from 'lucide-react';
import { profileAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

/**
 * Profile — read-only view of the signed-in employee's own record.
 * Pulls from GET /api/profile + GET /api/profile/assets.
 *
 * Avatar selection (no photoUrl on record):
 *   • gender === 'male'   → blue silhouette
 *   • gender === 'female' → pink silhouette
 *   • anything else       → initial-based ui-avatars
 */

function pickLabel(value, sidecar) {
  const isHexId = (s) => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);
  if (value && typeof value === 'object') {
    const t = value.title || value.name || '';
    if (t && !isHexId(t)) return t;
  }
  if (typeof value === 'string' && value && !isHexId(value)) return value;
  if (sidecar && typeof sidecar === 'string' && !isHexId(sidecar)) return sidecar;
  return '';
}

function pickAssetIcon(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('laptop'))   return Laptop;
  if (t.includes('monitor'))  return Monitor;
  if (t.includes('mobile') || t.includes('phone')) return Smartphone;
  if (t.includes('id'))       return CreditCard;
  if (t.includes('mouse'))    return Mouse;
  if (t.includes('keyboard')) return Keyboard;
  if (t.includes('pc'))       return Cpu;
  return Package;
}

/** Gender-based default avatar — inline SVG so no extra HTTP request. */
function genderAvatar(gender, name) {
  const g = String(gender || '').toLowerCase();
  const bg     = g === 'female' ? '#FCE7F3' : g === 'male' ? '#DBEAFE' : '#DCFCE7';
  const accent = g === 'female' ? '#EC4899' : g === 'male' ? '#3B82F6' : '#4CAA17';
  if (g === 'female' || g === 'male') {
    return (
      <svg viewBox="0 0 96 96" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
           style={{ background: bg, borderRadius: '50%' }}>
        <circle cx="48" cy="36" r="16" fill={accent} />
        <path d={
          g === 'female'
            ? 'M16 96 C16 70, 32 60, 48 60 C 64 60, 80 70, 80 96 Z'
            : 'M16 96 C16 72, 30 64, 48 64 C 66 64, 80 72, 80 96 Z'
        } fill={accent} />
        {g === 'female' && (
          // little hair flourish so the silhouette reads as female
          <path d="M30 26 C30 18, 42 14, 48 14 C 54 14, 66 18, 66 26 L 66 36 L 30 36 Z" fill={accent} opacity="0.8" />
        )}
      </svg>
    );
  }
  // Neutral fallback — initials avatar via ui-avatars
  const initial = (String(name || 'E').match(/\S/) || ['E'])[0].toUpperCase();
  return (
    <div style={{
      width: '100%', height: '100%', background: bg,
      color: accent, fontSize: 32, fontWeight: 800,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '50%',
    }}>{initial}</div>
  );
}

const Profile = () => {
  const { user: cachedUser } = useAuth();
  const [profile, setProfile] = useState(cachedUser || null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [assets,  setAssets]  = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await profileAPI.getProfile();
        if (cancelled) return;
        const u = res.data?.user || res.data?.profile || res.data || null;
        if (u) setProfile(u);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await profileAPI.myAssets();
        if (cancelled) return;
        setAssets(Array.isArray(res.data?.items) ? res.data.items : []);
      } catch { /* leave empty */ }
      finally { if (!cancelled) setAssetsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const u = profile || {};
  const fullName =
    u.name ||
    [u.firstName, u.lastName].filter(Boolean).join(' ') ||
    u.email || '—';
  const designation = pickLabel(u.designation, u.designationTitle) || u.role || '—';
  const department  = pickLabel(u.department,  u.departmentName)   || '';
  const empId       = u.employeeId || u.userId || '—';
  const phone       = u.phone || '—';
  const email       = u.email || '—';
  const dob         = u.dob   || '—';
  const bloodGroup  = u.bloodGroup || '—';

  return (
    <div className="profile-page-modern page-enter">

      {/* Top Banner Card */}
      <div className="profile-banner-card">
        <div className="banner-green-bg"></div>
        <div className="banner-content">
          <div className="profile-avatar-container">
            <div className="profile-avatar-modern" style={{ overflow: 'hidden' }}>
              {u.photoUrl
                ? <img src={u.photoUrl} alt="Profile" className="profile-img-real" />
                : genderAvatar(u.gender, fullName)}
            </div>
            <div className="verified-badge">
              <CheckCircle size={16} fill="#4CAA17" color="white" />
            </div>
          </div>
          <div className="profile-identity-modern">
            <h1>{fullName}</h1>
            <p>{(designation || '').toUpperCase()}{department ? ` · ${department}` : ''}</p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          margin: '12px 24px', padding: '10px 14px',
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 8, color: '#991B1B', fontSize: 13,
        }}>
          {error} (Showing cached profile.)
        </div>
      )}

      <div className="profile-main-grid">
        {/* Left Column — Personal Information */}
        <div className="profile-left-col">
          <div className="section-header-modern">
            <h2>Personal Information</h2>
          </div>

          <div className="info-cards-grid">
            <div className="info-card">
              <div className="info-text">
                <label>EMPLOYEE ID</label>
                <p>{empId}</p>
              </div>
              <Contact size={20} className="info-icon" />
            </div>

            <div className="info-card">
              <div className="info-text">
                <label>MOBILE NO</label>
                <p>{phone}</p>
              </div>
              <Phone size={20} className="info-icon" />
            </div>

            <div className="info-card">
              <div className="info-text">
                <label>EMAIL ID</label>
                <p>{email}</p>
              </div>
              <Mail size={20} className="info-icon" />
            </div>

            <div className="info-card">
              <div className="info-text">
                <label>DATE OF BIRTH</label>
                <p>{dob}</p>
              </div>
              <Calendar size={20} className="info-icon" />
            </div>

            <div className="info-card">
              <div className="info-text">
                <label>BLOOD GROUP</label>
                <p>{bloodGroup}</p>
              </div>
              <Droplet size={20} className="info-icon blood-icon" />
            </div>

            <div className="info-card">
              <div className="info-text">
                <label>DESIGNATION</label>
                <p>{designation}</p>
              </div>
              <Briefcase size={20} className="info-icon" />
            </div>

            {department && (
              <div className="info-card full-width">
                <div className="info-text">
                  <label>DEPARTMENT</label>
                  <p>{department}</p>
                </div>
                <Building2 size={20} className="info-icon" />
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Assigned Assets (real, from HRMS) */}
        <div className="profile-right-col">
          <div className="section-header-modern">
            <h2>Assigned Assets</h2>
          </div>

          <div className="assets-list">
            {assetsLoading && (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                Loading assets…
              </div>
            )}
            {!assetsLoading && assets.length === 0 && (
              <div style={{
                padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13,
                background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1',
              }}>
                <Package size={28} color="#94A3B8" style={{ marginBottom: 6 }} />
                <div>No company assets assigned to you yet.</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>HR can issue laptops, monitors, ID cards, etc.</div>
              </div>
            )}
            {!assetsLoading && assets.map((a) => {
              const Icon = pickAssetIcon(a.type);
              const issued = a.issuedDate
                ? new Date(a.issuedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : '';
              return (
                <div className="asset-card" key={a._id}>
                  <div className="asset-top">
                    <div className="asset-icon-box">
                      <Icon size={24} />
                    </div>
                    <span className="asset-badge">{String(a.status || 'ASSIGNED').toUpperCase()}</span>
                  </div>
                  <div className="asset-details">
                    <h3>{a.assetName || a.type || 'Asset'}</h3>
                    <p>Serial: {a.serialNo || a.assetId || '—'}</p>
                  </div>
                  {issued && (
                    <div className="asset-footer">
                      <span className="issue-date">Issued: {issued}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Profile;
