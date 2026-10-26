import { create } from 'zustand';
import type { ExplorerProfile, ZoneId } from '../db/zunoDb';
import { zunoAudio } from '../audio/ZunoSynth';

/** Rounds allowed before Zuno curls up for the Cozy Cool-Down. */
export const COZY_ROUND_LIMIT = 3;

const COZY_STORAGE_KEY = 'zunospark.cozy.v1';
const MUTE_STORAGE_KEY = 'zunospark.muted.v1';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable (private mode); the in-memory state still works */
  }
}

/** The cool-down survives page refreshes (so it cannot be bypassed by reloading) and resets each new day. */
function loadCozyCount(): number {
  const raw = readStorage(COZY_STORAGE_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { count?: number; day?: string };
    if (parsed.day !== todayKey()) return 0;
    return typeof parsed.count === 'number' ? Math.max(0, parsed.count) : 0;
  } catch {
    return 0;
  }
}

function persistCozyCount(count: number): void {
  writeStorage(COZY_STORAGE_KEY, JSON.stringify({ count, day: todayKey() }));
}

function loadMuted(): boolean {
  return readStorage(MUTE_STORAGE_KEY) === '1';
}

interface ZunoState {
  activeExplorer: ExplorerProfile | null;
  activeZone: ZoneId | null;
  activeLevel: number;
  muted: boolean;
  cozyRoundCount: number;
  showParentDashboard: boolean;

  switchExplorer: (explorer: ExplorerProfile | null) => void;
  startZone: (zone: ZoneId, level: number) => void;
  exitZone: () => void;
  completeRound: () => void;
  resetCooldown: () => void;
  toggleParentDashboard: (force?: boolean) => void;
  toggleMuted: () => void;
}

const initialMuted = typeof window === 'undefined' ? false : loadMuted();
zunoAudio.setMuted(initialMuted);

export const useZunoStore = create<ZunoState>((set, get) => ({
  activeExplorer: null,
  activeZone: null,
  activeLevel: 1,
  muted: initialMuted,
  cozyRoundCount: typeof window === 'undefined' ? 0 : loadCozyCount(),
  showParentDashboard: false,

  switchExplorer: (explorer) => set({ activeExplorer: explorer, activeZone: null }),

  startZone: (zone, level) => {
    if (get().cozyRoundCount >= COZY_ROUND_LIMIT) return;
    set({ activeZone: zone, activeLevel: level });
  },

  exitZone: () => set({ activeZone: null }),

  completeRound: () => {
    const next = get().cozyRoundCount + 1;
    persistCozyCount(next);
    set({ cozyRoundCount: next });
  },

  resetCooldown: () => {
    persistCozyCount(0);
    set({ cozyRoundCount: 0, activeZone: null });
  },

  toggleParentDashboard: (force) =>
    set((state) => ({ showParentDashboard: typeof force === 'boolean' ? force : !state.showParentDashboard })),

  toggleMuted: () => {
    const muted = !get().muted;
    zunoAudio.setMuted(muted);
    writeStorage(MUTE_STORAGE_KEY, muted ? '1' : '0');
    set({ muted });
  },
}));
