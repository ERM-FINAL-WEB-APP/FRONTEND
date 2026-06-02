import React, { useEffect, useState, useCallback, useRef } from 'react';
// ─────────────────────────────────────────────────────────────────────────────
// ERM Web → Manager → Live Tracking
//
// Migrated from react-leaflet → @react-google-maps/api on 2026-06.
// The old TileLayer pointed at the unofficial Google tile URL
// (https://{s}.google.com/vt/lyrs=…) which has no SLA and can be
// blocked any time. We now use the official Maps JavaScript API
// authenticated with VITE_GOOGLE_MAPS_API_KEY.
//
// Required setup
// ──────────────
//   1. `npm install` so @react-google-maps/api is on disk.
//   2. Add VITE_GOOGLE_MAPS_API_KEY=<your-key> to Frontend/.env (local)
//      AND to your Vercel project env vars (production).
//   3. In Google Cloud Console: enable "Maps JavaScript API" and
//      add this domain to the key's HTTP-referrer restriction.
// ─────────────────────────────────────────────────────────────────────────────
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, CircleF, OverlayViewF } from '@react-google-maps/api';
import {
  Activity, Clock, MapPin, RefreshCw, User as UserIcon,
  Wifi, WifiOff, CircleDot,
} from 'lucide-react';
import { managerAPI } from '../services/api';
import './LiveTracking.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const STATUS_COLOR = {
  active:     '#16A34A',
  travelling: '#16A34A',
  office:     '#16A34A',
  idle:       '#F59E0B',
  offline:    '#475569',
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

/* ─── HTML overlay marker — a coloured circle with the employee's initial.
   Uses OverlayViewF instead of a plain MarkerF so we can keep the rich
   visual design (initial letter + pulse ring) the manager UI had with
   the old leaflet div-icon. */
function NameInitialOverlay({ employee, isSelected, onClick }) {
  if (typeof employee?.lat !== 'number' || typeof employee?.lng !== 'number') return null;
  const initial = (String(employee.name || 'E').match(/\S/) || ['E'])[0].toUpperCase();
  const color   = STATUS_COLOR[employee.status] || '#475569';
  const size    = isSelected ? 44 : 36;

  return (
    <OverlayViewF
      position={{ lat: employee.lat, lng: employee.lng }}
      mapPaneName="overlayMouseTarget"
      getPixelPositionOffset={() => ({ x: -(size / 2), y: -(size / 2) })}
    >
      <div
        onClick={onClick}
        style={{ position: 'relative', width: size, height: size, cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isSelected ? 15 : 13, fontWeight: 800,
          border: '3px solid #fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          transform: isSelected ? 'scale(1.05)' : 'none',
        }}>{initial}</div>
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: size + 12, height: size + 12,
            borderRadius: '50%',
            background: color, opacity: 0.18,
            transform: 'translate(-50%, -50%)',
            animation: 'erm-pulse 1.6s ease-out infinite',
          }} />
        )}
      </div>
    </OverlayViewF>
  );
}

