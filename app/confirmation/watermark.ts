/**
 * A faint "BUSHUBBD.COM" repeated on a slant, as a CSS background, so it sits behind everything
 * (the QR code stays clean) and stays on the picture when it is saved, shared or edited. One
 * large SVG with a rotated pattern, so no word is cut at a tile edge.
 */
export function watermark(color: string, opacity: number, size = 13): string {
  const word = (x: number, y: number) => `<text x='${x}' y='${y}'>BUSHUBBD.COM</text>`
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='2400'>` +
    `<defs><pattern id='w' width='400' height='96' patternUnits='userSpaceOnUse' patternTransform='rotate(-24)'>` +
    `<g fill='${color}' fill-opacity='${opacity}' font-family='Arial, Helvetica, sans-serif' font-weight='800' font-size='${size}' letter-spacing='2'>` +
    word(0, 24) +
    word(200, 24) +
    word(-100, 72) +
    word(100, 72) +
    word(300, 72) +
    `</g></pattern></defs><rect width='1200' height='2400' fill='url(#w)'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
