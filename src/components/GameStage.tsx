import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, Heart, Music, Play, RotateCcw, Sparkles, Sprout, Star, Volume2, VolumeX, Waypoints, Zap, type LucideIcon } from 'lucide-react';
import { recordSession, type ZoneId } from '../db/zunoDb';
import { zunoAudio } from '../audio/ZunoSynth';
import { useZunoStore } from '../store/useZunoStore';
import { triggerHaptic } from '../services/capacitorBridge';
import ZunoMascot from './ZunoMascot';
import SparkBerryZone from './zones/SparkBerryZone';
import ThunderChimesZone from './zones/ThunderChimesZone';
import TwinCurrentsZone from './zones/TwinCurrentsZone';
import { TOTAL_TRIALS, type RoundResult } from './zones/shared';

/* ------------------------------------------------------------------ */
/*  Zone catalogue (shared with the hub)                               */
/* ------------------------------------------------------------------ */

export interface ZoneInfo {
  id: ZoneId;
  title: string;
  skill: string;
  tagline: string;
  Icon: LucideIcon;
  gradient: string;
  glow: string;
  levelTitles: [string, string, string];
  levelRules: [string[], string[], string[]];
}

export const ZONE_INFO: Record<ZoneId, ZoneInfo> = {
  spark_berry: {
    id: 'spark_berry',
    title: 'Spark Berry Bush',
    skill: 'Wait-Power · Pop & Pause Loops',
    tagline: 'Zuno pops out of the bush. Tap when he’s awake, wait when he’s asleep!',
    Icon: Sprout,
    gradient: 'from-zuno-cyan/80 via-sky-400/60 to-zuno-violet/80',
    glow: 'shadow-glow-cyan',
    levelTitles: ['Foundation', 'Static-Bug Interference', 'Full Moon Rule Shift'],
    levelRules: [
      [
        '👆 TAP Zuno when he is awake — POP!',
        '🤫 Keep your hands OFF when he is sleeping — PAUSE!',
        '⭐ Waiting earns Wait-Power Sparks.',
      ],
      [
        '👆 TAP awake Zuno. 🤫 Hands off sleeping Zuno.',
        '🐝 Ignore the golden Static-Bug flying by!',
        '⏱ Zuno is quicker this time.',
      ],
      [
        '👆 TAP awake Zuno. 🤫 Hands off sleeping Zuno.',
        '🌕 When the FULL MOON shines, the rules FLIP!',
        '💤 Under the moon: sleeping Zuno means POP, awake Zuno means WAIT.',
      ],
    ],
  },
  thunder_chimes: {
    id: 'thunder_chimes',
    title: 'Thunder Chimes',
    skill: 'Working Memory · Impulse Delay',
    tagline: 'Listen to Zuno’s crystal song, then echo it back in the same order.',
    Icon: Music,
    gradient: 'from-zuno-violet/90 via-fuchsia-500/60 to-zuno-gold/70',
    glow: 'shadow-glow-violet',
    levelTitles: ['2-Note Songs', '3-Note Songs', '4-Note Songs'],
    levelRules: [
      ['👂 LISTEN while Zuno plays 2 crystals.', '✋ Wait until he finishes — no peeking taps!', '🎵 Then ECHO the song back.'],
      ['👂 LISTEN while Zuno plays 3 crystals.', '✋ Wait until he finishes.', '🎵 Then ECHO the song back.'],
      ['👂 LISTEN while Zuno plays 4 crystals.', '✋ Wait until he finishes.', '🎵 Then ECHO the song back.'],
    ],
  },
  twin_currents: {
    id: 'twin_currents',
    title: 'Twin Currents',
    skill: 'Bilateral Motor Coordination',
    tagline: 'Guide two glowing orbs down their streams with both hands at once.',
    Icon: Waypoints,
    gradient: 'from-zuno-violet/90 via-indigo-400/60 to-zuno-cyan/90',
    glow: 'shadow-glow-violet',
    levelTitles: ['Straight Streams', 'Gentle S-Curves', 'Mirror Streams'],
    levelRules: [
      ['🟣 Left finger drags the violet orb down.', '🔵 Right finger drags the cyan orb down.', '🌉 Move together to keep the bridge glowing!'],
      ['🟣🔵 Both orbs follow gentle S-curves.', '🌉 Keep both hands at the same calm speed.', '✨ No racing ahead!'],
      ['🟣🔵 The streams drift apart like a mirror.', '🌉 Keep both hands at the same calm speed.', '✨ Slow and steady wins.'],
    ],
  },
};

