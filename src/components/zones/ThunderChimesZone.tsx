import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import clsx from 'clsx';
import { zunoAudio } from '../../audio/ZunoSynth';
import type { ZunoMood } from '../../canvas/ZunoSpriteRenderer';
import ZunoMascot from '../ZunoMascot';
import { TOTAL_TRIALS, createPointerGuard, median, percent, type ZoneProps } from './shared';

interface PadDef {
  name: string;
  /** "r, g, b" triplet for rgba() composition. */
  rgb: string;
}

const PADS: readonly PadDef[] = [
  { name: 'Cyan Spark', rgb: '0, 242, 254' },
  { name: 'Zuno Violet', rgb: '168, 85, 247' },
  { name: 'Wait-Power Gold', rgb: '251, 191, 36' },
  { name: 'Emerald Glow', rgb: '52, 211, 153' },
];

type ChimePhase = 'listen' | 'echo' | 'feedback' | 'done';

interface Engine {
  tap: (padIndex: number) => void;
}

function buildSequence(length: number): number[] {
  const seq: number[] = [];
  for (let i = 0; i < length; i += 1) {
    let next = Math.floor(Math.random() * PADS.length);
    // Avoid three identical notes in a row for readability.
    if (i >= 2 && seq[i - 1] === next && seq[i - 2] === next) next = (next + 1) % PADS.length;
    seq.push(next);
  }
  return seq;
}

