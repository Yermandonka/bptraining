// ============================================================
//  engine.js — lógica pura (sin DOM). Se puede probar con Node:
//  node -e "global.window={};require('./data.js');require('./engine.js');..."
// ============================================================
(function (root) {
  const D = root.PLAN_DATA;

  // ---------- fechas ----------
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const dow = s => (parse(s).getDay() + 6) % 7; // 0=lunes … 6=domingo
  const mondayOf = s => addDays(s, -dow(s));
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const DAY_ES = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo' };
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fmtLong = s => { const d = parse(s); return `${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][dow(s)]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
  const fmtShort = s => { const d = parse(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`; };
  const todayISO = () => iso(new Date());

  function weekNumberFor(dateISO) {
    const start = parse(D.CONFIG.inicio); const d = parse(mondayOf(dateISO));
    const days = Math.round((d - start) / 864e5); // round: evita el desfase de 1 h del horario de verano
    return Math.floor(days / 7) + 1;
  }
  const weekStart = n => addDays(D.CONFIG.inicio, (n - 1) * 7);
  const phaseOf = n => D.PHASES.find(p => n >= p.semanas[0] && n <= p.semanas[1]) || D.PHASES[0];

  // ---------- recursos ----------
  function pickTaller(cat, n) {
    const lib = root.LIBRARY && root.LIBRARY.talleres || [];
    const xs = lib.filter(t => t.c === 'Temático · ' + cat);
    if (!xs.length) return null;
    const x = xs[(n * 3) % xs.length];
    return { t: x.t, u: x.u, b: x.b };
  }
  function debateInfo(url) {
    const lib = root.LIBRARY && root.LIBRARY.debates || [];
    const id = ytId(url);
    return lib.find(d => ytId(d.u) === id) || null;
  }
  function ytId(u) { const m = /(?:v=|youtu\.be\/)([\w-]{11})/.exec(u || ''); return m ? m[1] : null; }

  // ---------- construcción de tareas ----------
  const XP = { 1: 1.2, 2: 1.0, 3: 0.6 }; // multiplicador por prioridad
  function task(id, o) {
    const t = Object.assign({ id, min: 30, prio: 1, links: [], steps: [] }, o);
    t.xp = Math.round(t.min * XP[t.prio]);
    return t;
  }

  function buildWeek(spec, tournaments) {
    const n = spec.n, start = weekStart(n), phase = phaseOf(n);
    const days = { mon: [], tue: [], wed: [], thu: [], fri: [] };
    const extras = [];
    const tourn = tournaments.filter(t => t.inicio <= addDays(start, 6) && t.fin >= start);
    // Carga ligera: desde CONFIG.cargaLigeraDesde cada tarea dura menos. M(día, antes, ahora) elige los minutos.
    const lite = d => addDays(start, DAYS.indexOf(d)) >= (D.CONFIG.cargaLigeraDesde || '9999-12-31');
    const M = (d, antes, ahora) => lite(d) ? ahora : antes;
    const vidMin = v => Math.ceil(v.min / (v.min > 30 ? 1.5 : 1.25) / 5) * 5; // minutos reales viéndolo acelerado
    const vidTxt = v => `«${v.t}» (${v.b}, ${v.min} min${v.min > 30 ? '; ponlo a 1,5x' : '; puedes ponerlo a 1,25x'})`;

    if (spec.custom) {
      Object.keys(spec.custom).forEach(d => { (spec.custom[d] || []).forEach((o, i) => { const motion = o.type === 'reto' ? D.RETO_MOTIONS[(n * 7 + 3) % D.RETO_MOTIONS.length] : undefined; days[d].push(task(`W${n}-${d}-${o.type}${i}`, Object.assign({ motion, role: 'MG/MO' }, o))); if (motion) days[d][days[d].length - 1].steps = [`Moción: ${motion}.`].concat(o.steps || []); }); });
      (spec.extras || []).forEach((e, i) => extras.push(task(`W${n}-x${i}`, { type: 'extra', title: e.t, min: 40, prio: 3, by: e.b, desc: 'Extra opcional.', links: [{ t: e.t, u: e.u }] })));
      addExtra(spec, n, days);
      return { n, start, phase, spec, days, extras, tourn, light: false, custom: true };
    }
    if (spec.light) {
      days.mon.push(task(`W${n}-mon-elpais`, { type: 'elpais', title: 'EL PAÍS tranquilo', min: 30, prio: 2,
        desc: 'Lectura sin ficha. Sólo Internacional y Opinión. Si algo te parece una moción, apúntala.', links: [D.R.elpais] }));
      (spec.extras || []).forEach((e, i) => extras.push(task(`W${n}-x${i}`, { type: 'extra', title: e.t, min: 45, prio: 3, desc: 'Opcional. Modo Chris: palomitas y sin cronómetro.', links: [{ t: e.t, u: e.u }], by: e.b })));
      return { n, start, phase, spec, days, extras, tourn, light: true };
    }

    // LUNES — EL PAÍS + ficha de casefile del tema de la semana (día tranquilo)
    const cfId = D.CASEFILE_PLAN[n]; const cf = cfId && cfId !== 'rev' ? D.CASEFILE_TOPICS.find(x => x.id === cfId) : null;
    const vids = cf ? ((D.CASEFILE_VIDEOS || {})[cf.id] || []).slice().sort((a, b) => a.min - b.min) : []; // el lunes, el más corto
    const docMartes = !!(spec.doc && vids[1]); // el martes, documental en vez de taller básico
    if (cfId === 'rev') {
      days.mon.push(task(`W${n}-mon-elpais`, { type: 'elpais', title: 'EL PAÍS + revisión del casefile para el torneo', min: M('mon', 50, 35), prio: 1, topic: 'rev',
        desc: 'Semana de torneo: no se abre tema nuevo. Se leen las fichas que más probablemente salgan y se actualizan con la prensa de la semana.',
        steps: ['15 min de EL PAÍS: Internacional, Economía y Opinión. Apunta 3 hechos de la semana que puedan salir en una moción.', '20 min en tu casefile (Google Docs): relee las 4 fichas más probables para este torneo y añade los hechos nuevos.', 'Marca mentalmente qué ficha está más floja: ese es tu tema de lectura del domingo.'],
        links: [D.R.elpais, D.R.casefileDoc] }));
    } else if (vids[0]) {
      // Lunes con documental: el vídeo da la materia prima y la ficha se escribe con lo que salga de él.
      const v = vids[0];
      days.mon.push(task(`W${n}-mon-elpais`, { type: 'elpais', title: `EL PAÍS + documental + ficha de casefile: ${cf.nombre}`, min: M('mon', 50, 15 + vidMin(v) + 10), prio: 1, topic: cf.id, video: v,
        desc: `El lunes es tu día tranquilo: un rato de periódico, un documental sobre un subtema de la lista de Debateca (${v.tema}) y la ficha escrita con lo que saques de los dos. Tema de la semana: ${cf.nombre}.`,
        steps: ['15 min de EL PAÍS: Internacional, Economía y Opinión. Quédate con UNA noticia de fondo; si toca el tema de la semana, mejor.', `Ve ${vidTxt(v)}. Apunta mientras lo ves: 3 hechos con cifra o fecha, 2 actores (qué quieren, qué les limita) y el choque central.`,
          '10 min en tu casefile (Google Docs), ficha "' + cf.nombre + '": vuelca los apuntes del documental y la noticia, y responde al menos a UNA de estas preguntas:']
          .concat(cf.preguntas.map(q => '• ' + q))
          .concat(['Cierra con 1 moción que podría salir de este documental.']),
        links: [D.R.elpais, { t: `Documental: ${v.t} (${v.b})`, u: v.u }, D.R.casefileDoc, D.R.casefileTemas] }));
    } else {
      days.mon.push(task(`W${n}-mon-elpais`, { type: 'elpais', title: cf ? `EL PAÍS + ficha de casefile: ${cf.nombre}` : 'Sesión EL PAÍS + ficha de casefile', min: M('mon', 50, 40), prio: 1, topic: cf ? cf.id : null,
        desc: 'El lunes es tu día tranquilo: leer con intención y dejar escrita una ficha. Secciones: Internacional, Economía y Opinión.' + (cf ? ` Tema de la semana: ${cf.nombre}.` : ''),
        steps: ['20 min de lectura. Elige UNA noticia de fondo (no de última hora) relacionada con el tema de la semana si la hay.']
          .concat(cf ? ['20 min en tu casefile (Google Docs), ficha "' + cf.nombre + '". Responde al menos a una de estas preguntas:'].concat(cf.preguntas.map(q => '• ' + q)) : ['15 min de ficha: 3 hechos con fuente, 1 actor clave, 1 moción posible.']),
        links: [D.R.elpais, D.R.casefileDoc, D.R.casefilePlantilla] }));
    }
    days.mon.push(task(`W${n}-mon-plan`, { type: 'plan', title: `Semana ${n}: ${spec.theme}`, min: 5, prio: 2,
      desc: `Foco: ${spec.focus}. ${spec.special ? spec.special : ''}`.trim(),
      steps: ['Lee el foco de la semana y mira qué toca cada día.', 'Si no vas a poder, avisa con el botón "Esta semana no puedo" y se reparte lo importante.'] }));

    // MARTES — autopsia o taller
    if (spec.tue && spec.tue.kind === 'autopsia') {
      const t = tournaments.find(x => x.id === spec.tue.torneo);
      days.tue.push(task(`W${n}-tue-autopsia`, { type: 'autopsia', title: `Autopsia de ${t ? t.nombre : 'el torneo'}`, min: M('tue', 30, 20), prio: 1,
        desc: spec.tue.juez ? 'Autopsia como juez: en qué rondas fuiste trainee/panel, qué dijiste en deliberación y qué callaste.' : 'Registrar el torneo con speaks y aprendizajes. Es la base del feedback.',
        steps: spec.tue.juez
          ? ['Pestaña Juez → "Registrar torneo juzgado": rondas, rol en cada una, una discrepancia que tuviste con la principal.', 'Escribe 3 cosas que harías distinto en deliberación.', 'Exporta el progreso (Ajustes) y mándaselo a Claude.']
          : ['Pestaña Progreso → "Registrar torneo": speaks por ronda, puesto, resultado de equipo.', 'Escucha tus grabaciones: 3 aprendizajes y 1 regla.', 'Nota de ejecución (1–10) separada de la nota de resultado.', 'Exporta el progreso (Ajustes) y mándaselo a Claude con las grabaciones para ajustar el plan.'] }));
    }
    if (docMartes) {
      const v = vids[1];
      days.tue.push(task(`W${n}-tue-doc`, { type: 'casefile', title: `Documental para el casefile: ${v.tema}`, min: M('tue', 45, vidMin(v) + 10), prio: 1, topic: cf.id, video: v,
        desc: `Segundo documental de la semana para la ficha de ${cf.nombre}. Sustituye al taller básico: aquí lo que se gana es materia para argumentar.`,
        steps: [`Ve ${vidTxt(v)}. Apunta 3 hechos con cifra o fecha y 1 actor nuevo.`, 'Añádelos a la ficha de ' + cf.nombre + ' en tu casefile (Google Docs).', 'Escribe 1 moción que salga de este vídeo y el caso de Gobierno en 2 líneas. Con eso vale.'],
        links: [{ t: `Documental: ${v.t} (${v.b})`, u: v.u }, D.R.casefileDoc] }));
      if (spec.taller && spec.taller.u) extras.push(task(`W${n}-xt`, { type: 'extra', title: `Taller (opcional): ${spec.taller.t}`, min: 40, prio: 3, by: spec.taller.b, desc: 'El taller técnico que tocaba esta semana. Sólo si te sobra tiempo.', links: [{ t: spec.taller.t, u: spec.taller.u }] }));
    } else if (spec.taller) {
      let tl = spec.taller;
      if (tl.pickCat) tl = pickTaller(tl.pickCat, n) || { t: `Elige un taller temático de ${tl.pickCat} en la Biblioteca`, u: '', b: '' };
      days.tue.push(task(`W${n}-tue-taller`, { type: 'taller', title: `Taller: ${tl.t}`, min: M('tue', (spec.mins && spec.mins.taller) || (spec.tue ? 30 : 55), spec.tue ? 25 : 40), prio: 1, by: tl.b,
        desc: 'Ver con libreta. Un taller sin resumen es una serie.',
        steps: ['Ve el taller a 1,5x y sáltate la presentación y las preguntas del público. Pausa cuando el ponente dé una regla y apúntala literal.', 'Resumen de 3 líneas + UNA regla aplicable en tu próximo discurso.', 'Esa regla va al drill del jueves.'],
        links: tl.u ? [{ t: tl.t, u: tl.u }] : [] }));
    }

    // MIÉRCOLES — reconstrucción o juez en la sombra
    if (spec.wed) {
      const w = spec.wed; const info = debateInfo(w.u);
      const links = w.u ? [{ t: 'Ver el debate', u: w.u }] : [];
      if (w.extra) links.push({ t: `Taller corto: ${w.extra.t} (${w.extra.b})`, u: w.extra.u });
      if (w.kind === 'rebuild') {
        const prep = w.prep || 15;
        days.wed.push(task(`W${n}-wed-rebuild`, { type: 'rebuild', title: `Reconstrucción · ${w.role}${prep < 15 ? ` · prep ${prep}′` : ''}`, min: M('wed', 60, 45), prio: 1, motion: w.m, role: w.role, prep,
          desc: 'El método de los que mejoran: dar el discurso antes que el orador real y compararte.' + (prep < 15 ? ` Esta vez con ${prep} minutos de prep: decide la tesis en los 2 primeros.` : ''),
          steps: [`Moción: ${w.m}.`, `Ve el debate a 1,5x hasta justo antes del discurso de ${w.role}. Pausa.`, `${prep} min de prep (cronómetro de la app). Graba tu discurso de 7 min.`, 'Ve el discurso real. Tabla de 3 columnas: qué hizo que yo no / qué hice yo que no hizo / qué haría la próxima vez.', 'El resto del debate no hace falta verlo.'],
          links, info }));
      } else {
        days.wed.push(task(`W${n}-wed-judge`, { type: 'judge', title: 'Juez en la sombra', min: M('wed', 60, 45), prio: 1, motion: w.m, pick: !!w.pick,
          desc: 'Adjudicar un debate real por escrito y compararte con el panel. Cada dos semanas, sin excusas: así se sale de trainee.',
          steps: [w.pick ? 'Elige en Biblioteca un debate con resultado conocido que no hayas visto.' : `Moción: ${w.m}.`, 'Ve el debate completo a 1,5x tomando notas como juez (flow por equipo y por choque).', 'Por escrito (cuaderno o notas): ranking y la razón de las dos comparativas más ajustadas. Speaks sólo del mejor y del peor discurso.', 'Revela el resultado real. Si difiere: ¿qué vio el panel que tú no, o al revés? Escríbelo.', w.extra ? `Remata con el taller corto: ${w.extra.t}.` : 'Relee Manual 3.4 (errores habituales) 5 min.'],
          links, info }));
      }
    }

    // JUEVES — drill + manual / lectura
    if (spec.drill) {
      days.thu.push(task(`W${n}-thu-drill`, { type: 'drill', title: `Drill: ${spec.drill.t}`, min: M('thu', (spec.mins && spec.mins.drill) || (spec.manual || spec.ganar ? 40 : 55), spec.manual || spec.ganar || cf ? 30 : 40), prio: 1,
        desc: 'Práctica deliberada del punto débil de la semana. Grabarse es obligatorio: lo que no se escucha no se corrige.', steps: spec.drill.steps }));
    }
    if (spec.manual) {
      days.thu.push(task(`W${n}-thu-manual`, { type: 'manual', title: `Manual CMUDE pp. ${spec.manual.paginas}`, min: M('thu', (spec.mins && spec.mins.manual) || 20, 15), prio: 2, pages: spec.manual.paginas,
        desc: spec.manual.tema, steps: ['Lee las páginas con un bolígrafo: subraya cada frase que suene a criterio de juez.', 'Apunta UNA pregunta que le harías a Fernanda Roig en la próxima sesión.'], links: [D.R.manual] }));
    } else if (spec.ganar) {
      days.thu.push(task(`W${n}-thu-ganar`, { type: 'lectura', title: `"Ganar debates": ${spec.ganar.cap}`, min: M('thu', 20, 15), prio: 2, desc: 'Lectura corta y subrayada.', links: [D.R.ganar] }));
    } else if (cf) {
      if (spec.drill && !lite('thu')) days.thu[0].min = 40, days.thu[0].xp = Math.round(40 * XP[1]);
      days.thu.push(task(`W${n}-thu-casefile`, { type: 'casefile', title: `Ficha exprés: mociones y actores de ${cf.nombre}`, min: M('thu', 20, 15), prio: 2, topic: cf.id,
        desc: 'Segunda pasada a la ficha de la semana: ahora sin ver ni leer nada, sólo pensando como debatiente con lo que sacaste del documental del lunes.',
        steps: ['Escribe 2 mociones posibles del tema (una de política y otra de actor o de lamentar/preferir).', 'Para cada una: el caso obvio de Gobierno en 2 líneas y la extensión que harías desde Baja.', 'Añade el argumento de principios que casi siempre aparece en este tema.', 'Todo en tu casefile (Google Docs), en la ficha de ' + cf.nombre + '.'],
        links: [D.R.casefileDoc] }));
    }

    // VIERNES — reto / psico / pretorneo / libre
    const f = spec.fri || { kind: 'reto' };
    if (f.kind === 'reto') {
      const motion = D.RETO_MOTIONS[(n * 7) % D.RETO_MOTIONS.length]; const prep = f.prep || 15;
      days.fri.push(task(`W${n}-fri-reto`, { type: 'reto', title: `Reto cronometrado · La Almeja Borracha${prep < 15 ? ` · prep ${prep}′` : ''}`, min: M('fri', 50, 40), prio: 1, motion, role: f.role || 'el que menos te guste', prep,
        desc: `Moción nueva, ${prep} de prep, 7 de discurso, rúbrica del manual. Es el jefe final de la semana.` + (prep < 15 ? ' Prep corto: tesis en el minuto 1, dos argumentos, una comparativa. Lo demás sobra.' : ''),
        steps: [`Moción: ${motion}.`, `Rol: ${f.role || 'elige el que menos te guste'}.`, `${prep} min de prep con el cronómetro. 7 min de discurso grabado.`, 'Rúbrica (abajo, en la tarjeta del reto): relevancia, engagement, explicación, claridad → estimación de speaks.', 'Si la moción es de un debate de la biblioteca, mira la sala alta real después (búscala en Biblioteca).'] }));
      days.fri.push(task(`W${n}-fri-retro`, { type: 'retro', title: 'Retro de la semana', min: M('fri', 10, 5), prio: 2,
        desc: 'Tres preguntas y a casa.', steps: ['¿Qué regla de esta semana ya sale sola?', '¿Qué sigue sin salir?', '¿Qué cambio pequeño haces la semana que viene?'] }));
    } else if (f.kind === 'psico') {
      const p = D.PSYCH.find(x => x.id === f.psico);
      days.fri.push(task(`W${n}-fri-psico`, { type: 'psico', title: `Psico ${p.id}: ${p.titulo}`, min: M('fri', 60, 45), prio: 1, psico: p.id,
        desc: 'Un rato para la cabeza. Es la parte del entrenamiento que casi nadie hace y por la que casi nadie mejora.',
        steps: p.pasos, links: p.video ? [{ t: p.video.t, u: p.video.u }] : [] }));
    } else if (f.kind === 'pretorneo') {
      const t = tournaments.find(x => x.id === f.torneo);
      days.fri.push(task(`W${n}-fri-pre`, { type: 'pretorneo', title: `Rutina pre-torneo: ${t ? t.nombre : ''}`, min: M('fri', 30, 20), prio: 1,
        desc: 'Nada nuevo hoy. Repasar la Tarjeta de sala, la rutina y dormir.',
        steps: ['Lee la Tarjeta de sala (pestaña Psico) en voz alta.', 'Rutina pre-ronda completa una vez, a modo de ensayo.', '3 objetivos de proceso para el torneo, escritos.', 'Prepara la grabadora del móvil: graba TODOS tus discursos.'] }));
    } else if (f.kind === 'libre') {
      days.fri.push(task(`W${n}-fri-libre`, { type: 'libre', title: 'Viernes libre', min: 0, prio: 3, desc: 'Descanso programado. Cuenta como hecho si descansas de verdad.' }));
    }

    (spec.extras || []).forEach((e, i) => extras.push(task(`W${n}-x${i}`, { type: 'extra', title: e.t, min: 40, prio: 3, by: e.b, desc: 'Extra opcional de la semana.', links: [{ t: e.t, u: e.u }] })));
    if (!docMartes && vids[1]) extras.push(task(`W${n}-xdoc`, { type: 'extra', title: `Documental extra: ${vids[1].t}`, min: vidMin(vids[1]), prio: 3, by: vids[1].b, video: vids[1], desc: `Otro subtema de la lista de Debateca (${vids[1].tema}). Opcional: si lo ves, añade 3 hechos a la ficha.`, links: [{ t: vids[1].t, u: vids[1].u }] }));
    addExtra(spec, n, days);
    // Carga ligera: las tareas añadidas a mano también se acortan, y el XP se compensa para que menos minutos no den menos nivel.
    DAYS.forEach(d => { if (!lite(d)) return; days[d].forEach(t => { if (/-add\d+$/.test(t.id)) t.min = Math.max(5, Math.round(t.min * 0.75 / 5) * 5); t.xp = Math.round(t.min * XP[t.prio] * 4 / 3); }); });
    return { n, start, phase, spec, days, extras, tourn, light: false };
  }

  // Tareas añadidas a mano a un día (spec.add = { thu:[...], fri:[...] })
  function addExtra(spec, n, days) {
    Object.keys(spec.add || {}).forEach(d => (spec.add[d] || []).forEach((o, i) => days[d] && days[d].push(task(`W${n}-${d}-add${i}`, o))));
  }
  // Replanificación por semanas avisadas: lo núcleo de la semana perdida pasa a extras (prio 2) de las 3 semanas siguientes.
  function applyLostWeeks(weeks, lost) {
    const byN = new Map(weeks.map(w => [w.n, w]));
    const lostSet = new Set(lost);
    lost.slice().sort((a, b) => a - b).forEach(n => {
      const w = byN.get(n); if (!w) return;
      const core = [];
      ['tue', 'wed', 'thu', 'fri'].forEach(d => w.days[d].forEach(t => { if (t.prio === 1 && !['pretorneo', 'autopsia', 'libre', 'elpais'].includes(t.type)) core.push(t); }));
      const targets = [];
      for (let k = n + 1; k <= weeks.length && targets.length < 3; k++) { const c = byN.get(k); if (c && !lostSet.has(k) && !c.light) targets.push(c); }
      core.forEach((t, i) => {
        if (!targets.length) return;
        const tgt = targets[i % targets.length];
        tgt.extras = tgt.extras.filter(x => x.prio !== 3 || tgt.extras.length <= 1); // quita opcionales para hacer sitio
        tgt.extras.push(Object.assign({}, t, { recovered: n, prio: 2, title: `Recuperación S${n}: ${t.title}`, xp: Math.round(t.min * XP[2]) }));
      });
      w.lost = true;
      w.days = { mon: [], tue: [], wed: [], thu: [], fri: [] };
      w.extras = [];
    });
    return weeks;
  }

  // Tareas recolocadas (D.MOVES): pasan a su día nuevo en versión corta, salvo que ya estuvieran hechas antes de D.MOVES_DESDE.
  function applyMoves(weeks, state) {
    const moves = D.MOVES || {}; const desde = D.MOVES_DESDE || '0000';
    Object.keys(moves).forEach(id => {
      const hecho = (state.done || {})[id]; if (hecho && String(hecho) < desde) return;
      let t = null, src = null;
      weeks.forEach(w => DAYS.forEach(d => { const i = w.days[d].findIndex(x => x.id === id); if (i >= 0) { t = w.days[d][i]; src = [w, d, i]; } }));
      if (!t) return;
      const to = moves[id]; const tw = weeks.find(w => !w.lost && to >= w.start && to <= addDays(w.start, 4)); if (!tw) return;
      src[0].days[src[1]].splice(src[2], 1);
      t.moved = addDays(src[0].start, DAYS.indexOf(src[1]));
      t.min = Math.max(5, Math.round(t.min * 0.75 / 5) * 5); t.xp = Math.round(t.min * XP[t.prio] * 4 / 3);
      t.title = 'Recuperada del arranque · ' + t.title;
      tw.days[DAYS[dow(to)]].push(t);
    });
  }

  function buildPlan(state) {
    const tournaments = mergeTournaments(state);
    const weeks = D.WEEKS.map(s => buildWeek(s, tournaments));
    applyLostWeeks(weeks, state.lostWeeks || []);
    applyMoves(weeks, state);
    const index = {};
    weeks.forEach(w => { DAYS.forEach(d => w.days[d].forEach(t => { t.week = w.n; t.day = d; t.date = addDays(w.start, DAYS.indexOf(d)); index[t.id] = t; })); w.extras.forEach(t => { t.week = w.n; t.day = null; index[t.id] = t; }); });
    return { weeks, index, tournaments };
  }

  function mergeTournaments(state) {
    const base = D.TOURNAMENTS.map(t => Object.assign({}, t));
    const ov = (state.tournaments || {});
    const out = base.map(t => ov[t.id] ? Object.assign(t, ov[t.id]) : t).filter(t => !t.deleted);
    Object.keys(ov).forEach(id => { if (!base.find(b => b.id === id) && !ov[id].deleted) out.push(Object.assign({ id }, ov[id])); });
    return out.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  // ---------- estado ----------
  const STORAGE_KEY = 'qdc-state-v1';
  function defaultState() {
    return { v: 1, done: {}, lostWeeks: [], tournaments: {}, logs: { retos: [], juez: [], torneos: [], pensamientos: [], juezTorneos: [] }, tarjeta: '', casefile: {}, casefileDoc: {}, quiz: { best: 0, attempts: 0, history: [] }, badges: {}, seenDebates: [], created: todayISO() };
  }
  function loadState() {
    let s = defaultState();
    try { const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY); if (raw) s = migrate(JSON.parse(raw)); } catch (e) { /* estado por defecto */ }
    return s;
  }
  function saveState(s) { try { root.localStorage && root.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  function migrate(s) {
    const d = defaultState();
    if (!s || typeof s !== 'object') return d;
    const out = Object.assign(d, s);
    out.logs = Object.assign(d.logs, s.logs || {});
    out.quiz = Object.assign(d.quiz, s.quiz || {});
    if (!Array.isArray(out.quiz.history)) out.quiz.history = [];
    out.quiz.attempts = out.quiz.history.length; out.quiz.best = out.quiz.history.reduce((m, x) => Math.max(m, Number(x.score) || 0), 0);
    if (!Array.isArray(out.lostWeeks)) out.lostWeeks = [];
    if (!out.done || typeof out.done !== 'object') out.done = {};
    if (!out.casefile || typeof out.casefile !== 'object') out.casefile = {};
    if (!out.casefileDoc || typeof out.casefileDoc !== 'object') out.casefileDoc = {};
    return out;
  }

  // ---------- progreso ----------
  function stats(plan, state) {
    const doneIds = Object.keys(state.done);
    let xp = 0; const counts = { elpais: 0, taller: 0, rebuild: 0, judge: 0, drill: 0, manual: 0, reto: 0, psico: 0, casefile: 0, total: 0 };
    doneIds.forEach(id => { const t = plan.index[id]; if (!t) return; xp += t.xp; counts.total++; if (counts[t.type] !== undefined) counts[t.type]++; });
    counts.fichas = casefileCount(state);
    const streak = computeStreak(plan, state);
    // desglose de XP por fuente (bd); el total es la suma
    const bd = {
      tareas: xp,
      fichas: counts.fichas * 20,
      retos: (state.logs.retos || []).length * 10,
      torneos: (state.logs.torneos || []).length * 40,
      examen: Math.round((state.quiz.best || 0) * 0.5) + Math.min((state.quiz.history || []).length, 25) * 4,
      psico: (state.logs.pensamientos || []).length * 3,
      racha: Math.min(streak, 30) * 3,
    };
    xp = Object.values(bd).reduce((a, b) => a + b, 0);
    const lvlIdx = D.LEVELS.reduce((acc, l, i) => xp >= l.xp ? i : acc, 0);
    const level = D.LEVELS[lvlIdx], next = D.LEVELS[lvlIdx + 1] || null;
    // XP ganada en los últimos 7 días (tareas por fecha de la tarea, registros por fecha)
    const since = addDays(todayISO(), -6); const recent = f => f && f >= since;
    let weekXp = 0;
    doneIds.forEach(id => { const t = plan.index[id]; if (t && recent(t.date)) weekXp += t.xp; });
    weekXp += (state.logs.retos || []).filter(r => recent(r.fecha)).length * 10 + (state.logs.torneos || []).filter(r => recent(r.fecha)).length * 40 + (state.logs.pensamientos || []).filter(r => recent(r.fecha)).length * 3 + (state.quiz.history || []).filter(r => recent(r.fecha)).length * 4;
    const bestStreak = computeBestStreak(plan, state);
    return { xp, level, lvlIdx, next, streak, bestStreak, counts, bd, weekXp };
  }
  // racha: días laborables consecutivos (hacia atrás desde hoy o ayer) con al menos una tarea del día hecha
  function computeStreak(plan, state) {
    const doneByDate = {};
    Object.keys(state.done).forEach(id => { const t = plan.index[id]; if (t && t.date) doneByDate[t.date] = true; });
    let d = todayISO(); let streak = 0;
    // si hoy aún no hay nada, empezar desde el último laborable anterior
    const isWeekday = s => dow(s) < 5;
    const prevWeekday = s => { let x = addDays(s, -1); while (!isWeekday(x)) x = addDays(x, -1); return x; };
    if (!isWeekday(d) || !doneByDate[d]) { d = prevWeekday(d); if (!doneByDate[d]) return 0; }
    while (doneByDate[d]) { streak++; d = prevWeekday(d); }
    return streak;
  }

  // mejor racha histórica: días laborables consecutivos con alguna tarea hecha
  function computeBestStreak(plan, state) {
    const dates = {}; Object.keys(state.done).forEach(id => { const t = plan.index[id]; if (t && t.date) dates[t.date] = true; });
    const ds = Object.keys(dates).sort(); if (!ds.length) return 0;
    let best = 0, run = 0, prev = null;
    ds.forEach(x => { if (dow(x) >= 5) return; let p = addDays(x, -1); while (dow(p) >= 5) p = addDays(p, -1); run = (prev === p) ? run + 1 : 1; prev = x; if (run > best) best = run; });
    return best;
  }
  // Una ficha cuenta si tiene ≥ 80 caracteres propios (sin contar las líneas de la plantilla)
  function casefileWritten(txt) { if (typeof txt !== 'string') return false; const tpl = new Set(D.CASEFILE_TEMPLATE.split('\n').map(l => l.trim()).filter(Boolean)); const own = txt.split('\n').map(l => l.trim()).filter(l => l && !tpl.has(l)).join('\n'); return own.length >= 80; }
  // Una ficha cuenta cuando se marca hecha alguna tarea de casefile de la semana de ese tema (lunes, martes-documental, jueves o la de S0).
  // Se conserva lo antiguo: fichas escritas en la app (state.casefile) o marcadas en la pestaña que ya no existe (state.casefileDoc).
  function casefileDone(state, id) {
    if (((state.casefileDoc || {})[id] || {}).done || casefileWritten((state.casefile || {})[id])) return true;
    const done = Object.keys(state.done || {});
    return Object.keys(D.CASEFILE_PLAN).some(n => D.CASEFILE_PLAN[n] === id && done.some(k => k.startsWith(`W${n}-`) && /-mon-elpais$|-tue-doc$|casefile/.test(k)));
  }
  function casefileCount(state) { return D.CASEFILE_TOPICS.filter(t => casefileDone(state, t.id)).length; }
  function weekProgress(week, state) {
    const core = []; DAYS.forEach(d => week.days[d].forEach(t => { if (t.prio === 1) core.push(t); }));
    const done = core.filter(t => state.done[t.id]).length;
    return { core: core.length, done, pct: core.length ? Math.round(done / core.length * 100) : 0 };
  }

  function checkBadges(plan, state, st) {
    const earned = [];
    const give = id => { if (!state.badges[id]) { state.badges[id] = todayISO(); earned.push(D.BADGES.find(b => b.id === id)); } };
    if (st.counts.total >= 1) give('primera');
    if (plan.weeks.some(w => !w.light && !w.lost && weekProgress(w, state).pct === 100)) give('semana');
    if (st.streak >= 5) give('racha5');
    if (st.streak >= 20) give('racha20');
    const manualTasks = Object.values(plan.index).filter(t => t.type === 'manual' && !/relectura/.test(t.pages || ''));
    if (manualTasks.length && manualTasks.every(t => state.done[t.id])) give('manual');
    const retos = (state.logs.retos || []).length; if (retos >= 5) give('retos5'); if (retos >= 15) give('retos15');
    if ((state.quiz.best || 0) >= 80) give('examen');
    if (st.counts.psico >= 5) give('psico5');
    if (st.counts.elpais >= 10) give('elpais10');
    if ((state.logs.torneos || []).length >= 1) give('torneo');
    const fichas = casefileCount(state); if (fichas >= 10) give('case10'); if (fichas >= D.CASEFILE_TOPICS.length) give('case27');
    if (D.PHASES.some(p => { const ws = plan.weeks.filter(w => w.n >= p.semanas[0] && w.n <= p.semanas[1] && !w.light && !w.lost); return ws.length && ws.every(w => weekProgress(w, state).pct === 100); })) give('fase');
    return earned;
  }

  // resumen de texto para pegar a Claude
  function summaryText(plan, state) {
    const st = stats(plan, state);
    const lines = [];
    lines.push(`# Resumen QDC — ${todayISO()}`);
    lines.push(`XP ${st.xp} · nivel ${st.level.nombre} · racha ${st.streak} · tareas hechas ${st.counts.total}`);
    lines.push(`Contadores: EL PAÍS ${st.counts.elpais}, talleres ${st.counts.taller}, reconstrucciones ${st.counts.rebuild}, juez sombra ${st.counts.judge}, drills ${st.counts.drill}, manual ${st.counts.manual}, retos ${st.counts.reto}, psico ${st.counts.psico}`);
    lines.push(`Semanas avisadas: ${(state.lostWeeks || []).join(', ') || 'ninguna'}`);
    const qh = state.quiz.history || [];
    lines.push(`Examen de juez: mejor ${state.quiz.best || 0}% en ${state.quiz.attempts || 0} intentos${qh.length ? ' · historial: ' + qh.slice(-10).map(x => `${x.fecha} ${x.score}% (${x.correct}/${x.total})`).join(', ') : ''}`);
    lines.push(`Casefile: ${st.counts.fichas}/${D.CASEFILE_TOPICS.length} fichas escritas (${D.CASEFILE_TOPICS.filter(t => casefileDone(state, t.id)).map(t => t.nombre).join(', ') || 'ninguna'})`);
    lines.push('\n## Semanas (núcleo hecho/total)');
    plan.weeks.forEach(w => { const p = weekProgress(w, state); lines.push(`S${w.n} ${w.start} ${w.spec.theme}${w.lost ? ' [AVISADA]' : ''}${w.light ? ' [ligera]' : ''}: ${p.done}/${p.core}`); });
    if ((state.logs.torneos || []).length) { lines.push('\n## Torneos registrados'); state.logs.torneos.forEach(t => lines.push(`${t.fecha} ${t.nombre}: spks ${t.spks.join('/')} (media ${avg(t.spks).toFixed(2)}), equipo ${t.puesto || '?'}, ejecución ${t.ejecucion || '?'}/10. ${t.notas || ''}`)); }
    if ((state.logs.retos || []).length) { lines.push('\n## Retos (estimación propia)'); state.logs.retos.slice(-10).forEach(r => lines.push(`${r.fecha} est ${r.est} · carac ${r.carac || '?'}s · muletillas/min ${r.mulet || '?'} · comparativa<5:30 ${r.comp ? 'sí' : 'no'} · cierre ${r.cierre ? 'sí' : 'no'} · ${r.motion.slice(0, 60)} · ${r.notas || ''}`)); }
    if ((state.logs.pensamientos || []).length) { lines.push('\n## Diálogo interno (últimos 5)'); state.logs.pensamientos.slice(-5).forEach(p => lines.push(`- "${p.pensamiento}" → "${p.reformulacion}"`)); }
    if (state.tarjeta) lines.push('\n## Tarjeta de sala\n' + state.tarjeta);
    return lines.join('\n');
  }
  const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

  root.ENGINE = { casefileCount, casefileWritten, casefileDone, iso, parse, addDays, dow, mondayOf, DAYS, DAY_ES, MESES, fmtLong, fmtShort, todayISO, weekNumberFor, weekStart, phaseOf, buildPlan, mergeTournaments, loadState, saveState, defaultState, migrate, stats, weekProgress, checkBadges, summaryText, avg, ytId, debateInfo, STORAGE_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
