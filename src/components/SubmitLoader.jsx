/**
 * SubmitLoader (ERM Web) — premium center-of-screen overlay shown during
 * any request submission (Leave, Permission, Allowance Petrol, Allowance
 * Travel, Attendance Request, Payslip Request, Complaint).
 *
 * Why a shared component (#298): every page previously used either a
 * disabled button + tiny inline spinner or nothing at all. On a slow
 * backend cold-start (Render free tier — up to 30 s wake) users assumed
 * their tap didn't register and clicked again, producing duplicate rows.
 * This component renders as a fixed-position full-viewport overlay that
 * stays dead-centered regardless of scroll, dims the page so no other
 * control can be tapped, and uses the same gradient ring + halo as the
 * mobile loader for design parity.
 */
import React, { useEffect } from 'react';

const KEYFRAMES_ID = 'erm-submit-loader-keyframes-v1';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.innerHTML = `
    @keyframes erm-spin-ring {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes erm-pulse-halo {
      0%   { transform: scale(0.85); opacity: 0.6; }
      50%  { transform: scale(1.15); opacity: 0.15; }
      100% { transform: scale(0.85); opacity: 0.6; }
    }
    @keyframes erm-dot-march {
      0%, 100% { opacity: 0.35; }
      50%      { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

export default function SubmitLoader({
  visible,
  label = 'Submitting your request',
  sub   = 'Hang tight — confirming with the server…',
  accent = '#16A34A',
}) {
  useEffect(() => { injectKeyframes(); }, []);
  if (!visible) return null;

  const isGreen = String(accent).toLowerCase() === '#16a34a';
  const ringSoft = isGreen ? '#86EFAC' : '#93C5FD';
  const tint     = isGreen ? '#DCFCE7' : '#DBEAFE';
  const accent2  = isGreen ? '#22C55E' : '#3B82F6';

  return (
    <div
      role="alert"
      aria-busy="true"
      aria-live="polite"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#FFFFFF', borderRadius: 28,
          padding: '36px 34px', minWidth: 320, maxWidth: 360,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: '0 14px 32px rgba(15, 23, 42, 0.28)',
        }}
      >
        <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: tint, animation: 'erm-pulse-halo 1.8s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 94, height: 94, borderRadius: 47, border: '4px solid', borderTopColor: accent, borderRightColor: accent2, borderBottomColor: ringSoft, borderLeftColor: 'transparent', animation: 'erm-spin-ring 1.4s linear infinite' }} />
          <div style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 12px rgba(15, 23, 42, 0.22)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
        </div>
        <div style={{ marginTop: 18, fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: 0.2, textAlign: 'center' }}>
          {label}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 1.45 }}>
          {sub}
        </div>
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'row', gap: 8 }}>
          {[accent, accent2, ringSoft].map((c, i) => (
            <span
              key={i}
              style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: c,
                animation: 'erm-dot-march 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
