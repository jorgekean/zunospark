import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import type { ExplorerProfile, ZoneId } from '../db/zunoDb';
import { zunoAudio } from '../audio/ZunoSynth';
import { getNodeConfig } from '../data/zoneNodes';

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

export interface TrailCelebration {
  zoneId: ZoneId;
  fromIndex: number;
  toIndex: number;
  unlockedNodeId: string;
}

function isNativeAndroid(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

function loadIapUnlocked(): boolean {
  // On web/PWA (browsers), all clearings and levels are 100% free!
  if (!isNativeAndroid()) return true;

  try {
    return window.localStorage.getItem('zunospark.iap.unlocked.v1') === '1';
  } catch {
    return false;
  }
}

interface ZunoState {
  activeExplorer: ExplorerProfile | null;
  activeZone: ZoneId | null;
  activeTrailZone: ZoneId | null;
  activeNodeId: string | null;
  activeLevel: number;
  muted: boolean;
  cozyRoundCount: number;
  showParentDashboard: boolean;
  trailCelebration: TrailCelebration | null;
  isFullAdventureUnlocked: boolean;
  showPaywallModal: boolean;
  pendingPaywallNode: { zoneId: ZoneId; nodeId?: string } | null;

  switchExplorer: (explorer: ExplorerProfile | null) => void;
  openZoneTrail: (zone: ZoneId) => void;
  closeZoneTrail: () => void;
  startNode: (zone: ZoneId, nodeId: string) => void;
  startZone: (zone: ZoneId, level: number) => void;
  exitZone: () => void;
  triggerTrailCelebration: (celebration: TrailCelebration) => void;
  clearTrailCelebration: () => void;
  completeRound: () => void;
  resetCooldown: () => void;
  toggleParentDashboard: (force?: boolean) => void;
  toggleMuted: () => void;
  openPaywall: (node?: { zoneId: ZoneId; nodeId?: string }) => void;
  closePaywall: () => void;
  setFullAdventureUnlocked: (unlocked: boolean) => void;
}

const initialMuted = typeof window === 'undefined' ? false : loadMuted();
zunoAudio.setMuted(initialMuted);

export const useZunoStore = create<ZunoState>((set, get) => ({
  activeExplorer: null,
  activeZone: null,
  activeTrailZone: null,
  activeNodeId: null,
  activeLevel: 1,
  muted: initialMuted,
  cozyRoundCount: typeof window === 'undefined' ? 0 : loadCozyCount(),
  showParentDashboard: false,
  trailCelebration: null,
  isFullAdventureUnlocked: loadIapUnlocked(),
  showPaywallModal: false,
  pendingPaywallNode: null,

  switchExplorer: (explorer) => set({ activeExplorer: explorer, activeZone: null, activeTrailZone: null, trailCelebration: null }),

  openZoneTrail: (zone) => set({ activeTrailZone: zone }),
  closeZoneTrail: () => set({ activeTrailZone: null, trailCelebration: null }),

  startNode: (zone, nodeId) => {
    if (get().cozyRoundCount >= COZY_ROUND_LIMIT) return;
    const config = getNodeConfig(zone, nodeId);
    // On native Android, Spots 2-5 require the $19 purchase. On web, all spots are free!
    if (isNativeAndroid() && config.nodeIndex > 0 && !get().isFullAdventureUnlocked) {
      set({ showPaywallModal: true, pendingPaywallNode: { zoneId: zone, nodeId } });
      return;
    }
    set({ activeZone: zone, activeNodeId: nodeId, trailCelebration: null });
  },

  startZone: (zone, level) => {
    if (get().cozyRoundCount >= COZY_ROUND_LIMIT) return;
    if (isNativeAndroid() && level > 1 && !get().isFullAdventureUnlocked) {
      set({ showPaywallModal: true, pendingPaywallNode: null });
      return;
    }
    set({ activeZone: zone, activeLevel: level, trailCelebration: null });
  },

  exitZone: () => set({ activeZone: null, activeNodeId: null }),

  triggerTrailCelebration: (celebration) => set({ trailCelebration: celebration }),
  clearTrailCelebration: () => set({ trailCelebration: null }),

  completeRound: () => {
    const next = get().cozyRoundCount + 1;
    persistCozyCount(next);
    set({ cozyRoundCount: next });
  },

  resetCooldown: () => {
    persistCozyCount(0);
    set({ cozyRoundCount: 0, activeZone: null, activeTrailZone: null, activeNodeId: null });
  },

  toggleParentDashboard: (force) =>
    set((state) => ({ showParentDashboard: typeof force === 'boolean' ? force : !state.showParentDashboard })),

  toggleMuted: () => {
    const muted = !get().muted;
    zunoAudio.setMuted(muted);
    writeStorage(MUTE_STORAGE_KEY, muted ? '1' : '0');
    set({ muted });
  },

  openPaywall: (node) => {
    if (!isNativeAndroid()) return; // Never show paywall on web/PWA
    set({ showPaywallModal: true, pendingPaywallNode: node || null });
  },
  closePaywall: () => set({ showPaywallModal: false, pendingPaywallNode: null }),
  setFullAdventureUnlocked: (unlocked) => set({ isFullAdventureUnlocked: unlocked }),
}));
