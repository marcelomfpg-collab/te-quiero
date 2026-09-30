import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface PopoverProps {
  label: string;
  /** Número de selecciones activas, mostrado junto al botón. */
  count?: number;
  children: ReactNode;
  align?: 'start' | 'end';
}

/** Botón desplegable accesible: se cierra con Escape o clic fuera. */
export function Popover({ label, count = 0, children, align = 'start' }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="popover" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`btn btn--filter ${count > 0 ? 'is-active' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        {count > 0 && <span className="btn__count">{count}</span>}
        <svg className="btn__chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div id={panelId} className={`popover__panel popover__panel--${align}`}>
          {children}
        </div>
      )}
    </div>
  );
}
