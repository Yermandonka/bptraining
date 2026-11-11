// Test de interfaz (Playwright + Chrome del sistema). Uso:
//   node tools/e2e.mjs            (usa playwright de ~/Projects/bichimeca/node_modules si no está instalado aquí)
// Cada línea PASS/FAIL es una comprobación; al final imprime los errores de consola.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/home/yermandonka/Projects/bichimeca/node_modules/playwright')); }
const BASE = 'file:///home/yermandonka/Projects/bptraining/app/index.html';
const U = (d, r) => `${BASE}?today=${d}#${r}`;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
async function fresh() { const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); }); p.on('dialog', d => d.accept()); return p; }
const txt = async (p, sel) => (await p.textContent(sel)) || '';

{ // hoy, tareas, persistencia
  const p = await fresh(); await p.goto(U('2026-11-11', 'hoy')); await p.waitForSelector('.task');
  await p.click('.task .chk'); await p.waitForTimeout(150);
  ok(/\b(7[2-9]|8\d) XP/.test(await txt(p, '.lvl')), 'XP sube al completar (tarea + bonus de racha)');
  await p.click('.task .ttitle'); await p.waitForTimeout(500); ok((await p.$eval('.task.open .tinner', e => e.getBoundingClientRect().height)) > 40, 'detalle de tarea se abre');
  await p.reload(); await p.waitForSelector('.task'); ok((await p.$$('.task.done')).length >= 1, 'persistencia tras recargar');
  // semana: avisar
  await p.goto(U('2026-11-11', 'semana')); await p.waitForSelector('.wnav'); await p.click('[data-action=lose]'); await p.waitForTimeout(150);
  ok(await p.isVisible('[data-action=unlose]'), 'semana avisada');
  await p.click('[data-action=week][data-n="2"]'); await p.waitForTimeout(150); ok(/Recuperación S1/.test(await txt(p, 'body')), 'recuperación en S2');
  await p.click('[data-action=week][data-n="1"]'); await p.click('[data-action=unlose]'); await p.waitForTimeout(150); ok(await p.isVisible('[data-action=lose]'), 'aviso deshecho');
  // juez: quiz + rúbrica
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('qdc-state-v1')); s.quiz = { best: 100, attempts: 1 }; localStorage.setItem('qdc-state-v1', JSON.stringify(s)); });
  await p.goto(U('2026-11-11', 'juez')); await p.waitForSelector('[data-action=quiz-start]'); ok(/<b>0%<\/b> en 0 intentos/.test(await p.content()), 'intento del examen antiguo (sin historial) descartado'); await p.click('[data-action=quiz-start]');
  ok(!(await p.isVisible('.top')), 'modo examen oculta la cabecera');
  for (let i = 0; i < 15; i++) { await p.waitForSelector('.exam .opt'); await p.click('.exam .opt'); if (await p.$('[data-action=quiz-check]')) await p.click('[data-action=quiz-check]'); await p.waitForSelector('[data-action=quiz-next]'); await p.click('[data-action=quiz-next]'); }
  await p.waitForSelector('.exam-score'); ok(/%/.test(await txt(p, '.exam-score b')), 'examen termina con resultado');
  await p.click('[data-action=quiz-exit]'); await p.waitForSelector('[data-action=quiz-start]'); ok(/en 1 intentos/.test(await txt(p, 'body')), 'nota del examen guardada en el historial');
  await p.reload(); await p.waitForSelector('[data-action=quiz-start]'); ok(/Últimas notas/.test(await txt(p, 'body')), 'historial del examen persiste');
  // psico
  await p.goto(U('2026-11-11', 'psico')); await p.waitForSelector('#tarjeta'); await p.fill('#tarjeta', 'Mi tarjeta');
  await p.fill('form[data-action=pens-save] input[name=pensamiento]', 'a'); await p.fill('form[data-action=pens-save] input[name=reformulacion]', 'b'); await p.click('form[data-action=pens-save] button[type=submit]');
  await p.reload(); await p.waitForSelector('#tarjeta'); ok((await p.inputValue('#tarjeta')) === 'Mi tarjeta', 'tarjeta persiste');
  // progreso: torneo + logros
  await p.goto(U('2026-11-11', 'progreso')); await p.waitForSelector('details summary'); await p.click('details summary');
  await p.fill('form[data-action=torneo-save] input[name=nombre]', 'Torneo test'); await p.fill('form[data-action=torneo-save] input[name=spks]', '74, 75, 76'); await p.click('form[data-action=torneo-save] button[type=submit]'); await p.waitForTimeout(150);
  ok(/Torneo test/.test(await txt(p, 'body')), 'torneo registrado'); ok((await p.$$('.badge.on')).length >= 2, 'logros concedidos');
  // biblioteca
  await p.goto(U('2026-11-11', 'biblioteca')); await p.waitForSelector('.search'); await p.fill('.search', 'látigo'); await p.waitForTimeout(400); ok((await p.$$('.libitem')).length > 3, 'búsqueda de talleres');
  await p.click('[data-action=lib-tab][data-tab=debates]'); await p.click('[data-action=lib-random]'); await p.waitForTimeout(150); ok(await p.isVisible('.surprise'), 'debate sorpresa');
  // ajustes: torneo nuevo + export
  await p.goto(U('2026-11-11', 'ajustes')); await p.waitForSelector('.ttable');
  await p.fill('form[data-action=t-add] input[name=nombre]', 'Torneo nuevo'); await p.fill('form[data-action=t-add] input[name=inicio]', '2027-01-15'); await p.fill('form[data-action=t-add] input[name=fin]', '2027-01-17'); await p.click('form[data-action=t-add] button[type=submit]'); await p.waitForTimeout(150);
  ok((await p.$$eval('.ttable input', els => els.map(e => e.value).join('|'))).includes('Torneo nuevo'), 'torneo añadido');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-action=export]')]); ok(/qdc-progreso/.test(dl.suggestedFilename()), 'exportar JSON');
  // calendario
  await p.goto(U('2026-11-11', 'calendario')); await p.waitForSelector('.day'); await p.click('.day.tourn'); await p.waitForTimeout(150); ok(/Semana \d+/.test(await txt(p, '.wtitle')), 'día del calendario lleva a su semana');
  // fechas especiales
  await p.goto(U('2026-11-14', 'hoy')); await p.waitForSelector('.hoy'); ok(/Fin de semana/.test(await txt(p, '.hoy')), 'fin de semana');
  await p.goto(U('2026-10-28', 'hoy')); await p.waitForSelector('.hoy'); ok(/El plan empieza el/.test(await txt(p, '.hoy')), 'pre-inicio');
  await p.goto(U('2027-03-24', 'hoy')); await p.waitForSelector('.hoy'); ok(/Semana 20/.test(await txt(p, '.hoy')), 'semana ligera 20');
  await p.goto(U('2027-07-10', 'hoy')); await p.waitForSelector('.hoy'); ok(/Temporada terminada/.test(await txt(p, '.hoy')), 'post-temporada');
  await p.context().close();
}
{ // reto + cronómetro + semana 0 + fecha real
  const p = await fresh(); await p.goto(U('2026-11-20', 'hoy')); await p.waitForSelector('.task');
  ok(/Reto cronometrado/.test(await txt(p, '.tasks')), 'viernes S2 tiene reto');
  const reto = p.locator('.task[data-id$="fri-reto"]'); await reto.locator('.ttitle').click(); await p.waitForTimeout(400);
  await p.fill('form[data-action=reto-save] input[name=carac]', '55'); await p.fill('form[data-action=reto-save] input[name=mulet]', '4'); await p.click('form[data-action=reto-save] button[type=submit]'); await p.waitForTimeout(150);
  ok(/Registrado: estimación/.test(await txt(p, 'body')), 'reto guardado con rúbrica');
  await p.goto(U('2026-11-20', 'progreso')); await p.waitForSelector('.summary'); ok(/muletillas\/min 4/.test(await txt(p, '.summary')), 'resumen incluye muletillas/min');
  await p.goto(U('2026-11-20', 'hoy')); await p.waitForSelector('.task'); const r2 = p.locator('.task[data-id$="fri-reto"]'); if (!(await r2.evaluate(e => e.classList.contains('open')))) await r2.locator('.ttitle').click(); await p.waitForTimeout(400); await r2.locator('[data-action=timer][data-min="7"]').click(); await p.waitForTimeout(700); ok(/7:00|6:5\d/.test(await txt(p, '#timerbar')), 'cronómetro corre');
  await p.goto(BASE + '#hoy'); await p.waitForSelector('.hoy h1'); ok(!/Cargando el club/.test(await txt(p, '#app')), 'fecha real renderiza');
  await p.goto(U('2026-11-04', 'hoy')); await p.waitForSelector('.hoy'); ok(/Semana 0/.test(await txt(p, '.hoy')), 'semana 0 renderiza (arranque recolocado)');
  await p.goto(U('2026-11-17', 'hoy')); await p.waitForSelector('.task'); ok(/Recuperada del arranque · Tom Tucker I/.test(await txt(p, '.tasks')), 'martes 17: Tom Tucker I recolocado');
  await p.goto(U('2026-11-11', 'hoy')); await p.waitForSelector('.task'); ok(/Recuperada del arranque · Lee tu diagnóstico/.test(await txt(p, '.tasks')), 'miércoles 11: diagnóstico recolocado');
  await p.goto(U('2026-11-09', 'semana')); await p.waitForSelector('.wnav'); ok((await txt(p, '.days')).match(/Tom Tucker|Estilo:/g).length >= 4, 'S1 tiene las sesiones de estilo');
  await p.goto(U('2026-11-04', 'semana')); await p.waitForSelector('.wnav'); ok(await p.isDisabled('[data-action=week][data-n="-1"]'), 'no hay S-1');
  await p.context().close();
}
{ // casefile
  const p = await fresh(); await p.goto(U('2026-11-11', 'hoy')); await p.waitForSelector('.task');
  ok(!/Casefile/.test(await txt(p, 'nav')), 'no hay pestaña Casefile');
  await p.goto(U('2026-11-11', 'casefile')); await p.waitForSelector('.task'); ok(true, '#casefile antiguo cae en Hoy');
  await p.goto(U('2026-11-16', 'hoy')); await p.waitForSelector('.task'); ok(/Mi casefile \(Google Docs\)/.test(await txt(p, '.tasks')) && /Documental/.test(await txt(p, '.tasks')), 'lunes S2: documental y enlace al Google Doc');
  await p.goto(U('2026-11-09', 'hoy')); await p.waitForSelector('.task'); ok(/ficha de casefile: Economía/.test(await txt(p, '.tasks')), 'lunes S1 enlaza tema');
  await p.goto(U('2027-02-04', 'hoy')); await p.waitForSelector('.task'); ok(/Ficha exprés/.test(await txt(p, '.tasks')), 'jueves S13 ficha exprés');
  await p.context().close();
}
await browser.close();
console.log('ERRORS:', errors.length ? errors : 'none');
console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails || errors.length ? 1 : 0);
