from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,shutil,html,math,wave,struct,random
r=Path('/Users/gadgetplug/Documents/vibecoding/lose-the-tail/trailer-workshop');o=r/'production-kit'
for d in ['screens','monitors','cards','branding','references/fullbody','references/originals','audio','sfx','continuity']: (o/d).mkdir(parents=True,exist_ok=True)
F='/System/Library/Fonts/Supplemental/Arial.ttf';B='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
bg='#10191D';white='#F1F3E9';muted='#ADC0C0';gold='#E7B95C';green='#93D9BF';red='#EE9F89'
manifest=[]
def font(n,b=False):return ImageFont.truetype(B if b else F,n)
def text(d,xy,t,n=36,fill=white,b=False):d.text(xy,t,font=font(n,b),fill=fill)
def center(d,y,t,n=44,fill=white,b=False,w=1080):
 box=d.textbbox((0,0),t,font=font(n,b));text(d,((w-box[2])/2,y),t,n,fill,b)
def save(im,folder,name,shots,desc):
 p=f'{folder}/{name}.png';im.save(o/p);manifest.append(dict(file=p,shots=shots,description=desc,width=im.width,height=im.height));return p
states=[
('01-incoming-call',['S01'],'ROOK','Incoming call',['Morning, Niko.','Mentor / trusted contact'],'Answer',gold),
('02-create-wallet',['S02'],'YOUR FIRST STEP','Practice wallet',['A fresh start.','Learn with simulated ZEC.'],'Create wallet',gold),
('03-secure-backup',['S02'],'KEEP IT PRIVATE','Secure backup',['Keep recovery details private.','Store your backup securely.','Never share recovery details.'],'Backup saved',gold),
('04-transparent-receive',['S02'],'RECEIVE','Transparent address',['t1Demo…NIKO','Fictional address label','Share this request with Rook.'],'Share with Rook',gold),
('05-request-shared-rook',['S02'],'REQUEST SHARED','Ready for Rook',['Transparent receiving request','Shared with your mentor.'],'Done',gold),
('06-rook-payment-received',['S03'],'PAYMENT RECEIVED','+5 ZEC',['From Rook','Transparent payment','Confirmed'],'Received',gold),
('07-public-cafe-review',['S05'],'REVIEW PAYMENT','0.03 ZEC',['To Noodle Café','Transparent recipient','Public payment details'],'Confirm payment',gold),
('08-public-cafe-submitted',['S05'],'PAYMENT SUBMITTED','0.03 ZEC',['To Noodle Café','Awaiting confirmation'],'Submitted',gold),
('09-shield-review',['S12'],'PRACTICE WALLET','Shield funds',['Transparent balance: 5 ZEC','Move funds to your shielded balance.','Earlier public history remains.'],'Shield funds',green),
('10-shield-submitted',['S12'],'SHIELDING SUBMITTED','Processing',['Transparent → Shielded','Awaiting confirmation','Earlier public history remains.'],'Submitted',green),
('11-shield-confirmed',['S12'],'SHIELDING CONFIRMED','Shielded balance',['Transparent → Shielded','Funds are now shielded.','Earlier public history remains.'],'Done',green),
('12-unshield-warning',['S13'],'REVIEW PUBLIC OUTPUT','4.90 ZEC',['To Demo Exchange','Transparent recipient','RECIPIENT + AMOUNT BECOME PUBLIC'],'Confirm',red),
('13-unshield-submitted',['S13'],'UNSHIELD SUBMITTED','4.90 ZEC',['To Demo Exchange','Transparent recipient','Awaiting confirmation'],'Submitted',red),
('14-shielded-request',['S17'],'RECEIVE ZEC','SHIELDED',['Niko · practice request','Fictional receiving request','Share with your friend.'],'Share with Mika',green),
('15-shielded-request-shared',['S17'],'REQUEST SHARED','Ready for Mika',['Shielded receiving request','Niko · practice request'],'Done',green),
('16-mika-send-review',['S18'],'SEND TO NIKO','0.02 ZEC',['Shielded payment','Recipient: Niko','Review amount and recipient.'],'Confirm',green),
('17-mika-send-submitted',['S18'],'PAYMENT SUBMITTED','0.02 ZEC',['To Niko','Shielded payment','Awaiting confirmation'],'Submitted',green),
('18-niko-shielded-receipt',['S20'],'SHIELDED PAYMENT RECEIVED','+0.02 ZEC',['From Mika','Confirmed','Your test payment has arrived.'],'Received',green),
('19-private-cafe-review',['S21'],'PAY NOODLE CAFÉ','0.03 ZEC',['SHIELDED PAYMENT','Recipient verified','Review before sending.'],'Confirm payment',green),
('20-private-cafe-submitted',['S21'],'PAYMENT SUBMITTED','0.03 ZEC',['To Noodle Café','Shielded payment','Awaiting confirmation'],'Submitted',green),
('21-auntie-receipt',['S22'],'PAYMENT RECEIVED','0.03 ZEC',['Noodle Café','Confirmed','Ready to serve.'],'Received',green)]
for name,shots,kicker,title,lines,button,accent in states:
 im=Image.new('RGB',(1080,1920),bg);d=ImageDraw.Draw(im)
 d.rectangle((65,75,1015,80),fill=accent);text(d,(70,110),'LOSE THE TAIL',34,white,True);text(d,(70,167),'PRACTICE WALLET  /  SIMULATED ZEC',26,muted)
 d.rounded_rectangle((70,340,1010,1230),radius=24,fill='#1D2A2E')
 text(d,(112,395),kicker,30,accent,True)
 size=64
 while d.textlength(title,font=font(size,True))>850:size-=2
 text(d,(112,488),title,size,white,True)
 for i,line in enumerate(lines):
  n=36
  while d.textlength(line,font=font(n))>850:n-=1
  text(d,(112,680+i*110),line,n,muted)
 d.rounded_rectangle((90,1400,990,1550),radius=18,fill=accent);center(d,1440,button,42,b=True,fill=bg)
 center(d,1750,'DEMO ONLY · NO REAL FUNDS',27,muted)
 save(im,'screens',name,shots,title)
