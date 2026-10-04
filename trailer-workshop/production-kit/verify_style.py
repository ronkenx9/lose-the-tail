from pathlib import Path
import subprocess,sys,zipfile,json
r=Path(__file__).resolve().parent
subprocess.run([sys.executable,str(r/'verify.py')],check=True)
with zipfile.ZipFile(r.parent/'LOSE-THE-TAIL-PRODUCTION-KIT-V2.zip') as z:
 assert z.testzip() is None
 for x in json.loads((r/'manifest.json').read_text()):assert z.read('production-kit/'+x['file'])==(r/x['file']).read_bytes()
 assert z.read('production-kit/index.html')==(r/'index.html').read_bytes()
print('STYLE_VERIFIED')
