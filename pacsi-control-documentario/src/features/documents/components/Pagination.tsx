import { PAGE_SIZES } from '../filters/filterState';

interface PaginationProps {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

/** Números de página compactos: 1 … 4 5 6 … 20 */
function pageWindow(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1]! > 1 ? (['…', p] as const) : [p]));
}

export function Pagination({ page, totalPages, start, end, total, pageSize, onPage, onPageSize }: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Paginación">
      <span className="pagination__info">
        {start.toLocaleString('es-PE')}–{end.toLocaleString('es-PE')} de <strong>{total.toLocaleString('es-PE')}</strong>
      </span>
      <div className="pagination__pages">
        <button type="button" className="btn btn--ghost" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
          ‹
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="pagination__gap">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`btn btn--ghost ${p === page ? 'is-current' : ''}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className="btn btn--ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Página siguiente">
          ›
        </button>
      </div>
      <label className="pagination__size">
        Filas
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
