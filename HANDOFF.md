# HANDOFF — estado del proyecto bptraining

> Si retomas este proyecto en una sesión nueva: lee este archivo primero, luego `app/data.js` (si existe).
> Última actualización: 2026-11-10 (sesión 3).

## Qué es
App personal de planificación de entrenamiento de debate BP para Germán (nov 2026 → jun 2027), con:
calendario diario, checks de tareas, gamificación, pista de juez, pista psicológica, sesión semanal de EL PAÍS,
replanificación al "avisar" de una semana perdida, export/import de progreso (JSON) para feedback.
Estética oscura inspirada en Padre de Familia. Objetivos: break + media 77 spks, cultura general, gestión psicológica,
pasar de trainee a juez principal, preparar 2026/27 y CMUDE 2027 Barcelona. Estrategia tipo "lo que hacen los experimentados".

## Hecho hasta ahora
- [x] Inventario: 12 audios m4a (11 válidos; "UAM 2" está vacío, 1 s), Manual CMUDE 2026 (80 pp), Debateca 2026 (xlsx + pdf + pptx).
- [x] Manual extraído a texto (scratchpad). Secciones clave leídas: tabla de oradoras (Apéndice A), errores de juez (3.4), feedback a juezas (Apéndice B), 2.4 refutación, 2.11 extensionista, 2.12 látigo.
- [x] Debateca volcada a TSV (scratchpad): ~900 debates con link YT, ~550 talleres, exámenes de jueces (CMUDE 2021/2022 en texto).
- [x] Baseline XI BP UAM (23–25 oct 2026): Germán 39/100, spks 68-74-75-74-75-73 (media 73,17). Mediana torneo 73; p75 77,5; p90 80. Equipo "UCM-COM LA RACHEL Y EL YERMAN" 19/50, 9 pts (1,3,3,4,3,1).
  Mociones UAM: carne procesada (UE), ambivalencia, ciencia vs preferencias ciudadanas, lamentar inversión IA generativa, protestas juveniles vs partidos, deuda externa privada vs doméstica, "Beyond Me", comunidades de inmortales.
- [x] Herramienta de transcripción: `tools/transcribe/transcribe.mjs` (Node 22 + @huggingface/transformers whisper + ffmpeg-static). Python aquí NO tiene pip/venv.
  Uso: `cd tools/transcribe && node transcribe.mjs onnx-community/whisper-small ../../transcripciones "/ruta/absoluta/al/audio.m4a" ...`
- [x] Transcribir los 11 audios → `transcripciones/*.txt` (11/11)
- [x] Analizar discursos → `ANALISIS_DISCURSOS.md` (UAM + Ahuja completos; volcado a `app/data.js` en WEAKNESSES, drills S1–S3 y rúbrica del reto)
- [x] Currículo semanal (33 semanas) → `app/data.js`
- [x] App construida: `app/index.html` + `app.js` + `engine.js` + `styles.css` + `data.js` + `library.js`. Probada con Node (engine) y Playwright (23 checks OK, sin errores de consola). README.md escrito.
- [x] Sesión 1 cerrada. No se ha borrado nada: la app enlaza PDFs de Debateca y el Manual con rutas relativas (`../Debateca 2026/...`) y la Semana 0 enlaza los audios/transcripciones. Si se quiere liberar espacio, borrar sólo `Debateca 2026/Biblioteca de Documentos de Debate/PPTs de Talleres de Debates` y `Biblioteca Escolar - WSDC` (no enlazados).

## Próxima sesión (cuando Germán mande feedback)
1. Leer el JSON/resumen exportado desde la app y los audios nuevos en `audios/`.
2. Transcribir (`tools/transcribe`), comparar con `ANALISIS_DISCURSOS.md` (sección "Qué cambia en el plan") y anotar mejoras/empeoramientos.
3. Ajustar `app/data.js`: WEAKNESSES, drills de las semanas que quedan, fechas de torneos; `node --check` y abrir `app/index.html`.
4. Posible mejora pendiente: publicar la app como artefacto/hosting para el móvil (el estado vive en localStorage por dispositivo).

## Cambios de última hora (sesión 1)
- Semana 0 de arranque (mié 4 – vie 6 nov 2026) añadida como `W(0, {custom:{...}})` en `app/data.js`; fase 'F00'. El motor soporta `spec.custom` (días con tareas explícitas). Semana 1 sigue el lunes 9 para no desalinear los torneos.
- Bug corregido: módulo negativo en `viewHoy` para la semana 0 (la app se quedaba en "Cargando el club…").
- E2E: 31 comprobaciones (incluye fecha real sin parámetro `?today`).

