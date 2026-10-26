import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import clsx from 'clsx';

interface HoldButtonProps {
  onComplete: () => void;
  holdMs?: number;
  className?: string;
  fillClassName?: string;
  ariaLabel: string;
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Press-and-hold confirmation button (default 1.5 s). A progress fill shows
 * the hold; releasing early cancels. Used for grown-up-only actions so
 * toddlers cannot trigger them with a quick tap.
 */
export default function HoldButton({
  onComplete,
  holdMs = 1500,
  className,
  fillClassName,
  ariaLabel,
  disabled,
  children,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const cancel = useCallback(() => {
    startRef.current = null;
    cancelAnimationFrame(frameRef.current);
    setProgress(0);
  }, []);

  const begin = useCallback(() => {
    if (disabled || startRef.current !== null) return;
    startRef.current = performance.now();
    const tick = (): void => {
      if (startRef.current === null) return;
      const ratio = (performance.now() - startRef.current) / holdMs;
      if (ratio >= 1) {
        startRef.current = null;
        setProgress(0);
        completeRef.current();
        return;
      }
      setProgress(ratio);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [disabled, holdMs]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture is best-effort */
    }
    begin();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault();
      begin();
    }
  };

  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') cancel();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onContextMenu={(event) => event.preventDefault()}
      className={clsx('relative overflow-hidden select-none', className)}
    >
      <span
        aria-hidden="true"
        className={clsx('absolute inset-y-0 left-0 bg-white/30', fillClassName)}
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
