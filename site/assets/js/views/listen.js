/* Listening: today's podcast episodes, dictation, shadowing and recommended channels. */
import { $, $$, esc, ICON, toast, fmtShort, artHTML, wordCount } from '../util.js';
import { S } from '../state.js';
import { Data } from '../data.js';
import { TTS, rateSelect, accentSelect } from '../tts.js';
import { Player } from '../audio.js';
import { allSentences } from '../rich.js';
import { SCENARIOS, UPGRADES, FUNC, LISTEN_RES } from '../content.js';
import { feedStamp } from './today.js';

const TABS = [['pods', '今日播客'], ['dictation', '听写'], ['shadow', '跟读'], ['channels', '频道推荐']];
const ACC = { AU: '澳音', UK: '英音', US: '美音', Mixed: '多口音' };
const DICT = { src: 'news-c1', cur: null, checked: false, hint: false, used: new Set(), last: '', count: 0 };
const SH = { src: '', items: [], i: 0, running: false, reps: 1, run: 0, auto: false };
let off = [], keyHandler = null;

export function render(el, parts) {
  unmount();
  let tab = parts[0] || 'pods'; if (!TABS.some(t => t[0] === tab)) tab = 'pods';
  S.listenTab = tab;
  const tabs = `<nav class="seg lg tabs" aria-label="听力栏目">${TABS.map(([k, l]) => `<a href="#/listen/${k}"${k === tab ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  const body = tab === 'pods' ? podsHTML() : tab === 'dictation' ? dictHTML() : tab === 'shadow' ? shadowHTML() : channelsHTML();
  el.innerHTML = `<div class="page"><header class="pg-head"><div><h1>${ICON.listen}听力</h1><p class="pg-sub">泛听用真实播客，精听用听写和跟读。先用正常语速，实在听不出再放慢。</p></div><div class="ctrl">${rateSelect('rateL')}${accentSelect('accL')}</div></header>${tabs}<div id="listenBody">${body}</div></div>`;
  if (tab === 'pods') off.push(Player.on(() => { const b = $('#listenBody'); if (b && S.listenTab === 'pods') b.innerHTML = podsHTML(); }));
  if (tab === 'dictation') {
    keyHandler = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && S.listenTab === 'dictation') { e.preventDefault(); DICT.checked ? nextDict(true) : dictCheck(); } };
    document.addEventListener('keydown', keyHandler);
  }
}

/* ---------- podcasts ---------- */
function podsHTML() {
  const items = Data.feed.items.filter(i => i.kind === 'listen');
  if (!items.length) return `<div class="empty"><b>${Data.feedState === 'loading' ? '正在读取各平台的更新……' : '暂时没有新的播客'}</b>先去“频道推荐”挑一个节目听吧。</div>`;
  return `<ul class="list pods">${items.map(it => {
    const i = Data.feed.items.indexOf(it), playing = Player.isPlaying(it);
    return `<li class="${playing ? 'playing' : ''}"><div class="row">${artHTML(it, 's64')}<div style="min-width:0"><div class="t">${esc(it.title)}</div>${it.desc ? `<div class="d">${esc(it.desc)}</div>` : ''}<div class="m"><span>${esc(it.source)}</span>${it.minutes ? `<span class="num">${it.minutes} 分钟</span>` : ''}${it.accent ? `<span>${esc(ACC[it.accent] || it.accent)}</span>` : ''}${it.level ? `<span class="tag">${esc(it.level)}</span>` : ''}${it.date ? `<span class="num">${esc(fmtShort(it.date))}</span>` : ''}</div></div>
      <div class="end">${it.audio ? `<button class="play" data-act="pod-play" data-i="${i}" aria-label="${playing ? '暂停' : '播放'}：${esc(it.title)}">${playing ? ICON.pause : ICON.play}</button>` : ''}<a class="icon-btn plain" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="打开节目页面" title="打开节目页面">${ICON.ext}</a></div></div></li>`;
  }).join('')}</ul>${feedStamp()}`;
}