## Revisión 2 (misma sesión, a petición de Germán)
- Preps variables: `fri.prep` (7/10/15) y `wed.prep` en `app/data.js`; el motor y los cronómetros los leen (`t.prep`). Drills con prep de 5 min en S6, S9 y S13.
- Criterio de talleres: nada básico ni genérico. Sustituidos: S5, S10, S14, S17, S19, S25–S29 (temáticos fijos: Roig aranceles, Ponce UE, Jarufe religión, Samaniego electoral, Miulescu IA), S30 (Metamétricas), S31, S33 (Ranked pairs, Fernanda Roig) y tres extras de juez. Ya no hay `pickCat`.

## Revisión 3 (casefile, misma sesión)
- Pestaña Casefile (`viewCasefile` en app.js): 27 temas (`CASEFILE_TOPICS`), plan semana→tema (`CASEFILE_PLAN`, 'rev' en semanas de torneo, null en ligeras), textarea por tema en `state.casefile[id]`, cuenta como ficha ≥ 80 caracteres (20 XP), export `.md`, logros case10/case27.
- Lunes: tarea EL PAÍS incluye el tema y sus preguntas; jueves desde S13 (cuando no hay manual): "Ficha exprés" 20′ (drill baja a 40′).

## Revisión 4 (visual + docs, misma sesión)
- Fondo por capas en `index.html` (`.sky`: glows que respiran, dos capas de estrellas en deriva, parpadeo, skyline SVG, dos neones, viñeta) con parallax suave de ratón (app.js) y `prefers-reduced-motion`.
- Animaciones: entrada escalonada al cambiar de pestaña (`#view[data-anim]`), apertura suave de tareas (grid-template-rows, wrapper `.tinner`), pop + confeti al marcar (`#fx`), brillo de la barra de XP, overlay de subida de nivel (`levelUp`), hover en tarjetas/días/botones, latido del cronómetro en el último minuto.
- Bug corregido: `background: color gradient` inválido (el fondo no se aplicaba); ahora `background-color` + `background-image`.
- Docs: `tools/md2html.py` genera `docs/*.html` con el estilo de la app; enlazados desde Ajustes y desde la tarea de la Semana 0. Regenerar tras editar un .md.

## Revisión 5 (misma sesión)
- Tacos: NUNCA penalizar (decisión de Germán). Muletillas y "eeeh" sí: programa "Tom Tucker" de 2 semanas (S0 jue/vie + S1 lun/mar/jue/vie, tipo `estilo`) y mantenimiento 5′ los lunes S2–S6 (prio 3). Mecanismo: `spec.add = {dia:[tareas]}` y `spec.mins` en data.js (engine `addExtra`).
- El test de interfaz vive ahora en `tools/e2e.mjs` (Playwright, canal chrome): `node tools/e2e.mjs`.

## Revisión 6 (sesión 2, 2026-11-05): examen de juez
- Banco nuevo `QUIZ` en `app/data.js`: 86 preguntas (bloque 1: 1–43; bloque 2: 44–86, añadido en la misma sesión) al nivel de los exámenes reales de la Debateca (CMUDE 2021/2022, CED VI; textos extraídos con `pdftotext` al scratchpad). Mini-casos por moción, selección múltiple (`multi:true`, `a` = array de índices), todo o nada por pregunta, opciones barajadas. 15 por intento, aprobado 80 % (sin cambiar logros ni plan).
- Modo examen a pantalla completa (`body.exam`): se oculta la cabecera, se atenúa el cielo, pregunta centrada en 820 px, teclas a–h / Enter. Código: `quizView`, `quizCheck`, `quizFinish` y acciones `quiz-*` en `app.js`; estilos al final de `styles.css`.
- Historial de notas: `state.quiz.history[]` ({fecha, score, correct, total, fallos[secciones]}), migración en `engine.js`; curva + lista + "secciones que más fallas" en Progreso; últimas notas en Juez; incluido en el resumen de texto. E2E actualizado.

- Quitadas de la pestaña Juez (a petición de Germán) las tarjetas «Adjudicación en la sombra» y «Torneos juzgados», con sus formularios, acciones, logros juez5/juez12, XP asociado y líneas del resumen. La tarea de miércoles «Juez en la sombra» sigue, pero se hace por escrito fuera de la app. `state.logs.juez`/`juezTorneos` se conservan en el estado por compatibilidad de export/import.

