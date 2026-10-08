import { banglaCity } from '@/lib/routes'
import { routeMapShape, type MapDetail, type Point } from '@/lib/bdMap'
import { MAP_CREDIT } from '@/lib/bdMapData'

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
  const w = Math.max(44, [...text].filter((c) => !/[\u0981\u09bc\u09c1-\u09c4\u09cd]/.test(c)).length * 10 + 18)
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
 * road between them with a bus on it. A long trip lights up its two divisions on the whole
 * country; a short one zooms in and lights up its two districts. One SVG, so a saved picture
 * looks the same everywhere.
 */
export default function RouteMap({ from, to, width = 312, height = 250, detail }: { from: string; to: string; width?: number; height?: number; detail?: MapDetail }) {
  const m = routeMapShape(from, to, { width, height, pad: 8 }, detail)
  const grid = [0.2, 0.4, 0.6, 0.8]
  // Each name sits on the outer side of its pin, so neither covers the road.
  const aSide = m.a.x <= m.b.x ? 'left' : 'right'
  const fromArea = m.areas.find((d) => d.role === 'from' || d.role === 'both')
  const toArea = m.areas.find((d) => d.role === 'to')
  const unit = m.detail === 'district' ? 'জেলা' : 'বিভাগ'
  const fill = (role: string | null) =>
    role === 'from' ? 'rgba(170,143,216,0.9)' : role === 'to' ? 'rgba(254,178,73,0.95)' : role === 'both' ? 'rgba(254,178,73,0.8)' : 'rgba(255,255,255,0.42)'
  const chip = (text: string, color: string) => (
    <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.85)', color: '#111111', fontFamily: BANGLA_FONT }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {text} {unit}
    </span>
  )
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`${from} → ${to}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="bh-road" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#aa8fd8" />
            <stop offset="1" stopColor="#f2661d" />
          </linearGradient>
          <clipPath id="bh-map-box">
            <rect x="0" y="0" width={width} height={height} rx="18" />
          </clipPath>
        </defs>
        <g clipPath="url(#bh-map-box)">
          {/* Faint map grid */}
          {grid.map((g) => (
            <g key={g} stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="2 5">
              <line x1={width * g} y1="0" x2={width * g} y2={height} />
              <line x1="0" y1={height * g} x2={width} y2={height * g} />
            </g>
          ))}
          {/* The areas: the trip's start and end lit up, the rest soft white */}
          {m.areas.map((d) => (
            <path key={d.key} d={d.path} fill={fill(d.role)} stroke="#ffffff" strokeWidth={d.role ? 1.3 : 0.8} strokeLinejoin="round" />
          ))}
          {m.fineLines.map((d, i) => (
            <path key={`f${i}`} d={d} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.45" strokeLinejoin="round" />
          ))}
          {m.boldLines.map((d, i) => (
            <path key={`b${i}`} d={d} fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinejoin="round" />
          ))}
          {m.towns.map((t, i) => (
            <circle key={i} cx={t.x} cy={t.y} r="2.2" fill="rgba(17,17,17,0.28)" />
          ))}
          {m.areas.length > 0 && (
            <text x={width - 6} y={height - 5} textAnchor="end" fontSize="7" fontWeight="600" fill="rgba(17,17,17,0.45)" style={{ fontFamily: BANGLA_FONT }}>
              {MAP_CREDIT}
            </text>
          )}
        </g>
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
      {/* Which areas are lit up */}
      {fromArea && (
        <div className="flex items-center gap-1.5">
          {chip(fromArea.bn, m.detail === 'district' || fromArea.role !== 'both' ? '#aa8fd8' : '#feb249')}
          {toArea && (
            <>
              <span className="text-[13px] font-bold" style={{ color: '#111111' }}>
                →
              </span>
              {chip(toArea.bn, '#feb249')}
            </>
          )}
        </div>
      )}
    </div>
  )
}
