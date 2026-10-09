/* Word book: everything saved while reading, optional spaced review, export / import. */
import { $, esc, ICON, toast, download, fmtShort, dayKey } from '../util.js';
import { Words, BOX_DAYS } from '../store.js';
import { TTS } from '../tts.js';

const REV = { active: false, queue: [], i: 0, show: false, done: 0 };
let off = [], q = '';

export function render(el, parts) {
  unmount();
  if (parts[0] === 'review') { startReview(el); return; }
  REV.active = false;
  el.innerHTML = `<div class="page-head"><div><h1>生词本</h1><p class="lede">读新闻、听对话时点词收藏，原句一起存下来。复习随你，想起来再练。</p></div>
    <div class="ctrl"><a class="btn primary" href="#/words/review" id="revBtn">复习</a><button class="btn" data-act="w-export-csv">${ICON.down}导出 CSV</button><button class="btn" data-act="w-export-json">${ICON.down}备份</button><label class="btn" for="wImport" style="cursor:pointer">${ICON.up}导入备份</label><input type="file" id="wImport" accept="application/json,.json" data-change="w-import" hidden></div></div>
  <div id="wStats"></div>
  <div style="margin:22px 0 6px"><label class="sr" for="wSearch">搜索生词</label><input type="search" id="wSearch" placeholder="搜单词或中文释义" value="${esc(q)}" data-input="w-search"></div>
  <div id="wList"></div>
  <p class="note" style="margin-top:16px">复习间隔：1、3、7、14、30、60 天；点“忘了”这个词会当天再出现。生词本保存在这个浏览器里，换设备时用“备份 / 导入备份”搬过去。</p>`;
  renderBody();
  off.push(Words.on(() => { if (!REV.active) renderBody(); }));
}

function renderBody() {
  const all = Words.list(), due = Words.due().length, mastered = all.filter(w => w.box >= 5).length;
  const st = $('#wStats'); if (st) st.innerHTML = `<div class="stats"><div class="stat"><b>${all.length}</b><span>收藏总数</span></div><div class="stat"><b>${due}</b><span>今天可以复习</span></div><div class="stat"><b>${mastered}</b><span>已掌握（间隔 30 天以上）</span></div></div>`;
  const rb = $('#revBtn'); if (rb) { rb.textContent = due ? `复习 ${due} 个` : '暂时没有要复习的'; rb.classList.toggle('primary', !!due); rb.toggleAttribute('aria-disabled', !due); if (!due) rb.removeAttribute('href'); else rb.setAttribute('href', '#/words/review'); }
  const box = $('#wList'); if (!box) return;
  if (!all.length) { box.innerHTML = '<div class="empty"><b>生词本还是空的</b>读新闻时点任意单词，选“加入生词本”就会出现在这里。</div>'; return; }
  const s = q.trim().toLowerCase();
  const list = s ? all.filter(w => (w.word + ' ' + w.zh + ' ' + w.en).toLowerCase().includes(s)) : all;
  if (!list.length) { box.innerHTML = '<p class="note">没有找到匹配的词。</p>'; return; }
  box.innerHTML = `<ul class="wlist">${list.slice(0, 500).map(w => `<li class="wrow"><div class="top" style="display:flex;gap:4px 10px;flex-wrap:wrap;align-items:baseline"><span class="hw">${esc(w.word)}</span>${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ''}${w.pos ? `<span class="muted"><i>${esc(w.pos)}</i></span>` : ''}${w.box >= 5 ? '<span class="tag">已掌握</span>' : ''}</div>
    <div class="def">${w.zh ? esc(w.zh) : ''}${w.en ? `<span class="muted" style="font-size:15px">${w.zh ? '　' : ''}${esc(w.en)}</span>` : ''}</div>
    ${w.ctx || w.ex ? `<div class="ctx">${esc(w.ctx || w.ex)}</div>` : ''}
    <div class="meta">${esc(fmtShort(w.added))} 收藏${w.src ? '，来自 ' + esc(w.src) : ''}</div>
    <div class="acts"><button class="icon-btn sm" data-act="say" data-say="${esc(w.word)}" aria-label="朗读 ${esc(w.word)}">${ICON.say}</button><button class="icon-btn sm" data-act="w-del" data-id="${w.id}" aria-label="删除 ${esc(w.word)}" title="删除">${ICON.trash}</button></div></li>`).join('')}</ul>`;
}

