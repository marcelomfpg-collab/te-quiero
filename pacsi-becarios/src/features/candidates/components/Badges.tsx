import { ELIGIBILITY_LABEL, STAGE_LABEL } from '../../../domain/catalogs';
import type { Eligibility, Stage } from '../../../domain/types';

export function EligibilityBadge({ value }: { value: Eligibility }) {
  return (
    <span className={`badge badge--${value.toLowerCase()}`}>
      <span className="badge__dot" aria-hidden="true" />
      {ELIGIBILITY_LABEL[value]}
    </span>
  );
}

export function StageBadge({ value }: { value: Stage }) {
  return <span className={`stage stage--${value.toLowerCase()}`}>{STAGE_LABEL[value]}</span>;
}
