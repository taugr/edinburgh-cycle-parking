'use client';

import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  ArrowUpRight,
  Bike,
  Check,
  Circle,
  CircleParking,
  Flag,
  LoaderCircle,
  Pencil,
  Search,
  Bookmark,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import {
  CYCLESTREETS_ROUTE_PLANS,
  describeCycleRouteInstruction,
  type CycleRouteInstruction,
  formatCycleRouteDuration,
  type CycleRoutePlan,
  type CycleRoutesByPlan,
  type CycleRouteWaypoint,
} from '@/lib/cyclestreets';
import { formatLocalizedDistance } from '@/lib/i18n/format';
import { getRouteInstructionManeuver } from '@/lib/route-instructions';
import type { RouteDraft } from '@/lib/route-draft';

type Props = {
  draft: RouteDraft;
  pendingDestination: CycleRouteWaypoint | null;
  routes: CycleRoutesByPlan;
  status: 'idle' | 'loading' | 'loaded' | 'missing-key' | 'error';
  message: string | null;
  trackingStatus:
    | 'idle'
    | 'starting'
    | 'tracking'
    | 'denied'
    | 'too-far'
    | 'unavailable';
  hasArrived: boolean;
  rideGuidance: ReactNode;
  onTrack: () => void;
  onNew: () => void;
  currentInstruction: CycleRouteInstruction | null;
  onInstruction: (id: string) => void;
  onBack: () => void;
  onSearch: (target: 'start' | 'destination') => void;
  onEdit: () => void;
  onSave: () => void;
  onLibrary: () => void;
  onParking: () => void;
  onRetry: () => void;
  onSelectPlan: (plan: CycleRoutePlan) => void;
};

