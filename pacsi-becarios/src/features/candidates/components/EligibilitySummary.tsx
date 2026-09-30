import type { Eligibility } from '../../../domain/types';

interface EligibilitySummaryProps {
  counts: Record<string, number>;
  warnings: number;
  selected: Eligibility[];
  onlyWarnings: boolean;
  loading: boolean;
  onToggle: (value: Eligibility) => void;
  onToggleWarnings: () => void;
}

const CARDS: { value: Eligibility; label: string; hint: string }[] = [
  { value: 'APTO', label: 'Aptos', hint: 'Cumplen todos los requisitos excluyentes' },
  { value: 'POR_EVALUAR', label: 'Por evaluar', hint: 'Falta calificar habilidades blandas' },
  { value: 'NO_APTO', label: 'No aptos', hint: 'Incumplen algún requisito excluyente' },
];

/** Indicadores que además son filtros rápidos. */
export function EligibilitySummary({ counts, warnings, selected, onlyWarnings, loading, onToggle, onToggleWarnings }: EligibilitySummaryProps) {
  const value = (n: number) => (loading ? <span className="skeleton skeleton--num" /> : n.toLocaleString('es-PE'));
  return (
    <div className="kpis" role="group" aria-label="Filtros rápidos">
      {CARDS.map((card) => {
        const active = selected.includes(card.value);
        return (
          <button key={card.value} type="button" className={`kpi kpi--${card.value.toLowerCase()} ${active ? 'is-active' : ''}`} aria-pressed={active} onClick={() => onToggle(card.value)}>
            <span className="kpi__label">{card.label}</span>
            <span className="kpi__value">{value(counts[card.value] ?? 0)}</span>
            <span className="kpi__hint">{card.hint}</span>
          </button>
        );
      })}
      <button type="button" className={`kpi kpi--observado ${onlyWarnings ? 'is-active' : ''}`} aria-pressed={onlyWarnings} onClick={onToggleWarnings}>
        <span className="kpi__label">Con observaciones</span>
        <span className="kpi__value">{value(warnings)}</span>
        <span className="kpi__hint">Asunto mal escrito, DNI duplicado…</span>
      </button>
    </div>
  );
}