/* ------------------------------------------------------------------ */
import { ZONE_TRAILS, type NodeConfig } from '../data/zoneNodes';

/* ------------------------------------------------------------------ */
/*  Stage                                                              */
/* ------------------------------------------------------------------ */

type StagePhase = 'intro' | 'playing' | 'result';

interface SavedSummary {
  unlockedNext: number | null;
  unlockedNextNode: string | null;
}

interface GameStageProps {
  explorerId: string;
  zoneId: ZoneId;
  level?: number;
  nodeConfig?: NodeConfig;
  onExit: () => void;
}

function starsFor(result: RoundResult): number {
  const mean = (result.waitPowerScore + result.popAccuracyScore) / 2;
  if (mean >= 80) return 3;
  if (mean >= 50) return 2;
  return 1;
}

export default function GameStage({ explorerId, zoneId, level, nodeConfig, onExit }: GameStageProps) {
  const info = ZONE_INFO[zoneId];
  const activeNodeConfig = nodeConfig ?? (level ? ZONE_TRAILS[zoneId][Math.min(4, Math.max(0, level - 1))] : ZONE_TRAILS[zoneId][0]);
  const activeLevel = activeNodeConfig.nodeIndex + 1;

  const muted = useZunoStore((s) => s.muted);
  const toggleMuted = useZunoStore((s) => s.toggleMuted);
  const completeRound = useZunoStore((s) => s.completeRound);
  const toggleParentDashboard = useZunoStore((s) => s.toggleParentDashboard);

  const [phase, setPhase] = useState<StagePhase>('intro');
  const [completed, setCompleted] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const finishedRef = useRef(false);

  const start = (): void => {
    zunoAudio.unlock();
    zunoAudio.playTap();
    finishedRef.current = false;
    setCompleted(0);
    setResult(null);
    setSaved(null);
    setAttempt((n) => n + 1);
    setPhase('playing');
  };

  const triggerTrailCelebration = useZunoStore((s) => s.triggerTrailCelebration);

  const handleFinish = useCallback(
    (round: RoundResult) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setResult(round);
      setPhase('result');
      zunoAudio.playWaitPowerWin();
      triggerHaptic('success');

      void recordSession(
        {
          explorerId,
          zoneId,
          level: activeLevel,
          nodeId: activeNodeConfig.nodeId,
          durationMs: round.durationMs,
          waitPowerScore: round.waitPowerScore,
          popAccuracyScore: round.popAccuracyScore,
          medianReactionMs: round.medianReactionMs,
          staticPoofCount: round.staticPoofCount,
        },
        round.sparksEarned,
      )
        .then(({ unlockedNext, unlockedNextNode }) => {
          setSaved({ unlockedNext, unlockedNextNode });
          if (unlockedNextNode) {
            triggerTrailCelebration({
              zoneId,
              fromIndex: activeNodeConfig.nodeIndex,
              toIndex: Math.min(4, activeNodeConfig.nodeIndex + 1),
              unlockedNodeId: unlockedNextNode,
            });
          } else if ((round.waitPowerScore + round.popAccuracyScore) / 2 >= 60) {
            triggerTrailCelebration({
              zoneId,
              fromIndex: activeNodeConfig.nodeIndex,
              toIndex: Math.min(4, activeNodeConfig.nodeIndex + 1),
              unlockedNodeId: activeNodeConfig.nodeId,
            });
          }
        })
        .catch(() => setSaved({ unlockedNext: null, unlockedNextNode: null }));
      completeRound();
    },
    [activeLevel, activeNodeConfig.nodeId, activeNodeConfig.nodeIndex, completeRound, explorerId, triggerTrailCelebration, zoneId],
  );

  const Icon = info.Icon;
  const stars = result ? starsFor(result) : 0;

  return (
    <div className="twilight-sky fixed inset-0 z-30 flex flex-col" id="game-stage">
      <header className="safe-header relative z-40 flex shrink-0 items-center gap-3 border-b border-white/10 bg-zuno-night/75 backdrop-blur md:px-6">
        <button
          type="button"
          id="btn-exit-zone"
          onClick={onExit}
          aria-label="Back to the Twilight Forest"
          className="zuno-btn-ghost relative z-50 h-12 w-12 shrink-0 touch-manipulation after:absolute after:-inset-2 after:content-[''] md:h-14 md:w-14"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br md:h-12 md:w-12', info.gradient)}>
            <Icon className="h-6 w-6 text-zuno-night" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-zuno-lavender md:text-2xl">{info.title}</h1>
            <p className="truncate text-xs text-zuno-lavender/70 md:text-sm">Spot {activeLevel} of 5 · {activeNodeConfig.title}</p>
          </div>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          id="btn-mute-stage"
          onClick={toggleMuted}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          className="zuno-btn-ghost h-12 w-12 shrink-0 md:h-14 md:w-14"
        >
          {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </button>
      </header>

      <main className="relative min-h-0 flex-1">
        {phase === 'playing' && (
          <div className="absolute inset-0" key={attempt}>
            {zoneId === 'spark_berry' && <SparkBerryZone nodeConfig={activeNodeConfig} onProgress={setCompleted} onFinish={handleFinish} />}
            {zoneId === 'thunder_chimes' && <ThunderChimesZone nodeConfig={activeNodeConfig} onProgress={setCompleted} onFinish={handleFinish} />}
            {zoneId === 'twin_currents' && <TwinCurrentsZone nodeConfig={activeNodeConfig} onProgress={setCompleted} onFinish={handleFinish} />}
          </div>
        )}

        {phase === 'intro' && (
          <div className="scroll-zone absolute inset-0 flex items-center justify-center p-4">
            <section className="glass-card animate-pop-in flex max-h-full w-full max-w-2xl flex-col items-center gap-3 p-5 text-center md:gap-4 md:p-8">
              <ZunoMascot mood="AWAKE_POP" size={170} />
              <h2 className="text-gradient text-3xl font-bold md:text-4xl">{activeNodeConfig.title}</h2>
              <p className="text-base text-zuno-lavender/80 md:text-lg">{info.tagline}</p>
              <ul className="w-full space-y-2 text-left text-lg font-medium text-zuno-lavender md:text-xl">
                {info.levelRules[Math.min(2, activeLevel - 1)].map((rule) => (
                  <li key={rule} className="rounded-2xl bg-white/5 px-4 py-2">
                    {rule}
                  </li>
                ))}
                {activeNodeConfig.hasDistractor && (
                  <li className="rounded-2xl bg-zuno-gold/15 px-4 py-2 text-zuno-gold">
                    ⚡ Watch out for sparkling distractors!
                  </li>
                )}
                {activeNodeConfig.isNightMode && (
                  <li className="rounded-2xl bg-indigo-500/15 px-4 py-2 text-indigo-200">
                    🌙 Twilight night mode: focus calmly under the stars!
                  </li>
                )}
              </ul>
              <button
                type="button"
                id="btn-start-round"
                onClick={start}
                className="zuno-btn-primary mt-1 min-h-[76px] w-full max-w-sm text-2xl"
              >
                <Play className="h-8 w-8" fill="currentColor" /> Let’s Go!
              </button>
            </section>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="scroll-zone absolute inset-0 z-20 flex items-center justify-center bg-zuno-night/75 p-4 backdrop-blur-sm">
            <section className="glass-card animate-pop-in relative flex max-h-full w-full max-w-xl flex-col items-center gap-3.5 p-5 text-center md:p-8" aria-live="polite">
              {/* Particle glow ring around celebrating Zuno */}
              <div className="relative">
                <div className="absolute -inset-5 rounded-full bg-gradient-to-r from-zuno-gold/30 via-zuno-cyan/30 to-zuno-violet/30 blur-xl animate-pulse" />
                <div className="relative animate-float">
                  <ZunoMascot mood="HAPPY_LEAP" size={175} />
                </div>
              </div>

              {/* Option A Heading & Subtext */}
              <h2 className="text-gradient text-3xl font-bold leading-tight md:text-5xl">
                Zuno’s Tail is Fully Charged!
              </h2>
              <p className="max-w-md text-base font-semibold text-zuno-gold md:text-xl">
                You earned +{result.sparksEarned} Sparks today and grew your Superpower! ⚡
              </p>

              {/* Star Rating */}
              <div className="flex gap-2" aria-label={`${stars} of 3 stars`}>
                {[1, 2, 3].map((n) => (
                  <Star
                    key={n}
                    className={clsx(
                      'h-11 w-11 transition-all duration-500 md:h-14 md:w-14',
                      n <= stars ? 'fill-zuno-gold text-zuno-gold drop-shadow-[0_0_14px_rgba(251,191,36,0.9)]' : 'text-white/20',
                    )}
                    style={{ transitionDelay: `${n * 160}ms` }}
                  />
                ))}
              </div>

              {/* 3 Metric Badges */}
              <div className="grid w-full grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-2xl font-bold text-zuno-gold md:text-3xl">{result.waitPowerScore}%</p>
                  <p className="text-xs text-zuno-lavender/70 md:text-sm">Wait-Power</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-2xl font-bold text-zuno-cyan md:text-3xl">{result.popAccuracyScore}%</p>
                  <p className="text-xs text-zuno-lavender/70 md:text-sm">Pop Accuracy</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="flex items-center justify-center gap-1 text-2xl font-bold text-zuno-lavender md:text-3xl">
                    <Zap className="h-6 w-6 text-zuno-gold" /> +{result.sparksEarned}
                  </p>
                  <p className="text-xs text-zuno-lavender/70 md:text-sm">Sparks</p>
                </div>
              </div>

              {/* Trail Progression Alert */}
              {saved?.unlockedNextNode && (
                <p className="animate-pop-in rounded-full border border-zuno-cyan bg-zuno-cyan/20 px-5 py-2 text-base font-bold text-zuno-cyan shadow-glow-cyan md:text-lg">
                  🌟 Next Trail Spot Unlocked! Zuno is walking ahead!
                </p>
              )}
              {saved?.unlockedNext && !saved?.unlockedNextNode && (
                <p className="animate-pop-in rounded-full bg-zuno-gold/20 px-5 py-2 text-base font-bold text-zuno-gold md:text-lg">
                  🔓 Level {saved.unlockedNext} unlocked!
                </p>
              )}

              {/* The Dual-Action Buttons */}
              <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  id="btn-back-to-forest"
                  onClick={() => {
                    zunoAudio.playTap();
                    triggerHaptic('medium');
                    onExit();
                  }}
                  className="zuno-btn-primary min-h-[64px] flex-1 text-lg font-bold shadow-glow-cyan md:text-xl"
                >
                  <Sparkles className="h-6 w-6" /> Back to Forest Map
                </button>

                <button
                  type="button"
                  id="btn-show-parents"
                  onClick={() => {
                    zunoAudio.playTap();
                    triggerHaptic('success');
                    toggleParentDashboard(true);
                    onExit();
                  }}
                  className="zuno-btn-gold min-h-[64px] flex-1 text-lg font-bold shadow-glow-gold md:text-xl"
                >
                  <Heart className="h-6 w-6 fill-rose-300 text-rose-300" /> Show Mom & Dad
                </button>
              </div>

              {/* Replay Option */}
              <button
                type="button"
                id="btn-play-again"
                onClick={() => {
                  zunoAudio.playTap();
                  triggerHaptic('light');
                  start();
                }}
                className="zuno-btn-ghost mt-0.5 min-h-[44px] w-full text-sm font-semibold text-zuno-lavender/80 hover:text-white md:text-base"
              >
                <RotateCcw className="h-4 w-4" /> Play This Spot Again
              </button>
            </section>
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-white/10 bg-zuno-night/80 px-4 py-3 md:px-8 md:py-4" aria-label="Round progress">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Zap className="h-6 w-6 shrink-0 text-zuno-gold" />
          <div
            className="flex h-4 flex-1 gap-1.5 md:h-5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={TOTAL_TRIALS}
            aria-valuenow={phase === 'result' ? TOTAL_TRIALS : completed}
          >
            {Array.from({ length: TOTAL_TRIALS }, (_, i) => {
              const filled = phase === 'result' || i < completed;
              return (
                <div
                  key={i}
                  className={clsx(
                    'flex-1 rounded-full transition-all duration-500',
                    filled ? 'bg-gradient-to-r from-zuno-cyan to-zuno-gold shadow-glow-cyan' : 'bg-white/10',
                  )}
                />
              );
            })}
          </div>
          <span className="w-12 text-right text-sm font-bold text-zuno-lavender md:text-base">
            {phase === 'result' ? TOTAL_TRIALS : completed}/{TOTAL_TRIALS}
          </span>
        </div>
      </footer>
    </div>
  );
}
