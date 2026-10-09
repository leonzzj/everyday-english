/* App shell: routing, the tuning-dial navigation, event delegation and data loading. */
import { $, $$, toast, fmtShort } from './util.js';
import { S } from './state.js';
import { Data } from './data.js';
import { TTS } from './tts.js';
import { Words, Quiz, wordId } from './store.js';
import { Story, waveFraction } from './story.js';
import { Player } from './audio.js';
import { Pop } from './popover.js';
import { Scopes } from './rich.js';
import * as today from './views/today.js';
import * as news from './views/news.js';
import * as speak from './views/speak.js';
import * as listen from './views/listen.js';
import * as read from './views/read.js';
import * as words from './views/words.js';

const VIEWS = { today, news, speak, listen, read, words };
const ACT = {}, CHG = {}, INP = {};
Object.values(VIEWS).forEach(v => { Object.assign(ACT, v.actions || {}); Object.assign(CHG, v.changes || {}); Object.assign(INP, v.inputs || {}); });

/* ---------- global actions ---------- */
Object.assign(ACT, {
  'say': b => TTS.say(b.dataset.say),
  'pop-close': () => Pop.close(),
  'pop-say': () => Pop.say(),
  'pop-save': () => Pop.toggleSave(),
  'pop-from': () => { const k = Number(Pop.data && Pop.data.s); Pop.close(); if (k >= 0) Story.play(k); },
  'mini-toggle': () => Player.toggle(),
  'mini-back': () => Player.skip(-15),
  'mini-close': () => Player.close()
});
Object.assign(CHG, {
  'accent': t => { TTS.setAccent(t.value); $$('select[data-change="accent"]').forEach(s => { s.value = t.value; }); },
  'rate': t => { TTS.setRate(t.value); $$('select[data-change="rate"]').forEach(s => { s.value = t.value; }); },
  'mini-seek': t => Player.seekFrac(Number(t.value) / 1000)
});

/* ---------- routing ---------- */
function parse() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
  const view = VIEWS[parts[0]] ? parts.shift() : 'today';
  return { view, parts };
}
let current = null;
function go() {
  const { view, parts } = parse();
  if (current && VIEWS[current].unmount) VIEWS[current].unmount();
  Pop.close();
  const sameStory = current === 'news' && view === 'news';
  if (!(view === 'today' || view === 'news') && Story.playing) Story.pause();
  S.view = view; S.parts = parts; current = view;
  const el = $('#view');
  VIEWS[view].render(el, parts);
  updateDial(view);
  document.title = ({ today: 'Everyday English', news: '新闻 · Everyday English', speak: '口语 · Everyday English', listen: '听力 · Everyday English', read: '阅读 · Everyday English', words: '生词本 · Everyday English' })[view];
  if (!sameStory || parts.length) window.scrollTo(0, 0);
}
function updateDial(view) {
  const links = $$('.dial a');
  let target = null;
  links.forEach(a => { const on = a.dataset.v === view; a.toggleAttribute('aria-current', false); if (on) { a.setAttribute('aria-current', 'page'); target = a; } });
  const needle = $('.needle'); if (!needle || !target) return;
  const box = $('.dial').getBoundingClientRect(), r = target.getBoundingClientRect();
  needle.style.left = (r.left - box.left + r.width / 2) + 'px';
}
window.addEventListener('hashchange', go);
window.addEventListener('resize', () => updateDial(S.view));
document.addEventListener('ee:rerender', () => { const el = $('#view'); VIEWS[S.view].render(el, S.parts); });

/* ---------- event delegation ---------- */
document.addEventListener('click', e => {
  // blurred role-play line: reveal instead of looking up a word
  const mine = e.target.closest('.line.mine:not(.reveal) .en');
  if (mine) { mine.closest('.line').classList.add('reveal'); return; }
  const b = e.target.closest('[data-act]');
  if (b && ACT[b.dataset.act]) {
    if (b.dataset.act === 'wave-seek') return; // handled on pointerdown
    if (b.tagName === 'A') e.preventDefault();
    ACT[b.dataset.act](b, e); return;
  }
  const scopeEl = e.target.closest('[data-scope]');
  if (!scopeEl) return;
  const scope = Scopes.get(scopeEl.dataset.scope) || { vocab: [], src: '' };
  const vx = e.target.closest('.vx');
  const sent = e.target.closest('.sent');
  const sIdx = sent ? Number(sent.dataset.s) : -1;
  const ctx = sent ? sent.textContent.trim() : (e.target.closest('.line') ? e.target.closest('.line').querySelector('.en').textContent.trim() : '');
  const fromStory = scopeEl.dataset.scope.startsWith('story:') && sIdx >= 0;
  if (vx) { const v = scope.vocab[Number(vx.dataset.v)]; if (v) Pop.open(vx, { word: v.word, zh: v.zh, en: v.en, ipa: v.ipa, pos: v.pos, example: v.example, ctx, src: scope.src, curated: true, s: sIdx, fromStory }); return; }
  const w = e.target.closest('.w');
  if (w) Pop.open(w, { word: w.textContent, ctx, src: scope.src, curated: false, s: sIdx, fromStory });
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('vx')) { e.preventDefault(); e.target.click(); }
  if (e.target.dataset && e.target.dataset.act === 'wave-seek' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); Story.seek(Story.i + (e.key === 'ArrowRight' ? 1 : -1)); }
});
document.addEventListener('pointerdown', e => {
  const wv = e.target.closest('[data-act="wave-seek"]'); if (!wv) return;
  const f = waveFraction(wv, e.clientX); Story.seek(Math.floor(f * Story.sents.length));
});
document.addEventListener('change', e => { const t = e.target; const k = t.dataset && t.dataset.change; if (k && CHG[k]) CHG[k](t, e); });
document.addEventListener('input', e => { const t = e.target; const k = t.dataset && t.dataset.input; if (k && INP[k]) INP[k](t, e); });

/* ---------- boot ---------- */
async function boot() {
  TTS.init(); Words.load(); Quiz.load(); Player.init(); Pop.init();
  const cached = Data.cachedIssue();
  if (cached) S.issue = cached;
  go();
  // Story → mini caption in the issue pill
  const [idx] = await Promise.all([Data.loadIndex(), Data.loadFeed().then(() => notify())]);
  const latest = idx[0] && idx[0].date;
  if (latest) {
    const iss = await Data.loadIssue(latest);
    if (iss) { const changed = !S.issue || S.issue.date !== iss.date || JSON.stringify(S.issue) !== JSON.stringify(iss); S.issue = iss; setPill(); if (changed) notify(); }
  } else if (!S.issue) notify();
  setPill();
}
function setPill() {
  const p = $('#issuePill'); if (!p) return;
  if (S.issue) { p.textContent = S.issue.issueNo ? `第 ${S.issue.issueNo} 期` : fmtShort(S.issue.date); p.title = fmtShort(S.issue.date) + ' 已更新'; p.hidden = false; }
}
function notify() { const v = VIEWS[S.view]; if (v.onData) v.onData($('#view'), S.parts); else v.render($('#view'), S.parts); updateDial(S.view); }

boot();
