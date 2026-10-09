/* Read-aloud controller for one story (shared by Today and the reader) + the waveform progress bar. */
import { TTS } from './tts.js';
import { allSentences } from './rich.js';

export const Story = {
  story: null, level: 'c1', sents: [], i: 0, playing: false, run: 0, listeners: new Set(),
  load(story, level) {
    if (this.story && story && this.story.id === story.id && this.level === level && this.date === story._date) return;
    if (this.playing) { TTS.stop(); this.playing = false; }
    this.story = story; this.level = level; this.date = story && story._date;
    this.sents = story ? allSentences(story[level]) : []; this.i = 0; this.emit();
  },
  async play(from = this.i) {
    if (!this.sents.length || !TTS.ok) return;
    const run = ++this.run;
    this.playing = true; this.i = from; this.emit();
    const ok = await TTS.queue(this.sents.map(t => ({ text: t })), { startAt: from, onStart: k => { if (run === this.run) { this.i = k; this.emit(); } } });
    if (run !== this.run) return;
    this.playing = false; if (ok) this.i = 0; this.emit();
  },
  pause() { if (!this.playing) return; this.run++; TTS.stop(); this.playing = false; this.emit(); },
  toggle() { this.playing ? this.pause() : this.play(); },
  seek(k) { this.i = Math.max(0, Math.min(this.sents.length - 1, k)); if (this.playing) this.play(this.i); else this.emit(); },
  progress() { return this.sents.length ? (this.playing || this.i ? (this.i + (this.playing ? 0.5 : 0)) / this.sents.length : 0) : 0; },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach(fn => { try { fn(this); } catch (e) { console.error(e); } }); }
};

export function scrubHTML(cls = '') {
  return `<div class="scrub ${cls}" data-act="wave-seek" role="slider" aria-label="朗读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><i></i></div>`;
}
export function setScrub(el, frac) {
  if (!el) return; const bar = el.firstElementChild; if (bar) bar.style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(2) + '%';
  el.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
}
export function waveFraction(el, clientX) { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(0.999, (clientX - r.left) / r.width)); }