# Monitor graphics designed as graphics, no missing footage inset dependency.
for name,shots,heading,left,right,status in [
 ('01-public-clue',['S06'],'CASE 01 / PUBLIC TRAIL',['PUBLIC PAYMENT','NIKO demo → NOODLE CAFÉ','0.03 ZEC','Receipt: received'],['CAMERA OBSERVATION','Subject: Niko','Location: Noodle Café','Source: café camera'],'Payment record + separate camera observation'),
 ('02-possible-match',['S14'],'CASE 01 / BOUNDARY OBSERVATIONS',['SHIELDED ENTRY','About 5 ZEC','Earlier public observation'],['TRANSPARENT OUTPUT','4.90 ZEC','Nearby times'],'POSSIBLE MATCH · inference, not proof'),
 ('03-no-new-details',['S24'],'CASE 01 / LEAD ENDS',['EXISTING RECORDS','Earlier public payment retained','Café camera observation retained'],['CURRENT CHECK','No new public payment details','Previous evidence remains'],'No claim that all surveillance is defeated')]:
 im=Image.new('RGB',(1920,1080),bg);d=ImageDraw.Draw(im);text(d,(90,70),'THE TAILOR / CASE DESK',30,gold,True);text(d,(90,130),heading,49,white,True)
 for x,ls in [(90,left),(1000,right)]:
  d.rounded_rectangle((x,290,x+830,765),24,fill='#1D2A2E')
  for i,l in enumerate(ls):text(d,(x+35,335+i*90),l,34 if i else 31,gold if i==0 else white,i==0)
 for x in range(925,994,15):d.line((x,520,x+7,520),fill=gold,width=5)
 text(d,(90,880),status,36,green,True);text(d,(90,986),'FICTIONAL INVESTIGATION  /  SIMULATED ZEC',23,muted)
 save(im,'monitors',name,shots,heading)
for name,label,shots in [('01-you-died','YOU DIED.',['S09']),('02-you-died-again','YOU DIED. AGAIN.',['S16'])]:
 im=Image.new('RGB',(1920,1080),'black');d=ImageDraw.Draw(im);center(d,470,label,110,b=True,w=1920);save(im,'cards',name,shots,label)
