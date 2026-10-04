import json,urllib.request,subprocess,shutil
from pathlib import Path
r=Path(__file__).resolve().parent
c=json.loads((r/'manifest.json').read_text()); backup=r/'previous-cast';backup.mkdir(exist_ok=True)
shutil.copy2(r/'manifest.json',backup/'manifest.json')
key=next(x.split('=',1)[1].strip().strip('\"\'') for x in (r.parent/'.env').read_text().splitlines() if x.startswith('ELEVENLABS_API_KEY='))
for x in c:
 if x['role'] not in ['ZERO','THE TAILOR']:continue
 shutil.copy2(r/x['file'],backup/x['file'])
 if x['role']=='ZERO':
  x['voice_id']='nPczCjzI2devNBz1zQrb';x['voice_name']='Brian — deep, resonant and comforting'
  x['direction']='Deep resonant human authority. Confident chest voice, natural connected speech, warm conviction; no robotic cadence or whisper.'
  tag='[confidently]'
 else:
  x['direction']='Smug, sarcastic, audibly smiling. Open conversational projection, amused mockery, a smirk on easy to find; no whisper.'
  tag='[sarcastically] [smirking]'
 x['generation_text']=tag+' '+x['original_text'].replace('ZEC','Zeck')
 req=urllib.request.Request('https://api.elevenlabs.io/v1/text-to-speech/'+x['voice_id']+'?output_format=mp3_44100_128',data=json.dumps({'text':x['generation_text'],'model_id':'eleven_v4'}).encode(),headers={'xi-api-key':key,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=120) as f:data=f.read()
 (r/x['file']).write_bytes(data)
 x['duration']=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(r/x['file'])]))
 (r/'manifest.json').write_text(json.dumps(c,indent=2))
 print(x['id'],x['voice_name'],x['duration'],flush=True)
