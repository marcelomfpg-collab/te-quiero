import { COMPANY_LABEL, DOCUMENT_TYPE_LABEL, VEHICLE_TYPE_LABEL } from '../../../domain/catalogs';
import type { IndexedDocument } from '../filters/filterEngine';
import type { SortDir, SortKey } from '../filters/filterState';
import { ExpiryText } from './ExpiryText';
import { StatusBadge } from './StatusBadge';

interface Column {
  key: SortKey;
  label: string;
  className?: string;
}

const COLUMNS: Column[] = [
  { key: 'status', label: 'Estado' },
  { key: 'plate', label: 'Placa / Unidad' },
  { key: 'type', label: 'Documento' },
  { key: 'company', label: 'Empresa' },
  { key: 'expiryDate', label: 'Vencimiento' },
  { key: 'code', label: 'Código', className: 'col--code' },
];

interface DocumentsTableProps {
  rows: IndexedDocument[];
  sortKey: SortKey;
  sortDir: SortDir;
  busy: boolean;
  selectedId: string | null;
  onSort: (key: SortKey) => void;
  onSelect: (row: IndexedDocument) => void;
}

export function DocumentsTable({ rows, sortKey, sortDir, busy, selectedId, onSort, onSelect }: DocumentsTableProps) {
  return (
    <div className={`table-wrap ${busy ? 'is-busy' : ''}`} aria-busy={busy}>
      <table className="table">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = col.key === sortKey;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={col.className}
                  aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" className={`th-sort ${active ? 'is-active' : ''}`} onClick={() => onSort(col.key)}>
                    {col.label}
                    <span className="th-sort__icon" aria-hidden="true">
                      {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { doc } = row;
            return (
              <tr
                key={doc.id}
                className={`row row--${row.status.toLowerCase()} ${doc.id === selectedId ? 'is-selected' : ''}`}
                tabIndex={0}
                onClick={() => onSelect(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(row);
                  }
                }}
                aria-label={`${DOCUMENT_TYPE_LABEL[doc.type]} de ${doc.plate}, ver detalle`}
              >
                <td data-label="Estado">
                  <StatusBadge status={row.status} />
                </td>
                <td data-label="Placa">
                  <div>
                    <span className="plate">{doc.plate}</span>
                    <span className="muted">{VEHICLE_TYPE_LABEL[doc.vehicleType]}</span>
                  </div>
                </td>
                <td data-label="Documento">
                  <div>
                    <span>{DOCUMENT_TYPE_LABEL[doc.type]}</span>
                    <span className="muted">{doc.issuer}</span>
                  </div>
                </td>
                <td data-label="Empresa">{COMPANY_LABEL[doc.company]}</td>
                <td data-label="Vencimiento">
                  <ExpiryText date={doc.expiryDate} days={row.daysToExpiry} />
                </td>
                <td data-label="Código" className="col--code mono">
                  {doc.code}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
