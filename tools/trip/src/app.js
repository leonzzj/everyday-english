(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const MODE = { "飞机": "fly", "火车": "rail", "新干线": "rail", "KTX": "rail", "高铁": "rail", "机场快线": "rail",
    "地铁": "metro", "电车": "metro", "单轨": "metro", "公交": "bus", "大巴": "bus", "小巴": "bus", "班车": "bus",
    "打车": "taxi", "步行": "walk", "骑车": "bike" };
  const ICON = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>'
  };
  const INLINE = !!document.getElementById("trip-data");  // the Claude copy: app links (nmap://) are unreliable there
  const MEAL_RE = /^(早饭|午饭|晚饭|下午茶|零食)：/;
  const TIME_RE = /^(\d{1,2}):(\d{2})$/;

  let T = null;
  const S = { tab: "day", i: 0, lastNav: 0, extra: "" };

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bold = s => s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  const fmtInline = s => bold(esc(s).replace(/\[\[(ok|todo)\|([^\]]+)\]\]/g, '<span class="chip $1">$2</span>'));
  const fmtHow = s => esc(s).replace(/\[([^\[\]]{1,6})\]/g, (m, n) => MODE[n] ? `<span class="mode ${MODE[n]}">${n}</span>` : m);
  const isoLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const toDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const todayIdx = () => T.days.findIndex(d => d.date === isoLocal());
  function phase() { const t = isoLocal(); return t < T.start ? "before" : t > T.end ? "after" : "during"; }
  const cityTags = list => list.map((c, k) => (k ? '<span class="to">→</span>' : "") + `<span class="ctag cc-${esc(c.cc)}">${esc(c.name)}</span>`).join("");
  const hotelOf = d => T.hotels.find(h => h.id === d.hotel) || null;

  // ---------------------------------------------------------------- header
  function renderStatus() {
    const p = phase(), el = $("#status");
    if (p === "before") {
      const n = Math.round((toDate(T.start) - toDate(isoLocal())) / 864e5);
      el.textContent = `${T.days[0].md} 出发 · 还有 ${n} 天`;
    } else if (p === "during") {
      el.textContent = `第 ${todayIdx() + 1} 天 · 共 ${T.days.length} 天`;
    } else el.textContent = "行程已结束";
    const ti = todayIdx();
    $("#todayBtn").hidden = !(ti >= 0 && (S.tab !== "day" || S.i !== ti));
  }
  function buildStrip() {
    $("#strip").innerHTML = T.days.map((d, k) =>
      `<button class="dchip cc-${esc(d.cc)}" type="button" data-day="${k}" aria-label="${esc(d.md + " " + d.wd + " " + d.title)}"><span class="d">${esc(d.md)}</span><span class="w">${esc(d.wd.replace("周", ""))}</span><span class="bar"></span></button>`).join("");
  }
  function syncStrip(center) {
    const ti = todayIdx();
    $$("#strip .dchip").forEach((b, k) => {
      b.setAttribute("aria-current", k === S.i ? "true" : "false");
      b.classList.toggle("is-today", k === ti);
    });
    if (center) {
      const strip = $("#strip"), b = strip.children[S.i];
      if (b) strip.scrollTo({ left: Math.max(0, b.offsetLeft - strip.clientWidth / 2 + b.clientWidth / 2), behavior: center === "smooth" ? "smooth" : "auto" });
    }
  }

  // ---------------------------------------------------------------- day view
  function currentRow(d) {
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    let cur = -1;
    d.rows.forEach((r, k) => { const m = TIME_RE.exec(r.t); if (m && (+m[1]) * 60 + (+m[2]) <= mins) cur = k; });
    return cur;
  }
  // Map links for one place. Search names are in the local language, so the local map apps find them.
  function mapLinks(p) {
    const q = encodeURIComponent(p.q), L = [];
    const gDir = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=transit`;
    const gPlace = `https://www.google.com/maps/search/?api=1&query=${q}`;
    const apple = `https://maps.apple.com/?q=${q}`;
    if (p.c === "kr") {
      if (!INLINE) L.push({ label: "Naver 地图 App", url: `nmap://search?query=${q}&appname=${encodeURIComponent(location.origin)}`, primary: true, app: true });
      L.push({ label: INLINE ? "Naver 地图" : "Naver 地图网页版", url: `https://map.naver.com/p/search/${q}`, primary: INLINE });
      L.push({ label: "Google 地图路线", url: gDir });
    } else if (p.c === "jp") {
      L.push({ label: "Google 地图路线", url: gDir, primary: true });
      L.push({ label: "Google 地图看地点", url: gPlace });
      L.push({ label: "Apple 地图", url: apple });
    } else if (p.c === "cn") {
      L.push({ label: "Apple 地图", url: apple, primary: true });
      L.push({ label: "高德地图", url: `https://uri.amap.com/search?keyword=${q}&callnative=1` });
    } else {
      L.push({ label: "Google 地图路线", url: gDir, primary: true });
      L.push({ label: "Apple 地图", url: apple });
    }
    return L;
  }
  let sheetFrom = null;
  function openSheet(p, from) {
    sheetFrom = from || null;
    $("#sheetTitle").textContent = p.n;
    $("#sheetQ").textContent = p.q;
    const lang = p.c === "kr" ? "韩文名" : p.c === "jp" ? "日文名" : "名称";
    $("#sheetActs").innerHTML = mapLinks(p).map(l =>
      `<a class="btn${l.primary ? " primary" : ""}" href="${esc(l.url)}"${l.app ? "" : ' target="_blank" rel="noopener"'}>${ICON.map}${esc(l.label)}</a>`).join("") +
      `<button class="btn" type="button" data-copy="${esc(p.q)}">${ICON.copy}复制${lang}</button>` +
      (p.c === "kr" && !INLINE ? '<p class="sheet-note">没装 Naver 地图 App 就点网页版。</p>' : "");
    $("#sheetBg").hidden = false; $("#sheet").hidden = false;
    const first = $("#sheetActs .btn"); if (first) first.focus({ preventScroll: true });
  }
  function closeSheet() {
    if ($("#sheet").hidden) return;
    $("#sheetBg").hidden = true; $("#sheet").hidden = true;
    if (sheetFrom && document.body.contains(sheetFrom)) sheetFrom.focus({ preventScroll: true });
  }
  function placesHTML(r, k) {
    if (!r.places || !r.places.length) return "";
    return `<div class="places">${r.places.map((p, j) =>
      `<button class="pl" type="button" data-pl="${k}:${j}" aria-label="${esc("导航到 " + p.n)}">${ICON.map}${esc(p.n)}</button>`).join("")}</div>`;
  }
  function stopHTML(r, now, k) {
    const timed = TIME_RE.test(r.t);
    let what = r.what, tag = "";
    const mm = MEAL_RE.exec(what);
    if (mm) { what = what.slice(mm[0].length); if (r.t !== mm[1]) tag = `<span class="mealtag">${mm[1]}</span>`; }
    const fix = r.flag === "fix" || r.flag === "fixtight", tight = r.flag === "tight" || r.flag === "fixtight";
    const cls = ["stop", fix && "fix", tight && "tight", mm && "meal", now && "is-now"].filter(Boolean).join(" ");
    const badges = (fix ? '<span class="badge fix">固定</span>' : "") + (tight ? '<span class="badge tight">紧</span>' : "") + (now ? '<span class="badge now">现在</span>' : "");
    return `<li class="${cls}"><span class="t${timed ? "" : " lbl"}">${esc(r.t)}</span><span class="rail" aria-hidden="true"></span>` +
      `<div class="body"><div class="what">${tag}${esc(what)}${badges}</div>${r.how ? `<div class="how">${fmtHow(r.how)}</div>` : ""}${placesHTML(r, k)}</div></li>`;
  }
  function hotelCard(h, opts = {}) {
    const st = h.status ? `<span class="st ${h.status.includes("待") ? "todo" : "ok"}">${esc(h.status)}</span>` : "";
    const head = opts.withCity ? `<span class="ctag cc-${esc(h.cc)}">${esc(h.city)}${h.nights ? " " + esc(h.nights) : ""}</span>` : "";
    const addr = h.addr.map(a => `<div class="addr">${esc(a)}</div>`).join("");
    const acc = h.access.length ? `<div class="acc">${h.access.map(esc).join(" · ")}</div>` : "";
    const copy = h.copy ? `<button class="btn primary" type="button" data-copy="${esc(h.copy)}">${ICON.copy}${h.addr.length ? "复制地址" : "复制名称"}</button>` : "";
    const maps = h.maps.map(m => `<a class="btn" href="${esc(m.url)}" target="_blank" rel="noopener">${ICON.map}${esc(m.label)}</a>`).join("");
    return `<div class="hotel">${head ? `<div>${head}</div>` : ""}<div class="hname">${esc(h.name)}${st}</div>${h.sub ? `<div class="hsub">${esc(h.sub)}</div>` : ""}${addr}${acc}<div class="acts">${copy}${maps}</div></div>`;
  }
  function renderDay() {
    const d = T.days[S.i], ti = todayIdx(), isToday = ti === S.i;
    const nowRow = isToday ? currentRow(d) : -1;
    const meta = d.meta.split(" · ").map(m => `<span>${esc(m)}</span>`).join("");
    const h = hotelOf(d);
    let stay = "";
    if (h && h.name) stay = `<div class="panel"><h3>今晚住</h3>${hotelCard(h)}</div>`;
    else if (h) stay = `<div class="panel"><h3>今晚</h3><p>${esc(h.city)}</p></div>`;
    const prev = T.days[S.i - 1], next = T.days[S.i + 1];
    const pg = (x, k, cls, label) => x
      ? `<button class="pg ${cls}" type="button" data-day="${k}"><span class="k">${label}</span><span class="v">${esc(x.md + " " + x.wd)} · ${esc(x.title)}</span></button>`
      : `<button class="pg ${cls}" type="button" disabled></button>`;
    $("#v-day").innerHTML = `
      <div class="dhead">
        <div class="dline"><span class="ddate">${esc(d.md)}</span><span class="dwd">${esc(d.wd)}</span>${d.hol ? `<span class="hol">${esc(d.hol)}</span>` : ""}${isToday ? '<span class="badge now">今天</span>' : ""}</div>
        <div class="cities">${cityTags(d.cities)}</div>
        <h2 class="dtitle">${esc(d.title)}</h2>
        <div class="meta">${meta}</div>
      </div>
      ${d.warn ? `<div class="warn" role="note"><b>时间紧</b>${esc(d.warn)}</div>` : ""}
      <ol class="tl cc-${esc(d.cc)}">${d.rows.map((r, k) => stopHTML(r, k === nowRow, k)).join("")}</ol>
      <div class="two">
        <div class="panel"><h3>今天带</h3><p>${esc(d.bring)}</p></div>
        ${d.tips ? `<div class="panel"><h3>提醒</h3><p>${esc(d.tips)}</p></div>` : ""}
      </div>
      ${stay}
      <div class="pager">${pg(prev, S.i - 1, "prev", "← 前一天")}${pg(next, S.i + 1, "next", "后一天 →")}</div>`;
  }

  // ---------------------------------------------------------------- overview
  function renderOv() {
    const ti = todayIdx(), first = T.days[0], last = T.days[T.days.length - 1];
    const route = T.route.map((r, k) => (k ? '<span class="ar">→</span>' : "") +
      `<span class="rs cc-${esc(r.cc)}">${esc(r.city)}${r.nights ? `<small>${esc(r.nights)}</small>` : ""}</span>`).join("");
    const days = T.days.map((d, k) => `<li><button class="ovday cc-${esc(d.cc)}${k === ti ? " is-today" : ""}" type="button" data-go="${k}">
        <span class="od"><span class="n">${esc(d.md)}</span><span class="w">${esc(d.wd)}${d.hol ? " · 假日" : ""}${k === ti ? " · 今天" : ""}</span><span class="u"></span></span>
        <span class="oc"><span class="cities">${cityTags(d.cities)}</span><span class="om">${fmtInline(d.main)}</span>${d.tip ? `<span class="ot">${fmtInline(d.tip)}</span>` : ""}</span>
      </button></li>`).join("");
    const foot = T.foot.map(b => `<div class="panel"><h3>${esc(b.h)}</h3><ul>${b.items.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("");
    const hotels = T.hotels.filter(h => h.name).map(h => `<div class="panel">${hotelCard(h, { withCity: true })}</div>`).join("");
    $("#v-ov").innerHTML = `
      <div class="hero"><h1>${esc(T.title)}</h1><p class="num">${esc(first.md)}（${esc(first.wd)}）– ${esc(last.md)}（${esc(last.wd)}）· ${T.days.length} 天</p><p>更新于 ${esc(T.updated)}</p></div>
      <div class="route">${route}</div>
      <h2 class="sec">每一天</h2>
      <ol class="ovlist">${days}</ol>
      <h2 class="sec">交通和门票</h2>
      <div class="cards c2">${foot}</div>
      <h2 class="sec">住宿</h2>
      <div class="cards c2">${hotels}</div>`;
  }

  // ---------------------------------------------------------------- notes
  function renderNotes() {
    const notes = T.notes.map(n => `<div class="panel"><h3>${esc(n.h)}</h3><ul>${n.items.map(x => `<li>${bold(esc(x))}</li>`).join("")}</ul></div>`).join("");
    const modes = ["飞机", "高铁", "电车", "地铁", "公交", "打车", "步行", "骑车"].map(n => `<span class="mode ${MODE[n]}">${n}</span>`).join("");
    const legend = `<div class="panel"><h3>图例</h3><div class="legend">${modes}</div>
      <div class="legend"><span><span class="badge fix" style="margin-left:0">固定</span> 航班、车票、开门时间，不能晚</span><span><span class="badge tight" style="margin-left:0">紧</span> 时间卡得紧，旁边写了赶不上怎么办</span><span><span class="mealtag">午饭</span>第一家是首选</span></div></div>`;
    const tables = T.analysis.tables.map(t => `<h2 class="sec">${esc(t.h)}</h2><div class="cards c2">${t.rows.map(r =>
      `<div class="card"><div class="ct">${bold(esc(r[0]))}</div>${r.slice(1).map((v, k) => `<div class="cw"><span class="k">${esc(t.cols[k + 1])}</span><span>${bold(esc(v))}</span></div>`).join("")}</div>`).join("")}</div>`).join("");
    $("#v-notes").innerHTML = `${notes}${legend}${tables}${T.analysis.note ? `<div class="panel"><h3>帖子里反复出现的提醒</h3><p>${esc(T.analysis.note)}</p></div>` : ""}
      <p class="foot-note">内容和 PDF 详细版一致 · 更新于 ${esc(T.updated)}${S.extra}</p>`;
  }

  // ---------------------------------------------------------------- shopping
  function renderShop() {
    const s = T.shopping;
    const rules = `<div class="panel"><h3>先看规矩</h3><ul>${s.rules.map(x => `<li>${bold(esc(x))}</li>`).join("")}</ul></div>`;
    const groups = s.groups.map(g => `<div class="grp-h"><span class="ctag cc-${esc(g.cc)}">${esc(g.name)}</span></div>
      <div class="cards c2">${g.items.map(it => `<div class="card"><div class="ct">${bold(esc(it.what))}</div><div class="cw"><span class="k">在哪买</span><span>${bold(esc(it.where))}</span></div><div class="cn">${bold(esc(it.note))}</div></div>`).join("")}</div>`).join("");
    $("#v-shop").innerHTML = rules + groups;
  }

  // ---------------------------------------------------------------- navigation
  const VIEWS = { day: "#v-day", ov: "#v-ov", notes: "#v-notes", shop: "#v-shop" };
  function setTab(tab, keepScroll) {
    if (!VIEWS[tab]) tab = "day";
    S.tab = tab; store.set("trip.tab", tab);
    Object.keys(VIEWS).forEach(k => { $(VIEWS[k]).hidden = k !== tab; });
    $$(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"));
    $("#strip").hidden = tab !== "day";
    renderStatus();
    if (!keepScroll) window.scrollTo(0, 0);
  }
  function goDay(i, how) {
    if (!T || i < 0 || i >= T.days.length) return;
    closeSheet();
    S.i = i; S.lastNav = Date.now();
    if (phase() !== "during") store.set("trip.day", String(i));
    renderDay(); syncStrip(how === "smooth" ? "smooth" : "auto"); renderStatus();
    window.scrollTo(0, 0);
  }
  function scrollToNow() {
    const el = $("#v-day .stop.is-now");
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - $(".top").getBoundingClientRect().bottom - 16;
    window.scrollTo(0, Math.max(0, top));
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }
  function copyText(text) {
    const done = () => toast("已复制：" + text);
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        const ok = document.execCommand("copy"); ta.remove();
        ok ? done() : toast("复制不了，长按地址手动复制");
      } catch (e) { toast("复制不了，长按地址手动复制"); }
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }

  function wire() {
    document.addEventListener("click", e => {
      const pl = e.target.closest("[data-pl]");
      if (pl && T) {
        const [k, j] = pl.dataset.pl.split(":").map(Number), r = T.days[S.i].rows[k];
        if (r && r.places && r.places[j]) openSheet(r.places[j], pl);
        return;
      }
      if (e.target.closest("#sheetBg, #sheetX")) { closeSheet(); return; }
      if (e.target.closest("#sheetActs a")) { setTimeout(closeSheet, 300); return; }
      const c = e.target.closest("[data-copy]");
      if (c) { copyText(c.getAttribute("data-copy")); return; }
      const d = e.target.closest("[data-day]");
      if (d && !d.disabled) { goDay(+d.dataset.day, d.closest("#strip") ? "smooth" : ""); return; }
      const g = e.target.closest("[data-go]");
      if (g) { setTab("day", true); goDay(+g.dataset.go, "smooth"); return; }
      const t = e.target.closest(".tab");
      if (t) { setTab(t.dataset.tab); if (t.dataset.tab === "day") syncStrip("auto"); }
    });
    $("#todayBtn").addEventListener("click", () => {
      const ti = todayIdx(); if (ti < 0) return;
      setTab("day", true); goDay(ti, "smooth"); scrollToNow();
    });
    let sx = 0, sy = 0, st = 0;
    const v = $("#v-day");
    v.addEventListener("touchstart", e => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
    v.addEventListener("touchend", e => {
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 650 && Math.abs(dx) > 70 && Math.abs(dy) < 45) goDay(S.i + (dx < 0 ? 1 : -1), "smooth");
    }, { passive: true });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { closeSheet(); return; }
      if (!$("#sheet").hidden) return;
      if (S.tab !== "day" || e.altKey || e.metaKey || e.ctrlKey || /input|textarea/i.test((e.target.tagName || ""))) return;
      if (e.key === "ArrowRight") goDay(S.i + 1, "smooth");
      if (e.key === "ArrowLeft") goDay(S.i - 1, "smooth");
    });
    // keep "today" and the "now" mark current
    setInterval(() => { if (!T) return; if (S.tab === "day" && todayIdx() === S.i) renderDay(); renderStatus(); syncStrip(); }, 60000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !T) return;
      const ti = todayIdx();
      if (ti >= 0 && ti !== S.i && Date.now() - S.lastNav > 30 * 6e4) { setTab("day", true); goDay(ti); scrollToNow(); }
      else { renderStatus(); syncStrip(); if (S.tab === "day") renderDay(); }
    });
  }

  function start(data, extraNote) {
    T = data; S.extra = extraNote || "";
    buildStrip();
    const ti = todayIdx(), saved = parseInt(store.get("trip.day"), 10);
    S.i = ti >= 0 ? ti : (saved >= 0 && saved < T.days.length ? saved : 0);
    renderDay(); renderOv(); renderNotes(); renderShop();
    const tab = store.get("trip.tab");
    setTab(ti >= 0 ? "day" : (VIEWS[tab] ? tab : "day"), true);
    syncStrip("auto");
    if (ti >= 0) requestAnimationFrame(scrollToNow);
  }
  function refresh(data, extraNote) {
    T = data; S.extra = extraNote || S.extra;
    if (S.i >= T.days.length) S.i = 0;
    buildStrip(); renderDay(); renderOv(); renderNotes(); renderShop(); syncStrip(); renderStatus();
  }

  window.__trip = { start, refresh, wire, isReady: () => !!T };
  wire();
  const inline = document.getElementById("trip-data");
  if (inline) start(JSON.parse(inline.textContent));
})();
