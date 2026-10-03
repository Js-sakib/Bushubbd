/**
 * A small Excel (.xlsx) writer for the "Download sheet" buttons: no library, runs in the browser.
 * The file opens in Excel, Google Sheets (File → Import, or open it from Drive) and phone sheet
 * apps, where it can be edited and copied. Numbers stay numbers, so the sheet can add them up.
 */

export type Cell = string | number | null | undefined | { sum: string; value: number }

export interface Sheet {
  name: string
  header: string[]
  rows: Cell[][]
  /** A last bold row; use { sum: 'B' } style cells to add a column up. */
  total?: Cell[]
}

const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function colName(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

function cellXml(value: Cell, ref: string, style: number): string {
  const s = style ? ` s="${style}"` : ''
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"${s}><v>${value}</v></c>` : ''
  if (typeof value === 'object') return `<c r="${ref}"${s}><f>${esc(value.sum)}</f><v>${value.value}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`
}

function sheetXml(sheet: Sheet): string {
  const all: { cells: Cell[]; style: number }[] = [
    { cells: sheet.header, style: 1 },
    ...sheet.rows.map((cells) => ({ cells, style: 0 })),
    ...(sheet.total ? [{ cells: sheet.total, style: 1 }] : []),
  ]
  const widths = sheet.header.map((_, c) =>
    Math.min(45, Math.max(8, ...all.map((r) => String((r.cells[c] as any)?.value ?? r.cells[c] ?? '').length + 2)))
  )
  const rows = all
    .map((r, i) => `<row r="${i + 1}">${r.cells.map((v, c) => cellXml(v, `${colName(c)}${i + 1}`, r.style)).join('')}</row>`)
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${rows}</sheetData></worksheet>`
  )
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
      '</sheets><calcPr fullCalcOnLoad="1"/></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      `<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>',
  }
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s)))
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

/** Adds up a column for a sheet's total row: an Excel SUM, with the value for apps that don't recalculate. */
export function sumCell(sheet: { rows: Cell[][] }, col: number): Cell {
  const letter = colName(col)
  const value = sheet.rows.reduce((n, r) => n + (typeof r[col] === 'number' ? (r[col] as number) : 0), 0)
  return sheet.rows.length ? { sum: `SUM(${letter}2:${letter}${sheet.rows.length + 1})`, value } : 0
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
