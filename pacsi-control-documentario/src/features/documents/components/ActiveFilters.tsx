import { COMPANY_LABEL, DOCUMENT_TYPE_LABEL, STATUS_LABEL } from '../../../domain/catalogs';
import { formatDate } from '../../../lib/dates';
import type { FilterAction, FilterState } from '../filters/filterState';

interface Chip {
  key: string;
  label: string;
  remove: FilterAction;
}

function buildChips(s: FilterState): Chip[] {
  const chips: Chip[] = [];
  if (s.query.trim()) chips.push({ key: 'q', label: `“${s.query.trim()}”`, remove: { type: 'setQuery', query: '' } });
  for (const v of s.statuses)
    chips.push({ key: `s-${v}`, label: STATUS_LABEL[v], remove: { type: 'setStatuses', values: s.statuses.filter((x) => x !== v) } });
  for (const v of s.companies)
    chips.push({ key: `c-${v}`, label: COMPANY_LABEL[v], remove: { type: 'setCompanies', values: s.companies.filter((x) => x !== v) } });
  for (const v of s.types)
    chips.push({ key: `t-${v}`, label: DOCUMENT_TYPE_LABEL[v], remove: { type: 'setTypes', values: s.types.filter((x) => x !== v) } });
  if (s.from || s.to) {
    const field = s.dateField === 'expiryDate' ? 'Vence' : 'Emitido';
    const range = s.from && s.to ? `${formatDate(s.from)} – ${formatDate(s.to)}` : s.from ? `desde ${formatDate(s.from)}` : `hasta ${formatDate(s.to!)}`;
    chips.push({ key: 'date', label: `${field}: ${range}`, remove: { type: 'setDateRange', field: s.dateField, from: null, to: null } });
  }
  return chips;
}

export function ActiveFilters({ state, dispatch }: { state: FilterState; dispatch: React.Dispatch<FilterAction> }) {
  const chips = buildChips(state);
  if (chips.length === 0) return null;
  return (
    <div className="active-filters" aria-label="Filtros activos">
      {chips.map((chip) => (
        <button key={chip.key} type="button" className="chip chip--removable" onClick={() => dispatch(chip.remove)} aria-label={`Quitar filtro ${chip.label}`}>
          {chip.label}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="btn btn--link" onClick={() => dispatch({ type: 'reset' })}>
        Limpiar todo
      </button>
    </div>
  );
}
