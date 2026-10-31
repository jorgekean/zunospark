import { useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Award,
  Brain,
  CheckCircle2,
  CloudOff,
  Compass,
  Crown,
  Delete,
  Flame,
  Heart,
  Hourglass,
  Lightbulb,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Unlock,
  UserPlus,
  X,
} from 'lucide-react';
import { createExplorer, db, unlockAllLevels, type SparkSession } from '../db/zunoDb';
import { getNodeConfig } from '../data/zoneNodes';
import { useZunoStore } from '../store/useZunoStore';
import { iapService } from '../services/iapService';
import { ZONE_INFO } from './GameStage';
import { median } from './zones/shared';
import HoldButton from './HoldButton';

/* ------------------------------------------------------------------ */
/*  Parent Gate (Grown-ups Only Verification)                          */
/* ------------------------------------------------------------------ */

interface ParentGateProps {
  onUnlock: () => void;
}

function newQuestion(): { a: number; b: number } {
  return { a: 4 + Math.floor(Math.random() * 6), b: 3 + Math.floor(Math.random() * 6) };
}

/**
 * Parent Gate for the main hub: hold the button for 1.5 s, or solve a simple
 * arithmetic check (e.g. 4 + 3 = ?). Either route opens the dashboard.
 */
export function ParentGateButton({ onUnlock }: ParentGateProps) {
  const [checking, setChecking] = useState(false);
  const [question, setQuestion] = useState(newQuestion);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);

  const openCheck = (): void => {
    setQuestion(newQuestion());
    setAnswer('');
    setWrong(false);
    setChecking(true);
  };

  const submit = (): void => {
    if (parseInt(answer, 10) === question.a + question.b) {
      setChecking(false);
      onUnlock();
    } else {
      setWrong(true);
      setAnswer('');
      setQuestion(newQuestion());
    }
  };

  const press = (digit: string): void => {
    setWrong(false);
    setAnswer((current) => (current.length >= 2 ? current : current + digit));
  };

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <HoldButton
          ariaLabel="Parent Growth Dashboard. Press and hold for one and a half seconds."
          onComplete={onUnlock}
          className="zuno-btn-ghost h-14 gap-2 px-5 text-base"
        >
          <LockKeyhole className="h-5 w-5" /> Parent Dashboard
        </HoldButton>
        <button
          type="button"
          id="btn-parent-math"
          onClick={openCheck}
          className="text-xs font-medium text-zuno-lavender/60 underline-offset-2 hover:text-zuno-lavender hover:underline"
        >
          Hold 1.5s · or solve a quick check
        </button>
      </div>

      {checking && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-zuno-night/85 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Parent check"
        >
          <div className="glass-card animate-pop-in w-full max-w-sm p-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-zuno-cyan" />
            <h2 className="mt-2 text-2xl font-bold text-zuno-lavender">Grown-ups only</h2>
            <p className="mt-1 text-sm text-zuno-lavender/70">Solve this to open the Parent dashboard.</p>
            <p className={clsx('my-4 text-5xl font-bold', wrong ? 'animate-wiggle text-zuno-coral' : 'text-zuno-gold')}>
              {question.a} + {question.b} = {answer || '?'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} type="button" onClick={() => press(d)} className="zuno-btn-ghost h-14 text-2xl">
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAnswer((a) => a.slice(0, -1))}
                aria-label="Delete digit"
                className="zuno-btn-ghost h-14"
              >
                <Delete className="h-6 w-6" />
              </button>
              <button type="button" onClick={() => press('0')} className="zuno-btn-ghost h-14 text-2xl">
                0
              </button>
              <button
                type="button"
                id="btn-parent-math-ok"
                onClick={submit}
                disabled={!answer}
                className="zuno-btn-primary h-14 text-xl disabled:opacity-40"
              >
                OK
              </button>
            </div>
            <button
              type="button"
              onClick={() => setChecking(false)}
              className="mt-4 text-sm text-zuno-lavender/60 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers & Formatting                                               */
/* ------------------------------------------------------------------ */

const AVATARS = ['⚡', '🦊', '🌟', '🦄', '🐯', '🐼', '🚀', '🌈'];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Human-friendly relative time for parents */
function formatFriendlyTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

type GrowthStatus = 'Thriving' | 'Steady Progress' | 'Growing';

