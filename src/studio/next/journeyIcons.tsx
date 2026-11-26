// Interactive 3D isometric glow icons for the three homepage journeys
// (رحلة القرآن · رحلة الأذكار · رحلة التدبّر), built on the project's
// iso-glow 30° projection kernel (./iso.tsx).
//
// Follows the iso-glow Lumen look: opaque shaded isometric solids painted
// back to front, detail drawn on TOP/FRONT/SIDE planes, Sakina tokens only,
// and one live accent colour per journey whose glow & progress gauge reflect
// real progress (0..1). Respects dark/light themes and reduced-motion.
import { useId } from 'react'
import { Box, GlowDefs, SURFACE, kernel, tint, type Faces } from './iso'

export type JourneyIconId = 'quran' | 'azkar' | 'tadabbur'

const PAPER: Faces = {
  top: 'var(--mf-paper)',
  front: 'color-mix(in oklab, var(--mf-paper) 84%, var(--color-night))',
  side: 'color-mix(in oklab, var(--mf-paper) 72%, var(--color-night))',
  stroke: 'color-mix(in oklab, var(--mf-paper) 55%, var(--color-night) 28%)',
}

const DARK_GLASS = 'color-mix(in oklab, var(--color-night) 82%, var(--color-card))'
const DETAIL = 'color-mix(in oklab, var(--color-night) 26%, transparent)'
const RECESS = 'color-mix(in oklab, var(--color-night) 14%, var(--color-card))'

function Plate({ k, v, accent, live }: { k: ReturnType<typeof kernel>; v: number; accent: string; live: boolean }) {
  const fillW = v > 0 ? Math.max(5, Math.round(40 * Math.min(1, v))) : 4
  return (
    <g>
      <Box k={k} x={0} y={0} z={0} w={64} d={64} h={8} f={SURFACE} />
      {/* Inset hairline frame on the ground plate */}
      <g transform={k.TOP(0, 0, 8)}>
        <rect x={4} y={4} width={56} height={56} rx={4} fill="none" stroke={DETAIL} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
      </g>
      {/* Live progress bar recessed into the front bevel */}
      <g transform={k.FRONT(0, 64, 8)}>
        <rect x={12} y={2.6} width={40} height={2.8} rx={1.4} fill={RECESS} />
        <rect x={12} y={2.6} width={fillW} height={2.8} rx={1.4} fill={accent} opacity={live ? 0.95 : 0.4} />
      </g>
    </g>
  )
}

/** Small rising geometric motes (iso-glow Lumen touch), stronger when progress > 0. */
function Motes({ k, accent, pts, live }: { k: ReturnType<typeof kernel>; accent: string; pts: [number, number, number, number][]; live: boolean }) {
  return (
    <g>
      {pts.map(([x, y, z, s], i) => {
        const [px, py] = k.P(x, y, z)
        return (
          <rect
            key={i}
            x={px - s / 2}
            y={py - s / 2}
            width={s}
            height={s}
            rx={0.6}
            fill={accent}
            opacity={live ? 0.9 - i * 0.18 : i === 0 ? 0.45 : 0}
          />
        )
      })}
    </g>
  )
}

