/* Reading: today's picks from other platforms, tap-to-look-up reader for any text, archive, sources. */
import { $, $$, esc, ICON, LS, fmtShort, wordCount } from '../util.js';
import { S } from '../state.js';
import { Data } from '../data.js';
import { TTS } from '../tts.js';
import { articleHTML, allSentences, Scopes } from '../rich.js';
import { READ_RES, ENGOO_ITEM } from '../content.js';
import { feedRowsHTML, feedStamp } from './today.js';
import { chanRow } from './listen.js';

let reading = { on: false, run: 0 };

export function render(el) {
  unmount();
  S.paste = LS.get('ee.paste', '');
  const read = Data.feed.items.filter(i => i.kind === 'read').concat([ENGOO_ITEM]);
  el.innerHTML = `<div class="page-head"><div><h1>阅读</h1><p class="lede">每天挑一篇有分量的读完，不认识的词点一下就能查，顺手收进生词本。</p></div></div>
  <div class="read-grid">
    <section class="panel"><h2 style="font-size:21px;font-stretch:112%;margin-bottom:6px">今天值得读</h2><div id="readFeed">${feedRowsHTML(read)}${feedStamp()}</div></section>
    <section class="panel"><h2 style="font-size:21px;font-stretch:112%">点词阅读</h2><p class="note" style="margin:6px 0 12px">课程阅读、外刊、邮件都可以贴进来。每个词都能点开查义、发音、收藏。</p>
      <label class="sr" for="pasteIn">要阅读的英文</label><textarea id="pasteIn" placeholder="在这里粘贴英文……">${esc(S.paste)}</textarea>
      <div class="ctrl" style="margin-top:12px"><button class="btn primary" data-act="paste-go">开始阅读</button><button class="btn" data-act="paste-play" id="pastePlay">${ICON.play}朗读</button></div></section>
  </div>
  <div class="paste-out" id="pasteOut"></div>
  ${Data.index.length ? `<div class="sec-title"><h2>往期新闻</h2><span class="aside">每一期都能重读、再做一遍题</span></div><ul class="archive">${Data.index.slice(0, 60).map(x => `<li><span class="d">${esc(fmtShort(x.date))}${x.issueNo ? ` <span class="dim" style="font-weight:400">第${x.issueNo}期</span>` : ''}</span><div>${x.headlines.map(h => `<a href="#/news/${x.date}">${esc(h)}</a>`).join('')}</div></li>`).join('')}</ul>` : ''}
  <div class="sec-title"><h2>精选来源</h2><span class="aside">各平台的推荐读法</span></div><ul class="rows">${READ_RES.map(r => chanRow(r)).join('')}</ul>`;
  if (S.paste) renderPaste(false);
}

function renderPaste(scroll) {
  const out = $('#pasteOut'); if (!out) return; const t = S.paste.trim();
  if (!t) { out.innerHTML = ''; return; }
  Scopes.set('paste', { vocab: [], src: '我贴的文章' });
  out.innerHTML = `<section class="panel"><div class="ctrl" style="margin-bottom:12px"><span class="note">你的文章，<span class="num">${wordCount(t)}</span> 词</span><button class="btn sm" data-act="paste-clear" style="margin-left:auto">清空</button></div><div class="article" id="pasteText" data-scope="paste">${articleHTML(t.slice(0, 20000), [])}</div></section>`;
  if (scroll) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function readAloud() {
  const box = $('#pasteText'); if (!box) { renderPaste(false); }
  const sents = allSentences(S.paste.slice(0, 20000)); if (!sents.length) return;
  const run = ++reading.run; reading.on = true; syncBtn();
  await TTS.queue(sents.map(t => ({ text: t })), { onStart: k => { $$('#pasteText .sent.on').forEach(s => s.classList.remove('on')); const s = $(`#pasteText .sent[data-s="${k}"]`); if (s) { s.classList.add('on'); const r = s.getBoundingClientRect(); if (r.top < 80 || r.bottom > innerHeight - 120) s.scrollIntoView({ block: 'center', behavior: 'smooth' }); } } });
  if (run !== reading.run) return;
  reading.on = false; $$('#pasteText .sent.on').forEach(s => s.classList.remove('on')); syncBtn();
}
function syncBtn() { const b = $('#pastePlay'); if (b) b.innerHTML = reading.on ? `${ICON.pause}停止` : `${ICON.play}朗读`; }

export function unmount() { if (reading.on) { reading.on = false; reading.run++; TTS.stop(); } }
export function onData(el) { const ta = $('#pasteIn'); if (ta && document.activeElement === ta) { const f = $('#readFeed'); if (f) { const read = Data.feed.items.filter(i => i.kind === 'read').concat([ENGOO_ITEM]); f.innerHTML = feedRowsHTML(read) + feedStamp(); } return; } if (ta) LS.set('ee.paste', ta.value.slice(0, 20000)); render(el); }

export const actions = {
  'paste-go': () => { const ta = $('#pasteIn'); S.paste = ta ? ta.value : ''; LS.set('ee.paste', S.paste.slice(0, 20000)); renderPaste(true); },
  'paste-play': () => { if (reading.on) { reading.on = false; reading.run++; TTS.stop(); $$('#pasteText .sent.on').forEach(s => s.classList.remove('on')); syncBtn(); return; } const ta = $('#pasteIn'); S.paste = ta ? ta.value : S.paste; if (!S.paste.trim()) return; LS.set('ee.paste', S.paste.slice(0, 20000)); renderPaste(false); readAloud(); },
  'paste-clear': () => { S.paste = ''; LS.set('ee.paste', ''); const ta = $('#pasteIn'); if (ta) ta.value = ''; renderPaste(false); }
};