/* ---------- dictation ---------- */
function dictPool(src) {
  let pool = [];
  if (src.startsWith('news')) { if (!S.issue) return []; const lvl = src === 'news-b2' ? 'b2' : 'c1'; S.issue.stories.forEach(st => allSentences(st[lvl]).forEach(s => pool.push({ en: s, from: st.headline, date: S.issue.date }))); }
  else if (src === 'dialogue') { (S.issue && S.issue.dialogue ? S.issue.dialogue.lines : []).concat(...SCENARIOS.map(s => s.lines)).forEach(l => pool.push({ en: l.en, zh: l.zh })); }
  else { UPGRADES.forEach(u => { if (/^[A-Z]/.test(u.better) && !u.better.includes('…')) pool.push({ en: u.better.split(' / ')[0], zh: u.why }); }); FUNC.forEach(c => c.items.forEach(p => { if (!p.en.includes('…')) pool.push({ en: p.en, zh: p.zh }); })); SCENARIOS.forEach(sc => sc.phrases.forEach(p => { if (!p.en.includes('…')) pool.push({ en: p.en, zh: p.zh }); })); }
  const fit = pool.filter(x => { const n = wordCount(x.en); return n >= 5 && n <= 32; });
  return fit.length ? fit : pool;
}
function nextDict(rerender) {
  const pool = dictPool(DICT.src);
  if (!pool.length) DICT.cur = null;
  else { let c = pool.filter(x => !DICT.used.has(x.en)); if (!c.length) { DICT.used.clear(); c = pool; } DICT.cur = c[Math.floor(Math.random() * c.length)]; DICT.used.add(DICT.cur.en); }
  DICT.checked = false; DICT.hint = false; DICT.last = '';
  if (rerender) { const b = $('#listenBody'); if (b) { b.innerHTML = dictHTML(); const ta = $('#dictIn'); ta && ta.focus(); } }
}
function dictHTML() {
  if (!TTS.ok) return '<div class="empty"><b>这个浏览器不支持朗读</b>换 Chrome、Edge 或 Safari 打开就能听写。</div>';
  if (!DICT.cur || (DICT.src.startsWith('news') && S.issue && DICT.cur.date && DICT.cur.date !== S.issue.date)) nextDict(false);
  const c = DICT.cur;
  const srcs = [['news-c1', '今日新闻 C1'], ['news-b2', '今日新闻 B2'], ['dialogue', '场景对话'], ['phrases', '地道表达']];
  return `<div class="stage"><div class="card pad">
    <div class="ctrl"><label class="note" for="dictSrc">材料</label><select class="select" id="dictSrc" data-change="dict-src">${srcs.map(s => `<option value="${s[0]}"${s[0] === DICT.src ? ' selected' : ''}>${s[1]}</option>`).join('')}</select>${DICT.count ? `<span class="count num">已听写 ${DICT.count} 句</span>` : ''}</div>
    ${c ? `<div class="ctrl" style="margin:18px 0 14px"><button class="play" data-act="dict-play" aria-label="播放">${ICON.play}</button><button class="btn" data-act="dict-slow">0.75× 慢放</button><button class="btn" data-act="dict-hint">提示首字母</button></div>
      ${DICT.hint ? `<p class="ipa" style="font-size:19px;letter-spacing:.04em;margin-bottom:10px">${esc(c.en.split(/\s+/).map(w => { const k = w.search(/[A-Za-z]/); return w.replace(/[A-Za-z]/g, (ch, p) => p === k ? ch : '_'); }).join(' '))}</p>` : ''}
      <label class="sr" for="dictIn">写下你听到的句子</label><textarea id="dictIn" placeholder="听到什么就写什么，大小写和标点不用管"${DICT.checked ? ' readonly' : ''}>${esc(DICT.checked ? DICT.last : '')}</textarea>
      <div class="ctrl" style="margin-top:12px">${DICT.checked ? `<button class="btn fill" data-act="dict-next">下一句${ICON.next}</button>` : `<button class="btn fill" data-act="dict-check">${ICON.check}核对</button><button class="btn" data-act="dict-next">换一句</button>`}<span class="note">Ctrl / ⌘ + Enter</span></div>
      <div id="dictRes">${DICT.checked ? dictResultHTML() : ''}</div>`
      : `<p class="note" style="margin-top:16px">${DICT.src.startsWith('news') && !S.issue ? (Data.state === 'loading' ? '今日新闻加载中……' : '新闻暂时不可用，先换“场景对话”或“地道表达”。') : '这个材料暂时没有句子，换一个试试。'}</p>`}
  </div><p class="note" style="margin-top:12px">新闻句子长、信息密，和讲座、新闻广播的难度相当。</p></div>`;
}
function normTok(t) { return t.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, '').replace(/^'+|'+$/g, ''); }
function toks(s) { return String(s).split(/[\s\-–—]+/).map(t => ({ raw: t, n: normTok(t) })).filter(t => t.n); }
function diffOps(a, b) {
  const m = a.length, n = b.length, dp = []; for (let i = 0; i <= m; i++) dp.push(new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = a[i].n === b[j].n ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < m && j < n) { if (a[i].n === b[j].n) { ops.push(['ok', a[i].raw]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(['miss', a[i].raw]); i++; } else { ops.push(['extra', b[j].raw]); j++; } }
  while (i < m) ops.push(['miss', a[i++].raw]); while (j < n) ops.push(['extra', b[j++].raw]);
  return { ops, score: m ? ops.filter(o => o[0] === 'ok').length / m : 0 };
}
function dictResultHTML() {
  const c = DICT.cur, r = diffOps(toks(c.en), toks(DICT.last || '')), pct = Math.round(r.score * 100);
  return `<div class="result"><div class="ctrl"><b>${pct === 100 ? '全对！' : pct >= 80 ? `很接近了：${pct}%` : `${pct}%，对照原文再听一遍`}</b><button class="icon-btn" data-act="say" data-say="${esc(c.en)}" aria-label="再听一遍" style="margin-left:auto">${ICON.say}</button></div>
    <div class="diff">${r.ops.map(o => `<span class="${o[0]}">${esc(o[1])}</span>`).join(' ')}</div>
    <p class="note">绿色＝听对；红色波浪线＝漏掉或听错的词；删除线＝原文没有的词。</p>
    <p style="margin-top:10px;font-weight:600">${esc(c.en)}</p>${c.zh ? `<p class="note">${esc(c.zh)}</p>` : ''}${c.from ? `<p class="note">出自：${esc(c.from)}</p>` : ''}</div>`;
}
function dictCheck() {
  const ta = $('#dictIn'); if (!ta || !DICT.cur) return; const v = ta.value.trim();
  if (!v) { toast('先写下你听到的内容'); return; }
  DICT.last = v; DICT.checked = true; DICT.count++;
  const b = $('#listenBody'); if (b) b.innerHTML = dictHTML();
}

/* ---------- shadowing ---------- */
function shadowSources() {
  const list = [];
  if (S.issue) { S.issue.stories.forEach(st => { list.push(['news:' + st.id + ':c1', st.headline + '（C1）']); list.push(['news:' + st.id + ':b2', st.headline + '（B2）']); }); if (S.issue.dialogue) list.push(['dlg:daily', '今日对话：' + S.issue.dialogue.title]); }
  SCENARIOS.forEach(sc => list.push(['dlg:' + sc.id, '场景：' + sc.title]));
  return list;
}
function shadowItems(src) {
  const [kind, id, lvl] = src.split(':');
  if (kind === 'news' && S.issue) { const st = S.issue.stories.find(s => s.id === id); return st ? allSentences(st[lvl] || st.c1) : []; }
  if (kind === 'dlg') { const sc = id === 'daily' ? (S.issue && S.issue.dialogue) : SCENARIOS.find(s => s.id === id); return sc ? sc.lines.map(l => l.en) : []; }
  return [];
}
function shadowHTML() {
  if (!TTS.ok) return '<div class="empty"><b>这个浏览器不支持朗读</b>换 Chrome、Edge 或 Safari 打开就能跟读。</div>';
  const srcs = shadowSources();
  if (!SH.src || !srcs.some(s => s[0] === SH.src)) { SH.src = srcs[0] ? srcs[0][0] : ''; SH.items = shadowItems(SH.src); SH.i = 0; SH.auto = !S.issue; }
  const cur = SH.items[SH.i] || '';
  return `<div class="stage"><div class="card pad">
    <div class="ctrl"><label class="note" for="shSrc">材料</label><select class="select" id="shSrc" data-change="sh-src" style="flex:1;min-width:0;max-width:100%">${srcs.map(s => `<option value="${esc(s[0])}"${s[0] === SH.src ? ' selected' : ''}>${esc(s[1])}</option>`).join('')}</select><label class="note" for="shReps">每句</label><select class="select" id="shReps" data-change="sh-reps">${[1, 2, 3].map(n => `<option value="${n}"${n === SH.reps ? ' selected' : ''}>${n} 遍</option>`).join('')}</select></div>
    <p class="big-sent" id="shCur" aria-live="polite">${esc(cur)}</p>
    <div class="ctrl"><button class="icon-btn gray" data-act="sh-prev" aria-label="上一句">${ICON.back}</button><button class="play lg" data-act="sh-toggle" id="shPlay" aria-label="开始跟读">${SH.running ? ICON.pause : ICON.play}</button><button class="icon-btn gray" data-act="sh-next" aria-label="下一句">${ICON.next}</button><span class="note num" id="shCount" style="margin-left:auto">${SH.items.length ? SH.i + 1 : 0} / ${SH.items.length}</span></div>
    <p class="note" style="margin-top:12px">每句读完会留出同样长的停顿：跟着说，模仿语调、重音和连读。</p>
    <ol class="sh-list" id="shList">${SH.items.map((s, i) => `<li><button class="${i === SH.i ? 'cur' : ''}" data-act="sh-jump" data-i="${i}">${esc(s)}</button></li>`).join('')}</ol>
  </div></div>`;
}
function syncShadow() {
  const c = $('#shCur'); if (!c) return;
  c.textContent = SH.items[SH.i] || '';
  const n = $('#shCount'); if (n) n.textContent = `${SH.items.length ? SH.i + 1 : 0} / ${SH.items.length}`;
  const p = $('#shPlay'); if (p) { p.innerHTML = SH.running ? ICON.pause : ICON.play; p.setAttribute('aria-label', SH.running ? '暂停' : '开始跟读'); }
  $$('#shList button').forEach(b => b.classList.toggle('cur', Number(b.dataset.i) === SH.i));
  const cb = $('#shList button.cur'); if (cb) { const l = $('#shList'); const top = cb.offsetTop - l.offsetTop; if (top < l.scrollTop || top > l.scrollTop + l.clientHeight - 40) l.scrollTop = top - 80; }
}
async function runShadow() {
  const run = ++SH.run; SH.running = true; syncShadow();
  while (SH.running && run === SH.run && SH.i < SH.items.length) {
    const text = SH.items[SH.i];
    for (let r = 0; r < SH.reps; r++) {
      const t0 = Date.now(); await TTS.say(text); if (!SH.running || run !== SH.run) return;
      const gap = Math.min(9000, Math.max(1600, (Date.now() - t0) * 1.05));
      await new Promise(res => setTimeout(res, gap)); if (!SH.running || run !== SH.run) return;
    }
    if (SH.i < SH.items.length - 1) { SH.i++; syncShadow(); } else break;
  }
  if (run === SH.run) { SH.running = false; syncShadow(); }
}
function stopShadow() { if (SH.running) { SH.running = false; SH.run++; TTS.stop(); } }

/* ---------- channels ---------- */
function channelsHTML() {
  const f = S.resFilter, fs = ['All', 'AU', 'UK', 'US', 'Mixed'], names = { All: '全部', ...ACC };
  const list = LISTEN_RES.filter(r => f === 'All' || r.accent === f);
  return `<div class="seg filters" role="group" aria-label="按口音筛选">${fs.map(x => `<button data-act="res-filter" data-f="${x}" aria-pressed="${f === x}">${names[x]}</button>`).join('')}</div>
  <ul class="list chan">${list.map(r => chanRow(r, names)).join('')}</ul>
  <p class="note" style="margin-top:16px">节奏建议：每天一段精听（听写或跟读 10 分钟），通勤路上再泛听一期播客。</p>`;
}
export function chanRow(r, names = ACC) {
  return `<li><div class="row"><div><a class="name" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a>${r.by ? `<div class="by">${esc(r.by)}</div>` : ''}</div>
    <div class="body"><div class="why">${esc(r.why)}</div>${r.extra ? `<a class="extra" href="${esc(r.extra.url)}" target="_blank" rel="noopener">${esc(r.extra.label)}${ICON.ext}</a>` : ''}<div class="tags">${r.level ? `<span class="tag">${esc(r.level)}</span>` : ''}${r.accent ? `<span class="tag">${esc(names[r.accent] || r.accent)}</span>` : ''}${r.len ? `<span class="tag">${esc(r.len)}</span>` : ''}</div></div>
    <a class="icon-btn plain go" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="打开 ${esc(r.name)}">${ICON.ext}</a></div></li>`;
}

export function unmount() { off.forEach(f => f()); off = []; stopShadow(); if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; } }
export function onData(el, parts) {
  const tab = parts[0] || 'pods'; const b = $('#listenBody'); if (!b) return;
  if (tab === 'pods') b.innerHTML = podsHTML();
  else if (tab === 'dictation' && !DICT.checked && !(($('#dictIn') || {}).value || '').trim()) { if (DICT.src.startsWith('news') && !(DICT.cur && DICT.cur.date === (S.issue && S.issue.date))) { DICT.cur = null; b.innerHTML = dictHTML(); } }
  else if (tab === 'shadow' && SH.auto && !SH.running) { SH.src = ''; b.innerHTML = shadowHTML(); }
}

