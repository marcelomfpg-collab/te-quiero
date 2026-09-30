import { REQUIREMENT_LABEL, REQUIREMENT_SHORT } from '../../../domain/catalogs';
import type { RequirementCheck } from '../../../domain/types';

const SYMBOL = { CUMPLE: '✓', NO_CUMPLE: '✕', PENDIENTE: '?', NO_APLICA: '–' } as const;

/** Vista compacta de los 9 requisitos: se entiende de un vistazo por qué alguien no es apto. */
export function RequirementDots({ checks }: { checks: RequirementCheck[] }) {
  const failed = checks.filter((c) => c.status === 'NO_CUMPLE' && c.mandatory).length;
  return (
    <div className="req-dots" aria-label={failed ? `No cumple ${failed} requisitos excluyentes` : 'Cumple los requisitos excluyentes'}>
      {checks.map((c) => (
        <span
          key={c.id}
          className={`req-dot req-dot--${c.status.toLowerCase()} ${c.mandatory ? '' : 'is-optional'}`}
          title={`${REQUIREMENT_LABEL[c.id]}: ${c.detail}`}
          aria-hidden="true"
        >
          {SYMBOL[c.status]}
          <span className="req-dot__tip">
            <strong>{REQUIREMENT_SHORT[c.id]}</strong> {c.detail}
          </span>
        </span>
      ))}
    </div>
  );
}
