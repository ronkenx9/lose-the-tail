// Generate voice-over for every static dialogue line in src/game/story.ts.
// usage: ELEVENLABS_API_KEY=... node scripts/voices.mjs   (skips lines already generated)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error('set ELEVENLABS_API_KEY');
const OUT = 'public/vo';
fs.mkdirSync(OUT, { recursive: true });

export const clean = (t) => t.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');
export function hash(t) {
  let h = 2166136261;
  for (const c of clean(t)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

// premade ElevenLabs voices (by id; this key has TTS but not voices_read)
const CAST = {
  Zero: { id: 'JBFqnCBsd6RMkjVDRZzb', s: { stability: 0.32, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true }, fx: 'asetrate=44100*1.035,aresample=44100,atempo=0.966,chorus=0.6:0.85:40:0.35:0.25:1.6,aecho=0.8:0.6:55:0.14' },
  'The Tailor': { id: '2EiwWnXFnvU5JabPnv8n', s: { stability: 0.42, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true }, fx: '', radio: 'highpass=f=320,lowpass=f=3100,acompressor=threshold=-20dB:ratio=6:attack=5:release=60,volume=1.6' },
  Mika: { id: 'cgSgspJ2msm6clMCkdW9', s: { stability: 0.45, similarity_boost: 0.75, style: 0.4 }, fx: '' },
  Barista: { id: 'IKne3meq5aSn9XLyUdCD', s: { stability: 0.5, similarity_boost: 0.75, style: 0.25 }, fx: '' },
  Courier: { id: 'N2lVS1w4EtoT3dr4eOWO', s: { stability: 0.45, similarity_boost: 0.75, style: 0.35 }, fx: '' },
  'Cobalt clerk': { id: 'onwK4e9ZLuTAKqWW03F9', s: { stability: 0.65, similarity_boost: 0.75, style: 0.1 }, fx: 'highpass=f=120' },
};

const src = fs.readFileSync('src/game/story.ts', 'utf8');
const re = /T\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*(,\s*true)?\s*\)/g;
const lines = [];
for (const m of src.matchAll(re)) lines.push({ who: m[1], text: (m[3] ?? m[4]).replace(/\\'/g, "'"), radio: !!m[5] });

const manifestPath = `${OUT}/manifest.json`;
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
let made = 0;
for (const l of lines) {
  const cast = CAST[l.who];
  if (!cast) continue;
  const id = hash(l.text);
  const file = `${OUT}/${id}.mp3`;
  if (manifest[id] && fs.existsSync(file)) continue;
  const text = clean(l.text).replace(/^\.\.\./, '…');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cast.id}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: cast.s }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const raw = `${OUT}/${id}.raw.mp3`;
  fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  const fx = [l.radio && cast.radio ? cast.radio : cast.fx, 'loudnorm=I=-16:TP=-1.5'].filter(Boolean).join(',');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', fx, '-ac', '1', '-b:a', '64k', file]);
  fs.unlinkSync(raw);
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
  manifest[id] = { who: l.who, dur: Math.round(dur * 100) / 100 };
  made++;
  console.log(`${l.who.padEnd(13)} ${dur.toFixed(1)}s  ${text.slice(0, 70)}`);
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`done: ${made} new, ${Object.keys(manifest).length} total`);
