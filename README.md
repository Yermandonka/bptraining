# Quahog Debate Club · plan de entrenamiento BP

App personal y offline para entrenar debate BP de noviembre de 2026 a junio de 2027.

[Abrir el plan de Germán](https://yermandonka.github.io/bptraining/app/) · [Abrir el plan de JP](https://yermandonka.github.io/bptraining/app/?perfil=jp)

Los dos perfiles siguen las mismas fases y el mismo calendario inicial de torneos. Cada perfil guarda su progreso y sus ajustes en el navegador. JP puede vincular su Google Doc de casefile desde **Ajustes → Mi casefile**. Para abrir el perfil de JP desde una copia local, añade `?perfil=jp` a la URL de `app/index.html` o cambia de perfil desde **Ajustes → Datos**.

Desde el 21 de noviembre de 2026, el perfil de Germán propone una sesión de 45 minutos por día de entrenamiento. El lunes se dedica a leer EL PAÍS. Los descansos siguen en el calendario y el material complementario está disponible en **Semana**.

El perfil de JP enlaza al manual oficial en línea. Para las lecturas en PDF de Debateca, coloca la carpeta `Debateca 2026` en la raíz de una copia local del repositorio y abre la app desde esa copia.

## Abrir la app

1. Abre `app/index.html` con doble clic (Chrome o Firefox). No hace falta servidor ni internet para el plan; los vídeos de YouTube sí necesitan conexión.
2. Todo el progreso se guarda en el navegador (localStorage). Usa siempre el mismo navegador en el mismo ordenador, o exporta/importa el JSON desde **Ajustes** para cambiar de equipo.
3. En el móvil: copia la carpeta `app/` al teléfono y abre `index.html`, o sube la carpeta a cualquier hosting estático (GitHub Pages, Vercel) y ábrela desde el navegador.

## Qué hay dentro

- **Hoy**: tareas del día con checks, cronómetros de prep (15') y discurso (7'), rúbrica del reto de los viernes, pendientes de la semana, próximo torneo y el punto débil en el que estás.
- **Semana**: los cinco días, el foco de la semana y el botón **"Esta semana no puedo"** (reparte lo importante en las tres semanas siguientes; se puede deshacer).
- **Calendario**: noviembre → junio, por fases, con torneos.
- **Casefile** (sin pestaña propia) enlaza al Google Doc desde las tareas. Germán apunta los hallazgos de la lectura del lunes en la ficha durante los últimos cinco minutos. En el plan de JP, la sesión del lunes combina EL PAÍS, un vídeo explicativo y la ficha. Cada tema cuenta como ficha (20 XP, dos logros) al marcar su tarea.
- **Progreso**: XP, nivel, racha, logros, gráfico de speaks por torneo (histórico de bpringaos + los que registres), registro de torneos (autopsia) y el **resumen para Claude**.
- **Juez**: hoja de ruta trainee → panel → principal, examen de nivel examen real (86 preguntas tipo CMUDE 2021/2022 y CED VI: mini-casos y selección múltiple, 15 por intento, a pantalla completa, con historial de notas en Progreso) y talleres de adjudicación.
- **Psico**: Tarjeta de sala (se guarda sola), registro de diálogo interno y las 13 sesiones.
- **Biblioteca**: 470 talleres y 492 debates grabados de Debateca con buscador, y el botón "debate sorpresa".
- **Ajustes**: fechas de torneos (las de 2027 son estimadas; cámbialas cuando salgan), exportar/importar, borrar.

## Cómo pedir feedback a Claude

Cada pocas semanas y después de cada torneo:

1. Graba tus discursos en el torneo (todos).
2. En **Progreso → Registrar torneo** mete speaks, puesto, nota de ejecución y aprendizajes.
3. **Ajustes → Exportar progreso** (o "Copiar resumen").
4. Abre Claude Code en esta carpeta, pega el resumen o el JSON, deja los audios en `audios/` y pide: *"analiza estos discursos y ajusta el plan"*. Claude lee `HANDOFF.md`, transcribe con `tools/transcribe/`, compara con `ANALISIS_DISCURSOS.md` y edita `app/data.js`.

## Documentos en bonito

Los `.md` se ven mal en un visor de texto. Hay versiones HTML con el estilo de la app en `docs/` (`docs/ANALISIS_DISCURSOS.html`, `docs/README.html`, `docs/HANDOFF.html`), enlazadas desde Ajustes. Si editas un `.md`, regenera con:

```bash
python3 tools/md2html.py
```

## Editar el plan a mano

- `app/data.js`: fases, torneos, semanas (taller, debate del miércoles, drill, viernes, prep de 7/10/15 min), temas del casefile (`CASEFILE_TOPICS` y `CASEFILE_PLAN`), sus vídeos explicativos (`CASEFILE_VIDEOS`), la carga diaria (`CONFIG.cargaLigeraDesde`), sesiones psicológicas, examen, mociones de reto, niveles y logros.
- `app/library.js`: generado desde las hojas de Debateca. No editar a mano.
- `app/engine.js`: lógica (fechas, generación de tareas, replanificación, XP). Se puede probar con Node.
- `app/app.js` y `app/styles.css`: interfaz.

## Probar

```bash
cd app && node --check engine.js && node --check app.js
```

Test de interfaz (Playwright + Chrome, no necesario para usar la app):

```bash
node tools/e2e.mjs
```
