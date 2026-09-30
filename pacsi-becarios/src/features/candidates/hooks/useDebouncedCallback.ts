import { useEffect, useMemo, useRef } from 'react';

/** Devuelve una versión con retardo de `fn`; se cancela automáticamente al desmontar. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delayMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return useMemo(() => {
    const debounced = (...args: A) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delayMs);
    };
    debounced.cancel = () => clearTimeout(timer.current);
    return debounced;
  }, [delayMs]);
}