- Nota del examen: `best`/`attempts` se recalculan siempre desde `quiz.history` (migración y `quizRecount`). Así el intento perfecto del examen antiguo (sin historial) desaparece. Botón «borrar» por intento en Progreso (`quiz-del`).

- Perfil y XP: `LEVELS` tiene `icon` y `rango` (sala baja → campeón del mundo). `E.stats` devuelve `bd` (desglose por fuente), `weekXp` (últimos 7 días), `bestStreak`; XP del examen = mejor×0,5 + 4/intento (máx. 25); bonus de racha 3/día (máx. 30). Cabecera: `.profile` (avatar con anillo de progreso, enlaza a Progreso). Progreso: `profileCard()` (nums, barra apilada de fuentes, escalera de niveles).
- Fondo: PNG con transparencia de 8 personajes en `app/img/` (descargados de en.wikipedia.org, uso personal), colocados en `.sky .cast` (`index.html`, posición `--x` y altura `--h` por imagen), opacidad 0,36, saturación/brillo reducidos, brillo neón suave, máscara de desvanecido arriba, parallax leve, ocultos en modo examen. `LEVELS[].img` da la cara del nivel en el avatar de cabecera, en la tarjeta de perfil, en la escalera y en el overlay de subida de nivel. Joe y El Pollo Gigante siguen con emoji (no se encontró PNG transparente).

## Revisión 7 (sesión 3, 2026-11-10): documentales para el casefile y carga ligera
- `CASEFILE_VIDEOS` en `app/data.js`: 2 documentales de YouTube por tema (54, sin repetir, cada uno con `tema` concreto, `min` real y canal; casi todos de DW Documental, DW Cómo te afecta y ARTE.tv). Comprobados con oEmbed el 2026-11-10. Si alguno cae, cambiar el enlace y `min` ahí.
- Lunes: la tarea `W{n}-mon-elpais` (mismo id y tipo, para no perder progreso) pasa a ser «Documental + ficha de casefile»: ver el primer vídeo del tema y escribir la ficha con lo que salga. EL PAÍS se mantiene como primer paso fijo de 15 min (Germán pidió no quitarlo); la ficha baja a 10 min. Semanas `rev` y ligeras no cambian.
- Martes: en las semanas con `doc:true` (S1, S2, S3, S4, S6, S9: los talleres más básicos) se ve el segundo documental (`W{n}-tue-doc`, tipo `casefile`) y el taller pasa a extra opcional (`W{n}-xt`). En el resto de semanas el segundo documental es un extra opcional (`W{n}-xdoc`).
- Pestaña Casefile: cada ficha lista sus documentales (`.cfvids`).
- Carga ligera (petición de Germán: no completaba ni un día): `CONFIG.cargaLigeraDesde = '2026-11-10'`. Desde ese día `M(día, antes, ahora)` en `buildWeek` acorta las tareas (taller 55→40, miércoles 60→45, drill 40→30, manual 20→15, ficha exprés 20→15, reto 50→40, retro 10→5, psico 60→45, pre-torneo 30→20; tareas `add` ×0,75). Día normal: unos 45 min en vez de 60. El XP se multiplica por 4/3 en esos días para que subir de nivel cueste lo mismo. Para aflojar o apretar más, tocar los segundos valores de `M(...)`.

## Revisión 8 (2026-11-10): casefile en Google Docs
- Germán escribe el casefile en un Google Doc: `R.casefileDoc` en `app/data.js` (cambiar ahí la URL si cambia de documento). Enlazado en la pestaña Casefile y en todas las tareas de casefile (lunes, martes-documental, jueves).
- Por ficha: `state.casefileDoc[id] = { done, url }`. `done` (casilla «Escrita en mi Google Doc») cuenta como ficha (`casefileDone` en engine.js: 20 XP, logros, resumen); `url` es el enlace opcional al título de ese tema dentro del Doc. El textarea de la app queda como notas rápidas opcionales.
- La app no lee el contenido del Doc (es estática y el Doc es privado). El conector de Drive de Claude dio «not found» con ese archivo el 2026-11-10: para que Claude lo revise hay que compartirlo o exportarlo.

