import Dexie, { type Table } from 'dexie';
import { ZONE_TRAILS, getDefaultNodeId, getNextNodeId } from '../data/zoneNodes';

/* ------------------------------------------------------------------ */
/*  Domain types                                                       */
/* ------------------------------------------------------------------ */

export type ZoneId = 'spark_berry' | 'thunder_chimes' | 'twin_currents';

export const ZONE_IDS: readonly ZoneId[] = ['spark_berry', 'thunder_chimes', 'twin_currents'];

export const MAX_LEVEL = 3;
export const MAX_TRAIL_NODES = 5;

/** Mean of Wait-Power + Pop Accuracy required to unlock the next level / node of a zone. */
export const UNLOCK_MASTERY_THRESHOLD = 60;

export interface ExplorerProfile {
  id: string;
  name: string;
  ageYears: number;
  avatarBadge: string;
  sparksCollected: number;
  /** Multi-node trail progression per zone (e.g. { spark_berry: ['berry_1', 'berry_2'] }) */
  unlockedNodes: Record<ZoneId, string[]>;
  /** Legacy level tracking (kept for backwards compatibility). */
  unlockedLevel?: Record<ZoneId, number>;
  createdAt: number;
}

export interface SparkSession {
  id: string;
  explorerId: string;
  zoneId: ZoneId;
  level: number;
  nodeId?: string;
  timestamp: number;
  durationMs: number;
  /** 0–100: No-Go hold / impulse-delay success rate. */
  waitPowerScore: number;
  /** 0–100: Go / sequence accuracy. */
  popAccuracyScore: number;
  medianReactionMs: number;
  staticPoofCount: number;
  /** 0 = local only, 1 = pushed to cloud. Indexed so a future sync worker can query pending rows. */
  synced: 0 | 1;
}

export type SessionInput = Omit<SparkSession, 'id' | 'timestamp' | 'synced'>;

/* ------------------------------------------------------------------ */
/*  UUIDs (client generated, sync-safe)                                */
/* ------------------------------------------------------------------ */

/**
 * Uses crypto.randomUUID() whenever available. Falls back to an RFC 4122 v4
 * generator built on crypto.getRandomValues for non-secure origins (e.g. a
 * tablet reaching the dev server over plain-http LAN).
 */
