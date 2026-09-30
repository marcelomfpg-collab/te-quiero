import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { COMPANIES, COMPANY_LABEL, DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, STATUS_LABEL, VEHICLE_TYPE_LABEL } from '../../domain/catalogs';
import { downloadCsv, toCsv, type CsvColumn } from '../../lib/csv';
import { todayIso } from '../../lib/dates';
import type { DocumentRepository } from '../../services';
import { ActiveFilters } from './components/ActiveFilters';
import { DateRangeFilter } from './components/DateRangeFilter';
import { DocumentDrawer } from './components/DocumentDrawer';
import { DocumentsTable } from './components/DocumentsTable';
import { MultiSelect } from './components/MultiSelect';
import { Pagination } from './components/Pagination';
import { SearchInput } from './components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from './components/States';
import { StatusSummary } from './components/StatusSummary';
import { buildIndex, paginate, runQuery, sortRows, type IndexedDocument } from './filters/filterEngine';
import { countActiveFilters } from './filters/filterState';
import { useFilterState } from './filters/useFilterState';
import { useDocuments } from './hooks/useDocuments';

const CSV_COLUMNS: CsvColumn<IndexedDocument>[] = [
  { header: 'Código', value: (r) => r.doc.code },
  { header: 'Estado', value: (r) => STATUS_LABEL[r.status] },
  { header: 'Placa', value: (r) => r.doc.plate },
  { header: 'Tipo de unidad', value: (r) => VEHICLE_TYPE_LABEL[r.doc.vehicleType] },
  { header: 'Empresa', value: (r) => COMPANY_LABEL[r.doc.company] },
  { header: 'Documento', value: (r) => DOCUMENT_TYPE_LABEL[r.doc.type] },
  { header: 'N° documento', value: (r) => r.doc.number },
  { header: 'Emisor', value: (r) => r.doc.issuer },
  { header: 'Emisión', value: (r) => r.doc.issueDate },
  { header: 'Vencimiento', value: (r) => r.doc.expiryDate },
  { header: 'Días para vencer', value: (r) => r.daysToExpiry },
  { header: 'Responsable', value: (r) => r.doc.responsible },
];

export function DocumentsPage({ repository }: { repository: DocumentRepository }) {
  const today = useMemo(() => todayIso(), []);
  const load = useDocuments(repository);
  const [filters, dispatch] = useFilterState();
  const [selected, setSelected] = useState<IndexedDocument | null>(null);

  // 1) Índice: se recalcula solo cuando cambian los datos.
  const index = useMemo(() => (load.data ? buildIndex(load.data, today) : []), [load.data, today]);

  // 2) Filtrado + orden: diferido para que la UI (inputs, chips) nunca se bloquee.
  const deferred = useDeferredValue(filters);
  const { rows, facets } = useMemo(() => runQuery(index, deferred), [index, deferred]);
  const sorted = useMemo(() => sortRows(rows, deferred.sortKey, deferred.sortDir), [rows, deferred.sortKey, deferred.sortDir]);
  const page = paginate(sorted, filters.page, filters.pageSize);

  const isStale = deferred !== filters;
  const hasData = load.data !== null;
  const activeCount = countActiveFilters(filters);
  const closeDrawer = useCallback(() => setSelected(null), []);

  const exportCsv = () => downloadCsv(`documentos-${today}.csv`, toCsv(sorted, CSV_COLUMNS));

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">Pacsi Ingenieros S.A.C. · Gestión de flota</p>
          <h1 className="page__title">Control documentario</h1>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--secondary" onClick={load.reload} disabled={load.status === 'loading'}>
            {load.status === 'loading' && hasData ? 'Actualizando…' : 'Actualizar'}
          </button>
          <button type="button" className="btn btn--primary" onClick={exportCsv} disabled={!sorted.length}>
            Exportar CSV
          </button>
        </div>
      </header>

      <StatusSummary
        counts={facets.status}
        selected={filters.statuses}
        loading={!hasData}
        onToggle={(value) => dispatch({ type: 'toggleStatus', value })}
      />

      <section className="card" aria-label="Documentos">
        <div className="toolbar">
          <SearchInput value={filters.query} onChange={(query) => dispatch({ type: 'setQuery', query })} />
          <div className="toolbar__filters">
            <MultiSelect
              label="Empresa"
              options={COMPANIES}
              selected={filters.companies}
              counts={facets.company}
              onChange={(values) => dispatch({ type: 'setCompanies', values })}
            />
            <MultiSelect
              label="Tipo de documento"
              options={DOCUMENT_TYPES}
              selected={filters.types}
              counts={facets.type}
              onChange={(values) => dispatch({ type: 'setTypes', values })}
            />
            <DateRangeFilter
              field={filters.dateField}
              from={filters.from}
              to={filters.to}
              today={today}
              onChange={(field, from, to) => dispatch({ type: 'setDateRange', field, from, to })}
            />
          </div>
        </div>

        <ActiveFilters state={filters} dispatch={dispatch} />

        {load.status === 'error' && hasData && (
          <div className="banner banner--warning" role="status">
            No se pudo actualizar ({load.message}). Se muestran los últimos datos cargados.
            <button type="button" className="btn btn--link" onClick={load.reload}>
              Reintentar
            </button>
          </div>
        )}

        {!hasData && load.status === 'error' ? (
          <ErrorState message={load.message} onRetry={load.reload} />
        ) : !hasData ? (
          <TableSkeleton />
        ) : sorted.length === 0 ? (
          <EmptyState hasFilters={activeCount > 0} onReset={() => dispatch({ type: 'reset' })} />
        ) : (
          <>
            <DocumentsTable
              rows={page.items}
              sortKey={filters.sortKey}
              sortDir={filters.sortDir}
              busy={isStale || load.status === 'loading'}
              selectedId={selected?.doc.id ?? null}
              onSort={(key) => dispatch({ type: 'sortBy', key })}
              onSelect={setSelected}
            />
            <Pagination
              page={page.page}
              totalPages={page.totalPages}
              start={page.start}
              end={page.end}
              total={sorted.length}
              pageSize={filters.pageSize}
              onPage={(p) => dispatch({ type: 'setPage', page: p })}
              onPageSize={(pageSize) => dispatch({ type: 'setPageSize', pageSize })}
            />
          </>
        )}
        <p className="sr-only" aria-live="polite">
          {hasData ? `${sorted.length} documentos encontrados` : ''}
        </p>
      </section>

      {selected && <DocumentDrawer row={selected} onClose={closeDrawer} />}
    </div>
  );
}
