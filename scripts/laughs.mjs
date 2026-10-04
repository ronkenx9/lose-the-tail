// Zero's game-over laughs (ElevenLabs v4 audio tags). usage: node scripts/laughs.mjs
import fs from 'node:fs';
const env = fs.readFileSync('trailer-workshop/.env', 'utf8');
const key = process.env.ELEVENLABS_API_KEY ?? env.match(/^ELEVENLABS_API_KEY\s*=\s*(.*)$/m)?.[1].trim().replace(/^["']|["']$/g, '');
const ZERO = 'nPczCjzI2devNBz1zQrb';
const lines = {
  laugh_night1: '[laughs] Ha. Ha ha ha! [laughs harder] Oh, oh no. You paid for noodles... with a spotlight on your head.',
  laugh_payday: '[laughs] Ha ha! Glass pockets, again? [laughs] I am sorry. I am not sorry. Shield it.',
  laugh_trap: '[laughs heartily] Five in, five out! [laughs] You might as well have signed it.',
};
for (const [id, text] of Object.entries(lines)) {
  const dest = `public/vo/${id}.mp3`;
  if (fs.existsSync(dest) && !process.argv.includes('--force')) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ZERO}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_v4' }),
  });
  if (!res.ok) throw Error(`${id}: HTTP ${res.status} ${await res.text()}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('wrote', dest);
}
