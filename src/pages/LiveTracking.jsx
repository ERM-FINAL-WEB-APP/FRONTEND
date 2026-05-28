import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Activity, Clock, MapPin, RefreshCw, User as UserIcon } from 'lucide-react';
import { managerAPI } from '../services/api';
import 'leaflet/dist/leaflet.css';
import './LiveTracking.css';

/**
 * Manager → Live Tracking tab.
 * Shows the latest GPS position for each subordinate of the logged-in
 * manager. Polls every 60 seconds. Backed by /api/manager/live-locations
 * which filters by assignedTo === manager's name server-side.
 */

const STATUS_COLOR = {
  active:     '#16A34A',
  travelling: '#16A34A',
  idle:       '#94A3B8',
  offline:    '#94A3B8',
};
const STATUS_LABEL = {
  active:     'Active',
  travelling: 'Travelling',
  idle:       'Location off',
  offline:    'Offline',
};

function makeMarkerIcon(name, color) {
  const initial = (String(name || 'E').match(/\S/) || ['E'])[0].toUpperCase();
  const html = `
    <div style="
      position:relative;
      width:36px;height:36px;border-radius:50%;
      background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:800;
      border:3px solid #fff;
      box-shadow:0 4px 10px rgba(0,0,0,0.25);
    ">${initial}</div>`;
  return L.divIcon({ html, className: '', iconSize: [36, 36], iconAnchor: [18, 18] });
}

function fmtTime(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

const LiveTracking = () => {
  const [team,    setTeam]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,   setError]   = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await managerAPI.liveLocations();
      setTeam(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(err?.message || 'Could not load live locations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000);   // refresh every minute
    return () => clearInterval(t);
  }, [load]);

  const withCoords  = team.filter((e) => e.lat != null && e.lng != null);
  const center      = withCoords.length > 0 ? [withCoords[0].lat, withCoords[0].lng] : [13.0412, 80.2127];

  const activeCount  = team.filter((e) => e.status === 'active' || e.status === 'travelling').length;
  const offlineCount = team.length - activeCount;

  return (
    <div className="live-tracking-page" style={{ padding: '16px 24px' }}>
      {/* Summary chips */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div style={{ padding: '6px 14px', borderRadius: 999, background: '#F1F9EE', color: '#16A34A', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} /> {activeCount} Active
        </div>
        <div style={{ padding: '6px 14px', borderRadius: 999, background: '#F8FAFC', color: '#64748B', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Clock size={14} /> {offlineCount} Offline
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => { setRefreshing(true); load(); }}
            disabled={refreshing}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: '#fff', color: '#475569',
              border: '1px solid #E2E8F0', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: 12, padding: '10px 12px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#991B1B', fontSize: 13,
        }}>{error}</div>
      )}

      {loading && <div style={{ padding: 40, color: '#64748B' }}>Loading team locations…</div>}

      {!loading && team.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#64748B', fontSize: 14,
          background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1',
        }}>
          <UserIcon size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
          <div>No employees are assigned to you in HRMS yet.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>HR sets this via the "Manager" dropdown on each employee record.</div>
        </div>
      )}

      {!loading && team.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, height: '70vh' }}>
          {/* Left list */}
          <div style={{
            overflowY: 'auto', padding: 8, borderRadius: 12,
            border: '1px solid #E2E8F0', background: '#fff',
          }}>
            {team.map((e) => (
              <button
                key={e._id}
                onClick={() => setSelected(e)}
                style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: 10, marginBottom: 6, borderRadius: 8,
                  width: '100%', textAlign: 'left',
                  background: selected?._id === e._id ? '#F1F9EE' : 'transparent',
                  border: selected?._id === e._id ? '1px solid #BBF7D0' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: STATUS_COLOR[e.status] || '#94A3B8',
                  color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800,
                }}>{(e.name || 'E').charAt(0).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{e.designation || e.employeeId}</div>
                  <div style={{ fontSize: 10, color: STATUS_COLOR[e.status] || '#94A3B8', fontWeight: 700, marginTop: 2 }}>
                    {STATUS_LABEL[e.status] || e.status} {e.lastSeen ? `· ${fmtTime(e.lastSeen)}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Map */}
          <div style={{
            position: 'relative', borderRadius: 12, overflow: 'hidden',
            border: '1px solid #E2E8F0',
          }}>
            <MapContainer
              center={selected && selected.lat ? [selected.lat, selected.lng] : center}
              zoom={selected ? 14 : 12}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                subdomains={['mt0','mt1','mt2','mt3']}
                maxZoom={20}
              />
              {withCoords.map((e) => (
                <Marker
                  key={e._id}
                  position={[e.lat, e.lng]}
                  icon={makeMarkerIcon(e.name, STATUS_COLOR[e.status] || '#94A3B8')}
                  eventHandlers={{ click: () => setSelected(e) }}
                >
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {e.designation || ''}{e.employeeId ? ` · ${e.employeeId}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: STATUS_COLOR[e.status] || '#94A3B8', fontWeight: 700, marginTop: 6 }}>
                        {STATUS_LABEL[e.status] || e.status}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={10} /> Last ping {fmtTime(e.lastSeen)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTracking;
