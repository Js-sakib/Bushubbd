import { banglaCity } from '@/lib/routes'
import { routeMapShape, type Point } from '@/lib/bdMap'

const BANGLA_FONT = 'var(--font-bangla), var(--font-body), sans-serif'

/** A map pin standing on its point, with a white dot in the head. */
function Pin({ at, color }: { at: Point; color: string }) {
  return (
    <g transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`}>
      <ellipse cx="0" cy="1" rx="6" ry="2.2" fill="rgba(17,17,17,0.22)" />
      <path d="M0 0 C-5 -7.5 -10 -12.5 -10 -19 A10 10 0 1 1 10 -19 C10 -12.5 5 -7.5 0 0 Z" fill={color} stroke="#ffffff" strokeWidth="2" />
      <circle cx="0" cy="-19" r="3.8" fill="#ffffff" />
    </g>
  )
}

/** The town's name in a white pill beside its pin, on the side away from the road. */
function Label({ at, text, side, width }: { at: Point; text: string; side: 'left' | 'right'; width: number }) {
  const w = Math.max(44, text.length * 10 + 18)
  const raw = side === 'left' ? at.x - 14 - w : at.x + 14
  const x = Math.min(Math.max(raw, -16), width + 16 - w)
  const y = at.y - 19 - 13
  return (
    <g>
      <rect x={x} y={y} width={w} height={26} rx={13} fill="#ffffff" stroke="rgba(17,17,17,0.08)" />
      <text x={x + w / 2} y={y + 17.5} textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#111111" style={{ fontFamily: BANGLA_FONT }}>
        {text}
      </text>
    </g>
  )
}

/**
 * The trip on a little map of Bangladesh: a pin where it starts, a pin where it ends and a dashed
 * road between them with a bus on it. Drawn as one SVG so a saved picture looks the same.
 */
export default function RouteMap({ from, to, width = 312, height = 250 }: { from: string; to: string; width?: number; height?: number }) {
  const m = routeMapShape(from, to, { width, height, pad: 8 })
  const grid = [0.2, 0.4, 0.6, 0.8]
  // Each name sits on the outer side of its pin, so neither covers the road.
  const aSide = m.a.x <= m.b.x ? 'left' : 'right'
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`${from} → ${to}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="bh-road" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#aa8fd8" />
          <stop offset="1" stopColor="#f2661d" />
        </linearGradient>
      </defs>
      {/* Faint map grid */}
      {grid.map((g) => (
        <g key={g} stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="2 5">
          <line x1={width * g} y1="0" x2={width * g} y2={height} />
          <line x1="0" y1={height * g} x2={width} y2={height * g} />
        </g>
      ))}
      {m.outline && <path d={m.outline} fill="rgba(255,255,255,0.42)" stroke="rgba(255,255,255,0.95)" strokeWidth="1.6" strokeLinejoin="round" />}
      {m.towns.map((t, i) => (
        <circle key={i} cx={t.x} cy={t.y} r="2.4" fill="rgba(17,17,17,0.28)" />
      ))}
      {/* The road: a soft glow under a dashed line */}
      <path d={m.route} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="7" strokeLinecap="round" />
      <path d={m.route} fill="none" stroke="url(#bh-road)" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="7 6" />
      {/* The bus rides the road when there is room for it between the pins */}
      {Math.hypot(m.b.x - m.a.x, m.b.y - m.a.y) > 70 && (
      <g transform={`translate(${m.mid.x.toFixed(1)} ${m.mid.y.toFixed(1)})`}>
        <circle r="13" fill="#ffffff" stroke="#f2661d" strokeWidth="2" />
        <g transform="translate(-8 -8.5) scale(0.68)" fill="none" stroke="#f2661d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="12.5" rx="3" />
          <path d="M3 11h18" />
          <circle cx="7.5" cy="19" r="1.6" />
          <circle cx="16.5" cy="19" r="1.6" />
        </g>
      </g>
      )}
      <Pin at={m.a} color="#aa8fd8" />
      <Pin at={m.b} color="#f2661d" />
      <Label at={m.a} text={banglaCity(from) || from} side={aSide} width={width} />
      <Label at={m.b} text={banglaCity(to) || to} side={aSide === 'left' ? 'right' : 'left'} width={width} />
    </svg>
  )
}
