import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {lines,cast,clean} from './voice-lines.mjs';
const out='public/vo';fs.mkdirSync(out,{recursive:true});
const env=fs.readFileSync('trailer-workshop/.env','utf8');
const key=process.env.ELEVENLABS_API_KEY??env.match(/^ELEVENLABS_API_KEY\s*=\s*(.*)$/m)?.[1].trim().replace(/^["']|["']$/g,'');
if(!key)throw Error('Missing ElevenLabs key');
const file=`${out}/manifest.json`;const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
const cues=JSON.parse(fs.readFileSync('trailer-workshop/audio/manifest.json','utf8'));
const jobs=lines();let pending=jobs.filter(l=>manifest[l.id]?.model_id!=='eleven_v4'||manifest[l.id]?.voice_id!==cast[l.who]?.id||manifest[l.id]?.text!==l.text||!fs.existsSync(`${out}/${l.id}.mp3`));
console.log(`${jobs.length} spoken lines; ${pending.length} to prepare; ${pending.reduce((n,l)=>n+clean(l.text).length,0)} text characters`);
const resp=await fetch('https://api.elevenlabs.io/v1/user/subscription',{headers:{'xi-api-key':key}});
if(!resp.ok)throw Error(`Allowance check HTTP ${resp.status}`);const sub=await resp.json();
if(sub.character_limit-sub.character_count<pending.reduce((n,l)=>n+l.text.length+40,0))throw Error('Insufficient remaining allowance for this batch');
let cursor=0;
async function worker(){while(cursor<pending.length){const l=pending[cursor++];const c=cast[l.who];if(!c)throw Error(`Missing cast: ${l.who}`);const dest=`${out}/${l.id}.mp3`;
 const reuse=cues.find(x=>x.voice_id===c.id&&clean(x.original_text)===clean(l.text));
 if(reuse)fs.copyFileSync(`trailer-workshop/audio/${reuse.file}`,dest);
 else{const res=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${c.id}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:c.tag+' '+clean(l.text).replace(/ZEC/g,'Zeck'),model_id:'eleven_v4'})});if(!res.ok)throw Error(`Voice generation ${l.who}: HTTP ${res.status}`);fs.writeFileSync(dest,Buffer.from(await res.arrayBuffer()));}
 const dur=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',dest]).toString());
 manifest[l.id]={who:l.who,text:l.text,dur,voice_id:c.id,model_id:'eleven_v4'};fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log(`${l.who}: ${dur.toFixed(2)}s${reuse?' (reused)':''}`);
}}
await Promise.all([worker(),worker()]);
fs.writeFileSync(file,JSON.stringify(Object.fromEntries(jobs.map(l=>[l.id,manifest[l.id]])),null,2));console.log('VOICE_BATCH_COMPLETE');
