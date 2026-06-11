/* FREQUENCY — the radio you're tuning, mixed like ASMR.
 *
 * Layers, all very quiet and very close:
 *  1. Music — a CC0 lofi loop ("Chill lofi inspired" by omfgdude, seamless loop
 *     edit by qubodup, opengameart.org) through a dark lowpass that drifts
 *     slowly, like someone breathing next to the dial. Ducks while a lock charges.
 *  2. Vinyl crackle — sparse synthesized ticks, panned in a slow circle around
 *     your head.
 *  3. Rain — pink noise through a deep lowpass, swelling and falling on a
 *     ~14-second breath cycle — over a sub-200Hz "warm air" bed (no tonal
 *     drone: pitched oscillators beat and throb; filtered noise doesn't).
 *  4. Diegetic tuning — a whisper of soft static that cleans into a faint
 *     carrier tone as you lock on; a low, slow two-note chime on connection.
 *
 * Everything is gated behind a user gesture (autoplay policy) and a persisted
 * mute toggle. No audio files except the music — every texture is synthesized.
 */
import { nightlyTrack } from "./content.js";

const MUTE_KEY = "frequency.muted.v1";

const MUSIC_BASE = 0.30;   // resting music level
const MUSIC_DUCKED = 0.16; // while a lock is charging
const RAIN_BASE = 0.030;   // pink-noise rain bed
const RAIN_BREATH = 0.016; // breath-cycle swell depth
const CRACKLE_BASE = 0.09; // vinyl ticks (buffer itself is sparse/quiet)

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

  /* ---------- synthesized texture buffers ---------- */

  /** Pink noise (Paul Kellet's economy filter) — soft rain-like base. */
  _pinkBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate * seconds, rate);
    const ch = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < ch.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + 0.029591 * w;
      b1 = 0.985 * b1 + 0.032534 * w;
      b2 = 0.950 * b2 + 0.048056 * w;
      ch[i] = (b0 + b1 + b2 + w * 0.05) * 0.25;
    }
    return buf;
  }

  /** Sparse vinyl crackle: occasional ticks with tiny decay tails. */
  _crackleBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate * seconds, rate);
    const ch = buf.getChannelData(0);
    let i = 0;
    while (i < ch.length) {
      // a tick roughly every 60–400 ms
      i += Math.floor(rate * (0.06 + Math.random() * 0.34));
      if (i >= ch.length) break;
      const amp = (0.25 + Math.random() * 0.75) * (Math.random() < 0.5 ? 1 : -1);
      const tail = 6 + Math.floor(Math.random() * 40);
      for (let k = 0; k < tail && i + k < ch.length; k++) {
        ch[i + k] += amp * Math.exp(-k / (tail * 0.3)) * (Math.random() * 0.6 + 0.4);
      }
    }
    return buf;
  }

  _loopSource(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }

  /** LFO helper: osc(freq) scaled by depth, added onto an AudioParam. */
  _lfo(freq, depth, param) {
    const osc = this.ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = depth;
    osc.connect(g); g.connect(param);
    osc.start();
    return osc;
  }

  /** Call from a user gesture (the "tune in" click) to satisfy autoplay rules. */
  start() {
    if (this.started) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    // master gain (respects mute)
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    // warm air: deep filtered noise instead of a tonal drone — no pitch,
    // no beating, just the feeling of a quiet room (fades in over ~3s)
    this.air = this.ctx.createGain();
    this.air.gain.value = 0;
    const airLp = this.ctx.createBiquadFilter();
    airLp.type = "lowpass"; airLp.frequency.value = 180; airLp.Q.value = 0.3;
    this._loopSource(this._pinkBuffer(5)).connect(airLp);
    airLp.connect(this.air); this.air.connect(this.master);
    this.air.gain.setTargetAtTime(0.020, this.ctx.currentTime, 3);
    this._lfo(1 / 18, 0.007, this.air.gain);

    // rain: pink noise → deep lowpass → breathing gain (~14s cycle)
    const rainLp = this.ctx.createBiquadFilter();
    rainLp.type = "lowpass"; rainLp.frequency.value = 700; rainLp.Q.value = 0.4;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    this.rainGain.gain.setTargetAtTime(RAIN_BASE, this.ctx.currentTime, 2.5);
    this._loopSource(this._pinkBuffer(6)).connect(rainLp);
    rainLp.connect(this.rainGain); this.rainGain.connect(this.master);
    this._lfo(1 / 14, RAIN_BREATH, this.rainGain.gain);

    // vinyl crackle, drifting slowly across the stereo field
    const cracklePan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    this.crackleGain = this.ctx.createGain();
    this.crackleGain.gain.value = 0;
    this.crackleGain.gain.setTargetAtTime(CRACKLE_BASE, this.ctx.currentTime, 3.5);
    const crackleSrc = this._loopSource(this._crackleBuffer(8));
    const crackleLp = this.ctx.createBiquadFilter();
    crackleLp.type = "lowpass"; crackleLp.frequency.value = 2200;
    crackleSrc.connect(crackleLp);
    if (cracklePan) {
      crackleLp.connect(cracklePan); cracklePan.connect(this.crackleGain);
      this._lfo(0.03, 0.6, cracklePan.pan);
    } else {
      crackleLp.connect(this.crackleGain);
    }
    this.crackleGain.connect(this.master);

    // tuning static: a second pink-noise voice, softer and darker than before
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    const staticLp = this.ctx.createBiquadFilter();
    staticLp.type = "lowpass"; staticLp.frequency.value = 1000; staticLp.Q.value = 0.5;
    this._loopSource(this._pinkBuffer(4)).connect(staticLp);
    staticLp.connect(this.noiseGain); this.noiseGain.connect(this.master);

    // carrier tone: clean sine that emerges as you lock on
    this.carrierGain = this.ctx.createGain();
    this.carrierGain.gain.value = 0;
    this.carrierGain.connect(this.master);
    this.carrier = this.ctx.createOscillator();
    this.carrier.type = "sine"; this.carrier.frequency.value = 260;
    this.carrier.connect(this.carrierGain); this.carrier.start();

    // lofi music bed through a dark, slowly-drifting lowpass
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 1700; // darker — playing from another room
    this.musicFilter.Q.value = 0.4;
    this._lfo(0.05, 220, this.musicFilter.frequency); // dreamy slow tone drift
    this.musicFilter.connect(this.musicGain);
    this.musicGain.connect(this.master);
    this._loadMusic();

    this.started = true;
  }

  async _loadMusic() {
    try {
      const track = nightlyTrack();
      this.track = track; // exposed so the UI can show tonight's record
      const probe = document.createElement("audio");
      const canOgg = !!probe.canPlayType('audio/ogg; codecs="vorbis"');
      const useOgg = canOgg && track.ogg;
      const url = useOgg ? track.ogg : track.mp3;
      const buf = await fetch(url).then((r) => r.arrayBuffer());
      const audio = await this.ctx.decodeAudioData(buf);
      const src = this.ctx.createBufferSource();
      src.buffer = audio;
      src.loop = true;
      if (!useOgg) { // hide the mp3 encoder gap at the seam
        src.loopStart = 0.08;
        src.loopEnd = audio.duration - 0.08;
      }
      src.connect(this.musicFilter);
      src.start();
      // very slow fade-in: the world arrives like falling asleep in reverse
      this.musicGain.gain.setTargetAtTime(MUSIC_BASE, this.ctx.currentTime, 4);
    } catch { /* no music — the synth radio still plays */ }
  }

  /** progress 0..1, near = within lock radius. */
  tune(progress, near) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const staticLevel = near ? 0.05 * (1 - progress) : 0.018;
    const carrierLevel = near ? 0.045 * progress : 0;
    this.noiseGain.gain.setTargetAtTime(staticLevel, now, 0.2);
    this.carrierGain.gain.setTargetAtTime(carrierLevel, now, 0.2);
    if (this.carrier) this.carrier.frequency.setTargetAtTime(240 + progress * 80, now, 0.3);
    // the world leans back while a connection forms
    if (this.musicGain) {
      const duck = near ? MUSIC_BASE - (MUSIC_BASE - MUSIC_DUCKED) * progress : MUSIC_BASE;
      this.musicGain.gain.setTargetAtTime(duck, now, 0.5);
    }
    if (this.crackleGain) {
      const duck = near ? CRACKLE_BASE * (1 - 0.5 * progress) : CRACKLE_BASE;
      this.crackleGain.gain.setTargetAtTime(duck, now, 0.5);
    }
  }

  silenceStatic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.noiseGain.gain.setTargetAtTime(0, now, 0.4);
    this.carrierGain.gain.setTargetAtTime(0, now, 0.5);
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(MUSIC_BASE, now, 1.6);
    if (this.crackleGain) this.crackleGain.gain.setTargetAtTime(CRACKLE_BASE, now, 1.6);
  }

  /** the connection chime: two low notes, almost a hum, long slow release */
  chime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [264, 396].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      o.connect(g); g.connect(this.master);
      const t = now + i * 0.22;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.start(t); o.stop(t + 2.8);
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
