/* Browser text-to-speech: accent + speed preferences, sentence queues that can be cancelled. */
import { LS } from './util.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const GOOD = /(natural|neural|premium|enhanced|google|siri|online)/i;
export const ACCENTS = [['en-AU', '澳音'], ['en-GB', '英音'], ['en-US', '美音']];
export const RATES = [0.8, 0.9, 1, 1.1, 1.25];

export const TTS = {
  ok: !!synth && typeof SpeechSynthesisUtterance !== 'undefined',
  voices: [],
  accent: LS.get('ee.accent', 'en-AU'),
  rate: Number(LS.get('ee.rate', 1)) || 1,
  token: 0,
  speaking: false,
  listeners: new Set(),

  init() {
    if (!this.ok) return;
    const load = () => { this.voices = synth.getVoices().filter(v => /^en[-_]/i.test(v.lang)); };
    load();
    if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', load);
  },
  setAccent(a) { this.accent = a; LS.set('ee.accent', a); this.emit(); },
  setRate(r) { this.rate = Number(r) || 1; LS.set('ee.rate', this.rate); this.emit(); },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach(fn => { try { fn(this); } catch (e) { } }); },

  /* Best voice for the accent; alt=true returns a different voice when one exists (for a second speaker). */
  pick(alt = false) {
    const lang = this.accent.toLowerCase();
    const norm = v => v.lang.replace('_', '-').toLowerCase();
    let pool = this.voices.filter(v => norm(v) === lang);
    if (!pool.length) pool = this.voices.filter(v => norm(v).startsWith('en'));
    if (!pool.length) return null;
    pool = pool.slice().sort((a, b) => (GOOD.test(b.name) ? 1 : 0) - (GOOD.test(a.name) ? 1 : 0) || (b.localService ? 0 : 1) - (a.localService ? 0 : 1));
    return alt && pool.length > 1 ? pool[1] : pool[0];
  },

  speak(text, { voice, rate, pitch } = {}) {
    if (!this.ok || !text) return Promise.resolve(false);
    const my = this.token;
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      const v = voice === undefined ? this.pick() : voice;
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = this.accent;
      u.rate = rate || this.rate; u.pitch = pitch || 1;
      let done = false;
      const fin = ok => { if (done) return; done = true; resolve(ok && my === this.token); };
      u.onend = () => fin(true);
      u.onerror = () => fin(false);
      try { synth.speak(u); if (synth.paused) synth.resume(); } catch (e) { fin(false); }
    });
  },

  /* Speak items one after another. items: [{text, voice?, pitch?, pauseAfter?}] */
  async queue(items, { onStart, onDone, startAt = 0 } = {}) {
    this.stop();
    await new Promise(r => setTimeout(r, 60));
    const my = ++this.token;
    this.speaking = true; this.emit(); window.dispatchEvent(new Event('ee:speak'));
    for (let i = startAt; i < items.length; i++) {
      if (my !== this.token) return false;
      const it = items[i];
      onStart && onStart(i);
      if (it.wait) { const ok = await it.wait(); if (!ok || my !== this.token) return false; continue; }
      await this.speak(it.text, it);
      if (my !== this.token) return false;
      if (it.pauseAfter) await new Promise(r => setTimeout(r, it.pauseAfter));
    }
    if (my === this.token) { this.speaking = false; this.emit(); onDone && onDone(); }
    return true;
  },

  stop() {
    this.token++;
    if (this.ok) { try { synth.cancel(); } catch (e) { } }
    if (this.speaking) { this.speaking = false; this.emit(); }
  },

  /* One-off: speak a word or phrase, interrupting anything else. */
  async say(text, opts = {}) { this.stop(); await new Promise(r => setTimeout(r, 40)); const my = ++this.token; this.speaking = true; window.dispatchEvent(new Event('ee:speak')); const ok = await this.speak(text, opts); if (my === this.token) { this.speaking = false; this.emit(); } return ok; }
};

export function accentSelect(id) {
  return `<label class="sr" for="${id}">口音</label><select class="select" id="${id}" data-change="accent">${ACCENTS.map(([v, l]) => `<option value="${v}"${v === TTS.accent ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
}
export function rateSelect(id) {
  return `<label class="sr" for="${id}">语速</label><select class="select" id="${id}" data-change="rate">${RATES.map(r => `<option value="${r}"${r === TTS.rate ? ' selected' : ''}>${r}×</option>`).join('')}</select>`;
}
