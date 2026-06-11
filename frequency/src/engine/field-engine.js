/* FREQUENCY — canvas field engine (plain JS, no JSX)
 * Renders a drifting starfield: your warm light, strangers' cool lights,
 * a proximity lock mechanic, a radio waveform strip, and a constellation finale.
 * React owns screen state and calls into this imperative engine.
 */
const TAU = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// tiny seeded RNG so layouts are stable within a session
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// pointer x → FM dial frequency
export const freqAt = (x, w) => 88 + (x / w) * (108 - 88);

export const LOCK_R = 78;       // px within which the lock charges
export const LOCK_FILL_S = 1.25; // seconds to fill
export const LOCK_DECAY_S = 0.9; // seconds to drain
// on touch the finger hides your light — aim above the fingertip
export const TOUCH_OFFSET_Y = 48;

export function stepLockProgress(progress, near, dt) {
  return near
    ? clamp(progress + dt / LOCK_FILL_S, 0, 1)
    : clamp(progress - dt / LOCK_DECAY_S, 0, 1);
}

export function spawnStrangers(seed, count, w, h) {
  const rnd = mulberry32((seed || 1) * 2654435761 >>> 0);
  const n = clamp(count | 0, 3, 14);
  const out = [];
  const margin = 90;
  let tries = 0;
  while (out.length < n && tries < 4000) {
    tries++;
    const x = margin + rnd() * (w - margin * 2);
    const y = margin + rnd() * (h - margin * 2);
    // keep apart from each other and from center start
    if (dist(x, y, w / 2, h / 2) < 120) continue;
    let ok = true;
    for (const s of out) { if (dist(x, y, s.x, s.y) < 130) { ok = false; break; } }
    if (!ok) continue;
    out.push({
      id: out.length,
      x, y, bx: x, by: y,
      phase: rnd() * TAU,
      driftR: 14 + rnd() * 22,
      driftS: 0.10 + rnd() * 0.18,
      twinkle: rnd() * TAU,
      msgIndex: out.length, // React assigns actual text by index
    });
  }
  return out;
}

