import { CAREER_LABEL, ELIGIBILITY_LABEL, REQUIREMENT_SHORT, SHIFT_LABEL, STAGE_LABEL } from '../../../domain/catalogs';
import type { Career, Eligibility, RequirementId, Shift, Stage } from '../../../domain/types';
import type { FilterAction, FilterState, ListKey } from '../filters/filterState';

const LABELERS: Record<ListKey, (v: string) => string> = {
  eligibility: (v) => ELIGIBILITY_LABEL[v as Eligibility],
  careers: (v) => CAREER_LABEL[v as Career],
  stages: (v) => STAGE_LABEL[v as Stage],
  years: (v) => `${v}° año`,
  shifts: (v) => SHIFT_LABEL[v as Shift],
  failing: (v) => `No cumple: ${REQUIREMENT_SHORT[v as RequirementId]}`,
};

export function ActiveFilters({ state, dispatch }: { state: FilterState; dispatch: React.Dispatch<FilterAction> }) {
  const chips: { key: string; label: string; remove: FilterAction }[] = [];
  if (state.query.trim()) chips.push({ key: 'q', label: `“${state.query.trim()}”`, remove: { type: 'setQuery', query: '' } });
  for (const key of Object.keys(LABELERS) as ListKey[]) {
    for (const value of state[key] as string[]) {
      chips.push({ key: `${key}-${value}`, label: LABELERS[key](value), remove: { type: 'toggle', key, value } });
    }
  }
  if (state.onlyWarnings) chips.push({ key: 'warn', label: 'Con observaciones', remove: { type: 'setOnlyWarnings', value: false } });
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
