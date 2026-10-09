#!/usr/bin/env node
// Fetches the newest episode or article from each source and writes site/data/feed.json.
// Runs in GitHub Actions (Node 20+, no dependencies). If a source fails, its previous item is kept.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = process.env.FEED_OUT || fileURLToPath(new URL('../site/data/feed.json', import.meta.url));
const UA = 'Mozilla/5.0 (compatible; EverydayEnglishFeed/1.0; personal study site)';

export const SOURCES = [
  { source: 'ABC News Daily', kind: 'listen', level: 'C1', accent: 'AU', urls: ['https://feeds.megaphone.fm/TECO8299467926', 'https://www.abc.net.au/feeds/9443166/podcast.xml'] },
  { source: 'Conversations', kind: 'listen', level: 'C1', accent: 'AU', urls: ['https://www.abc.net.au/feeds/7711104/podcast.xml'] },
  { source: 'TED Talks Daily', kind: 'listen', level: 'B2–C1', accent: 'Mixed', urls: ['https://feeds.acast.com/public/shows/67587e77c705e441797aff96'] },
  { source: 'SBS Learn English', kind: 'listen', level: 'B1–B2', accent: 'AU', urls: ['https://sbs-ondemand.streamguys1.com/sbs-learn-english/'], skip: /^bonus/i, sbsLevel: true },
  { source: 'Breaking News English', kind: 'read', level: 'B2–C1', accent: '', urls: ['https://breakingnewsenglish.com/rss.xml'], bne: true, minutes: 10 },
  { source: 'Aeon', kind: 'read', level: 'C1+', accent: '', urls: ['https://aeon.co/feed.rss'], linkMatch: /aeon\.co\/essays\//, minutes: 20 }
];

/* ---------- tiny XML helpers (feeds are simple enough for this) ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', eacute: 'é', egrave: 'è', aacute: 'á', ouml: 'ö', uuml: 'ü', ccedil: 'ç' };
export function decode(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const unCdata = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
export function stripHtml(s) { s = unCdata(s); if (/&lt;\/?[a-z]/i.test(s)) s = decode(s); return decode(s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function tag(block, names) {
  for (const n of names) {
    const re = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i'); const m = block.match(re);
    if (m && m[1].trim()) return unCdata(m[1]).trim();
  }
  return '';
}
function attr(block, tagName, name) { const m = block.match(new RegExp(`<${tagName}\\b[^>]*\\b${name}=["']([^"']+)["']`, 'i')); return m ? decode(m[1]) : ''; }

export function parseDuration(d) {
  d = String(d || '').trim(); if (!d) return 0;
  if (/^\d+$/.test(d)) return Math.max(1, Math.round(Number(d) / 60));
  const p = d.split(':').map(Number); if (p.some(n => !Number.isFinite(n))) return 0;
  const sec = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0];
  return Math.max(1, Math.round(sec / 60));
}
function isoDay(dateStr) { const t = new Date(dateStr); return isNaN(t) ? '' : new Date(t.getTime() + 10 * 3600 * 1000).toISOString().slice(0, 10); } // Melbourne-ish day

export function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = stripHtml(tag(b, ['title']));
    let link = stripHtml(tag(b, ['link'])); if (!/^https?:/i.test(link)) link = attr(b, 'link', 'href');
    const guid = stripHtml(tag(b, ['guid'])); if (!/^https?:/i.test(link) && /^https?:/i.test(guid)) link = guid;
    const date = tag(b, ['pubDate', 'published', 'updated', 'dc:date']);
    const audio = attr(b, 'enclosure', 'url');
    const minutes = parseDuration(tag(b, ['itunes:duration']));
    const desc = stripHtml(tag(b, ['itunes:summary', 'description', 'summary', 'content:encoded', 'content']));
    if (title && /^https?:/i.test(link)) items.push({ title, link, date, ts: new Date(date).getTime() || 0, audio: /^https?:/i.test(audio) ? audio : '', minutes, desc });
  }
  return items.sort((a, b) => b.ts - a.ts);
}

async function get(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml,application/xml,text/xml,text/html;q=0.8,*/*;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.text();
      console.warn(`  ${url} → HTTP ${r.status}`);
    } catch (e) { console.warn(`  ${url} → ${e.message}`); }
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}

function shorten(s, n = 260) { s = String(s || ''); if (s.length <= n) return s; const cut = s.slice(0, n); return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 30)).replace(/[,;:\s]+$/, '') + '…'; }

async function newest(src) {
  let pool = [];
  for (const u of src.urls) { const xml = await get(u); if (xml) pool = pool.concat(parseFeed(xml)); }
  pool.sort((a, b) => b.ts - a.ts);
  if (src.skip) pool = pool.filter(i => !src.skip.test(i.title));
  if (src.linkMatch) pool = pool.filter(i => src.linkMatch.test(i.link));
  if (!pool.length) return null;
  let it = pool[0], title = it.title, level = src.level;
  if (src.sbsLevel) {
    const m = title.match(/\s*\((Beg|Med|Adv)\)\s*$/i);
    if (m) { title = title.slice(0, m.index).trim(); level = { beg: 'A2–B1', med: 'B1–B2', adv: 'B2–C1' }[m[1].toLowerCase()]; }
  }
  if (src.bne) {
    // Prefer the newest "Harder" lesson (Levels 4–6): its main page is Level 6.
    let chosen = null;
    for (const cand of pool.slice(0, 5)) {
      const html = await get(cand.link); if (!html) continue;
      const slug = cand.link.replace(/^.*\//, '').replace(/\.html$/, '');
      if (html.includes(`${slug}-4.html`) || html.includes(`${slug}-5.html`)) { chosen = { cand, lvl: 6 }; break; }
      if (!chosen && (html.includes(`${slug}-0.html`) || html.includes(`${slug}-1.html`))) chosen = chosen || { cand, lvl: 3, easier: true };
    }
    if (chosen) { it = chosen.cand; title = it.title; if (chosen.lvl === 6) { title += ' (Level 6)'; level = 'B2–C1'; } else { title += ' (Level 3)'; level = 'B1'; } }
  }
  return { source: src.source, kind: src.kind, title, url: it.link, audio: src.kind === 'listen' ? it.audio : '', date: isoDay(it.date), minutes: it.minutes || src.minutes || 0, level, accent: src.accent, desc: shorten(it.desc) };
}

export async function main() {
  let prev = { items: [] };
  try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch (e) { /* first run */ }
  const items = [];
  for (const src of SOURCES) {
    console.log(`• ${src.source}`);
    let item = null;
    try { item = await newest(src); } catch (e) { console.warn(`  failed: ${e.message}`); }
    if (!item) { const old = (prev.items || []).find(i => i.source === src.source); if (old) { console.log('  kept previous item'); items.push(old); } continue; }
    console.log(`  ${item.title} (${item.date || 'no date'})`);
    items.push(item);
  }
  if (!items.length) { console.error('No items at all; leaving feed.json unchanged.'); process.exit(0); }
  await writeFile(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), items }, null, 1) + '\n');
  console.log(`Wrote ${items.length} items.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
