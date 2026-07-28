/**
 * Minimal dependency-free XLSX writer.
 * Produces a real .xlsx (ZIP of OOXML parts, STORE method) with:
 * - multiple sheets, RTL sheet views, column widths
 * - inline strings (full Arabic support) and native numbers
 * - a bold style for header rows
 */

export interface SheetSpec {
  name: string;
  /** First row is treated as the header (bold). */
  rows: (string | number | null | undefined)[][];
  colWidths?: number[];
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnRef(index: number): string {
  let ref = "";
  let n = index;
  while (n >= 0) {
    ref = String.fromCharCode(65 + (n % 26)) + ref;
    n = Math.floor(n / 26) - 1;
  }
  return ref;
}

function sanitizeSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[[\]*?:/\\]/g, " ").trim().slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}

function sheetXml(spec: SheetSpec): string {
  const cols = spec.colWidths?.length
    ? `<cols>${spec.colWidths
        .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
        .join("")}</cols>`
    : "";

  const rows = spec.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          if (value === null || value === undefined || value === "") return "";
          const ref = `${columnRef(colIndex)}${rowIndex + 1}`;
          const style = rowIndex === 0 ? ' s="1"' : "";
          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}"${style}><v>${value}</v></c>`;
          }
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

// ---------------------------------------------------------------------------
// ZIP (STORE, no compression)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const writeUint = (view: DataView, pos: number, value: number, bytes: 2 | 4) => {
    if (bytes === 2) view.setUint16(pos, value, true);
    else view.setUint32(pos, value >>> 0, true);
  };

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    writeUint(lv, 0, 0x04034b50, 4);
    writeUint(lv, 4, 20, 2); // version needed
    writeUint(lv, 6, 0x0800, 2); // UTF-8 flag
    writeUint(lv, 8, 0, 2); // STORE
    writeUint(lv, 10, 0, 2); // time
    writeUint(lv, 12, 0x5821, 2); // date (fixed: 2024-01-01)
    writeUint(lv, 14, crc, 4);
    writeUint(lv, 18, size, 4);
    writeUint(lv, 22, size, 4);
    writeUint(lv, 26, nameBytes.length, 2);
    writeUint(lv, 28, 0, 2);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    writeUint(cv, 0, 0x02014b50, 4);
    writeUint(cv, 4, 20, 2);
    writeUint(cv, 6, 20, 2);
    writeUint(cv, 8, 0x0800, 2);
    writeUint(cv, 10, 0, 2);
    writeUint(cv, 12, 0, 2);
    writeUint(cv, 14, 0x5821, 2);
    writeUint(cv, 16, crc, 4);
    writeUint(cv, 20, size, 4);
    writeUint(cv, 24, size, 4);
    writeUint(cv, 28, nameBytes.length, 2);
    writeUint(cv, 42, offset, 4);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  writeUint(ev, 0, 0x06054b50, 4);
  writeUint(ev, 8, entries.length, 2);
  writeUint(ev, 10, entries.length, 2);
  writeUint(ev, 12, centralSize, 4);
  writeUint(ev, 16, offset, 4);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Workbook assembly
// ---------------------------------------------------------------------------

export function buildXlsx(sheets: SheetSpec[]): Uint8Array {
  const encoder = new TextEncoder();
  const names = sheets.map((s, i) => sanitizeSheetName(s.name, i));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("")}</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
    .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("")}</sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf xfId="0" fontId="1" applyFont="1"/></cellXfs></styleSheet>`;

  const entries: ZipEntry[] = [
    { path: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { path: "_rels/.rels", data: encoder.encode(rootRels) },
    { path: "xl/workbook.xml", data: encoder.encode(workbook) },
    { path: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { path: "xl/styles.xml", data: encoder.encode(styles) },
    ...sheets.map((sheet, i) => ({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      data: encoder.encode(sheetXml(sheet)),
    })),
  ];

  return buildZip(entries);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Saves the workbook and opens the share sheet on Android, or downloads it on web. */
export async function saveAndShareXlsx(fileName: string, bytes: Uint8Array, shareTitle: string): Promise<void> {
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const result = await Filesystem.writeFile({
      path: fileName,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
    });
    await Share.share({ title: shareTitle, url: result.uri, dialogTitle: shareTitle });
  } else {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: XLSX_MIME });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
