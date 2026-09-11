import ExcelJS from "exceljs";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PageSizes,
} from "pdf-lib";

export type ExportColumnFormat = "currency_bdt" | "currency_usd" | "date" | "datetime" | "number" | "percent" | "text";

export interface ExportColumn<T = any> {
  key: keyof T | string;
  label: string;
  width?: number;
  format?: ExportColumnFormat;
  formatValue?: (value: any, row: T) => string;
}

export interface CsvExportOptions {
  includeBom?: boolean;
  delimiter?: string;
  newline?: string;
}

export interface XlsxSheet<T = any> {
  name: string;
  columns: ExportColumn<T>[];
  rows: T[];
  title?: string;
}

export interface PdfExportOptions<T = any> {
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  footerText?: string;
  currencyLabel?: string;
  pageSize?: [number, number];
  landscape?: boolean;
}

export interface AttachmentHeaders {
  "Content-Type": string;
  "Content-Disposition": string;
}

const BOM = "\uFEFF";

function pad(n: number) { return n < 10 ? "0" + n : String(n); }

function formatDate(d: Date | string | number | null | undefined, withTime = false): string {
  if (d === null || d === undefined) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const base = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  if (!withTime) return base;
  return `${base} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

function formatCurrencyBDT(value: any): string {
  if (value === null || value === undefined || value === "") return "0";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `৳ ${n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyUSD(value: any): string {
  if (value === null || value === undefined || value === "") return "0";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: any, digits = 2): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPercent(value: any): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toFixed(2)}%`;
}

export function formatCell<T>(col: ExportColumn<T>, row: T): string {
  const key = String(col.key);
  const rawValue = (row as Record<string, any>)?.[key];
  if (col.formatValue) return col.formatValue(rawValue, row);
  if (rawValue === null || rawValue === undefined) return "";
  switch (col.format) {
    case "currency_bdt": return formatCurrencyBDT(rawValue);
    case "currency_usd": return formatCurrencyUSD(rawValue);
    case "date": return formatDate(rawValue, false);
    case "datetime": return formatDate(rawValue, true);
    case "number": return formatNumber(rawValue);
    case "percent": return formatPercent(rawValue);
    default: return String(rawValue);
  }
}

export function csvEscape(value: any, delimiter = ","): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.indexOf(delimiter) >= 0 || str.indexOf('"') >= 0 || str.indexOf("\n") >= 0 || str.indexOf("\r") >= 0) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsv<T = any>(rows: T[], columns: ExportColumn<T>[], opts: CsvExportOptions = {}): Buffer {
  const delimiter = opts.delimiter ?? ",";
  const newline = opts.newline ?? "\r\n";
  const lines: string[] = [];
  lines.push(columns.map((c) => csvEscape(c.label, delimiter)).join(delimiter));
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(formatCell(c, row), delimiter)).join(delimiter));
  }
  const body = (opts.includeBom !== false ? BOM : "") + lines.join(newline);
  return Buffer.from(body, "utf8");
}

export async function generateXlsx(sheets: XlsxSheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ecom Platform";
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), {
      properties: { defaultRowHeight: 20 },
    });
    const headers = sheet.columns.map((c) => c.label);
    if (sheet.title) {
      ws.addRow([sheet.title]);
      const titleRow = ws.getRow(1);
      titleRow.font = { bold: true, size: 14 };
      titleRow.alignment = { horizontal: "center" };
      ws.mergeCells(1, 1, 1, Math.max(headers.length, 1));
      ws.addRow([]);
    }
    ws.columns = sheet.columns.map((c, idx) => ({
      header: headers[idx],
      key: String(c.key),
      width: c.width ?? Math.max(12, (c.label?.length ?? 10) + 2),
    }));
    const headerRow = ws.getRow(ws.lastRow?.number ?? 1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    for (const row of sheet.rows) {
      const values: Record<string, any> = {};
      for (const col of sheet.columns) {
        values[String(col.key)] = formatCell(col, row);
      }
      ws.addRow(values);
    }
    const dataStartIdx = (sheet.title ? 3 : 1) + 1;
    const lastRow = ws.lastRow?.number ?? 1;
    for (let i = dataStartIdx; i <= lastRow; i++) {
      for (let j = 1; j <= sheet.columns.length; j++) {
        const cell = ws.getRow(i).getCell(j);
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      }
    }
  }
  const arr = await wb.xlsx.writeBuffer();
  return Buffer.from(arr as unknown as Uint8Array);
}

function wrapText(text: string, font: any, maxWidth: number, size: number): string[] {
  if (!text) return [""];
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 0) lines.push("");
  return lines;
}

export async function generatePdf<T = any>(opts: PdfExportOptions<T>): Promise<Buffer> {
  const pageSize = opts.pageSize ?? PageSizes.A4;
  const landscape = opts.landscape ?? opts.columns.length > 6;
  const [w, h] = landscape ? [pageSize[1], pageSize[0]] : [pageSize[0], pageSize[1]];

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 36;
  const topPad = 70;
  const columnCount = Math.max(opts.columns.length, 1);
  const totalWidth = w - margin * 2;
  const colWidths = opts.columns.map((c) => c.width ? Math.min(c.width * 5, totalWidth / 2) : totalWidth / columnCount);
  const totalColW = colWidths.reduce((s, v) => s + v, 0);
  const normWidths = colWidths.map((v) => (v / totalColW) * totalWidth);
  const rowsPerPage = Math.max(4, Math.floor((h - topPad - 60) / 20));

  function drawHeader(page: any, title: string, subtitle?: string) {
    page.drawText(title, { x: margin, y: h - 40, font: bold, size: 16, color: rgb(0.07, 0.15, 0.29) });
    if (subtitle) page.drawText(subtitle, { x: margin, y: h - 60, font, size: 10, color: rgb(0.35, 0.4, 0.48) });
    page.drawLine({ start: { x: margin, y: h - 72 }, end: { x: w - margin, y: h - 72 }, thickness: 1, color: rgb(0.82, 0.85, 0.89) });
    page.drawText((opts as any).footerText ?? `Generated ${formatDate(new Date(), true)}`, { x: margin, y: 24, font, size: 8, color: rgb(0.45, 0.5, 0.58) });
  }

  function drawTableHead(page: any, yCursor: { v: number }) {
    let x = margin;
    page.drawRectangle({ x: margin, y: yCursor.v - 14, width: totalWidth, height: 16, color: rgb(0.93, 0.95, 0.98) });
    for (let i = 0; i < opts.columns.length; i++) {
      const col = opts.columns[i]!;
      const text = String(col.label ?? "").slice(0, 60);
      page.drawText(text, { x: x + 4, y: yCursor.v - 10, font: bold, size: 9, color: rgb(0.07, 0.15, 0.29), maxWidth: normWidths[i]! - 8 });
      x += normWidths[i]!;
    }
    page.drawLine({ start: { x: margin, y: yCursor.v - 15 }, end: { x: w - margin, y: yCursor.v - 15 }, thickness: 0.5, color: rgb(0.82, 0.85, 0.89) });
    yCursor.v -= 20;
  }

  function drawRow(page: any, yCursor: { v: number }, row: T): number {
    let x = margin;
    let rowHeight = 18;
    const rendered: string[][] = [];
    for (let i = 0; i < opts.columns.length; i++) {
      const col = opts.columns[i]!;
      const lines = wrapText(formatCell(col, row), font, normWidths[i]! - 8, 9);
      rendered.push(lines);
      rowHeight = Math.max(rowHeight, lines.length * 12 + 6);
    }
    if (yCursor.v - rowHeight < margin + 14) return -1;
    for (let i = 0; i < opts.columns.length; i++) {
      let yText = yCursor.v - 12;
      const lines = rendered[i]!;
      for (const line of lines) {
        page.drawText(line, { x: x + 4, y: yText, font, size: 9, color: rgb(0.15, 0.2, 0.27), maxWidth: normWidths[i]! - 8 });
        yText -= 12;
      }
      x += normWidths[i]!;
    }
    page.drawLine({ start: { x: margin, y: yCursor.v - rowHeight + 2 }, end: { x: w - margin, y: yCursor.v - rowHeight + 2 }, thickness: 0.3, color: rgb(0.89, 0.91, 0.94) });
    return yCursor.v - rowHeight;
  }

  let page: any = doc.addPage([w, h]);
  drawHeader(page, opts.title, opts.subtitle);
  const yCursor = { v: h - topPad };
  drawTableHead(page, yCursor);
  let rowsDrawnOnPage = 0;
  for (const row of opts.rows) {
    if (rowsDrawnOnPage >= rowsPerPage) {
      page = doc.addPage([w, h]);
      drawHeader(page, opts.title, opts.subtitle);
      yCursor.v = h - topPad;
      drawTableHead(page, yCursor);
      rowsDrawnOnPage = 0;
    }
    let next = drawRow(page, yCursor, row);
    if (next === -1) {
      page = doc.addPage([w, h]);
      drawHeader(page, opts.title, opts.subtitle);
      yCursor.v = h - topPad;
      drawTableHead(page, yCursor);
      rowsDrawnOnPage = 0;
      next = drawRow(page, yCursor, row);
    }
    yCursor.v = next;
    rowsDrawnOnPage++;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export function attachmentHeader(filename: string): AttachmentHeaders {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  let contentType = "application/octet-stream";
  switch (ext) {
    case "csv": contentType = "text/csv; charset=utf-8"; break;
    case "xlsx": contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; break;
    case "pdf": contentType = "application/pdf"; break;
    case "json": contentType = "application/json"; break;
    case "zip": contentType = "application/zip"; break;
  }
  const sanitized = filename.replace(/[^\w.\-]+/g, "_");
  const encoded = encodeURIComponent(sanitized);
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${sanitized}"; filename*=UTF-8''${encoded}`,
  };
}

export function formatTimestampFilename(base: string, ext: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${base}_${stamp}.${ext}`;
}
