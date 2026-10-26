import Dexie, { type Table } from 'dexie';

/* ------------------------------------------------------------------ */
/*  Domain types                                                       */
/* ------------------------------------------------------------------ */

export type ZoneId = 'spark_berry' | 'thunder_chimes' | 'twin_currents';

export const ZONE_IDS: readonly ZoneId[] = ['spark_berry', 'thunder_chimes', 'twin_currents'];

export const MAX_LEVEL = 3;

/** Mean of Wait-Power + Pop Accuracy required to unlock the next level of a zone. */
export const UNLOCK_MASTERY_THRESHOLD = 60;

export interface ExplorerProfile {
  id: string;
  name: string;
  ageYears: number;
  avatarBadge: string;
  sparksCollected: number;
  unlockedLevel: Record<ZoneId, number>;
  createdAt: number;
}

export interface SparkSession {
  id: string;
  explorerId: string;
  zoneId: ZoneId;
  level: number;
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

class ZunoDatabase extends Dexie {
  explorers!: Table<ExplorerProfile, string>;
  sessions!: Table<SparkSession, string>;

  constructor() {
    super('ZunoSparkDB');
    this.version(1).stores({
      explorers: 'id, name, createdAt',
      sessions: 'id, explorerId, zoneId, timestamp, synced, [explorerId+timestamp]',
    });
  }
}

export const db = new ZunoDatabase();

export function defaultUnlocks(): Record<ZoneId, number> {
  return { spark_berry: 1, thunder_chimes: 1, twin_currents: 1 };
}

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
      if (existing > 0) return;

      const now = Date.now();
      const HOUR = 3_600_000;
      const DAY = 24 * HOUR;

      const leo: ExplorerProfile = {
        id: generateUuid(),
        name: 'Leo',
        ageYears: 4,
        avatarBadge: '⚡',
        sparksCollected: 31,
        unlockedLevel: { spark_berry: 2, thunder_chimes: 2, twin_currents: 1 },
        createdAt: now - 6 * DAY,
      };

      const maya: ExplorerProfile = {
        id: generateUuid(),
        name: 'Maya',
        ageYears: 3,
        avatarBadge: '🦊',
        sparksCollected: 18,
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
    unlockedLevel: defaultUnlocks(),
    createdAt: Date.now(),
  };
  await db.explorers.add(explorer);
  return explorer;
}

export interface RecordSessionResult {
  session: SparkSession;
  unlockedNext: number | null;
}

/**
 * Persists a completed round, credits sparks and unlocks the next level when
 * the explorer demonstrates mastery.
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
    const explorer = await db.explorers.get(input.explorerId);
    if (explorer) {
      const unlockedLevel: Record<ZoneId, number> = { ...explorer.unlockedLevel };
      const mastery = (input.waitPowerScore + input.popAccuracyScore) / 2;
      const current = unlockedLevel[input.zoneId] ?? 1;
      if (mastery >= UNLOCK_MASTERY_THRESHOLD && input.level >= current && input.level < MAX_LEVEL) {
        unlockedLevel[input.zoneId] = input.level + 1;
        unlockedNext = input.level + 1;
      }
      await db.explorers.put({
        ...explorer,
        sparksCollected: explorer.sparksCollected + Math.max(0, sparksEarned),
        unlockedLevel,
      });
    }
    return { session, unlockedNext };
  });
}

export async function unlockAllLevels(explorerId: string): Promise<void> {
  const explorer = await db.explorers.get(explorerId);
  if (!explorer) return;
  await db.explorers.put({
    ...explorer,
    unlockedLevel: { spark_berry: MAX_LEVEL, thunder_chimes: MAX_LEVEL, twin_currents: MAX_LEVEL },
  });
}
