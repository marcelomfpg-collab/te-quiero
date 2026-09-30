import { useEffect, useRef } from 'react';
import { COMPANY_LABEL, DOCUMENT_TYPE_LABEL, VEHICLE_TYPE_LABEL } from '../../../domain/catalogs';
import { formatDate } from '../../../lib/dates';
import type { IndexedDocument } from '../filters/filterEngine';
import { relativeDays } from './ExpiryText';
import { StatusBadge } from './StatusBadge';

export function DocumentDrawer({ row, onClose }: { row: IndexedDocument; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { doc } = row;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const fields: [string, string][] = [
    ['Código', doc.code],
    ['N° de documento', doc.number],
    ['Emisor', doc.issuer],
    ['Empresa', COMPANY_LABEL[doc.company]],
    ['Unidad', `${doc.plate} · ${VEHICLE_TYPE_LABEL[doc.vehicleType]}`],
    ['Emisión', formatDate(doc.issueDate)],
    ['Vencimiento', `${formatDate(doc.expiryDate)} (${relativeDays(row.daysToExpiry)})`],
    ['Responsable', doc.responsible],
    ['Última actualización', formatDate(doc.updatedAt)],
  ];

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer__header">
          <div>
            <p className="drawer__eyebrow">{doc.plate}</p>
            <h2 id="drawer-title" className="drawer__title">
              {DOCUMENT_TYPE_LABEL[doc.type]}
            </h2>
            <StatusBadge status={row.status} />
          </div>
          <button ref={closeRef} type="button" className="btn btn--ghost drawer__close" onClick={onClose} aria-label="Cerrar detalle">
            ×
          </button>
        </header>
        <dl className="drawer__fields">
          {fields.map(([label, value]) => (
            <div key={label} className="drawer__field">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </>
  );
}
