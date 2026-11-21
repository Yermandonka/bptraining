// ============================================================
//  app.js — interfaz. Sin dependencias. Funciona abriendo index.html con doble clic.
// ============================================================
(function () {
  const E = window.ENGINE, D = window.PLAN_DATA, LIB = window.LIBRARY || { talleres: [], debates: [] };
  const jp = D.CONFIG.perfil === 'jp';
  document.title = `Quahog Debate Club · plan de ${D.CONFIG.nombre}`;
  let state = E.loadState();
  let plan = E.buildPlan(state);
  let view = { route: 'hoy', week: null, calMonth: null, q: '', libTab: 'talleres', filtro: '', quiz: null, open: {} };

  // ---------- utilidades ----------
  const $ = sel => document.querySelector(sel);
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = xs => xs[Math.floor(Math.random() * xs.length)];
  const uid = () => Math.random().toString(36).slice(2, 9);
  const persist = () => { if (!E.saveState(state)) toast('No se pudo guardar en este navegador. Exporta el progreso desde Ajustes.', 'warn'); };
  const rebuild = () => { plan = E.buildPlan(state); };
  // ?today=YYYY-MM-DD permite simular otro día (pruebas). Sin parámetro, hoy real.
  try { const qp = new URLSearchParams(location.search).get('today'); if (qp && /^\d{4}-\d{2}-\d{2}$/.test(qp)) window.__QDC_TODAY = qp; } catch (e) { /* nada */ }
  const today = () => (window.__QDC_TODAY || E.todayISO());

  let toastTimer = null;
  function toast(msg, kind) {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
  }
  window.addEventListener('error', ev => { try { toast('Error: ' + (ev.message || 'desconocido') + '. Si se repite, exporta el progreso y avisa a Claude.', 'warn'); } catch (e) { /* nada */ } });

  // ---------- cronómetro ----------
  const timer = { endsAt: null, label: '', iv: null };
  function startTimer(min, label) {
    timer.endsAt = Date.now() + min * 60000; timer.label = label;
    clearInterval(timer.iv); timer.iv = setInterval(tickTimer, 500); tickTimer();
  }
  function stopTimer() { clearInterval(timer.iv); timer.endsAt = null; renderTimer(); }
  function tickTimer() {
    if (!timer.endsAt) return;
    const left = timer.endsAt - Date.now();
    if (left <= 0) { stopTimer(); beep(); toast('¡Tiempo! ' + timer.label, 'ok'); return; }
    renderTimer(left);
  }
  function renderTimer(left) {
    const el = $('#timerbar'); if (!el) return;
    if (!timer.endsAt) { el.className = 'timerbar'; el.innerHTML = ''; return; }
    const s = Math.ceil(left / 1000), m = Math.floor(s / 60), r = s % 60;
    el.className = 'timerbar show' + (s <= 60 ? ' warn' : '');
    el.innerHTML = `<span class="tl">${h(timer.label)}</span><span class="tt">${m}:${String(r).padStart(2, '0')}</span><button class="btn small ghost" data-action="timer-stop">Parar</button>`;
  }
  function beep() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 660; g.gain.value = 0.08; o.start(); setTimeout(() => { o.frequency.value = 880; }, 180); setTimeout(() => { o.stop(); ctx.close(); }, 420); } catch (e) { /* sin audio */ } }

  // ---------- render raíz ----------
  const ROUTES = [['hoy', 'Hoy'], ['semana', 'Semana'], ['calendario', 'Calendario'], ['progreso', 'Progreso'], ['juez', 'Juez'], ['psico', 'Psico'], ['biblioteca', 'Biblioteca'], ['ajustes', 'Ajustes']];
  function render() {
    const st = E.stats(plan, state);
    const earned = E.checkBadges(plan, state, st); if (earned.length) { persist(); earned.forEach(b => toast(`${b.icon} Logro: ${b.nombre}`, 'ok')); }
    const anim = view.lastRoute !== view.route; view.lastRoute = view.route;
    const gained = view.lastXp != null && st.xp > view.lastXp; const leveled = view.lastLvl != null && st.lvlIdx > view.lastLvl; view.lastXp = st.xp; view.lastLvl = st.lvlIdx;
    const nav = ROUTES.map(([r, l]) => `<a href="#${r}" class="${view.route === r ? 'on' : ''}">${l}</a>`).join('');
    const pct = st.next ? Math.round((st.xp - st.level.xp) / (st.next.xp - st.level.xp) * 100) : 100;
    document.body.classList.toggle('exam', !!(view.quiz && view.route === 'juez'));
    $('#app').innerHTML = `
      <header class="top">
        <div class="brand"><span class="neon">QUAHOG</span> <span class="brand2">DEBATE CLUB</span><small>Rumbo a Barcelona 2027</small></div>
        <a class="profile" href="#progreso" title="${h(st.level.frase)} · ver perfil">
          <span class="avatar" style="--p:${pct}">${face(st.level)}</span>
          <span class="pinfo">
            <span class="pname"><b>${h(D.CONFIG.nombre)}</b> · ${h(st.level.nombre)} <span class="tag">N${st.lvlIdx + 1} · ${h(st.level.rango)}</span></span>
            <span class="bar ${gained ? 'gain' : ''}"><i style="width:${pct}%"></i></span>
            <span class="lvl">${st.xp} XP${st.next ? ` · faltan ${st.next.xp - st.xp} para ${h(st.next.nombre)}` : ' · nivel máximo'} · <span class="streak">🔥 ${st.streak}</span>${st.weekXp ? ` · +${st.weekXp} esta semana` : ''}</span>
          </span>
        </a>
        <nav>${nav}</nav>
      </header>
      <main id="view" ${anim ? 'data-anim="1"' : ''}>${renderRoute(st)}</main>
      <div id="timerbar" class="timerbar"></div>
      <div id="toast" class="toast"></div>`;
    renderTimer(timer.endsAt ? timer.endsAt - Date.now() : 0);
    if (leveled) levelUp(st.level);
  }
  function levelUp(level) {
    const o = document.createElement('div'); o.className = 'lvlup'; o.innerHTML = `<div class="box"><div class="kicker">Subes de nivel</div>${level.img ? `<div class="face"><img src="${h(level.img)}" alt=""></div>` : ''}<h2>${level.icon} ${h(level.nombre)}</h2><p>${h(level.frase)}</p><p class="muted">${h(level.rango)}</p><small>${h(rnd(D.QUIPS.level))} · toca para seguir</small></div>`;
    o.addEventListener('click', () => o.remove()); document.body.appendChild(o); confetti(window.innerWidth / 2, window.innerHeight / 2, 60); setTimeout(() => { if (o.parentNode) o.remove(); }, 6000);
  }
  function confetti(x, y, n) {
    const fx = $('#fx'); if (!fx) return; const colors = ['#19d3c5', '#ff5c8a', '#ffd23f', '#49b265', '#a78bfa', '#fff'];
    for (let i = 0; i < (n || 18); i++) {
      const p = document.createElement('i'); p.className = 'conf' + (Math.random() < .4 ? ' round' : '');
      const ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * (n > 30 ? 260 : 90);
      p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 30}px;--rot:${(Math.random() * 720 - 360)}deg;animation-duration:${.6 + Math.random() * .5}s`;
      fx.appendChild(p); setTimeout(() => p.remove(), 1200);
    }
  }
  // parallax suave del fondo con el ratón (no en táctil)
  (function () {
    if (!window.matchMedia || window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layers = [['.sky .stars1', 10], ['.sky .stars2', 18], ['.sky .glow1', 24], ['.sky .glow2', 16], ['.sky .skyline', 6], ['.sky .cast', 4]].map(([sel, f]) => [document.querySelector(sel), f]).filter(x => x[0]);
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    const tick = () => { cx += (tx - cx) * .06; cy += (ty - cy) * .06; layers.forEach(([el, f]) => { el.style.transform = `translate3d(${(-cx * f).toFixed(1)}px,${(-cy * f).toFixed(1)}px,0)`; }); if (Math.abs(tx - cx) > .01 || Math.abs(ty - cy) > .01) raf = requestAnimationFrame(tick); else raf = null; };
    window.addEventListener('mousemove', e => { tx = e.clientX / window.innerWidth - .5; ty = e.clientY / window.innerHeight - .5; if (!raf) raf = requestAnimationFrame(tick); }, { passive: true });
  })();
  function renderRoute(st) {
    switch (view.route) {
      case 'semana': return viewSemana();
      case 'calendario': return viewCalendario();
      case 'progreso': return viewProgreso(st);
      case 'juez': return viewJuez();
      case 'psico': return viewPsico();
      case 'biblioteca': return viewBiblioteca();
      case 'ajustes': return viewAjustes();
      default: return viewHoy(st);
    }
  }

  // ---------- componentes ----------
  const TYPE_ICON = { estilo: '🎙️', casefile: '📁', elpais: '📰', plan: '🗺️', taller: '🎓', rebuild: '🎬', judge: '⚖️', drill: '🥊', manual: '📘', lectura: '📖', reto: '🍺', retro: '🪞', psico: '🧠', pretorneo: '🎒', autopsia: '🩺', libre: '🛋️', extra: '✨' };
  function taskCard(t, opts) {
    opts = opts || {};
    const done = !!state.done[t.id]; const open = view.open[t.id] || opts.open;
    const links = (t.links || []).map(l => jp && l === D.R.casefileDoc && state.casefileUrl
      ? { t: 'Mi casefile (Google Docs)', u: casefileURL(state.casefileUrl) || l.u }
      : l).filter(l => l && l.u).map(l => l.u.startsWith('#') ? `<a class="lnk" href="${h(l.u)}">${h(l.t)} →</a>` : `<a class="lnk" href="${h(l.u)}" target="_blank" rel="noopener">${h(l.t)} ↗</a>`).join('');
    const steps = (t.steps || []).length ? `<ol class="steps">${t.steps.map(s => `<li>${h(s)}</li>`).join('')}</ol>` : '';
    const info = t.info ? `<div class="dinfo">${h(t.info.to)} · ${h(t.info.r)} · ${h(t.info.te)}${t.type === 'judge' ? ` · <button class="btn tiny ghost" data-action="reveal" data-id="${h(t.id)}">Revelar resultado real</button><span id="rev-${h(t.id)}" class="hidden"> → <b>${h(t.info.res || 'no consta')}</b></span>` : ` · <span class="muted">${h(t.info.eq)}</span>`}</div>` : '';
    const extra = t.type === 'reto' ? retoWidget(t) : t.type === 'rebuild' ? `<div class="row"><button class="btn small" data-action="timer" data-min="${t.prep || 15}" data-label="Prep · ${h(t.role)}">⏱ Prep ${t.prep || 15}:00</button><button class="btn small" data-action="timer" data-min="7" data-label="Discurso">⏱ Discurso 7:00</button></div>` : t.type === 'judge' ? `<div class="row"><a class="btn small" href="#juez">Ir a la rúbrica de adjudicación →</a></div>` : t.type === 'psico' ? `<div class="row"><a class="btn small" href="#psico">Abrir Tarjeta de sala →</a></div>` : t.type === 'autopsia' ? `<div class="row"><a class="btn small" href="#progreso">Registrar torneo →</a></div>` : '';
    return `<article class="task ${done ? 'done' : ''} p${t.prio} ${open ? 'open' : ''}" data-id="${h(t.id)}">
      <div class="thead">
        <label class="chk"><input type="checkbox" data-action="toggle" data-id="${h(t.id)}" ${done ? 'checked' : ''}><span></span></label>
        <button class="ttitle" data-action="open" data-id="${h(t.id)}"><span class="ico">${TYPE_ICON[t.type] || '•'}</span> ${h(t.title)}${t.recovered ? ` <span class="tag rec">recup. S${t.recovered}</span>` : ''}${t.prio === 3 ? ' <span class="tag">opcional</span>' : ''}</button>
        <span class="meta">${t.min ? t.min + '′' : ''} · ${t.xp} XP${opts.date ? ' · ' + h(E.fmtShort(t.date)) : ''}</span>
      </div>
      <div class="tbody"><div class="tinner"><div>
        ${t.by ? `<div class="by">por ${h(t.by)}</div>` : ''}
        <p class="desc">${h(t.desc)}</p>
        ${steps}${info}
        <div class="links">${links}</div>
        ${extra}
      </div></div></div>
    </article>`;
  }
  function retoWidget(t) {
    const log = (state.logs.retos || []).find(r => r.taskId === t.id);
    return `<div class="reto">
      <div class="row"><button class="btn small" data-action="timer" data-min="${t.prep || 15}" data-label="Prep del reto">⏱ Prep ${t.prep || 15}:00</button><button class="btn small" data-action="timer" data-min="7" data-label="Discurso del reto">⏱ Discurso 7:00</button><button class="btn small ghost" data-action="reto-random" data-id="${h(t.id)}">🎲 Otra moción de la biblioteca</button></div>
      ${log ? `<div class="ok">Registrado: estimación <b>${h(log.est)}</b> · ${h(log.notas || '')}</div>` : `
      <form class="rubrica" data-action="reto-save" data-id="${h(t.id)}">
        <div class="grid4">
          ${['Relevancia (¿se involucra con los temas principales?)', 'Engagement (¿responde a lo que diría la otra bancada?)', 'Explicación (¿mecanismo completo o afirmación?)', 'Claridad (¿se puede seguir y dar crédito?)'].map((l, i) => `<label>${h(l)}<select name="r${i}"><option value="1">1 · flojo (≈70)</option><option value="2" selected>2 · correcto (≈73)</option><option value="3">3 · bueno (≈76)</option><option value="4">4 · muy bueno (≈79)</option></select></label>`).join('')}
        </div>
        <div class="grid4"><label>Caracterización (segundos)<input name="carac" type="number" min="0" max="420" placeholder="60"></label><label>Muletillas y "eeeh" por minuto (los tacos no cuentan)<input name="mulet" type="number" min="0" max="40" step="0.5" placeholder="3"></label><label>¿Comparativa antes del 5:30?<select name="comp"><option value="1">sí</option><option value="0">no</option></select></label><label>¿Cierre preparado antes del 6:30?<select name="cierre"><option value="1">sí</option><option value="0">no</option></select></label></div>
        <label>Una frase: qué repetirías y qué no<input name="notas" maxlength="200" placeholder="p. ej. la comparativa llegó en el 6:30"></label>
        <button class="btn small" type="submit">Guardar reto (+10 XP)</button>
      </form>`}
    </div>`;
  }
  function phaseChip(p) { return `<span class="chip" style="--c:${p.color}">${h(p.nombre)}</span>`; }
  function nextTournaments(n) {
    const t = today();
    return plan.tournaments.filter(x => x.fin >= t).slice(0, n || 3);
  }
  function daysUntil(d) { return Math.round((E.parse(d) - E.parse(today())) / 864e5); }

  // ---------- HOY ----------
  function viewHoy(st) {
    const t = today(); const n = E.weekNumberFor(t); const week = plan.weeks.find(w => w.n === n);
    const dowi = E.dow(t); const dayKey = E.DAYS[dowi];
    const single = E.singleSession(t);
    const nt = nextTournaments(2);
    const tHtml = nt.length ? `<div class="card tourn"><h3>Próximo torneo</h3>${nt.map(x => `<div class="trow"><b>${h(x.nombre)}</b><span>${h(E.fmtShort(x.inicio))}–${h(E.fmtShort(x.fin))} · ${h(x.lugar)} · ${h(x.rol)}${x.estimado ? ' · <i>fecha estimada</i>' : ''}</span><span class="cd">${daysUntil(x.inicio) <= 0 ? '¡en curso!' : 'en ' + daysUntil(x.inicio) + ' días'}</span></div>`).join('')}</div>` : '';
    let body = '';
    if (!week) {
      body = n < plan.weeks[0].n
        ? `<div class="card hero"><h2>El plan empieza el ${h(E.fmtLong(E.weekStart(plan.weeks[0].n)))}</h2><p>Faltan ${daysUntil(E.weekStart(plan.weeks[0].n))} días. Mientras: mira la pestaña <a href="#semana">Semana</a> para ver qué viene, rellena tu <a href="#psico">Tarjeta de sala</a> y pasa el <a href="#juez">Examen de juez</a> para tener una línea base.</p><p class="quip">${h(rnd(['Hazlo. Hazlo. Hazlo.', 'Victoria será mía.']))}</p></div>`
        : `<div class="card hero"><h2>Temporada terminada</h2><p>Exporta el progreso desde Ajustes y mándaselo a Claude para el plan de verano hacia CMUDE 2027.</p></div>`;
      return `<section class="hoy"><h1>${h(E.fmtLong(t))}</h1>${body}${tHtml}</section>`;
    }
    const wp = E.weekProgress(week, state);
    const head = `<div class="card weekhead" style="--c:${week.phase.color}">
      <div><div class="kicker">Semana ${week.n} · ${phaseChip(week.phase)}</div><h2>${h(week.spec.theme)}</h2><p class="focus">${h(week.spec.focus || week.phase.lema)}</p></div>
      <div class="wp"><div class="ring" style="--p:${wp.pct}"><span>${wp.pct}%</span></div><small>${wp.done}/${wp.core} núcleo</small></div>
    </div>`;
    if (week.lost) body = `<div class="card"><h3>Semana avisada</h3><p>${h(rnd(D.QUIPS.lost))}</p><p>Lo importante se ha repartido en las semanas siguientes. <a href="#semana">Ver semana</a> · <button class="btn small ghost" data-action="unlose" data-n="${week.n}">Deshacer aviso</button></p></div>`;
    else if (dowi >= 5) {
      const pend = single ? [] : pendingOfWeek(week);
      body = `<div class="card"><h3>Fin de semana</h3><p>${h(rnd(D.QUIPS.empty))}</p>${week.tourn.length ? `<p>Tienes torneo: <b>${h(week.tourn.map(x => x.nombre).join(', '))}</b>. Graba todos tus discursos y haz la rutina de la Tarjeta de sala.</p>` : ''}
        ${single ? '' : pend.length ? `<h4>Pendientes de la semana (por si te apetece)</h4>${pend.map(x => taskCard(x, { date: true })).join('')}` : '<p class="muted">Nada pendiente de esta semana. Peter estaría orgulloso.</p>'}</div>`;
    } else {
      const tasks = week.days[dayKey] || [];
      const pend = single ? [] : pendingOfWeek(week).filter(x => x.date < t);
      body = `<div class="card tasks"><h3>${E.DAY_ES[dayKey]} · ${tasks.reduce((a, x) => a + x.min, 0)} min</h3>${tasks.length ? tasks.map(x => taskCard(x)).join('') : `<p>${h(rnd(D.QUIPS.empty))}</p>`}</div>
        ${pend.length ? `<div class="card"><h3>Pendiente de días anteriores</h3>${pend.map(x => taskCard(x, { date: true })).join('')}</div>` : ''}
        ${!single && week.extras.length ? `<div class="card"><h3>Extras y recuperaciones de la semana</h3>${week.extras.map(x => taskCard(x)).join('')}</div>` : ''}`;
    }
    const weak = D.WEAKNESSES[((week.n - 1) % D.WEAKNESSES.length + D.WEAKNESSES.length) % D.WEAKNESSES.length];
    const grind = `<div class="card grind"><h3>${jp ? 'Foco técnico' : '¿Sabéis lo que me saca de quicio?'}</h3><b>${h(weak.titulo)}</b>${jp ? '' : `<p class="muted">${h(weak.dato)}</p>`}<p>${h(weak.plan)}</p></div>`;
    return `<section class="hoy"><h1>${h(E.fmtLong(t))}</h1>${head}${body}${tHtml}${grind}</section>`;
  }
  function pendingOfWeek(week) {
    const out = []; E.DAYS.forEach(d => week.days[d].forEach(x => { if (!state.done[x.id] && x.prio <= 2) out.push(x); })); return out;
  }

  // ---------- SEMANA ----------
  function viewSemana() {
    const t = today(); const minN = plan.weeks[0].n, maxN = plan.weeks[plan.weeks.length - 1].n; const cur = Math.min(Math.max(E.weekNumberFor(t), minN), maxN);
    const n = view.week == null ? cur : view.week; const week = plan.weeks.find(w => w.n === n); if (!week) { view.week = cur; return viewSemana(); }
    const wp = E.weekProgress(week, state);
    const days = E.DAYS.map((d, i) => { const date = E.addDays(week.start, i); const isT = date === t; return `<div class="daycol ${isT ? 'today' : ''}"><h4>${E.DAY_ES[d]} <small>${h(E.fmtShort(date))}</small></h4>${week.days[d].length ? week.days[d].map(x => taskCard(x)).join('') : '<p class="muted">—</p>'}</div>`; }).join('');
    return `<section class="semana">
      <div class="wnav"><button class="btn ghost" data-action="week" data-n="${n - 1}" ${n <= minN ? 'disabled' : ''}>← S${n - 1}</button>
        <div class="wtitle"><div class="kicker">Semana ${n} · ${h(E.fmtShort(week.start))} – ${h(E.fmtShort(E.addDays(week.start, 4)))} · ${phaseChip(week.phase)}</div><h2>${h(week.spec.theme)}</h2><p class="focus">${h(week.spec.focus || '')}</p>${week.spec.special ? `<p class="special">📌 ${h(week.spec.special)}</p>` : ''}${week.tourn.length ? `<p class="special">🏟️ ${h(week.tourn.map(x => x.nombre + ' (' + x.rol + ')').join(' · '))}</p>` : ''}</div>
        <button class="btn ghost" data-action="week" data-n="${n + 1}" ${n >= maxN ? 'disabled' : ''}>S${n + 1} →</button></div>
      <div class="wbar"><span>${wp.done}/${wp.core} tareas núcleo · ${wp.pct}%</span>
        ${week.lost ? `<button class="btn small" data-action="unlose" data-n="${n}">Deshacer "no puedo"</button>` : (week.light ? '<span class="tag">semana ligera</span>' : week.custom ? '<span class="tag">arranque</span>' : `<button class="btn small danger ghost" data-action="lose" data-n="${n}">Esta semana no puedo</button>`)}
        <button class="btn small ghost" data-action="week" data-n="${cur}">Ir a la actual</button></div>
      ${week.lost ? `<div class="card"><p>Semana avisada. Sus tareas núcleo se han repartido como recuperación en las siguientes semanas.</p></div>` : `<div class="days">${days}</div>`}
      ${week.extras.length ? `<div class="card"><h3>Extras / recuperaciones</h3>${week.extras.map(x => taskCard(x)).join('')}</div>` : ''}
    </section>`;
  }

  // ---------- CALENDARIO ----------
  function viewCalendario() {
    const months = []; let m = E.parse(D.CONFIG.inicio); m = new Date(m.getFullYear(), m.getMonth(), 1);
    const end = E.parse(D.CONFIG.fin);
    while (m <= end) { months.push(new Date(m)); m = new Date(m.getFullYear(), m.getMonth() + 1, 1); }
    const byDate = {}; Object.values(plan.index).forEach(x => { if (x.day) (byDate[x.date] = byDate[x.date] || []).push(x); });
    const t = today();
    const grid = months.map(mo => {
      const first = new Date(mo.getFullYear(), mo.getMonth(), 1); const off = (first.getDay() + 6) % 7; const dim = new Date(mo.getFullYear(), mo.getMonth() + 1, 0).getDate();
      let cells = ''; for (let i = 0; i < off; i++) cells += '<i></i>';
      for (let d = 1; d <= dim; d++) {
        const ds = E.iso(new Date(mo.getFullYear(), mo.getMonth(), d)); const xs = byDate[ds] || []; const core = xs.filter(x => x.prio <= 2); const dn = core.filter(x => state.done[x.id]).length;
        const n = E.weekNumberFor(ds); const wk = plan.weeks.find(w => w.n === n);
        const tourn = plan.tournaments.find(x => ds >= x.inicio && ds <= x.fin);
        let cls = 'day'; if (ds === t) cls += ' today'; if (core.length) cls += dn === core.length ? ' full' : dn ? ' part' : ' none'; if (wk && wk.lost) cls += ' lost'; if (tourn) cls += ' tourn'; if (ds < t && core.length && dn < core.length) cls += ' missed';
        cells += `<button class="${cls}" data-action="goto-week" data-n="${n}" title="${h(ds)}${tourn ? ' · ' + h(tourn.nombre) : ''}${wk && !wk.light ? ' · S' + n + ' ' + h(wk.spec.theme) : ''}" style="--c:${wk ? wk.phase.color : '#444'}">${d}${tourn ? '<em>🏟️</em>' : ''}</button>`;
      }
      return `<div class="month"><h4>${E.MESES[mo.getMonth()]} ${mo.getFullYear()}</h4><div class="dow">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div><div class="cells">${cells}</div></div>`;
    }).join('');
    const legend = D.PHASES.map(p => `<span class="chip" style="--c:${p.color}">${h(p.nombre)} · S${p.semanas[0]}–${p.semanas[1]}</span>`).join('');
    return `<section class="cal"><h2>Calendario · noviembre 2026 → junio 2027</h2><p class="muted">Color del borde = fase. Relleno: verde todo hecho, ámbar parcial, rojo pasado sin hacer. 🏟️ torneo. Pulsa un día para ir a su semana.</p><div class="legend">${legend}</div><div class="months">${grid}</div>
      <div class="card"><h3>Las fases</h3>${D.PHASES.map(p => `<div class="phase" style="--c:${p.color}"><b>${h(p.nombre)}</b> <small>semanas ${p.semanas[0]}–${p.semanas[1]} · ${h(E.fmtShort(E.weekStart(p.semanas[0])))} → ${h(E.fmtShort(E.addDays(E.weekStart(p.semanas[1]), 4)))}</small><p>${h(p.desc)}</p><i>"${h(p.lema)}"</i></div>`).join('')}</div></section>`;
  }


  // ---------- PROGRESO ----------
  const face = (l, cls) => l.img ? `<span class="face ${cls || ''}"><img src="${h(l.img)}" alt="${h(l.nombre)}"></span>` : `<b>${l.icon}</b>`;
  function profileCard(st) {
    const pct = st.next ? Math.round((st.xp - st.level.xp) / (st.next.xp - st.level.xp) * 100) : 100;
    const src = [['tareas', 'Tareas del plan', 'var(--neon)'], ['fichas', 'Fichas casefile', '#a78bfa'], ['retos', 'Retos', 'var(--pink)'], ['torneos', 'Torneos', 'var(--yellow)'], ['examen', 'Examen de juez', 'var(--blue)'], ['psico', 'Psico', 'var(--green)'], ['racha', 'Bonus de racha', '#f59e0b']];
    const tot = Math.max(st.xp, 1);
    const stack = src.filter(([k]) => st.bd[k] > 0).map(([k, l, col]) => `<i style="width:${(st.bd[k] / tot * 100).toFixed(1)}%;background:${col}" title="${h(l)} · ${st.bd[k]} XP"></i>`).join('');
    const legend = src.map(([k, l, col]) => `<span><i style="background:${col}"></i>${h(l)} <b>${st.bd[k]}</b></span>`).join('');
    const ladder = D.LEVELS.map((l, i) => `<div class="lstep ${i < st.lvlIdx ? 'done' : i === st.lvlIdx ? 'cur' : ''}" title="${h(l.frase)}"><span class="lic">${l.img ? `<img src="${h(l.img)}" alt="">` : l.icon}</span><b>${h(l.nombre)}</b><small>${h(l.rango)} · ${l.xp} XP</small></div>`).join('');
    const badgesOn = Object.keys(state.badges || {}).length;
    return `<div class="card profile-card">
      <div class="pc-top">
        <div class="avatar big" style="--p:${pct}">${face(st.level)}</div>
        <div class="pc-id"><div class="kicker">Perfil · nivel ${st.lvlIdx + 1} de ${D.LEVELS.length} · ${h(st.level.rango)}</div><h2>${h(D.CONFIG.nombre)} · ${h(st.level.nombre)}</h2><p class="muted">${h(st.level.frase)}</p>
          <div class="nums"><div><b>${st.xp}</b><small>XP total</small></div><div><b>+${st.weekXp}</b><small>últimos 7 días</small></div><div><b>${st.streak}</b><small>racha</small></div><div><b>${st.bestStreak}</b><small>mejor racha</small></div><div><b>${st.counts.total}</b><small>tareas</small></div><div><b>${badgesOn}/${D.BADGES.length}</b><small>logros</small></div></div>
        </div>
      </div>
      <div class="pc-next">${st.next ? `<div class="bar"><i style="width:${pct}%"></i></div><small>${st.xp - st.level.xp} / ${st.next.xp - st.level.xp} XP hacia <b>${st.level.icon}→${st.next.icon} ${h(st.next.nombre)}</b> (${h(st.next.rango)}) · faltan ${st.next.xp - st.xp}</small>` : '<small>Nivel máximo. La pelea no termina nunca.</small>'}</div>
      <div class="pc-break"><div class="kicker">De dónde sale tu XP</div><div class="stack">${stack || '<i style="width:100%;background:var(--line)"></i>'}</div><div class="legend">${legend}</div><p class="muted small">Tarea del plan: su XP (más las de prioridad 1). Ficha ≥ 80 caracteres: 20. Reto: 10. Torneo: 40. Examen: mejor nota × 0,5 + 4 por intento (máx. 25). Pensamiento reformulado: 3. Racha: 3 por día laborable consecutivo (máx. 30 días).</p></div>
      <div class="pc-ladder">${ladder}</div>
    </div>`;
  }
  function viewProgreso(st) {
    const torneos = D.HISTORY.map(x => ({ nombre: x.t, fecha: x.fecha, avg: x.avg, tavg: x.tavg, hist: true })).concat((state.logs.torneos || []).map(x => ({ nombre: x.nombre, fecha: x.fecha, avg: E.avg(x.spks), tavg: x.tavg ? Number(x.tavg) : null }))).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const chart = lineChart(torneos.map(x => ({ x: x.fecha, y: x.avg, y2: x.tavg, label: x.nombre })), { min: 66, max: 82, target: D.CONFIG.objetivoSpks, base: D.CONFIG.baselineSpks });
    const retos = (state.logs.retos || []).map(r => ({ x: r.fecha, y: r.est, label: r.motion }));
    const qh = state.quiz.history || [];
    const chart3 = qh.length >= 2 ? lineChart(qh.map(x => ({ x: x.fecha, y: x.score, label: `${x.correct}/${x.total}` })), { min: 0, max: 100, step: 20, target: 80, xfmt: d => d.slice(8) + '/' + d.slice(5, 7) }) : '<p class="muted">Cuando tengas 2 o más exámenes hechos aparece aquí tu curva de notas.</p>';
    const secFails = {}; qh.forEach(x => (x.fallos || []).forEach(s => { secFails[s] = (secFails[s] || 0) + 1; })); const worst = Object.entries(secFails).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const chart2 = retos.length >= 2 ? lineChart(retos, { min: 66, max: 82, target: D.CONFIG.objetivoSpks }) : '<p class="muted">Cuando tengas 2 o más retos registrados aparece aquí la curva de tu autoevaluación.</p>';
    const badges = D.BADGES.map(b => `<div class="badge ${state.badges[b.id] ? 'on' : ''}" title="${h(b.desc)}"><span>${b.icon}</span><b>${h(b.nombre)}</b><small>${state.badges[b.id] ? h(E.fmtShort(state.badges[b.id])) : h(b.desc)}</small></div>`).join('');
    const c = st.counts;
    const phases = D.PHASES.map(p => { const ws = plan.weeks.filter(w => w.n >= p.semanas[0] && w.n <= p.semanas[1] && !w.light); const tot = ws.reduce((a, w) => a + E.weekProgress(w, state).core, 0); const dn = ws.reduce((a, w) => a + E.weekProgress(w, state).done, 0); return `<div class="prow"><span class="chip" style="--c:${p.color}">${h(p.nombre)}</span><div class="bar"><i style="width:${tot ? dn / tot * 100 : 0}%;background:${p.color}"></i></div><small>${dn}/${tot}</small></div>`; }).join('');
    return `<section class="prog">
      ${profileCard(st)}
      <div class="card"><h3>Speaks por torneo</h3><p class="muted">Línea clara: tu media. Puntos grises: media del torneo. Línea punteada: objetivo 77.${jp ? '' : ` Base histórica ${D.CONFIG.baselineSpks}.`}</p>${chart}
        <details><summary>Registrar torneo (autopsia)</summary>
        <form data-action="torneo-save" class="form">
          <label>Nombre<input name="nombre" required maxlength="80"></label>
          <label>Fecha<input name="fecha" type="date" required value="${h(today())}"></label>
          <label>Speaks por ronda (separados por comas)<input name="spks" required placeholder="72, 74, 71, 75, 73"></label>
          <label>Media del torneo (opcional)<input name="tavg" type="number" step="0.01" placeholder="74.3"></label>
          <label>Puesto de equipo (p. ej. 19/50)<input name="puesto" maxlength="20"></label>
          <label>Nota de EJECUCIÓN (1–10), independiente del resultado<input name="ejecucion" type="number" min="1" max="10"></label>
          <label>3 aprendizajes + 1 regla<textarea name="notas" rows="3" maxlength="600"></textarea></label>
          <button class="btn" type="submit">Guardar torneo (+40 XP)</button></form></details>
        ${(state.logs.torneos || []).length ? `<ul class="list">${state.logs.torneos.map(x => `<li><b>${h(x.nombre)}</b> ${h(x.fecha)} · ${x.spks.join('/')} (media ${E.avg(x.spks).toFixed(2)}) · equipo ${h(x.puesto || '?')} · ejecución ${h(x.ejecucion || '?')}<br><small>${h(x.notas || '')}</small> <button class="btn tiny ghost" data-action="del" data-list="torneos" data-id="${h(x.id)}">borrar</button></li>`).join('')}</ul>` : ''}
      </div>
      <div class="card"><h3>Autoevaluación en retos</h3>${chart2}</div>
      <div class="card"><h3>Examen de juez</h3><p class="muted">Mejor ${state.quiz.best || 0}% en ${state.quiz.attempts || 0} intentos. Línea punteada: aprobado 80 %. Cada intento queda guardado con su fecha.</p>${chart3}${worst.length ? `<p class="muted">Secciones que más fallas: ${worst.map(([s, n]) => `${h(s)} (${n})`).join(' · ')}</p>` : ''}${qh.length ? `<ul class="list">${qh.slice().reverse().slice(0, 12).map(x => `<li><b>${x.score}%</b> · ${h(x.fecha)} · ${x.correct}/${x.total} exactas <button class="btn tiny ghost" data-action="quiz-del" data-id="${h(String(x.id || qh.indexOf(x)))}">borrar</button>${(x.fallos || []).length ? `<br><small>falladas: ${x.fallos.map(h).join(', ')}</small>` : ''}</li>`).join('')}</ul>` : ''}</div>
      <div class="card"><h3>Contadores</h3><div class="counters">${[['📰 EL PAÍS', c.elpais], ['🎓 Talleres', c.taller], ['🎬 Reconstrucciones', c.rebuild], ['⚖️ Juez (miércoles)', c.judge], ['🥊 Drills', c.drill], ['📘 Manual', c.manual], ['🍺 Retos', (state.logs.retos || []).length], ['🧠 Psico', c.psico], ['📁 Fichas casefile', c.fichas]].map(([l, v]) => `<div><b>${v}</b><small>${h(l)}</small></div>`).join('')}</div></div>
      <div class="card"><h3>Fases</h3>${phases}</div>
      <div class="card"><h3>Logros</h3><div class="badges">${badges}</div></div>
      <div class="card"><h3>Feedback para Claude</h3><p>Cada pocas semanas (y después de cada torneo), copia este resumen o exporta el JSON y pégaselo a Claude junto con tus grabaciones. Con eso se ajusta el plan a lo que de verdad ha mejorado o empeorado.</p><div class="row"><button class="btn" data-action="copy-summary">Copiar resumen</button><button class="btn ghost" data-action="export">Exportar JSON</button></div><pre class="summary" id="summary">${h(E.summaryText(plan, state))}</pre></div>
    </section>`;
  }
  function lineChart(pts, o) {
    if (!pts.length) return '<p class="muted">Sin datos.</p>';
    const W = 640, H = 220, L = 36, R = 10, T = 10, B = 34; const min = o.min, max = o.max;
    const x = i => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1)); const y = v => T + (H - T - B) * (1 - (Math.min(Math.max(v, min), max) - min) / (max - min));
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
    const grid = []; for (let v = min; v <= max; v += (o.step || 2)) grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g"/><text x="${L - 6}" y="${y(v) + 4}" class="lab" text-anchor="end">${v}</text>`);
    const dots = pts.map((p, i) => `<g><circle cx="${x(i)}" cy="${y(p.y)}" r="4.5" class="dot"><title>${h(p.label)} · ${Number.isInteger(p.y) ? p.y : p.y.toFixed(2)}${p.y2 ? ' (torneo ' + p.y2 + ')' : ''}</title></circle>${p.y2 ? `<circle cx="${x(i)}" cy="${y(p.y2)}" r="3" class="dot2"><title>media del torneo ${p.y2}</title></circle>` : ''}<text x="${x(i)}" y="${H - 14}" class="lab" text-anchor="middle">${h(o.xfmt ? o.xfmt(p.x) : p.x.slice(2, 7))}</text></g>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="gráfico">${grid.join('')}${o.target ? `<line x1="${L}" x2="${W - R}" y1="${y(o.target)}" y2="${y(o.target)}" class="target"/><text x="${W - R}" y="${y(o.target) - 4}" class="lab" text-anchor="end">objetivo ${o.target}</text>` : ''}${o.base ? `<line x1="${L}" x2="${W - R}" y1="${y(o.base)}" y2="${y(o.base)}" class="base"/>` : ''}<path d="${path}" class="line"/>${dots}</svg>`;
  }

  // ---------- JUEZ ----------
  function viewJuez() {
    if (view.quiz) return quizView();
    const judgeTalleres = LIB.talleres.filter(t => /Juzgar|Deliberaci|Adjudicaci|Feedback|Puntos de orador|Toma de notas|Resolviendo Choques|Taller Completo/.test(t.c));
    const roadmap = [
      ['Trainee', 'Toma notas completas (flow por equipo y por choque). Ten un ranking propio ANTES de que hable la principal. Di tu ranking cuando te lo pidan, con una razón por comparativa, sin disculparte.'],
      ['Panel', 'Aporta una comparativa que la principal no haya mencionado. Discrepa con el guion de P9. Usa el lenguaje del manual (extensión, engagement, VPI, carga de la prueba). Da feedback con ejemplos literales.'],
      ['Principal', 'Abre la deliberación pidiendo impresiones, ordena por comparativas (Altas, Bajas, bancadas, diagonales), gestiona el tiempo para speaks, anuncia con ejemplos concretos. Examen ≥ 80 % antes de pedirlo.'],
    ].map(([a, b], i) => `<div class="step ${i === 0 ? 'cur' : ''}"><b>${a}</b><p>${h(b)}</p></div>`).join('');
    const qh = state.quiz.history || [];
    const qz = `<p>${D.QUIZ.length} preguntas de nivel examen real (CMUDE 2021/2022, CED VI): mini-casos por moción y selección múltiple que solo puntúa si aciertas el conjunto exacto. 15 por intento, preguntas y opciones barajadas. Mejor resultado: <b>${state.quiz.best || 0}%</b> en ${state.quiz.attempts || 0} intentos. Aprobado: 80 %.</p>${qh.length ? `<p class="muted">Últimas notas: ${qh.slice(-6).map(x => `${h(E.fmtShort(x.fecha))} <b>${x.score}%</b>`).join(' · ')} · <a href="#progreso">curva en Progreso</a></p>` : ''}<button class="btn" data-action="quiz-start">Empezar examen</button>`;
    return `<section class="juez">
      <div class="card"><h2>De trainee a principal</h2><p class="muted">${jp ? 'Practica el razonamiento en voz alta y el feedback específico.' : 'Tu historial: 22 rondas juzgadas, 18 como trainee, 4 como panel, 0 como principal. El salto se da en la deliberación, no en la sala.'}</p><div class="roadmap">${roadmap}</div></div>
      <div class="card"><h3>Examen de juez</h3>${qz}</div>
      <div class="card"><h3>Talleres de adjudicación (Debateca)</h3><div class="liblist">${judgeTalleres.slice(0, 60).map(t => `<a class="libitem" href="${h(t.u)}" target="_blank" rel="noopener"><small>${h(t.c)}</small><b>${h(t.t)}</b><span>${h(t.b)}</span></a>`).join('')}</div><p class="muted">Manual: secciones 3.1–3.5 y apéndices A–B. Exámenes reales en Debateca: <a href="${h(D.R.examen22.u)}" target="_blank" rel="noopener">CMUDE Madrid 2022</a> · <a href="${h(D.R.examen21.u)}" target="_blank" rel="noopener">CMUDE 2021</a>.</p></div>
    </section>`;
  }
  const setEq = (x, y) => x.size === y.size && [...x].every(v => y.has(v));
  function quizView() {
    const q = view.quiz; const n = q.items.length; const letters = 'abcdefgh';
    if (q.i >= n) {
      const score = Math.round(q.correct / n * 100);
      const verdict = score >= 80 ? '¡Aprobado! Brian levanta el martini.' : score >= 60 ? 'Cerca. En CMUDE 2021 la nota media del examen fue 4,0 sobre 10: esto ya es nivel panel. Relee las explicaciones de lo que fallaste.' : 'Todavía no. Relee las explicaciones de lo que fallaste y repite otro día: la memoria funciona así.';
      return `<section class="exam"><div class="exam-top"><button class="btn ghost small" data-action="quiz-exit">← Volver a Juez</button><span class="exam-sec">Resultado</span></div>
        <div class="exam-body qres"><div class="exam-score"><b>${score}%</b><span>${q.correct} de ${n} preguntas exactas · aprobado 80 % · guardado en Progreso</span></div><p class="exam-verdict">${h(verdict)}</p>
        <div class="exam-review">${q.review.map((r, k) => `<div class="qrev ${r.ok ? 'ok' : 'ko'}"><div class="kicker">${k + 1} · ${h(r.s)} · ${r.ok ? '✅ exacta' : '❌ fallada'}</div><b>${h(r.q)}</b>${r.ok ? '' : `<p class="mine">Tu selección: ${r.mine.length ? r.mine.map(h).join(' · ') : '—'}</p>`}<p class="corr">Correcto: ${r.correct.map(h).join(' · ')}</p><small>${h(r.exp)}</small></div>`).join('')}</div>
        <div class="exam-actions"><button class="btn" data-action="quiz-start">Repetir con otras preguntas</button><button class="btn ghost" data-action="quiz-exit">Salir</button></div></div></section>`;
    }
    const cur = q.items[q.i]; const done = q.answered;
    const cls = i => { if (!done) return q.sel.has(i) ? 'sel' : ''; const c = cur.a.has(i), s = q.sel.has(i); return c && s ? 'right' : c ? 'missed' : s ? 'wrong' : 'dim'; };
    const opts = cur.o.map((o, i) => `<button class="opt ${cls(i)}" data-action="${cur.multi ? 'quiz-toggle' : 'quiz-answer'}" data-i="${i}" ${done ? 'disabled' : ''}><span class="let">${letters[i]}</span><span>${h(o)}</span></button>`).join('');
    const ok = done && setEq(q.sel, cur.a);
    const foot = done
      ? `<div class="exam-exp ${ok ? '' : 'ko'}"><b>${ok ? 'Exacta.' : (cur.multi ? 'No es el conjunto exacto.' : 'Incorrecta.')}</b>${h(cur.exp)}</div><div class="exam-actions"><button class="btn" data-action="quiz-next">${q.i + 1 < n ? 'Siguiente →' : 'Ver resultado →'}</button><small class="muted">Enter para continuar</small></div>`
      : (cur.multi ? `<div class="exam-actions"><button class="btn" data-action="quiz-check" ${q.sel.size ? '' : 'disabled'}>Comprobar</button><small class="muted">Teclas a–${letters[cur.o.length - 1]} para marcar · Enter para comprobar</small></div>` : `<div class="exam-actions"><small class="muted">Teclas a–${letters[cur.o.length - 1]} para responder</small></div>`);
    return `<section class="exam"><div class="exam-top"><button class="btn ghost small" data-action="quiz-exit">← Salir</button><span>Pregunta ${q.i + 1} de ${n}</span><span class="exam-sec">${h(cur.s)}</span></div><div class="exam-bar"><i style="width:${(q.i + (done ? 1 : 0)) / n * 100}%"></i></div>
      <div class="exam-body" data-q="${q.i}">${cur.esc ? `<div class="exam-esc"><span class="exam-label">Escenario</span><p>${h(cur.esc)}</p></div>` : ''}<h2 class="exam-q">${h(cur.q)}</h2><p class="exam-hint">${cur.multi ? 'Selección múltiple: marca todas las correctas. Solo puntúa si aciertas el conjunto exacto.' : 'Una sola respuesta correcta.'}</p><div class="exam-opts">${opts}</div>${foot}</div></section>`;
  }
  function quizCheck() {
    const q = view.quiz; const cur = q.items[q.i]; const ok = setEq(q.sel, cur.a); q.answered = true; if (ok) q.correct++;
    q.review.push({ s: cur.s, q: cur.q, ok, mine: [...q.sel].sort((x, y) => x - y).map(i => cur.o[i]), correct: [...cur.a].sort((x, y) => x - y).map(i => cur.o[i]), exp: cur.exp });
    render();
  }
  function quizRecount() { const hs = state.quiz.history || []; state.quiz.attempts = hs.length; state.quiz.best = hs.reduce((m, x) => Math.max(m, Number(x.score) || 0), 0); }
  function quizFinish(q) {
    const n = q.items.length, score = Math.round(q.correct / n * 100);
    state.quiz.history = (state.quiz.history || []).concat([{ id: uid(), fecha: today(), score, correct: q.correct, total: n, fallos: q.review.filter(r => !r.ok).map(r => r.s) }]).slice(-200);
    quizRecount(); persist();
  }

  // ---------- PSICO ----------
  function viewPsico() {
    const sessions = D.PSYCH.map(p => { const t = Object.values(plan.index).find(x => x.psico === p.id); const done = t && state.done[t.id]; return `<div class="psess ${done ? 'done' : ''}"><b>${p.id} · ${h(p.titulo)}</b><small>${t ? 'S' + t.week + ' · ' + h(E.fmtShort(t.date)) : 'sin fecha'}${done ? ' · hecha' : ''}</small>${p.video ? `<a href="${h(p.video.u)}" target="_blank" rel="noopener">${h(p.video.t)} ↗</a>` : ''}<ol>${p.pasos.map(s => `<li>${h(s)}</li>`).join('')}</ol></div>`; }).join('');
    const pens = (state.logs.pensamientos || []).slice().reverse().map(p => `<li><span class="neg">"${h(p.pensamiento)}"</span><br><span class="pos">→ "${h(p.reformulacion)}"</span> <small>${h(p.fecha)}</small> <button class="btn tiny ghost" data-action="del" data-list="pensamientos" data-id="${h(p.id)}">borrar</button></li>`).join('');
    return `<section class="psico">
      <div class="card"><h2>La cabeza</h2><p class="muted">${jp ? 'Entrena la rutina de sala y registra cómo respondes a la presión en los torneos.' : 'Dato: online debates a 75,7 de media; presencial a 72,1. Mismo cerebro, distinta sala. Esta pestaña existe para cerrar esos 3,6 puntos.'}</p></div>
      <div class="card"><h3>Tarjeta de sala</h3><p class="muted">Lo que lees antes de entrar: frases de proceso, rutina, métricas favoritas, checklist de prep. Se guarda sola.</p><textarea id="tarjeta" class="tarjeta" rows="10" placeholder="Ej.:\n— Rutina: 4-7-8 ×4, pies en el suelo, palabra: «eslabón».\n— Proceso: mecanismo de 3 eslabones · comparativa antes del 5:00 · 2 POIs.\n— Si veo a alguien con reputación: es material, no persona. Busco su eslabón débil.\n— Métricas: probabilidad y reversibilidad.">${h(state.tarjeta || '')}</textarea></div>
      <div class="card"><h3>Registro de diálogo interno</h3><p class="muted">Cuando aparezca la frase, apúntala tal cual y reescríbela como instrucción de proceso. Con 10 entradas verás el patrón.</p>
        <form class="form inline" data-action="pens-save"><label>Lo que me dije<input name="pensamiento" required maxlength="200" placeholder="«este me va a destrozar»"></label><label>Reformulación de proceso<input name="reformulacion" required maxlength="200" placeholder="«escucho su mecanismo y busco el eslabón débil»"></label><button class="btn small" type="submit">Guardar (+3 XP)</button></form>
        ${pens ? `<ul class="list">${pens}</ul>` : ''}</div>
      <div class="card"><h3>Las 13 sesiones</h3><p class="muted">Cada dos semanas hasta marzo, luego cada tres. Aparecen como tarea de viernes en su semana.</p>${sessions}</div>
    </section>`;
  }

  // ---------- BIBLIOTECA ----------
  function viewBiblioteca() {
    const q = (view.q || '').toLowerCase().trim();
    const norm = s => String(s || '').toLowerCase();
    let list = '';
    if (view.libTab === 'talleres') {
      const cats = Array.from(new Set(LIB.talleres.map(t => t.c))).sort();
      const xs = LIB.talleres.filter(t => (!view.filtro || t.c === view.filtro) && (!q || norm(t.t + t.b + t.c).includes(q)));
      list = `<div class="row wrap"><select data-action="lib-filter"><option value="">Todas las categorías (${LIB.talleres.length})</option>${cats.map(c => `<option ${view.filtro === c ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></div><div class="liblist">${xs.slice(0, 200).map(t => `<a class="libitem" href="${h(t.u)}" target="_blank" rel="noopener"><small>${h(t.c)}</small><b>${h(t.t)}</b><span>${h(t.b)}</span></a>`).join('')}</div><p class="muted">${xs.length} resultados${xs.length > 200 ? ' (se muestran 200)' : ''}.</p>`;
    } else {
      const tors = Array.from(new Set(LIB.debates.map(d => d.to))).sort();
      const xs = LIB.debates.filter(d => (!view.filtro || d.to === view.filtro) && (!q || norm(d.m + d.to + d.te + d.ty + d.eq).includes(q)));
      list = `<div class="row wrap"><select data-action="lib-filter"><option value="">Todos los torneos (${LIB.debates.length} debates)</option>${tors.map(c => `<option ${view.filtro === c ? 'selected' : ''}>${h(c)}</option>`).join('')}</select><button class="btn small" data-action="lib-random">🎲 Debate sorpresa (moción sin ver la sala)</button></div>
        ${view.surprise ? `<div class="card surprise"><div class="kicker">Debate sorpresa</div><h4>${h(view.surprise.m)}</h4><p class="muted">${h(view.surprise.ty)} · ${h(view.surprise.te)} · ${h(view.surprise.to)} · ${h(view.surprise.r)}</p><div class="row"><button class="btn small" data-action="timer" data-min="15" data-label="Prep sorpresa">⏱ Prep 15</button><button class="btn small" data-action="timer" data-min="7" data-label="Discurso sorpresa">⏱ Discurso 7</button><a class="btn small ghost" href="${h(view.surprise.u)}" target="_blank" rel="noopener">Ver la sala real ↗</a></div></div>` : ''}
        <div class="liblist">${xs.slice(0, 150).map(d => `<a class="libitem deb" href="${h(d.u)}" target="_blank" rel="noopener"><small>${h(d.to)} · ${h(d.r)} · ${h(d.ty)} · ${h(d.te)}</small><b>${h(d.m)}</b><span>${h(d.eq)}${d.res ? ' · resultado: ' + h(d.res) : ''}</span></a>`).join('')}</div><p class="muted">${xs.length} resultados${xs.length > 150 ? ' (se muestran 150)' : ''}.</p>`;
    }
    return `<section class="lib"><h2>Biblioteca (Debateca 2026)</h2><div class="row"><button class="btn small ${view.libTab === 'talleres' ? '' : 'ghost'}" data-action="lib-tab" data-tab="talleres">Talleres (${LIB.talleres.length})</button><button class="btn small ${view.libTab === 'debates' ? '' : 'ghost'}" data-action="lib-tab" data-tab="debates">Debates grabados (${LIB.debates.length})</button><input class="search" data-action="lib-search" placeholder="Buscar: extensión, látigo, economía, Moldavia…" value="${h(view.q)}"></div>${list}</section>`;
  }

  // ---------- AJUSTES ----------
  function casefileURL(value) {
    const match = /^https:\/\/docs\.google\.com\/document\/d\/([\w-]+)(?:[/?#]|$)/.exec(value);
    return match ? `https://docs.google.com/document/d/${match[1]}/edit` : '';
  }
  function viewAjustes() {
    const rows = plan.tournaments.map(t => `<tr><td><input data-action="t-edit" data-id="${h(t.id)}" data-k="nombre" value="${h(t.nombre)}" maxlength="80"></td><td><input type="date" data-action="t-edit" data-id="${h(t.id)}" data-k="inicio" value="${h(t.inicio)}"></td><td><input type="date" data-action="t-edit" data-id="${h(t.id)}" data-k="fin" value="${h(t.fin)}"></td><td><select data-action="t-edit" data-id="${h(t.id)}" data-k="rol">${['debatiente', 'juez', 'ver', 'organizo'].map(r => `<option ${t.rol === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td><button class="btn tiny ghost danger" data-action="t-del" data-id="${h(t.id)}">✕</button></td></tr>`).join('');
    const casefile = jp ? `<div class="card"><h3>Mi casefile</h3>
      <p>Crea un documento en <a href="https://docs.new/" target="_blank" rel="noopener">Google Docs</a> y guarda aquí su enlace para abrirlo desde tus tareas.</p>
      <form class="form inline" data-action="casefile-save"><label>Enlace de Google Docs<input name="url" type="url" value="${h(state.casefileUrl)}"></label><button class="btn small" type="submit">Guardar enlace</button></form></div>` : '';
    return `<section class="ajustes">
      <div class="card"><h2>Torneos</h2><p class="muted">Las fechas 2027 son estimadas por el patrón de 2025/2026. Cámbialas cuando salgan las convocatorias: el plan (semanas pre-torneo y autopsias) se recoloca solo donde esté enlazado por id; los nuevos aparecen en el calendario y en "próximo torneo".</p>
        <table class="ttable"><thead><tr><th>Nombre</th><th>Inicio</th><th>Fin</th><th>Rol</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        <form class="form inline" data-action="t-add"><label>Nuevo torneo<input name="nombre" required maxlength="80"></label><label>Inicio<input name="inicio" type="date" required></label><label>Fin<input name="fin" type="date" required></label><label>Rol<select name="rol"><option>debatiente</option><option>juez</option><option>ver</option></select></label><button class="btn small" type="submit">Añadir</button></form></div>
      ${casefile}
      <div class="card"><h3>Datos</h3><p>Perfil de ${h(D.CONFIG.nombre)} · <a href="${jp ? 'index.html#ajustes' : 'index.html?perfil=jp#ajustes'}">Abrir el perfil de ${jp ? 'Germán' : 'JP'}</a></p><p>Todo se guarda en este navegador (sin cuentas ni servidores). Exporta de vez en cuando: es tu copia de seguridad y lo que le mandas a Claude.</p>
        <div class="row wrap"><button class="btn" data-action="export">Exportar progreso (JSON)</button><label class="btn ghost">Importar JSON<input type="file" accept="application/json" data-action="import" hidden></label><button class="btn ghost" data-action="copy-summary">Copiar resumen de texto</button><button class="btn danger ghost" data-action="reset">Borrar todo</button></div>
        <p class="muted">Semanas avisadas: ${(state.lostWeeks || []).length ? state.lostWeeks.join(', ') : 'ninguna'}. Estado creado el ${h(state.created || '?')}.</p></div>
      ${jp ? `<div class="card"><h3>Recursos del plan</h3><p>33 semanas de entrenamiento BP hacia el CMUDE 2027. Para los PDF de Debateca, abre la app desde una copia del repositorio con la carpeta <code>Debateca 2026</code> en la raíz.</p><p><a href="${h(D.R.manual.u)}" target="_blank" rel="noopener">Manual CMUDE 2026</a></p></div>` : `<div class="card"><h3>Cómo se diseñó esto</h3><p>Plan de 33 semanas (9 nov 2026 → 25 jun 2027) construido a partir de: tus 11 discursos del XI BP UAM y del Elías Ahuja 2026, tus 63 rondas en bpringaos, el Manual CMUDE 2026 y la Debateca 2026. Estrategia copiada de quienes mejoran de verdad: reconstruir discursos de salas altas antes de verlos, adjudicar debates reales y compararse con el panel, repetir los propios discursos tras el feedback, leer el manual entero, drills cortos grabados y una hora de cabeza cada dos semanas.</p><p class="muted">Documentos: <a href="../docs/ANALISIS_DISCURSOS.html" target="_blank" rel="noopener">Análisis de tus discursos</a> · <a href="../docs/README.html" target="_blank" rel="noopener">Manual de uso</a> · <a href="../docs/HANDOFF.html" target="_blank" rel="noopener">Estado del proyecto (para Claude)</a>. Archivos: <code>app/data.js</code> (plan editable), <code>app/library.js</code> (Debateca).</p></div>`}
    </section>`;
  }

  // ---------- acciones ----------
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action;
    if (a === 'toggle') return; // lo gestiona change
    if (a === 'open') { view.open[el.dataset.id] = !view.open[el.dataset.id]; const card = el.closest('.task'); if (card) card.classList.toggle('open'); return; }
    if (a === 'timer') { startTimer(Number(el.dataset.min), el.dataset.label || ''); toast('Cronómetro en marcha: ' + el.dataset.label); return; }
    if (a === 'timer-stop') { stopTimer(); return; }
    if (a === 'week') { view.week = Number(el.dataset.n); render(); return; }
    if (a === 'goto-week') { view.week = Number(el.dataset.n); location.hash = '#semana'; return; }
    if (a === 'lose') { const n = Number(el.dataset.n); if (!confirm(`¿Avisar que la semana ${n} no puedes? Sus tareas núcleo se repartirán en las 3 semanas siguientes.`)) return; if (!state.lostWeeks.includes(n)) state.lostWeeks.push(n); persist(); rebuild(); toast(rnd(D.QUIPS.lost)); render(); return; }
    if (a === 'unlose') { const n = Number(el.dataset.n); state.lostWeeks = state.lostWeeks.filter(x => x !== n); persist(); rebuild(); render(); return; }
    if (a === 'reveal') { const s = document.getElementById('rev-' + el.dataset.id); if (s) s.classList.remove('hidden'); return; }
    if (a === 'reto-random') { const d = rnd(LIB.debates.filter(x => x.m)); const t = plan.index[el.dataset.id]; if (t && d) { t.motion = d.m; t.steps[0] = `Moción: ${d.m} (${d.to}, ${d.r}). Después, búscala en Biblioteca para ver la sala.`; render(); toast('Nueva moción cargada'); } return; }
    if (a === 'export') return exportJSON();
    if (a === 'copy-summary') { const txt = E.summaryText(plan, state); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Resumen copiado'), () => { const p = $('#summary'); if (p) { const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Selecciona y copia el texto del resumen'); }); return; }
    if (a === 'reset') { if (confirm(`¿Borrar todo el progreso de ${D.CONFIG.nombre} en este navegador? Exporta antes si quieres conservarlo.`)) { state = E.defaultState(); persist(); rebuild(); render(); toast('Todo borrado. Hola, Meg.'); } return; }
    if (a === 'del') { const l = el.dataset.list; state.logs[l] = (state.logs[l] || []).filter(x => x.id !== el.dataset.id); persist(); render(); return; }
    if (a === 'quiz-start') {
      const pick = D.QUIZ.slice().sort(() => Math.random() - 0.5).slice(0, 15);
      const items = pick.map(it => { const idx = it.o.map((_, i) => i).sort(() => Math.random() - 0.5); return Object.assign({}, it, { o: idx.map(i => it.o[i]), a: new Set(it.a.map(ai => idx.indexOf(ai))) }); });
      view.quiz = { items, i: 0, correct: 0, answered: false, sel: new Set(), review: [] }; render(); window.scrollTo(0, 0); return;
    }
    if (a === 'quiz-toggle') { const q = view.quiz; if (!q || q.answered) return; const i = Number(el.dataset.i); if (q.sel.has(i)) q.sel.delete(i); else q.sel.add(i); render(); return; }
    if (a === 'quiz-answer') { const q = view.quiz; if (!q || q.answered) return; q.sel = new Set([Number(el.dataset.i)]); quizCheck(); return; }
    if (a === 'quiz-check') { const q = view.quiz; if (!q || q.answered || !q.sel.size) return; quizCheck(); return; }
    if (a === 'quiz-next') { const q = view.quiz; if (!q || !q.answered) return; q.i++; q.answered = false; q.sel = new Set(); if (q.i >= q.items.length) quizFinish(q); render(); window.scrollTo(0, 0); return; }
    if (a === 'quiz-exit') { view.quiz = null; render(); return; }
    if (a === 'quiz-del') { if (!confirm('¿Borrar este intento del historial?')) return; state.quiz.history = (state.quiz.history || []).filter((x, k) => String(x.id || k) !== el.dataset.id); quizRecount(); persist(); render(); return; }
    if (a === 'lib-tab') { view.libTab = el.dataset.tab; view.filtro = ''; view.surprise = null; render(); return; }
    if (a === 'lib-random') { const seen = new Set(state.seenDebates || []); const pool = LIB.debates.filter(d => d.m && d.u && !seen.has(d.u)); const d = rnd(pool.length ? pool : LIB.debates); if (d) { view.surprise = d; state.seenDebates = (state.seenDebates || []).concat([d.u]).slice(-400); persist(); render(); } return; }
    if (a === 't-del') { const id = el.dataset.id; if (!confirm('¿Quitar este torneo del plan?')) return; state.tournaments[id] = Object.assign(state.tournaments[id] || {}, { deleted: true }); persist(); rebuild(); render(); return; }
  });
  document.addEventListener('change', ev => {
    const el = ev.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action;
    if (a === 'toggle') {
      const id = el.dataset.id; const t = plan.index[id];
      if (el.checked) { state.done[id] = today(); toast(`+${t ? t.xp : 0} XP · ${rnd(D.QUIPS.done)}`, 'ok'); const r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 18); }
      else delete state.done[id];
      persist(); render(); return;
    }
    if (a === 'lib-filter') { view.filtro = el.value; render(); return; }
    if (a === 't-edit') { const id = el.dataset.id, k = el.dataset.k; state.tournaments[id] = Object.assign(state.tournaments[id] || {}, { [k]: el.value, estimado: false }); persist(); rebuild(); if (k !== 'nombre') render(); return; }
    if (a === 'import') {
      const file = el.files && el.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          const progress = data?.app === 'QDC' ? data.state : data;
          if (!progress?.done || typeof progress.done !== 'object') throw new Error('formato');
          if ((data.perfil || 'german') !== D.CONFIG.perfil) {
            el.value = '';
            return toast('Ese archivo pertenece a otro perfil.', 'warn');
          }
          state = E.migrate(progress);
          persist(); rebuild(); render(); toast('Progreso importado', 'ok');
        } catch (e) {
          el.value = '';
          toast('Ese archivo no es un progreso válido', 'warn');
        }
      };
      reader.readAsText(file);
    }
  });
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (el.id === 'tarjeta') { state.tarjeta = el.value.slice(0, 4000); persist(); return; }
    if (el.dataset.action === 'lib-search') { view.q = el.value; clearTimeout(view._st); view._st = setTimeout(() => { const pos = el.selectionStart; render(); const s = document.querySelector('.search'); if (s) { s.focus(); try { s.setSelectionRange(pos, pos); } catch (e) { /* */ } } }, 250); }
  });
  document.addEventListener('submit', ev => {
    const f = ev.target.closest('form[data-action]'); if (!f) return; ev.preventDefault();
    const a = f.dataset.action; const fd = new FormData(f); const g = k => String(fd.get(k) || '').trim();
    if (a === 'casefile-save' && jp) {
      const value = g('url');
      const url = casefileURL(value);
      if (value && !url) return toast('Introduce un enlace a un documento de Google Docs.', 'warn');
      state.casefileUrl = url;
      persist(); render(); toast('Enlace guardado', 'ok'); return;
    }
    if (a === 'reto-save') {
      const t = plan.index[f.dataset.id]; const vals = [0, 1, 2, 3].map(i => Number(fd.get('r' + i) || 2)); const est = Math.round((70 + (E.avg(vals) - 1) * 3) * 10) / 10;
      state.logs.retos.push({ id: uid(), taskId: f.dataset.id, fecha: today(), motion: t ? t.motion : '', est, vals, carac: g('carac'), mulet: g('mulet'), comp: g('comp') === '1', cierre: g('cierre') === '1', notas: g('notas') }); if (t) state.done[t.id] = today(); persist(); render(); toast(`Reto guardado · estimación ${est}. ${rnd(D.QUIPS.done)}`, 'ok'); return;
    }
    if (a === 'torneo-save') {
      const spks = g('spks').split(/[,\s;]+/).map(Number).filter(x => x >= 50 && x <= 100); if (!spks.length) return toast('Speaks no válidos (50–100)', 'warn');
      state.logs.torneos.push({ id: uid(), nombre: g('nombre'), fecha: g('fecha'), spks, tavg: g('tavg'), puesto: g('puesto'), ejecucion: g('ejecucion'), notas: g('notas') }); persist(); render(); toast('Torneo registrado. Autopsia hecha.', 'ok'); return;
    }
    if (a === 'pens-save') { state.logs.pensamientos.push({ id: uid(), fecha: today(), pensamiento: g('pensamiento'), reformulacion: g('reformulacion') }); persist(); render(); toast('Registrado. Stewie toma nota.', 'ok'); return; }
    if (a === 't-add') { const id = 't' + uid(); state.tournaments[id] = { nombre: g('nombre'), inicio: g('inicio'), fin: g('fin') || g('inicio'), rol: g('rol'), lugar: '', estimado: false }; persist(); rebuild(); render(); toast('Torneo añadido', 'ok'); return; }
  });
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ exportado: today(), app: 'QDC', perfil: D.CONFIG.perfil, state }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `qdc-progreso-${jp ? 'jp-' : ''}${today()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('Exportado. Mándaselo a Claude cuando toque.', 'ok');
  }
  document.addEventListener('keydown', ev => {
    const q = view.quiz; if (!q || view.route !== 'juez' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((ev.target && ev.target.tagName) || '')) return;
    if (q.i >= q.items.length) return;
    if (ev.key === 'Enter') { const b = $(q.answered ? '[data-action=quiz-next]' : '[data-action=quiz-check]'); if (b && !b.disabled) { ev.preventDefault(); b.click(); } return; }
    const i = 'abcdefgh'.indexOf(ev.key.toLowerCase()); if (i >= 0 && i < q.items[q.i].o.length && !q.answered) { const b = $(`.exam .opt[data-i="${i}"]`); if (b) { ev.preventDefault(); b.click(); } }
  });
  window.addEventListener('hashchange', () => { view.route = (location.hash || '#hoy').slice(1); view.quiz = view.route === 'juez' ? view.quiz : null; render(); window.scrollTo(0, 0); });
  view.route = (location.hash || '#hoy').slice(1) || 'hoy';
  render();
})();
