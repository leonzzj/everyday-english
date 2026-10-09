/* Turns plain article text into clickable sentences and words, with key expressions marked. */
import { esc, escRe } from './util.js';
import { Words, wordId } from './store.js';

export function paragraphs(text) { return String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean); }
export function splitSentences(p) {
  return String(p).replace(/([.!?…]["”’)\]]*)\s+(?=["“‘(]?[A-Z0-9])/g, '$1⁣').split('⁣').map(s => s.trim()).filter(Boolean);
}
export function allSentences(text) { return paragraphs(text).flatMap(splitSentences); }

export function wrapWords(s) {
  let out = '', last = 0, m; const re = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
  while ((m = re.exec(s))) {
    out += esc(s.slice(last, m.index)) + `<span class="w${Words.has(wordId(m[0])) ? ' saved' : ''}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}

/* Find vocab expressions (and their listed forms) in a sentence; longest match wins. */
export function findVocab(sentence, vocab) {
  const cands = [];
  (vocab || []).forEach((v, i) => {
    [v.word].concat(v.forms || []).forEach(t => {
      if (!t) return;
      const re = new RegExp('(^|[^A-Za-z])(' + escRe(t) + '(?:s|es|ed|d|ing)?)(?=[^A-Za-z]|$)', 'gi'); let m;
      while ((m = re.exec(sentence))) { const st = m.index + m[1].length; cands.push({ st, en: st + m[2].length, i }); if (re.lastIndex === m.index) re.lastIndex++; }
    });
  });
  cands.sort((a, b) => (b.en - b.st) - (a.en - a.st) || a.st - b.st);
  const out = []; cands.forEach(c => { if (!out.some(r => c.st < r.en && c.en > r.st)) out.push(c); });
  return out.sort((a, b) => a.st - b.st);
}

export function markup(sentence, vocab) {
  let out = '', pos = 0;
  findVocab(sentence, vocab).forEach(r => { out += wrapWords(sentence.slice(pos, r.st)) + `<span class="vx" data-v="${r.i}" tabindex="0" role="button">${esc(sentence.slice(r.st, r.en))}</span>`; pos = r.en; });
  return out + wrapWords(sentence.slice(pos));
}

export function articleHTML(text, vocab) {
  let si = 0;
  return paragraphs(text).map(p => '<p>' + splitSentences(p).map(s => `<span class="sent" data-s="${si++}">${markup(s, vocab)}</span>`).join(' ') + '</p>').join('');
}

/* Caption: plain text with the first matching expression highlighted. */
export function captionHTML(sentence, vocab, doneUntil = 0) {
  const hit = findVocab(sentence, vocab)[0];
  if (!hit) return `<span class="done">${esc(sentence)}</span>`;
  return `<span class="done">${esc(sentence.slice(0, hit.st))}</span><mark>${esc(sentence.slice(hit.st, hit.en))}</mark><span class="rest">${esc(sentence.slice(hit.en))}</span>`;
}

/* Containers of clickable text register their vocab + source label here (key = data-scope attribute). */
export const Scopes = new Map();
