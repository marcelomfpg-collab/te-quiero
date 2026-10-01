# Becarios PACSI 2027-A · Filtro de postulantes

Programa de **Pacsi Ingenieros S.A.C.** para la convocatoria de practicantes **Becarios PACSI 2027-A**:

1. **Baja los CVs del correo** de reclutamiento (conexión IMAP, la misma que usa Outlook) o los recibe
   arrastrando los PDF/Word.
2. **Lee cada CV solo, gratis y sin internet**: PDF normales y de dos columnas, CVs escaneados (OCR) y Word.
3. **Revisa los requisitos del aviso** y marca a cada postulante como **Apto**, **Por revisar** o **No apto**,
   mostrando la frase del CV de donde salió cada dato.
4. Lleva el **proceso por etapas** hasta los resultados.

## Descargar el programa

👉 **https://github.com/marcelomfpg-collab/te-quiero/releases/latest**

| Archivo | Para quién |
|---|---|
| `Becarios-PACSI-Instalador-….exe` | Windows: se instala con acceso directo en el escritorio *(recomendado)* |
| `Becarios-PACSI-Portable-….exe` | Windows sin instalar: doble clic y listo (sirve desde un USB) |
| `Becarios-PACSI-Navegador-….html` | Cualquier computadora: se abre con doble clic en Chrome o Edge, sin internet |

Si Windows muestra "Windows protegió su PC": **Más información → Ejecutar de todas formas**
(el programa no tiene firma digital comercial).

**Los datos se guardan en la computadora donde se usa.** Para respaldarlos o pasarlos a otra PC:
**Más → Copia de seguridad** y luego, en la otra PC, **Más → Restaurar copia de seguridad**.

Cada vez que se cambia el código, GitHub Actions (`.github/workflows/becarios-programa.yml`) prueba,
fabrica y publica una nueva versión en esa misma página.

## Para desarrolladores

```bash
npm install
npm run dev        # versión web en http://localhost:5173
npm run app        # abre el programa de escritorio
npm test           # pruebas: reglas, lector de CVs, importación, guardado y filtros
npm run build      # genera dist/index.html (un único archivo, funciona sin servidor)
npm run dist:win   # instalador de Windows en release/ (ejecutar en Windows)
```

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

1. **Recibir CVs**:
   - **📥 Revisar correo** (programa de escritorio): la primera vez se configura el servidor IMAP, usuario y
     contraseña (se guarda cifrada con Windows). Baja solo los correos nuevos cuyo asunto contiene "BECARIOS",
     con todos sus adjuntos (CV + certificados), y puede revisar el buzón automáticamente cada 15 minutos.
     Nunca duplica: recuerda los correos ya procesados y detecta DNIs repetidos.
   - **Subir CVs (PDF)**: arrastrar los archivos descargados (PDF, Word .docx o fotos).
   - También: **＋ Nuevo** (formulario) o **Más → Importar desde Excel**.
2. **Lectura automática del CV** (`src/cv/`), sin IA ni servicios de pago:
   - Nombre y carrera desde el **asunto del correo** (`BECARIOS 2027 - APELLIDO NOMBRE - CARRERA`).
   - DNI, celular, correo, universidad (catálogo de universidades del sur del Perú), ciudad (Arequipa y sus
     distritos; ignora calles como "Av. Arequipa" de Lima), ciclo o año ("VIII ciclo" = 4° año), egresado o
     estudiante, brevete y categoría, Excel/ofimática certificada, carrera técnica (SENATI, Tecsup…),
     **meses de experiencia** sumando las fechas de la sección de experiencia ("Ene 2024 – Jun 2024",
     "03/2025 - Presente"; superposiciones contadas una vez) y certificados de trabajo adjuntos.
   - PDF de dos columnas: se detectan las columnas para no mezclar secciones. CVs escaneados: OCR en español
     incluido en el programa (Tesseract), sin internet.
   - **Lo que no encuentra no descarta a nadie**: queda **🔍 por revisar** con la frase del CV como evidencia,
     y se confirma con un clic (✓ Sí cumple / ✕ No cumple) o con **Corregir datos**.
3. **Filtrar**: tarjetas Aptos / Por revisar / No aptos / Con observaciones, búsqueda y filtros por carrera,
   etapa, año, turno y "No cumple".
4. **Evaluar**: ver el CV original dentro del programa, calificar habilidades blandas (1–5, en la
   entrevista), mover la etapa y dejar notas. Un "No apto" no puede pasar a Entrevista.
5. **Exportar** a Excel lo filtrado.

## Arquitectura

```
src/
├── cv/                      Lector de CVs: texto de PDF/Word/OCR, reglas de extracción, importación de correo
├── domain/                  Reglas de negocio puras (sin React), 100 % probadas
│   ├── convocatoria.ts      Parámetros y cronograma de la convocatoria
│   ├── eligibility.ts       Evaluación de requisitos, resultado y puntaje
│   ├── subject.ts           Validación del asunto del correo
│   ├── catalogs.ts / types.ts
├── services/                Acceso a datos detrás de CandidateRepository
│   ├── localRepository.ts   Guarda los postulantes en la computadora (uso actual)
│   ├── httpRepository.ts    Para un futuro servidor central (varios reclutadores)
│   ├── backup.ts            Copia de seguridad / restauración en JSON
│   ├── mockData.ts          180 postulantes ficticios ("Cargar datos de ejemplo")
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

**Escritorio:** `electron/main.cjs` abre el mismo `dist/index.html` en una ventana propia; `electron/mail.cjs`
se conecta al buzón por IMAP (imapflow + mailparser) y `scripts/copy-ocr.cjs` incluye el OCR en el instalador. **Servidor central (futuro):** definir `VITE_API_URL` (ver `.env.example`); la
UI no cambia, porque solo depende de la interfaz `CandidateRepository`.

## Próximos pasos sugeridos

- Backend con base de datos y usuarios (quién calificó o movió a cada postulante).
- Copia de seguridad que incluya también los archivos PDF (hoy guarda los datos).
- Agenda de entrevistas (23/11 al 11/12) y envío de resultados por correo el 15/12.
