/**
 * A small Excel (.xlsx) writer for the "Download Excel sheet" buttons: no library, runs in the
 * browser. Each sheet gets a title block (what it is, the dates, when it was made), a coloured
 * header row with filter arrows, banded rows, real dates and numbers, and a bold TOTAL row whose
 * sums follow the filter (SUBTOTAL), so filtering by bus or day shows that bus's or day's total.
 * The file opens in Excel, Google Sheets (open it from Drive) and phone sheet apps.
 */

export type Cell = string | number | null | undefined

/**
 * How a column's cells are written: text; wrap (long text, wrapped); int (a count); money (taka,
 * no decimals); date ('YYYY-MM-DD', a real date the filter groups by year, month and day);
 * datetime (an ISO time, shown in Dhaka time).
 */
export type Kind = 'text' | 'wrap' | 'int' | 'money' | 'date' | 'datetime'

export interface Column {
  header: string
  kind?: Kind
  /** Add this column up in the TOTAL row. */
  total?: boolean
  width?: number
}

export interface Sheet {
  name: string
  /** Big title on top, e.g. "BUSHUB SALES". */
  title: string
  /** Lines under the title, e.g. "Date range: 01-Oct-2026 to 03-Oct-2026". The time it was made is added. */
  notes?: string[]
  columns: Column[]
  rows: Cell[][]
}

const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function colName(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DHAKA_MS = 6 * 3600 * 1000
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

/** 'YYYY-MM-DD' as an Excel day number, or null when it is not a date. */
function dateSerial(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3])
  return Number.isNaN(ms) ? null : (ms - EXCEL_EPOCH) / 86400000
}

/** An ISO time as an Excel date-and-time in Dhaka. */
function dateTimeSerial(v: string): number | null {
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? null : Math.round(((ms + DHAKA_MS - EXCEL_EPOCH) / 86400000) * 86400) / 86400
}

/** '2026-10-03' → '03-Oct-2026', for the notes. */
export function sheetDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  return m ? `${m[3]}-${MONTHS[+m[2] - 1]}-${m[1]}` : v
}

