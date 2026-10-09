/* Small shared helpers, icons and artwork tiles. */
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
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
export function fmtShort(key) { if (!isDate(key)) return ''; const [, m, d] = key.split('-').map(Number); return `${d} ${MON[m - 1].slice(0, 3)}`; }
export function fmtZh(key) { if (!isDate(key)) return ''; const [, m, d] = key.split('-').map(Number); return `${m}月${d}日`; }
export function fmtZhLong(key) { if (!isDate(key)) return ''; const [y, m, d] = key.split('-').map(Number); return `${m}月${d}日 ${WEEK_ZH[new Date(y, m - 1, d).getDay()]}`; }
export function fmtStamp(iso) {
  const t = new Date(iso); if (isNaN(t)) return '';
  return t.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
export function fmtClock(sec) { if (!isFinite(sec) || sec < 0) sec = 0; const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; }
export const wordCount = t => (String(t || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
export function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

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
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- icons (24px grid, SF Symbols-like) ---------- */
const S = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const F = d => `<svg class="i f" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICON = {
  today: S('<circle cx="12" cy="12" r="9"/><path d="M10 8.6v6.8l5.4-3.4z" fill="currentColor" stroke="none"/>'),
  news: S('<rect x="3.5" y="4.5" width="13" height="15" rx="2"/><path d="M16.5 8.5h2.5a1.5 1.5 0 0 1 1.5 1.5v7.5a2 2 0 0 1-4 0"/><path d="M7 8.5h6M7 12h6M7 15.5h4"/>'),
  speak: S('<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v4a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3H6.5A2.5 2.5 0 0 1 4 10.5z"/><path d="M18.5 8.5A2 2 0 0 1 20 10.4v3.6a2.5 2.5 0 0 1-2.5 2.5V19l-3-2.5h-2.6"/>'),
  listen: S('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="13.5" width="4" height="6.5" rx="1.8"/><rect x="16.5" y="13.5" width="4" height="6.5" rx="1.8"/>'),
  read: S('<path d="M12 6.5c-1.8-1.4-4.6-2-8-1.8v13.1c3.4-.2 6.2.4 8 1.8 1.8-1.4 4.6-2 8-1.8V4.7c-3.4-.2-6.2.4-8 1.8z"/><path d="M12 6.5v13.1"/>'),
  words: S('<path d="M7 3.8h10a1.2 1.2 0 0 1 1.2 1.2v15.2l-6.2-4-6.2 4V5A1.2 1.2 0 0 1 7 3.8z"/>'),
  play: F('<path d="M8 5.2c0-.8.9-1.3 1.6-.9l9.6 6.2c.6.4.6 1.3 0 1.7l-9.6 6.2c-.7.4-1.6-.1-1.6-.9z"/>'),
  pause: F('<rect x="6.5" y="5" width="4" height="14" rx="1.3"/><rect x="13.5" y="5" width="4" height="14" rx="1.3"/>'),
  say: S('<path d="M10.5 5.5 6.6 9H4v6h2.6l3.9 3.5z" fill="currentColor"/><path d="M14.5 9.2a4 4 0 0 1 0 5.6"/><path d="M17.3 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  check: S('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  ext: S('<path d="M8 16 16.5 7.5"/><path d="M9.5 7.5h7v7"/>'),
  back: S('<path d="m14.5 18-6-6 6-6"/>'),
  next: S('<path d="m9.5 18 6-6-6-6"/>'),
  down: S('<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>'),
  trash: S('<path d="M5 7h14M10 11v6M14 11v6M7 7l.8 11.2A1.5 1.5 0 0 0 9.3 19.6h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7M9.5 7V5h5v2"/>'),
  close: S('<path d="M7 7l10 10M17 7 7 17"/>'),
  back15: S('<path d="M5.5 12a6.5 6.5 0 1 0 2-4.7"/><path d="M7.5 3.8v3.6h3.6"/><text x="12.2" y="15.4" text-anchor="middle" font-size="6.6" font-weight="700" fill="currentColor" stroke="none" font-family="-apple-system,Segoe UI,sans-serif">15</text>'),
  search: S('<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>'),
  save: S('<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>'),
  open: S('<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 19.5h14"/>'),
  sun: S('<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>'),
  moon: S('<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>'),
  auto: S('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>'),
  eye: S('<path d="M2.8 12S6 6 12 6s9.2 6 9.2 6-3.2 6-9.2 6-9.2-6-9.2-6z"/><circle cx="12" cy="12" r="2.6"/>')
};

/* ---------- artwork: gradient tiles with a glyph (stories, scenarios, sources) ---------- */
const G = {
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.3-3.8-8.5S9.4 5.9 12 3.5z"/>',
  atom: '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  chip: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/>',
  people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.4-3.4 2.6-5.2 5.5-5.2s5.1 1.8 5.5 5.2"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.6 13.9c2.6-.3 4.6 1.3 4.9 4.6"/>',
  heart: '<path d="M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z"/>',
  leaf: '<path d="M5 19c0-8.5 5.5-14 14.5-14 0 9-5.5 14.5-14 14.5"/><path d="M5 19c3-3.5 6-6 9.5-8"/>',
  chart: '<path d="M4.5 19.5h15"/><rect x="6" y="11" width="3" height="6.5" rx=".8"/><rect x="10.5" y="7" width="3" height="10.5" rx=".8"/><rect x="15" y="4.5" width="3" height="13" rx=".8"/>',
  spark: '<path d="M12 3.5 13.8 10.2 20.5 12 13.8 13.8 12 20.5 10.2 13.8 3.5 12 10.2 10.2z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  cap: '<path d="M2.8 9.5 12 5l9.2 4.5L12 14z"/><path d="M6.8 11.6v4.2c1.4 1.4 3.2 2.1 5.2 2.1s3.8-.7 5.2-2.1v-4.2"/><path d="M21.2 9.5v5"/>',
  house: '<path d="M4 11 12 4.5 20 11"/><path d="M6 9.5V19.5h12V9.5"/><path d="M10 19.5v-5h4v5"/>',
  bag: '<path d="M5.5 8.5h13l-1 11h-11z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>',
  team: '<circle cx="12" cy="7.5" r="2.6"/><path d="M7.5 18c.3-3.2 2-5 4.5-5s4.2 1.8 4.5 5"/><circle cx="5.5" cy="10" r="2"/><path d="M2.8 17.5c.2-2.2 1.3-3.6 3.2-3.8"/><circle cx="18.5" cy="10" r="2"/><path d="M21.2 17.5c-.2-2.2-1.3-3.6-3.2-3.8"/>',
  hello: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.4-3.3 2.6-5 5.5-5 1.4 0 2.6.4 3.6 1.1"/><path d="M17.5 13v6M14.5 16h6"/>',
  steth: '<path d="M6 4v5a4 4 0 0 0 8 0V4"/><path d="M10 13v1.5a4.5 4.5 0 0 0 9 0V12"/><circle cx="19" cy="10" r="2"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M8 14h3"/>',
  dine: '<path d="M7.5 3.5v6.5a2 2 0 0 0 2 2v8.5"/><path d="M5.5 3.5v6M9.5 3.5v6"/><path d="M16.5 20.5V3.5c-2 1.5-3 4-3 7.5h3"/>',
  phone: '<path d="M6.5 3.8h3l1.5 4-2 1.5a10.5 10.5 0 0 0 5.7 5.7l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 6a2 2 0 0 1 2-2.2z"/>',
  case: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5"/><path d="M3.5 12.5h17"/>',
  bubble: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z"/>',
  wave: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10.5v3"/>',
  book: '<path d="M12 6.5c-1.8-1.4-4.6-2-8-1.8v13.1c3.4-.2 6.2.4 8 1.8 1.8-1.4 4.6-2 8-1.8V4.7c-3.4-.2-6.2.4-8 1.8z"/><path d="M12 6.5v13.1"/>'
};
const PAL = {
  blue: ['#4A8DF8', '#1F5FD6'], teal: ['#3CC4D5', '#1A88AE'], indigo: ['#8A6CFA', '#5139D1'], orange: ['#FFA43A', '#F06414'],
  green: ['#45D16C', '#1C9A4F'], amber: ['#FFC53D', '#E68A00'], pink: ['#FF5C80', '#CF2A61'], red: ['#FF7A50', '#D9372C'],
  purple: ['#C468F2', '#8A35D0'], graphite: ['#9A9AA2', '#5E5E66'], cyan: ['#5AC8FA', '#2B8BD8']
};
export const CAT_ART = {
  world: ['globe', 'blue'], science: ['atom', 'teal'], tech: ['chip', 'indigo'], society: ['people', 'orange'], health: ['heart', 'green'],
  environment: ['leaf', 'green'], business: ['chart', 'amber'], culture: ['spark', 'pink'], australia: ['sun', 'red']
};
export const SCEN_ART = {
  seminar: ['cap', 'indigo'], rent: ['house', 'orange'], refund: ['bag', 'pink'], teammate: ['team', 'teal'], networking: ['hello', 'blue'],
  gp: ['steth', 'green'], extension: ['cal', 'red'], dinner: ['dine', 'amber'], billing: ['phone', 'cyan'], interview: ['case', 'graphite'], daily: ['bubble', 'purple']
};
const SRC_ART = { 'Breaking News English': ['news', 'blue'], 'Aeon': ['book', 'graphite'], 'Engoo Daily News': ['bubble', 'orange'] };

/* Gradient tile; key picks glyph + colours. */
export function tile(glyph, pal, cls = '') {
  const g = G[glyph] || G.spark, c = PAL[pal] || PAL.graphite;
  return `<span class="tile ${cls}" style="--g1:${c[0]};--g2:${c[1]}" aria-hidden="true"><svg viewBox="0 0 24 24">${g}</svg></span>`;
}
export function catTile(category, cls = '') { const a = CAT_ART[String(category || '').toLowerCase()] || ['spark', 'graphite']; return tile(a[0], a[1], cls); }
export function scenTile(id, cls = '') { const a = SCEN_ART[id] || ['bubble', 'graphite']; return tile(a[0], a[1], cls); }
/* Feed item artwork: the publisher's own cover art when the feed provides it, else a tile. */
export function artHTML(it, cls = '') {
  const a = SRC_ART[it.source] || (it.kind === 'listen' ? ['wave', 'purple'] : ['book', 'graphite']);
  const fallback = tile(a[0] === 'news' ? 'book' : a[0], a[1], cls);
  if (!it.image) return fallback;
  return `<span class="art ${cls}"><img src="${esc(it.image)}" alt="" loading="lazy" decoding="async" width="160" height="160" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('noimg');this.remove()">${fallback}</span>`;
}
/* Colours + glyph for a category (used by the large featured card). */
export function catArt(category) { const a = CAT_ART[String(category || '').toLowerCase()] || ['spark', 'graphite']; return { glyph: `<svg viewBox="0 0 24 24">${G[a[0]]}</svg>`, c: PAL[a[1]] }; }
