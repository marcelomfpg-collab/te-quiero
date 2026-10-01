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
  onAdd: () => void;
  onImport: () => void;
  onSample: () => void;
}

/** Primera vez que se abre el programa: tres caminos claros para empezar. */
export function WelcomeState({ onAdd, onImport, onSample }: WelcomeStateProps) {
  return (
    <div className="welcome">
      <h2 className="welcome__title">Bienvenido al filtro de postulantes</h2>
      <p className="welcome__text">
        Registre los CVs que llegan al correo de reclutamiento. El programa revisa solo los requisitos de la convocatoria y le
        muestra quién es apto.
      </p>
      <div className="welcome__options">
        <button type="button" className="welcome__option" onClick={onAdd}>
          <span className="welcome__icon" aria-hidden="true">＋</span>
          <strong>Agregar un postulante</strong>
          <span className="muted">Llene un formulario con los datos del CV.</span>
        </button>
        <button type="button" className="welcome__option" onClick={onImport}>
          <span className="welcome__icon" aria-hidden="true">⤒</span>
          <strong>Importar desde Excel</strong>
          <span className="muted">Suba muchos postulantes a la vez con la plantilla.</span>
        </button>
        <button type="button" className="welcome__option" onClick={onSample}>
          <span className="welcome__icon" aria-hidden="true">▶</span>
          <strong>Ver un ejemplo</strong>
          <span className="muted">Cargue 180 postulantes ficticios para probar el programa.</span>
        </button>
      </div>
      <p className="muted">Los datos se guardan en esta computadora. Use "Más → Copia de seguridad" para respaldarlos.</p>
    </div>
  );
}
