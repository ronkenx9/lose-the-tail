import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {lines,cast,key} from './voice-lines.mjs';
const manifest=JSON.parse(fs.readFileSync('public/vo/manifest.json','utf8'));const expected=lines();
assert(expected.length>=47);
assert(expected.some(l=>l.text.startsWith('Nice hood.')));
assert(expected.some(l=>l.text.startsWith('Evening.')));
assert(expected.some(l=>l.text.startsWith('Got it. I can read')));
for(const l of expected){const m=manifest[l.id];assert(m,`${l.who}: missing ${l.text}`);assert.equal(m.who,l.who);assert.equal(m.text,l.text);assert.equal(m.voice_id,cast[l.who].id);assert.equal(m.model_id,'eleven_v4');assert(m.dur>0);execFileSync('ffmpeg',['-v','error','-i',`public/vo/${l.id}.mp3`,'-f','null','-']);}
assert.notEqual(key('Zero','Hello'),key('Needle','Hello'));
console.log(`VOICES_VERIFIED: ${expected.length} lines across ${new Set(expected.map(l=>l.who)).size} characters`);