interface BehavioralCardData {
  id: string;
  title: string;
  sublabel: string;
  status: GrowthStatus;
  statusColor: string;
  badgeBg: string;
  Icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  cardGlow: string;
  metricPill: string;
  parentNote: string;
  homeTip: string;
}

interface ParentSparkDashboardProps {
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Main Component: ParentSparkDashboard                              */
/* ------------------------------------------------------------------ */

export default function ParentSparkDashboard({ onClose }: ParentSparkDashboardProps) {
  const activeExplorer = useZunoStore((s) => s.activeExplorer);
  const switchExplorer = useZunoStore((s) => s.switchExplorer);
  const isFullAdventureUnlocked = useZunoStore((s) => s.isFullAdventureUnlocked);
  const openPaywall = useZunoStore((s) => s.openPaywall);
  const setFullAdventureUnlocked = useZunoStore((s) => s.setFullAdventureUnlocked);

  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreMessage(null);
    try {
      const res = await iapService.restorePurchases();
      if (res.purchased) {
        setFullAdventureUnlocked(true);
        setRestoreMessage('✨ Purchases successfully restored! Full Adventure Pass is active.');
      } else {
        setRestoreMessage(res.message || 'No prior purchase found for this account.');
      }
    } catch {
      setRestoreMessage('Could not restore purchases right now.');
    } finally {
      setRestoring(false);
    }
  };

  const explorers = useLiveQuery(() => db.explorers.orderBy('createdAt').toArray(), []);
  const explorerId = activeExplorer?.id ?? null;
  const sessions = useLiveQuery(
    () =>
      explorerId
        ? db.sessions.where('explorerId').equals(explorerId).toArray()
        : Promise.resolve([] as SparkSession[]),
    [explorerId],
  );

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState(4);
  const [badge, setBadge] = useState(AVATARS[2]);
  const [busy, setBusy] = useState(false);

  /* ------------------------------------------------------------------ */
  /*  Data-to-Behavior Translation Engine                               */
  /* ------------------------------------------------------------------ */
  const metrics = useMemo(() => {
    const list = [...(sessions ?? [])].sort((a, b) => a.timestamp - b.timestamp);
    const reactions = list.map((s) => s.medianReactionMs).filter((ms) => ms > 0);
    const early = list.slice(0, 3);
    const late = list.slice(-3);
    const delta =
      list.length >= 4
        ? Math.round(mean(late.map((s) => s.waitPowerScore)) - mean(early.map((s) => s.waitPowerScore)))
        : null;

    const waitPowerIndex = list.length ? Math.round(mean(list.map((s) => s.waitPowerScore))) : 0;
    const popAccuracy = list.length ? Math.round(mean(list.map((s) => s.popAccuracyScore))) : 0;
    const latency = reactions.length ? Math.round(median(reactions)) : 0;
    const totalPoofs = list.reduce((sum, s) => sum + s.staticPoofCount, 0);
    const gritAvg = list.length ? totalPoofs / list.length : 0;

    return {
      list,
      waitPowerIndex,
      popAccuracy,
      latency,
      totalPoofs,
      gritAvg,
      delta,
    };
  }, [sessions]);

  const history = useMemo(() => [...metrics.list].reverse().slice(0, 15), [metrics.list]);
  const explorerName = activeExplorer?.name ?? 'Explorer';

