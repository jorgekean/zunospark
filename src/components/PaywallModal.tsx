import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  Check,
  Crown,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import ZunoMascot from './ZunoMascot';
import { useZunoStore } from '../store/useZunoStore';
import { DEFAULT_PLANS, iapService, type PlanDetails, type PlanId } from '../services/iapService';
import { zunoAudio } from '../audio/ZunoSynth';
import { triggerHaptic } from '../services/capacitorBridge';

function newQuestion(): { a: number; b: number } {
  return { a: 4 + Math.floor(Math.random() * 6), b: 3 + Math.floor(Math.random() * 6) };
}

export default function PaywallModal() {
  const showPaywallModal = useZunoStore((s) => s.showPaywallModal);
  const closePaywall = useZunoStore((s) => s.closePaywall);
  const pendingPaywallNode = useZunoStore((s) => s.pendingPaywallNode);
  const startNode = useZunoStore((s) => s.startNode);
  const isFullAdventureUnlocked = useZunoStore((s) => s.isFullAdventureUnlocked);
  const setFullAdventureUnlocked = useZunoStore((s) => s.setFullAdventureUnlocked);

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [plans, setPlans] = useState<Record<PlanId, PlanDetails>>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Parental Gate state (mandatory for Google Play Families apps)
  const [showGate, setShowGate] = useState(false);
  const [question, setQuestion] = useState(newQuestion);
  const [answer, setAnswer] = useState('');
  const [gateWrong, setGateWrong] = useState(false);

  useEffect(() => {
    if (showPaywallModal) {
      iapService.getPlans().then((fetched) => {
        if (fetched) setPlans(fetched);
      });
    }
  }, [showPaywallModal]);

  if (!showPaywallModal || !iapService.isNative()) return null;

  const handleStartPurchase = () => {
    zunoAudio.playTap();
    triggerHaptic('medium');
    setQuestion(newQuestion());
    setAnswer('');
    setGateWrong(false);
    setShowGate(true);
  };

  const executePurchase = async () => {
    setShowGate(false);
    setLoading(true);
    setMessage(null);

    try {
      const res = await iapService.purchasePlan(selectedPlan);
      if (res.success) {
        zunoAudio.playTrailCheer();
        triggerHaptic('success');
        setFullAdventureUnlocked(true);
        closePaywall();

        // If user tapped a specific locked node, immediately start it!
        if (pendingPaywallNode && pendingPaywallNode.nodeId) {
          startNode(pendingPaywallNode.zoneId, pendingPaywallNode.nodeId);
        }
      } else {
        setMessage(res.message || 'Purchase could not be completed.');
      }
    } catch {
      setMessage('An error occurred during purchase.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    zunoAudio.playTap();
    triggerHaptic('light');
    setLoading(true);
    setMessage(null);

    try {
      const res = await iapService.restorePurchases();
      if (res.purchased) {
        zunoAudio.playTrailCheer();
        triggerHaptic('success');
        setFullAdventureUnlocked(true);
        setMessage('🎉 Full Adventure Restored successfully!');
        window.setTimeout(() => {
          closePaywall();
          if (pendingPaywallNode && pendingPaywallNode.nodeId) {
            startNode(pendingPaywallNode.zoneId, pendingPaywallNode.nodeId);
          }
        }, 1200);
      } else {
        setMessage(res.message || 'No previous purchase found for this account.');
      }
    } catch {
      setMessage('Could not connect to Google Play store.');
    } finally {
      setLoading(false);
    }
  };

  const submitGate = () => {
    if (parseInt(answer, 10) === question.a + question.b) {
      executePurchase();
    } else {
      setGateWrong(true);
      setAnswer('');
      setQuestion(newQuestion());
      triggerHaptic('warning');
    }
  };

  const isNative = iapService.isNative();
  const activePlan = plans[selectedPlan] ?? plans.yearly;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zuno-night/85 p-3 backdrop-blur-md md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Unlock Full Adventure"
    >
      <div className="glass-card animate-pop-in relative flex max-h-[94vh] w-full max-w-xl flex-col overflow-y-auto rounded-3xl border border-white/20 bg-gradient-to-b from-zuno-night/95 via-[#1a0f3d]/95 to-zuno-night/95 p-5 text-center shadow-2xl md:p-7">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            zunoAudio.playTap();
            closePaywall();
          }}
          aria-label="Close"
          className="zuno-btn-ghost absolute right-3 top-3 h-11 w-11 rounded-full p-2 text-zuno-lavender/70 hover:text-white md:right-4 md:top-4"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Mascot Header */}
        <div className="relative mx-auto -mt-1 mb-1.5 flex items-center justify-center">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-zuno-cyan/20 to-zuno-gold/20 blur-xl" />
          <div className="animate-float">
            <ZunoMascot mood="AWAKE_POP" size={110} />
          </div>
          <div className="absolute -right-2 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-zuno-gold text-zuno-night shadow-glow-gold">
            <Crown className="h-4 w-4 fill-current" />
          </div>
        </div>

        {/* Tagline */}
        <div className="inline-flex items-center gap-1.5 self-center rounded-full border border-zuno-gold/30 bg-zuno-gold/15 px-3 py-0.5 text-xs font-bold text-zuno-gold">
          <Sparkles className="h-3.5 w-3.5" /> SPOT 1 IS FREE FOREVER • UPGRADE ANYTIME
        </div>

        <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white md:text-3xl">
          Unlock Full Adventure!
        </h2>
        <p className="mt-1 text-xs text-zuno-lavender/80 md:text-sm">
          Unlock Spots 2 through 5 across all 3 training worlds. Choose the plan that works best for your family:
        </p>

        {/* 3 Selectable Plan Cards */}
        <div className="my-3.5 flex flex-col gap-2.5 text-left md:gap-3">
          {/* 1. Yearly Plan (Best Value / Recommended) */}
          <button
            type="button"
            onClick={() => {
              zunoAudio.playTap();
              setSelectedPlan('yearly');
            }}
            className={clsx(
              'relative flex flex-col gap-1 rounded-2xl border-2 p-3.5 transition-all md:p-4',
              selectedPlan === 'yearly'
                ? 'border-zuno-cyan bg-zuno-cyan/15 shadow-glow-cyan'
                : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10',
            )}
          >
            <div className="absolute -top-2.5 right-4 rounded-full bg-gradient-to-r from-zuno-cyan to-zuno-gold px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-zuno-night shadow-md">
              {plans.yearly.badge}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                    selectedPlan === 'yearly'
                      ? 'border-zuno-cyan bg-zuno-cyan text-zuno-night'
                      : 'border-white/30',
                  )}
                >
                  {selectedPlan === 'yearly' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <span className="text-base font-bold text-white md:text-lg">{plans.yearly.title}</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-zuno-gold md:text-2xl">{plans.yearly.price}</span>
                <span className="text-xs font-medium text-zuno-lavender/70"> {plans.yearly.period}</span>
              </div>
            </div>
            <p className="ml-7 text-xs font-semibold text-zuno-cyan">{plans.yearly.savings}</p>
          </button>

          {/* 2. Monthly Plan */}
          <button
            type="button"
            onClick={() => {
              zunoAudio.playTap();
              setSelectedPlan('monthly');
            }}
            className={clsx(
              'relative flex flex-col gap-1 rounded-2xl border-2 p-3.5 transition-all md:p-4',
              selectedPlan === 'monthly'
                ? 'border-zuno-cyan bg-zuno-cyan/15 shadow-glow-cyan'
                : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                    selectedPlan === 'monthly'
                      ? 'border-zuno-cyan bg-zuno-cyan text-zuno-night'
                      : 'border-white/30',
                  )}
                >
                  {selectedPlan === 'monthly' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <span className="text-base font-bold text-white md:text-lg">{plans.monthly.title}</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-white md:text-2xl">{plans.monthly.price}</span>
                <span className="text-xs font-medium text-zuno-lavender/70"> {plans.monthly.period}</span>
              </div>
            </div>
            <p className="ml-7 text-xs text-zuno-lavender/70">{plans.monthly.savings}</p>
          </button>

          {/* 3. Early Lifetime Pass */}
          <button
            type="button"
            onClick={() => {
              zunoAudio.playTap();
              setSelectedPlan('lifetime');
            }}
            className={clsx(
              'relative flex flex-col gap-1 rounded-2xl border-2 p-3.5 transition-all md:p-4',
              selectedPlan === 'lifetime'
                ? 'border-zuno-gold bg-zuno-gold/15 shadow-glow-gold'
                : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10',
            )}
          >
            <div className="absolute -top-2.5 right-4 rounded-full border border-zuno-gold/50 bg-zuno-night px-2.5 py-0.5 text-[10px] font-bold text-zuno-gold shadow-sm">
              {plans.lifetime.badge}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                    selectedPlan === 'lifetime'
                      ? 'border-zuno-gold bg-zuno-gold text-zuno-night'
                      : 'border-white/30',
                  )}
                >
                  {selectedPlan === 'lifetime' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <span className="text-base font-bold text-white md:text-lg">{plans.lifetime.title}</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-zuno-gold md:text-2xl">{plans.lifetime.price}</span>
                <span className="text-xs font-medium text-zuno-lavender/70"> {plans.lifetime.period}</span>
              </div>
            </div>
            <p className="ml-7 text-xs text-zuno-lavender/70">{plans.lifetime.savings}</p>
          </button>
        </div>

        {/* Feature summary */}
        <div className="mb-3 flex items-center justify-around rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-zuno-lavender/80">
          <span className="flex items-center gap-1 font-semibold">
            <Check className="h-3.5 w-3.5 text-zuno-cyan" /> All 15 Spots
          </span>
          <span className="flex items-center gap-1 font-semibold">
            <Check className="h-3.5 w-3.5 text-zuno-gold" /> 3 Worlds
          </span>
          <span className="flex items-center gap-1 font-semibold">
            <Check className="h-3.5 w-3.5 text-zuno-lavender" /> 100% Ad-Free
          </span>
        </div>

        {/* Error / Status Message */}
        {message && (
          <p className="mb-3 text-xs font-semibold text-zuno-coral animate-shake">
            {message}
          </p>
        )}

        {/* Purchase CTA */}
        <button
          type="button"
          id="btn-buy-full-adventure"
          onClick={handleStartPurchase}
          disabled={loading || isFullAdventureUnlocked}
          className="zuno-btn-primary min-h-[58px] w-full gap-2 text-lg font-black shadow-glow-cyan transition-transform active:scale-95 disabled:opacity-50 md:min-h-[62px] md:text-xl"
        >
          {loading ? (
            <>
              <RefreshCw className="h-6 w-6 animate-spin" /> Connecting to Google Play…
            </>
          ) : isFullAdventureUnlocked ? (
            <>
              <Check className="h-6 w-6" /> Adventure Pass Active!
            </>
          ) : (
            <>
              <Zap className="h-6 w-6 fill-current" />
              <span>Unlock Adventure • {activePlan.price} {activePlan.type === 'subs' ? activePlan.period : ''}</span>
            </>
          )}
        </button>

        {/* Footer controls: Restore & Family Policy Note */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-xs text-zuno-lavender/60">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-zuno-cyan" /> Grown-up verification required
          </span>
          <button
            type="button"
            id="btn-restore-purchases"
            onClick={handleRestore}
            disabled={loading}
            className="flex items-center gap-1 font-semibold text-zuno-gold underline-offset-2 hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> Restore Purchases
          </button>
        </div>

        {/* Web Sandbox test toggle */}
        {!isNative && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white/5 p-2 text-xs text-zuno-lavender/60">
            <span>Web Sandbox:</span>
            <button
              type="button"
              onClick={() => {
                iapService.setSandboxPurchase(true);
                setFullAdventureUnlocked(true);
                closePaywall();
              }}
              className="rounded bg-zuno-cyan/20 px-2 py-0.5 font-bold text-zuno-cyan hover:bg-zuno-cyan/30"
            >
              Simulate Buy
            </button>
            <button
              type="button"
              onClick={() => {
                iapService.setSandboxPurchase(false);
                setFullAdventureUnlocked(false);
              }}
              className="rounded bg-zuno-coral/20 px-2 py-0.5 font-bold text-zuno-coral hover:bg-zuno-coral/30"
            >
              Reset to Free
            </button>
          </div>
        )}
      </div>

      {/* Parental Gate Modal */}
      {showGate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zuno-night/90 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Parental Gate"
        >
          <div className="glass-card animate-pop-in w-full max-w-sm rounded-3xl border border-white/20 p-6 text-center shadow-2xl">
            <ShieldCheck className="mx-auto h-12 w-12 text-zuno-cyan" />
            <h3 className="mt-2 text-2xl font-bold text-zuno-lavender">Grown-Ups Only</h3>
            <p className="mt-1 text-sm text-zuno-lavender/70">
              Please solve this quick challenge to authorize the {activePlan.title} ({activePlan.price}):
            </p>
            <p
              className={clsx(
                'my-4 text-5xl font-extrabold tracking-wide',
                gateWrong ? 'animate-wiggle text-zuno-coral' : 'text-zuno-gold',
              )}
            >
              {question.a} + {question.b} = {answer || '?'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setGateWrong(false);
                    setAnswer((a) => (a.length >= 2 ? a : a + d));
                  }}
                  className="zuno-btn-ghost h-12 text-2xl font-bold"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAnswer((a) => a.slice(0, -1))}
                aria-label="Delete"
                className="zuno-btn-ghost h-12 text-sm font-bold"
              >
                DEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setGateWrong(false);
                  setAnswer((a) => (a.length >= 2 ? a : a + '0'));
                }}
                className="zuno-btn-ghost h-12 text-2xl font-bold"
              >
                0
              </button>
              <button
                type="button"
                onClick={submitGate}
                disabled={!answer}
                className="zuno-btn-primary h-12 text-lg font-bold disabled:opacity-40"
              >
                OK
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowGate(false)}
              className="mt-3 text-xs font-semibold text-zuno-lavender/60 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
