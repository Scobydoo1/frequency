/* FREQUENCY — the radio you're tuning.
 *
 * Two layers, mixed for calm:
 *  1. Music — a CC0 lofi loop ("Chill lofi inspired" by omfgdude, seamless loop
 *     edit by qubodup, opengameart.org) played through a warm lowpass. OGG where
 *     supported, MP3 fallback (iOS). It ducks gently while a lock charges, like
 *     the room going quiet when something matters.
 *  2. Diegetic synth — a faint drone, band-limited static that cleans into a
 *     carrier tone as you lock on, and a soft two-note chime on connection.
 *
 * Everything is gated behind a user gesture (autoplay policy) and a persisted
 * mute toggle.
 */
const MUTE_KEY = "frequency.muted.v1";

const MUSIC_BASE = 0.32;   // resting music level
const MUSIC_DUCKED = 0.18; // while a lock is charging

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

    // low drone: two detuned sines — barely-there now the music carries the mood
    this.drone = this.ctx.createGain();
    this.drone.gain.value = 0.022;
    this.drone.connect(this.master);
    for (const f of [55, 55.4, 110]) {
      const o = this.ctx.createOscillator();
      o.type = "sine"; o.frequency.value = f;
      o.connect(this.drone); o.start();
    }

    // static: white noise → bandpass, gain driven by tuning (softer + darker)
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 0.7;
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

    // lofi music bed through a warm lowpass
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 2600; // mellow, like it's playing in the next room
    this.musicFilter.Q.value = 0.5;
    this.musicFilter.connect(this.musicGain);
    this.musicGain.connect(this.master);
    this._loadMusic();

    this.started = true;
  }

  async _loadMusic() {
    try {
      const probe = document.createElement("audio");
      const ogg = probe.canPlayType('audio/ogg; codecs="vorbis"');
      const url = ogg ? "/audio/lofi-loop.ogg" : "/audio/lofi-loop.mp3";
      const buf = await fetch(url).then((r) => r.arrayBuffer());
      const audio = await this.ctx.decodeAudioData(buf);
      const src = this.ctx.createBufferSource();
      src.buffer = audio;
      src.loop = true;
      if (!ogg) { // hide the mp3 encoder gap at the seam
        src.loopStart = 0.08;
        src.loopEnd = audio.duration - 0.08;
      }
      src.connect(this.musicFilter);
      src.start();
      // slow fade-in so the world arrives gently
      this.musicGain.gain.setTargetAtTime(MUSIC_BASE, this.ctx.currentTime, 2.5);
    } catch { /* no music — the synth radio still plays */ }
  }

  /** progress 0..1, near = within lock radius. */
  tune(progress, near) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const staticLevel = near ? 0.07 * (1 - progress) : 0.028;
    const carrierLevel = near ? 0.06 * progress : 0;
    this.noiseGain.gain.setTargetAtTime(staticLevel, now, 0.15);
    this.carrierGain.gain.setTargetAtTime(carrierLevel, now, 0.15);
    if (this.carrier) this.carrier.frequency.setTargetAtTime(260 + progress * 100, now, 0.25);
    // the music leans back while a connection forms
    if (this.musicGain) {
      const duck = near ? MUSIC_BASE - (MUSIC_BASE - MUSIC_DUCKED) * progress : MUSIC_BASE;
      this.musicGain.gain.setTargetAtTime(duck, now, 0.4);
    }
  }

  silenceStatic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.noiseGain.gain.setTargetAtTime(0, now, 0.3);
    this.carrierGain.gain.setTargetAtTime(0, now, 0.4);
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(MUSIC_BASE, now, 1.2);
  }

  /** soft two-note chime on lock — lower, quieter, slower decay */
  chime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [396, 528].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      o.connect(g); g.connect(this.master);
      const t = now + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.start(t); o.stop(t + 2);
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
