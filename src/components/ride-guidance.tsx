'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Monitor,
  Volume2,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import {
  describeCycleRouteInstruction,
  type CycleRoute,
} from '@/lib/cyclestreets';
import { formatLocalizedDistance } from '@/lib/i18n/format';
import { localeDetails } from '@/lib/i18n/locales';
import {
  getNextRouteGuidance,
  type LiveRouteProgress,
} from '@/lib/route-progress';
import { getRouteInstructionManeuver } from '@/lib/route-instructions';

export function RideGuidance({
  route,
  progress,
  tracking,
  rerouting,
  rerouteError,
  onReroute,
}: {
  route: CycleRoute;
  progress: LiveRouteProgress | null;
  tracking: boolean;
  rerouting: boolean;
  rerouteError: string | null;
  onReroute: () => void;
}) {
  const { t, locale } = useLanguage();
  const [keepAwake, setKeepAwake] = useState(false);
  const [audio, setAudio] = useState(false);
  const [wakeSupported, setWakeSupported] = useState<boolean | null>(null);
  const [wakeStatus, setWakeStatus] = useState<
    'idle' | 'active' | 'paused' | 'error'
  >('idle');
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [audioError, setAudioError] = useState(false);
  const lastSpoken = useRef<string | null>(null);
  const announcedInstructions = useRef(new Set<string>());
  const riding = tracking && !progress?.hasArrived;
  const next = progress
    ? getNextRouteGuidance(route, progress.travelledMeters)
    : null;
  const maneuver = next
    ? getRouteInstructionManeuver(next.instruction)
    : 'arrive';
  const Icon =
    maneuver === 'left'
      ? CornerUpLeft
      : maneuver === 'right'
        ? CornerUpRight
        : maneuver === 'arrive'
          ? Flag
          : ArrowUp;
  const instructionText = next
    ? describeCycleRouteInstruction(next.instruction, locale)
    : t('rideContinueToDestination');
  const cue = progress?.isOffRoute
    ? t('rideOffRoute')
    : progress?.hasArrived
      ? t('arrivedDestination')
      : next
        ? t('rideInDistance', {
            distance: formatLocalizedDistance(next.distanceMeters, locale),
            instruction: instructionText,
          })
        : instructionText;
  const cueId = progress?.isOffRoute
    ? 'off-route'
    : progress?.hasArrived
      ? 'arrived'
      : `${next?.instruction.id ?? 'finish'}:${next && next.distanceMeters <= 50 ? 'near' : 'ahead'}`;

  useEffect(() => {
    setWakeSupported(window.isSecureContext && 'wakeLock' in navigator);
    if (!('speechSynthesis' in window)) return;
    const updateVoices = () => {
      // Use a device voice only: route instructions should not go to a speech service.
      setVoice(
        window.speechSynthesis
          .getVoices()
          .find(
            (candidate) =>
              candidate.localService &&
              candidate.lang.toLowerCase().split('-')[0] === locale,
          ) ?? null,
      );
    };
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () =>
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
  }, [locale]);

  useEffect(() => {
    if (!keepAwake || !riding || !wakeSupported) {
      setWakeStatus('idle');
      return;
    }
    let disposed = false;
    let pending = false;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (disposed || pending || lock || document.visibilityState !== 'visible')
        return;
      pending = true;
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (disposed) {
          await acquired.release();
          return;
        }
        lock = acquired;
        setWakeStatus('active');
        acquired.addEventListener('release', () => {
          if (lock === acquired) lock = null;
          if (!disposed) setWakeStatus('paused');
        });
      } catch {
        if (!disposed) setWakeStatus('error');
      } finally {
        pending = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (lock) void lock.release().catch(() => {});
    };
  }, [keepAwake, riding, wakeSupported]);

  useEffect(() => {
    if (!audio || !tracking || !voice || rerouting) {
      lastSpoken.current = null;
      announcedInstructions.current.clear();
      return;
    }
    const key = `${locale}:${cueId}`;
    if (lastSpoken.current === key) return;
    if (cueId === 'off-route') announcedInstructions.current.clear();
    else if (cueId !== 'arrived') {
      if (announcedInstructions.current.has(key)) return;
      announcedInstructions.current.add(key);
    }
    lastSpoken.current = key;
    const utterance = new SpeechSynthesisUtterance(cue);
    utterance.voice = voice;
    utterance.lang = localeDetails[locale].formattingLocale;
    utterance.onerror = (event) => {
      if (event.error !== 'canceled' && event.error !== 'interrupted')
        setAudioError(true);
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [audio, tracking, voice, locale, cue, cueId, rerouting]);

  useEffect(() => {
    if ((!audio || !tracking || rerouting) && 'speechSynthesis' in window)
      window.speechSynthesis.cancel();
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [audio, tracking, rerouting]);

  return (
    <section
      className="ride-guidance"
      aria-label={t('rideOptions')}
      data-testid="ride-guidance"
    >
      {tracking && progress && !progress.hasArrived ? (
        <div
          className={`ride-next-turn${progress.isOffRoute ? ' ride-next-turn--off-route' : ''}`}
          data-testid="ride-next-turn"
        >
          <Icon size={32} aria-hidden="true" />
          <div>
            <strong>
              {progress.isOffRoute
                ? t('rideOffRoute')
                : formatLocalizedDistance(
                    next?.distanceMeters ?? progress.remainingMeters,
                    locale,
                  )}
            </strong>
            <p role="status">
              {progress.isOffRoute ? t('rideOffRouteHelp') : instructionText}
            </p>
            {!progress.isOffRoute ? (
              <small>
                {t('rideRemaining', {
                  distance: formatLocalizedDistance(
                    progress.remainingMeters,
                    locale,
                  ),
                })}
              </small>
            ) : null}
          </div>
        </div>
      ) : null}
      {tracking && progress?.isOffRoute ? (
        <button
          className="ride-reroute"
          type="button"
          disabled={rerouting}
          onClick={onReroute}
        >
          <RefreshCw
            size={18}
            className={rerouting ? 'is-spinning' : undefined}
            aria-hidden="true"
          />
          {t(rerouting ? 'rideRecalculating' : 'rideRecalculate')}
        </button>
      ) : null}
      {rerouteError ? (
        <p role="status" className="ride-help">
          {rerouteError}
        </p>
      ) : null}
      <div className="ride-options">
        <button
          type="button"
          aria-pressed={keepAwake}
          disabled={wakeSupported === false}
          onClick={() => setKeepAwake(!keepAwake)}
        >
          <Monitor size={17} aria-hidden="true" />
          {t('rideKeepAwake')}
        </button>
        <button
          type="button"
          aria-pressed={audio}
          disabled={!voice}
          onClick={() => {
            setAudioError(false);
            setAudio(!audio);
            if (!audio && voice) {
              const utterance = new SpeechSynthesisUtterance(
                t('rideAudioEnabled'),
              );
              utterance.voice = voice;
              window.speechSynthesis.speak(utterance);
            }
          }}
        >
          <Volume2 size={17} aria-hidden="true" />
          {t('rideAudio')}
        </button>
      </div>
      <p className="ride-help" aria-live="polite">
        {wakeSupported === false
          ? t('rideWakeUnavailable')
          : keepAwake
            ? t(
                wakeStatus === 'active'
                  ? 'rideWakeActive'
                  : wakeStatus === 'error' || wakeStatus === 'paused'
                    ? 'rideWakePaused'
                    : 'rideWakeOnStart',
              )
            : null}
        {!voice
          ? ` ${t('rideAudioUnavailable')}`
          : audioError
            ? ` ${t('rideAudioFailed')}`
            : null}
      </p>
    </section>
  );
}
