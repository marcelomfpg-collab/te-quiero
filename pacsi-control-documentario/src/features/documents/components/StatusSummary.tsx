import { STATUSES } from '../../../domain/catalogs';
import type { DocumentStatus } from '../../../domain/types';

interface StatusSummaryProps {
  counts: Record<DocumentStatus, number>;
  selected: DocumentStatus[];
  loading: boolean;
  onToggle: (status: DocumentStatus) => void;
}

const HINTS: Record<DocumentStatus, string> = {
  VENCIDO: 'Requieren acción inmediata',
  POR_VENCER: 'Vencen en ≤ 30 días',
  EN_TRAMITE: 'Renovación en curso',
  VIGENTE: 'Sin acciones pendientes',
};

/** Indicadores que además funcionan como filtro rápido por estado. */
export function StatusSummary({ counts, selected, loading, onToggle }: StatusSummaryProps) {
  return (
    <div className="kpis" role="group" aria-label="Filtrar por estado">
      {STATUSES.map(({ value, label }) => {
        const active = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            className={`kpi kpi--${value.toLowerCase()} ${active ? 'is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onToggle(value)}
          >
            <span className="kpi__label">{label}</span>
            <span className="kpi__value">{loading ? <span className="skeleton skeleton--num" /> : counts[value].toLocaleString('es-PE')}</span>
            <span className="kpi__hint">{HINTS[value]}</span>
          </button>
        );
      })}
    </div>
  );
}
