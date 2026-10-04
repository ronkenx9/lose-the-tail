from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import ast,random,math,json,shutil
R=Path(__file__).resolve().parents[1]
W='#F2E5C8';M='#9D9C88';A='#F2B84B';G='#86D6BB';RED='#F27855';BG='#111B20';B='/System/Library/Fonts/Supplemental/Arial Bold.ttf';F='/System/Library/Fonts/Supplemental/Arial.ttf'
# Original five-by-seven display alphabet; large type is drawn from square cells.
glyphs={'A':['01110','11011','11011','11111','11011','11011','11011'],'B':['11110','11011','11011','11110','11011','11011','11110'],'C':['01111','11000','11000','11000','11000','11000','01111'],'D':['11110','11011','11011','11011','11011','11011','11110'],'E':['11111','11000','11000','11110','11000','11000','11111'],'F':['11111','11000','11000','11110','11000','11000','11000'],'G':['01111','11000','11000','11011','11011','11011','01111'],'H':['11011','11011','11011','11111','11011','11011','11011'],'I':['11111','00100','00100','00100','00100','00100','11111'],'J':['00111','00011','00011','00011','11011','11011','01110'],'K':['11011','11011','11110','11100','11110','11011','11011'],'L':['11000','11000','11000','11000','11000','11000','11111'],'M':['10001','11011','11111','10101','10101','10101','10101'],'N':['11001','11001','11101','11111','11011','11011','11001'],'O':['01110','11011','11011','11011','11011','11011','01110'],'P':['11110','11011','11011','11110','11000','11000','11000'],'Q':['01110','11011','11011','11011','11111','00110','00011'],'R':['11110','11011','11011','11110','11100','11010','11011'],'S':['01111','11000','11000','01110','00011','00011','11110'],'T':['11111','00100','00100','00100','00100','00100','00100'],'U':['11011','11011','11011','11011','11011','11011','01110'],'V':['11011','11011','11011','11011','11011','01110','00100'],'W':['10101','10101','10101','10101','11111','11011','10001'],'X':['11011','11011','01110','00100','01110','11011','11011'],'Y':['11011','11011','01110','00100','00100','00100','00100'],'Z':['11111','00011','00110','01100','11000','11000','11111'],'0':['01110','11011','11011','11011','11011','11011','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','11011','00011','00110','01100','11000','11111'],'3':['11110','00011','00011','01110','00011','00011','11110'],'4':['11011','11011','11011','11111','00011','00011','00011'],'5':['11111','11000','11000','11110','00011','00011','11110'],'6':['01110','11000','11000','11110','11011','11011','01110'],'7':['11111','00011','00011','00110','00110','01100','01100'],'8':['01110','11011','11011','01110','11011','11011','01110'],'9':['01110','11011','11011','01111','00011','00011','01110'],'.':['00000','00000','00000','00000','00000','01100','01100'],'+':['00000','00100','00100','11111','00100','00100','00000'],'/':['00001','00011','00110','00100','01100','11000','10000'],'-':['00000','00000','00000','11111','00000','00000','00000'],'!':['00100','00100','00100','00100','00100','00000','00100']}
def pix(d,x,y,s,size=10,c=W,maxw=None):
 s=s.upper();size=min(size,max(1,int(maxw/(len(s)*6-1)))) if maxw else size
 for j,ch in enumerate(s):
  for row,bits in enumerate(glyphs.get(ch,['00000']*7)):
   for col,v in enumerate(bits):
    if v=='1':d.rectangle((x+j*6*size+col*size,y+row*size,x+j*6*size+(col+1)*size-1,y+(row+1)*size-1),fill=c)
 return (len(s)*6-1)*size

def txt(d,x,y,s,n=30,c=W,b=False,maxw=None):
 while maxw and d.textlength(s,font=ImageFont.truetype(B if b else F,n))>maxw:n-=1
 d.text((x,y),s,font=ImageFont.truetype(B if b else F,n),fill=c)
def panel(d,box,fill,edge=None,cut=16):
 x,y,u,v=box;points=[(x+cut,y),(u,y),(u,v-cut),(u-cut,v),(x,v),(x,y+cut)];d.polygon(points,fill=fill)
 if edge:d.line(points+[points[0]],fill=edge,width=2)
def cube(d,x,y,s,front=A,top='#FFE0A0',side='#936C32'):
 d.polygon([(x,y),(x+s,y-s/2),(x+2*s,y),(x+s,y+s/2)],fill=top)
 d.polygon([(x,y),(x+s,y+s/2),(x+s,y+1.5*s),(x,y+s)],fill=front)
 d.polygon([(x+s,y+s/2),(x+2*s,y),(x+2*s,y+s),(x+s,y+1.5*s)],fill=side)