export default function ThunderChimesZone({ nodeConfig, onProgress, onFinish }: ZoneProps) {
  const progressRef = useRef(onProgress);
  const finishRef = useRef(onFinish);
  progressRef.current = onProgress;
  finishRef.current = onFinish;

  const engineRef = useRef<Engine | null>(null);
  const guard = useRef(createPointerGuard(1)).current;

  // Derive sequence note length from nodeIndex (Node 1: 2, Node 2: 3, Node 3: 3 with distractor, Node 4: 4, Node 5: 5)
  const length = Math.min(5, Math.max(2, nodeConfig.nodeIndex >= 2 ? nodeConfig.nodeIndex + 1 : nodeConfig.nodeIndex + 2));

  const [phase, setPhase] = useState<ChimePhase>('listen');
  const [lit, setLit] = useState<number | null>(null);
  const [mood, setMood] = useState<ZunoMood>('AWAKE_POP');
  const [message, setMessage] = useState('Get ready to listen…');
  const [echoPos, setEchoPos] = useState(0);
  const [seqLength, setSeqLength] = useState(length);

  useEffect(() => {
    const release = (event: PointerEvent): void => guard.up(event);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [guard]);

  useEffect(() => {
    let disposed = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number): void => {
      const id = window.setTimeout(() => {
        if (!disposed) fn();
      }, ms);
      timers.push(id);
    };

    setSeqLength(length);

    const startTime = performance.now();
    let trialIdx = 0;
    let seq: number[] = [];
    let ePos = 0;
    let localPhase: ChimePhase = 'listen';
    let poofThisTrial = false;
    let lastPoofAt = -10_000;
    let echoStart = 0;
    let firstTapRecorded = false;
    let moodToken = 0;

    const partials: number[] = [];
    const reactions: number[] = [];
    let waitedTrials = 0;
    let poofs = 0;
    let sparks = 0;

    const changePhase = (next: ChimePhase): void => {
      localPhase = next;
      setPhase(next);
    };

    const flashMood = (next: ZunoMood, returnTo: ZunoMood, ms: number): void => {
      moodToken += 1;
      const token = moodToken;
      setMood(next);
      later(() => {
        if (token === moodToken) setMood(returnTo);
      }, ms);
    };

    const finishRound = (): void => {
      changePhase('done');
      setMood('HAPPY_LEAP');
      setMessage('Zuno loved your music!');
      finishRef.current({
        waitPowerScore: percent(waitedTrials, TOTAL_TRIALS),
        popAccuracyScore: Math.round((partials.reduce((a, b) => a + b, 0) / TOTAL_TRIALS) * 100),
        medianReactionMs: Math.round(median(reactions)),
        staticPoofCount: poofs,
        durationMs: Math.round(performance.now() - startTime),
        sparksEarned: sparks,
      });
    };

    const nextTrial = (): void => {
      trialIdx += 1;
      if (trialIdx >= TOTAL_TRIALS) finishRound();
      else startTrial();
    };

    const beginEcho = (): void => {
      changePhase('echo');
      ePos = 0;
      setEchoPos(0);
      echoStart = performance.now();
      firstTapRecorded = false;
      setMood('AWAKE_POP');
      setMessage('Your turn! Echo Zuno’s song.');
      zunoAudio.playPopCue();
    };

    const playStep = (k: number): void => {
      if (k >= seq.length) {
        later(beginEcho, 350);
        return;
      }
      setLit(seq[k]);
      zunoAudio.playCrystalNote(seq[k]);
      later(() => {
        setLit(null);
        later(() => playStep(k + 1), 260);
      }, 620);
    };

    function startTrial(): void {
      seq = buildSequence(length);
      poofThisTrial = false;
      changePhase('listen');
      setEchoPos(0);
      setLit(null);
      setMood('AWAKE_POP');
      setMessage('Listen to Zuno play…');
      later(() => playStep(0), 1000);
    }

    const concludeTrial = (success: boolean): void => {
      changePhase('feedback');
      if (!poofThisTrial) waitedTrials += 1;
      if (success) {
        partials.push(1);
        sparks += poofThisTrial ? 1 : 2;
        setMood('HAPPY_LEAP');
        setMessage(poofThisTrial ? '+1 Spark! Great echo!' : '+2 Sparks! Echo + Wait-Power!');
        later(() => (poofThisTrial ? zunoAudio.playPopWin() : zunoAudio.playWaitPowerWin()), 320);
      } else {
        partials.push(ePos / seq.length);
        setMood('AWAKE_POP');
        setMessage('Almost! Zuno will play a new song.');
        later(() => zunoAudio.playSoftMiss(), 260);
      }
      progressRef.current(trialIdx + 1);
      later(nextTrial, success ? 1700 : 1900);
    };

    engineRef.current = {
      tap: (padIndex: number): void => {
        const now = performance.now();
        if (localPhase === 'listen') {
          // Impulsive tap while Zuno is still playing → friendly Static Poof.
          if (now - lastPoofAt > 600) {
            poofs += 1;
            lastPoofAt = now;
          }
          poofThisTrial = true;
          zunoAudio.playStaticPoof();
          flashMood('STATIC_POOF', 'AWAKE_POP', 800);
          setMessage('Wait for Zuno to finish playing first!');
          return;
        }
        if (localPhase !== 'echo') return;

        if (!firstTapRecorded) {
          firstTapRecorded = true;
          reactions.push(now - echoStart);
        }
        zunoAudio.playCrystalNote(padIndex);
        setLit(padIndex);
        later(() => setLit((current) => (current === padIndex ? null : current)), 260);

        if (padIndex === seq[ePos]) {
          ePos += 1;
          setEchoPos(ePos);
          if (ePos >= seq.length) concludeTrial(true);
        } else {
          concludeTrial(false);
        }
      },
    };

    startTrial();

    return () => {
      disposed = true;
      engineRef.current = null;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [length, nodeConfig]);

  const onPadDown = (event: ReactPointerEvent<HTMLButtonElement>, index: number): void => {
    event.preventDefault();
    if (!guard.down(event)) return;
    engineRef.current?.tap(index);
  };

  const padSize = 'clamp(120px, min(34vh, 42vw), 340px)';
  const messageTone =
    mood === 'STATIC_POOF' ? 'text-zuno-coral' : phase === 'echo' ? 'text-zuno-cyan' : 'text-zuno-lavender';

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 py-2 md:gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <ZunoMascot mood={mood} size={160} className="max-h-[22vh] w-auto" />
        <div className="glass-card max-w-xs px-5 py-3 md:max-w-md">
          <p className={clsx('text-lg font-semibold leading-snug md:text-2xl', messageTone)} aria-live="polite">
            {message}
          </p>
          <div className="mt-2 flex gap-2" aria-label="Echo progress">
            {Array.from({ length: seqLength }, (_, i) => (
              <span
                key={i}
                className={clsx(
                  'h-3 w-3 rounded-full transition-all duration-200 md:h-4 md:w-4',
                  i < echoPos ? 'scale-110 bg-zuno-gold shadow-glow-gold' : 'bg-white/20',
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 md:gap-5" role="group" aria-label="Thunder Chime crystals">
        {PADS.map((pad, i) => {
          const isLit = lit === i;
          const interactive = phase === 'echo';
          return (
            <button
              key={pad.name}
              type="button"
              id={`crystal-pad-${i}`}
              aria-label={pad.name}
              onPointerDown={(event) => onPadDown(event, i)}
              onContextMenu={(event) => event.preventDefault()}
              className={clsx(
                'crystal-gem relative overflow-hidden rounded-[2rem] border-[3px] border-white/30 text-center',
                isLit ? 'z-10 scale-110 brightness-150' : interactive ? 'animate-glow-pulse' : 'opacity-80',
              )}
              style={{
                width: padSize,
                height: padSize,
                background: `radial-gradient(circle at 30% 24%, rgba(255,255,255,0.85), rgba(255,255,255,0) 34%), linear-gradient(145deg, rgba(${pad.rgb}, 1), rgba(${pad.rgb}, 0.45))`,
                boxShadow: isLit
                  ? `0 0 90px 22px rgba(${pad.rgb}, 0.85), inset 0 0 40px rgba(255,255,255,0.6)`
                  : `0 0 28px rgba(${pad.rgb}, 0.4), inset 0 -10px 24px rgba(15,10,44,0.35)`,
              }}
            >
              <span
                aria-hidden="true"
                className="absolute left-[12%] top-[10%] h-[18%] w-[34%] rotate-[-18deg] rounded-full bg-white/35 blur-[2px]"
              />
              <span className="absolute inset-x-0 bottom-3 px-2 text-sm font-bold text-zuno-night/80 md:text-base">
                {pad.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
