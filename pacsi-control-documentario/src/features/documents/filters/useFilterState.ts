import { useEffect, useReducer } from 'react';
import { filtersReducer, parseFilters, serializeFilters, type FilterAction, type FilterState } from './filterState';

/**
 * Estado de filtros con la URL como fuente de verdad persistente:
 * se puede recargar, compartir el enlace o usar atrás/adelante sin perder la vista.
 */
export function useFilterState(): [FilterState, React.Dispatch<FilterAction>] {
  const [state, dispatch] = useReducer(filtersReducer, window.location.search, parseFilters);

  useEffect(() => {
    const query = serializeFilters(state);
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, '', next);
    }
  }, [state]);

  useEffect(() => {
    const onPopState = () => dispatch({ type: 'replace', state: parseFilters(window.location.search) });
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return [state, dispatch];
}