function generatedAt(): string {
  const d = new Date(Date.now() + DHAKA_MS)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCFullYear()} | ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} (Dhaka)`
}

// ---- Styles: the order of XF entries below is what the style numbers point at. ----
const NUM_FMTS = '<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0;[Red]\\-#,##0"/><numFmt numFmtId="165" formatCode="dd\\-mmm\\-yyyy"/><numFmt numFmtId="166" formatCode="dd\\-mmm\\-yyyy hh:mm"/></numFmts>'
const FONTS = [
  '<font><sz val="10.5"/><color rgb="FF1F2A2C"/><name val="Calibri"/></font>', // 0 body
  '<font><b/><sz val="10.5"/><color rgb="FF1F2A2C"/><name val="Calibri"/></font>', // 1 bold
  '<font><b/><sz val="16"/><color rgb="FF013328"/><name val="Calibri"/></font>', // 2 title
  '<font><b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>', // 3 header
  '<font><sz val="10"/><color rgb="FF5B6B6E"/><name val="Calibri"/></font>', // 4 notes
]
const FILLS = [
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF013328"/><bgColor indexed="64"/></patternFill></fill>', // 2 header
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF5F1EA"/><bgColor indexed="64"/></patternFill></fill>', // 3 band
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF1DFD2"/><bgColor indexed="64"/></patternFill></fill>', // 4 total
  '<fill><patternFill patternType="solid"><fgColor rgb="FFCC8B65"/><bgColor indexed="64"/></patternFill></fill>', // 5 accent
]
const BORDERS = [
  '<border><left/><right/><top/><bottom/><diagonal/></border>',
  '<border><left style="thin"><color rgb="FFD3DCDE"/></left><right style="thin"><color rgb="FFD3DCDE"/></right><top style="thin"><color rgb="FFD3DCDE"/></top><bottom style="thin"><color rgb="FFD3DCDE"/></bottom><diagonal/></border>',
  '<border><left style="thin"><color rgb="FFC9C0B3"/></left><right style="thin"><color rgb="FFC9C0B3"/></right><top style="medium"><color rgb="FFCC8B65"/></top><bottom style="medium"><color rgb="FFCC8B65"/></bottom><diagonal/></border>',
]
const KIND_FMT: Record<Kind, number> = { text: 0, wrap: 0, int: 3, money: 164, date: 165, datetime: 166 }
const KINDS: Kind[] = ['text', 'wrap', 'int', 'money', 'date', 'datetime']

interface Xf {
  font: number
  fill: number
  border: number
  fmt: number
  align?: string
}
const XFS: Xf[] = [
  { font: 0, fill: 0, border: 0, fmt: 0 }, // 0 default
  { font: 2, fill: 0, border: 0, fmt: 0, align: '<alignment vertical="center"/>' }, // 1 title
  { font: 4, fill: 0, border: 0, fmt: 0, align: '<alignment vertical="center"/>' }, // 2 notes
  { font: 3, fill: 2, border: 1, fmt: 0, align: '<alignment horizontal="center" vertical="center" wrapText="1"/>' }, // 3 header
  { font: 1, fill: 4, border: 2, fmt: 0, align: '<alignment vertical="center"/>' }, // 4 total label
  { font: 0, fill: 5, border: 0, fmt: 0 }, // 5 accent bar
]
/** Body styles: per kind, plain and banded; then the total row per kind. */
function bodyXf(kind: Kind, band: boolean): number {
  return 6 + KINDS.indexOf(kind) * 2 + (band ? 1 : 0)
}
function totalXf(kind: Kind): number {
  return 6 + KINDS.length * 2 + KINDS.indexOf(kind)
}
for (const kind of KINDS) {
  const align =
    kind === 'wrap'
      ? '<alignment vertical="top" wrapText="1"/>'
      : kind === 'date' || kind === 'datetime'
        ? '<alignment horizontal="center" vertical="top"/>'
        : '<alignment vertical="top"/>'
  XFS.push({ font: 0, fill: 0, border: 1, fmt: KIND_FMT[kind], align }, { font: 0, fill: 3, border: 1, fmt: KIND_FMT[kind], align })
}
for (const kind of KINDS) XFS.push({ font: 1, fill: 4, border: 2, fmt: KIND_FMT[kind], align: '<alignment vertical="center"/>' })

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  NUM_FMTS +
  `<fonts count="${FONTS.length}">${FONTS.join('')}</fonts>` +
  `<fills count="${FILLS.length}">${FILLS.join('')}</fills>` +
  `<borders count="${BORDERS.length}">${BORDERS.join('')}</borders>` +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  `<cellXfs count="${XFS.length}">` +
  XFS.map(
    (x) =>
      `<xf numFmtId="${x.fmt}" fontId="${x.font}" fillId="${x.fill}" borderId="${x.border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"${x.align ? ' applyAlignment="1">' + x.align + '</xf>' : '/>'}`
  ).join('') +
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'

function cellXml(ref: string, style: number, value: Cell | { formula: string; value: number }, kind: Kind = 'text'): string {
  const s = ` s="${style}"`
  if (value === null || value === undefined || value === '') return `<c r="${ref}"${s}/>`
  if (typeof value === 'object') return `<c r="${ref}"${s}><f>${esc(value.formula)}</f><v>${value.value}</v></c>`
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${value}</v></c>` : `<c r="${ref}"${s}/>`
  const serial = kind === 'date' ? dateSerial(value) : kind === 'datetime' ? dateTimeSerial(value) : null
  if (serial !== null) return `<c r="${ref}"${s}><v>${serial}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`
}

/** How wide a column is, from its header and its longest value (wrapped columns stay at a set width). */
function width(col: Column, rows: Cell[][], c: number): number {
  if (col.width) return col.width
  const kind = col.kind || 'text'
  if (kind === 'wrap') return 42
  if (kind === 'date') return 13
  if (kind === 'datetime') return 18
  const longest = rows.reduce((n, r) => {
    const v = r[c]
    const len = typeof v === 'number' ? v.toLocaleString('en-US').length : String(v ?? '').length
    return Math.max(n, len)
  }, 0)
  const head = Math.max(...col.header.split(' ').map((w) => w.length)) // the header can wrap between words
  return Math.min(40, Math.max(8, head + 3, longest + 3))
}

