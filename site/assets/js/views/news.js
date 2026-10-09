/* News: issue list, archive and the reader (read-aloud, key expressions, quiz, speaking prompt). */
import { $, $$, esc, ICON, fmtLong, fmtShort, wordCount, toast } from '../util.js';
import { S, storyHref } from '../state.js';
import { Data } from '../data.js';
import { Story, waveHTML, setWave } from '../story.js';
import { articleHTML, Scopes } from '../rich.js';
import { TTS, rateSelect, accentSelect } from '../tts.js';
import { Words, wordId, Quiz, Prefs } from '../store.js';

let off = [];
const PROMPT_PHRASES = ["I'd argue that…", 'It could be argued that…', 'Admittedly,… but…', 'Take … for instance.'];

function levelSeg() {
  return `<div class="seg" role="group" aria-label="难度"><button data-act="level" data-level="c1" aria-pressed="${S.level === 'c1'}">C1</button><button data-act="level" data-level="b2" aria-pressed="${S.level === 'b2'}">B2</button></div>`;
}

export async function render(el, parts) {
  unmount();
  const [date, id] = parts;
  let iss = S.issue;
  if (date && (!iss || iss.date !== date)) {
    el.innerHTML = '<div class="skel" style="height:360px"></div>';
    iss = await Data.loadIssue(date);
    if (!iss) { el.innerHTML = `<div class="empty"><b>没找到 ${esc(date)} 这一期</b><a class="btn sm" href="#/news" style="margin-top:12px">回到最新一期</a></div>`; return; }
  }
  if (!iss) { el.innerHTML = Data.state === 'loading' ? '<div class="skel" style="height:360px"></div>' : '<div class="empty"><b>还没有新闻</b>每天早上 7 点左右更新。</div>'; return; }
  S.newsIssue = iss;
  const st = id && iss.stories.find(s => s.id === id);
  if (id && !st) { location.hash = '#/news/' + iss.date; return; }
  st ? renderReader(el, iss, st) : renderList(el, iss);
}

function renderList(el, iss) {
  const idx = Data.index;
  const pos = idx.findIndex(x => x.date === iss.date);
  const older = pos >= 0 ? idx[pos + 1] : null, newer = pos > 0 ? idx[pos - 1] : null;
  el.innerHTML = `
  <div class="page-head"><div><h1>新闻</h1><p class="lede">每天 4 篇，各有 C1 和 B2 两个版本。点任意单词查词，点播放按钮跟着朗读。</p></div>
    <div class="ctrl">${levelSeg()}
      <div class="issue-nav">${older ? `<a class="icon-btn" href="#/news/${older.date}" aria-label="前一期">${ICON.back}</a>` : `<span class="icon-btn" aria-hidden="true" style="opacity:.3">${ICON.back}</span>`}
        <label class="sr" for="issueSel">选择日期</label><select class="pick" id="issueSel" data-change="issue">${(idx.length ? idx : [{ date: iss.date, issueNo: iss.issueNo }]).map(x => `<option value="${x.date}"${x.date === iss.date ? ' selected' : ''}>${esc(fmtShort(x.date))}${x.issueNo ? '　第' + x.issueNo + '期' : ''}</option>`).join('')}</select>
        ${newer ? `<a class="icon-btn" href="#/news/${newer.date}" aria-label="后一期">${ICON.next}</a>` : `<span class="icon-btn" aria-hidden="true" style="opacity:.3">${ICON.next}</span>`}</div></div></div>
  <p class="issue-date">${esc(fmtLong(iss.date))}${iss.issueNo ? `　第 ${iss.issueNo} 期` : ''}</p>${iss.title ? `<h2 class="issue-title">${esc(iss.title)}</h2>` : ''}
  <div class="stories">${iss.stories.map(s => `<a class="story" href="${storyHref(iss.date, s.id)}"><span class="cat">${esc(s.category)}</span><h2>${esc(s.headline)}</h2>${s.headlineZh ? `<span class="zh">${esc(s.headlineZh)}</span>` : ''}${s.summaryZh ? `<span class="sum">${esc(s.summaryZh)}</span>` : ''}<span class="meta"><span class="num">${wordCount(s[S.level])} 词</span><span>${s.vocab.length} 个表达</span><span>${s.questions.length} 道题</span></span><span class="icon-btn side" aria-hidden="true">${ICON.next}</span></a>`).join('')}</div>
  ${idx.length > 1 ? `<div class="sec-title"><h2>往期</h2><span class="aside">每一期都可以重读、再做一遍题</span></div><ul class="archive">${idx.filter(x => x.date !== iss.date).slice(0, 60).map(x => `<li><span class="d">${esc(fmtShort(x.date))}${x.issueNo ? ` <span class="dim" style="font-weight:400">第${x.issueNo}期</span>` : ''}</span><div>${x.headlines.map(h => `<a href="#/news/${x.date}">${esc(h)}</a>`).join('')}</div></li>`).join('')}</ul>` : ''}`;
}