  // Dynamic Superpower Hero Message
  const heroInsight = useMemo(() => {
    if (metrics.list.length === 0) {
      return {
        headline: `Welcome to ${explorerName}'s Growth Journey! 🌱`,
        body: `Play your first 2-minute trail round in the Twilight Woods with Zuno to start mapping real-world behavioral milestones.`,
        badgeText: 'Ready to Start',
      };
    }

    if (metrics.delta !== null && metrics.delta >= 6) {
      return {
        headline: `🌟 Great news! ${explorerName}'s Waiting Power improved by ${metrics.delta}% this week!`,
        body: `Showing fantastic progress during transition moments and pause signals. Those intentional neural brakes are growing stronger!`,
        badgeText: `+${metrics.delta}% Growth This Week`,
      };
    }

    if (metrics.waitPowerIndex >= 80) {
      return {
        headline: `🌟 Golden Patience Superpower Unlocked!`,
        body: `${explorerName} is excelling at pausing before reacting (${metrics.waitPowerIndex}% Patience Index). Expect calmer grocery trips, fewer transition meltdowns, and smoother turn-taking!`,
        badgeText: 'Patience Champion',
      };
    }

    if (metrics.gritAvg <= 1.2 && metrics.list.length >= 3) {
      return {
        headline: `🛡️ Outstanding Frustration Grit!`,
        body: `${explorerName} stays calm and resets with gentle determination even when micro-games speed up. Remarkable emotional resilience for age ${activeExplorer?.ageYears || 4}!`,
        badgeText: 'Resilience Star',
      };
    }

    if (metrics.popAccuracy >= 82) {
      return {
        headline: `🧠 Excellent Multi-Step Direction Recall!`,
        body: `${explorerName} remembered visual and musical patterns with high precision (${metrics.popAccuracy}%). A wonderful foundation for morning and bedtime routines!`,
        badgeText: 'Direction Master',
      };
    }

    return {
      headline: `✨ Steady, Joyful Progress!`,
      body: `${explorerName} has completed ${metrics.list.length} self-regulation micro-rounds. Every round builds lasting impulse control and focused patience.`,
      badgeText: `${metrics.list.length} Sessions Logged`,
    };
  }, [metrics, explorerName, activeExplorer]);

  // 4 Behavioral Skill Cards
  const behavioralCards: BehavioralCardData[] = useMemo(() => {
    const hasData = metrics.list.length > 0;

    // 1. Patience & Waiting Power
    const patienceStatus: GrowthStatus =
      !hasData || metrics.waitPowerIndex >= 78
        ? 'Thriving'
        : metrics.waitPowerIndex >= 58
          ? 'Steady Progress'
          : 'Growing';

    // 2. Focus & Attention Span
    const focusStatus: GrowthStatus =
      !hasData || (metrics.latency > 0 && metrics.latency <= 900 && metrics.waitPowerIndex >= 65)
        ? 'Thriving'
        : metrics.latency <= 1350
          ? 'Steady Progress'
          : 'Growing';

    // 3. Following Multi-Step Directions
    const directionStatus: GrowthStatus =
      !hasData || metrics.popAccuracy >= 80
        ? 'Thriving'
        : metrics.popAccuracy >= 62
          ? 'Steady Progress'
          : 'Growing';

    // 4. Frustration Grit & Resilience
    const gritStatus: GrowthStatus =
      !hasData || metrics.gritAvg <= 1.2
        ? 'Thriving'
        : metrics.gritAvg <= 2.6
          ? 'Steady Progress'
          : 'Growing';

    const getStatusStyle = (status: GrowthStatus) => {
      switch (status) {
        case 'Thriving':
          return {
            statusColor: 'text-emerald-400',
            badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          };
        case 'Steady Progress':
          return {
            statusColor: 'text-amber-300',
            badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          };
        default:
          return {
            statusColor: 'text-cyan-300',
            badgeBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
          };
      }
    };

    return [
      {
        id: 'skill-patience',
        title: 'Patience & Waiting Power',
        sublabel: 'Impulse control & pausing before reacting',
        status: patienceStatus,
        ...getStatusStyle(patienceStatus),
        Icon: Hourglass,
        accentColor: 'text-zuno-gold',
        cardGlow: 'from-amber-500/15 via-purple-900/10 to-transparent border-amber-500/30',
        metricPill: hasData ? `${metrics.waitPowerIndex}% Success` : 'Initial Trial',
        parentNote:
          'Measures ability to resist rapid impulse taps until the right moment. Directly translates to fewer grocery store meltdowns, patient turn-taking, and waiting without restless outbursts.',
        homeTip:
          metrics.waitPowerIndex >= 75
            ? 'At home: Demonstrating noticeable self-restraint when asked to wait a minute.'
            : 'At home: Strengthening neural brakes for calmer transitions between play and dinner.',
      },
      {
        id: 'skill-focus',
        title: 'Deep Focus & Staying On Track',
        sublabel: 'Attention span & cognitive stability',
        status: focusStatus,
        ...getStatusStyle(focusStatus),
        Icon: Target,
        accentColor: 'text-zuno-cyan',
        cardGlow: 'from-cyan-500/15 via-blue-900/10 to-transparent border-cyan-500/30',
        metricPill: hasData && metrics.latency ? `${metrics.latency} ms Smooth Pace` : 'Focused',
        parentNote:
          'Measures sustained attention and resistance to distractions. Relates to completing drawings or puzzles, sitting through storytime, and hearing requests the first time.',
        homeTip:
          metrics.latency > 0 && metrics.latency <= 950
            ? 'At home: Attentive and calm without rushed, hyperactive tapping.'
            : 'At home: Practicing staying locked into an activity from start to finish.',
      },
      {
        id: 'skill-directions',
        title: 'Following Multi-Step Directions',
        sublabel: 'Working memory & auditory retention',
        status: directionStatus,
        ...getStatusStyle(directionStatus),
        Icon: Compass,
        accentColor: 'text-purple-300',
        cardGlow: 'from-purple-500/15 via-indigo-900/10 to-transparent border-purple-500/30',
        metricPill: hasData ? `${metrics.popAccuracy}% Accuracy` : 'Exploring',
        parentNote:
          'Measures active working memory retention. Directly relates to remembering 2-step morning routines (shoes + coat), washing hands without prompts, and following instructions.',
        homeTip:
          metrics.popAccuracy >= 75
            ? 'At home: Reliably holds multi-step visual and musical patterns in active memory.'
            : 'At home: Practice 2-step playful chores at home to reinforce this rhythm.',
      },
      {
        id: 'skill-grit',
        title: 'Frustration Grit & Resilience',
        sublabel: 'Calm recovery & trying again',
        status: gritStatus,
        ...getStatusStyle(gritStatus),
        Icon: Flame,
        accentColor: 'text-rose-300',
        cardGlow: 'from-rose-500/15 via-pink-900/10 to-transparent border-rose-500/30',
        metricPill: hasData ? `${metrics.totalPoofs} Soft Poofs` : 'Gentle',
        parentNote:
          'Measures emotional recovery when something unexpected happens. Relates to trying again when block towers tumble or zippers get stuck, instead of bursting into tears.',
        homeTip:
          metrics.gritAvg <= 1.5
            ? 'At home: Resets calmly after slips, treating mistakes as playful sparks.'
            : 'At home: Remind them: "Mistakes are just static poofs — shake them off and try again!"',
      },
    ];
  }, [metrics]);

