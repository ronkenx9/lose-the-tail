import fs from 'node:fs';
export const clean = t => t.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');
export function key(who,text) {let h=2166136261;for(const c of `${who}\n${clean(text)}`)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);}
export function lines() {
 const source=fs.readFileSync('src/game/story.ts','utf8');
 const all=new Map();
 for(const row of source.split('\n')) {
  const call=row.match(/T\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,(.+)\)/);
  if(!call)continue;
  const who=call[1], expr=call[3];
  if(expr.includes('`'))throw Error('Dynamic dialogue must provide a recorded static line');
  const literals=[...expr.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)];
  if(!literals.length)throw Error('No static dialogue: '+row);
  for(const m of literals) {
   const text=(m[1]??m[2]).replace(/\\(['"\\])/g,'$1').replace(/\\n/g,'\n');
   all.set(key(who,text),{who,text});
  }
 }
 return [...all].map(([id,l])=>({id,...l}));
}
export const cast={
 Zero:{id:'nPczCjzI2devNBz1zQrb',tag:'[confidently]'},
 'The Tailor':{id:'ev2kMR9ZJZZsemuogS5u',tag:'[serious]'},
 Needle:{id:'IRHApOXLvnW57QJPQH2P',tag:'[sarcastically] [smirking]'},
 Rook:{id:'kIdaq3mPZbYm2kpFTtYI',tag:'[warmly]'},
 Niko:{id:'LEvd0YiWkwZ6hTZOmdVE',tag:'[relieved]'},
 Mika:{id:'2vbhUP8zyKg4dEZaTWGn',tag:'[casually]'},
 'Auntie Node':{id:'D9xwB6HNBJ9h4YvQFWuE',tag:'[warmly]'},
 Courier:{id:'N2lVS1w4EtoT3dr4eOWO',tag:'[playfully]'},
 'Cobalt clerk':{id:'onwK4e9ZLuTAKqWW03F9',tag:'[matter-of-fact]'},
 Dee:{id:'77aEIu0qStu8Jwv1EdhX',tag:'[casually]'},
 'Old Bill':{id:'pqHfZKP75CvOlQylNhV4',tag:'[wistfully]'},
};