/** رحلة القرآن — Isometric open Mushaf on a stepped stand with glowing spine & ribbon. */
function QuranFigure({ k, id, v, accent }: { k: ReturnType<typeof kernel>; id: string; v: number; accent: string }) {
  const live = v > 0
  const cover = tint(accent, live ? 0.88 : 0.62)
  const wood = tint('var(--color-gold)', 0.34)
  const [hx, hy] = k.P(32, 32, 34)
  // Two angled open page leaves rising gently from the central spine (x = 32)
  const leftLeaf = k.poly([[11, 16, 33], [32, 16, 29], [32, 50, 29], [11, 50, 33]])
  const rightLeaf = k.poly([[32, 16, 29], [53, 16, 33], [53, 50, 33], [32, 50, 29]])
  const leftEdge = k.poly([[11, 50, 33], [32, 50, 29], [32, 50, 22], [11, 50, 24]])
  const rightEdge = k.poly([[32, 50, 29], [53, 50, 33], [53, 50, 24], [32, 50, 22]])
  const sideEdge = k.poly([[53, 16, 33], [53, 50, 33], [53, 50, 24], [53, 16, 24]])
  const ribbon = k.poly([[30.5, 49, 29], [33.5, 49, 29], [33.5, 56, 25], [33.5, 57, 13], [32, 56.5, 16], [30.5, 57, 13], [30.5, 56, 25]])
  const spineLine = k.poly([[32, 17, 29.2], [32, 49, 29.2]])
  return (
    <g>
      <ellipse className="iso-halo" cx={hx} cy={hy} rx={live ? 30 : 22} ry={live ? 22 : 16} fill={accent} filter={`url(#${id}-bloom)`} opacity={live ? undefined : 0.2} />
      <Plate k={k} v={v} accent={accent} live={live} />
      {/* Stepped stand + bound emerald cover */}
      <Box k={k} x={14} y={18} z={8} w={36} d={28} h={5} f={wood} />
      <Box k={k} x={8} y={13} z={13} w={48} d={40} h={5} f={cover} />
      {/* Paper block */}
      <Box k={k} x={11} y={16} z={18} w={42} d={34} h={6} f={PAPER} />
      {/* Page edge bevels & layered paper lines */}
      <polygon points={leftEdge} fill={PAPER.front} stroke={PAPER.stroke} strokeWidth={0.7} strokeLinejoin="round" />
      <polygon points={rightEdge} fill={PAPER.front} stroke={PAPER.stroke} strokeWidth={0.7} strokeLinejoin="round" />
      <polygon points={sideEdge} fill={PAPER.side} stroke={PAPER.stroke} strokeWidth={0.7} strokeLinejoin="round" />
      {/* Open curved leaves */}
      <polygon points={leftLeaf} fill="color-mix(in oklab, var(--mf-paper) 94%, white)" stroke={PAPER.stroke} strokeWidth={0.8} strokeLinejoin="round" />
      <polygon points={rightLeaf} fill="var(--mf-paper)" stroke={PAPER.stroke} strokeWidth={0.8} strokeLinejoin="round" />
      {/* Clean geometric frame lines on the leaves (no simulated script) */}
      <polyline points={k.poly([[15, 21, 32.2], [28, 21, 29.8], [28, 45, 29.8], [15, 45, 32.2], [15, 21, 32.2]])} fill="none" stroke="var(--mf-frame-soft)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      <polyline points={k.poly([[36, 21, 29.8], [49, 21, 32.2], [49, 45, 32.2], [36, 45, 29.8], [36, 21, 29.8]])} fill="none" stroke="var(--mf-frame-soft)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      {/* Glowing live spine + ribbon */}
      <polyline points={spineLine} fill="none" stroke={accent} strokeWidth={live ? 2.2 : 1.4} strokeLinecap="round" filter={live ? `url(#${id}-soft)` : undefined} />
      <polygon points={ribbon} fill={accent} filter={live ? `url(#${id}-soft)` : undefined} />
      <Motes k={k} accent={accent} live={live} pts={[[32, 30, 44, 3.2], [24, 24, 52, 2.4], [41, 36, 56, 2]]} />
    </g>
  )
}

/** رحلة الأذكار — Isometric Islamic lantern with glowing arch windows + morning sun / evening crescent. */
function AzkarFigure({ k, id, v, accent, time }: { k: ReturnType<typeof kernel>; id: string; v: number; accent: string; time: 'morning' | 'evening' }) {
  const live = v > 0
  const brass = tint(accent, 0.72)
  const body = tint('var(--color-night)', 0.25)
  const [hx, hy] = k.P(32, 32, 36)
  const [cx, cy] = k.P(32, 32, 66)
  const arch = 'M4 20 V9 C4 4.5 8 2.5 11 1.5 C14 2.5 18 4.5 18 9 V20 Z'
  return (
    <g>
      <ellipse className="iso-halo" cx={hx} cy={hy} rx={live ? 32 : 24} ry={live ? 26 : 18} fill={accent} filter={`url(#${id}-bloom)`} opacity={live ? undefined : 0.24} />
      <Plate k={k} v={v} accent={accent} live={live} />
      {/* Stepped pedestal + lantern base */}
      <Box k={k} x={14} y={14} z={8} w={36} d={36} h={5} f={SURFACE} />
      <Box k={k} x={18} y={18} z={13} w={28} d={28} h={4} f={brass} />
      {/* Lantern body */}
      <Box k={k} x={20} y={20} z={17} w={24} d={24} h={24} f={body} />
      {/* Glowing arched glass windows on FRONT and SIDE */}
      <g transform={k.FRONT(21, 44, 40)}>
        <path d={arch} fill={DARK_GLASS} stroke={DETAIL} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <path d={arch} fill={accent} opacity={live ? 0.96 : 0.65} filter={live ? `url(#${id}-soft)` : undefined} />
        <line x1={11} y1={2} x2={11} y2={20} stroke={DARK_GLASS} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
        <line x1={4.5} y1={12} x2={17.5} y2={12} stroke={DARK_GLASS} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
      </g>
      <g transform={k.SIDE(44, 43, 40)}>
        <path d={arch} fill={DARK_GLASS} stroke={DETAIL} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <path d={arch} fill={accent} opacity={live ? 0.82 : 0.52} filter={live ? `url(#${id}-soft)` : undefined} />
        <line x1={11} y1={2} x2={11} y2={20} stroke={DARK_GLASS} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
        <line x1={4.5} y1={12} x2={17.5} y2={12} stroke={DARK_GLASS} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
      </g>
      {/* Tiered lantern dome + finial */}
      <Box k={k} x={17} y={17} z={41} w={30} d={30} h={4} f={brass} />
      <Box k={k} x={22} y={22} z={45} w={20} d={20} h={6} f={brass} />
      <Box k={k} x={28} y={28} z={51} w={8} d={8} h={5} f={brass} />
      {/* Live morning sun / evening crescent crest */}
      <g filter={live ? `url(#${id}-soft)` : undefined}>
        {time === 'morning' ? (
          <g>
            <circle cx={cx} cy={cy} r={5.2} fill={accent} />
            {[0, 45, 90, 135].map((a) => {
              const rad = (a * Math.PI) / 180
              return <line key={a} x1={cx + Math.cos(rad) * 7.2} y1={cy + Math.sin(rad) * 7.2} x2={cx + Math.cos(rad) * 9.5} y2={cy + Math.sin(rad) * 9.5} stroke={accent} strokeWidth={1.5} strokeLinecap="round" />
            })}
          </g>
        ) : (
          <path d={`M ${cx + 2.5} ${cy - 5.2} A 5.8 5.8 0 1 0 ${cx + 2.5} ${cy + 5.2} A 4.4 4.4 0 1 1 ${cx + 2.5} ${cy - 5.2} Z`} fill={accent} />
        )}
      </g>
      <Motes k={k} accent={accent} live={live} pts={[[16, 36, 48, 2.8], [48, 26, 52, 2.2]]} />
    </g>
  )
}