  // Conversational Parent Talking Points
  const talkingPoint = useMemo(() => {
    if (metrics.waitPowerIndex < 70 && metrics.list.length > 0) {
      return `When you're eating dinner tonight, play the "Pause Game" — praise ${explorerName} specifically when they wait for their turn to speak, reminding them how Zuno waits for the golden glow!`;
    }
    if (metrics.popAccuracy < 70 && metrics.list.length > 0) {
      return `Try giving 2-step playful chores at home ("Put your shoes by the door, then bring your hat") to build on the working-memory rhythms ${explorerName} practiced with Thunder Chimes.`;
    }
    if (metrics.gritAvg > 2.2 && metrics.list.length > 0) {
      return `When a puzzle or jacket zipper gets tricky today, whisper Zuno's calming cue: "Take a soft fox breath, shake off the static, and let's try one more time together!" Celebrate the effort, not just the outcome.`;
    }
    return `Mention Zuno at bedtime! Ask ${explorerName}: "Did you use your Wait-Power today when you had to wait for snack time?" Connecting game milestones to real life locks in self-regulation habits.`;
  }, [metrics, explorerName]);

  const onCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const created = await createExplorer(name, age, badge);
      switchExplorer(created);
      setName('');
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-zuno-night/90 backdrop-blur-md md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Parent Behavioral Growth Dashboard"
    >
      <div className="glass-card flex h-full w-full max-w-5xl flex-col overflow-hidden md:rounded-[2.5rem]">
        {/* A. Header & Protected Access */}
        <header className="safe-header relative z-40 flex shrink-0 items-center gap-3 border-b border-white/10 px-4 md:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zuno-night shadow-glow-gold">
            <Heart className="h-6 w-6 fill-current" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold text-zuno-lavender md:text-2xl">
              Parent Growth &amp; Behavioral Dashboard
            </h1>
            <p className="flex items-center gap-1.5 truncate text-xs text-zuno-lavender/70 md:text-sm">
              <span>Developmental &amp; Behavioral Report for</span>
              <span className="font-bold text-zuno-gold">{explorerName}</span>
              <span className="opacity-40">·</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-zuno-cyan">
                <CloudOff className="h-3 w-3" /> Private Offline Storage
              </span>
            </p>
          </div>

