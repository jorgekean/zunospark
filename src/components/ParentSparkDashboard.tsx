import { useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { Brain, CloudOff, Gauge, LockKeyhole, ShieldCheck, Timer, Unlock, UserPlus, X, Zap, ChartColumn, Delete } from 'lucide-react';
import { createExplorer, db, unlockAllLevels, type SparkSession, type ZoneId } from '../db/zunoDb';
import { getNodeConfig } from '../data/zoneNodes';
import { useZunoStore } from '../store/useZunoStore';
import { ZONE_INFO } from './GameStage';
import { median } from './zones/shared';
import HoldButton from './HoldButton';

/* ------------------------------------------------------------------ */
/*  Parent Gate                                                        */
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
          ariaLabel="Parent ROI dashboard. Press and hold for one and a half seconds."
          onComplete={onUnlock}
          className="zuno-btn-ghost h-14 gap-2 px-5 text-base"
        >
          <LockKeyhole className="h-5 w-5" /> Parent ROI
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zuno-night/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Parent check">
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
              <button type="button" onClick={() => setAnswer((a) => a.slice(0, -1))} aria-label="Delete digit" className="zuno-btn-ghost h-14">
                <Delete className="h-6 w-6" />
              </button>
              <button type="button" onClick={() => press('0')} className="zuno-btn-ghost h-14 text-2xl">
                0
              </button>
              <button type="button" id="btn-parent-math-ok" onClick={submit} disabled={!answer} className="zuno-btn-primary h-14 text-xl disabled:opacity-40">
                OK
              </button>
            </div>
            <button type="button" onClick={() => setChecking(false)} className="mt-4 text-sm text-zuno-lavender/60 underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

const AVATARS = ['⚡', '🦊', '🌟', '🦄', '🐯', '🐼', '🚀', '🌈'];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return <p className="text-sm text-zuno-lavender/50">Play a few more rounds to see a trend.</p>;
  }
  const width = 320;
  const height = 80;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - (v / 100) * (height - 8) - 4}`);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" role="img" aria-label="Wait-Power trend across sessions">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const [x, y] = p.split(',');
        return <circle key={i} cx={x} cy={y} r={4} fill={color} />;
      })}
    </svg>
  );
}

interface ParentSparkDashboardProps {
  onClose: () => void;
}

export default function ParentSparkDashboard({ onClose }: ParentSparkDashboardProps) {
  const activeExplorer = useZunoStore((s) => s.activeExplorer);
  const switchExplorer = useZunoStore((s) => s.switchExplorer);
  const explorers = useLiveQuery(() => db.explorers.orderBy('createdAt').toArray(), []);
  const explorerId = activeExplorer?.id ?? null;
  const sessions = useLiveQuery(
    () => (explorerId ? db.sessions.where('explorerId').equals(explorerId).toArray() : Promise.resolve([] as SparkSession[])),
    [explorerId],
  );

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState(4);
  const [badge, setBadge] = useState(AVATARS[2]);
  const [busy, setBusy] = useState(false);

  const metrics = useMemo(() => {
    const list = [...(sessions ?? [])].sort((a, b) => a.timestamp - b.timestamp);
    const reactions = list.map((s) => s.medianReactionMs).filter((ms) => ms > 0);
    const early = list.slice(0, 3);
    const late = list.slice(-3);
    const delta = list.length >= 4 ? Math.round(mean(late.map((s) => s.waitPowerScore)) - mean(early.map((s) => s.waitPowerScore))) : null;

    const byZone = (['spark_berry', 'thunder_chimes', 'twin_currents'] as ZoneId[]).map((zone) => {
      const zoneSessions = list.filter((s) => s.zoneId === zone);
      return {
        zone,
        count: zoneSessions.length,
        waitPower: Math.round(mean(zoneSessions.map((s) => s.waitPowerScore))),
        accuracy: Math.round(mean(zoneSessions.map((s) => s.popAccuracyScore))),
      };
    });

    return {
      list,
      waitPowerIndex: Math.round(mean(list.map((s) => s.waitPowerScore))),
      popAccuracy: Math.round(mean(list.map((s) => s.popAccuracyScore))),
      latency: Math.round(median(reactions)),
      poofs: list.reduce((sum, s) => sum + s.staticPoofCount, 0),
      delta,
      byZone,
    };
  }, [sessions]);

  const history = useMemo(() => [...metrics.list].reverse().slice(0, 40), [metrics.list]);

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

  const cards = [
    { id: 'metric-wait-power', label: 'Wait-Power Index', value: `${metrics.waitPowerIndex}%`, hint: 'Inhibitory hold & impulse-delay success', Icon: Brain, color: 'text-zuno-gold', ring: 'from-zuno-gold/30' },
    { id: 'metric-pop-accuracy', label: 'Pop Accuracy', value: `${metrics.popAccuracy}%`, hint: 'Go & working-memory sequence accuracy', Icon: Zap, color: 'text-zuno-cyan', ring: 'from-zuno-cyan/30' },
    { id: 'metric-latency', label: 'Median Processing Latency', value: `${metrics.latency} ms`, hint: 'Prefrontal reaction speed', Icon: Timer, color: 'text-zuno-lavender', ring: 'from-zuno-violet/40' },
    { id: 'metric-poofs', label: 'Static Poofs', value: `${metrics.poofs}`, hint: 'Total impulsive premature taps', Icon: Gauge, color: 'text-zuno-coral', ring: 'from-zuno-coral/30' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-zuno-night/90 backdrop-blur-md md:p-6" role="dialog" aria-modal="true" aria-label="Parent ROI dashboard">
      <div className="glass-card flex h-full w-full max-w-5xl flex-col overflow-hidden md:rounded-[2rem]">
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 md:px-6">
          <ChartColumn className="h-7 w-7 text-zuno-cyan" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-zuno-lavender md:text-2xl">Parent Spark Dashboard</h1>
            <p className="flex items-center gap-1 text-xs text-zuno-lavender/60 md:text-sm">
              <CloudOff className="h-4 w-4" /> Stored privately on this device — works fully offline.
            </p>
          </div>
          <button type="button" id="btn-close-dashboard" onClick={onClose} aria-label="Close dashboard" className="zuno-btn-ghost h-12 w-12">
            <X className="h-6 w-6" />
          </button>
        </header>

        <div className="scroll-zone min-h-0 flex-1 space-y-5 p-4 md:p-6">
          {/* Explorer switcher */}
          <section aria-label="Explorers" className="flex flex-wrap items-center gap-2">
            {(explorers ?? []).map((explorer) => {
              const active = explorer.id === explorerId;
              return (
                <button
                  key={explorer.id}
                  type="button"
                  onClick={() => switchExplorer(explorer)}
                  className={clsx(
                    'inline-flex h-12 items-center gap-2 rounded-full border px-4 text-base font-semibold transition',
                    active ? 'border-zuno-cyan bg-zuno-cyan/15 text-zuno-cyan shadow-glow-cyan' : 'border-white/15 bg-white/5 text-zuno-lavender hover:bg-white/10',
                  )}
                >
                  <span className="text-xl">{explorer.avatarBadge}</span> {explorer.name}
                  <span className="text-xs opacity-70">· {explorer.ageYears}y</span>
                </button>
              );
            })}
            <button type="button" id="btn-add-explorer" onClick={() => setShowForm((v) => !v)} className="zuno-btn-ghost h-12 px-4 text-base">
              <UserPlus className="h-5 w-5" /> Add New Explorer
            </button>
          </section>

          {showForm && (
            <form onSubmit={(event) => void onCreate(event)} className="animate-slide-up rounded-3xl border border-white/10 bg-white/5 p-4" aria-label="Add new explorer">
              <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                <label className="text-sm font-semibold text-zuno-lavender">
                  Explorer name
                  <input id="input-explorer-name" className="zuno-input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sofia" maxLength={24} autoFocus />
                </label>
                <label className="text-sm font-semibold text-zuno-lavender">
                  Age
                  <select id="select-explorer-age" className="zuno-input mt-1" value={age} onChange={(e) => setAge(parseInt(e.target.value, 10))}>
                    {[3, 4, 5, 6].map((a) => (
                      <option key={a} value={a}>
                        {a} years
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Avatar badge">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={badge === a}
                    onClick={() => setBadge(a)}
                    className={clsx('h-12 w-12 rounded-2xl border text-2xl transition', badge === a ? 'border-zuno-gold bg-zuno-gold/20 shadow-glow-gold' : 'border-white/15 bg-white/5')}
                  >
                    {a}
                  </button>
                ))}
                <div className="flex-1" />
                <button type="submit" id="btn-save-explorer" disabled={!name.trim() || busy} className="zuno-btn-primary h-12 px-6 text-base disabled:opacity-40">
                  Save Explorer
                </button>
              </div>
            </form>
          )}

          {!activeExplorer && <p className="text-zuno-lavender/70">Choose or add an explorer to see their progress.</p>}

          {activeExplorer && (
            <>
              <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {cards.map(({ id, label, value, hint, Icon, color, ring }) => (
                  <article key={id} id={id} className={clsx('rounded-3xl border border-white/10 bg-gradient-to-br to-transparent p-4', ring)}>
                    <Icon className={clsx('h-6 w-6', color)} />
                    <p className={clsx('mt-2 text-3xl font-bold md:text-4xl', color)}>{metrics.list.length ? value : '—'}</p>
                    <h2 className="text-sm font-semibold text-zuno-lavender">{label}</h2>
                    <p className="text-xs text-zuno-lavender/60">{hint}</p>
                  </article>
                ))}
              </section>

              <section className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                <article className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <h2 className="font-semibold text-zuno-lavender">Wait-Power trend</h2>
                  <p className="mb-2 text-sm text-zuno-lavender/60">
                    {metrics.delta === null
                      ? 'Trend appears after 4 sessions.'
                      : metrics.delta >= 0
                        ? `Up ${metrics.delta} points from the first sessions — Wait-Power is growing! 🎉`
                        : `Down ${Math.abs(metrics.delta)} points lately — totally normal, keep sessions short and playful.`}
                  </p>
                  <Sparkline values={metrics.list.map((s) => s.waitPowerScore)} color="#fbbf24" />
                </article>
                <article className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <h2 className="mb-2 font-semibold text-zuno-lavender">By clearing</h2>
                  <ul className="space-y-2">
                    {metrics.byZone.map((z) => (
                      <li key={z.zone}>
                        <div className="flex justify-between text-sm text-zuno-lavender">
                          <span>{ZONE_INFO[z.zone].title}</span>
                          <span className="text-zuno-lavender/60">{z.count} rounds</span>
                        </div>
                        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-zuno-gold to-zuno-cyan" style={{ width: `${z.count ? z.waitPower : 0}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              </section>

              <section aria-label="Session history" className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-zuno-lavender">Session history</h2>
                  <button type="button" id="btn-unlock-all" onClick={() => void unlockAllLevels(activeExplorer.id)} className="zuno-btn-ghost h-10 px-4 text-sm">
                    <Unlock className="h-4 w-4" /> Unlock all trail spots
                  </button>
                </div>
                <div className="overflow-x-auto" style={{ touchAction: 'pan-x pan-y' }}>
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zuno-lavender/60">
                      <tr>
                        <th className="py-2 pr-3">When</th>
                        <th className="pr-3">Clearing</th>
                        <th className="pr-3">Trail Spot</th>
                        <th className="pr-3">Wait-Power</th>
                        <th className="pr-3">Reaction</th>
                        <th className="pr-3">Poofs</th>
                        <th>Sync</th>
                      </tr>
                    </thead>
                    <tbody className="text-zuno-lavender">
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-zuno-lavender/60">
                            No sessions yet — head to the forest and play a round!
                          </td>
                        </tr>
                      )}
                      {history.map((s) => (
                        <tr key={s.id} className="border-t border-white/10">
                          <td className="py-2 pr-3 text-zuno-lavender/80">{formatDate(s.timestamp)}</td>
                          <td className="pr-3">{ZONE_INFO[s.zoneId].title}</td>
                          <td className="pr-3">{s.nodeId ? getNodeConfig(s.zoneId, s.nodeId).title : `Spot ${s.level}`}</td>
                          <td className="pr-3 font-semibold text-zuno-gold">{s.waitPowerScore}%</td>
                          <td className="pr-3">{s.medianReactionMs} ms</td>
                          <td className="pr-3 text-zuno-coral">{s.staticPoofCount}</td>
                          <td>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
                              <CloudOff className="h-3.5 w-3.5" /> {s.synced === 1 ? 'Synced' : 'Local Offline'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
