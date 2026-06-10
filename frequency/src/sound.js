/* FREQUENCY — diegetic radio sound, synthesized with WebAudio (no audio files).
 *
 * A soft drone underpins everything. While tuning, band-limited static fades
 * toward a clean carrier tone as the lock charges; locking on rings a gentle
 * two-note chime. Everything is gated behind a user gesture (autoplay policy)
 * and a persisted mute toggle.
 */
const MUTE_KEY = "frequency.muted.v1";

export class Radio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.muted = this._loadMuted();
    this.nodes = {};
  }

  _loadMuted() {
    try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
  }
  _saveMuted() {
    try { localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0"); } catch { /* ignore */ }
  }

  /** Call from a user gesture (the "tune in" click) to satisfy autoplay rules. */
  start() {
    if (this.started) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const now = this.ctx.currentTime;

    // master gain (respects mute)
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    // low drone: two detuned sines
    this.drone = this.ctx.createGain();
    this.drone.gain.value = 0.06;
    this.drone.connect(this.master);
    for (const f of [55, 55.4, 110]) {
      const o = this.ctx.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      o.connect(this.drone); o.start();
    }

    // static: white noise → bandpass, gain driven by tuning
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.7;
    bp.connect(this.noiseGain); this.noiseGain.connect(this.master);
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true; noise.connect(bp); noise.start();

    // carrier tone: clean sine that emerges as you lock on
    this.carrierGain = this.ctx.createGain();
    this.carrierGain.gain.value = 0;
    this.carrierGain.connect(this.master);
    this.carrier = this.ctx.createOscillator();
    this.carrier.type = "sine"; this.carrier.frequency.value = 320;
    this.carrier.connect(this.carrierGain); this.carrier.start();

    this.started = true;
  }

  /** progress 0..1, near = within lock radius. */
  tune(progress, near) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const staticLevel = near ? 0.12 * (1 - progress) : 0.05;
    const carrierLevel = near ? 0.10 * progress : 0;
    this.noiseGain.gain.setTargetAtTime(staticLevel, now, 0.1);
    this.carrierGain.gain.setTargetAtTime(carrierLevel, now, 0.1);
    if (this.carrier) this.carrier.frequency.setTargetAtTime(280 + progress * 120, now, 0.2);
  }

  silenceStatic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.noiseGain.gain.setTargetAtTime(0, now, 0.3);
    this.carrierGain.gain.setTargetAtTime(0, now, 0.4);
  }

  /** two-note chime on lock */
  chime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [528, 660].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      o.connect(g); g.connect(this.master);
      const t = now + i * 0.14;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.start(t); o.stop(t + 1.2);
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.05);
    this._saveMuted();
    return this.muted;
  }

  isMuted() { return this.muted; }
}