export class FrequencyField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = 0; this.h = 0;
    this.mode = "idle"; // idle | tuning | locked | constellation
    this.config = {
      bg: "#0d0b1f", bg2: "#05040d",
      you: "#f4b860", them: "#9fc6ff", thread: "#dff1ff",
      strangerCount: 7, motion: 1,
    };
    this.strangers = [];
    this.dust = [];
    this.constStars = [];
    this.trail = [];   // comet trail behind your light
    this.pulses = [];  // echo pulses: other signals arriving in the field
    this._meta = [];   // per-stranger {fade, lockScale} from message age
    this._audioFn = null; // 0..1 music level for star twinkle sync
    this.you = { x: 0, y: 0, tx: 0, ty: 0 };
    this.lockProgress = 0;
    this.nearest = null;
    this.lockedStranger = null;
    this.cam = { scale: 1, tScale: 1 };
    this.metStar = null;
    this.myStar = null;
    this.t0 = performance.now();
    this.last = this.t0;
    this._cbFreq = null;
    this._cbProg = null;
    this._cbLock = null;
    this._raf = null;
    this._pointerInside = false;

    this._onResize = this._resize.bind(this);
    window.addEventListener("resize", this._onResize);
    this._resize();
    this._bindPointer();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  onFreq(fn) { this._cbFreq = fn; }
  onProgress(fn) { this._cbProg = fn; }
  onLock(fn) { this._cbLock = fn; }
  /** fn() → 0..1 music level; stars breathe with it. */
  setAudioLevel(fn) { this._audioFn = fn; }
  /** Where the dial is right now. */
  currentFreq() { return freqAt(this.you.x, this.w); }
  /** A signal arriving somewhere out there (normalized coords optional). */
  addPulse(nx = Math.random(), ny = Math.random()) {
    this.pulses.push({ x: nx, y: ny, age: 0 });
    if (this.pulses.length > 8) this.pulses.shift();
  }

  setConfig(patch) {
    Object.assign(this.config, patch || {});
    // if stranger count changed mid-tuning, rebuild keeping met one if locked
    if (this.mode === "tuning" && patch && typeof patch.strangerCount === "number") {
      this._spawnStrangers();
    }
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.dust.length) this._spawnDust();
    if (this.you.x === 0) { this.you.x = this.you.tx = this.w / 2; this.you.y = this.you.ty = this.h / 2; }
  }

  _spawnDust() {
    const n = 90;
    this.dust = [];
    const rnd = mulberry32(99);
    for (let i = 0; i < n; i++) {
      this.dust.push({
        x: rnd() * 1, y: rnd() * 1, // normalized
        r: 0.4 + rnd() * 1.3,
        a: 0.12 + rnd() * 0.4,
        tw: rnd() * TAU, // twinkle phase
      });
    }
  }

  _bindPointer() {
    const move = (clientX, clientY, pointerType) => {
      const r = this.canvas.getBoundingClientRect();
      const offY = pointerType === "touch" ? TOUCH_OFFSET_Y : 0;
      this.you.tx = clamp(clientX - r.left, 18, this.w - 18);
      this.you.ty = clamp(clientY - r.top - offY, 18, this.h - 18);
      this._pointerInside = true;
    };
    this.canvas.addEventListener("pointermove", (e) => move(e.clientX, e.clientY, e.pointerType));
    this.canvas.addEventListener("pointerdown", (e) => move(e.clientX, e.clientY, e.pointerType));
    this.canvas.addEventListener("pointerleave", () => { this._pointerInside = false; });
    // touch has no hover: lifting the finger means the signal is no longer held
    this.canvas.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") this._pointerInside = false;
    });
  }

  // ---- modes ----
  /** meta[i] = { fade: 0..1 } — 1 is a fresh signal, lower is older/fainter
   *  (drawn dimmer, and the lock radius shrinks so it takes steadier tuning). */
  startTuning(seed, meta = []) {
    this.mode = "tuning";
    this.lockProgress = 0;
    this.lockedStranger = null;
    this.nearest = null;
    this.cam.scale = this.cam.tScale = 1;
    this._seed = seed || 1;
    this._meta = meta;
    this.trail = [];
    this.pulses = [];
    this._spawnStrangers();
  }

  _spawnStrangers() {
    this.strangers = spawnStrangers(this._seed, this.config.strangerCount, this.w, this.h);
    for (const s of this.strangers) {
      const fade = this._meta[s.id]?.fade;
      s.fade = typeof fade === "number" ? clamp(fade, 0.3, 1) : 1;
    }
    return this.strangers.length;
  }

  confirmLock() {
    // called by React after the reveal handshake; freezes state
    this.mode = "locked";
  }

  enterConstellation() {
    this.mode = "constellation";
    this.cam.tScale = 0.62;
    // build a dense web of faint stars
    const rnd = mulberry32(((this._seed || 1) ^ 0x9e3779b9) >>> 0);
    const n = 130;
    this.constStars = [];
    for (let i = 0; i < n; i++) {
      this.constStars.push({
        x: rnd(), y: rnd(),
        r: 0.8 + rnd() * 1.6,
        a: 0.18 + rnd() * 0.5,
        tw: rnd() * TAU,
      });
    }
    // your star + the one you met, placed near center
    this.myStar = { x: 0.5, y: 0.56 };
    this.metStar = this.lockedStranger
      ? { x: 0.5 + 0.13, y: 0.44 }
      : { x: 0.6, y: 0.45 };
  }

  reset() {
    this.mode = "idle";
    this.lockProgress = 0;
    this.lockedStranger = null;
    this.nearest = null;
    this.strangers = [];
    this.constStars = [];
    this.cam.scale = this.cam.tScale = 1;
    this.you.tx = this.w / 2; this.you.ty = this.h / 2;
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize", this._onResize);
  }

  // ---- main loop ----
  _loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.t0) / 1000;
    const ctx = this.ctx;

    // ease your light toward pointer (floaty)
    this.you.x = lerp(this.you.x, this.you.tx, 0.10);
    this.you.y = lerp(this.you.y, this.you.ty, 0.10);

    // magnetic pull: near a stranger, their gravity gently takes over
    if (this.mode === "tuning" && this.nearest) {
      const d = dist(this.you.x, this.you.y, this.nearest.x, this.nearest.y);
      const R = 150;
      if (d < R && d > 0.5) {
        const pull = 0.045 * (1 - d / R);
        this.you.x += (this.nearest.x - this.you.x) * pull;
        this.you.y += (this.nearest.y - this.you.y) * pull;
      }
    }
    this.cam.scale = lerp(this.cam.scale, this.cam.tScale, 0.05);

    // music level for the breathing starfield
    this._audio = this._audioFn ? clamp(this._audioFn(), 0, 1) : 0;

    this._paintBg(ctx, t);
    this._paintDust(ctx, t);

    if (this.mode === "tuning" || this.mode === "locked") {
      this._updateStrangers(t, dt);
      this._updateTrail();
      this._paintPulses(ctx, dt);
      this._paintTrail(ctx);
      this._paintThreadsAndStrangers(ctx, t);
      this._paintYou(ctx, t);
      this._paintWaveform(ctx, t);
    } else if (this.mode === "constellation") {
      this._paintConstellation(ctx, t);
    }

    this._raf = requestAnimationFrame(this._loop);
  }

  _paintBg(ctx, t) {
    const { w, h } = this;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, this.config.bg);
    g.addColorStop(1, this.config.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  _paintDust(ctx, t) {
    const { w, h } = this;
    // stars breathe a little brighter with the music
    const music = 0.85 + 0.5 * (this._audio || 0);
    for (const d of this.dust) {
      const tw = 0.5 + 0.5 * Math.sin(t * 0.8 + d.tw);
      ctx.globalAlpha = clamp(d.a * (0.4 + 0.6 * tw) * music, 0, 1);
      ctx.fillStyle = "#cfd6ff";
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _updateTrail() {
    this.trail.push({ x: this.you.x, y: this.you.y });
    if (this.trail.length > 22) this.trail.shift();
  }

  _paintTrail(ctx) {
    const n = this.trail.length;
    if (n < 2) return;
    for (let i = 0; i < n - 1; i++) {
      const p = this.trail[i];
      const f = i / n; // older → smaller, dimmer
      this._glow(ctx, p.x, p.y, 4 + 12 * f, this.config.you, 0.10 * f * f);
    }
  }

  _paintPulses(ctx, dt) {
    const { w, h } = this;
    for (const p of this.pulses) {
      p.age += dt;
      const f = p.age / 3; // 3s life
      if (f >= 1) continue;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = this.config.them;
      ctx.globalAlpha = (1 - f) * 0.22;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 8 + f * 70, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    this.pulses = this.pulses.filter((p) => p.age / 3 < 1);
  }

  _updateStrangers(t, dt) {
    const m = this.config.motion;
    for (const s of this.strangers) {
      s.x = s.bx + Math.cos(s.phase + t * s.driftS * m) * s.driftR;
      s.y = s.by + Math.sin(s.phase * 1.3 + t * s.driftS * 0.8 * m) * s.driftR;
    }
    // find nearest + advance lock
    if (this.mode === "tuning") {
      let best = null, bd = Infinity;
      for (const s of this.strangers) {
        const d = dist(this.you.x, this.you.y, s.x, s.y);
        if (d < bd) { bd = d; best = s; }
      }
      this.nearest = best;
      // older signals are harder to hold: their lock radius shrinks
      const lockR = best ? LOCK_R * (0.7 + 0.3 * (best.fade ?? 1)) : LOCK_R;
      const near = best && bd < lockR && this._pointerInside;
      this.lockProgress = stepLockProgress(this.lockProgress, near, dt);
      this._near = near;
      this._nearDist = bd;
      if (this._cbProg) this._cbProg(this.lockProgress, near, best);
      if (this._cbFreq) this._cbFreq(freqAt(this.you.x, this.w), this.lockProgress);
      if (this.lockProgress >= 1 && !this.lockedStranger) {
        this.lockedStranger = best;
        if (this._cbLock) this._cbLock(best);
      }
    }
  }

  _glow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _paintThreadsAndStrangers(ctx, t) {
    const locked = this.lockedStranger;
    for (const s of this.strangers) {
      const isLockedOne = locked && s.id === locked.id;
      // signal decay: older messages glow fainter
      const age = isLockedOne ? 1 : (0.45 + 0.55 * (s.fade ?? 1));
      const dimmed = (locked && !isLockedOne ? 0.18 : 1) * age;
      const tw = 0.6 + 0.4 * Math.sin(t * 1.4 + s.twinkle);
      // halo
      this._glow(ctx, s.x, s.y, 34, this.config.them, 0.22 * dimmed * tw);
      // core
      ctx.save();
      ctx.globalAlpha = (isLockedOne ? 1 : 0.85) * dimmed;
      ctx.fillStyle = this.config.them;
      ctx.beginPath();
      ctx.arc(s.x, s.y, isLockedOne ? 4.5 : 2.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // thread to nearest while tuning, or solid to locked
    const target = locked || (this._near ? this.nearest : null);
    if (target) {
      const p = locked ? 1 : this.lockProgress;
      this._drawThread(ctx, this.you.x, this.you.y, target.x, target.y, p, t);
      // lock ring around target
      if (!locked && p > 0.02) {
        ctx.save();
        ctx.strokeStyle = this.config.thread;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(target.x, target.y, 16, -Math.PI / 2, -Math.PI / 2 + TAU * p);
        ctx.stroke();
        ctx.restore();
      }
      if (locked) {
        this._glow(ctx, target.x, target.y, 60, this.config.thread, 0.5);
      }
    }
  }

  _drawThread(ctx, x1, y1, x2, y2, p, t) {
    const segs = 26;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = this.config.thread;
    ctx.globalAlpha = 0.25 + 0.6 * p;
    ctx.lineWidth = 0.8 + 1.4 * p;
    ctx.beginPath();
    const jitter = (1 - p) * 7;
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const x = lerp(x1, x2, f);
      const y = lerp(y1, y2, f);
      const n = Math.sin(f * 14 + t * 6) * jitter * Math.sin(f * Math.PI);
      const nx = -(y2 - y1), ny = (x2 - x1);
      const len = Math.hypot(nx, ny) || 1;
      const px = x + (nx / len) * n;
      const py = y + (ny / len) * n;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  _paintYou(ctx, t) {
    const x = this.you.x, y = this.you.y;
    const pulse = 1 + 0.06 * Math.sin(t * 2.2);
    const reach = this._near ? 1 + this.lockProgress * 0.5 : 1;
    this._glow(ctx, x, y, 40 * pulse * reach, this.config.you, 0.55);
    this._glow(ctx, x, y, 16, this.config.you, 0.8);
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _paintWaveform(ctx, t) {
    const { w, h } = this;
    const baseY = h - 46;
    const clean = this.mode === "locked" ? 1 : this.lockProgress;
    const amp = 9 + clean * 16;
    const N = Math.floor(w / 4);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = clean > 0.5 ? this.config.thread : this.config.them;
    ctx.globalAlpha = 0.35 + clean * 0.45;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * w;
      const f = i / N;
      const sine = Math.sin(f * 26 + t * 3) * amp;
      const noise = (Math.sin(f * 220 + t * 30) + Math.sin(f * 91 - t * 17)) * (1 - clean) * 9;
      const env = Math.sin(f * Math.PI); // fade at edges
      const y = baseY + (sine * clean + noise) * env;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _paintConstellation(ctx, t) {
    const { w, h } = this;
    const cx = w / 2, cy = h / 2;
    const sc = this.cam.scale;
    const map = (nx, ny) => [cx + (nx * w - cx) * sc, cy + (ny * h - cy) * sc];

    // faint web: connect near neighbours
    ctx.save();
    ctx.strokeStyle = this.config.them;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < this.constStars.length; i++) {
      const a = this.constStars[i];
      const [ax, ay] = map(a.x, a.y);
      for (let j = i + 1; j < this.constStars.length; j++) {
        const b = this.constStars[j];
        const [bx, by] = map(b.x, b.y);
        const d = Math.hypot(ax - bx, ay - by);
        if (d < 96) {
          ctx.globalAlpha = (1 - d / 96) * 0.10;
          ctx.beginPath();
          ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    for (const s of this.constStars) {
      const [x, y] = map(s.x, s.y);
      const tw = 0.5 + 0.5 * Math.sin(t * 1.2 + s.tw);
      ctx.globalAlpha = s.a * (0.4 + 0.6 * tw);
      ctx.fillStyle = "#cfe0ff";
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // thread between you and the met star
    if (this.myStar && this.metStar) {
      const [mx, my] = map(this.myStar.x, this.myStar.y);
      const [ex, ey] = map(this.metStar.x, this.metStar.y);
      this._drawThread(ctx, mx, my, ex, ey, 1, t);
      // met star (cool)
      this._glow(ctx, ex, ey, 30, this.config.them, 0.7);
      ctx.fillStyle = this.config.them;
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, TAU); ctx.fill();
      // your star (warm), pulsing
      const pulse = 1 + 0.12 * Math.sin(t * 2.4);
      this._glow(ctx, mx, my, 40 * pulse, this.config.you, 0.8);
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(mx, my, 3.6, 0, TAU); ctx.fill();
    }
  }
}
