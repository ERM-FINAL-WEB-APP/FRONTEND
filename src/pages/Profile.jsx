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

// ID Card rows are stored with whatever brand HR typed (e.g. "hp" because
// the same Add-Asset form is used for both laptop + ID card in one shot),
// but on Profile the right thing to show is the literal "ID Card". Mirror
// of the override applied in the HRMS Assets table.
function displayAssetName(a) {
  if (/id ?card/i.test(a.type || '')) return 'ID Card';
  return a.assetName || a.type || 'Asset';
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

/**
 * Default profile avatar — a uniform green circle showing the employee's
 * first letter. Same style across the app (Profile page + Navbar)
 * because the brand uses green as the canonical "employee" colour.
 */
function initialAvatar(name) {
  const initial = (String(name || 'E').match(/\S/) || ['E'])[0].toUpperCase();
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#4CAA17',
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '50%',
      fontSize: 32, fontWeight: 800,
      letterSpacing: 0.5,
      userSelect: 'none',
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

  // Show Assets column only when there's at least one real asset on file.
  // While the assets request is still in flight we hide the column so the
  // page doesn't flash an empty card and then a populated one (or vice
  // versa) once the response lands.
  const hasAssets = !assetsLoading && assets.length > 0;

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
                : initialAvatar(fullName)}
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

      <div
        className="profile-main-grid"
        style={{
          // When the user has no assets we hide the right column entirely,
          // so let the personal-info column span the full width instead of
          // sitting in a half-empty 2-column grid.
          gridTemplateColumns: hasAssets ? undefined : '1fr',
        }}
      >
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

        {/* Right Column — Assigned Assets (real, from HRMS).
            Only shown if the employee actually has 1+ assets in HRMS;
            otherwise the whole section + header is hidden so we never
            display an empty "no assets" placeholder. */}
        {hasAssets && (
          <div className="profile-right-col">
            <div className="section-header-modern">
              <h2>Assigned Assets</h2>
            </div>

            <div className="assets-list">
              {assets.map((a) => {
                const Icon = pickAssetIcon(a.type);
                const issued = a.issuedDate
                  ? (() => { const __d = new Date(a.issuedDate); if (!__d || isNaN(__d.getTime?.() ?? new Date(__d).getTime())) return '—'; const __dd = (__d instanceof Date) ? __d : new Date(__d); const __day = String(__dd.getDate()).padStart(2,'0'); const __mo  = String(__dd.getMonth()+1).padStart(2,'0'); const __yr  = __dd.getFullYear(); return __day + '-' + __mo + '-' + __yr; })()
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
                      <h3>{displayAssetName(a)}</h3>
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
        )}
      </div>

    </div>
  );
};

export default Profile;
