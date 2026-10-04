import json,subprocess,zipfile
from pathlib import Path
r=Path(__file__).resolve().parent;c=json.loads((r/'manifest.json').read_text());assert len(c)==17
assert len({x['voice_id'] for x in c})==6
for x in c:
 assert x['model_id']=='eleven_v4'
 subprocess.run(['ffmpeg','-v','error','-i',str(r/x['file']),'-f','null','-'],check=True)
 assert 0<x['duration']<10
p=r/'LOSE-THE-TAIL-90S-VOICE-PREVIEW.mp3'
d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(p)]));assert abs(d-90)<.1
with zipfile.ZipFile(r/'LOSE-THE-TAIL-VOICE-PACK.zip') as z:assert z.testzip() is None and len(z.namelist())==20
print('AUDIO_VERIFIED: 17 decodable cues, six voices, v4 manifest, 90-second preview, complete ZIP')
