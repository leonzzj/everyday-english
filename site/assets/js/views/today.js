/* Today: the lead story "on air", what to listen to next, today's dialogue and reading picks. */
import { $, esc, ICON, fmtLong, fmtStamp, coverHTML } from '../util.js';
import { S, storyHref } from '../state.js';
import { Data } from '../data.js';
import { Story, waveHTML, setWave } from '../story.js';
import { captionHTML } from '../rich.js';
import { TTS, rateSelect, accentSelect } from '../tts.js';
import { Player } from '../audio.js';
import { Prefs } from '../store.js';
import { ENGOO_ITEM } from '../content.js';

let off = [];

export function feedRowsHTML(items) {
  return `<ul class="rows">${items.map(it => `<li><a class="fr" href="${esc(it.url)}" target="_blank" rel="noopener"><span class="src">${esc(it.source)}${it.level ? `　<span class="tag">${esc(it.level)}</span>` : ''}</span><span class="t">${esc(it.title)}</span>${it.desc ? `<span class="d">${esc(it.desc.slice(0, 140))}${it.desc.length > 140 ? '…' : ''}</span>` : ''}<span class="icon-btn sm go" aria-hidden="true">${ICON.ext}</span></a></li>`).join('')}</ul>`;
}
export function feedStamp() {
  const t = Data.feed.updatedAt ? fmtStamp(Data.feed.updatedAt) : '';
  return `<div class="stamp"><span>${t ? '更新于 ' + esc(t) : Data.feedState === 'error' ? '外部更新暂时读取失败' : '每天早上自动抓取'}</span><span>来源：ABC、TED、SBS、Breaking News English、Aeon、Engoo</span></div>`;
}
export function queueItemHTML(it, i) {
  const playing = Player.isPlaying(it);
  const inner = `${coverHTML(it.source)}<span style="min-width:0"><span class="t">${esc(it.title)}</span><span class="s">${esc(it.source)}</span></span><span class="d num">${it.minutes ? it.minutes + ' 分钟' : ''}</span>`;
  return it.audio
    ? `<button class="qi${playing ? ' playing' : ''}" data-act="pod-play" data-i="${i}" aria-label="播放：${esc(it.title)}">${inner}</button>`
    : `<a class="qi" href="${esc(it.url)}" target="_blank" rel="noopener">${inner}</a>`;
}

function heroStory(iss) {
  if (Story.story && Story.date === iss.date && iss.stories.some(s => s.id === Story.story.id)) return Story.story;
  return iss.stories[0];
}

