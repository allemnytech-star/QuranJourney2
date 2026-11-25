// Centralised feature-illustration registry (soft-realistic 3D, local SVG, no WebGL).
// Materials: emerald, champagne gold, ivory, warm wood; one light source (top-left),
// one contact shadow, consistent 3/4 perspective. Colours read the active palette
// tokens, so illustrations follow every theme and dark mode. Small functional icons
// (search, close, play…) stay in the flat Icon set; only feature art lives here.
import { useId, type ReactNode } from 'react'

export type IllustrationId = 'guided' | 'free' | 'retention' | 'minute' | 'tadabbur' | 'recite' | 'model' | 'mushaf' | 'mistakes' | 'welcome'

function Base({ size, label, children }: { size: number; label?: string; children: (id: string) => ReactNode }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="shrink-0">
      <defs>
        <linearGradient id={`${id}e`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3f9a6c" /><stop offset="1" stopColor="#1d5a3e" /></linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3dfa6" /><stop offset=".55" stopColor="#c9a24f" /><stop offset="1" stopColor="#9a7531" /></linearGradient>
        <linearGradient id={`${id}i`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffdf6" /><stop offset="1" stopColor="#ece4cf" /></linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b9814f" /><stop offset="1" stopColor="#7a4e2c" /></linearGradient>
        <radialGradient id={`${id}s`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#000" stopOpacity=".28" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="32" cy="56" rx="22" ry="4.5" fill={`url(#${id}s)`} />
      {children(id)}
    </svg>
  )
}
const hl = 'rgba(255,255,255,.55)'

const ART: Record<IllustrationId, (id: string) => ReactNode> = {
  // Path of three stones rising to a gold star — a guided sequence.
  guided: (id) => (
    <>
      <path d="M10 50c6-10 16-6 22-14s8-16 18-20" fill="none" stroke={`url(#${id}g)`} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 6" />
      <ellipse cx="13" cy="49" rx="6" ry="3.4" fill={`url(#${id}e)`} /><ellipse cx="12" cy="48" rx="3" ry="1.2" fill={hl} />
      <ellipse cx="31" cy="38" rx="6" ry="3.4" fill={`url(#${id}e)`} /><ellipse cx="30" cy="37" rx="3" ry="1.2" fill={hl} />
      <path d="M48 8l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L48 24.5l-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1z" fill={`url(#${id}g)`} />
      <path d="M46 12l1.6-3 1.2 3z" fill={hl} />
    </>
  ),
  // Sprout from an ivory book — free memorisation.
  free: (id) => (
    <>
      <path d="M8 44l24 8 24-8v-6L32 46 8 38z" fill={`url(#${id}g)`} />
      <path d="M8 38l24 8V30L8 22z" fill={`url(#${id}i)`} /><path d="M56 38l-24 8V30l24-8z" fill={`url(#${id}i)`} opacity=".92" />
      <path d="M32 30c0-8 2-12 2-16" stroke="#2f7d4f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M34 16c6-6 14-4 14-4s-2 9-12 8z" fill={`url(#${id}e)`} /><path d="M33 20c-6-5-13-2-13-2s3 8 12 6z" fill={`url(#${id}e)`} />
      <path d="M38 15c3-2 6-2 6-2" stroke={hl} strokeWidth="1.2" fill="none" />
    </>
  ),
  // Two interlocking gold rings around an emerald gem — retention.
  retention: (id) => (
    <>
      <circle cx="32" cy="32" r="17" fill="none" stroke={`url(#${id}g)`} strokeWidth="5" />
      <path d="M18 24a17 17 0 0 1 24-8" stroke={hl} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M32 21l9 7-9 15-9-15z" fill={`url(#${id}e)`} /><path d="M32 21l-9 7h18z" fill="#5fb88a" /><path d="M29 25l3-2 2 2z" fill={hl} />
      <path d="M46 14l4 2-2 4" stroke={`url(#${id}g)`} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  // Ivory clock with gold rim — one minute.
  minute: (id) => (
    <>
      <circle cx="32" cy="32" r="20" fill={`url(#${id}g)`} /><circle cx="32" cy="31" r="16" fill={`url(#${id}i)`} />
      <path d="M32 19v12l7 4" stroke="#1d5a3e" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="31" r="2" fill="#1d5a3e" /><path d="M20 22a16 16 0 0 1 10-6" stroke={hl} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  // Oil lamp with soft light — reflection.
  tadabbur: (id) => (
    <>
      <circle cx="32" cy="18" r="12" fill="#f3dfa6" opacity=".35" />
      <path d="M32 8c4 5 4 9 0 12-4-3-4-7 0-12z" fill={`url(#${id}g)`} />
      <path d="M14 36c0-6 8-10 18-10s18 4 18 10c0 6-8 12-18 12s-18-6-18-12z" fill={`url(#${id}e)`} />
      <path d="M48 34c5-2 8 0 8 3" stroke={`url(#${id}g)`} strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="24" y="46" width="16" height="5" rx="2" fill={`url(#${id}w)`} /><path d="M20 32c4-3 10-4 14-4" stroke={hl} strokeWidth="1.5" fill="none" />
    </>
  ),
  // Gold studio microphone on wood stand — smart recitation.
  recite: (id) => (
    <>
      <rect x="24" y="8" width="16" height="26" rx="8" fill={`url(#${id}g)`} />
      <path d="M27 14h10M27 19h10M27 24h10" stroke="#9a7531" strokeWidth="1.2" opacity=".6" />
      <path d="M27 11c1-1.5 3-2 5-2" stroke={hl} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M18 28c0 9 6 14 14 14s14-5 14-14" stroke={`url(#${id}e)`} strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="30" y="42" width="4" height="7" fill={`url(#${id}e)`} /><rect x="20" y="48" width="24" height="5" rx="2.5" fill={`url(#${id}w)`} />
    </>
  ),
  // Emerald chip with gold pins — on-device model.
  model: (id) => (
    <>
      {[18, 26, 34, 42].map((x) => <rect key={x} x={x} y="10" width="3" height="8" rx="1" fill={`url(#${id}g)`} />)}
      {[18, 26, 34, 42].map((x) => <rect key={-x} x={x} y="44" width="3" height="8" rx="1" fill={`url(#${id}g)`} />)}
      <rect x="12" y="16" width="40" height="30" rx="7" fill={`url(#${id}e)`} />
      <rect x="22" y="23" width="20" height="16" rx="4" fill={`url(#${id}g)`} /><path d="M16 20h14" stroke={hl} strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  // Closed Mushaf on a wooden rehal.
  mushaf: (id) => (
    <>
      <path d="M12 50l20-14 20 14" stroke={`url(#${id}w)`} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M14 14l18 6v24l-18-6z" fill={`url(#${id}e)`} /><path d="M50 14l-18 6v24l18-6z" fill="#245f43" />
      <path d="M20 22l8 3v8l-8-3z" fill={`url(#${id}g)`} opacity=".9" /><path d="M16 16l12 4" stroke={hl} strokeWidth="1.4" />
      <path d="M32 20v24" stroke={`url(#${id}g)`} strokeWidth="1.5" />
    </>
  ),
  // Ivory card with a gold marker — places that need review.
  mistakes: (id) => (
    <>
      <rect x="12" y="12" width="36" height="40" rx="6" fill={`url(#${id}i)`} stroke="#e2d6b5" />
      <path d="M18 22h22M18 30h14M18 38h20" stroke="#cbbf9f" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="32" y="27" width="10" height="6" rx="3" fill="#e9b949" opacity=".7" />
      <path d="M44 8v18l4-3 4 3V8z" fill={`url(#${id}g)`} />
    </>
  ),
  // Rising sun over an emerald arch — welcome.
  welcome: (id) => (
    <>
      <circle cx="32" cy="30" r="11" fill={`url(#${id}g)`} />
      <path d="M10 50V34a22 22 0 0 1 44 0v16" fill="none" stroke={`url(#${id}e)`} strokeWidth="5" />
      <path d="M8 50h48" stroke={`url(#${id}w)`} strokeWidth="4" strokeLinecap="round" /><path d="M25 25a9 9 0 0 1 6-4" stroke={hl} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </>
  ),
}

export const ILLUSTRATIONS = Object.keys(ART) as IllustrationId[]
export function Illustration({ id, size = 56, label }: { id: IllustrationId; size?: number; label?: string }) {
  return <Base size={size} label={label}>{ART[id]}</Base>
}
