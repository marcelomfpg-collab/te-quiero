import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CAREER_LABEL, CAREERS, ELIGIBILITY_LABEL, REQUIREMENT_SHORT, REQUIREMENTS, SHIFTS, STAGE_LABEL, STAGES, STUDY_YEARS } from '../../domain/catalogs';
import { CONVOCATORIA } from '../../domain/convocatoria';
import { downloadCsv, toCsv, type CsvColumn } from '../../lib/csv';
import { todayIso } from '../../lib/dates';
import type { CandidateRepository } from '../../services';
import { ActiveFilters } from './components/ActiveFilters';
import { CandidateDrawer } from './components/CandidateDrawer';
import { CandidatesTable } from './components/CandidatesTable';
import { ConvocatoriaTimeline } from './components/ConvocatoriaTimeline';
import { EligibilitySummary } from './components/EligibilitySummary';
import { ImportDialog } from './components/ImportDialog';
import { MultiSelect } from './components/MultiSelect';
import { Pagination } from './components/Pagination';
import { SearchInput } from './components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton } from './components/States';
import { buildIndex, paginate, runQuery, sortRows, type IndexedCandidate } from './filters/filterEngine';
import { countActiveFilters, type ListKey } from './filters/filterState';
import { useFilterState } from './filters/useFilterState';
import { useCandidates } from './hooks/useCandidates';

const CSV_COLUMNS: CsvColumn<IndexedCandidate>[] = [
  { header: 'Código', value: (r) => r.candidate.code },
  { header: 'Apellidos', value: (r) => r.candidate.lastNames },
  { header: 'Nombres', value: (r) => r.candidate.firstNames },
  { header: 'DNI', value: (r) => r.candidate.dni },
  { header: 'Correo', value: (r) => r.candidate.email },
  { header: 'Celular', value: (r) => r.candidate.phone },
  { header: 'Carrera', value: (r) => (r.candidate.career === 'OTRA' ? r.candidate.careerName : CAREER_LABEL[r.candidate.career]) },
  { header: 'Universidad', value: (r) => r.candidate.university },
  { header: 'Año', value: (r) => r.candidate.studyYear },
  { header: 'Resultado', value: (r) => ELIGIBILITY_LABEL[r.evaluation.eligibility] },
  { header: 'Puntaje', value: (r) => r.evaluation.score },
  { header: 'Etapa', value: (r) => STAGE_LABEL[r.candidate.stage] },
  { header: 'Requisitos no cumplidos', value: (r) => r.evaluation.checks.filter((c) => c.status === 'NO_CUMPLE' && c.mandatory).map((c) => c.detail).join(' | ') },
  { header: 'Observaciones', value: (r) => r.evaluation.warnings.join(' | ') },
  { header: 'Notas', value: (r) => r.candidate.notes },
];

const FILTERS: { key: ListKey; label: string; options: { value: string; label: string }[] }[] = [
  { key: 'careers', label: 'Carrera', options: CAREERS },
  { key: 'stages', label: 'Etapa', options: STAGES },
  { key: 'years', label: 'Año', options: STUDY_YEARS },
  { key: 'shifts', label: 'Turno', options: SHIFTS },
  { key: 'failing', label: 'No cumple', options: REQUIREMENTS.map((r) => ({ value: r.value, label: REQUIREMENT_SHORT[r.value] })) },
];

export function CandidatesPage({ repository }: { repository: CandidateRepository }) {
  const today = useMemo(() => todayIso(), []);
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null);
  const notifyError = useCallback((text: string) => setToast({ text, tone: 'error' }), []);
  const load = useCandidates(repository, notifyError);
  const [filters, dispatch] = useFilterState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 1) Evaluación de requisitos: solo cuando cambian los datos.
  const index = useMemo(() => (load.data ? buildIndex(load.data) : []), [load.data]);
  // 2) Filtrado + orden diferidos: la UI nunca se bloquea mientras se escribe.
  const deferred = useDeferredValue(filters);
  const { rows, facets } = useMemo(() => runQuery(index, deferred), [index, deferred]);
  const sorted = useMemo(() => sortRows(rows, deferred.sortKey, deferred.sortDir), [rows, deferred.sortKey, deferred.sortDir]);
  const page = paginate(sorted, filters.page, filters.pageSize);
  const warningsCount = useMemo(() => runQuery(index, { ...deferred, onlyWarnings: true }).rows.length, [index, deferred]);

  const selected = selectedId ? index.find((r) => r.candidate.id === selectedId) ?? null : null;
  const hasData = load.data !== null;
  const activeCount = countActiveFilters(filters);
  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const closeImport = useCallback(() => setImporting(false), []);

  const handleImport = async (candidates: Parameters<typeof load.importMany>[0]) => {
    const n = await load.importMany(candidates);
    setToast({ text: n === 1 ? '1 postulante importado y evaluado.' : `${n} postulantes importados y evaluados.`, tone: 'ok' });
    return n;
  };

  return (
    <div className="page">
      <header className="page__header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">P</span>
          <div>
            <p className="page__eyebrow">Pacsi Ingenieros S.A.C. · Reclutamiento</p>
            <h1 className="page__title">
              {CONVOCATORIA.name} <span className="page__subtitle">Filtro de postulantes</span>
            </h1>
          </div>
        </div>
        <div className="page__actions">
          <button type="button" className="btn btn--secondary" onClick={load.reload} disabled={load.status === 'loading'}>
            {load.status === 'loading' && hasData ? 'Actualizando…' : 'Actualizar'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => setImporting(true)} disabled={!hasData}>
            Importar CVs
          </button>
          <button type="button" className="btn btn--primary" disabled={!sorted.length} onClick={() => downloadCsv(`becarios-2027-${today}.csv`, toCsv(sorted, CSV_COLUMNS))}>
            Exportar ({sorted.length.toLocaleString('es-PE')})
          </button>
        </div>
      </header>

      <ConvocatoriaTimeline today={today} />

      <EligibilitySummary
        counts={facets.eligibility}
        warnings={warningsCount}
        selected={filters.eligibility}
        onlyWarnings={filters.onlyWarnings}
        loading={!hasData}
        onToggle={(value) => dispatch({ type: 'toggle', key: 'eligibility', value })}
        onToggleWarnings={() => dispatch({ type: 'setOnlyWarnings', value: !filters.onlyWarnings })}
      />

      <section className="card" aria-label="Postulantes">
        <div className="toolbar">
          <SearchInput value={filters.query} onChange={(query) => dispatch({ type: 'setQuery', query })} />
          <div className="toolbar__filters">
            {FILTERS.map((f, i) => (
              <MultiSelect
                key={f.key}
                label={f.label}
                options={f.options}
                selected={filters[f.key] as string[]}
                counts={facets[f.key]}
                onChange={(values) => dispatch({ type: 'setList', key: f.key, values })}
                align={i >= FILTERS.length - 2 ? 'end' : 'start'}
              />
            ))}
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
            <CandidatesTable
              rows={page.items}
              sortKey={filters.sortKey}
              sortDir={filters.sortDir}
              busy={deferred !== filters || load.status === 'loading'}
              selectedId={selectedId}
              onSort={(key) => dispatch({ type: 'sortBy', key })}
              onSelect={setSelectedId}
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
          {hasData ? `${sorted.length} postulantes encontrados` : ''}
        </p>
      </section>

      {selected && <CandidateDrawer row={selected} onClose={closeDrawer} onUpdate={load.update} />}
      {importing && load.data && <ImportDialog existing={load.data} today={today} onImport={handleImport} onClose={closeImport} />}
      {toast && (
        <div className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
