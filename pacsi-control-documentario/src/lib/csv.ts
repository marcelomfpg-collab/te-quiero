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
