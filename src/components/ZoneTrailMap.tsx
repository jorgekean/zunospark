import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowLeft,
  Crown,
  Lock,
  Moon,
  Play,
  RotateCcw,
  Sparkles,
  Sprout,
  Star,
  Trees,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { ZoneId, ExplorerProfile } from '../db/zunoDb';
import { ZONE_TRAILS, type NodeConfig, type NodeIconType } from '../data/zoneNodes';
import { zunoAudio } from '../audio/ZunoSynth';
import { useZunoStore } from '../store/useZunoStore';
import { ZONE_INFO } from './GameStage';
import ZunoMascot from './ZunoMascot';

interface ZoneTrailMapProps {
  zoneId: ZoneId;
  explorer: ExplorerProfile;
  onSelectNode: (nodeConfig: NodeConfig) => void;
  onBack: () => void;
}

function getNodeIcon(iconType: NodeIconType) {
  switch (iconType) {
    case 'sprout':
      return Sprout;
    case 'leaf':
      return Trees;
    case 'dragonfly':
      return Sparkles;
    case 'dusk':
      return Moon;
    case 'boss':
      return Crown;
    default:
      return Star;
  }
}

interface Point {
  x: number;
  y: number;
}

interface TrailSparkle {
  id: number;
  x: number;
  y: number;
  symbol: string;
  color: string;
}

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
  rot: number;
}

/** Cubic Bezier point evaluator */
function cubicBezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

