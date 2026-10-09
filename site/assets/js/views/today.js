/* Today: featured story with read-aloud, today's stories, podcasts to play, phrases, dialogue and reading picks. */
import { $, esc, ICON, fmtZhLong, fmtStamp, artHTML, catTile, catArt } from '../util.js';
import { S, storyHref } from '../state.js';
import { Data } from '../data.js';
import { Story, scrubHTML, setScrub } from '../story.js';
import { findVocab } from '../rich.js';
import { TTS, rateSelect, accentSelect } from '../tts.js';
import { Player } from '../audio.js';
import { Prefs } from '../store.js';
import { ENGOO_ITEM } from '../content.js';

let off = [];

export function readRowsHTML(items) {
  return `<ul class="list">${items.map(it => `<li><a class="row" href="${esc(it.url)}" target="_blank" rel="noopener">${artHTML(it)}<div style="min-width:0"><div class="t">${esc(it.title)}</div><div class="s">${esc(it.source)}${it.level ? '　' + esc(it.level) : ''}${it.minutes ? '　' + it.minutes + ' 分钟' : ''}</div>${it.desc ? `<div class="d">${esc(it.desc)}</div>` : ''}</div><span class="end">${ICON.ext}</span></a></li>`).join('')}</ul>`;
}
export function feedStamp() {
  const t = Data.feed.updatedAt ? fmtStamp(Data.feed.updatedAt) : '';
  return `<div class="stamp"><span>${t ? '各平台内容更新于 ' + esc(t) : Data.feedState === 'error' ? '外部更新暂时读取失败' : '每天自动抓取各平台最新内容'}</span><span>来源：ABC、TED、SBS、Breaking News English、Aeon、Engoo</span></div>`;
}
export function podCardHTML(it) {
  const i = Data.feed.items.indexOf(it), playing = Player.isPlaying(it);
  const inner = `<span class="media">${artHTML(it, 'sq')}${it.audio ? `<span class="badge" aria-hidden="true">${playing ? ICON.pause : ICON.play}</span>` : ''}</span><div><div class="t">${esc(it.title)}</div><div class="s">${esc(it.source)}${it.minutes ? '　' + it.minutes + ' 分钟' : ''}</div></div>`;
  return it.audio
    ? `<button class="scard${playing ? ' playing' : ''}" data-act="pod-play" data-i="${i}" aria-label="${playing ? '暂停' : '播放'}：${esc(it.title)}">${inner}</button>`
    : `<a class="scard" href="${esc(it.url)}" target="_blank" rel="noopener">${inner}</a>`;
}

function heroStory(iss) {
  if (Story.story && Story.date === iss.date && iss.stories.some(s => s.id === Story.story.id)) return Story.story;
  return iss.stories[0];
}
function leadHTML(sentence, vocab) {
  if (!sentence) return '';
  const hit = findVocab(sentence, vocab)[0];
  if (!hit) return esc(sentence);
  return esc(sentence.slice(0, hit.st)) + `<span class="vx">${esc(sentence.slice(hit.st, hit.en))}</span>` + esc(sentence.slice(hit.en));
}

