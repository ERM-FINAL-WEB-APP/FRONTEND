import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import {
  Activity, Clock, MapPin, RefreshCw, User as UserIcon,
  Wifi, WifiOff, CircleDot,
} from 'lucide-react';
import { managerAPI } from '../services/api';
import 'leaflet/dist/leaflet.css';
import './LiveTracking.css';

/**
 * Manager → Live Tracking tab.
 *
 * Polls /api/manager/live-locations every 30 sec. Shows:
 *   • a roster on the left (status pills, last-ping time) — includes
 *     teammates who have no GPS data, so the manager can still see
 *     who's checked in vs offline
 *   • a Google-tile Leaflet map on the right with name-initial pins
 *     coloured by status
 *
 * Clicking a teammate in the roster (or a pin) re-centers and zooms
 * the map via the FlyTo child. Clicking the row again toggles the
 * selection.
 */

const STATUS_COLOR = {
  active:     '#16A34A',
  travelling: '#16A34A',
  office:     '#16A34A',
  idle:       '#F59E0B',
  offline:    '#94A3B8',
};
const STATUS_LABEL = {
  active:     'Active',
  travelling: 'Travelling',
  office:     'At office',
  idle:       'Location off',
  offline:    'Offline',
};

// Tesco Structures HQ default — used when no team member has live GPS,
// just so the map opens looking at something useful.
const OFFICE_DEFAULT = { lat: 13.0412, lng: 80.2127 };

/* ─── Marker icon — a 36px circle with the employee's initial ─── */
function makeMarkerIcon(name, color, isSelected) {
  const initial = (String(name || 'E').match(/\S/) || ['E'])[0].toUpperCase();
  const size = isSelected ? 44 : 36;
  const html = `
    <div style="
      position:relative;
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:${isSelected ? 15 : 13}px;font-weight:800;
      border:3px solid #fff;
      box-shadow:0 4px 12px rgba(0,0,0,0.3);
      ${isSelected ? 'transform:scale(1.05);' : ''}
    ">${initial}</div>
    ${isSelected ? `
      <div style="
        position:absolute;
        top:50%;left:50%;
        width:${size + 12}px;height:${size + 12}px;
        border-radius:50%;
        background:${color};opacity:0.18;
        transform:translate(-50%,-50%);
        animation:erm-pulse 1.6s ease-out infinite;
      "></div>` : ''}`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* ─── FlyTo child — re-centers the map when `target` changes ─── */
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target || target.lat == null || target.lng == null) return;
    try {
      map.flyTo([target.lat, target.lng], 16, { animate: true, duration: 0.7 });
    } catch { /* racing teardown — ignore */ }
  }, [target, map]);
  return null;
}

/* ─── FitAllToBounds — on first load, frame all visible pins ─── */
function FitAllToBounds({ points }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current) return;
    if (!points || points.length < 2) return;
    try {
      map.fitBounds(points.map((p) => [p.lat, p.lng]), {
        padding: [40, 40], animate: false, maxZoom: 15,
      });
      didFit.current = true;
    } catch { /* */ }
  }, [points, map]);
  return null;
}

