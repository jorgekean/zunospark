import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { Footprints, Lock, Moon, Sparkles, Star, Volume2, VolumeX, Zap } from 'lucide-react';
import { db, ensureSeedData, type ExplorerProfile, type ZoneId } from './db/zunoDb';
import { ZONE_TRAILS, getDefaultNodeId, getNodeConfig } from './data/zoneNodes';
import { zunoAudio } from './audio/ZunoSynth';
import { COZY_ROUND_LIMIT, useZunoStore } from './store/useZunoStore';
import GameStage, { ZONE_INFO } from './components/GameStage';
import HoldButton from './components/HoldButton';
import ParentSparkDashboard, { ParentGateButton } from './components/ParentSparkDashboard';
import ZunoMascot from './components/ZunoMascot';
import ZoneTrailMap from './components/ZoneTrailMap';
import PaywallModal from './components/PaywallModal';
import { initCapacitorBridge, triggerHaptic } from './services/capacitorBridge';

const ZONE_ORDER: ZoneId[] = ['spark_berry', 'thunder_chimes', 'twin_currents'];

/* ------------------------------------------------------------------ */
/*  Cozy Cool-Down overlay                                             */
/* ------------------------------------------------------------------ */

function CozyCoolDown() {
  const resetCooldown = useZunoStore((s) => s.resetCooldown);

  useEffect(() => {
    const id = window.setTimeout(() => zunoAudio.playCozyLullaby(), 500);
    return () => window.clearTimeout(id);
  }, []);

  const ideas = ['🦊 Hop like a fox 10 times', '🌳 Run to your favourite tree', '🤸 Stretch up to the stars', '💧 Have a drink of water'];

  return (
    <div className="twilight-sky fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-5 text-center" role="dialog" aria-modal="true" aria-label="Cozy Cool-Down" id="cozy-cooldown">
      <div className="animate-float">
        <ZunoMascot mood="SLEEP_PAUSE" size={260} />
      </div>
      <h1 className="text-gradient text-4xl font-bold md:text-5xl">Cozy Cool-Down</h1>
      <p className="max-w-lg text-xl text-zuno-lavender md:text-2xl">
        Zuno curled up for a nap. 💤<br />Great job, Explorer! Let’s go play outside!
      </p>
      <ul className="flex max-w-2xl flex-wrap justify-center gap-2">
        {ideas.map((idea) => (
          <li key={idea} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-base text-zuno-lavender md:text-lg">
            {idea}
          </li>
        ))}
      </ul>
      <HoldButton
        ariaLabel="Parent Override: Unlock 3 More Rounds. Press and hold for one and a half seconds."
        onComplete={resetCooldown}
        className="zuno-btn-ghost mt-3 min-h-[56px] px-6 text-base"
        fillClassName="bg-zuno-gold/40"
      >
        <Lock className="h-5 w-5" /> Parent Override: Unlock 3 More Rounds
      </HoldButton>
      <p className="-mt-2 text-xs text-zuno-lavender/50">Grown-ups: press and hold for 1.5 seconds.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hub                                                                */
/* ------------------------------------------------------------------ */

function RoundDots({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${count} of ${COZY_ROUND_LIMIT} rounds played`}>
      <Moon className="h-5 w-5 text-zuno-lavender/70" />
      {Array.from({ length: COZY_ROUND_LIMIT }, (_, i) => (
        <span key={i} className={clsx('h-3.5 w-3.5 rounded-full transition-all', i < count ? 'bg-zuno-gold shadow-glow-gold' : 'bg-white/15')} />
      ))}
    </div>
  );
}

interface HubProps {
  explorers: ExplorerProfile[];
  activeExplorer: ExplorerProfile;
}

function Hub({ explorers, activeExplorer }: HubProps) {
  const muted = useZunoStore((s) => s.muted);
  const toggleMuted = useZunoStore((s) => s.toggleMuted);
  const switchExplorer = useZunoStore((s) => s.switchExplorer);
  const openZoneTrail = useZunoStore((s) => s.openZoneTrail);
  const cozyRoundCount = useZunoStore((s) => s.cozyRoundCount);
  const toggleParentDashboard = useZunoStore((s) => s.toggleParentDashboard);

  return (
    <div className="twilight-sky scroll-zone fixed inset-0" id="hub">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {[8, 22, 41, 63, 78, 91].map((left, i) => (
          <span
            key={left}
            className="absolute h-2 w-2 animate-drift rounded-full bg-zuno-gold/70 blur-[1px]"
            style={{ left: `${left}%`, top: `${30 + ((i * 17) % 55)}%`, animationDelay: `${i * 1.3}s` }}
          />
        ))}
      </div>

      <div className="safe-top safe-bottom safe-x relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4 px-4 pb-6 md:gap-6 md:px-8 md:py-6">
        <header className="flex flex-wrap items-center gap-3 md:gap-5">
          <div className="animate-float -my-2">
            <ZunoMascot mood="AWAKE_POP" size={150} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-gradient text-4xl font-bold leading-tight md:text-6xl">ZunoSpark</h1>
            <p className="text-base font-medium text-zuno-lavender/80 md:text-xl">Wait-Power &amp; Focus Trainer</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="glass-card flex h-14 items-center gap-2 rounded-full px-5" id="spark-counter" aria-label={`${activeExplorer.sparksCollected} sparks collected`}>
              <Zap className="h-6 w-6 fill-zuno-gold text-zuno-gold" />
              <span className="text-2xl font-bold text-zuno-gold">{activeExplorer.sparksCollected}</span>
            </div>
            <button type="button" id="btn-mute-hub" onClick={toggleMuted} aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} className="zuno-btn-ghost h-14 w-14">
              {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </button>
            <ParentGateButton onUnlock={() => toggleParentDashboard(true)} />
          </div>
        </header>

        <section aria-label="Explorer profiles" className="flex flex-wrap items-center gap-2 md:gap-3">
          {explorers.map((explorer) => {
            const active = explorer.id === activeExplorer.id;
            return (
              <button
                key={explorer.id}
                type="button"
                id={`pill-explorer-${explorer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                onClick={() => {
                  zunoAudio.playTap();
                  triggerHaptic('light');
                  switchExplorer(explorer);
                }}
                aria-pressed={active}
                className={clsx(
                  'inline-flex min-h-[56px] items-center gap-2 rounded-full border-2 px-5 text-lg font-bold transition-all duration-200 active:scale-95 md:text-xl',
                  active
                    ? 'border-zuno-cyan bg-zuno-cyan/15 text-zuno-cyan shadow-glow-cyan'
                    : 'border-white/15 bg-white/5 text-zuno-lavender hover:bg-white/10',
                )}
              >
                <span className="text-2xl md:text-3xl">{explorer.avatarBadge}</span>
                {explorer.name}
              </button>
            );
          })}
          <div className="flex-1" />
          <RoundDots count={cozyRoundCount} />
        </section>

        <main className="grid flex-1 gap-4 pb-4 md:grid-cols-3 md:gap-6">
          {ZONE_ORDER.map((zoneId, cardIndex) => {
            const info = ZONE_INFO[zoneId];
            const Icon = info.Icon;
            const trail = ZONE_TRAILS[zoneId];
            const unlockedNodeIds = activeExplorer.unlockedNodes?.[zoneId] ?? [trail[0].nodeId];
            const unlockedCount = unlockedNodeIds.length;

            return (
              <article
                key={zoneId}
                id={`zone-card-${zoneId}`}
                className="glass-card animate-slide-up flex flex-col gap-4 p-5 md:p-6"
                style={{ animationDelay: `${cardIndex * 120}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className={clsx('flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.6rem] bg-gradient-to-br', info.gradient, info.glow)}>
                    <Icon className="h-11 w-11 text-zuno-night" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold leading-tight text-zuno-lavender">{info.title}</h2>
                    <p className="text-sm font-semibold text-zuno-gold">{info.skill}</p>
                  </div>
                </div>

                <p className="text-base text-zuno-lavender/75">{info.tagline}</p>

                {/* Trail Progression Preview */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-zuno-lavender/70">
                    <span className="flex items-center gap-1">
                      <Footprints className="h-3.5 w-3.5 text-zuno-cyan" /> Winding Trail
                    </span>
                    <span className="text-zuno-gold font-bold">{unlockedCount} of 5 Spots Unlocked</span>
                  </div>

                  {/* 5 Node indicators along trail */}
                  <div className="flex items-center justify-between gap-1.5 px-1 py-1">
                    {trail.map((node, i) => {
                      const isUnlocked = unlockedNodeIds.includes(node.nodeId);
                      const hasEnoughSparks = (activeExplorer.sparksCollected ?? 0) >= node.requiredSparks;
                      const isPlayable = isUnlocked && hasEnoughSparks;
                      const isNext = i === unlockedCount - 1;

                      return (
                        <div key={node.nodeId} className="flex flex-1 flex-col items-center gap-1">
                          <div
                            className={clsx(
                              'flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                              isPlayable
                                ? isNext
                                  ? 'border-zuno-cyan bg-zuno-cyan/20 text-zuno-cyan shadow-glow-cyan animate-pulse'
                                  : 'border-zuno-gold bg-zuno-gold/20 text-zuno-gold'
                                : 'border-white/10 bg-white/5 text-zuno-lavender/30',
                            )}
                          >
                            {isPlayable ? (
                              <Star className={clsx('h-4 w-4', i < unlockedCount - 1 && 'fill-zuno-gold text-zuno-gold')} />
                            ) : (
                              <Lock className="h-3.5 w-3.5 text-zuno-lavender/30" />
                            )}
                          </div>
                          <span className="text-[10px] text-zuno-lavender/60">Spot {i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Open Zone Trail Button */}
                <button
                  type="button"
                  id={`btn-open-trail-${zoneId}`}
                  onClick={() => {
                    zunoAudio.unlock();
                    zunoAudio.playTap();
                    triggerHaptic('medium');
                    openZoneTrail(zoneId);
                  }}
                  className="zuno-btn-primary mt-auto min-h-[68px] w-full text-xl"
                >
                  <Sparkles className="h-6 w-6" /> Explore Trail Map
                </button>
              </article>
            );
          })}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App root                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const activeExplorer = useZunoStore((s) => s.activeExplorer);
  const activeZone = useZunoStore((s) => s.activeZone);
  const activeTrailZone = useZunoStore((s) => s.activeTrailZone);
  const activeNodeId = useZunoStore((s) => s.activeNodeId);
  const cozyRoundCount = useZunoStore((s) => s.cozyRoundCount);
  const showParentDashboard = useZunoStore((s) => s.showParentDashboard);
  const switchExplorer = useZunoStore((s) => s.switchExplorer);
  const exitZone = useZunoStore((s) => s.exitZone);
  const closeZoneTrail = useZunoStore((s) => s.closeZoneTrail);
  const startNode = useZunoStore((s) => s.startNode);
  const toggleParentDashboard = useZunoStore((s) => s.toggleParentDashboard);

  const [seeded, setSeeded] = useState(false);
  const explorers = useLiveQuery(() => db.explorers.orderBy('createdAt').toArray(), [], undefined);

  useEffect(() => {
    let cancelled = false;
    ensureSeedData()
      .catch((error: unknown) => console.error('ZunoSpark: seeding failed', error))
      .finally(() => {
        if (!cancelled) setSeeded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (seeded) {
      initCapacitorBridge();
    }
  }, [seeded]);

  // Keep the store's active explorer in sync with live IndexedDB data (sparks, unlocks, new profiles).
  useEffect(() => {
    if (!explorers || explorers.length === 0) return;
    const current = activeExplorer ? explorers.find((e) => e.id === activeExplorer.id) : undefined;
    if (!current) {
      switchExplorer(explorers[0]);
    } else if (current !== activeExplorer && JSON.stringify(current) !== JSON.stringify(activeExplorer)) {
      useZunoStore.setState({ activeExplorer: current });
    }
  }, [explorers, activeExplorer, switchExplorer]);

  if (!seeded || !explorers || !activeExplorer) {
    return (
      <div className="twilight-sky fixed inset-0 flex flex-col items-center justify-center gap-3" aria-busy="true">
        <div className="animate-float">
          <ZunoMascot mood="SLEEP_PAUSE" size={200} />
        </div>
        <p className="text-gradient text-2xl font-bold">Waking up Zuno…</p>
      </div>
    );
  }

  const cooldown = cozyRoundCount >= COZY_ROUND_LIMIT && !activeZone;

  return (
    <>
      <Hub explorers={explorers} activeExplorer={activeExplorer} />

      {activeTrailZone && !activeZone && (
        <ZoneTrailMap
          zoneId={activeTrailZone}
          explorer={activeExplorer}
          onSelectNode={(node) => startNode(activeTrailZone, node.nodeId)}
          onBack={closeZoneTrail}
        />
      )}

      {activeZone && (
        <GameStage
          key={`${activeExplorer.id}-${activeZone}-${activeNodeId}`}
          explorerId={activeExplorer.id}
          zoneId={activeZone}
          nodeConfig={getNodeConfig(activeZone, activeNodeId ?? getDefaultNodeId(activeZone))}
          onExit={exitZone}
        />
      )}

      {showParentDashboard && <ParentSparkDashboard onClose={() => toggleParentDashboard(false)} />}

      {cooldown && <CozyCoolDown />}

      <PaywallModal />
    </>
  );
}

