import { addDays } from '../../../lib/dates';
import type { DateField } from '../filters/filterState';
import { Popover } from './Popover';

interface DateRangeFilterProps {
  field: DateField;
  from: string | null;
  to: string | null;
  today: string;
  onChange: (field: DateField, from: string | null, to: string | null) => void;
}

const PRESETS = [
  { label: 'Vencen en 7 días', days: 7 },
  { label: 'Vencen en 30 días', days: 30 },
  { label: 'Vencen en 90 días', days: 90 },
];

export function DateRangeFilter({ field, from, to, today, onChange }: DateRangeFilterProps) {
  const active = from || to ? 1 : 0;
  return (
    <Popover label="Fechas" count={active}>
      <div className="daterange">
        <label className="field">
          <span className="field__label">Filtrar por</span>
          <select value={field} onChange={(e) => onChange(e.target.value as DateField, from, to)}>
            <option value="expiryDate">Fecha de vencimiento</option>
            <option value="issueDate">Fecha de emisión</option>
          </select>
        </label>
        <div className="daterange__row">
          <label className="field">
            <span className="field__label">Desde</span>
            <input type="date" value={from ?? ''} max={to ?? undefined} onChange={(e) => onChange(field, e.target.value || null, to)} />
          </label>
          <label className="field">
            <span className="field__label">Hasta</span>
            <input type="date" value={to ?? ''} min={from ?? undefined} onChange={(e) => onChange(field, from, e.target.value || null)} />
          </label>
        </div>
        <div className="daterange__presets" role="group" aria-label="Rangos rápidos">
          {PRESETS.map((p) => (
            <button key={p.days} type="button" className="chip" onClick={() => onChange('expiryDate', today, addDays(today, p.days))}>
              {p.label}
            </button>
          ))}
        </div>
        {active > 0 && (
          <button type="button" className="btn btn--link" onClick={() => onChange(field, null, null)}>
            Quitar rango
          </button>
        )}
      </div>
    </Popover>
  );
}