export function render(el) {
  unmount();
  const iss = S.issue;
  if (!iss) {
    el.innerHTML = `<div class="page"><header class="pg-head"><div><h1>今日</h1></div></header>${Data.state === 'loading' ? '<div class="skel" style="height:320px"></div>' : `<div class="empty"><b>今天的新闻还没准备好</b>${Data.state === 'error' ? '数据读取失败，刷新一下试试。' : '每天早上 7 点左右更新。口语、听力和阅读随时可以用。'}</div>`}</div>`;
    return;
  }
  const st = heroStory(iss);
  Story.load(st, S.level);
  const art = catArt(st.category);
  const others = iss.stories.filter(s => s.id !== st.id).slice(0, 3);
  const listen = Data.feed.items.filter(i => i.kind === 'listen').slice(0, 4);
  const read = Data.feed.items.filter(i => i.kind === 'read').concat([ENGOO_ITEM]);
  const phrases = iss.dialogue ? iss.dialogue.phrases.slice(0, 5) : [];
  el.innerHTML = `<div class="page">
  <header class="pg-head"><div><h1>今日</h1><p class="pg-sub">${esc(fmtZhLong(iss.date))}${iss.issueNo ? `，第 ${iss.issueNo} 期` : ''}</p></div></header>
  <section class="feature" style="--g1:${art.c[0]};--g2:${art.c[1]}" aria-label="头条">
    <div style="min-width:0">
      <div class="kick"><span>头条</span><span>${esc(st.category)}</span></div>
      <h1><a href="${storyHref(iss.date, st.id)}">${esc(st.headline)}</a></h1>
      ${st.headlineZh ? `<p class="zh">${esc(st.headlineZh)}</p>` : ''}
      <p class="lead" id="lead" aria-live="polite"></p>
      ${scrubHTML()}
      <div class="ctrl">
        <button class="play" data-act="story-toggle" id="storyPlay" aria-label="朗读">${ICON.play}</button>
        <div class="seg" role="group" aria-label="难度"><button data-act="level" data-level="c1" aria-pressed="${S.level === 'c1'}">C1</button><button data-act="level" data-level="b2" aria-pressed="${S.level === 'b2'}">B2</button></div>
        ${rateSelect('rateT')}${accentSelect('accT')}
        <a class="btn white" href="${storyHref(iss.date, st.id)}">读全文</a>
        <span class="count num" id="storyCount"></span>
      </div>
      ${TTS.ok ? '' : '<p class="zh" style="margin-top:10px">这个浏览器不支持朗读，换 Chrome、Edge 或 Safari 就能听。</p>'}
    </div>
    <div class="glyph" aria-hidden="true">${art.glyph}</div>
  </section>

  <div class="sec"><h2>今天的新闻</h2><a class="more" href="#/news">全部 ${iss.stories.length} 篇${ICON.next}</a></div>
  <div class="shelf">${others.map(s => `<a class="scard" href="${storyHref(iss.date, s.id)}"><span class="media">${catTile(s.category, 'cover')}</span><div><div class="k">${esc(s.category)}</div><div class="t">${esc(s.headline)}</div><div class="s">${esc(s.headlineZh)}</div></div></a>`).join('')}</div>

  <div class="sec"><h2>接下来听</h2><a class="more" href="#/listen">全部播客${ICON.next}</a></div>
  <div class="shelf four" id="podShelf">${listen.length ? listen.map(podCardHTML).join('') : `<p class="note">${Data.feedState === 'loading' ? '正在读取各平台的更新……' : '暂时没有新的播客。'}</p>`}</div>

  <div class="duo">
    <section>${phrases.length ? `<div class="sec"><h2>今天的地道说法</h2></div><ul class="list">${phrases.map(p => `<li><button class="say-row" data-act="say" data-say="${esc(p.en)}" aria-label="朗读 ${esc(p.en)}"><span class="t">${esc(p.en)}</span><span class="s">${p.plain ? '代替 ' + esc(p.plain) : esc(p.zh)}</span>${ICON.say}</button></li>`).join('')}</ul>` : ''}</section>
    <section>${iss.dialogue ? `<div class="sec"><h2>今日对话</h2><a class="more" href="#/speak/daily">跟读整段${ICON.next}</a></div>
      <div class="card pad"><ul class="bubbles">${iss.dialogue.lines.slice(0, 4).map(l => `<li class="bub ${l.s}"><span class="who">${esc(l.name || l.s)}</span><div class="body"><div class="txt"><div class="en">${esc(l.en)}</div></div></div></li>`).join('')}</ul></div>` : ''}</section>
  </div>

  <div class="sec"><h2>今天值得读</h2></div>
  <div id="readFeed">${readRowsHTML(read.slice(0, 4))}${feedStamp()}</div>
  <footer class="foot"><span>新闻每天早上 7 点左右更新，根据公开报道改写并附原文链接。</span><span>朗读使用你设备自带的英语语音。</span></footer>
  </div>`;
  const sync = () => {
    const lead = $('#lead'); if (!lead) return;
    const n = Story.sents.length, i = Math.max(0, Math.min(Story.i, n - 1));
    lead.innerHTML = leadHTML(Story.sents[i], Story.story && Story.story.vocab);
    const cnt = $('#storyCount'); if (cnt) cnt.textContent = n ? `${i + 1} / ${n}` : '';
    const btn = $('#storyPlay'); if (btn) { btn.innerHTML = Story.playing ? ICON.pause : ICON.play; btn.setAttribute('aria-label', Story.playing ? '暂停' : '朗读'); }
    setScrub(el.querySelector('.feature .scrub'), Story.progress());
  };
  sync();
  off.push(Story.on(sync));
  off.push(Player.on(() => { const s = $('#podShelf'); if (s && listen.length) s.innerHTML = listen.map(podCardHTML).join(''); }));
}

export function unmount() { off.forEach(f => f()); off = []; }
export function onData(el) { render(el); }

export const actions = {
  'story-toggle': () => Story.toggle(),
  'level': b => { S.level = b.dataset.level; Prefs.level = S.level; const st = Story.story; if (st) { Story.story = null; Story.load(st, S.level); } document.dispatchEvent(new Event('ee:rerender')); },
  'pod-play': b => { const it = Data.feed.items[Number(b.dataset.i)]; if (it) Player.play(it); }
};
