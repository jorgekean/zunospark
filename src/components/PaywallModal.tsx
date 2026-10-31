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
import { iapService } from '../services/iapService';
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

  const [price, setPrice] = useState('$19.00');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Parental Gate state (mandatory for Google Play Families apps)
  const [showGate, setShowGate] = useState(false);
  const [question, setQuestion] = useState(newQuestion);
  const [answer, setAnswer] = useState('');
  const [gateWrong, setGateWrong] = useState(false);

  useEffect(() => {
    if (showPaywallModal) {
      iapService.getProductDetails().then((details) => {
        if (details.price) setPrice(details.price);
      });
    }
  }, [showPaywallModal]);

  if (!showPaywallModal || !iapService.isNative()) return null;

  const handleStartPurchase = () => {
    zunoAudio.playTap();
    triggerHaptic('medium');
    // Open parental gate arithmetic challenge
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
      const res = await iapService.purchaseFullAdventure();
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zuno-night/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Unlock Full Adventure"
    >
      <div className="glass-card animate-pop-in relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-3xl border border-white/20 bg-gradient-to-b from-zuno-night/95 to-[#1a0f3d]/95 p-6 text-center shadow-2xl md:p-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => {
            zunoAudio.playTap();
            closePaywall();
          }}
          aria-label="Close"
          className="zuno-btn-ghost absolute right-4 top-4 h-11 w-11 rounded-full p-2 text-zuno-lavender/70 hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Mascot Header */}
        <div className="relative mx-auto -mt-2 mb-2 flex items-center justify-center">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-zuno-cyan/20 to-zuno-gold/20 blur-xl" />
          <div className="animate-float">
            <ZunoMascot mood="AWAKE_POP" size={130} />
          </div>
          <div className="absolute -right-2 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-zuno-gold text-zuno-night shadow-glow-gold">
            <Crown className="h-5 w-5 fill-current" />
          </div>
        </div>

        {/* Tagline */}
        <div className="inline-flex items-center gap-1.5 self-center rounded-full border border-zuno-gold/30 bg-zuno-gold/15 px-3 py-1 text-xs font-bold text-zuno-gold">
          <Sparkles className="h-3.5 w-3.5" /> ONE-TIME PAYMENT • NO SUBSCRIPTIONS
        </div>

        <h2 className="mt-2 text-3xl font-extrabold leading-tight text-white md:text-4xl">
          Unlock Full Adventure!
        </h2>
        <p className="mt-1 text-base text-zuno-lavender/80">
          Spot 1 is free forever! Unlock Spots 2–5 across all 3 training worlds for the whole family.
        </p>

        {/* Benefits list */}
        <div className="my-4 flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zuno-cyan/20 text-zuno-cyan">
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">All 15 Adventure Spots</p>
              <p className="text-xs text-zuno-lavender/70">
                Unlock Shady Bush, Dragonfly Glade, Dusk Clearing, Storm Ridge &amp; more.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zuno-gold/20 text-zuno-gold">
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">All 3 Training Worlds</p>
              <p className="text-xs text-zuno-lavender/70">
                Spark Berry Grove (Wait-Power), Thunder Chimes (Memory), Twin Currents (Coordination).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zuno-lavender/20 text-zuno-lavender">
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Lifetime Family Access</p>
              <p className="text-xs text-zuno-lavender/70">
                Pay once. Works for all child profiles on this device forever. 100% Ad-Free &amp; Private.
              </p>
            </div>
          </div>
        </div>

        {/* Status / Error Message */}
        {message && (
          <p className="mb-3 text-sm font-semibold text-zuno-coral animate-shake">
            {message}
          </p>
        )}

        {/* Action Button */}
        <button
          type="button"
          id="btn-buy-full-adventure"
          onClick={handleStartPurchase}
          disabled={loading || isFullAdventureUnlocked}
          className="zuno-btn-primary min-h-[62px] w-full gap-2 text-xl font-black shadow-glow-cyan transition-transform active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="h-6 w-6 animate-spin" /> Processing…
            </>
          ) : isFullAdventureUnlocked ? (
            <>
              <Check className="h-6 w-6" /> Full Adventure Unlocked!
            </>
          ) : (
            <>
              <Zap className="h-6 w-6 fill-current" /> Unlock Full Adventure • {price}
            </>
          )}
        </button>

        {/* Footer controls: Restore & Family Policy Note */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-zuno-lavender/60">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-zuno-cyan" /> Grown-up check required
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

        {/* Web Sandbox test toggle (convenience for development) */}
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
              Simulate $19 Buy
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

      {/* Parental Gate Modal (Grown-ups arithmetic check before billing) */}
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
              Please solve this quick challenge to authorize the {price} purchase:
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
