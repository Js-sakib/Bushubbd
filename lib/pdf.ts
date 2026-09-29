/**
 * A one-page A4 PDF holding one JPEG, centred at the top with a margin. That is all a ticket
 * needs, so it is written by hand here instead of pulling a PDF library onto the ticket page.
 */
const PAGE_W = 595.28 // A4 in points
const PAGE_H = 841.89
const MARGIN = 36

export function jpegToPdf(jpeg: Uint8Array, width: number, height: number, title = 'BusHub ticket'): Blob {
  const scale = Math.min((PAGE_W - 2 * MARGIN) / width, (PAGE_H - 2 * MARGIN) / height)
  const w = width * scale
  const h = height * scale
  const x = (PAGE_W - w) / 2
  const y = PAGE_H - MARGIN - h

  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part
    parts.push(bytes)
    length += bytes.length
  }
  const object = (n: number, ...body: (string | Uint8Array)[]) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
    body.forEach(push)
    push('\nendobj\n')
  }
  // PDF strings in parentheses must escape these three characters.
  const pdfText = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '')
  const draw = `q\n${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`

  push('%PDF-1.4\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  )
  object(
    4,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    '\nendstream'
  )
  object(5, `<< /Length ${encoder.encode(draw).length} >>\nstream\n${draw}endstream`)
  object(6, `<< /Title (${pdfText(title)}) /Producer (bushubbd.com) >>`)

  const xref = length
  push(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`)
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}