function sheetXml(sheet: Sheet, index: number): { xml: string; filter: string } {
  const cols = sheet.columns
  const last = colName(Math.max(cols.length - 1, 0))
  const notes = [...(sheet.notes || []), `Generated: ${generatedAt()}`]
  const headRow = notes.length + 3 // title, notes, a thin accent bar, then the header
  const first = headRow + 1
  const end = headRow + sheet.rows.length
  const hasTotal = cols.some((c) => c.total)
  const rows: string[] = []

  rows.push(`<row r="1" ht="26" customHeight="1">${cellXml('A1', 1, sheet.title.toUpperCase())}</row>`)
  notes.forEach((n, i) => rows.push(`<row r="${i + 2}" ht="16" customHeight="1">${cellXml(`A${i + 2}`, 2, n)}</row>`))
  const bar = notes.length + 2
  rows.push(`<row r="${bar}" ht="4" customHeight="1">${cols.map((_, c) => `<c r="${colName(c)}${bar}" s="5"/>`).join('')}</row>`)
  rows.push(`<row r="${headRow}" ht="44" customHeight="1">${cols.map((col, c) => cellXml(`${colName(c)}${headRow}`, 3, col.header.toUpperCase())).join('')}</row>`)
  sheet.rows.forEach((r, i) => {
    const n = first + i
    rows.push(`<row r="${n}">${cols.map((col, c) => cellXml(`${colName(c)}${n}`, bodyXf(col.kind || 'text', i % 2 === 1), r[c], col.kind)).join('')}</row>`)
  })
  if (hasTotal) {
    const n = end + 1
    const cells = cols.map((col, c) => {
      const ref = `${colName(c)}${n}`
      if (c === 0) return cellXml(ref, 4, 'TOTAL')
      if (!col.total) return cellXml(ref, totalXf('text'), '')
      const letter = colName(c)
      const value = sheet.rows.reduce((t, r) => t + (typeof r[c] === 'number' ? (r[c] as number) : 0), 0)
      const formula = sheet.rows.length ? `SUBTOTAL(109,${letter}${first}:${letter}${end})` : '0'
      return cellXml(ref, totalXf(col.kind || 'int'), { formula, value })
    })
    rows.push(`<row r="${n}" ht="22" customHeight="1">${cells.join('')}</row>`)
  }

  const filter = `$A$${headRow}:$${last}$${Math.max(end, headRow)}`
  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheetPr><tabColor rgb="${index === 0 ? 'FFCC8B65' : 'FF013328'}"/><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0"${index === 0 ? ' tabSelected="1"' : ''} showGridLines="0"><pane xSplit="1" ySplit="${headRow}" topLeftCell="B${first}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="B${first}" sqref="B${first}"/></sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols.map((col, c) => `<col min="${c + 1}" max="${c + 1}" width="${width(col, sheet.rows, c)}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    `<autoFilter ref="A${headRow}:${last}${Math.max(end, headRow)}"/>` +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>'
  return { xml, filter }
}

/** Sheet names: at most 31 characters, none of []:*?/\ and each one different. */
function sheetNames(sheets: Sheet[]): string[] {
  const used = new Set<string>()
  return sheets.map((s, i) => {
    let name = s.name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Sheet${i + 1}`
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${i + 1}`
    used.add(name.toLowerCase())
    return name
  })
}

export function workbookFiles(sheets: Sheet[]): Record<string, string> {
  const names = sheetNames(sheets)
  const built = sheets.map((s, i) => sheetXml(s, i))
  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets><definedNames>' +
      names.map((n, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(n.replace(/'/g, "''"))}'!${built[i].filter}</definedName>`).join('') +
      '</definedNames><calcPr fullCalcOnLoad="1"/></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': STYLES,
  }
  built.forEach((b, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = b.xml))
  return files
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A zip with the files stored as they are (an .xlsx is a zip of XML files). */
export function zip(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder()
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [path, text] of Object.entries(files)) {
    const name = enc.encode(path)
    const data = enc.encode(text)
    const crc = crc32(data)
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(4, 20, true)
    head.setUint16(6, 0x0800, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, data.length, true)
    head.setUint32(22, data.length, true)
    head.setUint16(26, name.length, true)
    local.push(new Uint8Array(head.buffer), name, data)
    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(4, 20, true)
    dir.setUint16(6, 20, true)
    dir.setUint16(8, 0x0800, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, data.length, true)
    dir.setUint32(24, data.length, true)
    dir.setUint16(28, name.length, true)
    dir.setUint32(42, offset, true)
    central.push(new Uint8Array(dir.buffer), name)
    offset += 30 + name.length + data.length
  }
  const dirSize = central.reduce((n, b) => n + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, Object.keys(files).length, true)
  end.setUint16(10, Object.keys(files).length, true)
  end.setUint32(12, dirSize, true)
  end.setUint32(16, offset, true)
  const parts = [...local, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, b) => n + b.length, 0)))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Builds the .xlsx and starts the download. */
export function downloadSheet(fileName: string, sheets: Sheet[]) {
  const blob = new Blob([zip(workbookFiles(sheets))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
