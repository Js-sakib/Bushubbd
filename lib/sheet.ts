/**
 * A small Excel (.xlsx) writer for the "Download Excel" buttons: no library, runs in the browser.
 * Every file looks the same: the website's orange and aqua, a BusHub contact line, a title block
 * (what it is, the dates, when it was made), an orange header row with filter arrows, banded rows,
 * real dates, taka and percentages, red marks on problem values, and a bold TOTAL row whose sums
 * follow the filter (SUBTOTAL), so filtering by bus or day shows that bus's or day's total. A file
 * can start with a Summary page of key figures. Printed, the header row repeats on every page and
 * each page is numbered. Opens in Excel, Google Sheets (open it from Drive) and phone sheet apps.
 */

import { CONTACT_EMAIL, CONTACT_PHONE } from './site'

export type Cell = string | number | null | undefined

/**
 * How a column's cells are written: text; wrap (long text, wrapped); int (a count); money and
 * taka (৳, no decimals, red when below zero); percent (pass 45 for 45%); rating (stars, one
 * decimal); date ('YYYY-MM-DD', a real date the filter groups by year, month and day); datetime
 * (an ISO time, shown in Dhaka time).
 */
export type Kind = 'text' | 'wrap' | 'int' | 'money' | 'taka' | 'percent' | 'rating' | 'date' | 'datetime'

/**
 * Marks problem values in a column in red, the way Excel's own highlight rules do, so the mark
 * follows filters and edits: below or above a number (in the column's own unit, so 40 means 40%
 * for a percent column), or cells whose text is one of a list.
 */
export interface Highlight {
  below?: number
  above?: number
  equals?: string[]
}

