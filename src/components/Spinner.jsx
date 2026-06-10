import React from 'react';

/**
 * Spinner — small inline loading indicator.
 *
 * Used inside submit buttons to make slow submissions feel professional
 * rather than dead. We previously just rendered "Submitting…" text,
 * which on a Render free-tier cold-start (~10-30 s) felt like the page
 * had locked up. A real spinner is the universal "we're working" cue.
 *
 * Props:
 *   size   — pixel diameter (default 16)
 *   color  — stroke colour (default white, suits coloured buttons)
 *   label  — optional text shown to the right of the spinner
 *
 * No extra CSS file — the keyframe + classes are scoped via a one-time
 * style tag injected on first mount, so the component stays drop-in.
 */
let _styleInjected = false;
function ensureSpinnerStyle() {
  if (_styleInjected || typeof document === 'undefined') return;
  _styleInjected = true;
  const css = `
@keyframes erm-spinner-spin { to { transform: rotate(360deg); } }
.erm-spinner__circle {
  display: inline-block;
  border-radius: 50%;
  border-style: solid;
  border-color: currentColor;
  border-top-color: transparent;
  animation: erm-spinner-spin 0.7s linear infinite;
  box-sizing: border-box;
}
.erm-spinner__wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}`;
  const tag = document.createElement('style');
  tag.setAttribute('data-erm-spinner', '1');
  tag.appendChild(document.createTextNode(css));
  document.head.appendChild(tag);
}

export default function Spinner({ size = 16, color = '#fff', label }) {
  ensureSpinnerStyle();
  const stroke = Math.max(2, Math.round(size / 8));
  const circle = (
    <span
      className="erm-spinner__circle"
      style={{ width: size, height: size, borderWidth: stroke, color }}
      aria-hidden="true"
    />
  );
  if (!label) {
    return <span className="erm-spinner__wrap" role="status" aria-live="polite">{circle}</span>;
  }
  return (
    <span className="erm-spinner__wrap" role="status" aria-live="polite">
      {circle}
      <span>{label}</span>
    </span>
  );
}