export function generateUuid(): string {
  const cryptoApi: Crypto | undefined = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/* ------------------------------------------------------------------ */
/*  Database                                                           */
/* ------------------------------------------------------------------ */

export function defaultUnlockedNodes(): Record<ZoneId, string[]> {
  return {
    spark_berry: [getDefaultNodeId('spark_berry')],
    thunder_chimes: [getDefaultNodeId('thunder_chimes')],
    twin_currents: [getDefaultNodeId('twin_currents')],
  };
}

export function defaultUnlocks(): Record<ZoneId, number> {
  return { spark_berry: 1, thunder_chimes: 1, twin_currents: 1 };
}

class ZunoDatabase extends Dexie {
  explorers!: Table<ExplorerProfile, string>;
  sessions!: Table<SparkSession, string>;

  constructor() {
    super('ZunoSparkDB');
    this.version(1).stores({
      explorers: 'id, name, createdAt',
      sessions: 'id, explorerId, zoneId, timestamp, synced, [explorerId+timestamp]',
    });

    this.version(2)
      .stores({
        explorers: 'id, name, createdAt',
        sessions: 'id, explorerId, zoneId, timestamp, synced, [explorerId+timestamp]',
      })
      .upgrade(async (trans) => {
        // Automatically migrate legacy profiles to support unlockedNodes
        await trans
          .table('explorers')
          .toCollection()
          .modify((explorer: ExplorerProfile) => {
            if (!explorer.unlockedNodes) {
              const legacy = explorer.unlockedLevel || defaultUnlocks();
              explorer.unlockedNodes = {
                spark_berry: ZONE_TRAILS.spark_berry
                  .slice(0, Math.max(1, legacy.spark_berry || 1))
                  .map((n) => n.nodeId),
                thunder_chimes: ZONE_TRAILS.thunder_chimes
                  .slice(0, Math.max(1, legacy.thunder_chimes || 1))
                  .map((n) => n.nodeId),
                twin_currents: ZONE_TRAILS.twin_currents
                  .slice(0, Math.max(1, legacy.twin_currents || 1))
                  .map((n) => n.nodeId),
              };
            }
          });
      });
  }
}

export const db = new ZunoDatabase();

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

let seedPromise: Promise<void> | null = null;

/**
 * Seeds Leo (4, ⚡) and Maya (3, 🦊) plus realistic historical sessions so
 * the Parent ROI Dashboard shows rich metrics on first launch. Runs inside a
 * single read-write transaction, so concurrent calls (e.g. React StrictMode)
 * can never double-seed.
 */
export function ensureSeedData(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = db
    .transaction('rw', db.explorers, db.sessions, async () => {
      const existing = await db.explorers.count();
      if (existing > 0) {
        // Ensure existing database profiles have unlockedNodes populated if opened directly
        const allExplorers = await db.explorers.toArray();
        for (const exp of allExplorers) {
          if (!exp.unlockedNodes || !exp.unlockedNodes.spark_berry) {
            const legacy = exp.unlockedLevel || defaultUnlocks();
            await db.explorers.update(exp.id, {
              unlockedNodes: {
                spark_berry: ZONE_TRAILS.spark_berry
                  .slice(0, Math.max(1, legacy.spark_berry || 1))
                  .map((n) => n.nodeId),
                thunder_chimes: ZONE_TRAILS.thunder_chimes
                  .slice(0, Math.max(1, legacy.thunder_chimes || 1))
                  .map((n) => n.nodeId),
                twin_currents: ZONE_TRAILS.twin_currents
                  .slice(0, Math.max(1, legacy.twin_currents || 1))
                  .map((n) => n.nodeId),
              },
            });
          }
        }
        return;
      }

      const now = Date.now();
      const HOUR = 3_600_000;
      const DAY = 24 * HOUR;

      const leo: ExplorerProfile = {
        id: generateUuid(),
        name: 'Leo',
        ageYears: 4,
        avatarBadge: '⚡',
        sparksCollected: 31,
        unlockedNodes: {
          spark_berry: ['berry_1', 'berry_2'],
          thunder_chimes: ['chime_1', 'chime_2'],
          twin_currents: ['river_1'],
        },
        unlockedLevel: { spark_berry: 2, thunder_chimes: 2, twin_currents: 1 },
        createdAt: now - 6 * DAY,
      };

      const maya: ExplorerProfile = {
        id: generateUuid(),
        name: 'Maya',
        ageYears: 3,
        avatarBadge: '🦊',
        sparksCollected: 18,
        unlockedNodes: {
          spark_berry: ['berry_1', 'berry_2'],
          thunder_chimes: ['chime_1'],
          twin_currents: ['river_1'],
        },
        unlockedLevel: { spark_berry: 2, thunder_chimes: 1, twin_currents: 1 },
        createdAt: now - 6 * DAY + 60_000,
      };

      const sessions: SparkSession[] = [
        // Leo — three sessions showing steady Wait-Power growth.
        {
          id: generateUuid(),
          explorerId: leo.id,
          zoneId: 'spark_berry',
          level: 1,
          timestamp: now - 3 * DAY - 2 * HOUR,
          durationMs: 58_400,
          waitPowerScore: 50,
          popAccuracyScore: 83,
          medianReactionMs: 812,
          staticPoofCount: 3,
          synced: 0,
        },
        {
          id: generateUuid(),
          explorerId: leo.id,
          zoneId: 'thunder_chimes',
          level: 1,
          timestamp: now - 2 * DAY - 5 * HOUR,
          durationMs: 71_900,
          waitPowerScore: 75,
          popAccuracyScore: 63,
          medianReactionMs: 1_240,
          staticPoofCount: 2,
          synced: 0,
        },
        {
          id: generateUuid(),
          explorerId: leo.id,
          zoneId: 'spark_berry',
          level: 2,
          timestamp: now - 1 * DAY - 3 * HOUR,
          durationMs: 61_200,
          waitPowerScore: 67,
          popAccuracyScore: 80,
          medianReactionMs: 705,
          staticPoofCount: 1,
          synced: 0,
        },
        // Maya — three sessions for the younger explorer.
        {
          id: generateUuid(),
          explorerId: maya.id,
          zoneId: 'spark_berry',
          level: 1,
          timestamp: now - 4 * DAY - 1 * HOUR,
          durationMs: 64_800,
          waitPowerScore: 50,
          popAccuracyScore: 67,
          medianReactionMs: 1_020,
          staticPoofCount: 4,
          synced: 0,
        },
        {
          id: generateUuid(),
          explorerId: maya.id,
          zoneId: 'twin_currents',
          level: 1,
          timestamp: now - 2 * DAY - 2 * HOUR,
          durationMs: 92_300,
          waitPowerScore: 58,
          popAccuracyScore: 50,
          medianReactionMs: 1_460,
          staticPoofCount: 3,
          synced: 0,
        },
        {
          id: generateUuid(),
          explorerId: maya.id,
          zoneId: 'spark_berry',
          level: 1,
          timestamp: now - 3 * HOUR,
          durationMs: 60_100,
          waitPowerScore: 100,
          popAccuracyScore: 83,
          medianReactionMs: 938,
          staticPoofCount: 1,
          synced: 0,
        },
      ];

      await db.explorers.bulkAdd([leo, maya]);
      await db.sessions.bulkAdd(sessions);
    })
    .catch((error: unknown) => {
      seedPromise = null;
      throw error;
    });

  return seedPromise;
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function createExplorer(
  name: string,
  ageYears: number,
  avatarBadge: string,
): Promise<ExplorerProfile> {
  const explorer: ExplorerProfile = {
    id: generateUuid(),
    name: name.trim().slice(0, 24) || 'Explorer',
    ageYears: Math.min(8, Math.max(2, Math.round(ageYears))),
    avatarBadge,
    sparksCollected: 0,
    unlockedNodes: defaultUnlockedNodes(),
    unlockedLevel: defaultUnlocks(),
    createdAt: Date.now(),
  };
  await db.explorers.add(explorer);
  return explorer;
}

export interface RecordSessionResult {
  session: SparkSession;
  unlockedNext: number | null;
  unlockedNextNode: string | null;
}

/**
 * Persists a completed round, credits sparks and unlocks the next trail node
 * when the explorer demonstrates mastery.
 */
export function recordSession(input: SessionInput, sparksEarned: number): Promise<RecordSessionResult> {
  return db.transaction('rw', db.sessions, db.explorers, async () => {
    const session: SparkSession = {
      ...input,
      id: generateUuid(),
      timestamp: Date.now(),
      synced: 0,
    };
    await db.sessions.add(session);

    let unlockedNext: number | null = null;
    let unlockedNextNode: string | null = null;

    const explorer = await db.explorers.get(input.explorerId);
    if (explorer) {
      const unlockedNodes: Record<ZoneId, string[]> = {
        spark_berry: [...(explorer.unlockedNodes?.spark_berry ?? [getDefaultNodeId('spark_berry')])],
        thunder_chimes: [...(explorer.unlockedNodes?.thunder_chimes ?? [getDefaultNodeId('thunder_chimes')])],
        twin_currents: [...(explorer.unlockedNodes?.twin_currents ?? [getDefaultNodeId('twin_currents')])],
      };
      const unlockedLevel: Record<ZoneId, number> = { ...(explorer.unlockedLevel ?? defaultUnlocks()) };

      const mastery = (input.waitPowerScore + input.popAccuracyScore) / 2;

      // Trail node progression
      if (mastery >= UNLOCK_MASTERY_THRESHOLD) {
        const currentNodeId = input.nodeId ?? (input.level === 1 ? getDefaultNodeId(input.zoneId) : undefined);
        if (currentNodeId) {
          const nextNode = getNextNodeId(input.zoneId, currentNodeId);
          if (nextNode && !unlockedNodes[input.zoneId].includes(nextNode)) {
            unlockedNodes[input.zoneId].push(nextNode);
            unlockedNextNode = nextNode;
          }
        }

        // Legacy level unlock tracking
        const currentLvl = unlockedLevel[input.zoneId] ?? 1;
        if (input.level >= currentLvl && input.level < MAX_LEVEL) {
          unlockedLevel[input.zoneId] = input.level + 1;
          unlockedNext = input.level + 1;
        }
      }

      await db.explorers.put({
        ...explorer,
        sparksCollected: explorer.sparksCollected + Math.max(0, sparksEarned),
        unlockedNodes,
        unlockedLevel,
      });
    }
    return { session, unlockedNext, unlockedNextNode };
  });
}

export async function unlockAllLevels(explorerId: string): Promise<void> {
  const explorer = await db.explorers.get(explorerId);
  if (!explorer) return;
  await db.explorers.put({
    ...explorer,
    sparksCollected: Math.max(explorer.sparksCollected, 30),
    unlockedNodes: {
      spark_berry: ZONE_TRAILS.spark_berry.map((n) => n.nodeId),
      thunder_chimes: ZONE_TRAILS.thunder_chimes.map((n) => n.nodeId),
      twin_currents: ZONE_TRAILS.twin_currents.map((n) => n.nodeId),
    },
    unlockedLevel: { spark_berry: MAX_LEVEL, thunder_chimes: MAX_LEVEL, twin_currents: MAX_LEVEL },
  });
}
