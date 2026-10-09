/* Personal data kept in this browser: word book, quiz answers, preferences. */
import { LS, dayKey, addDays, str } from './util.js';

export const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60];

export function wordId(word) {
  const s = String(word || '').toLowerCase().replace(/['’]s$/, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  return s ? 'w_' + s : '';
}

function normWord(w) {
  if (!w || typeof w !== 'object') return null;
  const word = str(w.word, 80).trim(); if (!word) return null;
  return {
    id: wordId(word), word, zh: str(w.zh, 120), en: str(w.en, 300), ipa: str(w.ipa, 80), pos: str(w.pos, 20),
    ex: str(w.ex, 300), ctx: str(w.ctx, 400), src: str(w.src, 160),
    added: /^\d{4}-\d{2}-\d{2}$/.test(w.added) ? w.added : dayKey(),
    due: /^\d{4}-\d{2}-\d{2}$/.test(w.due) ? w.due : addDays(dayKey(), 1),
    box: Math.max(0, Math.min(6, Number(w.box) || 1)), reps: Number(w.reps) || 0, lapses: Number(w.lapses) || 0
  };
}

export const Words = {
  map: new Map(),
  listeners: new Set(),
  load() { this.map = new Map(); (LS.get('ee.words', []) || []).forEach(w => { const n = normWord(w); if (n) this.map.set(n.id, n); }); },
  save() { LS.set('ee.words', Array.from(this.map.values())); this.listeners.forEach(f => f()); },
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); },
  has(id) { return this.map.has(id); },
  get(id) { return this.map.get(id); },
  add(data) {
    const n = normWord({ ...data, added: dayKey(), due: addDays(dayKey(), 1), box: 1 });
    if (!n) return null;
    const old = this.map.get(n.id);
    if (old) { Object.assign(old, Object.fromEntries(Object.entries(n).filter(([k, v]) => v && !['added', 'due', 'box', 'reps', 'lapses'].includes(k) && !old[k]))); this.save(); return old; }
    this.map.set(n.id, n); this.save(); return n;
  },
  update(id, patch) { const w = this.map.get(id); if (!w) return; Object.assign(w, patch); this.save(); },
  del(id) { this.map.delete(id); this.save(); },
  list() { return Array.from(this.map.values()).sort((a, b) => a.added < b.added ? 1 : a.added > b.added ? -1 : a.word.localeCompare(b.word)); },
  due() { const t = dayKey(); return Array.from(this.map.values()).filter(w => w.due <= t).sort((a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : a.box - b.box); },
  grade(id, g) {
    const w = this.map.get(id); if (!w) return;
    if (g === 'again') { w.box = 1; w.lapses++; w.due = dayKey(); }
    else if (g === 'hard') { w.box = Math.max(1, w.box); w.due = addDays(dayKey(), Math.max(1, Math.round(BOX_DAYS[w.box] / 2))); }
    else { w.box = Math.min(6, w.box + 1); w.due = addDays(dayKey(), BOX_DAYS[w.box]); }
    w.reps++; this.save();
  },
  importList(arr) { let n = 0; (Array.isArray(arr) ? arr : []).forEach(w => { const x = normWord(w); if (x && !this.map.has(x.id)) { this.map.set(x.id, x); n++; } }); this.save(); return n; }
};

/* Quiz answers keyed "date:storyId:level" → {qIndex: choice}; pruned after 120 days. */
export const Quiz = {
  data: {},
  load() { this.data = LS.get('ee.quiz', {}) || {}; const cut = addDays(dayKey(), -120); Object.keys(this.data).forEach(k => { if (k.slice(0, 10) < cut) delete this.data[k]; }); },
  get(key) { return this.data[key] || {}; },
  set(key, qi, val) { (this.data[key] = this.data[key] || {})[qi] = val; LS.set('ee.quiz', this.data); },
  reset(key) { delete this.data[key]; LS.set('ee.quiz', this.data); }
};

export const Prefs = {
  get level() { return LS.get('ee.level', 'c1') === 'b2' ? 'b2' : 'c1'; },
  set level(v) { LS.set('ee.level', v === 'b2' ? 'b2' : 'c1'); },
  get showZh() { return LS.get('ee.showZh', true) !== false; },
  set showZh(v) { LS.set('ee.showZh', !!v); }
};
