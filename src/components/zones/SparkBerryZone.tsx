import { useEffect, useRef, useState } from 'react';
import { zunoAudio } from '../../audio/ZunoSynth';
import {
  ZUNO_PALETTE,
  createStars,
  drawForestGround,
  drawFullMoon,
  drawNightSky,
  drawSparkBerryBush,
  drawStarfield,
  drawStaticBug,
  drawZunoFox,
  hexToRgba,
  type ZunoMood,
} from '../../canvas/ZunoSpriteRenderer';
import {
  MIN_HIT_RADIUS,
  TOTAL_TRIALS,
  clamp,
  createPointerGuard,
  median,
  percent,
  randomBetween,
  shuffle,
  type ZoneProps,
} from './shared';

type Visual = 'awake' | 'asleep';
type Phase = 'anticipate' | 'stimulus' | 'feedback' | 'premature' | 'done';
type Outcome = 'pop_hit' | 'pop_miss' | 'pause_hold' | 'pause_poof';

interface Trial {
  visual: Visual;
  moon: boolean;
  /** Whether the child must tap (Go) or hold still (No-Go) on this trial. */
  needsTap: boolean;
}

/**
 * Level 1: 6 Pop / 2 Pause (≈70/30). Level 2: 5 / 3 (≈60/40).
 * Level 3: 5 / 3, with 3 Full Moon trials where the rule flips.
 */
