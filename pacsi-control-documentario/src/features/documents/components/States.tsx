export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="Cargando documentos">
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
      <h2 className="state__title">{hasFilters ? 'Ningún documento coincide con los filtros' : 'Aún no hay documentos registrados'}</h2>
      <p className="state__text">
        {hasFilters ? 'Prueba con otra búsqueda o quita algunos filtros.' : 'Cuando se registren documentos aparecerán aquí.'}
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
      <h2 className="state__title">No se pudieron cargar los documentos</h2>
      <p className="state__text">{message}</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
