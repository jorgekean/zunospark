/* ------------------------------------------------------------------ */
/*  ZunoSynth — 100% procedural Web Audio sound design                 */
/*  No audio files: every cue is built from oscillators + envelopes.   */
/* ------------------------------------------------------------------ */

const NOTE = {
  G3: 196.0,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
  C6: 1046.5,
  D6: 1174.66,
} as const;

/** Pentatonic crystal scale used by Thunder Chimes (C5, D5, E5, G5). */
export const CRYSTAL_NOTES: readonly number[] = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5];

const MASTER_VOLUME = 0.6;

interface ToneOptions {
  freq: number;
  start?: number;
  duration: number;
  type?: OscillatorType;
  peak?: number;
  attack?: number;
  detune?: number;
}

interface AudioTarget {
  ctx: AudioContext;
  out: GainNode;
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

class ZunoAudioEngine {
  private static instance: ZunoAudioEngine | null = null;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unlockBound = false;

  public muted = false;

  static getInstance(): ZunoAudioEngine {
    if (!ZunoAudioEngine.instance) ZunoAudioEngine.instance = new ZunoAudioEngine();
    return ZunoAudioEngine.instance;
  }

  private constructor() {
    this.bindAutoUnlock();
  }

  /** Browsers require a user gesture before audio can start; resume on every gesture (iOS may re-suspend). */
  private bindAutoUnlock(): void {
    if (this.unlockBound || typeof window === 'undefined') return;
    this.unlockBound = true;
    const handler = (): void => this.unlock();
    const options: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('pointerdown', handler, options);
    window.addEventListener('touchend', handler, options);
    window.addEventListener('keydown', handler, options);
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.2;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    }
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.getContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.03);
    }
  }

  private target(): AudioTarget | null {
    if (this.muted) return null;
    const ctx = this.getContext();
    if (!ctx || !this.master) return null;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return { ctx, out: this.master };
  }

  private tone({ ctx, out }: AudioTarget, options: ToneOptions): void {
    const t0 = ctx.currentTime + (options.start ?? 0);
    const attack = options.attack ?? 0.01;
    const peak = options.peak ?? 0.3;
    const end = t0 + options.duration;

    const osc = ctx.createOscillator();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(options.freq, t0);
    if (options.detune) osc.detune.setValueAtTime(options.detune, t0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(out);
    osc.start(t0);
    osc.stop(end + 0.05);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
      const length = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  /** Soft filtered-noise "fur puff" layered under the Static Poof slide. */
  private furPuff({ ctx, out }: AudioTarget, start: number, duration: number, peak: number): void {
    const t0 = ctx.currentTime + start;
    const source = ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t0);
    filter.frequency.exponentialRampToValueAtTime(500, t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(t0);
    source.stop(t0 + duration + 0.05);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  /** Marimba-like strike: sine body + bright, fast-decaying triangle overtone. */
  private marimba(target: AudioTarget, freq: number, start: number, peak: number): void {
    this.tone(target, { freq, start, duration: 0.42, type: 'sine', peak, attack: 0.006 });
    this.tone(target, { freq: freq * 4, start, duration: 0.09, type: 'triangle', peak: peak * 0.22, attack: 0.002 });
  }

  /* ---------------------------- Public cues ---------------------------- */

  /** POP! cue — upbeat D5 → A5 electric marimba ping. */
  playPopCue(): void {
    const target = this.target();
    if (!target) return;
    this.marimba(target, NOTE.D5, 0, 0.3);
    this.marimba(target, NOTE.A5, 0.09, 0.32);
  }

  /** PAUSE cue — warm low G3 + D4 lullaby hum. */
  playPauseCue(): void {
    const target = this.target();
    if (!target) return;
    this.tone(target, { freq: NOTE.G3, duration: 1.5, type: 'sine', peak: 0.22, attack: 0.28 });
    this.tone(target, { freq: NOTE.D4, duration: 1.4, type: 'triangle', peak: 0.12, attack: 0.32, detune: -4 });
    this.tone(target, { freq: NOTE.D4, duration: 1.4, type: 'sine', peak: 0.08, attack: 0.35, detune: 5 });
  }

  /** Successful POP — fast ascending C-major arpeggio. */
  playPopWin(): void {
    const target = this.target();
    if (!target) return;
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((freq, i) => {
      this.tone(target, { freq, start: i * 0.065, duration: 0.3, type: 'triangle', peak: 0.2, attack: 0.008 });
      this.tone(target, { freq: freq * 2, start: i * 0.065, duration: 0.15, type: 'sine', peak: 0.05, attack: 0.004 });
    });
  }

  /** Successful PAUSE — shimmering 5-note golden harp chord (C5 E5 G5 B5 D6). */
  playWaitPowerWin(): void {
    const target = this.target();
    if (!target) return;
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.B5, NOTE.D6].forEach((freq, i) => {
      const start = i * 0.06;
      this.tone(target, { freq, start, duration: 1.7, type: 'sine', peak: 0.14, attack: 0.008 });
      this.tone(target, { freq: freq * 2, start, duration: 0.7, type: 'sine', peak: 0.035, attack: 0.004, detune: 6 });
    });
  }

  /** Trail step — playful pentatonic marimba tap as Zuno hops along the trail. */
  playTrailStep(stepIndex: number): void {
    const target = this.target();
    if (!target) return;
    const scale = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6];
    const freq = scale[Math.abs(stepIndex) % scale.length];
    this.marimba(target, freq, 0, 0.22);
  }

  /** Triumphant unlock cheer when Zuno reaches a new trail spot! */
  playTrailCheer(): void {
    this.playWaitPowerWin();
  }

  /** Static Poof — silly cartoon slide 320Hz → 140Hz → 260Hz. Never a buzzer. */
  playStaticPoof(): void {
    const target = this.target();
    if (!target) return;
    const { ctx, out } = target;
    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t0);
    osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.22);
    osc.frequency.exponentialRampToValueAtTime(260, t0 + 0.46);

    const wobble = ctx.createOscillator();
    wobble.type = 'sine';
    wobble.frequency.setValueAtTime(16, t0);
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.setValueAtTime(12, t0);
    wobble.connect(wobbleDepth);
    wobbleDepth.connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.03);
    gain.gain.setValueAtTime(0.2, t0 + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.56);

    osc.connect(gain);
    gain.connect(out);
    osc.start(t0);
    wobble.start(t0);
    osc.stop(t0 + 0.6);
    wobble.stop(t0 + 0.6);
    osc.onended = () => {
      osc.disconnect();
      wobble.disconnect();
      wobbleDepth.disconnect();
      gain.disconnect();
    };

    this.furPuff(target, 0, 0.18, 0.07);
  }

  /** Thunder Chimes crystal — pentatonic C5, D5, E5, G5 with a glassy shimmer partial. */
  playCrystalNote(index: number): void {
    const target = this.target();
    if (!target) return;
    const safeIndex = ((Math.floor(index) % CRYSTAL_NOTES.length) + CRYSTAL_NOTES.length) % CRYSTAL_NOTES.length;
    const freq = CRYSTAL_NOTES[safeIndex];
    this.tone(target, { freq, duration: 0.95, type: 'sine', peak: 0.26, attack: 0.006 });
    this.tone(target, { freq: freq * 3, duration: 0.4, type: 'sine', peak: 0.05, attack: 0.004, detune: 4 });
    this.tone(target, { freq: freq * 2, duration: 0.6, type: 'triangle', peak: 0.04, attack: 0.004 });
  }

  /** Gentle "almost" tone for memory slips — soft and non-punitive. */
  playSoftMiss(): void {
    const target = this.target();
    if (!target) return;
    this.tone(target, { freq: NOTE.E4, duration: 0.35, type: 'sine', peak: 0.12, attack: 0.02 });
    this.tone(target, { freq: NOTE.C4, start: 0.14, duration: 0.45, type: 'sine', peak: 0.12, attack: 0.02 });
  }

  /** Cozy Cool-Down lullaby — slow descending G4 E4 D4 C4. */
  playCozyLullaby(): void {
    const target = this.target();
    if (!target) return;
    [NOTE.G4, NOTE.E4, NOTE.D4, NOTE.C4].forEach((freq, i) => {
      this.tone(target, { freq, start: i * 0.55, duration: 1.2, type: 'sine', peak: 0.16, attack: 0.12 });
      this.tone(target, { freq: freq / 2, start: i * 0.55, duration: 1.2, type: 'triangle', peak: 0.06, attack: 0.18 });
    });
  }

  /** Tiny UI tick for hub buttons. */
  playTap(): void {
    const target = this.target();
    if (!target) return;
    this.tone(target, { freq: NOTE.G5, duration: 0.12, type: 'sine', peak: 0.12, attack: 0.004 });
  }
}

export type { ZunoAudioEngine };

export const zunoAudio = ZunoAudioEngine.getInstance();
