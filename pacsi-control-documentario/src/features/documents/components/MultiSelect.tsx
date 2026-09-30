import type { Option } from '../../../domain/catalogs';
import { Popover } from './Popover';

interface MultiSelectProps<T extends string> {
  label: string;
  options: Option<T>[];
  selected: T[];
  counts: Record<T, number>;
  onChange: (values: T[]) => void;
}

export function MultiSelect<T extends string>({ label, options, selected, counts, onChange }: MultiSelectProps<T>) {
  const toggle = (value: T) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <Popover label={label} count={selected.length}>
      <fieldset className="checklist">
        <legend className="sr-only">{label}</legend>
        {options.map((o) => (
          <label key={o.value} className={`checklist__item ${counts[o.value] === 0 ? 'is-empty' : ''}`}>
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
            <span className="checklist__label">{o.label}</span>
            <span className="checklist__count">{counts[o.value].toLocaleString('es-PE')}</span>
          </label>
        ))}
      </fieldset>
      {selected.length > 0 && (
        <button type="button" className="btn btn--link checklist__clear" onClick={() => onChange([])}>
          Quitar selección
        </button>
      )}
    </Popover>
  );
}