          <button
            type="button"
            id="btn-close-dashboard"
            onClick={onClose}
            aria-label="Close dashboard"
            className="zuno-btn-ghost relative z-50 h-11 w-11 shrink-0 touch-manipulation after:absolute after:-inset-2 after:content-[''] md:h-12 md:w-12"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="scroll-zone min-h-0 flex-1 space-y-6 p-4 md:p-8">
          {/* Explorer Switcher & Profile Bar */}
          <section aria-label="Explorer Profiles" className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zuno-lavender/60">
                Active Child:
              </span>
              {(explorers ?? []).map((explorer) => {
                const active = explorer.id === explorerId;
                return (
                  <button
                    key={explorer.id}
                    type="button"
                    onClick={() => switchExplorer(explorer)}
                    className={clsx(
                      'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-all',
                      active
                        ? 'border-zuno-gold bg-zuno-gold/20 text-zuno-gold shadow-glow-gold'
                        : 'border-white/15 bg-white/5 text-zuno-lavender hover:bg-white/10',
                    )}
                  >
                    <span className="text-lg">{explorer.avatarBadge}</span> {explorer.name}
                    <span className="text-xs opacity-70">({explorer.ageYears}y)</span>
                  </button>
                );
              })}
              <button
                type="button"
                id="btn-add-explorer"
                onClick={() => setShowForm((v) => !v)}
                className="zuno-btn-ghost h-11 px-3 text-xs font-semibold text-zuno-cyan"
              >
                <UserPlus className="h-4 w-4" /> Add Child
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-unlock-all"
                onClick={() => activeExplorer && void unlockAllLevels(activeExplorer.id)}
                className="zuno-btn-ghost h-9 px-3 text-xs font-medium text-zuno-lavender/60 hover:text-zuno-gold"
                title="Unlock all spots for testing"
              >
                <Unlock className="h-3.5 w-3.5" /> Unlock All Spots
              </button>
            </div>
          </section>