function renderReader(el, iss, st) {
  Story.load(st, S.level);
  const key = `${iss.date}:${st.id}`;
  const scope = 'story:' + key;
  Scopes.set(scope, { vocab: st.vocab, src: st.headline });
  const i = iss.stories.indexOf(st), prev = iss.stories[i - 1], next = iss.stories[i + 1];
  el.innerHTML = `
  <article class="reader">
    <a class="back" href="#/news/${iss.date}">${ICON.back}${esc(fmtShort(iss.date))} 的新闻</a>
    <div class="meta" style="margin-top:18px"><span class="cat">${esc(st.category)}</span><span>${esc(fmtLong(iss.date))}</span><span class="num">${wordCount(st[S.level])} 词</span></div>
    <h1>${esc(st.headline)}</h1>
    ${st.headlineZh ? `<p class="zh">${esc(st.headlineZh)}</p>` : ''}
    ${st.summaryZh ? `<p class="sum">${esc(st.summaryZh)}</p>` : ''}
    <div class="bar">
      <button class="play sm" data-act="story-toggle" id="storyPlay" aria-label="朗读全文">${ICON.play}</button>
      ${waveHTML(st.id + iss.date, 64, 'sm')}
      <div class="tools"><span class="count num" id="storyCount"></span>${levelSeg()}${rateSelect('rateR')}${accentSelect('accR')}</div>
    </div>
    <div class="article" id="art" data-scope="${esc(scope)}">${articleHTML(st[S.level], st.vocab)}</div>
    <p class="hint">点任意单词查词；带下划线的是重点表达。</p>
    ${st.vocab.length ? `<div class="sec-title"><h2>重点表达</h2><span class="aside">${st.vocab.length} 个，可以直接用进口语和写作</span></div>
    <ul class="gloss">${st.vocab.map((v, k) => glossRow(v, k)).join('')}</ul>` : ''}
    ${st.questions.length ? `<div class="sec-title"><h2>读后小测</h2><span class="aside">判断题：True 原文明确这么说；False 和原文矛盾；Not Given 原文没提到</span></div><div class="quiz" id="quiz">${quizHTML(st, key)}</div>` : ''}
    ${st.discuss ? `<div class="sec-title"><h2>开口说</h2></div><section class="talk"><div class="q"><span>${esc(st.discuss)}</span><button class="icon-btn" data-act="say" data-say="${esc(st.discuss)}" aria-label="朗读问题">${ICON.say}</button></div>
      <p class="note" style="margin:12px 0 10px">用上两三个今天的表达，大声说一分钟。可以从这些开头：</p><div class="chips">${PROMPT_PHRASES.map(p => `<button class="chip" data-act="say" data-say="${esc(p.replace(/…/g, ''))}">${esc(p)}</button>`).join('')}</div></section>` : ''}
    ${st.sources.length ? `<div class="sec-title"><h2>原文来源</h2><span class="aside">本文根据报道改写，便于学习；细节以原文为准</span></div><ul class="src-list">${st.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ${ICON.ext}</a></li>`).join('')}</ul>` : ''}
    <nav class="story-nav">${prev ? `<a class="btn" href="${storyHref(iss.date, prev.id)}">${ICON.back}上一篇</a>` : '<span></span>'}${next ? `<a class="btn" href="${storyHref(iss.date, next.id)}">下一篇${ICON.next}</a>` : `<a class="btn" href="#/news/${iss.date}">回到列表</a>`}</nav>
  </article>`;
  const sync = () => {
    const btn = $('#storyPlay'), cnt = $('#storyCount');
    if (!btn) return;
    btn.innerHTML = Story.playing ? ICON.pause : ICON.play;
    btn.setAttribute('aria-label', Story.playing ? '暂停' : '朗读全文');
    if (cnt) cnt.textContent = Story.sents.length ? `${Math.min(Story.i, Story.sents.length - 1) + 1} / ${Story.sents.length}` : '';
    setWave(el.querySelector('.wave'), Story.progress());
    $$('#art .sent.on').forEach(s => s.classList.remove('on'));
    if (Story.playing) {
      const cur = $(`#art .sent[data-s="${Story.i}"]`);
      if (cur) { cur.classList.add('on'); const r = cur.getBoundingClientRect(); if (r.top < 90 || r.bottom > window.innerHeight - 120) cur.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
    }
  };
  sync();
  off.push(Story.on(sync));
  off.push(Words.on(() => { $$('#art .w').forEach(w => w.classList.toggle('saved', Words.has(wordId(w.textContent)))); $$('[data-act="save-v"]').forEach(b => setSaveBtn(b)); }));
}

