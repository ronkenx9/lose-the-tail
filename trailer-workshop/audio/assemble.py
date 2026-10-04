import json,subprocess,zipfile
from pathlib import Path
r=Path(__file__).resolve().parent
c=json.loads((r/'manifest.json').read_text());args=['ffmpeg','-hide_banner','-loglevel','error','-y'];filters=[];last=0
rows=['# Expressive v4 dialogue — timing report','', '17 separately generated dry dialogue clips; six distinct stock/library voices. No music or sound effects. Tags direct emotion; actor likeness was not cloned. Preview adjusts placements by milliseconds to avoid overlap, without speeding up voices. Audio has been decoded and checked for duration; performance and pronunciation still need a human listening review.','', '| Cue | Character / voice | Start | Duration |','|---|---|---:|---:|']
for i,x in enumerate(c):
 start=max(x['start'],last+0.12);last=start+x['duration'];x['preview_start']=round(start,3)
 args+=['-i',str(r/x['file'])];delay=round(start*1000);filters.append(f'[{i}:a]adelay={delay}:all=1[a{i}]')
 rows.append(f"| {x['id']} | {x['role']} / {x['voice_name']} | {start:.2f}s | {x['duration']:.2f}s |")
filters.append(''.join(f'[a{i}]' for i in range(len(c)))+f'amix=inputs={len(c)}:normalize=0,apad,atrim=duration=90[out]')
args+=['-filter_complex',';'.join(filters),'-map','[out]','-ar','44100','-c:a','libmp3lame','-b:a','192k',str(r/'LOSE-THE-TAIL-90S-VOICE-PREVIEW.mp3')]
subprocess.run(args,check=True)
(r/'manifest.json').write_text(json.dumps(c,indent=2));(r/'TIMING-AND-CAST.md').write_text('\n'.join(rows)+'\n')
with zipfile.ZipFile(r/'LOSE-THE-TAIL-VOICE-PACK.zip','w',zipfile.ZIP_DEFLATED) as z:
 for x in c:z.write(r/x['file'],x['file'])
 for name in ['manifest.json','TIMING-AND-CAST.md','LOSE-THE-TAIL-90S-VOICE-PREVIEW.mp3']:z.write(r/name,name)
print('17 clips packaged; 90-second preview assembled')
