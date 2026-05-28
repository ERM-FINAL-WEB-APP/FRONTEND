import React, { useEffect, useState } from 'react';
import { Contact, Phone, Mail, Calendar, Droplet, Laptop, CheckCircle, Briefcase, Building2 } from 'lucide-react';
import { profileAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import profileAvatarImg from '../Assets/profile_avatar.png';
import './Profile.css';

/**
 * Profile — read-only view of the signed-in employee's own record.
 * Pulls from GET /api/profile, falls back to the user object cached
 * in AuthContext if the API call fails (offline / cold-start).
 */

function pickLabel(value, sidecar) {
  // Reject 24-char hex ObjectIds. Prefer the populated doc's title/name,
  // then the denormalised sidecar field, otherwise empty.
  const isHexId = (s) => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);
  if (value && typeof value === 'object') {
    const t = value.title || value.name || '';
    if (t && !isHexId(t)) return t;
  }
  if (typeof value === 'string' && value && !isHexId(value)) return value;
  if (sidecar && typeof sidecar === 'string' && !isHexId(sidecar)) return sidecar;
  return '';
}

const Profile = () => {
  const { user: cachedUser } = useAuth();
  const [profile, setProfile] = useState(cachedUser || null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await profileAPI.getProfile();
        if (cancelled) return;
        // Backend may return { user } / { profile } / the user object directly.
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
            <div className="profile-avatar-modern">
              {u.photoUrl
                ? <img src={u.photoUrl} alt="Profile" className="profile-img-real" />
                : <img src={profileAvatarImg} alt="Profile" className="profile-img-real" />}
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

        {/* Right Column — Employment summary */}
        <div className="profile-right-col">
          <div className="section-header-modern">
            <h2>Employment</h2>
          </div>

          <div className="assets-list">
            <div className="asset-card">
              <div className="asset-top">
                <div className="asset-icon-box">
                  <Briefcase size={24} />
                </div>
                <span className="asset-badge">{u.status || 'ACTIVE'}</span>
              </div>
              <div className="asset-details">
                <h3>{designation}</h3>
                <p>{department || u.employmentType || 'Full-time'}</p>
              </div>
              {u.joiningDate && (
                <div className="asset-footer">
                  <span className="issue-date">
                    Joined: {new Date(u.joiningDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            <div className="asset-card">
              <div className="asset-top">
                <div className="asset-icon-box">
                  <Laptop size={24} />
                </div>
                <span className="asset-badge">{(u.workType || 'OFFICE').toUpperCase()}</span>
              </div>
              <div className="asset-details">
                <h3>Leave Balance</h3>
                <p>{Number(u.leaveBalance ?? 12)} days · {Number(u.permissionBalance ?? 4)} permissions</p>
              </div>
              {loading && (
                <div className="asset-footer">
                  <span className="issue-date">Loading latest…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Profile;