function glossRow(v, k) {
  const on = Words.has(wordId(v.word));
  return `<li><div class="top"><span class="hw">${esc(v.word)}</span>${v.ipa ? `<span class="ipa">${esc(v.ipa)}</span>` : ''}${v.pos ? `<span class="pos">${esc(v.pos)}</span>` : ''}</div>
    <div class="zh">${esc(v.zh)}</div>${v.en ? `<div class="en">${esc(v.en)}</div>` : ''}
    ${v.example ? `<div class="ex"><span>${esc(v.example)}</span>${sayBtn(v.example, '朗读例句')}</div>` : ''}
    <div class="acts">${sayBtn(v.word, '朗读 ' + v.word)}<button class="icon-btn sm${on ? ' on' : ''}" data-act="save-v" data-i="${k}" data-wid="${wordId(v.word)}" aria-pressed="${on}" aria-label="加入生词本" title="${on ? '已在生词本' : '加入生词本'}">${on ? ICON.check : ICON.plus}</button></div></li>`;
}
export function sayBtn(text, label) { return `<button class="icon-btn sm" data-act="say" data-say="${esc(text)}" aria-label="${esc(label || '朗读')}" title="朗读">${ICON.say}</button>`; }
function setSaveBtn(b) { const on = Words.has(b.dataset.wid); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.innerHTML = on ? ICON.check : ICON.plus; b.title = on ? '已在生词本' : '加入生词本'; }

function quizHTML(st, key) {
  const ans = Quiz.get(key);
  const items = st.questions.map((q, qi) => {
    const chosen = ans[qi];
    const done = chosen !== undefined;
    const opts = q.options.map((o, oi) => {
      const cls = done ? (oi === q.answer ? ' right' : oi === chosen ? ' wrong' : '') : '';
      return `<button class="opt${cls}" data-act="quiz" data-q="${qi}" data-o="${oi}"${done ? ' disabled' : ''}>${q.type === 'mcq' ? `<span class="k">${'ABCDE'[oi]}</span>` : ''}<span>${esc(o)}</span></button>`;
    }).join('');
    return `<div class="q"><p><span class="qt">${q.type === 'tfng' ? '判断' : '选择'}</span>${qi + 1}. ${esc(q.q)}</p><div class="opts${q.type === 'tfng' ? ' tf' : ''}">${opts}</div>${done ? `<div class="explain">${chosen === q.answer ? '答对了。' : '正确答案：' + esc(q.options[q.answer]) + '。'}${esc(q.explain)}</div>` : ''}</div>`;
  }).join('');
  const n = Object.keys(ans).length, right = st.questions.filter((q, qi) => ans[qi] === q.answer).length;
  return items + (n === st.questions.length ? `<div class="score">得分 <span class="num">${right} / ${st.questions.length}</span><button class="btn sm" data-act="quiz-reset">重做</button></div>` : '');
}

export function unmount() { off.forEach(f => f()); off = []; }
export function onData(el, parts) { if (!parts[1]) render(el, parts); }

export const actions = {
  'save-v': b => {
    const iss = S.newsIssue, st = iss && iss.stories.find(s => location.hash.endsWith('/' + s.id)); if (!st) return;
    const v = st.vocab[Number(b.dataset.i)]; if (!v) return;
    const id = wordId(v.word);
    if (Words.has(id)) { Words.del(id); toast('已从生词本移除'); }
    else { Words.add({ word: v.word, zh: v.zh, en: v.en, ipa: v.ipa, pos: v.pos, ex: v.example, ctx: '', src: st.headline }); toast('已加入生词本：' + v.word); }
  },
  'quiz': b => {
    const iss = S.newsIssue, st = iss && iss.stories.find(s => location.hash.endsWith('/' + s.id)); if (!st) return;
    const key = `${iss.date}:${st.id}`; Quiz.set(key, Number(b.dataset.q), Number(b.dataset.o));
    const box = $('#quiz'); if (box) box.innerHTML = quizHTML(st, key);
  },
  'quiz-reset': () => {
    const iss = S.newsIssue, st = iss && iss.stories.find(s => location.hash.endsWith('/' + s.id)); if (!st) return;
    const key = `${iss.date}:${st.id}`; Quiz.reset(key); const box = $('#quiz'); if (box) box.innerHTML = quizHTML(st, key);
  }
};
export const changes = {
  'issue': t => { location.hash = '#/news/' + t.value; }
};
