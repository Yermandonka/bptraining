// Transcribe m4a speeches to text with local Whisper (transformers.js) + ffmpeg-static.
// Usage: node transcribe.mjs <model> <outdir> <file1.m4a> [file2 ...]
import { pipeline, env } from '@huggingface/transformers';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

env.cacheDir = join(process.cwd(), '.models');
const [model, outdir, ...files] = process.argv.slice(2);
if (!model || !outdir || files.length === 0) { console.error('usage: node transcribe.mjs <model> <outdir> <files...>'); process.exit(1); }
mkdirSync(outdir, { recursive: true });

function decode(file) {
  const r = spawnSync(ffmpegPath, ['-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${r.stderr}`);
  const buf = r.stdout;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

console.error(`loading ${model} ...`);
const t0 = Date.now();
const asr = await pipeline('automatic-speech-recognition', model, { dtype: process.env.DTYPE || 'q8' });
console.error(`model ready in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

for (const f of files) {
  const out = join(outdir, basename(f).replace(/\.m4a$/i, '') + '.txt');
  if (existsSync(out)) { console.error(`skip (exists): ${out}`); continue; }
  const t1 = Date.now();
  let audio;
  try { audio = decode(f); } catch (e) { console.error(String(e)); continue; }
  const dur = audio.length / 16000;
  console.error(`${basename(f)}: ${dur.toFixed(0)}s audio`);
  if (dur < 5) { writeFileSync(out, `[audio demasiado corto: ${dur.toFixed(1)}s]\n`); continue; }
  const res = await asr(audio, { language: 'spanish', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
  const lines = (res.chunks || []).map(c => {
    const [a, b] = c.timestamp; const fmt = s => s == null ? '--:--' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    return `[${fmt(a)}-${fmt(b)}] ${c.text.trim()}`;
  });
  writeFileSync(out, `# ${basename(f)}  (${dur.toFixed(0)}s)\n\n${res.text.trim()}\n\n## con tiempos\n${lines.join('\n')}\n`);
  console.error(`  -> ${out}  (${((Date.now() - t1) / 1000).toFixed(0)}s)`);
}
