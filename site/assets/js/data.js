/* Loads the daily issue, the issue index and the external feed (static JSON files in /data). */
import { str, isDate, LS } from './util.js';

function safeUrl(u) { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } }

function normVocab(v) {
  if (!v || typeof v !== 'object') return null; const word = str(v.word, 60).trim(); if (!word) return null;
  return { word, pos: str(v.pos, 16), ipa: str(v.ipa, 60), zh: str(v.zh, 80), en: str(v.en, 200), example: str(v.example, 240),
    forms: Array.isArray(v.forms) ? v.forms.map(f => str(f, 60).trim()).filter(Boolean).slice(0, 4) : [] };
}
function normQ(q) {
  if (!q || typeof q !== 'object') return null;
  const tf = q.type === 'tfng';
  const opts = tf ? ['True', 'False', 'Not Given'] : (Array.isArray(q.options) ? q.options.map(o => str(o, 200)).filter(Boolean).slice(0, 5) : []);
  const a = Number(q.answer);
  if (!str(q.q) || opts.length < 2 || !(a >= 0 && a < opts.length)) return null;
  return { type: tf ? 'tfng' : 'mcq', q: str(q.q, 300), options: opts, answer: a, explain: str(q.explain, 400) };
}
function normStory(s, i) {
  if (!s || typeof s !== 'object') return null;
  const b2 = str(s.b2 || s.c1, 9000), c1 = str(s.c1 || s.b2, 10000);
  if (!b2 && !c1) return null;
  return { id: str(s.id, 60).replace(/[^\w-]/g, '') || ('s' + i), category: str(s.category, 30) || 'World', headline: str(s.headline, 220) || 'Untitled', headlineZh: str(s.headlineZh, 200), summaryZh: str(s.summaryZh, 300),
    b2, c1, vocab: (Array.isArray(s.vocab) ? s.vocab : []).map(normVocab).filter(Boolean).slice(0, 14),
    questions: (Array.isArray(s.questions) ? s.questions : []).map(normQ).filter(Boolean).slice(0, 6), discuss: str(s.discuss, 400),
    sources: (Array.isArray(s.sources) ? s.sources : []).map(x => ({ name: str(x && x.name, 80) || 'Source', url: safeUrl(x && x.url) })).filter(x => x.url).slice(0, 5) };
}
function normDialogue(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.lines)) return null;
  const lines = d.lines.map(l => l && typeof l === 'object' ? { s: l.s === 'B' ? 'B' : 'A', name: str(l.name, 24), en: str(l.en, 300), zh: str(l.zh, 300) } : null).filter(l => l && l.en).slice(0, 30);
  if (lines.length < 2) return null;
  const nameA = (lines.find(l => l.s === 'A') || {}).name || 'A', nameB = (lines.find(l => l.s === 'B') || {}).name || 'B';
  return { id: 'daily', title: str(d.title, 120) || "Today's dialogue", zh: str(d.titleZh, 80), setting: str(d.setting, 240), settingZh: str(d.settingZh, 240),
    roles: { A: nameA, B: nameB }, rolesZh: { A: nameA, B: nameB }, lines,
    phrases: (Array.isArray(d.phrases) ? d.phrases : []).map(p => p && { plain: str(p.plain, 120), en: str(p.en, 120), zh: str(p.zh, 160) }).filter(p => p && p.en).slice(0, 10), tip: str(d.tip, 300) };
}
export function normIssue(d) {
  if (!d || typeof d !== 'object') return null;
  const date = str(d.date, 10); if (!isDate(date)) return null;
  const stories = (Array.isArray(d.stories) ? d.stories : []).map(normStory).filter(Boolean).slice(0, 8);
  if (!stories.length) return null;
  stories.forEach(s => { s._date = date; });
  return { date, issueNo: Number(d.issueNo) || null, title: str(d.title, 200), stories, dialogue: normDialogue(d.dialogue) };
}
function normIndex(d) {
  const list = d && Array.isArray(d.issues) ? d.issues : [];
  return list.map(x => x && typeof x === 'object' && isDate(x.date) ? { date: x.date, issueNo: Number(x.issueNo) || null, title: str(x.title, 200), headlines: (Array.isArray(x.headlines) ? x.headlines : []).map(h => str(h, 220)).filter(Boolean).slice(0, 8) } : null)
    .filter(Boolean).sort((a, b) => a.date < b.date ? 1 : -1);
}
function normFeed(d) {
  const items = (d && Array.isArray(d.items) ? d.items : []).map(it => {
    if (!it || typeof it !== 'object') return null; const url = safeUrl(it.url); if (!url || !str(it.title)) return null;
    const img = safeUrl(it.image);
    return { source: str(it.source, 60) || 'Source', kind: it.kind === 'listen' ? 'listen' : 'read', title: str(it.title, 220), url, audio: safeUrl(it.audio), image: img.startsWith('https:') ? img : '', date: isDate(it.date) ? it.date : '',
      minutes: Math.max(0, Math.min(600, Math.round(Number(it.minutes) || 0))), level: str(it.level, 20), accent: str(it.accent, 10), desc: str(it.desc, 400) };
  }).filter(Boolean).slice(0, 40);
  return { updatedAt: str(d && d.updatedAt, 40), items };
}

async function getJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

export const Data = {
  index: [], issues: new Map(), feed: { updatedAt: '', items: [] }, state: 'loading', feedState: 'loading',
  async loadIndex() {
    try { this.index = normIndex(await getJSON('data/index.json')); this.state = this.index.length ? 'ready' : 'empty'; }
    catch (e) { this.state = 'error'; }
    return this.index;
  },
  async loadIssue(date) {
    if (this.issues.has(date)) return this.issues.get(date);
    try { const iss = normIssue(await getJSON(`data/issues/${date}.json`)); if (iss) { this.issues.set(date, iss); LS.set('ee.lastIssue', iss); } return iss; }
    catch (e) { return null; }
  },
  async loadFeed() {
    try { this.feed = normFeed(await getJSON('data/feed.json')); this.feedState = 'ready'; LS.set('ee.feed', this.feed); }
    catch (e) { this.feedState = 'error'; }
    return this.feed;
  },
  cachedIssue() { return normIssue(LS.get('ee.lastIssue', null)); },
  cachedFeed() { const f = LS.get('ee.feed', null); return f && Array.isArray(f.items) && f.items.length ? normFeed(f) : null; }
};