im=Image.new('RGB',(1920,1080),'#080E11');d=ImageDraw.Draw(im)
center(d,290,'LOSE THE TAIL',150,b=True,w=1920);center(d,495,'Learn Zcash. One life at a time.',49,w=1920);center(d,735,'Play: lose-the-tail.vercel.app',44,gold,w=1920);center(d,945,'Simulated funds. Real privacy lessons.',30,muted,w=1920);save(im,'cards','03-end-card',['S26'],'Final five-second card')
im=Image.new('RGBA',(1920,1080),(0,0,0,0));d=ImageDraw.Draw(im);center(d,230,'LOSE THE TAIL',150,b=True,w=1920);save(im,'branding','game-title-transparent',['S25'],'Transparent typeset game title; not official Zcash logo')
im=Image.new('RGBA',(1400,120),(0,0,0,0));d=ImageDraw.Draw(im);d.rounded_rectangle((0,0,1400,120),16,fill=bg);text(d,(38,35),'PRACTICE WALLET · SIMULATED ZEC',44,white,True);save(im,'branding','practice-disclosure',['S02','S03'],'Lower-corner disclosure overlay')
# Technical continuity boards: intentionally diagrammatic, not image-model scenery.
for loc,items in {
'bedroom':['RAIN WINDOW / LEFT','BED / REAR WALL','TABLE + CUP / RIGHT','BLUE DAWN + WARM LAMP'],
'cafe':['STREET WINDOW / LEFT','FRONT DOOR / REAR RIGHT','COUNTER / FOREGROUND','REAR PASSAGE / FRAME LEFT'],
'exchange':['REFLECTIVE SERVICE GLASS','NIKO OUTSIDE / PHONE RIGHT HAND','HEM AHEAD / BLOCKING ESCAPE','NEEDLE BEHIND / PURSUING'],
'arcade':['TWO CABINETS / BACK WALL','COUNTER / FOREGROUND','NIKO LEFT / MIKA RIGHT','INDIGO + AMBER LIGHT'],
'void':['BLACK / NO FLOOR PATTERN','NIKO LOW LEFT / SEATED','ZERO RIGHT / FLOATING','ONE WHITE REWIND CUBE'],
'props':['ONE MATTE BLACK PORTRAIT PHONE','DARK BOWL / SMALL PALE RIM CHIP','DARK WOOD CHOPSTICKS','ONE SMALL UNMARKED WHITE CUBE']}.items():
 im=Image.new('RGB',(1920,1080),bg);d=ImageDraw.Draw(im);text(d,(100,80),loc.upper()+' / CONTINUITY',64,white,True)
 for i,t in enumerate(items):
  y=260+i*165;d.rectangle((100,y,155,y+55),fill=gold);text(d,(195,y),t,43,white)
 text(d,(100,990),'TEXT REFERENCE BOARD · NOT A FINAL VIDEO FRAME',26,muted)
 save(im,'continuity',loc,[],loc+' continuity rules')
for p in (r/'fullbody').glob('*.png'):shutil.copy2(p,o/'references/fullbody'/p.name)
for p in (r/'zilkroad-originals').glob('*.png'):shutil.copy2(p,o/'references/originals'/p.name)
for p in (r/'audio').glob('V*.mp3'):
 if 'TAILOR' not in p.name:shutil.copy2(p,o/'audio'/p.name)
for name in ['manifest.json','TIMING-AND-CAST.md','LOSE-THE-TAIL-90S-VOICE-PREVIEW-V3.mp3']:shutil.copy2(r/'audio'/name,o/'audio'/name)
# Original procedural sound design; no external samples.
random.seed(4);sr=44100
for name,dur,kind in [('phone-buzz',.7,'buzz'),('rewind-buzz',.65,'rewind'),('payment-chime',.85,'chime'),('cafe-bell',1.5,'bell'),('heavy-footstep',.35,'step'),('rain-bed',15,'rain'),('void-tone',12,'void')]:
 data=[];smooth=0
 for i in range(int(sr*dur)):
  t=i/sr;noise=random.uniform(-1,1);env=min(1,t/.03)*min(1,(dur-t)/.15)
  if kind=='buzz':v=.18*math.sin(2*math.pi*125*t)*(1 if t<.22 or .38<t<.6 else 0)
  elif kind=='rewind':v=.16*math.sin(2*math.pi*(100*t+250*t*t))*t/dur
  elif kind in ['chime','bell']:
   hz=740 if kind=='chime' else 1200;v=.18*(math.sin(2*math.pi*hz*t)+.3*math.sin(2*math.pi*hz*2.71*t))*math.exp(-t*4)
  elif kind=='step':v=(.3*noise+.3*math.sin(2*math.pi*72*t))*math.exp(-t*24)
  elif kind=='rain':smooth=.85*smooth+.15*noise;v=.12*smooth
  else:v=.035*math.sin(2*math.pi*65*t)+.018*math.sin(2*math.pi*98*t)
  data.append(struct.pack('<h',int(max(-1,min(1,v*env))*32767)))
 with wave.open(str(o/'sfx'/f'{name}.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(b''.join(data))
(o/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('Created',len(manifest),'graphics, character references, dialogue and seven original sound cues')