function startReview(el) {
  const due = Words.due();
  if (!due.length) { el.innerHTML = `<div class="empty"><b>今天没有要复习的词</b>新收藏的词会在第二天出现。<div style="margin-top:14px"><a class="btn" href="#/words">回到生词本</a></div></div>`; return; }
  Object.assign(REV, { active: true, queue: due.map(w => w.id), i: 0, show: false, done: 0 });
  renderReview(el);
}
function renderReview(el = $('#view')) {
  if (REV.i >= REV.queue.length) { el.innerHTML = `<div class="flash"><div class="card"><div class="hw">复习完了</div><p class="ctx">这一轮复习了 <span class="num">${REV.done}</span> 次。</p><div style="margin-top:20px"><a class="btn primary" href="#/words">回到生词本</a></div></div></div>`; REV.active = false; return; }
  const w = Words.get(REV.queue[REV.i]); if (!w) { REV.i++; renderReview(el); return; }
  const cloze = w.ctx ? esc(w.ctx).replace(new RegExp(w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '<span class="hlx">＿＿＿</span>') : '';
  el.innerHTML = `<div class="page-head"><div><h1 class="num">${REV.i + 1} / ${REV.queue.length}</h1><p class="lede">先想意思，再翻面核对。空格翻面，1 / 2 / 3 打分。</p></div><a class="btn" href="#/words">结束复习</a></div>
  <div class="flash"><div class="card"><div class="hw">${esc(w.word)}</div><div style="margin-top:10px"><button class="icon-btn" data-act="say" data-say="${esc(w.word)}" aria-label="朗读">${ICON.say}</button></div>
    ${cloze ? `<p class="ctx">${cloze}</p>` : ''}
    ${REV.show ? `<div class="ans">${w.ipa ? `<div class="ipa">${esc(w.ipa)}</div>` : ''}<div style="color:var(--text);font-size:20px;margin-top:6px">${esc(w.zh || '')}</div>${w.en ? `<div class="muted">${esc(w.en)}</div>` : ''}${w.ex ? `<div class="muted" style="margin-top:8px">${esc(w.ex)}</div>` : ''}
      <div class="grades"><button class="btn g-again" data-act="w-grade" data-g="again">忘了</button><button class="btn" data-act="w-grade" data-g="hard">模糊</button><button class="btn g-good" data-act="w-grade" data-g="good">记得</button></div></div>`
      : `<div style="margin-top:22px"><button class="btn primary" data-act="w-show">翻面</button></div>`}
  </div></div>`;
}
function reviewKeys(e) {
  if (!REV.active || /input|textarea|select/i.test(document.activeElement && document.activeElement.tagName)) return;
  if (e.key === ' ' && !REV.show) { e.preventDefault(); actions['w-show'](); }
  else if (REV.show && ['1', '2', '3'].includes(e.key)) actions['w-grade']({ dataset: { g: ({ 1: 'again', 2: 'hard', 3: 'good' })[e.key] } });
}
document.addEventListener('keydown', reviewKeys);

function csvCell(s) { s = String(s || ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

export function unmount() { off.forEach(f => f()); off = []; }
export const actions = {
  'w-del': b => { const w = Words.get(b.dataset.id); Words.del(b.dataset.id); if (w) toast('已删除：' + w.word); },
  'w-show': () => { REV.show = true; renderReview(); },
  'w-grade': b => { const id = REV.queue[REV.i]; const g = b.dataset.g; Words.grade(id, g); REV.done++; if (g === 'again') REV.queue.push(id); REV.i++; REV.show = false; renderReview(); },
  'w-export-csv': () => { const rows = [['word', 'ipa', 'pos', 'zh', 'en', 'context', 'source', 'added']].concat(Words.list().map(w => [w.word, w.ipa, w.pos, w.zh, w.en, w.ctx || w.ex, w.src, w.added])); download(`word-book-${dayKey()}.csv`, '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv'); },
  'w-export-json': () => { download(`word-book-backup-${dayKey()}.json`, JSON.stringify({ app: 'everyday-english', version: 1, words: Words.list() }, null, 1), 'application/json'); }
};
export const changes = {
  'w-import': async t => { const f = t.files && t.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); const n = Words.importList(Array.isArray(j) ? j : j.words); toast(n ? `导入了 ${n} 个新词` : '没有新词需要导入'); } catch (e) { toast('文件读不出来，确认是这里导出的备份'); } t.value = ''; }
};
export const inputs = {
  'w-search': t => { q = t.value; renderBody(); }
};
