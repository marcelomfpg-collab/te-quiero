# Becarios PACSI 2027-A · Filtro de postulantes

Herramienta interna de **Pacsi Ingenieros S.A.C.** para evaluar los CVs de la convocatoria de
practicantes preprofesionales **Becarios PACSI 2027-A** contra los requisitos del aviso oficial,
ordenar a los candidatos y llevar el proceso hasta los resultados.

```bash
npm install
npm run dev        # http://localhost:5173 (datos de demostración)
npm test           # 45 pruebas de reglas de negocio, importación y filtros
npm run build      # typecheck + build de producción en dist/
```

Parámetros útiles en la URL: `?reiniciar` borra los cambios guardados de la demo y
`?simularError=1` muestra la pantalla de error.

## Reglas de la convocatoria (fuente: aviso oficial)

Todas viven en [`src/domain/convocatoria.ts`](src/domain/convocatoria.ts); para la próxima
convocatoria basta con editar ese archivo.

| Requisito | Tipo | Regla aplicada |
|---|---|---|
| Postuló dentro del plazo | Excluyente | CV recibido hasta el **31/10/2026** |
| Carrera convocada | Excluyente | Ing. Mecánica/Mecatrónica, Eléctrica, Industrial, Comercial o Administración |
| Últimos años | Excluyente | Cursa **3°, 4° o 5°** año |
| Brevete A-I o A-IIb | Excluyente | Se aceptan también A-IIa y A-III (exigen haber tenido la A-I). **No aplica a Administración** |
| Carrera técnica certificada | **Opcional** | No descarta; suma 15 puntos |
| Ofimática / Excel certificado | Excluyente | Certificado presentado |
| Habilidades blandas | Excluyente | Calificación del reclutador ≥ 3 de 5. Sin calificar → "Por evaluar" |
| Prácticas preprofesionales en Arequipa | Excluyente | Reside en Arequipa y busca prácticas **pre**profesionales |
| Experiencia laboral | Excluyente | **≥ 6 meses certificados** |

**Resultado:** *Apto* (cumple todo) · *Por evaluar* (cumple lo documentario, falta calificar
habilidades blandas) · *No apto* (incumple al menos un requisito excluyente, con el motivo exacto).

**Observaciones** (no descartan, pero se marcan): asunto del correo que no sigue
`BECARIOS 2027 - APELLIDO Y NOMBRE - CARRERA PROFESIONAL`, DNI inválido o duplicado, correo inválido.

**Puntaje (0–100)**, solo para ordenar a los aptos: experiencia 35 (tope 24 meses), habilidades
blandas 30, año de carrera 20, carrera técnica 15. El desglose se ve en el detalle de cada postulante.

## Flujo de trabajo del reclutador

1. **Importar CVs**: descargar la plantilla CSV, llenar una fila por CV recibido en
   reclutamiento@pacsiingenieros.com y subirla. El sistema valida cada fila (DNI, brevete,
   fechas DD/MM/AAAA…), indica en qué fila de Excel está cada error y omite los DNI repetidos.
2. **Filtrar**: las tarjetas Aptos / Por evaluar / No aptos / Con observaciones son filtros de un
   clic. Hay búsqueda en tiempo real por nombre, DNI, correo o universidad, y filtros por carrera,
   etapa, año, turno y **"No cumple"** (p. ej. todos los que fallan por brevete). Cada opción
   muestra cuántos postulantes daría.
3. **Evaluar**: en el detalle se ve el checklist de requisitos con el motivo, se califican las
   habilidades blandas (1–5), se mueve la etapa (Recibido → En evaluación → Entrevista →
   Seleccionado / Descartado) y se dejan notas. Un "No apto" no puede pasar a Entrevista ni a
   Seleccionado.
4. **Exportar** a CSV exactamente lo filtrado, con resultado, puntaje, motivos y notas (listo para Excel).

Los filtros quedan en la URL, así que una vista se puede compartir por enlace
(p. ej. `?elegibilidad=APTO&carrera=INDUSTRIAL`).

## Arquitectura

```
src/
├── domain/                  Reglas de negocio puras (sin React), 100 % probadas
│   ├── convocatoria.ts      Parámetros y cronograma de la convocatoria
│   ├── eligibility.ts       Evaluación de requisitos, resultado y puntaje
│   ├── subject.ts           Validación del asunto del correo
│   ├── catalogs.ts / types.ts
├── services/                Acceso a datos detrás de CandidateRepository
│   ├── mockRepository.ts    Demo: datos generados + cambios guardados en el navegador
│   ├── httpRepository.ts    API real: GET/PATCH /postulantes, POST /postulantes/importar
│   └── csvImport.ts         Planilla CSV → postulantes validados
├── lib/                     Utilidades: CSV, fechas, texto sin tildes
└── features/candidates/
    ├── filters/             Estado ⇄ URL, motor de filtrado con facetas, orden y paginación
    ├── hooks/               Carga con cancelación y reintento, actualizaciones optimistas
    ├── components/          Tabla, panel de detalle, importación, filtros, estados
    └── CandidatesPage.tsx
```

**Rendimiento:** la evaluación de requisitos se calcula una vez por cambio de datos. El filtrado
y los conteos de todas las facetas salen de una sola pasada, la búsqueda usa debounce y
`useDeferredValue`, y solo se dibujan 25–100 filas por página.

**Conexión a un backend real:** definir `VITE_API_URL` en `.env` (ver `.env.example`). La UI no
cambia, porque solo depende de la interfaz `CandidateRepository`.

## Próximos pasos sugeridos

- Backend con base de datos y usuarios (quién calificó o movió a cada postulante).
- Leer automáticamente los correos del buzón de reclutamiento y adjuntar el CV en PDF.
- Agenda de entrevistas (23/11 al 11/12) y envío de resultados por correo el 15/12.
