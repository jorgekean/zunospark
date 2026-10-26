/* Shared types and helpers for the three ZunoSpark training zones. */

export const TOTAL_TRIALS = 8;

/** Minimum hit-target radius (CSS px) for toddler-sized fingers. */
export const MIN_HIT_RADIUS = 150;

export interface RoundResult {
  /** 0–100: inhibitory-control success rate. */
  waitPowerScore: number;
  /** 0–100: Go / sequence / sync accuracy. */
  popAccuracyScore: number;
  medianReactionMs: number;
  staticPoofCount: number;
  durationMs: number;
  sparksEarned: number;
}

export interface ZoneProps {
  level: number;
  onProgress: (completedTrials: number) => void;
  onFinish: (result: RoundResult) => void;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function percent(numerator: number, denominator: number, fallback = 100): number {
  if (denominator <= 0) return fallback;
  return Math.round((numerator / denominator) * 100);
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------------------------------------------ */
/*  Pointer guard: single-pointer + palm rejection                     */
/* ------------------------------------------------------------------ */

export interface PointerLike {
  pointerId: number;
  isPrimary: boolean;
  pointerType: string;
  width: number;
  height: number;
}

export interface PointerGuard {
  /** Returns true when the pointer should be processed. */
  down: (event: PointerLike) => boolean;
  up: (event: { pointerId: number }) => void;
  reset: () => void;
}

const PALM_CONTACT_SIZE = 80;
const STALE_POINTER_MS = 4000;

/**
 * Accepts at most `maxPointers` simultaneous pointers. Large touch contact
 * areas (a resting palm) and extra fingers are rejected, so a toddler
 * slapping the tablet with a whole hand registers as one clean tap at most.
 */
export function createPointerGuard(maxPointers = 1): PointerGuard {
  const active = new Map<number, number>();

  return {
    down(event) {
      const now = performance.now();
      for (const [id, startedAt] of active) {
        if (now - startedAt > STALE_POINTER_MS) active.delete(id);
      }
      if (event.pointerType === 'touch' && event.width > PALM_CONTACT_SIZE && event.height > PALM_CONTACT_SIZE) {
        return false;
      }
      if (maxPointers === 1 && !event.isPrimary) return false;
      if (active.size >= maxPointers) return false;
      active.set(event.pointerId, now);
      return true;
    },
    up(event) {
      active.delete(event.pointerId);
    },
    reset() {
      active.clear();
    },
  };
}
