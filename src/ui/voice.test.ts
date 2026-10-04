import { describe, it, expect, vi, afterEach } from 'vitest';
import { voiceKey } from './voice';
import { Hud } from './hud';
class NodeStub {
 innerHTML = ''; textContent = ''; offsetWidth = 1;
 classList = { add() {}, remove() {}, toggle() {} };
 insertAdjacentHTML() {} addEventListener() {} querySelector() { return new NodeStub(); }
}
class AudioStub {
 static last: AudioStub;
 onended: (() => void) | null = null; onerror: (() => void) | null = null;
 pause = vi.fn(); play = vi.fn(() => Promise.resolve());
 constructor(public src: string) { AudioStub.last = this; }
}
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup() {
 vi.useFakeTimers();
 vi.stubGlobal('window', { addEventListener() {}, setTimeout, setInterval });
 vi.stubGlobal('Audio', AudioStub);
 const hud = new Hud(new NodeStub() as unknown as HTMLElement);
 const line = { who: 'Zero', text: 'Try again.' };
 hud.vo[voiceKey(line.who,line.text)] = { ...line, dur: 2, voice_id:'brian',model_id:'eleven_v4' };
 return {hud,line};
}
describe('character voices', () => {
 it('keys identical words by speaker and normalizes display emphasis', () => {
  expect(voiceKey('Zero','Hello.')).not.toBe(voiceKey('Needle','Hello.'));
  expect(voiceKey('Zero','*Hello.*')).toBe(voiceKey('Zero','Hello.'));
 });
 it('mute immediately stops active speech and removes its advance callback', () => {
  const {hud,line}=setup();void hud.say([line]);const audio=AudioStub.last;
  hud.voiceOn=false;
  expect(audio.pause).toHaveBeenCalledOnce();expect(audio.onended).toBeNull();
 });
 it('a failed audio file releases music ducking and leaves dialogue readable', () => {
  const {hud,line}=setup();hud.onVoice=vi.fn();void hud.say([line]);
  AudioStub.last.onerror?.();
  expect(hud.onVoice).toHaveBeenLastCalledWith(false);expect(hud.talking).toBe(true);
 });
 it('advances after a completed clip, with a reading pause', () => {
  const {hud,line}=setup();void hud.say([line]);AudioStub.last.onended?.();
  vi.advanceTimersByTime(899);expect(hud.talking).toBe(true);
  vi.advanceTimersByTime(1);expect(hud.talking).toBe(false);
 });
});
