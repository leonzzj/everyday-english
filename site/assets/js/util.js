/* Small shared helpers. */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const str = (v, max = 4000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
export const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

export const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

export function dayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function addDays(key, n) { const [y, m, d] = key.split('-').map(Number); const t = new Date(y, m - 1, d + n); return dayKey(t); }
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function fmtLong(key) { if (!isDate(key)) return ''; const [y, m, d] = key.split('-').map(Number); const t = new Date(y, m - 1, d); return `${DOW[t.getDay()]} ${d} ${MON[m - 1]}`; }
export function fmtShort(key) { if (!isDate(key)) return ''; const [, m, d] = key.split('-').map(Number); return `${d} ${MON[m - 1].slice(0, 3)}`; }
export function fmtZh(key) { if (!isDate(key)) return ''; const [, m, d] = key.split('-').map(Number); return `${m}月${d}日`; }
export function fmtStamp(iso) {
  const t = new Date(iso); if (isNaN(t)) return '';
  return t.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
export function fmtClock(sec) { if (!isFinite(sec) || sec < 0) sec = 0; const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; }
export const wordCount = t => (String(t || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;

export function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/* Deterministic "cover art" tile for a source name. */
const GRADS = [['#FF7A6B', '#FFB36B'], ['#B48CFF', '#FF7AB8'], ['#FFD447', '#9BE38A'], ['#6BC6FF', '#B48CFF'], ['#7FE0A8', '#6BC6FF'], ['#FF9F6B', '#FF6BA6']];
const SRC_GRAD = { 'ABC News Daily': 0, 'Conversations': 1, 'SBS Learn English': 2, 'Breaking News English': 3, 'Aeon': 4, 'TED Talks Daily': 5 };
export function coverHTML(name, cls = '') {
  const h = hashStr(name), g = GRADS[name in SRC_GRAD ? SRC_GRAD[name] : (h ^ (h >>> 13)) % GRADS.length], r = rng(h);
  let bars = ''; for (let i = 0; i < 5; i++) bars += `<i style="height:${Math.round(12 + r() * 24)}px"></i>`;
  return `<span class="cover ${cls}" style="background:linear-gradient(135deg,${g[0]},${g[1]})" aria-hidden="true">${bars}</span>`;
}

let toastTimer = null;
export function toast(msg) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

export function download(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

const P = 'class="i" viewBox="0 0 24 24" aria-hidden="true"';
export const ICON = {
  play: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4L19 12z"/></svg>',
  pause: '<svg class="i f" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>',
  say: `<svg ${P}><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`,
  plus: `<svg ${P}><path d="M12 5v14M5 12h14"/></svg>`,
  check: `<svg ${P}><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
  ext: `<svg ${P}><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>`,
  back: `<svg ${P}><path d="m15 18-6-6 6-6"/></svg>`,
  next: `<svg ${P}><path d="m9 18 6-6-6-6"/></svg>`,
  trash: `<svg ${P}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/></svg>`,
  down: `<svg ${P}><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>`,
  up: `<svg ${P}><path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/></svg>`,
  close: `<svg ${P}><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  book: `<svg ${P}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>`,
  ear: `<svg ${P}><path d="M6 15V11a6 6 0 1 1 12 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/></svg>`,
  shuffle: `<svg ${P}><path d="M16 4h4v4M20 4l-6 6M4 20l6-6M16 20h4v-4M20 20 4 4"/></svg>`
};