export function RouteJourney({
  draft,
  pendingDestination,
  routes,
  status,
  message,
  trackingStatus,
  hasArrived,
  rideGuidance,
  onTrack,
  onNew,
  currentInstruction,
  onInstruction,
  onBack,
  onSearch,
  onEdit,
  onSave,
  onLibrary,
  onParking,
  onRetry,
  onSelectPlan,
}: Props) {
  const { t, locale } = useLanguage();
  const selectedRoute = routes[draft.plan];
  const destination =
    pendingDestination ??
    (draft.waypoints.length > 1 ? draft.waypoints.at(-1) : null);
  const tracking =
    trackingStatus === 'tracking' || trackingStatus === 'starting';
  return (
    <section
      className={`route-journey panel-view${tracking ? ' is-riding' : ''}`}
      aria-label={t('planRoute')}
      data-testid="route-journey"
    >
      <header className="journey-header">
        <button
          type="button"
          className="journey-icon"
          aria-label={t('backToNearbyNeuks')}
          onClick={onBack}
        >
          <ArrowLeft size={21} />
        </button>
        <h2>{t('cycleRoute')}</h2>
        <span className="journey-collapsed-destination">
          {destination?.label ?? t('cycleRoute')}
        </span>
        <button
          type="button"
          className="journey-icon"
          aria-label={t('editRoute')}
          title={t('editRoute')}
          disabled={tracking || !!pendingDestination}
          onClick={onEdit}
        >
          <Pencil size={20} />
        </button>
      </header>
      <div className="journey-scroll">
        <div className="journey-endpoints">
          {(['start', 'destination'] as const).map((target) => {
            const waypoint =
              target === 'start' ? draft.waypoints[0] : destination;
            return (
              <button
                key={target}
                type="button"
                data-testid={`journey-${target}`}
                disabled={tracking}
                onClick={() => onSearch(target)}
              >
                <span
                  className={`journey-endpoint-icon journey-endpoint-${target}`}
                  aria-hidden="true"
                >
                  {target === 'start' ? (
                    <Circle size={14} />
                  ) : (
                    <Flag size={18} />
                  )}
                </span>
                <span>
                  <small>
                    {t(target === 'start' ? 'routeStart' : 'destination')}
                  </small>
                  <strong
                    className={!waypoint ? 'journey-placeholder' : undefined}
                  >
                    {waypoint?.label ??
                      t(
                        target === 'start'
                          ? 'chooseStart'
                          : 'searchDestination',
                      )}
                  </strong>
                </span>
                <Search size={17} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        {draft.waypoints.length > 2 ? (
          <p className="journey-note">
            {t('routePoints', { count: draft.waypoints.length })}
          </p>
        ) : null}
        {!destination ? (
          <p className="journey-note">{t('journeyDestinationHelp')}</p>
        ) : !draft.waypoints.length ? (
          <p className="journey-note">{t('journeyStartHelp')}</p>
        ) : null}
        {status === 'loading' ? (
          <p className="journey-status" role="status">
            <LoaderCircle size={20} className="is-spinning" />
            {t('findingRoute')}
          </p>
        ) : null}
        {status === 'missing-key' || status === 'error' || message ? (
          <div className="journey-status" role="status">
            <span>
              {status === 'missing-key' ? t('directionsNeedKey') : message}
            </span>
            {status === 'error' ? (
              <button
                type="button"
                className="journey-icon"
                aria-label={t('retry')}
                onClick={onRetry}
              >
                <RefreshCw size={20} />
              </button>
            ) : null}
          </div>
        ) : null}
        {selectedRoute ? (
          <>
            <div className="journey-route-choices" aria-label={t('routeStyle')}>
              {CYCLESTREETS_ROUTE_PLANS.map((plan) => {
                const route = routes[plan];
                return (
                  <button
                    type="button"
                    key={plan}
                    data-testid={`route-plan-${plan}`}
                    disabled={!route || tracking}
                    aria-pressed={draft.plan === plan}
                    onClick={() => onSelectPlan(plan)}
                  >
                    <span>
                      {t(
                        plan === 'quietest'
                          ? 'routeQuietest'
                          : plan === 'balanced'
                            ? 'routeBalanced'
                            : 'routeFastest',
                      )}
                      {draft.plan === plan ? (
                        <Check size={14} aria-hidden="true" />
                      ) : null}
                    </span>
                    <strong>
                      {route
                        ? formatCycleRouteDuration(
                            route.durationSeconds,
                            locale,
                          )
                        : '—'}
                    </strong>
                    <small>
                      {route
                        ? formatLocalizedDistance(route.distanceMeters, locale)
                        : t('routeUnavailable')}
                    </small>
                  </button>
                );
              })}
            </div>
            {destination?.source !== 'parking' && !tracking ? (
              <button
                className="journey-parking"
                data-testid="finish-at-bike-parking"
                type="button"
                onClick={onParking}
              >
                <CircleParking size={23} />
                <span>
                  <strong>{t('finishAtBikeParking')}</strong>
                  <small>{t('finishAtBikeParkingHelp')}</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            ) : null}
            {trackingStatus === 'denied' ||
            trackingStatus === 'too-far' ||
            trackingStatus === 'unavailable' ? (
              <p role="status" className="journey-note">
                {t(
                  trackingStatus === 'denied'
                    ? 'routeLocationPermission'
                    : trackingStatus === 'too-far'
                      ? 'routeOutsideCoverage'
                      : 'liveLocationUnavailable',
                )}
              </p>
            ) : null}
            {hasArrived ? (
              <p role="status" className="journey-note">
                {t(
                  destination?.source === 'parking'
                    ? 'arrivedParking'
                    : 'arrivedDestination',
                )}
              </p>
            ) : null}
            {rideGuidance}
            {selectedRoute.instructions.length > 0 ? (
              <section
                className="journey-instructions"
                aria-label={t('directions')}
              >
                <h3>{t('directions')}</h3>
                <ol data-testid="directions-list">
                  {selectedRoute.instructions.map((instruction) => {
                    const maneuver = getRouteInstructionManeuver(instruction);
                    const Icon =
                      maneuver === 'left'
                        ? CornerUpLeft
                        : maneuver === 'right'
                          ? CornerUpRight
                          : maneuver === 'arrive'
                            ? Flag
                            : maneuver === 'start'
                              ? Circle
                              : ArrowUp;
                    return (
                      <li key={instruction.id} className="journey-instruction">
                        <button
                          type="button"
                          aria-current={
                            tracking &&
                            currentInstruction?.id === instruction.id
                              ? 'step'
                              : undefined
                          }
                          onClick={() => onInstruction(instruction.id)}
                        >
                          <Icon size={19} aria-hidden="true" />
                          <strong>
                            {describeCycleRouteInstruction(instruction, locale)}
                          </strong>
                          <small>
                            {formatLocalizedDistance(
                              instruction.distanceMeters,
                              locale,
                            )}
                          </small>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
      <footer className="journey-footer">
        {selectedRoute ? (
          <button
            type="button"
            className="journey-primary"
            disabled={trackingStatus === 'starting'}
            onClick={onTrack}
          >
            <Bike size={21} />
            {t(
              trackingStatus === 'starting'
                ? 'starting'
                : trackingStatus === 'tracking'
                  ? hasArrived
                    ? 'done'
                    : 'stop'
                  : 'startRoute',
            )}
          </button>
        ) : null}
        <div className="journey-tools">
          <button type="button" disabled={tracking} onClick={onNew}>
            {t('newRoute')}
          </button>
          <button type="button" disabled={tracking} onClick={onLibrary}>
            <Bookmark size={16} />
            {t('myRoutes')}
          </button>
          {selectedRoute ? (
            <button type="button" disabled={tracking} onClick={onSave}>
              <Bookmark size={16} />
              {t('saveRoute')}
            </button>
          ) : null}
        </div>
      </footer>
    </section>
  );
}
