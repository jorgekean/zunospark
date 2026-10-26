import { useEffect, useRef, useState } from 'react';
import { zunoAudio } from '../../audio/ZunoSynth';
import {
  ZUNO_PALETTE,
  createStars,
  drawEnergyOrb,
  drawNightSky,
  drawStarfield,
  drawZunoFox,
  hexToRgba,
  type ZunoMood,
} from '../../canvas/ZunoSpriteRenderer';
import { TOTAL_TRIALS, clamp, createPointerGuard, median, percent, type ZoneProps } from './shared';

type Side = 'left' | 'right';

const SYNC_LIMIT = 0.2; // one hand pulling ahead by >20% dims the bridge
const RECOVER_LIMIT = 0.12;
const LEFT_COLOR = '#b45cff';
const RIGHT_COLOR = ZUNO_PALETTE.cyan;
const DEFAULT_PROMPT = 'Slide both fingers down together!';
const AHEAD_PROMPT = 'Keep both hands moving at the same calm speed!';

interface Controls {
  setProgress: (side: Side, value: number) => void;
}

export default function TwinCurrentsZone({ level, onProgress, onFinish }: ZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const progressRef = useRef(onProgress);
  const finishRef = useRef(onFinish);
  progressRef.current = onProgress;
  finishRef.current = onFinish;

  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [ahead, setAhead] = useState(false);
  const [sliders, setSliders] = useState<{ left: number; right: number }>({ left: 0, right: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const stars = createStars(60);
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

    /* ------------------------------ geometry ----------------------------- */
    const top = (): number => h * 0.12;
    const bottom = (): number => h * 0.76;
    const pathY = (p: number): number => top() + (bottom() - top()) * p;
    const pathX = (side: Side, p: number): number => {
      const sign = side === 'left' ? -1 : 1;
      const mid = w / 2;
      if (level === 1) return mid + sign * w * 0.22; // straight parallel streams
      if (level === 2) return mid + sign * w * 0.22 + Math.sin(p * Math.PI * 2) * w * 0.07; // gentle S-curves
      return mid + sign * w * (0.1 + 0.24 * p); // mirror diverging streams
    };

    /* -------------------------------- state ------------------------------ */
    const target: Record<Side, number> = { left: 0, right: 0 };
    const shown: Record<Side, number> = { left: 0, right: 0 };
    const startTime = performance.now();
    let lastFrame = startTime;
    let lastUiPush = 0;
    let pushedLeft = 0;
    let pushedRight = 0;
    let isAhead = false;
    let bridgeAlpha = 1;
    let activeMs = 0;
    let aheadMs = 0;
    let poofs = 0;
    let nextCheckpoint = 0;
    let lastCheckpointAt = startTime;
    const checkpointSync: boolean[] = [];
    const segmentTimes: number[] = [];
    let finished = false;
    let finishAt = 0;
    let reported = false;

    const pointers = new Map<number, { side: Side; lastY: number }>();
    const guard = createPointerGuard(2);

    const sideBusy = (side: Side): boolean => {
      for (const p of pointers.values()) if (p.side === side) return true;
      return false;
    };

    const onDown = (event: PointerEvent): void => {
      event.preventDefault();
      if (finished) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const side: Side = x < w / 2 ? 'left' : 'right';
      if (sideBusy(side)) return;
      if (!guard.down(event)) return;
      pointers.set(event.pointerId, { side, lastY: y });
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* best effort */
      }
    };

    const onMove = (event: PointerEvent): void => {
      const record = pointers.get(event.pointerId);
      if (!record || finished) return;
      const rect = canvas.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const dy = y - record.lastY;
      record.lastY = y;
      if (dy > 0) {
        target[record.side] = clamp(target[record.side] + dy / Math.max(1, bottom() - top()), 0, 1);
      }
    };

    const onRelease = (event: PointerEvent): void => {
      pointers.delete(event.pointerId);
      guard.up(event);
    };

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onRelease);
    canvas.addEventListener('pointercancel', onRelease);
    canvas.addEventListener('lostpointercapture', onRelease);

    controlsRef.current = {
      setProgress: (side, value) => {
        if (finished) return;
        target[side] = clamp(value, 0, 1);
      },
    };

    /* -------------------------------- update ----------------------------- */
    const update = (now: number): void => {
      const dt = Math.min(64, now - lastFrame);
      lastFrame = now;
      const smoothing = 1 - Math.exp(-dt / 70);
      shown.left += (target.left - shown.left) * smoothing;
      shown.right += (target.right - shown.right) * smoothing;

      const pL = target.left;
      const pR = target.right;
      const gap = Math.abs(pL - pR);

      if (!finished && (pL > 0 || pR > 0)) {
        activeMs += dt;
        if (isAhead) aheadMs += dt;
      }

      if (!finished) {
        if (!isAhead && gap > SYNC_LIMIT) {
          isAhead = true;
          poofs += 1;
          zunoAudio.playStaticPoof();
          setAhead(true);
          setPrompt(AHEAD_PROMPT);
        } else if (isAhead && gap < RECOVER_LIMIT) {
          isAhead = false;
          setAhead(false);
          setPrompt(DEFAULT_PROMPT);
        }
      }

      bridgeAlpha += ((isAhead ? 0.2 : 1) - bridgeAlpha) * 0.12;

      const lowest = Math.min(pL, pR);
      while (nextCheckpoint < TOTAL_TRIALS && lowest >= (nextCheckpoint + 1) / TOTAL_TRIALS - 1e-6) {
        checkpointSync.push(gap <= SYNC_LIMIT);
        segmentTimes.push(now - lastCheckpointAt);
        lastCheckpointAt = now;
        zunoAudio.playCrystalNote(nextCheckpoint % 4);
        nextCheckpoint += 1;
        progressRef.current(nextCheckpoint);
      }

      if (!finished && nextCheckpoint >= TOTAL_TRIALS) {
        finished = true;
        finishAt = now;
        isAhead = false;
        setAhead(false);
        setPrompt('Beautiful! The Spark Bridge is glowing!');
        zunoAudio.playWaitPowerWin();
      }

      if (finished && !reported && now - finishAt > 1300) {
        reported = true;
        const syncedCount = checkpointSync.filter(Boolean).length;
        const waitPower = activeMs > 0 ? Math.round(100 * (1 - aheadMs / activeMs)) : 100;
        finishRef.current({
          waitPowerScore: clamp(waitPower, 0, 100),
          popAccuracyScore: percent(syncedCount, TOTAL_TRIALS),
          medianReactionMs: Math.round(median(segmentTimes)),
          staticPoofCount: poofs,
          durationMs: Math.round(now - startTime),
          sparksEarned: syncedCount + (waitPower >= 80 ? 2 : 0),
        });
      }

      if (now - lastUiPush > 60) {
        lastUiPush = now;
        if (Math.abs(pL - pushedLeft) > 0.004 || Math.abs(pR - pushedRight) > 0.004) {
          pushedLeft = pL;
          pushedRight = pR;
          setSliders({ left: pL, right: pR });
        }
      }
    };

    /* -------------------------------- render ----------------------------- */
    const drawTrack = (side: Side, color: string, now: number): void => {
      const steps = 64;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const pass of [0, 1] as const) {
        ctx.beginPath();
        for (let i = 0; i <= steps; i += 1) {
          const p = i / steps;
          const x = pathX(side, p);
          const y = pathY(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        if (pass === 0) {
          ctx.strokeStyle = hexToRgba(color, 0.18);
          ctx.lineWidth = Math.max(26, w * 0.05);
          ctx.stroke();
        } else {
          ctx.setLineDash([2, 22]);
          ctx.lineDashOffset = -now * 0.05;
          ctx.strokeStyle = hexToRgba(color, 0.7);
          ctx.lineWidth = 5;
          ctx.stroke();
        }
      }
      ctx.restore();

      // Checkpoint gems along the stream.
      for (let k = 0; k < TOTAL_TRIALS; k += 1) {
        const p = (k + 1) / TOTAL_TRIALS;
        const x = pathX(side, p);
        const y = pathY(p);
        const passed = k < nextCheckpoint;
        const s = Math.max(9, w * 0.014);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = passed ? ZUNO_PALETTE.gold : 'rgba(233, 213, 255, 0.12)';
        ctx.strokeStyle = passed ? '#ffffff' : hexToRgba(color, 0.7);
        ctx.lineWidth = 2;
        ctx.shadowColor = passed ? ZUNO_PALETTE.gold : color;
        ctx.shadowBlur = passed ? 16 : 0;
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      }
    };

    const drawBridge = (ax: number, ay: number, bx: number, by: number, now: number): void => {
      const segments = 14;
      const seed = Math.floor(now / 60);
      ctx.save();
      ctx.globalAlpha = clamp(bridgeAlpha, 0.12, 1);
      const gradient = ctx.createLinearGradient(ax, ay, bx, by);
      gradient.addColorStop(0, LEFT_COLOR);
      gradient.addColorStop(1, RIGHT_COLOR);
      ctx.strokeStyle = isAhead ? 'rgba(251, 113, 133, 0.9)' : gradient;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = isAhead ? ZUNO_PALETTE.coral : ZUNO_PALETTE.lavender;
      ctx.shadowBlur = 18 * bridgeAlpha;
      ctx.beginPath();
      for (let i = 0; i <= segments; i += 1) {
        const u = i / segments;
        const jitterScale = isAhead ? 4 : 11;
        const jitter = i === 0 || i === segments ? 0 : (Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453 % 1) * jitterScale;
        const x = ax + (bx - ax) * u;
        const y = ay + (by - ay) * u + jitter;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    const render = (now: number): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawNightSky(ctx, w, h, 0);
      drawStarfield(ctx, w, h, stars, now);

      drawTrack('left', LEFT_COLOR, now);
      drawTrack('right', RIGHT_COLOR, now);

      const lx = pathX('left', shown.left);
      const ly = pathY(shown.left);
      const rx = pathX('right', shown.right);
      const ry = pathY(shown.right);
      drawBridge(lx, ly, rx, ry, now);

      const orbR = clamp(Math.min(w, h) * 0.042, 18, 40);
      drawEnergyOrb(ctx, lx, ly, orbR, LEFT_COLOR, now);
      drawEnergyOrb(ctx, rx, ry, orbR, RIGHT_COLOR, now);

      // Zuno waits at the finish and reacts to the pair's rhythm.
      const mood: ZunoMood = finished ? 'HAPPY_LEAP' : isAhead ? 'STATIC_POOF' : 'AWAKE_POP';
      const zr = clamp(Math.min(w, h) * 0.075, 26, 80);
      drawZunoFox(ctx, w / 2, bottom() + (h - bottom()) * 0.52, zr, mood, now);
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
      controlsRef.current = null;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onRelease);
      canvas.removeEventListener('pointercancel', onRelease);
      canvas.removeEventListener('lostpointercapture', onRelease);
    };
  }, [level]);

  const onSlider = (side: Side, raw: string): void => {
    const value = clamp(parseFloat(raw) / 100, 0, 1);
    controlsRef.current?.setProgress(side, value);
    setSliders((current) => ({ ...current, [side]: value }));
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Twin Currents game" />
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
          <p
            className={`glass-card rounded-full px-6 py-2 text-center text-lg font-semibold md:text-xl ${
              ahead ? 'text-zuno-coral' : 'text-zuno-lavender'
            }`}
            aria-live="polite"
          >
            {prompt}
          </p>
        </div>
        <div className="pointer-events-none absolute left-4 top-16 hidden text-sm font-semibold text-[#c084fc] sm:block">
          Left Hand
        </div>
        <div className="pointer-events-none absolute right-4 top-16 hidden text-sm font-semibold text-zuno-cyan sm:block">
          Right Hand
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-4 border-t border-white/10 bg-zuno-night/80 px-4 py-3 md:gap-8 md:px-10">
        <label className="flex flex-col gap-1 text-sm font-semibold text-[#c084fc]">
          Left Hand · Violet Orb
          <input
            id="slider-left-orb"
            className="zuno-range"
            style={{ ['--thumb' as string]: LEFT_COLOR }}
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={Math.round(sliders.left * 200) / 2}
            onChange={(event) => onSlider('left', event.target.value)}
            aria-label="Left hand violet orb progress"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-zuno-cyan">
          Right Hand · Cyan Orb
          <input
            id="slider-right-orb"
            className="zuno-range"
            style={{ ['--thumb' as string]: RIGHT_COLOR }}
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={Math.round(sliders.right * 200) / 2}
            onChange={(event) => onSlider('right', event.target.value)}
            aria-label="Right hand cyan orb progress"
          />
        </label>
      </div>
    </div>
  );
}
