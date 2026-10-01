export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="Cargando postulantes">
      <div className="skeleton-table">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton-row">
            <span className="skeleton" style={{ width: '5.5rem' }} />
            <span className="skeleton" style={{ width: '6rem' }} />
            <span className="skeleton" style={{ width: '9rem' }} />
            <span className="skeleton" style={{ width: '5rem' }} />
            <span className="skeleton" style={{ width: '7rem' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div className="state">
      <div className="state__icon" aria-hidden="true">⌕</div>
      <h2 className="state__title">{hasFilters ? 'Ningún postulante coincide con los filtros' : 'Aún no hay postulantes registrados'}</h2>
      <p className="state__text">
        {hasFilters ? 'Prueba con otra búsqueda o quita algunos filtros.' : 'Importe la planilla de CVs recibidos para empezar a evaluarlos.'}
      </p>
      {hasFilters && (
        <button type="button" className="btn btn--primary" onClick={onReset}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <div className="state__icon" aria-hidden="true">!</div>
      <h2 className="state__title">No se pudieron cargar los postulantes</h2>
      <p className="state__text">{message}</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

interface WelcomeStateProps {
  /** Solo en la versión de prueba. */
  onSamples?: () => void;
  samplesRunning?: boolean;
  /** Solo en el programa de escritorio. */
  onMail?: () => void;
  onUpload: () => void;
  onAdd: () => void;
  onSample: () => void;
}

/** Primera vez que se abre el programa: caminos claros para empezar. */
export function WelcomeState({ onSamples, samplesRunning, onMail, onUpload, onAdd, onSample }: WelcomeStateProps) {
  return (
    <div className="welcome">
      <h2 className="welcome__title">Bienvenido al filtro de postulantes</h2>
      <p className="welcome__text">
        El programa lee los CVs que llegan al correo de reclutamiento, revisa solo los requisitos de la convocatoria y le muestra
        quién es apto. Lo que no logre leer queda marcado para que usted lo revise.
      </p>
      <div className="welcome__options">
        {onSamples && (
          <button type="button" className="welcome__option welcome__option--main" onClick={onSamples} disabled={samplesRunning}>
            <span className="welcome__icon" aria-hidden="true">{samplesRunning ? '…' : '▶'}</span>
            <strong>{samplesRunning ? 'Leyendo CVs…' : 'Probar con 4 CVs de ejemplo'}</strong>
            <span className="muted">PDF y Word de prueba: vea qué detecta el lector.</span>
          </button>
        )}
        {onMail && (
          <button type="button" className="welcome__option welcome__option--main" onClick={onMail}>
            <span className="welcome__icon" aria-hidden="true">📥</span>
            <strong>Conectar el correo</strong>
            <span className="muted">Baja solo los CVs del buzón de reclutamiento.</span>
          </button>
        )}
        <button type="button" className={`welcome__option ${onMail || onSamples ? '' : 'welcome__option--main'}`} onClick={onUpload}>
          <span className="welcome__icon" aria-hidden="true">⤒</span>
          <strong>{onSamples ? 'Subir sus propios CVs' : 'Subir CVs en PDF'}</strong>
          <span className="muted">Elija los CVs descargados (muchos a la vez).</span>
        </button>
        {!onSamples && (
        <button type="button" className="welcome__option" onClick={onAdd}>
          <span className="welcome__icon" aria-hidden="true">＋</span>
          <strong>Agregar a mano</strong>
          <span className="muted">Llene un formulario con los datos.</span>
        </button>
        )}
        <button type="button" className="welcome__option" onClick={onSample}>
          <span className="welcome__icon" aria-hidden="true">▶</span>
          <strong>Ver un ejemplo</strong>
          <span className="muted">180 postulantes ficticios para probar.</span>
        </button>
      </div>
      {!onSamples && <p className="muted">Los datos y CVs se guardan en esta computadora. Use "Más → Copia de seguridad" para respaldarlos.</p>}
    </div>
  );
}
