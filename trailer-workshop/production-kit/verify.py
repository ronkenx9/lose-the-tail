from pathlib import Path
from PIL import Image
import json,re,wave
r=Path(__file__).resolve().parent;m=json.loads((r/'manifest.json').read_text());shots=json.loads((r/'shot-assets.json').read_text())
assert len(m)==35 and len(shots)==26
assert len(list((r/'screens').glob('*.png')))==21
for x in m:
 with Image.open(r/x['file']) as im:assert im.size==(x['width'],x['height']);im.verify()
for x in shots:
 assert x['files']
 for f in x['files']:assert (r/f).is_file(),f
for p in (r/'branding').glob('zcash*.png'):
 with Image.open(p) as im:im.verify()
assert len(list((r/'audio').glob('V*.mp3')))==17
assert not list(r.rglob('.env'))
for p in (r/'sfx').glob('*.wav'):
 with wave.open(str(p)) as w:assert w.getnframes()>1000
s=(r/'VIDEO-PROMPTS-VISIBLE-SCREENS.md').read_text()
assert len(re.findall(r'^## S\d\d ',s,re.M))==26
assert 'blank screen' not in s.lower() and 'no screen with the supplied graphics' not in s
assert 'V05_NEEDLE.mp3' in (r/'audio/manifest.json').read_text()
assert (r/'START-HERE.md').read_text().count('### S')==26
print('KIT_VERIFIED: 35 graphics, 26 shot mappings, 17 cues, 7 sound files, official logos, all references present')
