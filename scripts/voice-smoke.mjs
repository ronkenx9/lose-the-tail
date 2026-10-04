import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5192/');
 await page.waitForFunction(()=>window.__game);
 await page.click('#start');await page.click('.card .cta');
 await page.waitForFunction(()=>window.__game.hud.audio?.currentTime>0.25,{},{timeout:20000});
 const before=await page.evaluate(()=>({name:document.querySelector('.dlg b').textContent,time:window.__game.hud.audio.currentTime,src:window.__game.hud.audio.src}));
 assert.equal(before.name,'Rook');assert(before.time>0);
 await page.click('.mute');
 assert(await page.evaluate(()=>window.__game.hud.voiceOn===false&&window.__game.hud.audio===null));
 console.log('VOICE_PLAYBACK_VERIFIED: Rook plays after Start; mute immediately stops speech');
} finally {await browser.close();}
