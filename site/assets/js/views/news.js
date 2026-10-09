/* News: issue list, archive and the reader (read-aloud transcript, key expressions, quiz, speaking prompt). */
import { $, $$, esc, ICON, fmtZhLong, fmtShort, wordCount, toast, catTile } from '../util.js';
import { S, storyHref } from '../state.js';
import { Data } from '../data.js';
import { Story, scrubHTML, setScrub } from '../story.js';
import { articleHTML, Scopes } from '../rich.js';
import { rateSelect, accentSelect } from '../tts.js';
import { Words, wordId, Quiz } from '../store.js';

let off = [];
const PROMPT_PHRASES = ["I'd argue that…", 'It could be argued that…', 'Admittedly,… but…', 'Take … for instance.'];

function levelSeg() {
  return `<div class="seg" role="group" aria-label="难度"><button data-act="level" data-level="c1" aria-pressed="${S.level === 'c1'}">C1</button><button data-act="level" data-level="b2" aria-pressed="${S.level === 'b2'}">B2</button></div>`;
}
export function sayBtn(text, label, cls = '') { return `<button class="icon-btn ${cls}" data-act="say" data-say="${esc(text)}" aria-label="${esc(label || '朗读')}" title="朗读">${ICON.say}</button>`; }

export async function render(el, parts) {
  unmount();
  const [date, id] = parts;
  let iss = S.issue;
  if (date && (!iss || iss.date !== date)) {
    el.innerHTML = '<div class="page"><div class="skel" style="height:360px"></div></div>';
    iss = await Data.loadIssue(date);
    if (!iss) { el.innerHTML = `<div class="page"><div class="empty"><b>没找到 ${esc(date)} 这一期</b><a class="btn tinted" href="#/news" style="margin-top:14px">回到最新一期</a></div></div>`; return; }
  }
  if (!iss) { el.innerHTML = `<div class="page"><header class="pg-head"><div><h1>${ICON.news}新闻</h1></div></header>${Data.state === 'loading' ? '<div class="skel" style="height:360px"></div>' : '<div class="empty"><b>还没有新闻</b>每天早上 7 点左右更新。</div>'}</div>`; return; }
  S.newsIssue = iss;
  const st = id && iss.stories.find(s => s.id === id);
  if (id && !st) { location.hash = '#/news/' + iss.date; return; }
  st ? renderReader(el, iss, st) : renderList(el, iss);
}

function renderList(el, iss) {
  const idx = Data.index;
  el.innerHTML = `<div class="page">
  <header class="pg-head"><div><h1>${ICON.news}新闻</h1><p class="pg-sub">每天 4 篇，各有 C1 和 B2 两个版本。点任意单词查词，跟着朗读练听力。</p></div>
    <div class="ctrl">${levelSeg()}<label class="sr" for="issueSel">选择日期</label><select class="select" id="issueSel" data-change="issue">${(idx.length ? idx : [{ date: iss.date, issueNo: iss.issueNo }]).map(x => `<option value="${x.date}"${x.date === iss.date ? ' selected' : ''}>${esc(fmtShort(x.date))}${x.issueNo ? `　第 ${x.issueNo} 期` : ''}</option>`).join('')}</select></div></header>
  <div class="sec" style="margin-top:0"><h2>${esc(fmtZhLong(iss.date))}</h2>${iss.title ? `<span class="note">${esc(iss.title)}</span>` : ''}</div>
  <ul class="list">${iss.stories.map(s => `<li><a class="story" href="${storyHref(iss.date, s.id)}">${catTile(s.category, 's64')}<div style="min-width:0"><div class="cat">${esc(s.category)}</div><div class="t">${esc(s.headline)}</div>${s.headlineZh ? `<div class="zh">${esc(s.headlineZh)}</div>` : ''}${s.summaryZh ? `<div class="sum">${esc(s.summaryZh)}</div>` : ''}<div class="m"><span class="tag num">${wordCount(s[S.level])} 词</span><span class="tag">${s.vocab.length} 个表达</span><span class="tag">${s.questions.length} 道题</span></div></div><span class="end">${ICON.next}</span></a></li>`).join('')}</ul>
  ${idx.length > 1 ? `<div class="sec"><h2>往期</h2><span class="note">每一期都可以重读、再做一遍题</span></div><ul class="list archive">${idx.filter(x => x.date !== iss.date).slice(0, 60).map(x => `<li><div class="row"><span class="d">${esc(fmtShort(x.date))}${x.issueNo ? `<br><span class="l2" style="font-weight:400;font-size:13px">第 ${x.issueNo} 期</span>` : ''}</span><div>${x.headlines.map(h => `<a href="#/news/${x.date}">${esc(h)}</a>`).join('')}</div></div></li>`).join('')}</ul>` : ''}
  </div>`;
}

