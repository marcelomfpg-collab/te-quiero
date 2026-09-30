import { CONVOCATORIA, currentPhase } from '../../../domain/convocatoria';
import { formatShortDate } from '../../../lib/dates';

/** Cronograma oficial de la convocatoria con la fase actual resaltada. */
export function ConvocatoriaTimeline({ today }: { today: string }) {
  const active = currentPhase(today);
  const activeIndex = CONVOCATORIA.phases.findIndex((p) => p.id === active);
  return (
    <ol className="timeline" aria-label="Cronograma de la convocatoria">
      {CONVOCATORIA.phases.map((phase, i) => {
        const state = i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'next';
        const range = phase.from === phase.to ? formatShortDate(phase.to) : phase.from ? `${formatShortDate(phase.from)} – ${formatShortDate(phase.to)}` : `hasta ${formatShortDate(phase.to)}`;
        return (
          <li key={phase.id} className={`timeline__step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="timeline__marker" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
            <span className="timeline__label">{phase.label}</span>
            <span className="timeline__range">{range}</span>
          </li>
        );
      })}
    </ol>
  );
}
