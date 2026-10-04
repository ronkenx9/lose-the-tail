import json,re,urllib.request,urllib.error,subprocess,concurrent.futures
from pathlib import Path
root=Path(__file__).resolve().parent
key=next(x.split('=',1)[1].strip().strip('\"\'') for x in (root.parent/'.env').read_text().splitlines() if x.startswith('ELEVENLABS_API_KEY='))
cast={'ROOK':('kIdaq3mPZbYm2kpFTtYI','Prince — warm, deep and calming'),'NIKO':('LEvd0YiWkwZ6hTZOmdVE','Joe — warm and confident'),'AUNTIE NODE':('D9xwB6HNBJ9h4YvQFWuE','Tobi — clear, steady and calm'),'NEEDLE':('IRHApOXLvnW57QJPQH2P','Adam — dark and tough'),'ZERO':('nPczCjzI2devNBz1zQrb','Brian — deep, resonant and comforting'),'MIKA':('2vbhUP8zyKg4dEZaTWGn','Stella — warm and natural')}
tags=['[warmly]','[sleepily]','[teasing]','[playfully]','[sarcastically] [smirking]','[nervously]','[dryly]','[hesitantly]','[reassuringly]','[frustrated]','[serious]','[patiently]','[casually]','[relieved]','[warmly]','[relieved]','[gently]']
s=(root.parent/'VOICEOVER-90S.md').read_text()
pattern=r'### (V\d+) · (\d\d):(\d\d\.\d)–(\d\d):(\d\d\.\d) · ([^\n]+)\nDelivery: ([^\n]+)\n\n“([^”]+)”'
cues=[]
for i,m in enumerate(re.finditer(pattern,s)):
 id,sm,ss,em,es,role,direction,spoken=m.groups();vid,name=cast[role];text=tags[i]+' '+spoken.replace('ZEC','Zeck')
 if role=='ZERO':text='[confidently] '+spoken
 cues.append(dict(id=id,start=int(sm)*60+float(ss),end=int(em)*60+float(es),role=role,direction=direction,original_text=spoken,generation_text=text,voice_id=vid,voice_name=name,model_id='eleven_v4',file=id+'_'+role.replace(' ','_')+'.mp3'))
assert len(cues)==17,len(cues)
(root/'manifest.json').write_text(json.dumps(cues,indent=2))
def generate(c):
 p=root/c['file']
 if not p.exists():
  body={'text':c['generation_text'],'model_id':'eleven_v4'}
  req=urllib.request.Request('https://api.elevenlabs.io/v1/text-to-speech/'+c['voice_id']+'?output_format=mp3_44100_128',data=json.dumps(body).encode(),headers={'xi-api-key':key,'Content-Type':'application/json'})
  try:
   with urllib.request.urlopen(req,timeout=120) as r:data=r.read()
   p.write_bytes(data)
  except urllib.error.HTTPError as e:raise RuntimeError(c['id']+' '+str(e.code)+' '+e.read().decode()[:500])
 c['duration']=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(p)]))
 print(c['id'],c['role'],c['duration'],flush=True)
 return c
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(generate,cues))
 (root/'manifest.json').write_text(json.dumps(results,indent=2))
