/* Podcast mini player: plays an episode's audio file in the page, docked above the bottom bar. */
import { $, esc, coverHTML, fmtClock, ICON } from './util.js';
import { TTS } from './tts.js';

export const Player = {
  el: null, item: null, listeners: new Set(),
  init() {
    this.el = new Audio(); this.el.preload = 'none';
    ['play', 'pause', 'ended', 'loadedmetadata'].forEach(ev => this.el.addEventListener(ev, () => this.sync()));
    this.el.addEventListener('timeupdate', () => this.tick());
    this.el.addEventListener('error', () => { if (this.item) { this.sync(); } });
    window.addEventListener('ee:speak', () => { if (!this.el.paused) this.el.pause(); });
  },
  isPlaying(item) { return !!(this.item && item && this.item.audio === item.audio && !this.el.paused); },
  play(item) {
    if (!item || !item.audio) return false;
    TTS.stop();
    if (this.item && this.item.audio === item.audio) { this.el.paused ? this.el.play().catch(() => { }) : this.el.pause(); return true; }
    this.item = item; this.el.src = item.audio; this.el.play().catch(() => { });
    this.render(); return true;
  },
  toggle() { if (!this.item) return; this.el.paused ? this.el.play().catch(() => { }) : this.el.pause(); },
  skip(sec) { if (this.item && isFinite(this.el.duration)) this.el.currentTime = Math.max(0, Math.min(this.el.duration - 1, this.el.currentTime + sec)); },
  seekFrac(f) { if (this.item && isFinite(this.el.duration)) this.el.currentTime = f * this.el.duration; },
  close() { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); this.item = null; this.render(); },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  render() {
    const box = $('#mini'); if (!box) return;
    if (!this.item) { box.hidden = true; document.documentElement.style.setProperty('--mini', '0px'); this.sync(); return; }
    const it = this.item;
    box.innerHTML = `<div class="mini-in">${coverHTML(it.source)}<div style="min-width:0"><div class="t">${esc(it.title)}</div><div class="s">${esc(it.source)}</div></div>
      <div class="prog"><span class="num" id="miniCur">0:00</span><label class="sr" for="miniSeek">播放进度</label><input type="range" id="miniSeek" min="0" max="1000" value="0" data-change="mini-seek"><span class="num" id="miniDur">${it.minutes ? it.minutes + ':00' : '--:--'}</span></div>
      <div class="acts"><button class="icon-btn sm" data-act="mini-back" aria-label="后退 15 秒" title="后退 15 秒"><span class="num" style="font-size:12px;font-weight:800">−15</span></button><button class="play sm" data-act="mini-toggle" id="miniPlay" aria-label="播放或暂停">${ICON.pause}</button><a class="icon-btn sm" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="打开节目页面" title="打开节目页面">${ICON.ext}</a><button class="icon-btn sm" data-act="mini-close" aria-label="关闭播放器">${ICON.close}</button></div></div>`;
    box.hidden = false;
    document.documentElement.style.setProperty('--mini', box.offsetHeight + 'px');
    this.sync();
  },
  sync() {
    const b = $('#miniPlay'); if (b) b.innerHTML = this.el.paused ? ICON.play : ICON.pause;
    const d = $('#miniDur'); if (d && isFinite(this.el.duration)) d.textContent = fmtClock(this.el.duration);
    this.listeners.forEach(fn => { try { fn(this); } catch (e) { } });
  },
  tick() {
    const c = $('#miniCur'), s = $('#miniSeek');
    if (c) c.textContent = fmtClock(this.el.currentTime);
    if (s && isFinite(this.el.duration) && document.activeElement !== s) s.value = String(Math.round(this.el.currentTime / this.el.duration * 1000));
  }
};