export interface Column {
  header: string
  kind?: Kind
  /** Add this column up in the TOTAL row. */
  total?: boolean
  width?: number
  highlight?: Highlight
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

/** One line on the Summary page: a key figure and how to show it. */
export interface SummaryItem {
  label: string
  value: Cell
  kind?: Kind
}

/** The Summary page a file can start with: the key figures, then what the other sheets hold. */
export interface Summary {
  title: string
  notes?: string[]
  items: SummaryItem[]
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
/** The line under every title, so a printed or forwarded sheet says where it came from. */
const BRAND_LINE = `BusHub · www.bushubbd.com · ${CONTACT_EMAIL} · ${CONTACT_PHONE}`

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
const TAKA_FMT = '&quot;৳ &quot;#,##0;[Red]\\-&quot;৳ &quot;#,##0'
const NUM_FMTS =
  '<numFmts count="6">' +
  '<numFmt numFmtId="164" formatCode="#,##0;[Red]\\-#,##0"/>' +
  '<numFmt numFmtId="165" formatCode="dd\\-mmm\\-yyyy"/>' +
  '<numFmt numFmtId="166" formatCode="dd\\-mmm\\-yyyy hh:mm"/>' +
  `<numFmt numFmtId="167" formatCode="${TAKA_FMT}"/>` +
  '<numFmt numFmtId="168" formatCode="0.0%"/>' +
  '<numFmt numFmtId="169" formatCode="0.0"/>' +
  '</numFmts>'
const FONTS = [
  '<font><sz val="10.5"/><color rgb="FF111111"/><name val="Calibri"/></font>', // 0 body
  '<font><b/><sz val="10.5"/><color rgb="FF111111"/><name val="Calibri"/></font>', // 1 bold
  '<font><b/><sz val="16"/><color rgb="FF111111"/><name val="Calibri"/></font>', // 2 title
  '<font><b/><sz val="10.5"/><color rgb="FF111111"/><name val="Calibri"/></font>', // 3 header
  '<font><sz val="10"/><color rgb="FF4A4A4A"/><name val="Calibri"/></font>', // 4 notes
  '<font><b/><sz val="10"/><color rgb="FF0B7F8C"/><name val="Calibri"/></font>', // 5 BusHub line
  '<font><b/><sz val="12"/><color rgb="FF111111"/><name val="Calibri"/></font>', // 6 summary figure
]
const FILLS = [
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFEB249"/><bgColor indexed="64"/></patternFill></fill>', // 2 header, orange
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF4FBFB"/><bgColor indexed="64"/></patternFill></fill>', // 3 band, faint aqua
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3DC"/><bgColor indexed="64"/></patternFill></fill>', // 4 total, light orange
  '<fill><patternFill patternType="solid"><fgColor rgb="FF53D3D1"/><bgColor indexed="64"/></patternFill></fill>', // 5 accent, aqua
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF2661D"/><bgColor indexed="64"/></patternFill></fill>', // 6 accent, orange
]
const BORDERS = [
  '<border><left/><right/><top/><bottom/><diagonal/></border>',
  '<border><left style="thin"><color rgb="FFDDE3E5"/></left><right style="thin"><color rgb="FFDDE3E5"/></right><top style="thin"><color rgb="FFDDE3E5"/></top><bottom style="thin"><color rgb="FFDDE3E5"/></bottom><diagonal/></border>',
  '<border><left style="thin"><color rgb="FFDDE3E5"/></left><right style="thin"><color rgb="FFDDE3E5"/></right><top style="medium"><color rgb="FFF2661D"/></top><bottom style="medium"><color rgb="FFF2661D"/></bottom><diagonal/></border>',
]
/** Red marks for problem values (conditional formatting). */
const DXFS = '<dxfs count="1"><dxf><font><b/><color rgb="FF9B1C1C"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E1"/><bgColor rgb="FFFDE2E1"/></patternFill></fill></dxf></dxfs>'
const KIND_FMT: Record<Kind, number> = { text: 0, wrap: 0, int: 3, money: 167, taka: 167, percent: 168, rating: 169, date: 165, datetime: 166 }
const KINDS: Kind[] = ['text', 'wrap', 'int', 'money', 'taka', 'percent', 'rating', 'date', 'datetime']

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
  { font: 0, fill: 5, border: 0, fmt: 0 }, // 5 accent bar, aqua
  { font: 0, fill: 6, border: 0, fmt: 0 }, // 6 accent bar, orange
  { font: 5, fill: 0, border: 0, fmt: 0, align: '<alignment vertical="center"/>' }, // 7 BusHub line
  { font: 1, fill: 0, border: 1, fmt: 0, align: '<alignment vertical="center"/>' }, // 8 summary label
  { font: 1, fill: 0, border: 0, fmt: 0, align: '<alignment vertical="center"/>' }, // 9 section heading
]
const BASE = XFS.length
const alignFor = (kind: Kind) =>
  kind === 'wrap'
    ? '<alignment vertical="top" wrapText="1"/>'
    : kind === 'date' || kind === 'datetime'
      ? '<alignment horizontal="center" vertical="top"/>'
      : '<alignment vertical="top"/>'
/** Body styles: per kind, plain and banded; then the total row per kind; then the Summary figures. */
function bodyXf(kind: Kind, band: boolean): number {
  return BASE + KINDS.indexOf(kind) * 2 + (band ? 1 : 0)
}
function totalXf(kind: Kind): number {
  return BASE + KINDS.length * 2 + KINDS.indexOf(kind)
}
function figureXf(kind: Kind): number {
  return BASE + KINDS.length * 3 + KINDS.indexOf(kind)
}
for (const kind of KINDS) XFS.push({ font: 0, fill: 0, border: 1, fmt: KIND_FMT[kind], align: alignFor(kind) }, { font: 0, fill: 3, border: 1, fmt: KIND_FMT[kind], align: alignFor(kind) })
for (const kind of KINDS) XFS.push({ font: 1, fill: 4, border: 2, fmt: KIND_FMT[kind], align: '<alignment vertical="center"/>' })
for (const kind of KINDS) XFS.push({ font: 6, fill: 0, border: 1, fmt: KIND_FMT[kind], align: '<alignment horizontal="right" vertical="center"/>' })

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
  '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  DXFS +
  '</styleSheet>'

/** A percent column takes 45 for 45%; Excel keeps 0.45. */
const stored = (value: number, kind: Kind) => (kind === 'percent' ? Math.round(value * 1000) / 100000 : value)

function cellXml(ref: string, style: number, value: Cell | { formula: string; value: number }, kind: Kind = 'text'): string {
  const s = ` s="${style}"`
  if (value === null || value === undefined || value === '') return `<c r="${ref}"${s}/>`
  if (typeof value === 'object') return `<c r="${ref}"${s}><f>${esc(value.formula)}</f><v>${value.value}</v></c>`
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${stored(value, kind)}</v></c>` : `<c r="${ref}"${s}/>`
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
  const extra = kind === 'money' || kind === 'taka' ? 2 : kind === 'percent' ? 1 : 0
  const longest = rows.reduce((n, r) => {
    const v = r[c]
    const len = typeof v === 'number' ? v.toLocaleString('en-US').length + extra : String(v ?? '').length
    return Math.max(n, len)
  }, 0)
  const head = Math.max(...col.header.split(' ').map((w) => w.length)) // the header can wrap between words
  return Math.min(40, Math.max(8, head + 3, longest + 3))
}

/** Excel's highlight rules for the columns that have one. */
function conditionalXml(cols: Column[], first: number, end: number): string {
  if (end < first) return ''
  let priority = 1
  return cols
    .map((col, c) => {
      const h = col.highlight
      if (!h) return ''
      const letter = colName(c)
      const range = `${letter}${first}:${letter}${end}`
      const kind = col.kind || 'text'
      const unit = (n: number) => stored(n, kind)
      const rules: string[] = []
      const cell = `${letter}${first}`
      // Only numbers: an empty seat-fill cell is not "below 40%".
      const numberRule = (test: string) => `<cfRule type="expression" dxfId="0" priority="${priority++}"><formula>AND(ISNUMBER(${cell}),${cell}${test})</formula></cfRule>`
      if (h.below !== undefined) rules.push(numberRule(`&lt;${unit(h.below)}`))
      if (h.above !== undefined) rules.push(numberRule(`&gt;${unit(h.above)}`))
      if (h.equals?.length) {
        const test = h.equals.map((t) => `${cell}=&quot;${esc(t).replace(/&quot;/g, '&quot;&quot;')}&quot;`).join(',')
        rules.push(`<cfRule type="expression" dxfId="0" priority="${priority++}"><formula>OR(${test})</formula></cfRule>`)
      }
      return rules.length ? `<conditionalFormatting sqref="${range}">${rules.join('')}</conditionalFormatting>` : ''
    })
    .join('')
}

/** The page set-up shared by every sheet: A4 landscape, one page wide, title on top, numbered pages. */
function printXml(title: string): string {
  const head = esc(`&L&"Calibri,Bold"${title.replace(/&/g, '&&')}&R&D`)
  const foot = esc('&LBusHub · www.bushubbd.com&RPage &P of &N')
  return (
    '<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    `<headerFooter><oddHeader>${head}</oddHeader><oddFooter>${foot}</oddFooter></headerFooter>`
  )
}

interface Built {
  xml: string
  /** The filter range, for sheets with filter arrows. */
  filter: string | null
  /** The header row, repeated on every printed page. */
  headRow: number | null
}

/** Title, BusHub line, notes and the two-colour bar: the top of every sheet. Returns the next free row. */
function topRows(rows: string[], title: string, notes: string[], span: number): number {
  rows.push(`<row r="1" ht="26" customHeight="1">${cellXml('A1', 1, title.toUpperCase())}</row>`)
  rows.push(`<row r="2" ht="16" customHeight="1">${cellXml('A2', 7, BRAND_LINE)}</row>`)
  notes.forEach((n, i) => rows.push(`<row r="${i + 3}" ht="16" customHeight="1">${cellXml(`A${i + 3}`, 2, n)}</row>`))
  const bar = notes.length + 3
  const cells = Array.from({ length: Math.max(span, 1) }, (_, c) => `<c r="${colName(c)}${bar}" s="${c % 2 === 0 ? 6 : 5}"/>`)
  rows.push(`<row r="${bar}" ht="4" customHeight="1">${cells.join('')}</row>`)
  return bar + 1
}

function sheetXml(sheet: Sheet, index: number): Built {
  const cols = sheet.columns
  const last = colName(Math.max(cols.length - 1, 0))
  const notes = [...(sheet.notes || []), `Generated: ${generatedAt()}`]
  const rows: string[] = []
  const headRow = topRows(rows, sheet.title, notes, cols.length)
  const first = headRow + 1
  const end = headRow + sheet.rows.length
  const hasTotal = cols.some((c) => c.total)

  rows.push(`<row r="${headRow}" ht="40" customHeight="1">${cols.map((col, c) => cellXml(`${colName(c)}${headRow}`, 3, col.header.toUpperCase())).join('')}</row>`)
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
      return cellXml(ref, totalXf(col.kind || 'int'), { formula, value: stored(value, col.kind || 'int') })
    })
    rows.push(`<row r="${n}" ht="22" customHeight="1">${cells.join('')}</row>`)
  }

  const filter = `$A$${headRow}:$${last}$${Math.max(end, headRow)}`
  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheetPr><tabColor rgb="${index === 0 ? 'FFF2661D' : 'FF53D3D1'}"/><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0"${index === 0 ? ' tabSelected="1"' : ''} showGridLines="0"><pane xSplit="1" ySplit="${headRow}" topLeftCell="B${first}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="B${first}" sqref="B${first}"/></sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols.map((col, c) => `<col min="${c + 1}" max="${c + 1}" width="${width(col, sheet.rows, c)}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    `<autoFilter ref="A${headRow}:${last}${Math.max(end, headRow)}"/>` +
    conditionalXml(cols, first, end) +
    printXml(sheet.title) +
    '</worksheet>'
  return { xml, filter, headRow }
}

/** The Summary page: the key figures in big type, then a list of the sheets that follow. */
function summaryXml(summary: Summary, sheetList: Sheet[]): Built {
  const notes = [...(summary.notes || []), `Generated: ${generatedAt()}`]
  const rows: string[] = []
  let n = topRows(rows, summary.title, notes, 2)
  rows.push(`<row r="${n}" ht="30" customHeight="1">${cellXml(`A${n}`, 3, 'KEY FIGURES')}${cellXml(`B${n}`, 3, 'VALUE')}</row>`)
  for (const item of summary.items) {
    n += 1
    const kind = item.kind || (typeof item.value === 'number' ? 'int' : 'text')
    rows.push(`<row r="${n}" ht="22" customHeight="1">${cellXml(`A${n}`, 8, item.label)}${cellXml(`B${n}`, figureXf(kind), item.value, kind)}</row>`)
  }
  n += 2
  rows.push(`<row r="${n}" ht="20" customHeight="1">${cellXml(`A${n}`, 9, "What's inside")}</row>`)
  for (const s of sheetList) {
    n += 1
    rows.push(`<row r="${n}">${cellXml(`A${n}`, 2, `• ${s.name}`)}${cellXml(`B${n}`, 2, s.title)}</row>`)
  }
  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetPr><tabColor rgb="FFF2661D"/><pageSetUpPr fitToPage="1"/></sheetPr>' +
    '<sheetViews><sheetView workbookViewId="0" tabSelected="1" showGridLines="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    '<cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/></cols>' +
    `<sheetData>${rows.join('')}</sheetData>` +
    printXml(summary.title).replace('orientation="landscape"', 'orientation="portrait"') +
    '</worksheet>'
  return { xml, filter: null, headRow: null }
}

/** Sheet names: at most 31 characters, none of []:*?/\ and each one different. */
function sheetNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((raw, i) => {
    let name = raw.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Sheet${i + 1}`
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${i + 1}`
    used.add(name.toLowerCase())
    return name
  })
}

export function workbookFiles(sheets: Sheet[], summary?: Summary): Record<string, string> {
  const built: Built[] = [...(summary ? [summaryXml(summary, sheets)] : []), ...sheets.map((s, i) => sheetXml(s, summary ? i + 1 : i))]
  const names = sheetNames([...(summary ? ['Summary'] : []), ...sheets.map((s) => s.name)])
  const quoted = (n: string) => `'${esc(n.replace(/'/g, "''"))}'`
  const defined = names
    .map((n, i) => {
      const b = built[i]
      if (!b.filter || !b.headRow) return ''
      return (
        `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${quoted(n)}!${b.filter}</definedName>` +
        `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${quoted(n)}!$${b.headRow}:$${b.headRow}</definedName>`
      )
    })
    .join('')
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
      '</sheets>' +
      (defined ? `<definedNames>${defined}</definedNames>` : '') +
      '<calcPr fullCalcOnLoad="1"/></workbook>',
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

/** Builds the .xlsx and starts the download. With a summary, the file opens on a Summary page. */
export function downloadSheet(fileName: string, sheets: Sheet[], options: { summary?: Summary } = {}) {
  const blob = new Blob([zip(workbookFiles(sheets, options.summary))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
