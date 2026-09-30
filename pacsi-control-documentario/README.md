# Control documentario de flota · Pacsi Ingenieros S.A.C.

Módulo de filtrado y gestión de documentos vehiculares (SOAT, revisión técnica, pólizas,
certificados MTC/MATPEL, tarjetas de propiedad) de las unidades de Hagemsa, Servosa y la flota propia.

```bash
npm install
npm run dev        # http://localhost:5173 (datos simulados)
npm test           # pruebas unitarias de la lógica de filtrado
npm run build      # typecheck + build de producción en dist/
```

- `?simularError=1` fuerza un error de carga para ver la UI de fallo.
- Para conectar la API real, copia `.env.example` a `.env` y define `VITE_API_URL`
  (se espera `GET {VITE_API_URL}/documentos` → `FleetDocument[]`).

## 1. Diseño UI/UX

| Zona | Qué resuelve |
|---|---|
| **Indicadores por estado** (Vencido / Por vencer / En trámite / Vigente) | Muestran de un vistazo lo urgente y **son filtros**: un clic filtra por ese estado. Los conteos reflejan los demás filtros activos. |
| **Búsqueda global** | En tiempo real, sin tildes ni mayúsculas, varios términos con AND (`hagemsa soat`). Encuentra placas escritas sin guion (`abc123` → `ABC-123`). Atajo `/` para enfocarla y `Esc` para limpiarla. |
| **Filtros desplegables** | Empresa y tipo de documento (multiselección con conteo por opción), y rango de fechas por vencimiento o emisión, con atajos rápidos (7/30/90 días). |
| **Chips de filtros activos** | Cada filtro aplicado se ve y se quita con un clic; también se puede "Limpiar todo". |
| **Tabla** | Cabecera fija, orden por columna (`aria-sort`), filas marcadas por severidad, vencimiento relativo ("hace 12 días", "vence mañana"), navegable con teclado. En móvil se muestra como tarjetas. |
| **Panel de detalle** | Clic o Enter en una fila abre el detalle sin perder el contexto del listado. |
| **Estados** | Skeleton en la carga inicial, tabla atenuada al recalcular o recargar, estado vacío con acción, error con reintento y aviso de "datos desactualizados" si falla una recarga. |
| **Exportar CSV** | Exporta exactamente lo filtrado y ordenado (separador `;` y BOM para Excel es-PE). |

Los filtros viven en la URL (`?estado=VENCIDO&empresa=HAGEMSA&q=soat`): una vista se puede
compartir por enlace, sobrevive a recargas y funciona con atrás/adelante.

## 2. Arquitectura

```
src/
├── domain/                 Reglas de negocio puras (sin React)
│   ├── types.ts            Modelo FleetDocument
│   ├── catalogs.ts         Empresas, tipos, estados + etiquetas
│   └── status.ts           Única regla de estado (vencido / por vencer / trámite / vigente)
├── lib/                    Utilidades genéricas: fechas, texto, CSV, PRNG
├── services/               Acceso a datos detrás de la interfaz DocumentRepository
│   ├── httpRepository.ts   API real (fetch + AbortSignal + errores tipados)
│   ├── mockRepository.ts   Datos simulados con latencia y error opcional
│   └── index.ts            Composición: elige la implementación según el entorno
└── features/documents/
    ├── filters/
    │   ├── filterState.ts  Estado, reducer y (de)serialización a la URL
    │   ├── filterEngine.ts Índice de búsqueda, filtrado + facetas, orden, paginación
    │   └── useFilterState.ts
    ├── hooks/              useDocuments (carga/cancelación/reintento), debounce
    ├── components/         Componentes de presentación
    └── DocumentsPage.tsx   Composición de la pantalla
```

### Flujo de datos y rendimiento

```
Repository ──► useDocuments ──► buildIndex (1 vez por carga)
                                     │
URL ⇄ useFilterState ──► useDeferredValue ──► runQuery (1 pasada O(n): filas + conteos por faceta)
                                                   └─► sortRows ──► paginate ──► tabla (solo 25–100 filas en el DOM)
```

- **Índice precalculado**: estado, días para vencer y texto normalizado se calculan una sola vez
  por carga, no en cada tecla.
- **Una sola pasada**: `runQuery` filtra y calcula los conteos de cada faceta a la vez. Cada
  conteo aplica todos los filtros menos el suyo, así el usuario sabe cuántos resultados obtendría.
- **UI que no se bloquea**: el input usa estado local con debounce (180 ms) y el cálculo pesado
  pasa por `useDeferredValue`.
- **Paginación** en lugar de pintar miles de filas. Si en el futuro hace falta, `runQuery` se puede
  mover al servidor sin tocar la UI, porque el contrato `Criteria` ya está separado.

### Decisiones

- **React + TypeScript estricto + Vite**: estándar de la industria, build rápido y tipos que
  protegen el modelo de datos.
- **Sin librería de UI ni de estado**: CSS con variables (tema claro/oscuro automático) y un
  `useReducer`. Menos dependencias, bundle de ~77 kB gzip.
- **Lógica pura y probada**: el dominio y el motor de filtros no dependen de React y están
  cubiertos por pruebas en Vitest (`*.test.ts`).
- **Seguridad en la URL**: los parámetros se validan contra los catálogos; los valores
  manipulados se descartan.

## Próximos pasos sugeridos

1. Conectar el endpoint real y definir si el filtrado pasa al servidor (a partir de ~20k registros).
2. Acciones sobre el documento: marcar "en trámite", adjuntar el PDF renovado, historial.
3. Vistas guardadas por usuario ("Mis vencimientos de Hagemsa").
4. Alertas automáticas (correo/WhatsApp) para los documentos que vencen en 7 días o menos.
