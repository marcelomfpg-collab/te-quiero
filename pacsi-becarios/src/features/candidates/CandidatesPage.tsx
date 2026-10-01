import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CAREER_LABEL, CAREERS, ELIGIBILITY_LABEL, REQUIREMENT_SHORT, REQUIREMENTS, SHIFTS, STAGE_LABEL, STAGES, STUDY_YEARS } from '../../domain/catalogs';
import { CONVOCATORIA } from '../../domain/convocatoria';
import { downloadCsv, downloadFile, toCsv, type CsvColumn } from '../../lib/csv';
import { todayIso } from '../../lib/dates';
import type { Candidate } from '../../domain/types';
import type { CandidateRepository } from '../../services';
import { fromBackup, toBackup } from '../../services/backup';
import { generateMockCandidates } from '../../services/mockData';
import { clearProcessedIds, importCvFiles, syncMailbox, type MailSyncSummary } from '../../cv/importCvs';
import { fileStore } from '../../lib/fileStore';
import type { CandidateFile } from '../../domain/types';
import { ActiveFilters } from './components/ActiveFilters';
import { CandidateDrawer } from './components/CandidateDrawer';
import { CandidateForm } from './components/CandidateForm';
import { CandidatesTable } from './components/CandidatesTable';
import { CvImportDialog, ImportResultView } from './components/CvImportDialog';
import { Dialog } from './components/Dialog';
import { FileViewer } from './components/FileViewer';
import { MailDialog } from './components/MailDialog';
import { ConvocatoriaTimeline } from './components/ConvocatoriaTimeline';
import { EligibilitySummary } from './components/EligibilitySummary';
import { ImportDialog } from './components/ImportDialog';
import { MultiSelect } from './components/MultiSelect';
import { Pagination } from './components/Pagination';
import { Popover } from './components/Popover';
import { SearchInput } from './components/SearchInput';
import { EmptyState, ErrorState, TableSkeleton, WelcomeState } from './components/States';
import { buildIndex, paginate, runQuery, sortRows, type IndexedCandidate } from './filters/filterEngine';
import { countActiveFilters, type ListKey } from './filters/filterState';
import { useFilterState } from './filters/useFilterState';
import { messageOf, useCandidates } from './hooks/useCandidates';

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
  /** null = cerrado, 'new' = alta, o el postulante que se edita. */
  const [form, setForm] = useState<'new' | Candidate | null>(null);
  const [cvImporting, setCvImporting] = useState(false);
  const [viewing, setViewing] = useState<CandidateFile | null>(null);
  const [mailSettings, setMailSettings] = useState(false);
  const [sync, setSync] = useState<{ progress: string | null; summary: MailSyncSummary | null; error?: string } | null>(null);
  /** El correo solo se puede conectar desde el programa de escritorio. */
  const desktop = typeof window !== 'undefined' && !!window.pacsiDesktop;
  const [mailConfig, setMailConfig] = useState<{ autoCheckMinutes: number } | null>(null);

  const refreshMailConfig = useCallback(() => {
    void window.pacsiDesktop?.mail.getConfig().then((c) => setMailConfig(c && c.hasPassword ? { autoCheckMinutes: c.autoCheckMinutes } : null));
  }, []);
  useEffect(refreshMailConfig, [refreshMailConfig]);

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
  const closeForm = useCallback(() => setForm(null), []);
  const isEmpty = load.data?.length === 0;

  const saveCandidate = async (candidate: Candidate) => {
    if (form === 'new') {
      await load.create(candidate);
      setToast({ text: `${candidate.firstNames} agregado(a). Resultado calculado automáticamente.`, tone: 'ok' });
    } else {
      await load.update(candidate.id, candidate);
    }
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (!window.confirm(`¿Eliminar a ${selected.fullName}? Esta acción no se puede deshacer.`)) return;
    for (const f of selected.candidate.files ?? []) void fileStore.remove(f.id).catch(() => undefined);
    void load.remove(selected.candidate.id);
    setSelectedId(null);
  };

  const replaceData = async (candidates: Candidate[], message: string) => {
    try {
      await load.replaceAll(candidates);
      dispatch({ type: 'reset' });
      setToast({ text: message, tone: 'ok' });
    } catch (error) {
      notifyError(messageOf(error, 'No se pudo completar la operación.'));
    }
  };

  const loadSample = () => {
    if (load.data?.length && !window.confirm('Esto reemplaza los datos actuales por 180 postulantes de ejemplo. ¿Continuar?')) return;
    void replaceData(generateMockCandidates(today), 'Se cargaron 180 postulantes de ejemplo.');
  };

  const clearAll = () => {
    if (!window.confirm('¿Borrar TODOS los postulantes y CVs de esta computadora? Haga antes una copia de seguridad.')) return;
    void fileStore.clear().catch(() => undefined);
    clearProcessedIds();
    void replaceData([], 'Se borraron todos los postulantes.');
  };

  const restoreBackup = (file: File) => {
    file
      .text()
      .then((text) => {
        const candidates = fromBackup(text);
        if (!window.confirm(`La copia tiene ${candidates.length} postulantes y reemplazará los datos actuales. ¿Continuar?`)) return;
        void replaceData(candidates, `Copia restaurada: ${candidates.length} ${candidates.length === 1 ? "postulante" : "postulantes"}.`);
      })
      .catch((error: unknown) => notifyError(messageOf(error, 'No se pudo leer la copia de seguridad.')));
  };

  const importCvs = async (files: File[], onProgress: (m: string) => void) => {
    const summary = await importCvFiles(files, load.data ?? [], today, onProgress);
    if (summary.created.length) await load.importMany(summary.created);
    return summary;
  };

  const checkMail = useCallback(
    async (silent = false) => {
      if (!window.pacsiDesktop || sync?.progress) return;
      if (!silent) setSync({ progress: 'Conectando con el correo…', summary: null });
      try {
        const summary = await syncMailbox(load.data ?? [], today, (m) => !silent && setSync({ progress: m, summary: null }));
        if (summary.created.length) await load.importMany(summary.created);
        if (silent) {
          if (summary.created.length) setToast({ text: `📥 ${summary.created.length} CV(s) nuevos del correo, ya evaluados.`, tone: 'ok' });
        } else setSync({ progress: null, summary });
      } catch (error) {
        const message = messageOf(error, 'No se pudo revisar el correo.');
        if (silent) notifyError(message);
        else setSync({ progress: null, summary: null, error: message });
      }
    },
    [load, today, sync?.progress, notifyError],
  );

  // Revisión automática del correo mientras el programa está abierto.
  useEffect(() => {
    if (!mailConfig?.autoCheckMinutes || !hasData) return;
    const timer = setInterval(() => void checkMail(true), mailConfig.autoCheckMinutes * 60_000);
    return () => clearInterval(timer);
  }, [mailConfig, hasData, checkMail]);

  const openMail = () => (mailConfig ? void checkMail() : setMailSettings(true));

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
          {desktop && (
            <button type="button" className="btn btn--primary" onClick={openMail} disabled={!hasData || !!sync?.progress}>
              📥 {mailConfig ? 'Revisar correo' : 'Conectar correo'}
            </button>
          )}
          <button type="button" className={`btn ${desktop ? 'btn--secondary' : 'btn--primary'}`} onClick={() => setCvImporting(true)} disabled={!hasData}>
            Subir CVs (PDF)
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => setForm('new')} disabled={!hasData}>
            ＋ Nuevo
          </button>
          <button type="button" className="btn btn--secondary" disabled={!sorted.length} onClick={() => downloadCsv(`becarios-2027-${today}.csv`, toCsv(sorted, CSV_COLUMNS))}>
            Exportar ({sorted.length.toLocaleString('es-PE')})
          </button>
          <Popover label="Más" align="end" closeOnSelect>
            <div className="menu">
              {desktop && (
                <button type="button" className="menu__item" onClick={() => setMailSettings(true)}>
                  Configurar correo
                  <span className="muted">Servidor, contraseña y revisión automática</span>
                </button>
              )}
              <button type="button" className="menu__item" disabled={!hasData} onClick={() => setImporting(true)}>
                Importar desde Excel
                <span className="muted">Con la plantilla CSV</span>
              </button>
              <button type="button" className="menu__item" disabled={!load.data?.length} onClick={() => load.data && downloadFile(`copia-becarios-2027-${today}.json`, toBackup(load.data), 'application/json')}>
                Copia de seguridad
                <span className="muted">Descarga todos los datos en un archivo</span>
              </button>
              <label className="menu__item">
                Restaurar copia de seguridad
                <span className="muted">Desde un archivo descargado antes</span>
                <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) restoreBackup(f); }} />
              </label>
              <button type="button" className="menu__item" onClick={loadSample}>
                Cargar datos de ejemplo
                <span className="muted">180 postulantes ficticios</span>
              </button>
              <button type="button" className="menu__item menu__item--danger" disabled={!load.data?.length} onClick={clearAll}>
                Borrar todos los datos
              </button>
            </div>
          </Popover>
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
        {!isEmpty && (
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

        )}
        <ActiveFilters state={filters} dispatch={dispatch} />

        {load.status === 'error' && hasData && (
          <div className="banner banner--warning" role="status">
            No se pudo actualizar ({load.message}). Se muestran los últimos datos cargados.
            <button type="button" className="btn btn--link" onClick={load.reload}>
              Reintentar
            </button>
          </div>
        )}

        {isEmpty ? (
          <WelcomeState
            onMail={desktop ? openMail : undefined}
            onUpload={() => setCvImporting(true)}
            onAdd={() => setForm('new')}
            onSample={loadSample}
          />
        ) : !hasData && load.status === 'error' ? (
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

      {selected && !form && (
        <CandidateDrawer row={selected} onClose={closeDrawer} onUpdate={load.update} onEdit={() => setForm(selected.candidate)} onDelete={deleteSelected} onViewFile={setViewing} />
      )}
      {form && load.data && (
        <CandidateForm initial={form === 'new' ? undefined : form} existing={load.data} today={today} onSave={saveCandidate} onClose={closeForm} />
      )}
      {cvImporting && <CvImportDialog onImport={importCvs} onClose={() => setCvImporting(false)} />}
      {mailSettings && (
        <MailDialog
          onClose={() => setMailSettings(false)}
          onSaved={() => {
            setMailSettings(false);
            refreshMailConfig();
            void checkMail();
          }}
        />
      )}
      {sync && (
        <Dialog title="Revisar correo" eyebrow="Buzón de reclutamiento" onClose={sync.progress ? () => undefined : () => setSync(null)}>
          {sync.progress && (
            <div className="progress" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>{sync.progress}</span>
            </div>
          )}
          {sync.error && (
            <>
              <p className="form-error" role="alert">{sync.error}</p>
              <button type="button" className="btn btn--link" onClick={() => { setSync(null); setMailSettings(true); }}>Revisar la configuración del correo</button>
            </>
          )}
          {sync.summary && (
            <ImportResultView
              summary={sync.summary}
              extra={
                <>
                  <p className="muted">{sync.summary.checked} correo(s) nuevo(s) revisado(s).</p>
                  {sync.summary.withoutCv.length > 0 && (
                    <details className="skipped">
                      <summary>{sync.summary.withoutCv.length} correo(s) sin CV adjunto</summary>
                      <ul>{sync.summary.withoutCv.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </details>
                  )}
                </>
              }
            />
          )}
          {!sync.progress && (
            <div className="dialog__actions">
              <button type="button" className="btn btn--primary" onClick={() => setSync(null)}>Listo</button>
            </div>
          )}
        </Dialog>
      )}
      {viewing && <FileViewer file={viewing} onClose={() => setViewing(null)} />}
      {importing && load.data && <ImportDialog existing={load.data} today={today} onImport={handleImport} onClose={closeImport} />}
      {toast && (
        <div className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