- Temática de los documentales (petición de Germán, 2026-11-10): cada vídeo cubre un subtema literal de `Debateca 2026/.../TEMAS PARA EL CASEFILE.pdf`; `tema` guarda número y nombre (p. ej. «27.10 Comercio internacional»). Ese PDF no tiene sección de relaciones internacionales: la ficha `rrii` usa 17.2 y 5.5. Al añadir o cambiar vídeos, elegir primero el subtema del PDF.

## Revisión 9 (2026-11-10): sin pestaña Casefile
- Germán pidió quitar la pestaña Casefile (escribe en su Google Doc). Eliminados `viewCasefile`, la ruta, las acciones `cf-*` y los enlaces «Pestaña Casefile» de las tareas; `#casefile` cae en Hoy. Los estilos `.cf*` de `styles.css` quedan sin uso.
- Las fichas (20 XP, logros case10/case27, resumen) cuentan ahora al marcar una tarea de casefile de la semana del tema (`casefileDone` en engine.js: lunes `-mon-elpais`, martes `-tue-doc`, jueves `-thu-casefile`, S0). Las semanas `rev` no cuentan. `state.casefile` y `state.casefileDoc` se conservan por compatibilidad.
- Los documentales y el enlace al Google Doc (`R.casefileDoc`) viven sólo en las tareas; `CASEFILE_TOPICS`/`CASEFILE_PLAN`/`CASEFILE_VIDEOS` siguen en data.js.

## Revisión 10 (2026-11-10): arranque recolocado
- Germán no empezó el plan hasta el 10 nov. `MOVES` en `app/data.js` (id → fecha) reparte las 10 tareas de la Semana 0 entre el 11 nov y el 1 dic, una por día (el 1 dic, reto + retro), acortadas ×0,75; `applyMoves` en engine.js las mueve salvo que ya estuvieran hechas antes de `MOVES_DESDE`. El lunes 9 no se movió (petición suya) ni el martes 10. Para recolocar otra tarea: añadir su id y la fecha nueva.
- Ojo: «Tom Tucker V» (vie 13) compara con la línea base de «Tom Tucker I», que ahora cae el mar 17; la comparación real se hará en los retos siguientes.

## Decisiones de diseño
- App estática sin servidor ni cuentas (segura y estable): estado en localStorage + export/import JSON.
- Datos del plan en `app/data.js` (JS, no fetch, para funcionar con file://).
- Calendario de torneos España (patrón 2025/2026): Murcia (feb), Comunícate UCM (feb), Regenta (mar), Complu (mar), GAD-UAB (abr), SEPI (jun), PreCMUDE UAM (jun), Round Robin Hispanohablante (jul, virtual), CND España (sep), Granada (oct), UAM (oct), Elías Ahuja (oct/nov), URJC (nov).

## Dudas pendientes para Germán
- Torneo "Colegio Mayor Elías Ahuja" (~30 oct–1 nov 2026): ¿link del tab (calicotab)? ¿resultado y spks?
- ¿Fechas confirmadas de torneos 2027 a los que irá? (la app permite editarlas)

## Revisión 11 (2026-11-11): vídeos explicativos en vez de documentales
- Germán encontró genéricos los documentales de DW/ARTE (ejemplo suyo: «Globalización: cómo las crisis están cambiando el mundo») y pidió vídeos más explicativos y técnicos, como los de Memorias de Pez (su ejemplo de lo que sí: «La VERDADERA explicación del GRAN APAGÓN de ESPAÑA»). `CASEFILE_VIDEOS` se sustituyó entero: 54 vídeos nuevos de 7 a 29 min, 24 de Memorias de Pez/Tiburón y el resto de VisualPolitik/VisualEconomik, Kurzgesagt, Adictos a la Filosofía, Academia Play y similares. Comprobados con oEmbed el 2026-11-11.
- Criterio al cambiar o añadir: que explique el mecanismo de un problema o un caso concreto (por qué pasa, quién gana, qué incentivos), no una panorámica; y que cubra un subtema literal del PDF de Debateca (`tema`).
- Al ser más cortos, lunes y martes-documental duran menos (`vidMin`). Estructura, ids de tarea y XP no cambian. Los textos de las tareas siguen diciendo «documental».
- Temas donde no hay vídeo de ese estilo tan bueno y conviene revisar si aparece algo mejor: feminismo (22.13, reportaje de France 24), familia (Sprouts, muy básicos), arte, LGTBIQ+ y decisiones individuales.

