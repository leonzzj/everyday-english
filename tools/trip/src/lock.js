(() => {
  "use strict";
  // Web copy only: the itinerary is encrypted (same key pair and password as the dashboard).
  const $ = s => document.querySelector(s);
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  // Same IndexedDB store as the dashboard, so a device that unlocked one page can open the other.
  const idb = (() => {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open("dashboard", 1); r.onupgradeneeded = () => r.result.createObjectStore("keys"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const run = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const tx = db.transaction("keys", mode), rq = fn(tx.objectStore("keys"));
      tx.oncomplete = () => { db.close(); res(rq ? rq.result : undefined); };
      tx.onerror = tx.onabort = () => { db.close(); rej(tx.error); };
    }));
    return { get: k => run("readonly", st => st.get(k)), set: (k, v) => run("readwrite", st => st.put(v, k)), del: k => run("readwrite", st => st.delete(k)) };
  })();
  async function getJSON(url) {
    let r;
    try { r = await fetch(url, { cache: "no-cache" }); } catch (e) { throw Object.assign(new Error("offline"), { net: true }); }
    if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { net: true });
    return { json: await r.json(), cached: r.headers.get("x-trip-cache") === "1" };
  }
  async function keyFromPassword(pw) {
    const kf = (await getJSON("key.enc.json")).json;
    const pwKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    const aes = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(kf.salt), iterations: kf.iter, hash: "SHA-256" }, pwKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    let der;
    try { der = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(kf.iv) }, aes, b64(kf.ct)); }
    catch (e) { throw Object.assign(new Error("Wrong password"), { wrong: true }); }
    return crypto.subtle.importKey("pkcs8", der, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  }
  async function openData(priv, f) {
    const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, b64(f.wk));
    const k = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(f.iv) }, k, b64(f.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  let priv = null, lastCheck = 0;
  async function openTrip(first) {
    const res = await getJSON("data.enc.json");
    const doc = await openData(priv, res.json);
    lastCheck = Date.now();
    const at = String(res.json.at || doc.at || "").slice(0, 16).replace("T", " ");
    const extra = ` · 网页数据 ${at}${res.cached ? "（离线副本）" : ""}<br><button type="button" id="lockNow">锁定这台设备</button>`;
    if (first || !window.__trip.isReady()) window.__trip.start(doc.data, extra);
    else window.__trip.refresh(doc.data, extra);
    $("#lock").hidden = true;
  }
  function showLock(msg) {
    $("#lock").hidden = false;
    $("#lockErr").textContent = msg || "";
  }
  $("#lockForm").addEventListener("submit", async e => {
    e.preventDefault();
    const pw = $("#lockPw").value; if (!pw) { $("#lockPw").focus(); return; }
    const btn = $("#lockGo"); btn.disabled = true; btn.textContent = "解锁中…"; $("#lockErr").textContent = "";
    try {
      priv = await keyFromPassword(pw);
      if ($("#lockKeep").checked) { try { await idb.set("priv", priv); } catch (err) {} }
      await openTrip(true);
      $("#lockPw").value = ""; $("#lockPw").blur();
    } catch (err) {
      priv = null;
      $("#lockErr").textContent = err && err.wrong ? "密码不对，再试一次。" : "加载不了数据。检查网络后再试。";
    } finally { btn.disabled = false; btn.textContent = "解锁"; }
  });
  document.addEventListener("click", async e => {
    if (!e.target.closest("#lockNow")) return;
    try { await idb.del("priv"); } catch (err) {}
    location.reload();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && priv && Date.now() - lastCheck > 10 * 6e4) openTrip(false).catch(() => {});
  });

  async function boot() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
    if (!(window.crypto && crypto.subtle)) { showLock("要用 https 打开这个网页才能解锁。"); return; }
    try { priv = await idb.get("priv"); } catch (e) {}
    if (priv) {
      try { await openTrip(true); return; }
      catch (e) {
        if (e && e.net) { showLock("连不上网，加载不了数据。联网后再刷新。"); return; }
        try { await idb.del("priv"); } catch (err) {}
        priv = null;
      }
    }
    showLock();
  }
  boot();
})();