export function render(el) {
  unmount();
  const iss = S.issue;
  if (!iss) {
    el.innerHTML = Data.state === 'loading'
      ? '<div class="hero"><div class="skel" style="height:420px"></div><div class="skel" style="height:420px"></div></div>'
      : `<div class="empty"><b>今天的新闻还没准备好</b>${Data.state === 'error' ? '数据读取失败，刷新一下试试。' : '每天早上 7 点左右更新。下面的口语、听力和阅读随时可以用。'}</div>`;
    return;
  }
  const st = heroStory(iss);
  Story.load(st, S.level);
  const others = iss.stories.filter(s => s.id !== st.id).slice(0, 3);
  const listen = Data.feed.items.filter(i => i.kind === 'listen');
  const read = Data.feed.items.filter(i => i.kind === 'read').concat([ENGOO_ITEM]);
  const phrases = iss.dialogue ? iss.dialogue.phrases.slice(0, 5) : [];
  el.innerHTML = `
  <div class="hero">
    <section class="panel now" aria-label="今日头条">
      <div class="kicker"><span class="cat">${esc(st.category)}</span><span>${esc(fmtLong(iss.date))}</span>${iss.issueNo ? `<span>第 ${iss.issueNo} 期</span>` : ''}</div>
      <h1><a href="${storyHref(iss.date, st.id)}">${esc(st.headline)}</a></h1>
      ${st.headlineZh ? `<p class="zh">${esc(st.headlineZh)}</p>` : ''}
      <p class="caption" id="cap" aria-live="polite"></p>
      ${waveHTML(st.id + iss.date, 88)}
      <div class="ctrl">
        <button class="play" data-act="story-toggle" id="storyPlay" aria-label="朗读">${ICON.play}</button>
        <div class="seg" role="group" aria-label="难度"><button data-act="level" data-level="c1" aria-pressed="${S.level === 'c1'}">C1</button><button data-act="level" data-level="b2" aria-pressed="${S.level === 'b2'}">B2</button></div>
        ${rateSelect('rateT')}${accentSelect('accT')}
        <a class="btn sm" href="${storyHref(iss.date, st.id)}">读全文</a>
        <span class="count num" id="storyCount"></span>
      </div>
      ${TTS.ok ? '' : '<p class="note" style="margin-top:12px">这个浏览器不支持朗读，换 Chrome、Edge 或 Safari 就能听。</p>'}
    </section>
    <aside class="panel queue" aria-label="接下来听">
      <h2>接下来听</h2>
      <div id="queue">${listen.length ? listen.slice(0, 4).map((it) => queueItemHTML(it, Data.feed.items.indexOf(it))).join('') : `<p class="note" style="padding:12px 0">${Data.feedState === 'loading' ? '正在读取各平台的更新……' : '暂时没有新的播客。'}</p>`}</div>
      <a class="more" href="#/listen">全部播客和听力练习 ${ICON.next}</a>
    </aside>
  </div>
  <div class="lower">
    ${others.map(s => `<a class="track" href="${storyHref(iss.date, s.id)}"><span class="cat">${esc(s.category)}</span><h3>${esc(s.headline)}</h3><p>${esc(s.headlineZh)}</p></a>`).join('')}
    ${phrases.length ? `<section class="say"><h2>今天的地道说法</h2><ul class="say-list">${phrases.map(p => `<li><button data-act="say" data-say="${esc(p.en)}" title="朗读"><b>${esc(p.en)}</b><span>${esc(p.plain ? '代替 ' + p.plain : shortZh(p.zh))}</span></button></li>`).join('')}</ul></section>` : ''}
  </div>
  <div class="duo">
    ${iss.dialogue ? `<section><div class="sec-title"><h2>今日对话：${esc(iss.dialogue.zh || iss.dialogue.title)}</h2><a class="btn sm" href="#/speak/daily">跟读整段</a></div>
      <ul class="script">${iss.dialogue.lines.slice(0, 4).map(l => `<li><span class="who ${l.s}">${esc(l.name || l.s)}</span><span>${esc(l.en)}</span></li>`).join('')}</ul></section>` : '<section></section>'}
    <section><div class="sec-title"><h2>今天值得读</h2></div><div id="readFeed">${feedRowsHTML(read.slice(0, 4))}${feedStamp()}</div></section>
  </div>`;
  const sync = () => {
    const cap = $('#cap'), cnt = $('#storyCount'), btn = $('#storyPlay');
    if (!cap) return;
    const i = Math.min(Story.i, Story.sents.length - 1);
    cap.innerHTML = Story.sents.length ? captionHTML(Story.sents[Math.max(0, i)], Story.story.vocab) : '';
    if (cnt) cnt.textContent = Story.sents.length ? `第 ${Math.max(0, i) + 1} / ${Story.sents.length} 句` : '';
    if (btn) { btn.innerHTML = Story.playing ? ICON.pause : ICON.play; btn.setAttribute('aria-label', Story.playing ? '暂停' : '朗读'); }
    setWave(el.querySelector('.wave'), Story.progress());
  };
  sync();
  off.push(Story.on(sync));
  off.push(Player.on(() => refreshQueue()));
}

function shortZh(z) { return String(z || '').split(/[，,；;（(]/)[0].slice(0, 12); }

function refreshQueue() {
  const q = $('#queue'); if (!q) return;
  const listen = Data.feed.items.filter(i => i.kind === 'listen');
  q.innerHTML = listen.slice(0, 4).map(it => queueItemHTML(it, Data.feed.items.indexOf(it))).join('') || '<p class="note" style="padding:12px 0">暂时没有新的播客。</p>';
}

export function unmount() { off.forEach(f => f()); off = []; }
export function onData(el) { render(el); }

export const actions = {
  'story-toggle': () => Story.toggle(),
  'level': b => { S.level = b.dataset.level; Prefs.level = S.level; const st = Story.story; if (st) { Story.story = null; Story.load(st, S.level); } document.dispatchEvent(new Event('ee:rerender')); },
  'pod-play': b => { const it = Data.feed.items[Number(b.dataset.i)]; if (it) Player.play(it); }
};