function renderReader(el, iss, st) {
  Story.load(st, S.level);
  const key = `${iss.date}:${st.id}`;
  const scope = 'story:' + key;
  Scopes.set(scope, { vocab: st.vocab, src: st.headline });
  const i = iss.stories.indexOf(st), prev = iss.stories[i - 1], next = iss.stories[i + 1];
  el.innerHTML = `<div class="page"><article class="reader">
    <a class="back" href="#/news/${iss.date}">${ICON.back}新闻</a>
    <div class="meta"><span class="cat">${esc(st.category)}</span><span>${esc(fmtZhLong(iss.date))}</span><span class="num">${wordCount(st[S.level])} 词</span></div>
    <h1>${esc(st.headline)}</h1>
    ${st.headlineZh ? `<p class="zh">${esc(st.headlineZh)}</p>` : ''}
    ${st.summaryZh ? `<p class="sum">${esc(st.summaryZh)}</p>` : ''}
    <div class="player">
      <button class="play" data-act="story-toggle" id="storyPlay" aria-label="朗读全文">${ICON.play}</button>
      <div style="min-width:0">${scrubHTML()}<div class="info" style="margin-top:8px"><span>朗读全文，正在读的句子会高亮</span><span class="num" id="storyCount"></span></div></div>
      <div class="tools">${levelSeg()}${rateSelect('rateR')}${accentSelect('accR')}</div>
    </div>
    <div class="article" id="art" data-scope="${esc(scope)}">${articleHTML(st[S.level], st.vocab)}</div>
    <p class="hint">点任意单词查词，紫色的是这篇的重点表达。</p>
    ${st.vocab.length ? `<div class="sec"><h2>重点表达</h2><span class="note">${st.vocab.length} 个，可以直接用进口语和写作</span></div>
    <ul class="list gloss">${st.vocab.map((v, k) => glossRow(v, k)).join('')}</ul>` : ''}
    ${st.questions.length ? `<div class="sec"><h2>读后小测</h2></div><p class="note" style="margin:-4px 0 16px">判断题：True 原文明确这么说；False 和原文矛盾；Not Given 原文没提到。</p><div class="quiz" id="quiz">${quizHTML(st, key)}</div>` : ''}
    ${st.discuss ? `<div class="sec"><h2>开口说</h2></div><section class="card talk"><div class="q2"><span>${esc(st.discuss)}</span>${sayBtn(st.discuss, '朗读问题')}</div>
      <p class="note" style="margin:12px 0 12px">用上两三个今天的表达，大声说一分钟。可以从这些开头：</p><div class="chips">${PROMPT_PHRASES.map(p => `<button class="chip" data-act="say" data-say="${esc(p.replace(/…/g, ''))}">${esc(p)}</button>`).join('')}</div></section>` : ''}
    ${st.sources.length ? `<div class="sec"><h2>原文来源</h2><span class="note">根据报道改写，细节以原文为准</span></div><ul class="src-list">${st.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}${ICON.ext}</a></li>`).join('')}</ul>` : ''}
    <nav class="story-nav">${prev ? `<a class="btn" href="${storyHref(iss.date, prev.id)}">${ICON.back}上一篇</a>` : '<span></span>'}${next ? `<a class="btn tinted" href="${storyHref(iss.date, next.id)}">下一篇${ICON.next}</a>` : `<a class="btn" href="#/news/${iss.date}">回到列表</a>`}</nav>
  </article></div>`;
  let lastOn = -1;
  const sync = () => {
    const btn = $('#storyPlay'); if (!btn) return;
    btn.innerHTML = Story.playing ? ICON.pause : ICON.play;
    btn.setAttribute('aria-label', Story.playing ? '暂停' : '朗读全文');
    const cnt = $('#storyCount'); if (cnt) cnt.textContent = Story.sents.length ? `${Math.min(Story.i, Story.sents.length - 1) + 1} / ${Story.sents.length}` : '';
    setScrub(el.querySelector('.player .scrub'), Story.progress());
    const art = $('#art'); if (!art) return;
    art.classList.toggle('playing', Story.playing);
    const on = Story.playing ? Story.i : -1;
    if (on !== lastOn) {
      const old = art.querySelector('.sent.on'); if (old) old.classList.remove('on');
      if (on >= 0) {
        const cur = art.querySelector(`.sent[data-s="${on}"]`);
        if (cur) { cur.classList.add('on'); const r = cur.getBoundingClientRect(); if (r.top < 80 || r.bottom > window.innerHeight - 140) cur.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
      }
      lastOn = on;
    }
  };
  sync();
  off.push(Story.on(sync));
  off.push(Words.on(() => { $$('#art .w').forEach(w => w.classList.toggle('saved', Words.has(wordId(w.textContent)))); $$('[data-act="save-v"]').forEach(b => setSaveBtn(b)); }));
}

function glossRow(v, k) {
  const on = Words.has(wordId(v.word));
  return `<li><div class="row"><div style="min-width:0"><div class="top"><span class="hw">${esc(v.word)}</span>${v.ipa ? `<span class="ipa">${esc(v.ipa)}</span>` : ''}${v.pos ? `<span class="pos">${esc(v.pos)}</span>` : ''}</div>
    <div class="zh">${esc(v.zh)}</div>${v.en ? `<div class="en">${esc(v.en)}</div>` : ''}
    ${v.example ? `<div class="ex"><span>${esc(v.example)}</span>${sayBtn(v.example, '朗读例句', 'plain')}</div>` : ''}</div>
    <div class="acts">${sayBtn(v.word, '朗读 ' + v.word)}<button class="icon-btn${on ? ' on' : ''}" data-act="save-v" data-i="${k}" data-wid="${wordId(v.word)}" aria-pressed="${on}" aria-label="加入生词本" title="${on ? '已在生词本' : '加入生词本'}">${on ? ICON.check : ICON.plus}</button></div></div></li>`;
}
function setSaveBtn(b) { const on = Words.has(b.dataset.wid); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.innerHTML = on ? ICON.check : ICON.plus; b.title = on ? '已在生词本' : '加入生词本'; }

function quizHTML(st, key) {
  const ans = Quiz.get(key);
  const items = st.questions.map((q, qi) => {
    const chosen = ans[qi], done = chosen !== undefined;
    const opts = q.options.map((o, oi) => {
      const cls = done ? (oi === q.answer ? ' right' : oi === chosen ? ' wrong' : '') : '';
      return `<button class="opt${cls}" data-act="quiz" data-q="${qi}" data-o="${oi}"${done ? ' disabled' : ''}>${q.type === 'mcq' ? `<span class="k">${'ABCDE'[oi]}</span>` : ''}<span>${esc(o)}</span>${done && oi === q.answer ? ICON.check : ''}</button>`;
    }).join('');
    return `<div class="q"><p><span class="qn">${qi + 1}</span>${esc(q.q)}</p><div class="opts${q.type === 'tfng' ? ' tf' : ''}">${opts}</div>${done ? `<div class="explain">${chosen === q.answer ? '答对了。' : '正确答案是 ' + esc(q.options[q.answer]) + '。'}${esc(q.explain)}</div>` : ''}</div>`;
  }).join('');
  const n = Object.keys(ans).length, right = st.questions.filter((q, qi) => ans[qi] === q.answer).length;
  return items + (n === st.questions.length ? `<div class="score">答对 <span class="num">${right} / ${st.questions.length}</span><button class="btn" data-act="quiz-reset">重做</button></div>` : '');
}
function currentStory() { const iss = S.newsIssue; return iss && iss.stories.find(s => location.hash.endsWith('/' + s.id)); }

export function unmount() { off.forEach(f => f()); off = []; }
export function onData(el, parts) { if (!parts[1]) render(el, parts); }

export const actions = {
  'save-v': b => {
    const st = currentStory(); if (!st) return; const v = st.vocab[Number(b.dataset.i)]; if (!v) return;
    const id = wordId(v.word);
    if (Words.has(id)) { Words.del(id); toast('已从生词本移除'); }
    else { Words.add({ word: v.word, zh: v.zh, en: v.en, ipa: v.ipa, pos: v.pos, ex: v.example, ctx: '', src: st.headline }); toast('已加入生词本'); }
  },
  'quiz': b => { const st = currentStory(); if (!st) return; const key = `${S.newsIssue.date}:${st.id}`; Quiz.set(key, Number(b.dataset.q), Number(b.dataset.o)); const box = $('#quiz'); if (box) box.innerHTML = quizHTML(st, key); },
  'quiz-reset': () => { const st = currentStory(); if (!st) return; const key = `${S.newsIssue.date}:${st.id}`; Quiz.reset(key); const box = $('#quiz'); if (box) box.innerHTML = quizHTML(st, key); }
};
export const changes = { 'issue': t => { location.hash = '#/news/' + t.value; } };