          {/* Add Explorer Form */}
          {showForm && (
            <form
              onSubmit={(event) => void onCreate(event)}
              className="animate-slide-up rounded-3xl border border-white/15 bg-white/5 p-5 backdrop-blur"
              aria-label="Add new child explorer"
            >
              <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                <label className="text-sm font-semibold text-zuno-lavender">
                  Child&apos;s Name
                  <input
                    id="input-explorer-name"
                    className="zuno-input mt-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Maya"
                    maxLength={24}
                    autoFocus
                  />
                </label>
                <label className="text-sm font-semibold text-zuno-lavender">
                  Age
                  <select
                    id="select-explorer-age"
                    className="zuno-input mt-1"
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value, 10))}
                  >
                    {[3, 4, 5, 6].map((a) => (
                      <option key={a} value={a}>
                        {a} years old
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Animal avatar">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={badge === a}
                    onClick={() => setBadge(a)}
                    className={clsx(
                      'h-11 w-11 rounded-2xl border text-xl transition',
                      badge === a
                        ? 'border-zuno-gold bg-zuno-gold/20 shadow-glow-gold scale-105'
                        : 'border-white/15 bg-white/5',
                    )}
                  >
                    {a}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  type="submit"
                  id="btn-save-explorer"
                  disabled={!name.trim() || busy}
                  className="zuno-btn-primary h-11 px-5 text-sm font-bold disabled:opacity-40"
                >
                  Save Child Profile
                </button>
              </div>
            </form>
          )}

          {/* Explorer Pass & In-App Purchase Card (Native Android) vs Web Edition Banner (PWA) */}
          {!iapService.isNative() ? (
            <section
              aria-label="Web PWA Full Access"
              className="rounded-3xl border border-zuno-cyan/30 bg-gradient-to-r from-cyan-500/15 via-purple-900/25 to-zuno-night p-5 backdrop-blur-md"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zuno-cyan/20 text-zuno-cyan">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-white md:text-lg">
                        Web Edition · All 15 Adventure Spots Free
                      </h2>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 100% Free Access
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zuno-lavender/70 md:text-sm">
                      You are playing the open web edition. All progressive challenge spots across all 3 clearings are completely free with zero ads.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section
              aria-label="Adventure Pass Status"
              className="rounded-3xl border border-zuno-gold/30 bg-gradient-to-r from-amber-500/15 via-purple-900/25 to-cyan-500/10 p-5 backdrop-blur-md"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={clsx(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border',
                      isFullAdventureUnlocked
                        ? 'border-zuno-gold bg-zuno-gold/20 text-zuno-gold shadow-glow-gold'
                        : 'border-white/20 bg-white/5 text-zuno-lavender',
                    )}
                  >
                    <Crown className="h-6 w-6 fill-current" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-extrabold text-zuno-lavender md:text-lg">
                        {isFullAdventureUnlocked ? 'Full Adventure Pass · Active' : 'ZunoSpark Adventure Pass'}
                      </h2>
                      {isFullAdventureUnlocked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Lifetime Family Access
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zuno-lavender/70 md:text-sm">
                      {isFullAdventureUnlocked
                        ? 'All 15 progressive challenge spots across all 3 clearings are permanently unlocked. Zero ads, 100% offline.'
                        : 'Spot 1 in all 3 clearings is free forever! Unlock Spots 2 through 5 across the entire game for a one-time payment of $19.00 USD.'}
                    </p>
                    {restoreMessage && (
                      <p className="mt-2 text-xs font-semibold text-zuno-gold animate-pop-in">
                        {restoreMessage}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!isFullAdventureUnlocked ? (
                    <button
                      type="button"
                      id="btn-parent-unlock-pass"
                      onClick={() => openPaywall()}
                      className="zuno-btn-primary flex h-11 items-center gap-2 px-5 text-sm font-bold shadow-glow-cyan"
                    >
                      <Crown className="h-4 w-4 fill-zuno-night" />
                      <span>Unlock Full Adventure · $19.00</span>
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-zuno-gold px-3.5 py-1.5 rounded-full border border-zuno-gold/40 bg-zuno-gold/10">
                      ✓ All Clearings Unlocked
                    </span>
                  )}

                  <button
                    type="button"
                    id="btn-parent-restore-purchases"
                    onClick={handleRestore}
                    disabled={restoring}
                    className="zuno-btn-ghost flex h-11 items-center gap-1.5 px-3.5 text-xs font-semibold disabled:opacity-50"
                  >
                    <RotateCcw className={clsx('h-3.5 w-3.5', restoring && 'animate-spin')} />
                    <span>{restoring ? 'Checking...' : 'Restore'}</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* B. The Hero Section: "This Week's Superpower" */}
          <section
            aria-label="Weekly Superpower"
            className="relative overflow-hidden rounded-3xl border border-zuno-cyan/40 bg-gradient-to-br from-cyan-500/15 via-purple-900/30 to-zuno-night p-6 shadow-glow-cyan/20 backdrop-blur"
          >
            <div className="absolute right-0 top-0 -mr-6 -mt-6 h-36 w-36 rounded-full bg-zuno-cyan/10 blur-2xl pointer-events-none" />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-zuno-cyan/40 bg-zuno-cyan/15 px-3 py-1 text-xs font-extrabold tracking-wide text-zuno-cyan">
                  <Sparkles className="h-3.5 w-3.5" /> THIS WEEK&apos;S SUPERPOWER
                </div>
                <h2 className="text-xl font-black text-white md:text-2xl">
                  {heroInsight.headline}
                </h2>
                <p className="max-w-2xl text-sm leading-relaxed text-zuno-lavender/85 md:text-base">
                  {heroInsight.body}
                </p>
              </div>

              <div className="shrink-0">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-zuno-gold/40 bg-zuno-gold/15 px-4 py-3 text-sm font-bold text-zuno-gold shadow-glow-gold">
                  <Award className="h-5 w-5 fill-current" />
                  <span>{heroInsight.badgeText}</span>
                </div>
              </div>
            </div>
          </section>

          {/* C. The Behavioral Growth Cards (Replacing Raw Metrics) */}
          <section aria-label="Behavioral Growth Insights" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zuno-lavender md:text-xl">
                  Behavioral Milestones &amp; Daily Life Impact
                </h2>
                <p className="text-xs text-zuno-lavender/60 md:text-sm">
                  How executive-function training in ZunoSpark translates to home, school, and dinner table habits.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {behavioralCards.map((card) => {
                const IconComponent = card.Icon;
                return (
                  <article
                    key={card.id}
                    id={card.id}
                    className={clsx(
                      'relative flex flex-col justify-between rounded-3xl border bg-gradient-to-br p-5 backdrop-blur transition-all duration-300 hover:border-white/20',
                      card.cardGlow,
                    )}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={clsx('flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10', card.accentColor)}>
                            <IconComponent className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white md:text-lg">
                              {card.title}
                            </h3>
                            <p className="text-xs text-zuno-lavender/70">
                              {card.sublabel}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold',
                            card.badgeBg,
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {card.status}
                        </span>
                      </div>

                      {/* Real-World Parenting Note */}
                      <div className="mt-4 rounded-2xl border border-white/5 bg-white/5 p-3.5">
                        <p className="text-xs leading-relaxed text-zuno-lavender/85 md:text-sm">
                          {card.parentNote}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Home Observation Note & Pill */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                      <p className="text-xs font-semibold text-zuno-gold/90">
                        {card.homeTip}
                      </p>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-zuno-lavender/80">
                        {card.metricPill}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* D. The Weekly Milestone Log (Clean Session History) */}
          <section aria-label="Recent Session Milestones" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-zuno-lavender md:text-xl">
                  Recent Adventure Sessions
                </h2>
                <p className="text-xs text-zuno-lavender/60 md:text-sm">
                  Gentle summaries of recent micro-game practice rounds.
                </p>
              </div>
              <span className="text-xs font-semibold text-zuno-lavender/50">
                {history.length} round{history.length === 1 ? '' : 's'} recorded
              </span>
            </div>

            {history.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
                <Brain className="mx-auto h-10 w-10 text-zuno-lavender/40" />
                <h3 className="mt-2 text-base font-bold text-zuno-lavender">No sessions recorded yet</h3>
                <p className="mt-1 text-xs text-zuno-lavender/60">
                  Head to the woods with {explorerName} and complete a 2-minute round to see their milestones appear here!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map((s) => {
                  const nodeConf = s.nodeId ? getNodeConfig(s.zoneId, s.nodeId) : null;
                  const zone = ZONE_INFO[s.zoneId];
                  const ZoneIcon = zone.Icon;

                  // Milestone badges
                  const patienceBadge =
                    s.waitPowerScore >= 80
                      ? { text: '⭐ High Patience', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
                      : s.waitPowerScore >= 60
                        ? { text: '✨ Steady Waiting', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
                        : { text: '🌱 Practicing Hold', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };

                  const gritBadge =
                    s.staticPoofCount === 0
                      ? { text: '🛡️ Zero Premature Taps', color: 'bg-emerald-500/15 text-emerald-300' }
                      : s.staticPoofCount <= 2
                        ? { text: '💪 Calm Reset', color: 'bg-amber-500/15 text-amber-300' }
                        : { text: '🐾 High Persistence', color: 'bg-purple-500/15 text-purple-300' };

                  // Child-friendly session takeaway
                  const sessionNote =
                    s.zoneId === 'spark_berry'
                      ? 'Practiced waiting for the golden glow before picking berries.'
                      : s.zoneId === 'thunder_chimes'
                        ? 'Listened closely to chime sequences and repeated the pattern.'
                        : 'Coordinated left and right hands together to guide spark currents.';

                  return (
                    <article
                      key={s.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/[0.08] md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br', zone.gradient)}>
                          <ZoneIcon className="h-5 w-5 text-zuno-night" strokeWidth={2.4} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-white">
                              {zone.title} · {nodeConf ? nodeConf.title : `Spot ${s.level}`}
                            </h4>
                            <span className="text-[11px] text-zuno-lavender/50">
                              {formatFriendlyTime(s.timestamp)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-zuno-lavender/70">
                            {sessionNote}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className={clsx('rounded-full border px-2.5 py-0.5 text-xs font-bold', patienceBadge.color)}>
                          {patienceBadge.text}
                        </span>
                        <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', gritBadge.color)}>
                          {gritBadge.text}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* E. The "Parent Talking Points" Footer */}
          <footer
            aria-label="Parent Talking Point"
            className="rounded-3xl border border-zuno-gold/40 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-600/10 p-5 shadow-glow-gold/15"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zuno-gold text-zuno-night shadow-glow-gold">
                <Lightbulb className="h-5 w-5 fill-current" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-zuno-gold uppercase tracking-wider">
                  Parent Talking Point for Today
                </h3>
                <p className="text-sm leading-relaxed text-zuno-lavender/90">
                  {talkingPoint}
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
