import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { drawZunoFox, type ZunoMood } from '../canvas/ZunoSpriteRenderer';

interface ZunoMascotProps {
  mood: ZunoMood;
  size?: number;
  className?: string;
}

/** A small self-animating canvas hosting Zuno; used in headers, overlays and the Thunder Chimes stage. */
export default function ZunoMascot({ mood, size = 200, className }: ZunoMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef<ZunoMood>(mood);
  moodRef.current = mood;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    let frame = 0;
    const tick = (): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      drawZunoFox(ctx, size / 2, size * 0.54, size * 0.24, moodRef.current, performance.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  return <canvas ref={canvasRef} className={clsx('pointer-events-none shrink-0', className)} aria-hidden="true" />;
}
