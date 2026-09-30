import { formatDate } from '../../../lib/dates';

/** Fecha + distancia relativa, que es lo que realmente mira el operador. */
export function relativeDays(days: number): string {
  if (days === 0) return 'vence hoy';
  if (days === 1) return 'vence mañana';
  if (days > 0) return `en ${days} días`;
  if (days === -1) return 'venció ayer';
  return `hace ${-days} días`;
}

export function ExpiryText({ date, days }: { date: string; days: number }) {
  return (
    <div className="expiry">
      <time dateTime={date}>{formatDate(date)}</time>
      <span className={`expiry__rel ${days < 0 ? 'is-late' : days <= 30 ? 'is-soon' : ''}`}>{relativeDays(days)}</span>
    </div>
  );
}
