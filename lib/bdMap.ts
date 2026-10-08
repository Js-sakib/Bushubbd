/**
 * A small hand-drawn map of Bangladesh for share pictures: the country's outline and where the
 * towns BusHub serves are, so a trip can be drawn as two pins and a route. No map service is
 * used, so a saved picture always looks the same. Accurate to a few kilometres, not for navigation.
 */

type LatLon = readonly [number, number]

/** The border, clockwise from the northern tip (Panchagarh). */
const OUTLINE: LatLon[] = [
  [26.63, 88.45], [26.42, 88.72], [26.1, 88.98], [26.32, 89.35], [26.15, 89.65], [26.05, 89.85],
  [25.75, 89.88], [25.4, 89.85], [25.27, 90.05], [25.18, 90.4], [25.2, 90.75], [25.17, 91.25],
  [25.2, 91.7], [25.18, 92.05], [24.95, 92.45], [24.62, 92.28], [24.4, 92.12], [24.22, 91.9],
  [24.1, 91.62], [24.25, 91.3], [23.95, 91.15], [23.65, 91.2], [23.4, 91.18], [23.1, 91.35],
  [22.95, 91.52], [23.2, 91.78], [23.58, 91.98], [23.68, 92.3], [23.2, 92.4], [22.9, 92.55],
  [22.45, 92.6], [22.05, 92.68], [21.65, 92.62], [21.3, 92.64], [21.0, 92.45], [20.74, 92.33],
  [20.95, 92.2], [21.25, 92.05], [21.48, 91.98], [21.85, 91.9], [22.2, 91.8], [22.45, 91.68],
  [22.6, 91.5], [22.78, 91.38], [22.68, 91.15], [22.5, 91.05], [22.3, 90.95], [22.05, 90.75],
  [21.88, 90.45], [21.82, 90.12], [21.78, 89.8], [21.7, 89.45], [21.65, 89.1], [21.95, 89.05],
  [22.35, 89.0], [22.75, 88.95], [23.15, 88.85], [23.55, 88.65], [23.85, 88.6], [24.1, 88.72],
  [24.3, 88.3], [24.55, 88.1], [24.85, 88.02], [25.1, 88.35], [25.2, 88.6], [25.3, 88.95],
  [25.5, 88.75], [25.65, 88.45], [25.95, 88.25], [26.2, 88.2], [26.45, 88.25],
]

/** Town centres, by the names trips use (lib/routes.ts BANGLA_CITY). */
const TOWNS: Record<string, LatLon> = {
  Dhaka: [23.81, 90.41],
  Chittagong: [22.36, 91.78],
  Chattogram: [22.36, 91.78],
  Sylhet: [24.89, 91.87],
  Rajshahi: [24.37, 88.6],
  Khulna: [22.85, 89.54],
  "Cox's Bazar": [21.43, 92.0],
  Barishal: [22.7, 90.37],
  Barisal: [22.7, 90.37],
  Rangpur: [25.75, 89.25],
  Comilla: [23.46, 91.18],
  Cumilla: [23.46, 91.18],
  Mymensingh: [24.75, 90.41],
  Bogura: [24.85, 89.37],
  Bogra: [24.85, 89.37],
  Jessore: [23.17, 89.21],
  Jashore: [23.17, 89.21],
  Dinajpur: [25.63, 88.64],
  Feni: [23.02, 91.4],
  Noakhali: [22.87, 91.1],
  Chandpur: [23.23, 90.67],
  Kushtia: [23.9, 89.12],
  Tangail: [24.25, 89.92],
  Pabna: [24.0, 89.24],
  Saidpur: [25.78, 88.9],
  Teknaf: [20.86, 92.3],
  Bandarban: [22.2, 92.22],
  Rangamati: [22.65, 92.18],
  Sreemangal: [24.31, 91.73],
  Srimangal: [24.31, 91.73],
  Moulvibazar: [24.48, 91.78],
  Sunamganj: [25.07, 91.4],
  Kuakata: [21.82, 90.12],
  Patuakhali: [22.36, 90.33],
  Benapole: [23.04, 88.9],
  Satkhira: [22.72, 89.07],
  Faridpur: [23.61, 89.84],
  Gopalganj: [23.01, 89.83],
  Narayanganj: [23.62, 90.5],
  Gazipur: [24.0, 90.42],
  Brahmanbaria: [23.96, 91.11],
  Panchagarh: [26.33, 88.55],
  Thakurgaon: [26.03, 88.46],
  Kurigram: [25.81, 89.64],
  Naogaon: [24.8, 88.94],
  Sirajganj: [24.45, 89.7],
  Jamalpur: [24.92, 89.95],
  Kishoreganj: [24.43, 90.78],
  Bhola: [22.69, 90.65],
  Jhenaidah: [23.54, 89.17],
  Natore: [24.41, 89.0],
  Nilphamari: [25.93, 88.85],
  Khagrachari: [23.12, 91.98],
  Habiganj: [24.37, 91.41],
  Netrokona: [24.88, 90.73],
  Lalmonirhat: [25.91, 89.45],
  Gaibandha: [25.33, 89.53],
  Joypurhat: [25.1, 89.02],
  Chapainawabganj: [24.6, 88.27],
  Magura: [23.49, 89.42],
  Narail: [23.17, 89.5],
  Bagerhat: [22.65, 89.79],
  Madaripur: [23.17, 90.2],
  Shariatpur: [23.21, 90.35],
  Munshiganj: [23.55, 90.53],
  Manikganj: [23.86, 90.0],
  Narsingdi: [23.92, 90.72],
  Sherpur: [25.02, 90.02],
  Lakshmipur: [22.94, 90.84],
  Pirojpur: [22.58, 89.97],
  Jhalokathi: [22.64, 90.2],
  Barguna: [22.15, 90.12],
  Meherpur: [23.76, 88.63],
  Chuadanga: [23.64, 88.84],
  Rajbari: [23.76, 89.64],
}

