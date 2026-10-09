/* Reading: today's picks from other platforms, tap-to-look-up reader for any text, archive, sources. */
import { $, $$, esc, ICON, LS, fmtShort, wordCount } from '../util.js';
import { S } from '../state.js';
import { Data } from '../data.js';
import { TTS } from '../tts.js';
import { articleHTML, allSentences, Scopes } from '../rich.js';
import { READ_RES, ENGOO_ITEM } from '../content.js';
import { readRowsHTML, feedStamp } from './today.js';
import { chanRow } from './listen.js';

let reading = { on: false, run: 0 };

export function render(el) {
  unmount();
  S.paste = LS.get('ee.paste', '');
  const read = Data.feed.items.filter(i => i.kind === 'read').concat([ENGOO_ITEM]);
  el.innerHTML = `<div class="page"><header class="pg-head"><div><h1>${ICON.read}阅读</h1><p class="pg-sub">每天挑一篇有分量的读完。不认识的词点一下就能查，顺手收进生词本。</p></div></header>
  <div class="read-grid">
    <section><div class="sec" style="margin-top:0"><h2>今天值得读</h2></div><div id="readFeed">${readRowsHTML(read)}${feedStamp()}</div></section>
    <section><div class="sec" style="margin-top:0"><h2>点词阅读</h2></div><div class="card pad"><p class="note" style="margin-bottom:12px">课程阅读、外刊、邮件都可以贴进来。每个词都能点开查义、发音、收藏。</p>
      <label class="sr" for="pasteIn">要阅读的英文</label><textarea id="pasteIn" placeholder="在这里粘贴英文……">${esc(S.paste)}</textarea>
      <div class="ctrl" style="margin-top:12px"><button class="btn fill" data-act="paste-go">开始阅读</button><button class="btn" data-act="paste-play" id="pastePlay">${ICON.play}朗读</button></div></div></section>
  </div>
  <div id="pasteOut"></div>
  ${Data.index.length ? `<div class="sec"><h2>往期新闻</h2><span class="note">每一期都能重读、再做一遍题</span></div><ul class="list archive">${Data.index.slice(0, 60).map(x => `<li><div class="row"><span class="d">${esc(fmtShort(x.date))}${x.issueNo ? `<br><span class="l2" style="font-weight:400;font-size:13px">第 ${x.issueNo} 期</span>` : ''}</span><div>${x.headlines.map(h => `<a href="#/news/${x.date}">${esc(h)}</a>`).join('')}</div></div></li>`).join('')}</ul>` : ''}
  <div class="sec"><h2>精选来源</h2><span class="note">各平台的推荐读法</span></div><ul class="list chan">${READ_RES.map(r => chanRow(r)).join('')}</ul></div>`;
  if (S.paste) renderPaste(false);
}

function renderPaste(scroll) {
  const out = $('#pasteOut'); if (!out) return; const t = S.paste.trim();
  if (!t) { out.innerHTML = ''; return; }
  Scopes.set('paste', { vocab: [], src: '我贴的文章' });
  out.innerHTML = `<div class="sec"><h2>你的文章</h2><span class="note"><span class="num">${wordCount(t)}</span> 词　<button class="btn plain" data-act="paste-clear" style="height:auto">清空</button></span></div><section class="card pad" style="max-width:760px"><div class="article" id="pasteText" data-scope="paste">${articleHTML(t.slice(0, 20000), [])}</div></section>`;
  if (scroll) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function readAloud() {
  const box = $('#pasteText'); if (!box) { renderPaste(false); }
  const sents = allSentences(S.paste.slice(0, 20000)); if (!sents.length) return;
  const run = ++reading.run; reading.on = true; syncBtn(); const pt = $('#pasteText'); if (pt) pt.classList.add('playing');
  await TTS.queue(sents.map(t => ({ text: t })), { onStart: k => { $$('#pasteText .sent.on').forEach(s => s.classList.remove('on')); const s = $(`#pasteText .sent[data-s="${k}"]`); if (s) { s.classList.add('on'); const r = s.getBoundingClientRect(); if (r.top < 80 || r.bottom > innerHeight - 120) s.scrollIntoView({ block: 'center', behavior: 'smooth' }); } } });
  if (run !== reading.run) return;
  reading.on = false; $$('#pasteText .sent.on').forEach(s => s.classList.remove('on')); const pt2 = $('#pasteText'); if (pt2) pt2.classList.remove('playing'); syncBtn();
}
function syncBtn() { const b = $('#pastePlay'); if (b) b.innerHTML = reading.on ? `${ICON.pause}停止` : `${ICON.play}朗读`; }

export function unmount() { if (reading.on) { reading.on = false; reading.run++; TTS.stop(); } }
export function onData(el) { const ta = $('#pasteIn'); if (ta && document.activeElement === ta) { const f = $('#readFeed'); if (f) { const read = Data.feed.items.filter(i => i.kind === 'read').concat([ENGOO_ITEM]); f.innerHTML = readRowsHTML(read) + feedStamp(); } return; } if (ta) LS.set('ee.paste', ta.value.slice(0, 20000)); render(el); }

export const actions = {
  'paste-go': () => { const ta = $('#pasteIn'); S.paste = ta ? ta.value : ''; LS.set('ee.paste', S.paste.slice(0, 20000)); renderPaste(true); },
  'paste-play': () => { if (reading.on) { reading.on = false; reading.run++; TTS.stop(); $$('#pasteText .sent.on').forEach(s => s.classList.remove('on')); const pt = $('#pasteText'); if (pt) pt.classList.remove('playing'); syncBtn(); return; } const ta = $('#pasteIn'); S.paste = ta ? ta.value : S.paste; if (!S.paste.trim()) return; LS.set('ee.paste', S.paste.slice(0, 20000)); renderPaste(false); readAloud(); },
  'paste-clear': () => { S.paste = ''; LS.set('ee.paste', ''); const ta = $('#pasteIn'); if (ta) ta.value = ''; renderPaste(false); }
};
