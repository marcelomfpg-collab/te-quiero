function toUtcMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Fecha local de hoy en formato ISO `YYYY-MM-DD` (evita desfases por zona horaria). */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

const displayFormat = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', timeZone: 'UTC' });

export function formatDate(iso: string): string {
  return displayFormat.format(new Date(toUtcMs(iso)));
}

export function formatShortDate(iso: string): string {
  return shortFormat.format(new Date(toUtcMs(iso)));
}

/** Acepta `YYYY-MM-DD` o `DD/MM/YYYY` (formato habitual en Perú). */
export function parseDate(value: string): string | null {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}