const BOUNDS = { minLat: 20.6, maxLat: 26.7, minLon: 88.0, maxLon: 92.75 }

export interface MapBox {
  width: number
  height: number
  pad: number
}

export interface Point {
  x: number
  y: number
}

/** Latitude/longitude → a point in the box, keeping the country's shape (scaled for ~23.5° N). */
function projector(box: MapBox) {
  const kx = Math.cos((23.7 * Math.PI) / 180)
  const w = (BOUNDS.maxLon - BOUNDS.minLon) * kx
  const h = BOUNDS.maxLat - BOUNDS.minLat
  const scale = Math.min((box.width - box.pad * 2) / w, (box.height - box.pad * 2) / h)
  const ox = (box.width - w * scale) / 2
  const oy = (box.height - h * scale) / 2
  return ([lat, lon]: LatLon): Point => ({
    x: ox + (lon - BOUNDS.minLon) * kx * scale,
    y: oy + (BOUNDS.maxLat - lat) * scale,
  })
}

export function townLatLon(name: string): LatLon | null {
  return TOWNS[name] ?? TOWNS[name.trim().replace(/^\w/, (c) => c.toUpperCase())] ?? null
}

export interface RouteMapShape {
  outline: string | null
  a: Point
  b: Point
  route: string
  mid: Point
  /** The big towns for context, faint on the map (not the two on the trip). */
  towns: Point[]
}

const LANDMARK_TOWNS = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna', 'Barishal', 'Rangpur', 'Mymensingh', "Cox's Bazar"]

/**
 * The country, the two towns and a gently bent route between them, laid out in the box. When a
 * town is not on the map the trip is drawn on its own (two pins and the route, no country).
 */
export function routeMapShape(from: string, to: string, box: MapBox): RouteMapShape {
  const pa = townLatLon(from)
  const pb = townLatLon(to)
  let a: Point
  let b: Point
  let outline: string | null = null
  let towns: Point[] = []
  if (pa && pb) {
    const p = projector(box)
    towns = LANDMARK_TOWNS.filter((t) => t !== from && t !== to && TOWNS[t] !== pa && TOWNS[t] !== pb).map((t) => p(TOWNS[t]))
    a = p(pa)
    b = p(pb)
    outline = OUTLINE.map((ll, i) => {
      const { x, y } = p(ll)
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ') + ' Z'
  } else {
    a = { x: box.width * 0.28, y: box.height * 0.3 }
    b = { x: box.width * 0.72, y: box.height * 0.72 }
  }
  // Bend the line to one side, a fifth of its length, so it reads as a road rather than a ruler.
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const bend = Math.min(60, len * 0.22)
  const c = { x: (a.x + b.x) / 2 + (dy / len) * bend, y: (a.y + b.y) / 2 - (dx / len) * bend }
  const mid = { x: 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, y: 0.25 * a.y + 0.5 * c.y + 0.25 * b.y }
  return { outline, a, b, route: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`, mid, towns }
}