export const actions = {
  'dict-play': () => DICT.cur && TTS.say(DICT.cur.en),
  'dict-slow': () => DICT.cur && TTS.say(DICT.cur.en, { rate: Math.max(0.5, TTS.rate * 0.75) }),
  'dict-hint': () => { DICT.hint = !DICT.hint; const ta = $('#dictIn'); const v = ta ? ta.value : ''; const b = $('#listenBody'); if (b) { b.innerHTML = dictHTML(); const t2 = $('#dictIn'); if (t2 && !DICT.checked) { t2.value = v; t2.focus(); } } },
  'dict-check': () => dictCheck(),
  'dict-next': () => nextDict(true),
  'sh-toggle': () => { if (SH.running) stopShadow(), syncShadow(); else runShadow(); },
  'sh-prev': () => { stopShadow(); SH.i = Math.max(0, SH.i - 1); syncShadow(); },
  'sh-next': () => { stopShadow(); SH.i = Math.min(SH.items.length - 1, SH.i + 1); syncShadow(); },
  'sh-jump': b => { stopShadow(); SH.i = Number(b.dataset.i) || 0; syncShadow(); runShadow(); },
  'res-filter': b => { S.resFilter = b.dataset.f; const box = $('#listenBody'); if (box) box.innerHTML = channelsHTML(); }
};
export const changes = {
  'dict-src': t => { DICT.src = t.value; DICT.used.clear(); nextDict(true); },
  'sh-src': t => { stopShadow(); SH.src = t.value; SH.items = shadowItems(SH.src); SH.i = 0; SH.auto = false; const b = $('#listenBody'); if (b) b.innerHTML = shadowHTML(); },
  'sh-reps': t => { SH.reps = Number(t.value) || 1; }
};
