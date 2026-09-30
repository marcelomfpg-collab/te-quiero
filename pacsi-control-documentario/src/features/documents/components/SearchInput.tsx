import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  delayMs?: number;
}

/**
 * El input responde al instante (estado local) y el filtro se aplica con debounce,
 * así escribir nunca se siente lento aunque haya miles de filas.
 * Atajo: "/" enfoca la búsqueda; Escape la limpia.
 */
export function SearchInput({ value, onChange, delayMs = 180 }: SearchInputProps) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebouncedCallback(onChange, delayMs);

  // Sincroniza cuando el valor cambia desde fuera (p. ej. "Limpiar filtros").
  useEffect(() => setText(value), [value]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const update = (next: string) => {
    setText(next);
    debounced(next);
  };

  const clear = () => {
    debounced.cancel();
    setText('');
    onChange('');
  };

  return (
    <div className="search">
      <svg className="search__icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        className="search__input"
        placeholder="Buscar por placa, código, N° de documento, emisor o responsable…"
        aria-label="Buscar documentos"
        value={text}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && text && (e.preventDefault(), clear())}
      />
      {text ? (
        <button type="button" className="search__clear" onClick={clear} aria-label="Limpiar búsqueda">
          ×
        </button>
      ) : (
        <kbd className="search__kbd" aria-hidden="true">/</kbd>
      )}
    </div>
  );
}
