import json, urllib.request, urllib.error
from pathlib import Path
root=Path(__file__).resolve().parent
key=None
for line in (root.parent/'.env').read_text().splitlines():
 if line.strip().startswith('ELEVENLABS_API_KEY='):key=line.split('=',1)[1].strip().strip('\"\'')
if not key or key.startswith('replace_'):raise SystemExit('API key missing or placeholder unchanged')
for name,path in [('models','/v1/models'),('voices','/v2/voices?page_size=100'),('subscription','/v1/user/subscription')]:
 try:
  req=urllib.request.Request('https://api.elevenlabs.io'+path,headers={'xi-api-key':key})
  with urllib.request.urlopen(req,timeout=30) as r:data=json.load(r)
  if name=='models':out=[{k:m.get(k) for k in ['model_id','name','can_do_text_to_speech','description','model_rates']} for m in data]
  elif name=='voices':out=[{k:v.get(k) for k in ['voice_id','name','labels','description','category','preview_url','fine_tuning','high_quality_base_model_ids']} for v in data.get('voices',[])]
  else:out={k:data.get(k) for k in ['tier','character_count','character_limit','can_extend_character_limit','status','next_character_count_reset_unix']}
  (root/(name+'.json')).write_text(json.dumps(out,indent=2))
  print(name,json.dumps(out))
 except urllib.error.HTTPError as e:print(name,'HTTP',e.code)