def city(d,w,h,base,seed=2):
 rng=random.Random(seed)
 for x in range(0,w,54):
  top=base-rng.randrange(40,250);d.rectangle((x,top,x+45,h),fill='#18262C')
  for yy in range(top+16,min(h,base+150),30):
   for xx in range(x+8,x+40,16):
    if rng.random()>.5:d.rectangle((xx,yy,xx+5,yy+8),fill=rng.choice(['#755D38','#3A514F','#B38240']))
def canvas(w,h,seed=1):
 im=Image.new('RGB',(w,h),BG);d=ImageDraw.Draw(im);rng=random.Random(seed)
 for _ in range(w*h//420):
  x=rng.randrange(w);y=rng.randrange(h);d.rectangle((x,y,x+1,y+1),fill='#263033')
 return im,d

def icon(d,kind,x,y,accent):
 # Block silhouettes built from a small grid and extruded one cell.
 shapes={
 'shield':['111111111','111111111','110000011','110000011','110010011','110111011','110010011','011000110','001101100','000111000','000010000'],
 'coin':['001111100','011111110','110000011','110111011','110001011','110010011','110100011','110111011','110000011','011111110','001111100'],
 'warning':['000010000','000111000','001111100','001101100','011101110','011101110','111101111','111111111','111101111'],
 'send':['000011000','000011100','111111110','111111111','111111110','000011100','000011000'],
 'lock':['00111100','01100110','01100110','01100110','11111111','11111111','11100111','11100111','11111111'],
 'call':['110000000','110000000','110000000','111000000','011100000','001110011','000111111','000011111'],
 'wallet':['011111111','111111111','110000000','111111111','111111011','111111111','111111111'],
 'check':['000000011','000000110','000001100','110011000','111110000','011100000','001000000']}
 grid=shapes[kind];s=24
 for dy,shade in [(14,'#344846'),(0,accent)]:
  for yy,row in enumerate(grid):
   for xx,v in enumerate(row):
    if v=='1':d.rectangle((x+xx*s+dy,y+yy*s+dy,x+(xx+1)*s-3+dy,y+(yy+1)*s-3+dy),fill=shade)
 for j in range(3):cube(d,x+260+j*35,y+170-j*62,12,accent,'#E5DDC6','#495953')

states=json.loads((R/'source/states.json').read_text())
for idx,(name,shots,kicker,title,lines,button,accent) in enumerate(states):
 if idx in [8,9,10]:accent='#E3EBE2'
 im,d=canvas(1080,1920,idx);city(d,1080,1920,1780)
 # Edge ticks and masthead, serial identity at top.
 d.rectangle((38,42,48,1770),fill='#35413F');d.rectangle((1032,42,1042,1770),fill='#35413F')
 for yy in range(42,1770,65):d.rectangle((38,yy,61,yy+3),fill='#63706A')
 pix(d,85,80,'LOSE THE TAIL',7,A);txt(d,85,152,'PERSONAL TERMINAL / MIKA' if 'mika-send' in name else 'MERCHANT / NOODLE CAFE' if 'auntie' in name else 'PERSONAL TERMINAL / NIKO',24,M,True)
 for j in range(4):d.rectangle((876+j*24,110-j*12,890+j*24,142),fill=accent)
 d.line((85,205,995,205),fill='#59635C',width=2)
 txt(d,85,238,kicker,31,accent,True,maxw=915)
 # Main dimensional illustration on an architectural grid.
 for yy in range(330,790,46):d.line((85,yy,995,yy),fill='#243239')
 for xx in range(85,996,46):d.line((xx,330,xx,790),fill='#243239')
 kind='warning' if 'unshield' in name else 'shield' if 'shield' in name or 'private' in name else 'call' if idx==0 else 'lock' if idx==2 else 'send' if 'request' in name or 'review' in name else 'check' if 'submitted' in name else 'wallet' if idx==1 else 'coin'
 icon(d,kind,380,360,accent)
 txt(d,95,740,'PUBLIC ROUTE' if accent==A else 'SHIELDED ROUTE' if accent in [G,'#E3EBE2'] else 'PUBLIC OUTPUT',23,accent,True)
 txt(d,773,740,'ZEC / DEMO',23,M)
 # Content has strong type and one task per page.
 title=title.replace('Practice wallet','Your wallet').replace('Transparent address','Receive ZEC').replace('Shielded balance','Shielded').replace('Ready for Rook','Shared').replace('Ready for Mika','Shared')
 pix(d,84,854,title,12,W,maxw=916)
 d.rectangle((85,976,175,983),fill=accent)
 for j,line in enumerate(lines):
  yy=1040+j*106
  d.rectangle((87,yy+12,99,yy+24),fill=accent)
  txt(d,125,yy,line,36,W if j==0 else M,j==0,maxw=840)
 # Angled warning panel rather than a tiny footnote.
 if kind=='warning':
  panel(d,(85,1280,995,1370),'#462D27');txt(d,111,1303,'PUBLIC RECIPIENT + PUBLIC AMOUNT',29,RED,True,maxw=850)
 else:txt(d,85,1330,'CHECK THE ROUTE. KEEP MOVING.',24,accent,True)
 d.rectangle((97,1462,1007,1595),fill='#040D12');panel(d,(85,1450,995,1583),accent,cut=22)
 pix(d,120,1493,button,8,BG,maxw=720);pix(d,909,1493,'+',8,BG)
 txt(d,85,1658,'PRACTICE WALLET',27,W,True);txt(d,85,1702,'SIMULATED ZEC / NO REAL FUNDS',25,M)
 for xx in range(85,995,20):d.rectangle((xx,1820,xx+9,1825),fill=accent if xx<260 else '#36423D')
 im.save(R/'screens'/f'{name}.png')
# Surveillance monitors: evidence paths, alert-colored case labels, block subject silhouettes.
def subject(d,x,y):
 # Symbolic case avatar, not a replacement NFT reference.
 for yy,row in enumerate(['00111100','01111110','01111110','00011000','01111110','11111111','11011011','00011000','00100100']):
  for xx,v in enumerate(row):
   if v=='1':d.rectangle((x+xx*16,y+yy*16,x+xx*16+14,y+yy*16+14),fill='#728B89')
for i,name in enumerate(['01-public-clue','02-possible-match','03-no-new-details']):
 im,d=canvas(1920,1080,i);city(d,1920,1080,1070)
 d.rectangle((0,0,1920,15),fill=RED);pix(d,65,65,'THE TAILOR',9,W);txt(d,66,146,'OBSERVATION DESK   /   CASE N-01',27,M)
 panel(d,(1470,62,1850,140),'#532F2A');txt(d,1495,83,['TARGET LOCATED','POSSIBLE MATCH','LEAD EXHAUSTED'][i],27,RED,True)
 if i==0:
  pix(d,65,240,'FOLLOW THE MONEY',12,W)
  panel(d,(65,400,1110,810),'#1F2E32', '#56625D');txt(d,96,433,'PUBLIC PAYMENT / CONFIRMED',29,RED,True);pix(d,96,530,'0.03 ZEC',17,A);txt(d,96,707,'NIKO demo  →  NOODLE CAFE',40,W,True)
  panel(d,(1205,400,1850,810),'#1F2E32','#56625D');subject(d,1245,477);txt(d,1430,440,'CAMERA',28,RED,True);txt(d,1430,490,'OBSERVATION',26,M);txt(d,1430,570,'NIKO',52,W,True);txt(d,1430,650,'NOODLE CAFE',29,A,True)
  for x in range(1120,1200,20):d.rectangle((x,596,x+10,600),fill=RED)
  txt(d,65,902,'Two sources. One lead.',42,W,True)
 elif i==1:
  pix(d,65,240,'A FAMILIAR PATTERN',11,W)
  for x,heading,amount,sub in [(65,'SHIELDED ENTRY','~5 ZEC','Earlier public observation'),(1075,'PUBLIC OUTPUT','4.90 ZEC','Transparent recipient')]:
   panel(d,(x,405,x+775,800),'#1F2E32','#56625D');txt(d,x+35,445,heading,31,RED,True);pix(d,x+35,545,amount.replace('~',''),16,A);txt(d,x+35,715,('About ' if x==65 else '')+sub,30,M)
  for x in range(855,1060,25):d.rectangle((x,594,x+12,599),fill=RED)
  txt(d,65,895,'NEARBY TIMES  /  POSSIBLE MATCH',39,RED,True);txt(d,65,954,'Correlation is a clue, not proof.',28,M)
 else:
  pix(d,65,245,'THE TRAIL GOES COLD',11,W)
  panel(d,(65,408,850,852),'#1B292E','#53615C');txt(d,100,445,'EXISTING RECORDS',30,M,True)
  for j,t in enumerate(['Public payment / 0.03 ZEC','Cafe camera observation','Earlier boundary observations']):txt(d,100,545+j*78,t,31,M)
  panel(d,(930,408,1850,852),'#203A35','#638E7D');pix(d,970,464,'NO NEW',13,G);pix(d,970,585,'PUBLIC DETAILS',8,G);txt(d,970,747,'Previous evidence remains.',34,W)
  txt(d,65,926,'No fresh payment lead.',38,G,True)
 txt(d,65,1020,'FICTIONAL CASE FILE / SIMULATED ZEC',23,M);im.save(R/'monitors'/f'{name}.png')
# Titles: aggressive geometry, restrained color, generous theatrical negative space.
for idx,(name,again) in enumerate([('01-you-died',False),('02-you-died-again',True)]):
 im,d=canvas(1920,1080,idx);d.rectangle((0,0,1920,1080),fill='#080D10')
 rng=random.Random(22+idx)
 for _ in range(100):
  x=rng.choice([rng.randrange(0,350),rng.randrange(1540,1920)]);y=rng.randrange(1080);s=rng.randrange(5,26);d.rectangle((x,y,x+s,y+s),fill=rng.choice(['#2C2524','#553529','#97704D']))
 txt(d,135,127,'CONNECTION LOST',29,RED,True);txt(d,1440,127,'LIFE / 02' if again else 'LIFE / 01',29,M)
 pix(d,135,360,'YOU DIED',31,W)
 if again:pix(d,138,655,'AGAIN.',18,RED)
 else:d.rectangle((138,660,575,668),fill=RED)
 txt(d,138,918,'THE CITY REMEMBERS.',29,M,True);im.save(R/'cards'/f'{name}.png')
im,d=canvas(1920,1080,21);city(d,1920,1080,1020,8)
# Trailing cube motif keeps logo independent of any official Zcash mark.
for j in range(16):
 x=1290+(j%4)*115;y=120+(j//4)*140;cube(d,x,y,18+(j%3)*6, '#385E5C','#678276','#1F363A')
pix(d,125,145,'LOSE',32,W);pix(d,125,415,'THE TAIL',28,A)
txt(d,133,698,'Learn Zcash. One life at a time.',45,W);panel(d,(130,804,1135,899),A);txt(d,162,823,'PLAY / lose-the-tail.vercel.app',38,BG,True)
txt(d,132,987,'SIMULATED FUNDS. REAL PRIVACY LESSONS.',26,W,True);im.save(R/'cards/03-end-card.png')
im=Image.new('RGBA',(1920,1080),(0,0,0,0));d=ImageDraw.Draw(im);pix(d,130,145,'LOSE',32,W);pix(d,130,415,'THE TAIL',28,A);im.save(R/'branding/game-title-transparent.png')
im=Image.new('RGBA',(1400,120),(0,0,0,0));d=ImageDraw.Draw(im);panel(d,(0,0,1400,120),BG);d.rectangle((0,0,14,120),fill=A);pix(d,42,39,'PRACTICE WALLET / SIMULATED ZEC',6,W);im.save(R/'branding/practice-disclosure.png')
# Continuity boards also follow the production visual language.
for i,p in enumerate(sorted((R/'continuity').glob('*.png'))):
 items={'bedroom':['WINDOW LEFT / BLUE DAWN','BED AT REAR / SLATE BLANKET','TABLE RIGHT / CUP + PHONE','WARM LAMP / REUSE ON REWIND'],'cafe':['WINDOW LEFT / CYAN RAIN','FRONT DOOR REAR RIGHT','DARK COUNTER / WARM LAMP','REAR PASSAGE LEFT / ESCAPE'],'exchange':['GLASS WINDOW / CYAN LIGHT','PHONE RIGHT / TAP LEFT','HEM AHEAD / BLOCKS ROUTE','NEEDLE BEHIND / PURSUIT'],'arcade':['TWO CABINETS BEHIND COUNTER','NIKO LEFT / MIKA RIGHT','SEPARATE PHONES / RIGHT HAND','INDIGO SHADOW / AMBER LIGHT'],'void':['BLACK SPACE / NO FLOOR GRID','NIKO SEATED LOW LEFT','ZERO FLOATS AT RIGHT','ONE WHITE REWIND CUBE'],'props':['BLACK PHONE / PORTRAIT','DARK BOWL / PALE RIM CHIP','DARK WOOD CHOPSTICKS','ONE SMALL WHITE CUBE']}[p.stem]
 im,d=canvas(1920,1080,i);pix(d,80,75,p.stem,15,A);txt(d,83,225,'CONTINUITY / '+str(i+1).zfill(2),27,M)
 for j,t in enumerate(items):
  y=335+j*150;pix(d,85,y,str(j+1),7,A);txt(d,200,y-2,t,43,W,True)
 txt(d,85,990,'LAYOUT INSTRUCTIONS / NOT A VIDEO FRAME',26,M);im.save(p)
print('Rebuilt 35 graphics with voxel noir art direction')
