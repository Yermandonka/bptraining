#!/usr/bin/env python3
"""Convierte los .md del proyecto a HTML con el estilo de la app (sin dependencias).
Uso: python3 tools/md2html.py            → genera docs/*.html para README, HANDOFF y ANALISIS_DISCURSOS
     python3 tools/md2html.py archivo.md → genera docs/archivo.html
"""
import html, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs')

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', t)
    t = re.sub(r'(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])', r'<em>\1</em>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', t)
    t = re.sub(r'\[\[([^\]]+)\]\]', r'<em>\1</em>', t)
    return t

def convert(md):
    lines = md.split('\n'); out = []; i = 0
    def flush_para(buf):
        if buf: out.append('<p>' + inline(' '.join(buf)) + '</p>')
    buf = []
    while i < len(lines):
        l = lines[i]
        if l.startswith('```'):
            flush_para(buf); buf = []; code = []; i += 1
            while i < len(lines) and not lines[i].startswith('```'): code.append(lines[i]); i += 1
            out.append('<pre><code>' + html.escape('\n'.join(code)) + '</code></pre>'); i += 1; continue
        m = re.match(r'^(#{1,6})\s+(.*)', l)
        if m:
            flush_para(buf); buf = []; lvl = len(m.group(1)); txt = m.group(2).strip()
            out.append(f'<h{lvl}>{inline(txt)}</h{lvl}>'); i += 1; continue
        if re.match(r'^\s*(-{3,}|\*{3,})\s*$', l):
            flush_para(buf); buf = []; out.append('<hr>'); i += 1; continue
        if l.startswith('>'):
            flush_para(buf); buf = []; q = []
            while i < len(lines) and lines[i].startswith('>'): q.append(lines[i][1:].strip()); i += 1
            out.append('<blockquote>' + inline(' '.join(q)) + '</blockquote>'); continue
        if '|' in l and i + 1 < len(lines) and re.match(r'^\s*\|?\s*:?-{2,}', lines[i + 1]):
            flush_para(buf); buf = []
            head = [c.strip() for c in l.strip().strip('|').split('|')]; i += 2; rows = []
            while i < len(lines) and '|' in lines[i] and lines[i].strip():
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')]); i += 1
            t = '<table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead><tbody>'
            for r in rows: t += '<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>'
            out.append(t + '</tbody></table>'); continue
        m = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)', l)
        if m:
            flush_para(buf); buf = []
            ordered = m.group(2)[0].isdigit(); tag = 'ol' if ordered else 'ul'; items = []
            while i < len(lines):
                m2 = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)', lines[i])
                if m2 and (m2.group(2)[0].isdigit()) == ordered:
                    items.append(m2.group(3)); i += 1
                elif lines[i].startswith('  ') and items and lines[i].strip():
                    items[-1] += ' ' + lines[i].strip(); i += 1
                else: break
            out.append(f'<{tag}>' + ''.join(f'<li>{inline(x)}</li>' for x in items) + f'</{tag}>'); continue
        if not l.strip():
            flush_para(buf); buf = []; i += 1; continue
        buf.append(l.strip()); i += 1
    flush_para(buf)
    return '\n'.join(out)

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Nunito:ital,wght@0,400;0,600;0,800;1,400&display=swap');
:root{--bg:#070a14;--card:#111a2e;--line:#24314d;--ink:#e9edf7;--muted:#8f9bb8;--neon:#19d3c5;--pink:#ff5c8a;--yellow:#ffd23f}
*{box-sizing:border-box} html{color-scheme:dark} body{margin:0;background-color:var(--bg);background-image:radial-gradient(1200px 600px at 80% -10%,#16213d 0%,transparent 60%),radial-gradient(900px 500px at -10% 110%,#1a1230 0%,transparent 55%);background-attachment:fixed;color:var(--ink);font:16px/1.65 'Nunito',system-ui,sans-serif}
main{max-width:900px;margin:0 auto;padding:32px 20px 80px} nav a{color:var(--muted);text-decoration:none;font-weight:800;margin-right:16px} nav a:hover{color:var(--neon)}
h1{font:38px/1.1 'Luckiest Guy',Impact,sans-serif;color:var(--neon);text-shadow:0 0 14px rgba(25,211,197,.5);margin:.4em 0} h2{font:26px/1.15 'Luckiest Guy',Impact,sans-serif;color:var(--pink);margin:1.6em 0 .5em;border-bottom:1px solid var(--line);padding-bottom:.25em} h3{font-size:19px;font-weight:800;color:var(--yellow);margin:1.4em 0 .4em}
p{margin:.6em 0} a{color:var(--neon)} code{background:#0d1222;border:1px solid var(--line);padding:1px 6px;border-radius:6px;font-size:.9em} pre{background:#0d1222;border:1px solid var(--line);border-radius:10px;padding:12px;overflow:auto} pre code{border:0;padding:0}
blockquote{border-left:4px solid var(--yellow);margin:1em 0;padding:8px 14px;background:rgba(255,210,63,.06);border-radius:0 10px 10px 0;color:var(--muted)}
table{width:100%;border-collapse:collapse;margin:1em 0;font-size:14.5px;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden} th,td{padding:9px 10px;text-align:left;vertical-align:top;border-top:1px solid var(--line)} th{background:#0d1222;color:var(--muted);font-size:12px;letter-spacing:1px;text-transform:uppercase} tr:hover td{background:rgba(25,211,197,.05)}
ul,ol{padding-left:1.4em} li{margin:.3em 0} hr{border:0;border-top:1px solid var(--line);margin:2em 0} strong{color:#fff}
.meta{color:var(--muted);font-size:13px;margin-bottom:24px}
@media (max-width:640px){h1{font-size:30px} table{display:block;overflow-x:auto}}
"""

def build(src):
    name = os.path.splitext(os.path.basename(src))[0]
    md = open(src, encoding='utf-8').read()
    body = convert(md)
    title = re.search(r'^#\s+(.*)', md, re.M); title = title.group(1) if title else name
    nav = ' '.join(f'<a href="{n}.html">{n}</a>' for n in ['README', 'ANALISIS_DISCURSOS', 'HANDOFF']) + ' <a href="../app/index.html">← app</a>'
    page = f'<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><style>{CSS}</style></head><body><main><nav>{nav}</nav><div class="meta">Generado desde <code>{os.path.basename(src)}</code> con <code>tools/md2html.py</code>. Edita el .md y vuelve a ejecutar el script.</div>{body}</main></body></html>'
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, name + '.html'); open(dst, 'w', encoding='utf-8').write(page); print('→', os.path.relpath(dst, ROOT))

if __name__ == '__main__':
    files = sys.argv[1:] or [os.path.join(ROOT, f) for f in ('README.md', 'ANALISIS_DISCURSOS.md', 'HANDOFF.md')]
    for f in files: build(f)