/* ─── Formatters ─── */
function fmtRelTime(d) {
  if (!d) return '—';
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 30)      return 'just now';
  if (sec < 60)      return `${sec}s ago`;
  if (sec < 3600)    return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400)   return `${Math.floor(sec / 3600)}h ago`;
  return (() => { const __d = new Date(d); if (!__d || isNaN(__d.getTime?.() ?? new Date(__d).getTime())) return '—'; const __dd = (__d instanceof Date) ? __d : new Date(__d); const __day = String(__dd.getDate()).padStart(2,'0'); const __mo  = String(__dd.getMonth()+1).padStart(2,'0'); const __yr  = __dd.getFullYear(); return __day + '-' + __mo + '-' + __yr; })();
}
function fmtClock(d) {
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
  const [lastUpdated, setLastUpdated] = useState(null);

  // Re-tick a clock so "12s ago" updates without a re-fetch.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    try {
      setError('');
      const res = await managerAPI.liveLocations();
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      // Sort: active first, idle next, offline last; then by name within group.
      const order = { active: 0, travelling: 0, office: 0, idle: 1, offline: 2 };
      data.sort((a, b) => {
        const oa = order[a.status] ?? 3;
        const ob = order[b.status] ?? 3;
        if (oa !== ob) return oa - ob;
        return String(a.name).localeCompare(String(b.name));
      });
      setTeam(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Could not load live locations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(false), 30 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const withCoords = team.filter((e) => e.lat != null && e.lng != null);
  const noCoords   = team.filter((e) => e.lat == null || e.lng == null);

  // Map view target — defaults to office, switches to selected on click,
  // or first GPS-having teammate if there's no selection.
  const mapTarget =
    selected && selected.lat != null
      ? selected
      : (withCoords[0] || OFFICE_DEFAULT);

  const activeCount  = team.filter((e) => e.status === 'active' || e.status === 'travelling' || e.status === 'office').length;
  const idleCount    = team.filter((e) => e.status === 'idle').length;
  const offlineCount = team.length - activeCount - idleCount;

  return (
    <div className="live-tracking-page" style={{ padding: '16px 24px' }}>
      {/* Inline keyframes for the selected-pin pulse */}
      <style>{`
        @keyframes erm-pulse {
          0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0.6; }
          70%  { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
        }
        .spin { animation: erm-spin 1s linear infinite; }
        @keyframes erm-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Summary chips */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <Chip color="#16A34A" bg="#F1F9EE" icon={<Wifi    size={14} />} label={`${activeCount} Active`} />
        <Chip color="#F59E0B" bg="#FEFBEB" icon={<CircleDot size={14} />} label={`${idleCount} Location off`} />
        <Chip color="#64748B" bg="#F8FAFC" icon={<WifiOff size={14} />} label={`${offlineCount} Offline`} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#64748B' }}>
              Updated {fmtRelTime(lastUpdated)} · auto-refreshes every 30s
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: '#fff', color: '#475569',
              border: '1px solid #E2E8F0', cursor: refreshing ? 'wait' : 'pointer',
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

      {loading && (
        <div style={{ padding: 40, color: '#64748B' }}>Loading team locations…</div>
      )}

      {!loading && team.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#64748B', fontSize: 14,
          background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1',
        }}>
          <UserIcon size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
          <div>No employees are assigned to you in HRMS yet.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            HR sets this via the "Manager" dropdown on each employee record.
          </div>
        </div>
      )}

      {!loading && team.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16,
          height: '70vh', minHeight: 500,
        }}>
          {/* Left list */}
          <div style={{
            overflowY: 'auto', padding: 8, borderRadius: 12,
            border: '1px solid #E2E8F0', background: '#fff',
          }}>
            {team.map((e) => (
              <button
                key={e._id}
                onClick={() => setSelected(selected?._id === e._id ? null : e)}
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
                  fontSize: 13, fontWeight: 800, flexShrink: 0,
                }}>{(e.name || 'E').charAt(0).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: '#0F172A',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.name || 'Unknown'}</div>
                  <div style={{
                    fontSize: 11, color: '#64748B',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.designation || e.employeeId || ''}</div>
                  <div style={{
                    fontSize: 10, color: STATUS_COLOR[e.status] || '#94A3B8',
                    fontWeight: 700, marginTop: 2,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {STATUS_LABEL[e.status] || e.status}
                    {e.lat != null && e.lastSeen && (
                      <span style={{ color: '#94A3B8', fontWeight: 500 }}>· {fmtRelTime(e.lastSeen)}</span>
                    )}
                    {e.lat == null && (
                      <span style={{ color: '#94A3B8', fontWeight: 500 }}>· no GPS</span>
                    )}
                  </div>
                </div>
                {e.checkIn && !e.checkOut && (
                  <span style={{
                    flexShrink: 0, padding: '2px 8px', borderRadius: 999,
                    background: '#F1F9EE', color: '#16A34A',
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
                  }}>IN</span>
                )}
              </button>
            ))}

            {/* Tail: an explanation row if some teammates have no GPS */}
            {noCoords.length > 0 && noCoords.length < team.length && (
              <div style={{
                fontSize: 10, color: '#94A3B8',
                padding: '8px 10px', textAlign: 'center',
                borderTop: '1px dashed #E2E8F0', marginTop: 6,
              }}>
                {noCoords.length} {noCoords.length === 1 ? 'teammate has' : 'teammates have'} no GPS
                data today (haven't checked in or location is off).
              </div>
            )}
          </div>

          {/* Map */}
          <div style={{
            position: 'relative', borderRadius: 12, overflow: 'hidden',
            border: '1px solid #E2E8F0', minHeight: 400,
          }}>
            {withCoords.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 5,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.85)',
                color: '#64748B', fontSize: 13, textAlign: 'center', padding: 24,
              }}>
                <MapPin size={28} style={{ marginBottom: 6, opacity: 0.5 }} />
                <div style={{ fontWeight: 700 }}>No live GPS data right now</div>
                <div style={{ fontSize: 12, marginTop: 4, maxWidth: 320 }}>
                  None of your team members have an active GPS ping today.
                  They'll appear here as soon as they check in via the mobile app.
                </div>
              </div>
            )}

            <MapContainer
              center={[mapTarget.lat, mapTarget.lng]}
              zoom={selected ? 16 : 13}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
              attributionControl={false}
              preferCanvas={true}
            >
              <TileLayer
                url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                subdomains={['mt0','mt1','mt2','mt3']}
                maxZoom={20}
              />

              <FlyTo target={selected} />
              <FitAllToBounds points={withCoords} />

              {/* Office reference circle */}
              <Circle
                center={[OFFICE_DEFAULT.lat, OFFICE_DEFAULT.lng]}
                radius={200}
                pathOptions={{
                  color: '#4CAA17',
                  weight: 1,
                  fillColor: '#4CAA17',
                  fillOpacity: 0.05,
                  dashArray: '4 6',
                }}
              />

              {withCoords.map((e) => (
                <Marker
                  key={e._id}
                  position={[e.lat, e.lng]}
                  icon={makeMarkerIcon(e.name, STATUS_COLOR[e.status] || '#94A3B8', selected?._id === e._id)}
                  eventHandlers={{ click: () => setSelected(e) }}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {e.designation || ''}{e.employeeId ? ` · ${e.employeeId}` : ''}
                      </div>
                      <div style={{
                        marginTop: 6, padding: '2px 8px', borderRadius: 999,
                        background: (STATUS_COLOR[e.status] || '#94A3B8') + '22',
                        color: STATUS_COLOR[e.status] || '#94A3B8',
                        fontSize: 10, fontWeight: 700, display: 'inline-block',
                        textTransform: 'uppercase', letterSpacing: 0.4,
                      }}>{STATUS_LABEL[e.status] || e.status}</div>
                      {e.checkIn && (
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> Checked in {fmtClock(e.checkIn)}
                          {e.checkOut && <> · out {fmtClock(e.checkOut)}</>}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} /> Last ping {fmtRelTime(e.lastSeen)}
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

function Chip({ color, bg, icon, label }) {
  return (
    <div style={{
      padding: '6px 14px', borderRadius: 999,
      background: bg, color, fontSize: 12, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {icon} {label}
    </div>
  );
}

export default LiveTracking;