function buildTrials(level: number): Trial[] {
  const popCount = level === 1 ? 6 : 5;
  const actions = shuffle<boolean>([
    ...Array.from({ length: popCount }, () => true),
    ...Array.from({ length: TOTAL_TRIALS - popCount }, () => false),
  ]);

  let moons: boolean[] = Array.from({ length: TOTAL_TRIALS }, () => false);
  if (level === 3) {
    moons = shuffle<boolean>([true, true, true, false, false, false, false, false]);
    if (moons[0]) {
      const swapWith = moons.findIndex((m) => !m);
      moons[0] = false;
      moons[swapWith] = true;
    }
  }

  return actions.map((needsTap, i) => ({
    needsTap,
    moon: moons[i],
    // Normal rule: awake = POP, asleep = PAUSE. Full Moon flips it.
    visual: needsTap !== moons[i] ? 'awake' : 'asleep',
  }));
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

interface Ripple {
  x: number;
  y: number;
  t0: number;
  color: string;
}

export default function SparkBerryZone({ level, onProgress, onFinish }: ZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(onProgress);
  const finishRef = useRef(onFinish);
  progressRef.current = onProgress;
  finishRef.current = onFinish;
  const [banner, setBanner] = useState('Watch the bush…');

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const trials = buildTrials(level);
    const windowMs = level === 1 ? 1750 : 1450;
    const stars = createStars(80);
    const popTrials = trials.filter((t) => t.needsTap).length;
    const pauseTrials = trials.length - popTrials;

    let w = 1;
    let h = 1;
    let dpr = 1;
    const resize = (): void => {
      const rect = container.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    /* ------------------------------ state ------------------------------ */
    const startTime = performance.now();
    let phase: Phase = 'anticipate';
    let phaseStart = startTime;
    let phaseDur = randomBetween(900, 1550) + 600;
    let idx = 0;
    let stimStart = 0;
    let feedbackMood: ZunoMood = 'HAPPY_LEAP';
    let feedbackText = '';
    let feedbackColor: string = ZUNO_PALETTE.gold;
    let moonBlend = 0;
    let bannerText = 'Watch the bush…';
    let bugHiddenUntil = 0;

    const reactions: number[] = [];
    let popHits = 0;
    let pauseHolds = 0;
    let poofs = 0;
    let sparks = 0;
    const ripples: Ripple[] = [];

    const setBannerText = (text: string): void => {
      if (text !== bannerText) {
        bannerText = text;
        setBanner(text);
      }
    };

    const layout = () => {
      const m = Math.min(w, h);
      const r = m * 0.17;
      const groundY = h * 0.86;
      const bw = Math.min(w * 0.55, h * 0.7);
      const bushTop = groundY - bw * 0.5;
      return { r, groundY, bw, bushTop, zx: w / 2, zy: bushTop - r * 0.5, hit: Math.max(MIN_HIT_RADIUS, r * 1.7) };
    };

    const bugPosition = (now: number) => {
      const u = (now * 0.00014) % 2;
      const frac = u < 1 ? u : 2 - u;
      return {
        x: -w * 0.05 + frac * w * 1.1,
        y: h * 0.3 + Math.sin(now * 0.0035) * h * 0.1,
        size: Math.max(22, Math.min(w, h) * 0.045),
      };
    };

    /* ------------------------- state transitions ------------------------ */
    const startAnticipation = (now: number, extra = 0): void => {
      phase = 'anticipate';
      phaseStart = now;
      phaseDur = randomBetween(900, 1550) + extra;
      const next = trials[idx];
      setBannerText(level === 3 && next.moon ? '🌕 Full Moon night!' : 'Watch the bush…');
    };

    const startStimulus = (now: number): void => {
      const trial = trials[idx];
      phase = 'stimulus';
      phaseStart = now;
      stimStart = now;
      if (trial.visual === 'awake') zunoAudio.playPopCue();
      else zunoAudio.playPauseCue();
      if (level === 3 && trial.moon) setBannerText('🌕 Full Moon! The rules flip!');
      else setBannerText(trial.needsTap ? 'Zuno is awake — tap him!' : 'Zuno is sleeping — hands off!');
    };

    const resolve = (outcome: Outcome, now: number): void => {
      switch (outcome) {
        case 'pop_hit':
          popHits += 1;
          sparks += 1;
          reactions.push(now - stimStart);
          feedbackMood = 'HAPPY_LEAP';
          feedbackText = '+1 Spark!';
          feedbackColor = ZUNO_PALETTE.cyan;
          zunoAudio.playPopWin();
          break;
        case 'pop_miss':
          feedbackMood = 'AWAKE_POP';
          feedbackText = 'Zuno was waiting for you!';
          feedbackColor = ZUNO_PALETTE.lavender;
          zunoAudio.playSoftMiss();
          break;
        case 'pause_hold':
          pauseHolds += 1;
          sparks += 2;
          feedbackMood = 'HAPPY_LEAP';
          feedbackText = '+2 Wait-Power Sparks!';
          feedbackColor = ZUNO_PALETTE.gold;
          zunoAudio.playWaitPowerWin();
          break;
        case 'pause_poof':
          poofs += 1;
          feedbackMood = 'STATIC_POOF';
          feedbackText = 'Static Poof! Wait-Power needed!';
          feedbackColor = ZUNO_PALETTE.coral;
          zunoAudio.playStaticPoof();
          break;
        default:
          break;
      }
      phase = 'feedback';
      phaseStart = now;
      phaseDur = 1150;
      setBannerText(outcome === 'pause_poof' ? 'Oops — a funny Static Poof!' : 'Nice one!');
      progressRef.current(idx + 1);
    };

    const triggerPremature = (now: number): void => {
      poofs += 1;
      phase = 'premature';
      phaseStart = now;
      phaseDur = 900;
      feedbackMood = 'STATIC_POOF';
      feedbackText = 'Static Poof! Wait for Zuno!';
      feedbackColor = ZUNO_PALETTE.coral;
      zunoAudio.playStaticPoof();
      setBannerText('Too early! Wait for Zuno to pop out.');
    };

    const advance = (now: number): void => {
      idx += 1;
      if (idx >= trials.length) {
        phase = 'done';
        feedbackMood = 'HAPPY_LEAP';
        setBannerText('All done! Great Wait-Power!');
        finishRef.current({
          waitPowerScore: percent(pauseHolds, pauseTrials),
          popAccuracyScore: percent(popHits, popTrials),
          medianReactionMs: Math.round(median(reactions)),
          staticPoofCount: poofs,
          durationMs: Math.round(now - startTime),
          sparksEarned: sparks,
        });
        return;
      }
      startAnticipation(now);
    };

    /* ------------------------------ input ------------------------------- */
    const guard = createPointerGuard(1);

    const handleTap = (x: number, y: number, now: number): void => {
      if (phase === 'feedback' || phase === 'premature' || phase === 'done') return;
      const L = layout();
      const bugActive = level === 2 && now >= bugHiddenUntil;
      const bug = bugActive ? bugPosition(now) : null;
      const nearBug = bug ? Math.hypot(x - bug.x, y - bug.y) <= bug.size * 1.8 : false;

      if (phase === 'anticipate') {
        if (nearBug) bugHiddenUntil = now + 1200;
        triggerPremature(now);
        return;
      }

      const trial = trials[idx];
      if (trial.needsTap) {
        if (Math.hypot(x - L.zx, y - L.zy) <= L.hit) {
          resolve('pop_hit', now);
        } else if (nearBug) {
          poofs += 1;
          bugHiddenUntil = now + 1200;
          zunoAudio.playStaticPoof();
          setBannerText('Ignore the golden Static-Bug!');
        }
      } else {
        resolve('pause_poof', now);
      }
    };

    const onDown = (event: PointerEvent): void => {
      event.preventDefault();
      if (!guard.down(event)) return;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* best effort */
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const now = performance.now();
      ripples.push({ x, y, t0: now, color: ZUNO_PALETTE.lavender });
      handleTap(x, y, now);
    };
    const onRelease = (event: PointerEvent): void => guard.up(event);

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointerup', onRelease);
    canvas.addEventListener('pointercancel', onRelease);
    canvas.addEventListener('lostpointercapture', onRelease);

    /* ------------------------------ update ------------------------------ */
    const update = (now: number): void => {
      const elapsed = now - phaseStart;
      if (phase === 'anticipate' && elapsed >= phaseDur) startStimulus(now);
      else if (phase === 'stimulus' && elapsed >= windowMs) {
        resolve(trials[idx].needsTap ? 'pop_miss' : 'pause_hold', now);
      } else if (phase === 'feedback' && elapsed >= phaseDur) advance(now);
      else if (phase === 'premature' && elapsed >= phaseDur) startAnticipation(now, 350);
    };

    /* ------------------------------ render ------------------------------ */
    const drawText = (text: string, x: number, y: number, size: number, color: string, alpha = 1): void => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
      ctx.lineWidth = Math.max(3, size * 0.14);
      ctx.strokeStyle = 'rgba(15, 10, 44, 0.85)';
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.35;
      ctx.fillText(text, x, y);
      ctx.restore();
    };

    const render = (now: number): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const L = layout();
      const trial = trials[Math.min(idx, trials.length - 1)];

      const moonTarget = level === 3 && trial.moon && phase !== 'done' ? 1 : 0;
      moonBlend += (moonTarget - moonBlend) * 0.08;

      drawNightSky(ctx, w, h, moonBlend);
      drawStarfield(ctx, w, h, stars, now);
      if (moonBlend > 0.02) drawFullMoon(ctx, w * 0.84, h * 0.2, Math.min(w, h) * 0.085, now, moonBlend);
      drawForestGround(ctx, w, h, L.groundY, now);

      // Zuno pop-up amount (0 = hidden behind the bush, 1 = fully out).
      let pop = 0;
      let mood: ZunoMood = 'AWAKE_POP';
      const elapsed = now - phaseStart;
      if (phase === 'stimulus') {
        pop = clamp(elapsed / 180, 0, 1);
        mood = trial.visual === 'awake' ? 'AWAKE_POP' : 'SLEEP_PAUSE';
      } else if (phase === 'feedback' || phase === 'premature') {
        pop = 1 - clamp((elapsed - (phaseDur - 260)) / 260, 0, 1);
        mood = feedbackMood;
      } else if (phase === 'done') {
        pop = 1;
        mood = 'HAPPY_LEAP';
      }

      if (pop > 0.01) {
        const eased = pop >= 1 ? 1 : easeOutBack(pop);
        const offset = (1 - eased) * L.r * 2.4;
        drawZunoFox(ctx, L.zx, L.zy + offset, L.r, mood, now);
      }

      const rustle = phase === 'anticipate' ? 1 : phase === 'stimulus' && elapsed < 180 ? 1 : 0.15;
      drawSparkBerryBush(ctx, w / 2, L.groundY, L.bw, now, rustle);

      // Countdown ring: its colour and style shift on Full Moon trials.
      if (phase === 'stimulus') {
        const remaining = clamp(1 - elapsed / windowMs, 0, 1);
        const moonRule = level === 3 && trial.moon;
        const ringColor = moonRule ? '#fef3c7' : trial.needsTap ? ZUNO_PALETTE.cyan : ZUNO_PALETTE.gold;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = moonRule ? 12 : 8;
        ctx.strokeStyle = hexToRgba(ringColor, 0.9);
        ctx.shadowColor = ringColor;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(L.zx, L.zy, L.r * 1.75, -Math.PI / 2, -Math.PI / 2 + remaining * Math.PI * 2);
        ctx.stroke();
        if (moonRule) {
          ctx.setLineDash([10, 16]);
          ctx.lineDashOffset = -now * 0.04;
          ctx.lineWidth = 4;
          ctx.strokeStyle = hexToRgba('#bfdbfe', 0.8);
          ctx.beginPath();
          ctx.arc(L.zx, L.zy, L.r * 2.0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        const labelY = L.groundY + (h - L.groundY) * 0.55;
        const fs = clamp(Math.min(w, h) * 0.085, 26, 64);
        if (moonRule) drawText('🌕 Rules flip!', w / 2, labelY, fs * 0.85, '#fef3c7');
        else drawText(trial.needsTap ? 'POP!' : 'PAUSE!', w / 2, labelY, fs, trial.needsTap ? ZUNO_PALETTE.cyan : ZUNO_PALETTE.gold);
      }

      if ((phase === 'feedback' || phase === 'premature') && feedbackText) {
        const alpha = clamp(1 - (elapsed - (phaseDur - 350)) / 350, 0, 1);
        const rise = clamp(elapsed / 300, 0, 1) * 14;
        drawText(feedbackText, w / 2, Math.max(52, L.zy - L.r * 2.05) - rise, clamp(Math.min(w, h) * 0.055, 20, 40), feedbackColor, alpha);
      }

      if (level === 2 && now >= bugHiddenUntil && phase !== 'done') {
        const bug = bugPosition(now);
        drawStaticBug(ctx, bug.x, bug.y, bug.size, now);
      }

      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const rp = ripples[i];
        const age = (now - rp.t0) / 450;
        if (age >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.strokeStyle = hexToRgba(rp.color, 0.6 * (1 - age));
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 14 + age * 70, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    };

    let disposed = false;
    let raf = 0;
    const tick = (): void => {
      if (disposed) return;
      const now = performance.now();
      update(now);
      render(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onRelease);
      canvas.removeEventListener('pointercancel', onRelease);
      canvas.removeEventListener('lostpointercapture', onRelease);
    };
  }, [level]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Spark Berry Bush game" />
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
        <p className="glass-card rounded-full px-6 py-2 text-center text-lg font-semibold text-zuno-lavender md:text-xl" aria-live="polite">
          {banner}
        </p>
      </div>
    </div>
  );
}
