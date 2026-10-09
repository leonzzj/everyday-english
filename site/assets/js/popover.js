/* Word lookup card: curated meaning for key expressions, free dictionary for any other word. */
import { $, esc, ICON, toast } from './util.js';
import { Words, wordId } from './store.js';
import { TTS } from './tts.js';

const cache = new Map();
async function lookup(word) {
  const k = word.toLowerCase();
  if (cache.has(k)) return cache.get(k);
  let out = { none: true };
  try {
    const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(k));
    if (r.ok) {
      const j = await r.json(); const e = Array.isArray(j) ? j : [];
      const ipa = (e.flatMap(x => [x.phonetic].concat((x.phonetics || []).map(p => p.text))).find(Boolean)) || '';
      const defs = [];
      e.forEach(x => (x.meanings || []).forEach(m => (m.definitions || []).slice(0, 2).forEach(d => { if (defs.length < 3 && d.definition) defs.push({ pos: m.partOfSpeech || '', def: d.definition, ex: d.example || '' }); })));
      out = defs.length ? { ipa, defs } : { none: true };
    }
  } catch (e) { out = { error: true }; }
  cache.set(k, out); return out;
}

const ytAccent = () => ({ 'en-AU': 'aus', 'en-GB': 'uk', 'en-US': 'us' }[TTS.accent] || '');

export const Pop = {
  el: null, data: null, anchor: null,
  init() {
    this.el = document.createElement('div'); this.el.className = 'pop'; this.el.id = 'pop'; this.el.hidden = true;
    this.el.setAttribute('role', 'dialog'); this.el.setAttribute('aria-label', '查词');
    document.body.appendChild(this.el);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !this.el.hidden) this.close(); });
    document.addEventListener('pointerdown', e => { if (!this.el.hidden && !this.el.contains(e.target) && !(this.anchor && this.anchor.contains(e.target))) this.close(); }, true);
    window.addEventListener('resize', () => this.close());
  },
  /* data: {word, zh, en, ipa, pos, example, ctx, src, curated} */
  async open(anchor, data) {
    this.anchor = anchor; this.data = { ...data, loading: !data.curated };
    this.render(); this.place();
    if (!data.curated) {
      const res = await lookup(data.word);
      if (this.data && this.data.word === data.word) { Object.assign(this.data, { loading: false, defs: res.defs || [], ipa: this.data.ipa || res.ipa || '', none: !!res.none, error: !!res.error }); this.render(); this.place(); }
    }
  },
  close() { if (this.el) this.el.hidden = true; this.data = null; this.anchor = null; },
  render() {
    const d = this.data; if (!d) return;
    const saved = Words.has(wordId(d.word));
    const q = encodeURIComponent(d.word);
    const defs = d.defs && d.defs.length ? `<ol class="defs">${d.defs.map(x => `<li>${x.pos ? `<span class="pos">${esc(x.pos)}</span> ` : ''}${esc(x.def)}</li>`).join('')}</ol>` : '';
    this.el.innerHTML = `<div class="hd"><div><div class="word">${esc(d.word)}</div><div class="sub">${d.ipa ? `<span class="ipa">${esc(d.ipa)}</span>` : ''}${d.pos ? `<span class="l2"><i>${esc(d.pos)}</i></span>` : ''}</div></div><button class="icon-btn gray" data-act="pop-close" aria-label="关闭">${ICON.close}</button></div>
      ${d.zh ? `<div class="zh">${esc(d.zh)}</div>` : ''}${d.en ? `<div class="l2" style="font-size:14px;margin-top:2px">${esc(d.en)}</div>` : ''}${defs}
      ${d.example ? `<div class="ex">${esc(d.example)}</div>` : ''}
      ${d.loading ? '<div class="loading">正在查词典……</div>' : ''}${d.none && !d.zh ? '<div class="loading">词典里没找到，试试下面的剑桥词典。</div>' : ''}${d.error ? '<div class="loading">词典暂时连不上，试试下面的链接。</div>' : ''}
      <div class="acts"><button class="btn tinted" data-act="pop-say">${ICON.say}发音</button>${d.fromStory ? `<button class="btn tinted" data-act="pop-from">${ICON.play}从这句读</button>` : ''}<button class="btn${saved ? '' : ' fill'}" data-act="pop-save">${saved ? ICON.check + '已在生词本' : ICON.plus + '加入生词本'}</button></div>
      <div class="links"><a href="https://dictionary.cambridge.org/search/direct/?datasetsearch=english-chinese-simplified&q=${q}" target="_blank" rel="noopener">剑桥英汉${ICON.ext}</a><a href="https://youglish.com/pronounce/${q}/english/${ytAccent()}" target="_blank" rel="noopener">YouGlish 真人发音${ICON.ext}</a></div>`;
    this.el.hidden = false;
  },
  place() {
    if (!this.anchor || this.el.hidden) return;
    if (window.matchMedia('(max-width:860px)').matches) { this.el.style.left = ''; this.el.style.top = ''; return; }
    const r = this.anchor.getBoundingClientRect(), w = this.el.offsetWidth, h = this.el.offsetHeight;
    let left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    let top = r.bottom + 10; if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 10);
    this.el.style.left = left + 'px'; this.el.style.top = top + 'px';
  },
  say() { if (this.data) TTS.say(this.data.word); },
  toggleSave() {
    const d = this.data; if (!d) return; const id = wordId(d.word);
    if (Words.has(id)) { Words.del(id); toast('已从生词本移除'); }
    else { Words.add({ word: d.word, zh: d.zh || '', en: d.en || (d.defs && d.defs[0] ? d.defs[0].def : ''), ipa: d.ipa || '', pos: d.pos || (d.defs && d.defs[0] ? d.defs[0].pos : ''), ex: d.example || '', ctx: d.ctx || '', src: d.src || '' }); toast('已加入生词本：' + d.word); }
    this.render();
  }
};