export default function ZoneTrailMap({
  zoneId,
  explorer,
  onSelectNode,
  onBack,
}: ZoneTrailMapProps) {
  const trail = ZONE_TRAILS[zoneId];
  const info = ZONE_INFO[zoneId];
  const muted = useZunoStore((s) => s.muted);
  const toggleMuted = useZunoStore((s) => s.toggleMuted);
  const trailCelebration = useZunoStore((s) => s.trailCelebration);
  const clearTrailCelebration = useZunoStore((s) => s.clearTrailCelebration);

  const unlockedNodeIds = explorer.unlockedNodes?.[zoneId] ?? [trail[0].nodeId];
  const sparks = explorer.sparksCollected ?? 0;

  // The latest unlocked node where Zuno currently rests
  const latestUnlockedIndex = trail.reduce((acc, node, idx) => {
    return unlockedNodeIds.includes(node.nodeId) && sparks >= node.requiredSparks ? idx : acc;
  }, 0);

  const [toast, setToast] = useState<string | null>(null);

  // Trail Coordinates along the winding S-curve (in percentages)
  const nodePositions: Point[] = [
    { x: 30, y: 84 },
    { x: 70, y: 67 },
    { x: 28, y: 50 },
    { x: 72, y: 33 },
    { x: 50, y: 15 },
  ];

  // Bezier control points matching the SVG path
  const segmentControls = [
    { cp1: { x: 60, y: 78 }, cp2: { x: 65, y: 72 } },
    { cp1: { x: 75, y: 58 }, cp2: { x: 30, y: 60 } },
    { cp1: { x: 25, y: 40 }, cp2: { x: 75, y: 42 } },
    { cp1: { x: 70, y: 22 }, cp2: { x: 50, y: 25 } },
  ];

  /* ------------------------------------------------------------------ */
  /*  Trail Walk Animation State                                         */
  /* ------------------------------------------------------------------ */

  const [animating, setAnimating] = useState(false);
  const [animPos, setAnimPos] = useState<Point>(nodePositions[latestUnlockedIndex]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [trailSparkles, setTrailSparkles] = useState<TrailSparkle[]>([]);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [unlockedModalNode, setUnlockedModalNode] = useState<NodeConfig | null>(null);

  const animRef = useRef<number | null>(null);
  const lastStepSoundRef = useRef<number>(-1);

  // Trigger trail pass celebration when returning from a successful game stage
  useEffect(() => {
    if (!trailCelebration || trailCelebration.zoneId !== zoneId) return;

    const fromIdx = Math.min(4, Math.max(0, trailCelebration.fromIndex));
    const toIdx = Math.min(4, Math.max(0, trailCelebration.toIndex));

    if (fromIdx === toIdx) {
      // Replayed last spot: celebrate right on node!
      zunoAudio.playTrailCheer();
      createConfettiAt(nodePositions[toIdx]);
      clearTrailCelebration();
      return;
    }

    // Begin the animated journey along the trail
    startTrailWalk(fromIdx, toIdx);
    clearTrailCelebration();
  }, [trailCelebration, zoneId]);

  const startTrailWalk = (fromIdx: number, toIdx: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    setAnimating(true);
    setActiveSegmentIndex(fromIdx);
    setTrailSparkles([]);
    setUnlockedModalNode(null);

    const p0 = nodePositions[fromIdx];
    const p3 = nodePositions[toIdx];
    const { cp1, cp2 } = segmentControls[fromIdx] ?? { cp1: p0, cp2: p3 };

    const duration = 2400; // 2.4s playful trot
    const startTime = performance.now();
    lastStepSoundRef.current = -1;

    const symbols = ['✦', '⚡', '★', '🐾', '✨'];
    const colors = ['#00f2fe', '#fbbf24', '#a855f7', '#67e8f9'];

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Smooth cubic ease-in-out
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : -1 + (4 - 2 * progress) * progress;

      // Sample path position
      const pt = cubicBezierPoint(p0, cp1, cp2, p3, eased);

      // Add joyful hopping bounce (4 hops along the path)
      const hopCycle = Math.sin(progress * Math.PI * 4);
      const hopBounce = -Math.abs(hopCycle) * 3.8; // Vertical bounce in %

      setAnimPos({ x: pt.x, y: pt.y + hopBounce });

      // Footstep sound when Zuno crests each hop
      const stepIndex = Math.floor(progress * 4);
      if (stepIndex > lastStepSoundRef.current && hopCycle > 0.8) {
        lastStepSoundRef.current = stepIndex;
        zunoAudio.playTrailStep(stepIndex);

        // Spawn a trailing paw/sparkle
        setTrailSparkles((prev) => [
          ...prev.slice(-14),
          {
            id: Date.now() + Math.random(),
            x: pt.x + (Math.random() * 4 - 2),
            y: pt.y + (Math.random() * 3 - 1.5),
            symbol: symbols[Math.floor(Math.random() * symbols.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
          },
        ]);
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        // Triumphant Arrival!
        setAnimating(false);
        setActiveSegmentIndex(null);
        setAnimPos(p3);
        zunoAudio.playTrailCheer();
        createConfettiAt(p3);
        setUnlockedModalNode(trail[toIdx]);
      }
    };

    animRef.current = requestAnimationFrame(animate);
  };

  const createConfettiAt = (origin: Point) => {
    const pieces: ConfettiPiece[] = Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: origin.x + (Math.random() * 10 - 5),
      y: origin.y - 4 + (Math.random() * 8 - 4),
      color: ['#00f2fe', '#fbbf24', '#a855f7', '#f43f5e', '#34d399'][i % 5],
      size: Math.random() * 8 + 6,
      vx: (Math.random() - 0.5) * 12,
      vy: -(Math.random() * 12 + 6),
      rot: Math.random() * 360,
    }));
    setConfetti(pieces);
    window.setTimeout(() => setConfetti([]), 3500);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleNodeClick = (node: NodeConfig) => {
    if (animating) return;

    const isUnlocked = unlockedNodeIds.includes(node.nodeId);
    const hasEnoughSparks = sparks >= node.requiredSparks;

    if (!isUnlocked) {
      zunoAudio.playSoftMiss();
      showToast('⭐ Complete earlier trail spots first!');
      return;
    }

    if (!hasEnoughSparks) {
      zunoAudio.playSoftMiss();
      showToast(`⚡ Need ${node.requiredSparks} sparks! Play earlier spots to earn more!`);
      return;
    }

    zunoAudio.playTap();
    onSelectNode(node);
  };

  const zunoDisplayPos = animating ? animPos : nodePositions[latestUnlockedIndex];

  return (
    <div className="twilight-sky fixed inset-0 z-30 flex flex-col" id="zone-trail-map">
      {/* Header */}
      <header className="safe-header relative z-40 flex shrink-0 items-center gap-3 border-b border-white/10 bg-zuno-night/85 backdrop-blur md:px-8">
        <button
          type="button"
          id="btn-trail-back"
          onClick={() => {
            zunoAudio.playTap();
            onBack();
          }}
          aria-label="Back to Twilight Woods"
          className="zuno-btn-ghost relative z-50 h-12 w-12 shrink-0 touch-manipulation after:absolute after:-inset-2 after:content-[''] md:h-14 md:w-14"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>

        <div className="flex min-w-0 items-center gap-3">
          <div
            className={clsx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br md:h-12 md:w-12',
              info.gradient,
              info.glow,
            )}
          >
            <info.Icon className="h-6 w-6 text-zuno-night" strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-zuno-lavender md:text-2xl">
              {info.title} Trail
            </h1>
            <p className="truncate text-xs font-semibold text-zuno-gold md:text-sm">
              {info.skill} · {unlockedNodeIds.length} of 5 Spots Unlocked
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Replay Hop Button */}
        {!animating && latestUnlockedIndex > 0 && (
          <button
            type="button"
            id="btn-replay-trail-walk"
            onClick={() => {
              zunoAudio.playTap();
              startTrailWalk(latestUnlockedIndex - 1, latestUnlockedIndex);
            }}
            title="Watch Zuno hop along the trail!"
            aria-label="Replay Zuno trail walk"
            className="zuno-btn-ghost hidden h-12 items-center gap-2 px-3 text-xs font-bold text-zuno-cyan md:flex md:h-14 md:px-4 md:text-sm"
          >
            <RotateCcw className="h-4 w-4" /> Watch Hop
          </button>
        )}

        <div className="glass-card flex h-12 items-center gap-2 rounded-full px-4 md:h-14 md:px-5">
          <Zap className="h-5 w-5 fill-zuno-gold text-zuno-gold md:h-6 md:w-6" />
          <span className="text-xl font-bold text-zuno-gold md:text-2xl">{sparks}</span>
        </div>

        <button
          type="button"
          id="btn-mute-trail"
          onClick={toggleMuted}
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          className="zuno-btn-ghost h-12 w-12 shrink-0 md:h-14 md:w-14"
        >
          {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </button>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="animate-pop-in fixed top-[calc(5rem+env(safe-area-inset-top,0px))] left-1/2 z-50 -translate-x-1/2 rounded-full border border-zuno-gold/50 bg-zuno-night/95 px-6 py-3 text-base font-bold text-zuno-gold shadow-glow-gold backdrop-blur-md"
        >
          {toast}
        </div>
      )}

      {/* Map Area */}
      <main className="relative flex-1 overflow-hidden">
        {/* Ambient forest background particles */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {[12, 35, 58, 82].map((left, i) => (
            <span
              key={left}
              className="absolute h-2 w-2 animate-drift rounded-full bg-zuno-gold/60 blur-[1px]"
              style={{
                left: `${left}%`,
                top: `${20 + ((i * 23) % 60)}%`,
                animationDelay: `${i * 1.5}s`,
              }}
            />
          ))}
        </div>

        {/* Trail SVG Winding Path */}
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="trailGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
            </linearGradient>
            <filter id="trailGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="activeSegmentGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Standard glowing dashed trail line */}
          <path
            d={`M ${nodePositions[0].x} ${nodePositions[0].y} 
               C 60 78, 65 72, ${nodePositions[1].x} ${nodePositions[1].y}
               C 75 58, 30 60, ${nodePositions[2].x} ${nodePositions[2].y}
               C 25 40, 75 42, ${nodePositions[3].x} ${nodePositions[3].y}
               C 70 22, 50 25, ${nodePositions[4].x} ${nodePositions[4].y}`}
            fill="none"
            stroke="url(#trailGrad)"
            strokeWidth="2.2"
            strokeDasharray="3 2"
            filter="url(#trailGlow)"
            className={animating ? 'opacity-40' : 'animate-pulse'}
          />

          {/* Highlighted Surge Segment when Zuno is walking! */}
          {activeSegmentIndex !== null && (
            <path
              d={`M ${nodePositions[activeSegmentIndex].x} ${nodePositions[activeSegmentIndex].y}
                 C ${segmentControls[activeSegmentIndex].cp1.x} ${segmentControls[activeSegmentIndex].cp1.y},
                   ${segmentControls[activeSegmentIndex].cp2.x} ${segmentControls[activeSegmentIndex].cp2.y},
                   ${nodePositions[activeSegmentIndex + 1].x} ${nodePositions[activeSegmentIndex + 1].y}`}
              fill="none"
              stroke="#00f2fe"
              strokeWidth="4.2"
              strokeDasharray="2 1"
              filter="url(#activeSegmentGlow)"
              className="animate-pulse"
            />
          )}
        </svg>

        {/* Trailing Footsteps / Sparkles */}
        {trailSparkles.map((sp) => (
          <span
            key={sp.id}
            className="animate-pop-in pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-sm font-bold drop-shadow-[0_0_8px_rgba(0,242,254,0.9)] md:text-base"
            style={{
              left: `${sp.x}%`,
              top: `${sp.y}%`,
              color: sp.color,
            }}
          >
            {sp.symbol}
          </span>
        ))}

        {/* Confetti Explosion Pieces */}
        {confetti.map((c) => (
          <div
            key={c.id}
            className="animate-float pointer-events-none absolute rounded-sm"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: `${c.size}px`,
              height: `${c.size}px`,
              backgroundColor: c.color,
              transform: `rotate(${c.rot}deg)`,
              boxShadow: `0 0 10px ${c.color}`,
            }}
          />
        ))}

        {/* Interactive Trail Nodes */}
        <div className="absolute inset-0">
          {trail.map((node, index) => {
            const pos = nodePositions[index];
            const isUnlocked = unlockedNodeIds.includes(node.nodeId);
            const hasEnoughSparks = sparks >= node.requiredSparks;
            const isPlayable = isUnlocked && hasEnoughSparks;
            const isCompleted = index < latestUnlockedIndex || (index === 4 && isPlayable);
            const isCurrent = index === latestUnlockedIndex;
            const Icon = getNodeIcon(node.iconType);

            return (
              <div
                key={node.nodeId}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                {/* Trail Node Button */}
                <button
                  type="button"
                  id={`trail-node-${node.nodeId}`}
                  onClick={() => handleNodeClick(node)}
                  aria-label={`${node.title}, Spot ${index + 1} of 5. ${
                    isPlayable ? 'Ready to play' : 'Locked'
                  }`}
                  className={clsx(
                    'group relative flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 transition-all duration-300 md:h-24 md:w-24',
                    isPlayable
                      ? isCurrent
                        ? 'border-zuno-cyan bg-zuno-cyan/25 shadow-glow-cyan scale-110 animate-glow-pulse'
                        : 'border-zuno-gold/80 bg-zuno-gold/20 shadow-glow-gold hover:scale-105 active:scale-95'
                      : 'border-white/10 bg-zuno-night/80 opacity-60 hover:opacity-80',
                  )}
                >
                  {/* Icon */}
                  {isPlayable ? (
                    <Icon
                      className={clsx(
                        'h-9 w-9 transition-transform duration-200 group-hover:scale-110 md:h-11 md:w-11',
                        isCurrent
                          ? 'text-zuno-cyan'
                          : isCompleted
                            ? 'text-zuno-gold'
                            : 'text-zuno-lavender',
                      )}
                      strokeWidth={2.4}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <Lock className="h-6 w-6 text-zuno-lavender/50 md:h-7 md:w-7" />
                      {node.requiredSparks > sparks && (
                        <span className="flex items-center text-[10px] font-bold text-zuno-gold">
                          <Zap className="h-3 w-3 fill-zuno-gold" />
                          {node.requiredSparks}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Spot Number Pill */}
                  <span
                    className={clsx(
                      'absolute -bottom-2.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors',
                      isPlayable
                        ? 'bg-zuno-night border border-zuno-gold text-zuno-gold'
                        : 'bg-white/10 text-zuno-lavender/40',
                    )}
                  >
                    {index + 1}
                  </span>
                </button>

                {/* Spot Title Badge */}
                <div className="pointer-events-none mt-3.5 text-center">
                  <span
                    className={clsx(
                      'block max-w-[120px] truncate text-xs font-bold md:text-sm',
                      isPlayable ? 'text-zuno-lavender' : 'text-zuno-lavender/40',
                    )}
                  >
                    {node.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Animated Zuno Mascot sitting / hopping along the trail */}
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-transform"
          style={{
            left: `${zunoDisplayPos.x}%`,
            top: `${zunoDisplayPos.y - 10}%`,
          }}
        >
          <div className={clsx('flex flex-col items-center', !animating && 'animate-float')}>
            <ZunoMascot mood={animating ? 'HAPPY_LEAP' : 'AWAKE_POP'} size={94} />
            <div className="mt-[-6px] text-center">
              <span className="rounded-full bg-zuno-cyan/90 px-2.5 py-0.5 text-[11px] font-bold text-zuno-night shadow-glow-cyan">
                {animating ? 'Hopping ahead! 🐾' : 'Zuno is here!'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Celebratory Unlock Modal Dialogue upon reaching a new spot! */}
      {unlockedModalNode && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zuno-night/80 p-4 backdrop-blur-md"
        >
          <div className="glass-card animate-pop-in relative flex max-w-sm flex-col items-center gap-3 border-2 border-zuno-gold/60 p-6 text-center shadow-glow-gold">
            <div className="animate-float -mt-10">
              <ZunoMascot mood="HAPPY_LEAP" size={140} />
            </div>

            <span className="rounded-full bg-zuno-gold/20 px-3 py-1 text-xs font-bold text-zuno-gold">
              🌟 Trail Spot Unlocked!
            </span>

            <h2 className="text-gradient text-3xl font-bold">
              {unlockedModalNode.title}
            </h2>

            <p className="text-base text-zuno-lavender/80">
              Zuno hopped all the way to Spot {unlockedModalNode.nodeIndex + 1}! Your Wait-Power opened the path!
            </p>

            <button
              type="button"
              id="btn-play-unlocked-spot"
              onClick={() => {
                zunoAudio.playTap();
                setUnlockedModalNode(null);
                onSelectNode(unlockedModalNode);
              }}
              className="zuno-btn-primary mt-2 min-h-[64px] w-full text-xl"
            >
              <Play className="h-6 w-6" fill="currentColor" /> Play This Spot!
            </button>

            <button
              type="button"
              onClick={() => {
                zunoAudio.playTap();
                setUnlockedModalNode(null);
              }}
              className="text-sm font-semibold text-zuno-lavender/60 hover:text-zuno-lavender"
            >
              Explore Map First
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
