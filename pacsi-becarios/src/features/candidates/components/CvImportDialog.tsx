import { useState } from 'react';
import type { ImportSummary } from '../../../cv/importCvs';
import { Dialog } from './Dialog';

interface CvImportDialogProps {
  /** Lee los archivos y devuelve el resumen (los postulantes ya quedan guardados). */
  onImport: (files: File[], onProgress: (m: string) => void) => Promise<ImportSummary>;
  onClose: () => void;
}

const ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/msword';

/** Subir CVs (PDF, Word o fotos): el programa los lee y evalúa solo. */
export function CvImportDialog({ onImport, onClose }: CvImportDialogProps) {
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (list: FileList | File[]) => {
    const files = [...list];
    if (!files.length) return;
    setError(null);
    setSummary(null);
    setProgress('Preparando…');
    try {
      setSummary(await onImport(files, setProgress));
    } catch (e) {
      setError((e as Error).message || 'No se pudieron leer los archivos.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog title="Subir CVs" eyebrow="PDF, Word o foto del CV" onClose={progress ? () => undefined : onClose}>
      {!progress && !summary && (
        <>
          <p className="dialog__lead">
            Seleccione los CVs descargados del correo (puede elegir muchos a la vez). El programa lee cada uno, saca los datos y
            revisa los requisitos. Lo que no encuentre quedará marcado como <strong>"por revisar"</strong>.
          </p>
          <label
            className="dropzone dropzone--big"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void run(e.dataTransfer.files);
            }}
          >
            <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files && void run(e.target.files)} />
            <span className="dropzone__icon" aria-hidden="true">⤒</span>
            <strong>Arrastre aquí los CVs o haga clic para elegirlos</strong>
            <span className="muted">Los CVs escaneados también se leen (tarda un poco más)</span>
          </label>
        </>
      )}

      {progress && (
        <div className="progress" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>{progress}</span>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      {summary && <ImportResultView summary={summary} />}

      {!progress && (
        <div className="dialog__actions">
          {summary && (
            <label className="btn btn--secondary">
              Subir más
              <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files && void run(e.target.files)} />
            </label>
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {summary ? 'Ver resultados' : 'Cancelar'}
          </button>
        </div>
      )}
    </Dialog>
  );
}

export function ImportResultView({ summary, extra }: { summary: ImportSummary; extra?: React.ReactNode }) {
  const n = summary.created.length;
  return (
    <div className="import-result">
      <p className="result-big">
        <strong>{n}</strong> {n === 1 ? 'postulante nuevo leído y evaluado' : 'postulantes nuevos leídos y evaluados'}
      </p>
      {summary.ocrUsed > 0 && <p className="muted">{summary.ocrUsed} CV(s) escaneado(s) leídos con OCR: conviene revisarlos.</p>}
      {extra}
      {summary.skipped.length > 0 && (
        <details className="skipped" open>
          <summary>{summary.skipped.length} archivo(s) no se leyeron — motivo:</summary>
          <ul>
            {summary.skipped.map((s, i) => (
              <li key={i}>
                <strong>{s.name}:</strong> {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
