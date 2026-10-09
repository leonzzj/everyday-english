/* Now-playing bar: podcast episodes (real audio) and read-aloud of a story (speech), docked at the bottom. */
import { $, esc, fmtClock, ICON, artHTML, catTile } from './util.js';
import { TTS } from './tts.js';
import { Story, scrubHTML, setScrub } from './story.js';

export const Player = {
  el: null, item: null, listeners: new Set(), mode: '',
  init() {
    this.el = new Audio(); this.el.preload = 'none';
    ['play', 'pause', 'ended', 'loadedmetadata'].forEach(ev => this.el.addEventListener(ev, () => this.sync()));
    this.el.addEventListener('timeupdate', () => this.tick());
    window.addEventListener('ee:speak', () => { if (!this.el.paused) this.el.pause(); });
    Story.on(() => this.render());
  },
  isPlaying(item) { return !!(this.item && item && this.item.audio === item.audio && !this.el.paused); },
  play(item) {
    if (!item || !item.audio) return false;
    if (Story.playing) Story.pause(); else TTS.stop();
    if (this.item && this.item.audio === item.audio) { this.el.paused ? this.el.play().catch(() => { }) : this.el.pause(); this.render(); return true; }
    this.item = item; this.el.src = item.audio; this.el.play().catch(() => { });
    this.render(); return true;
  },
  toggle() { if (!this.item) return; this.el.paused ? this.el.play().catch(() => { }) : this.el.pause(); },
  skip(sec) { if (this.item && isFinite(this.el.duration)) this.el.currentTime = Math.max(0, Math.min(this.el.duration - 1, this.el.currentTime + sec)); },
  seekFrac(f) { if (this.item && isFinite(this.el.duration)) this.el.currentTime = f * this.el.duration; },
  close() {
    if (this.mode === 'story') { Story.pause(); Story.i = 0; Story.emit(); this.mode = ''; }
    else { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); this.item = null; }
    this.render();
  },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  render() {
    const box = $('#mini'); if (!box) return;
    const storyActive = Story.story && (Story.playing || (Story.i > 0 && !this.item));
    const mode = Story.playing ? 'story' : this.item ? 'audio' : storyActive ? 'story' : '';
    if (!mode) { this.mode = ''; box.hidden = true; box.innerHTML = ''; document.documentElement.style.setProperty('--mini', '0px'); this.sync(); return; }
    if (mode === 'story') {
      const st = Story.story, n = Story.sents.length, i = Math.min(Story.i, n - 1);
      if (this.mode !== 'story' || box.dataset.key !== st.id + Story.level) {
        box.innerHTML = `<div class="mini-in">${catTile(st.category)}<div style="min-width:0"><div class="t">${esc(st.headline)}</div><div class="s">正在朗读　${Story.level.toUpperCase()} 版</div></div>
          <div class="prog">${scrubHTML()}<span class="num" id="miniCount"></span></div>
          <div class="acts"><button class="play" data-act="story-toggle" id="miniPlay" aria-label="播放或暂停"></button><button class="icon-btn plain" data-act="mini-close" aria-label="关闭">${ICON.close}</button></div></div>`;
        box.dataset.key = st.id + Story.level;
      }
      const b = $('#miniPlay'); if (b) b.innerHTML = Story.playing ? ICON.pause : ICON.play;
      const c = $('#miniCount'); if (c) c.textContent = `${i + 1} / ${n}`;
      setScrub(box.querySelector('.scrub'), Story.progress());
    } else if (this.mode !== 'audio' || box.dataset.key !== this.item.audio) {
      const it = this.item;
      box.innerHTML = `<div class="mini-in">${artHTML(it)}<div style="min-width:0"><div class="t">${esc(it.title)}</div><div class="s">${esc(it.source)}</div></div>
        <div class="prog"><span class="num" id="miniCur">0:00</span><label class="sr" for="miniSeek">播放进度</label><input type="range" id="miniSeek" min="0" max="1000" value="0" data-change="mini-seek"><span class="num" id="miniDur">${it.minutes ? it.minutes + ':00' : '--:--'}</span></div>
        <div class="acts"><button class="icon-btn plain" data-act="mini-back" aria-label="后退 15 秒" title="后退 15 秒">${ICON.back15}</button><button class="play" data-act="mini-toggle" id="miniPlay" aria-label="播放或暂停">${ICON.pause}</button><a class="icon-btn plain" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="打开节目页面" title="打开节目页面">${ICON.ext}</a><button class="icon-btn plain" data-act="mini-close" aria-label="关闭播放器">${ICON.close}</button></div></div>`;
      box.dataset.key = it.audio;
    }
    this.mode = mode;
    if (box.hidden) { box.hidden = false; }
    document.documentElement.style.setProperty('--mini', box.offsetHeight + 'px');
    this.sync();
  },
  sync() {
    if (this.mode === 'audio') {
      const b = $('#miniPlay'); if (b) b.innerHTML = this.el.paused ? ICON.play : ICON.pause;
      const d = $('#miniDur'); if (d && isFinite(this.el.duration)) d.textContent = fmtClock(this.el.duration);
    }
    this.listeners.forEach(fn => { try { fn(this); } catch (e) { } });
  },
  tick() {
    if (this.mode !== 'audio') return;
    const c = $('#miniCur'), s = $('#miniSeek');
    if (c) c.textContent = fmtClock(this.el.currentTime);
    if (s && isFinite(this.el.duration) && document.activeElement !== s) s.value = String(Math.round(this.el.currentTime / this.el.duration * 1000));
  }
};
