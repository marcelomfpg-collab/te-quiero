import { useCallback, useState } from 'react';
import { defaultCareerRules, normalizeRules, type CareerRules } from '../../../domain/careerRules';
import { DEMO } from '../../../demo';

const KEY = 'pacsi-becarios-2027a:requisitos-por-carrera';

function read(): CareerRules {
  if (DEMO) return defaultCareerRules();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeRules(JSON.parse(raw)) : defaultCareerRules();
  } catch {
    return defaultCareerRules();
  }
}

/** Requisitos por carrera definidos por RR. HH. (guardados en la computadora; en la versión de prueba, solo en memoria). */
export function useCareerRules() {
  const [rules, setRules] = useState<CareerRules>(read);
  const save = useCallback((next: CareerRules) => {
    const normalized = normalizeRules(next);
    setRules(normalized);
    if (DEMO) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(normalized));
    } catch {
      /* sin almacenamiento: quedan activos hasta cerrar el programa */
    }
  }, []);
  return [rules, save] as const;
}
