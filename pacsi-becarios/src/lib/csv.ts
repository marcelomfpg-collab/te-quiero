export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

function escapeCell(value: string | number, separator: string): string {
  const text = String(value);
  return /["\n\r]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Excel en configuración regional es-PE usa ";" como separador de listas. */
export function toCsv<T>(rows: readonly T[], columns: CsvColumn<T>[], separator = ';'): string {
  const header = columns.map((c) => escapeCell(c.header, separator)).join(separator);
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row), separator)).join(separator));
  return [header, ...body].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM para que Excel respete tildes y eñes.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Parser CSV mínimo pero correcto (comillas, saltos de línea dentro de celdas, BOM).
 * Detecta automáticamente ";" (Excel es-PE) o ",".
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