/** رحلة التدبّر — Isometric contemplation beacon behind a reflection journal. */
function TadabburFigure({ k, id, v, accent }: { k: ReturnType<typeof kernel>; id: string; v: number; accent: string }) {
  const live = v > 0
  const housing = tint('var(--color-night)', 0.24)
  const prism = tint(accent, live ? 0.96 : 0.7)
  const [hx, hy] = k.P(32, 20, 38)
  const [sx, sy] = k.P(32, 19, 48)
  return (
    <g>
      <ellipse className="iso-halo" cx={hx} cy={hy} rx={live ? 30 : 22} ry={live ? 22 : 16} fill={accent} filter={`url(#${id}-bloom)`} opacity={live ? undefined : 0.22} />
      <Plate k={k} v={v} accent={accent} live={live} />
      {/* Back: Contemplation beacon pedestal & glowing prism tower */}
      <Box k={k} x={21} y={9} z={8} w={22} d={20} h={6} f={SURFACE} />
      <Box k={k} x={24} y={12} z={14} w={16} d={14} h={20} f={housing} />
      {/* Vertical glowing core slit on FRONT and SIDE of the beacon */}
      <g transform={k.FRONT(24, 26, 34)}>
        <rect x={5} y={3} width={6} height={14} rx={3} fill={accent} opacity={live ? 0.98 : 0.65} filter={live ? `url(#${id}-soft)` : undefined} />
      </g>
      <g transform={k.SIDE(40, 26, 34)}>
        <rect x={4} y={3} width={6} height={14} rx={3} fill={accent} opacity={live ? 0.8 : 0.5} filter={live ? `url(#${id}-soft)` : undefined} />
      </g>
      {/* Beacon cap + glowing floating diamond star */}
      <Box k={k} x={23} y={11} z={34} w={18} d={16} h={4} f={prism} />
      <path
        d={`M ${sx} ${sy - 9} L ${sx + 3.2} ${sy - 3.2} L ${sx + 9} ${sy} L ${sx + 3.2} ${sy + 3.2} L ${sx} ${sy + 9} L ${sx - 3.2} ${sy + 3.2} L ${sx - 9} ${sy} L ${sx - 3.2} ${sy - 3.2} Z`}
        fill={accent}
        filter={live ? `url(#${id}-soft)` : undefined}
        opacity={live ? 1 : 0.78}
      />
      {/* Front: Bound reflection journal with illuminated insight lines */}
      <Box k={k} x={10} y={32} z={8} w={44} d={24} h={6} f={tint(accent, 0.36)} />
      <Box k={k} x={12} y={34} z={14} w={40} d={20} h={4} f={PAPER} />
      <g transform={k.TOP(12, 34, 18)}>
        <rect x={6} y={4.5} width={28} height={2.4} rx={1.2} fill={accent} opacity={live ? 0.95 : 0.55} />
        <rect x={10} y={9.5} width={24} height={1.8} rx={0.9} fill={DETAIL} />
        <rect x={14} y={14} width={20} height={1.8} rx={0.9} fill={DETAIL} />
      </g>
      <Motes k={k} accent={accent} live={live} pts={[[22, 16, 56, 2.8], [44, 20, 60, 2.2]]} />
    </g>
  )
}

export function IsoJourneyIcon({
  id: kind,
  v,
  color,
  time = 'morning',
  size = 76,
  className = '',
}: {
  id: JourneyIconId
  v: number
  color: string
  time?: 'morning' | 'evening'
  size?: number
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const k = kernel(70, 56)
  return (
    <svg
      viewBox="0 0 140 126"
      width={size}
      height={Math.round(size * (126 / 140))}
      className={`overflow-visible ${className}`}
      aria-hidden
      data-iso-journey={kind}
    >
      <GlowDefs id={uid} />
      <g className="iso-lift">
        {kind === 'quran' && <QuranFigure k={k} id={uid} v={v} accent={color} />}
        {kind === 'azkar' && <AzkarFigure k={k} id={uid} v={v} accent={color} time={time} />}
        {kind === 'tadabbur' && <TadabburFigure k={k} id={uid} v={v} accent={color} />}
      </g>
    </svg>
  )
}
