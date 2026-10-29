import { useState } from 'react';
import clsx from 'clsx';
import {
  ArrowLeft,
  Crown,
  Lock,
  Moon,
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

  const unlockedNodeIds = explorer.unlockedNodes?.[zoneId] ?? [trail[0].nodeId];
  const sparks = explorer.sparksCollected ?? 0;

  // The latest unlocked node where Zuno currently rests
  const latestUnlockedIndex = trail.reduce((acc, node, idx) => {
    return unlockedNodeIds.includes(node.nodeId) && sparks >= node.requiredSparks ? idx : acc;
  }, 0);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  };

  const handleNodeClick = (node: NodeConfig) => {
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

  // Node coordinates along a gentle winding S-curve (in percentages for responsive SVG path)
  // 5 nodes from bottom to top (or top to bottom)
  // Let's layout:
  // Node 0: (25%, 85%)
  // Node 1: (68%, 68%)
  // Node 2: (32%, 50%)
  // Node 3: (72%, 32%)
  // Node 4: (50%, 14%)
  const nodePositions = [
    { x: 30, y: 84 },
    { x: 70, y: 67 },
    { x: 28, y: 50 },
    { x: 72, y: 33 },
    { x: 50, y: 15 },
  ];

  return (
    <div className="twilight-sky fixed inset-0 z-30 flex flex-col" id="zone-trail-map">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-zuno-night/80 px-4 backdrop-blur md:h-20 md:px-8">
        <button
          type="button"
          id="btn-trail-back"
          onClick={() => {
            zunoAudio.playTap();
            onBack();
          }}
          aria-label="Back to Twilight Woods"
          className="zuno-btn-ghost h-12 w-12 shrink-0 md:h-14 md:w-14"
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
          className="animate-pop-in fixed top-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-zuno-gold/50 bg-zuno-night/95 px-6 py-3 text-base font-bold text-zuno-gold shadow-glow-gold backdrop-blur-md"
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
          </defs>

          {/* Glowing dashed trail line */}
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
            className="animate-pulse"
          />
        </svg>

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
                {/* Zuno Mascot Sitting physically on the Current Node! */}
                {isCurrent && (
                  <div className="animate-float pointer-events-none absolute -top-20 left-1/2 z-20 -translate-x-1/2 md:-top-24">
                    <ZunoMascot mood="HAPPY_LEAP" size={90} />
                    <div className="mt-[-8px] text-center">
                      <span className="rounded-full bg-zuno-cyan/80 px-2 py-0.5 text-[11px] font-bold text-zuno-night shadow-glow-cyan">
                        Zuno is here!
                      </span>
                    </div>
                  </div>
                )}

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
      </main>
    </div>
  );
}
