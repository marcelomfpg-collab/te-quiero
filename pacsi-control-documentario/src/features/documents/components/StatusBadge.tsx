import { STATUS_LABEL } from '../../../domain/catalogs';
import type { DocumentStatus } from '../../../domain/types';

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`badge badge--${status.toLowerCase()}`}>
      <span className="badge__dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