/* ─── Formatters ─── */
function fmtRelTime(d) {
  if (!d) return '—';
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 30)      return 'just now';
  if (sec < 60)      return `${sec}s ago`;
  if (sec < 3600)    return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400)   return `${Math.floor(sec / 3600)}h ago`;
  return (() => {
    const __d = new Date(d);
    if (!__d || isNaN(__d.getTime())) return '—';
    const __day = String(__d.getDate()).padStart(2, '0');
    const __mo  = String(__d.getMonth() + 1).padStart(2, '0');
    const __yr  = __d.getFullYear();
    return `${__day}-${__mo}-${__yr}`;
  })();
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
  const [activePopup, setActivePopup] = useState(null);

  // Re-tick a clock so "12s ago" updates without a re-fetch.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // Google Maps JS API loader — single instance per tab.
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    id: 'tesco-erm-google-maps',
  });
  const mapRef = useRef(null);
  const didFit = useRef(false);

  const load = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    try {
      setError('');
      const res = await managerAPI.liveLocations();
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
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

  const mapTarget =
    selected && selected.lat != null
      ? selected
      : (withCoords[0] || OFFICE_DEFAULT);

  // Fly to selected employee whenever it changes.
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (!selected || selected.lat == null || selected.lng == null) return;
    mapRef.current.panTo({ lat: selected.lat, lng: selected.lng });
    mapRef.current.setZoom(16);
  }, [isLoaded, selected?._id, selected?.lat, selected?.lng]);

  // First-load fit: frame all visible GPS points exactly once.
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps) return;
    if (didFit.current) return;
    if (withCoords.length < 2) return;
    const bounds = new window.google.maps.LatLngBounds();
    withCoords.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    mapRef.current.fitBounds(bounds, 80);
    didFit.current = true;
  }, [isLoaded, withCoords.length]);

  const activeCount  = team.filter((e) => e.status === 'active' || e.status === 'travelling' || e.status === 'office').length;
  const idleCount    = team.filter((e) => e.status === 'idle').length;
  const offlineCount = team.length - activeCount - idleCount;

  return (
    <div className="live-tracking-page" style={{ padding: '16px 24px' }}>
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
        <Chip color="#334155" bg="#F8FAFC" icon={<WifiOff size={14} />} label={`${offlineCount} Offline`} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#334155' }}>
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
        <div style={{ padding: 40, color: '#334155' }}>Loading team locations…</div>
      )}

      {!loading && team.length === 0 && (
        <div style={{
          padding: 60, textAlign: 'center', color: '#334155', fontSize: 14,
          background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1',
        }}>
          <UserIcon size={32} color="#475569" style={{ marginBottom: 8 }} />
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
                  background: STATUS_COLOR[e.status] || '#475569',
                  color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, flexShrink: 0,
                }}>{(e.name || 'E').charAt(0).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: '#0F172A',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.name || 'Unknown'}</div>
                  <div style={{
                    fontSize: 11, color: '#334155',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.designation || e.employeeId || ''}</div>
                  <div style={{
                    fontSize: 10, color: STATUS_COLOR[e.status] || '#475569',
                    fontWeight: 700, marginTop: 2,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {STATUS_LABEL[e.status] || e.status}
                    {e.lat != null && e.lastSeen && (
                      <span style={{ color: '#475569', fontWeight: 500 }}>· {fmtRelTime(e.lastSeen)}</span>
                    )}
                    {e.lat == null && (
                      <span style={{ color: '#475569', fontWeight: 500 }}>· no GPS</span>
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

            {noCoords.length > 0 && noCoords.length < team.length && (
              <div style={{
                fontSize: 10, color: '#475569',
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
                color: '#334155', fontSize: 13, textAlign: 'center', padding: 24,
              }}>
                <MapPin size={28} style={{ marginBottom: 6, opacity: 0.5 }} />
                <div style={{ fontWeight: 700 }}>No live GPS data right now</div>
                <div style={{ fontSize: 12, marginTop: 4, maxWidth: 320 }}>
                  None of your team members have an active GPS ping today.
                  They'll appear here as soon as they check in via the mobile app.
                </div>
              </div>
            )}

            {!GOOGLE_MAPS_API_KEY && (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: 24, textAlign: 'center', color: '#92400E', background: '#FFFBEB', fontSize: 13 }}>
                <strong>VITE_GOOGLE_MAPS_API_KEY is not configured</strong>
                <span style={{ fontSize: 12 }}>Add it to Frontend/.env (local) and to your Vercel project env vars, then redeploy.</span>
              </div>
            )}
            {GOOGLE_MAPS_API_KEY && loadError && (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: 24, textAlign: 'center', color: '#B91C1C', background: '#FEF2F2', fontSize: 13 }}>
                <strong>Google Maps failed to load</strong>
                <span style={{ fontSize: 12 }}>Check the "Maps JavaScript API" is enabled and HTTP-referrer restriction includes this domain.</span>
              </div>
            )}
            {GOOGLE_MAPS_API_KEY && !loadError && !isLoaded && (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', background: '#F8FAFC', fontSize: 13 }}>
                Loading Google Maps…
              </div>
            )}

            {GOOGLE_MAPS_API_KEY && isLoaded && !loadError && (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={{ lat: mapTarget.lat, lng: mapTarget.lng }}
                zoom={selected ? 16 : 13}
                onLoad={(m) => { mapRef.current = m; }}
                options={{
                  streetViewControl: false,
                  fullscreenControl: false,
                  mapTypeControl: false,
                  styles: [
                    { featureType: 'poi',     elementType: 'labels', stylers: [{ visibility: 'off' }] },
                    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
                  ],
                }}
              >
                {/* Office reference circle — 200 m geofence around HQ */}
                <CircleF
                  center={{ lat: OFFICE_DEFAULT.lat, lng: OFFICE_DEFAULT.lng }}
                  radius={200}
                  options={{
                    strokeColor:   '#4CAA17',
                    strokeWeight:  1,
                    strokeOpacity: 0.8,
                    fillColor:     '#4CAA17',
                    fillOpacity:   0.05,
                  }}
                />

                {withCoords.map((e) => (
                  <NameInitialOverlay
                    key={e._id}
                    employee={e}
                    isSelected={selected?._id === e._id}
                    onClick={() => {
                      setSelected(e);
                      setActivePopup(e);
                    }}
                  />
                ))}

                {activePopup && activePopup.lat != null && activePopup.lng != null && (
                  <InfoWindowF
                    position={{ lat: activePopup.lat, lng: activePopup.lng }}
                    onCloseClick={() => setActivePopup(null)}
                  >
                    <div style={{ minWidth: 180, padding: '4px 6px' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A' }}>{activePopup.name}</div>
                      <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>
                        {activePopup.designation || ''}{activePopup.employeeId ? ` · ${activePopup.employeeId}` : ''}
                      </div>
                      <div style={{
                        marginTop: 6, padding: '2px 8px', borderRadius: 999,
                        background: (STATUS_COLOR[activePopup.status] || '#475569') + '22',
                        color: STATUS_COLOR[activePopup.status] || '#475569',
                        fontSize: 10, fontWeight: 700, display: 'inline-block',
                        textTransform: 'uppercase', letterSpacing: 0.4,
                      }}>{STATUS_LABEL[activePopup.status] || activePopup.status}</div>
                      {activePopup.checkIn && (
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> Checked in {fmtClock(activePopup.checkIn)}
                          {activePopup.checkOut && <> · out {fmtClock(activePopup.checkOut)}</>}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} /> Last ping {fmtRelTime(activePopup.lastSeen)}
                      </div>
                    </div>
                  </InfoWindowF>
                )}
              </GoogleMap>
            )}
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
