/* Speaking: dialogues to listen to and act out, natural replacements, phrase frames, Aussie English. */
import { $, $$, esc, ICON, toast, scenTile } from '../util.js';
import { S } from '../state.js';
import { TTS, rateSelect, accentSelect } from '../tts.js';
import { wrapWords, Scopes } from '../rich.js';
import { Prefs } from '../store.js';
import { SCENARIOS, UPGRADES, FUNC, AUSSIE } from '../content.js';
import { sayBtn } from './news.js';

const TABS = [['daily', '今日对话'], ['scenes', '场景对话'], ['upgrade', '地道替换'], ['func', '功能句型'], ['aussie', '澳洲口语']];
const DLG = { sc: null, role: null, playing: false, cur: -1, turnResolve: null };

export function render(el, parts) {
  unmount();
  let tab = parts[0] || 'daily', scen = null;
  if (tab === 'scene') { scen = SCENARIOS.find(s => s.id === parts[1]); tab = 'scenes'; if (!scen) { location.hash = '#/speak/scenes'; return; } }
  if (!TABS.some(t => t[0] === tab)) tab = 'daily';
  S.speakTab = tab;
  let body = '';
  if (scen) body = dialogueHTML(scen, true);
  else if (tab === 'daily') body = S.issue && S.issue.dialogue ? dialogueHTML(S.issue.dialogue, false) : `<div class="empty"><b>今天的对话还在准备</b>先从场景对话开始练吧。<div style="margin-top:16px"><a class="btn tinted" href="#/speak/scenes">看场景对话</a></div></div>`;
  else if (tab === 'scenes') body = scenesHTML();
  else if (tab === 'upgrade') body = upgradeHTML();
  else if (tab === 'func') body = funcHTML();
  else body = aussieHTML();
  el.innerHTML = `<div class="page"><header class="pg-head"><div><h1>口语</h1><p class="pg-sub">只练真正用得上的地道说法：听原声，跟着说，再把自己的说法换掉。</p></div></header>
  <nav class="seg lg tabs" aria-label="口语栏目">${TABS.map(([k, l]) => `<a href="#/speak/${k}"${k === tab ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  <div id="speakBody">${body}</div></div>`;
  if (DLG.sc) syncDialogue();
}

/* ---------- dialogues ---------- */
function scenesHTML() {
  const daily = S.issue && S.issue.dialogue;
  return (daily ? `<a class="card featured" href="#/speak/daily">${scenTile('daily', 's56')}<div style="min-width:0"><div class="cat">今日对话</div><div class="t">${esc(daily.title)}</div><div class="s">${esc(daily.zh || '')}${daily.settingZh ? '。' + esc(daily.settingZh) : ''}</div></div><span class="btn fill">${ICON.play}开始</span></a>` : '') +
    `<div class="scen-grid">${SCENARIOS.map(sc => `<a class="card scen" href="#/speak/scene/${sc.id}">${scenTile(sc.id)}<div style="min-width:0"><div class="t">${esc(sc.title)}</div><div class="s">${esc(sc.zh)}</div></div><span class="n">${sc.lines.length} 句</span></a>`).join('')}</div>`;
}

function dialogueHTML(sc, isScene) {
  DLG.sc = sc; DLG.role = null; DLG.cur = -1;
  const scope = 'dlg:' + (sc.id || 'daily');
  Scopes.set(scope, { vocab: [], src: sc.title });
  return `${isScene ? `<a class="back" href="#/speak/scenes">${ICON.back}全部场景</a>` : ''}
  <div class="dlg-head" style="margin-top:${isScene ? 18 : 0}px">${scenTile(sc.id || 'daily', 's56')}<div style="min-width:0"><h2>${esc(sc.title)}</h2><p class="s">${esc(sc.zh || '')}${sc.settingZh ? '　' + esc(sc.settingZh) : ''}</p></div></div>
  <div class="dlg-tools">
    <button class="btn fill" data-act="dlg-play" id="dlgPlay">${ICON.play}播放全部</button>
    <div class="seg" role="group" aria-label="角色扮演"><button data-act="dlg-role" data-role="A" aria-pressed="false">我来演 ${esc(sc.roles.A)}</button><button data-act="dlg-role" data-role="B" aria-pressed="false">我来演 ${esc(sc.roles.B)}</button></div>
    <button class="btn" data-act="dlg-zh" aria-pressed="${Prefs.showZh}">${Prefs.showZh ? '隐藏中文' : '显示中文'}</button>
    ${rateSelect('rateS')}${accentSelect('accS')}
  </div>
  <div id="turn" aria-live="polite"></div>
  <ol class="bubbles${Prefs.showZh ? '' : ' no-zh'}" id="lines" data-scope="${esc(scope)}">${sc.lines.map((l, i) => `<li class="bub ${l.s}" data-i="${i}"><span class="who">${esc(l.name || sc.roles[l.s])}</span><div class="body"><div class="txt"><div class="en">${wrapWords(l.en)}</div><div class="zh">${esc(l.zh)}</div></div>${sayBtn(l.en, '朗读这一句', 'plain')}</div></li>`).join('')}</ol>
  ${sc.phrases && sc.phrases.length ? `<div class="sec"><h2>换个更地道的说法</h2><span class="note">左边是常见说法，右边是对话里的说法</span></div>
  <ul class="list ups">${sc.phrases.map(p => `<li><div class="row"><span class="from">${esc(p.plain || '')}</span><div class="main"><div class="to">${esc(p.en)}</div><div class="why">${esc(p.zh)}</div></div><div class="side">${sayBtn(p.en, '朗读')}</div></div></li>`).join('')}</ul>` : ''}
  ${sc.tip ? `<div class="tipbox">${esc(sc.tip)}</div>` : ''}`;
}

function syncDialogue() {
  $$('#lines .bub').forEach(li => {
    const i = Number(li.dataset.i), l = DLG.sc.lines[i];
    li.classList.toggle('on', i === DLG.cur);
    li.classList.toggle('mine', !!DLG.role && l.s === DLG.role);
  });
  $$('[data-act="dlg-role"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.role === DLG.role)));
  const p = $('#dlgPlay'); if (p) p.innerHTML = DLG.playing ? `${ICON.pause}停止` : `${ICON.play}${DLG.role ? '开始对练' : '播放全部'}`;
}

function waitTurn(line) {
  return new Promise(resolve => {
    const box = $('#turn'); const words = line.en.split(/\s+/).length;
    const ms = Math.max(3500, words * 650 + 1500);
    if (box) box.innerHTML = `<div class="turn"><span><b>轮到你了</b>　说出这一句：${esc(line.zh)}</span><button class="btn fill" data-act="turn-done">我说完了</button></div>`;
    const t = setTimeout(() => done(true), ms);
    const my = TTS.token;
    const watch = setInterval(() => { if (TTS.token !== my) done(false); }, 200);
    function done(ok) { clearTimeout(t); clearInterval(watch); DLG.turnResolve = null; if (box) box.innerHTML = ''; resolve(ok); }
    DLG.turnResolve = () => done(true);
  });
}

async function playDialogue() {
  const sc = DLG.sc; if (!sc || !TTS.ok) { if (!TTS.ok) toast('这个浏览器不支持朗读'); return; }
  const vA = TTS.pick(false), vB = TTS.pick(true); const same = vA && vB && vA === vB;
  const items = [], map = [];
  sc.lines.forEach((l, i) => {
    const voice = l.s === 'A' ? vA : vB, pitch = same ? (l.s === 'A' ? 0.94 : 1.08) : 1;
    if (DLG.role && l.s === DLG.role) { items.push({ wait: () => waitTurn(l) }); map.push(i); }
    items.push({ text: l.en, voice, pitch, pauseAfter: 250 }); map.push(i);
  });
  DLG.playing = true; syncDialogue();
  const ok = await TTS.queue(items, { onStart: k => { DLG.cur = map[k]; if (DLG.role && sc.lines[map[k]].s === DLG.role && !items[k].wait) { const li = $(`#lines .bub[data-i="${map[k]}"]`); li && li.classList.add('reveal'); } syncDialogue(); scrollLine(); } });
  DLG.playing = false; if (ok) DLG.cur = -1; $$('#lines .bub.reveal').forEach(li => li.classList.remove('reveal')); syncDialogue();
}
function scrollLine() { const li = $(`#lines .bub[data-i="${DLG.cur}"]`); if (!li) return; const r = li.getBoundingClientRect(); if (r.top < 80 || r.bottom > window.innerHeight - 160) li.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
function stopDialogue() { if (DLG.playing) { TTS.stop(); DLG.playing = false; } if (DLG.turnResolve) DLG.turnResolve(); DLG.sc = null; DLG.cur = -1; }

/* ---------- phrase banks ---------- */
function upgradeHTML() {
  const f = S.upFilter, tags = ['全部', '口语', '写作', '易错'];
  const list = UPGRADES.filter(u => f === '全部' || u.tag === f);
  return `<p class="l2" style="margin-bottom:16px;font-size:15px">把“能听懂但很普通”的说法，换成母语者更常用的说法。易错一栏是中文母语者最常见的语法坑。</p>
  <div class="seg filters" role="group" aria-label="筛选">${tags.map(t => `<button data-act="up-filter" data-f="${t}" aria-pressed="${t === f}">${t}</button>`).join('')}</div>
  <ul class="list ups">${list.map(u => `<li><div class="row"><span class="from">${esc(u.plain)}</span><div class="main"><div class="to">${esc(u.better)}</div><div class="why">${esc(u.why)}</div></div><div class="side"><span class="tag">${esc(u.tag)}</span>${sayBtn(u.better.split(' / ')[0].replace(/（.*?）/g, ''), '朗读 ' + u.better)}</div></div></li>`).join('')}</ul>`;
}
function funcHTML() {
  return `<p class="l2" style="margin-bottom:18px;font-size:15px">讨论、开会、课堂发言时撑起一段话的“骨架句”。每组挑两句练熟就够用。</p>
  <div class="func-grid">${FUNC.map(c => `<section class="func"><h3>${esc(c.t)}<small>${esc(c.en)}</small></h3><ul class="list">${c.items.map(p => `<li><div class="row"><div style="min-width:0"><div class="t">${esc(p.en)}</div><div class="s">${esc(p.zh)}</div></div>${sayBtn(p.en.replace(/…/g, ' '), '朗读 ' + p.en, 'plain')}</div></li>`).join('')}</ul></section>`).join('')}</div>`;
}
function aussieHTML() {
  return `<p class="l2" style="margin-bottom:18px;font-size:15px">在墨尔本天天能听到的说法。不一定要说，但一定要听得懂。</p>
  <div class="slang-grid">${AUSSIE.map(a => `<div class="card slang"><div class="hd"><b>${esc(a.term)}</b>${sayBtn(a.ex, '朗读例句')}</div><div class="m">${esc(a.zh)}　${esc(a.mean)}</div><div class="e">${esc(a.ex)}</div></div>`).join('')}</div>`;
}

export function unmount() { stopDialogue(); }
export function onData(el, parts) { if ((parts[0] || 'daily') === 'daily' && !DLG.playing) render(el, parts); }

export const actions = {
  'dlg-play': () => { if (DLG.playing) { TTS.stop(); if (DLG.turnResolve) DLG.turnResolve(); } else playDialogue(); },
  'dlg-role': b => { const r = b.dataset.role; DLG.role = DLG.role === r ? null : r; if (DLG.playing) TTS.stop(); syncDialogue(); },
  'dlg-zh': b => { Prefs.showZh = !Prefs.showZh; const ol = $('#lines'); if (ol) ol.classList.toggle('no-zh', !Prefs.showZh); b.textContent = Prefs.showZh ? '隐藏中文' : '显示中文'; b.setAttribute('aria-pressed', String(Prefs.showZh)); },
  'turn-done': () => { if (DLG.turnResolve) DLG.turnResolve(); },
  'up-filter': b => { S.upFilter = b.dataset.f; const box = $('#speakBody'); if (box) box.innerHTML = upgradeHTML(); }
};
