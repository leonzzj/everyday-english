/* App shell: navigation (sidebar + tab bar), routing, event delegation, appearance and data loading. */
import { $, $$, ICON, LS, fmtShort } from './util.js';
import { S } from './state.js';
import { Data } from './data.js';
import { TTS } from './tts.js';
import { Words, Quiz } from './store.js';
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
const NAV = [['today', '今日', '#/'], ['news', '新闻', '#/news'], ['speak', '口语', '#/speak'], ['listen', '听力', '#/listen'], ['read', '阅读', '#/read'], ['words', '生词本', '#/words']];
const TITLES = { today: 'Everyday English', news: '新闻 · Everyday English', speak: '口语 · Everyday English', listen: '听力 · Everyday English', read: '阅读 · Everyday English', words: '生词本 · Everyday English' };
const ACT = {}, CHG = {}, INP = {};
Object.values(VIEWS).forEach(v => { Object.assign(ACT, v.actions || {}); Object.assign(CHG, v.changes || {}); Object.assign(INP, v.inputs || {}); });

/* ---------- global actions ---------- */
Object.assign(ACT, {
  'say': b => TTS.say(b.dataset.say),
  'pop-close': () => Pop.close(),
  'pop-say': () => Pop.say(),
  'pop-save': () => Pop.toggleSave(),
  'pop-from': () => { const k = Number(Pop.data && Pop.data.s); Pop.close(); if (k >= 0) Story.play(k); },
  'story-toggle': () => Story.toggle(),
  'mini-toggle': () => Player.toggle(),
  'mini-back': () => Player.skip(-15),
  'mini-close': () => Player.close(),
  'theme': b => setTheme(b.dataset.t)
});
Object.assign(CHG, {
  'accent': t => { TTS.setAccent(t.value); $$('select[data-change="accent"]').forEach(s => { s.value = t.value; }); },
  'rate': t => { TTS.setRate(t.value); $$('select[data-change="rate"]').forEach(s => { s.value = t.value; }); },
  'mini-seek': t => Player.seekFrac(Number(t.value) / 1000)
});

/* ---------- navigation chrome ---------- */
function buildNav() {
  const links = NAV.map(([v, label, href]) => `<a href="${href}" data-v="${v}">${ICON[v]}<span>${label}</span></a>`).join('');
  $('#sideNav').innerHTML = links; $('#tabbar').innerHTML = links;
  renderTheme();
}
function markNav(view) { $$('#sideNav a, #tabbar a').forEach(a => { if (a.dataset.v === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
function setTheme(t) {
  if (t === 'light' || t === 'dark') { document.documentElement.dataset.theme = t; LS.set('ee.theme', t); }
  else { delete document.documentElement.dataset.theme; LS.del('ee.theme'); }
  renderTheme();
}
function renderTheme() {
  const cur = document.documentElement.dataset.theme || 'auto';
  $('#theme').innerHTML = [['auto', ICON.auto, '跟随系统'], ['light', ICON.sun, '浅色'], ['dark', ICON.moon, '深色']]
    .map(([t, ic, l]) => `<button data-act="theme" data-t="${t}" aria-pressed="${cur === t}" aria-label="${l}" title="${l}">${ic}</button>`).join('');
}
function setStatus() {
  const el = $('#status'); if (!el) return;
  el.innerHTML = S.issue ? `<b>第 ${S.issue.issueNo || '·'} 期已更新</b>${fmtShort(S.issue.date)}，每天早上 7 点左右更新` : '每天早上 7 点左右更新';
}

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
  S.view = view; S.parts = parts; current = view;
  VIEWS[view].render($('#view'), parts);
  markNav(view);
  document.title = TITLES[view];
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', go);
document.addEventListener('ee:rerender', () => VIEWS[S.view].render($('#view'), S.parts));

/* ---------- event delegation ---------- */
document.addEventListener('click', e => {
  const mine = e.target.closest('.bub.mine:not(.reveal) .en');
  if (mine) { mine.closest('.bub').classList.add('reveal'); return; }
  const b = e.target.closest('[data-act]');
  if (b && ACT[b.dataset.act]) {
    if (b.dataset.act === 'wave-seek') return; // handled on pointerdown
    if (b.tagName === 'A') e.preventDefault();
    ACT[b.dataset.act](b, e); return;
  }
  const scopeEl = e.target.closest('[data-scope]');
  if (!scopeEl) return;
  const scope = Scopes.get(scopeEl.dataset.scope) || { vocab: [], src: '' };
  const vx = e.target.closest('.vx'), sent = e.target.closest('.sent'), bub = e.target.closest('.bub');
  const sIdx = sent ? Number(sent.dataset.s) : -1;
  const ctx = sent ? sent.textContent.trim() : bub ? bub.querySelector('.en').textContent.trim() : '';
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
  Story.seek(Math.floor(waveFraction(wv, e.clientX) * Story.sents.length));
});
document.addEventListener('change', e => { const t = e.target, k = t.dataset && t.dataset.change; if (k && CHG[k]) CHG[k](t, e); });
document.addEventListener('input', e => { const t = e.target, k = t.dataset && t.dataset.input; if (k && INP[k]) INP[k](t, e); });

/* ---------- boot ---------- */
function notify() { const v = VIEWS[S.view]; if (v.onData) v.onData($('#view'), S.parts); else v.render($('#view'), S.parts); }
async function boot() {
  TTS.init(); Words.load(); Quiz.load(); Player.init(); Pop.init(); buildNav();
  const cached = Data.cachedIssue(), cachedFeed = Data.cachedFeed();
  if (cached) S.issue = cached;
  if (cachedFeed) Data.feed = cachedFeed;
  setStatus();
  go();
  const feedBefore = JSON.stringify(Data.feed);
  const [idx] = await Promise.all([Data.loadIndex(), Data.loadFeed()]);
  let changed = JSON.stringify(Data.feed) !== feedBefore;
  const latest = idx[0] && idx[0].date;
  if (latest) {
    const iss = await Data.loadIssue(latest);
    if (iss && (!S.issue || JSON.stringify(S.issue) !== JSON.stringify(iss))) { S.issue = iss; changed = true; }
  }
  if (!S.issue) changed = true;
  setStatus();
  if (changed) notify();
}
boot();
