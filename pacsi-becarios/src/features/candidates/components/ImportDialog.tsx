import { useState } from 'react';
import { downloadCsv } from '../../../lib/csv';
import { importCandidatesCsv, templateCsv, type ImportResult } from '../../../services/csvImport';
import type { Candidate } from '../../../domain/types';
import { Dialog } from './Dialog';

interface ImportDialogProps {
  existing: Candidate[];
  today: string;
  onImport: (candidates: Candidate[]) => Promise<number>;
  onClose: () => void;
}

/** Importa la planilla CSV que RR. HH. llena a partir de los CVs recibidos por correo. */
export function ImportDialog({ existing, today, onImport, onClose }: ImportDialogProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = async (file: File) => {
    setError(null);
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError('Guarde la planilla de Excel como "CSV UTF-8 (delimitado por comas)" e inténtelo de nuevo.');
      return;
    }
    setFileName(file.name);
    setResult(
      importCandidatesCsv(await file.text(), {
        existingDnis: new Set(existing.map((c) => c.dni)),
        today,
        nextIndex: existing.length,
      }),
    );
  };

  const confirm = async () => {
    if (!result?.candidates.length) return;
    setSaving(true);
    try {
      await onImport(result.candidates);
      onClose();
    } catch {
      setError('No se pudo guardar la importación. Inténtelo nuevamente.');
      setSaving(false);
    }
  };

  return (
    <Dialog title="Importar postulantes" eyebrow="Planilla CSV / Excel" onClose={onClose}>
      <ol className="steps">
        <li>
          Descargue la{' '}
          <button type="button" className="btn btn--link" onClick={() => downloadCsv('plantilla-becarios-2027.csv', templateCsv())}>
            plantilla CSV
          </button>{' '}
          y ábrala en Excel.
        </li>
        <li>Registre una fila por cada CV recibido en el correo de reclutamiento.</li>
        <li>Guárdela como CSV y súbala aquí. Los requisitos se evalúan solos.</li>
      </ol>

      <label
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void readFile(file);
        }}
      >
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
        <strong>{fileName ?? 'Arrastre el archivo o haga clic para elegirlo'}</strong>
        <span className="muted">Separador ";" o ","</span>
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      {result && (
        <div className="import-result" aria-live="polite">
          {result.missingColumns.length > 0 ? (
            <p className="form-error">Faltan columnas obligatorias: {result.missingColumns.join(', ')}.</p>
          ) : (
            <>
              <p>
                <strong>{result.candidates.length}</strong> {result.candidates.length === 1 ? 'postulante listo' : 'postulantes listos'} para importar
                {result.duplicates > 0 && <> · {result.duplicates} omitidos por DNI ya registrado</>}
                {result.errors.length > 0 && <> · {result.errors.length} {result.errors.length === 1 ? 'fila' : 'filas'} con errores</>}
              </p>
              {result.errors.length > 0 && (
                <ul className="import-errors">
                  {result.errors.slice(0, 20).map((err) => (
                    <li key={err.row}>
                      <strong>Fila {err.row}:</strong> {err.messages.join('; ')}
                    </li>
                  ))}
                  {result.errors.length > 20 && <li>… y {result.errors.length - 20} más</li>}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div className="dialog__actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="btn btn--primary" disabled={!result?.candidates.length || saving} onClick={confirm}>
          {saving ? 'Importando…' : `Importar ${result?.candidates.length ?? ''}`}
        </button>
      </div>
    </Dialog>
  );
}
