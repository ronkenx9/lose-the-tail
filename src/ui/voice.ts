export const cleanVoiceText = (text: string) => text.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');
export function voiceKey(who: string, text: string) {
  let h = 2166136261;
  for (const c of `${who}\n${cleanVoiceText(text)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}
export interface VoiceEntry { who: string; text: string; dur: number; voice_id: string; model_id: string; }
