import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  eyebrow?: string;
  variant?: 'drawer' | 'modal' | 'viewer' | 'wide';
  onClose: () => void;
  children: ReactNode;
  header?: ReactNode;
}

/** Contenedor modal accesible (Escape para cerrar, foco inicial y devolución del foco). */
export function Dialog({ title, eyebrow, variant = 'modal', onClose, children, header }: DialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className={variant} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header className="dialog__header">
          <div>
            {eyebrow && <p className="dialog__eyebrow">{eyebrow}</p>}
            <h2 id="dialog-title" className="dialog__title">{title}</h2>
            {header}
          </div>
          <button ref={closeRef} type="button" className="btn btn--ghost dialog__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="dialog__body">{children}</div>
      </div>
    </>
  );
}
