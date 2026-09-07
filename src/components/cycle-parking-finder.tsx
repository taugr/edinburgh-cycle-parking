'use client';

import dynamic from 'next/dynamic';
import { RideGuidance } from '@/components/ride-guidance';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  animate,
  motion,
  type MotionStyle,
  type TargetAndTransition,
  type Transition,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import {
  ArrowUp,
  Bike,
  Bookmark,
  Boxes,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleParking,
  Clock,
  CornerUpLeft,
  CornerUpRight,
  Crosshair,
  Download,
  EllipsisVertical,
  ExternalLink,
  Gauge,
  Globe2,
  Hammer,
  Layers,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Maximize2,
  Minus,
  Monitor,
  Moon,
  Navigation,
  Plus,
  Route,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Store,
  Sun,
  Umbrella,
  UmbrellaOff,
  Warehouse,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  buildShortCycleRoutes,
  buildCycleRouteWaypointsCacheKey,
  buildCycleStreetsRouteRequest,
  CYCLESTREETS_DEFAULT_ROUTE_PLAN,
  CYCLESTREETS_MAX_WAYPOINTS,
  CYCLESTREETS_ROUTE_PLANS,
  describeCycleRouteInstruction,
  fetchCycleStreetsDirections,
  formatCycleRouteDuration,
  parseCycleStreetsRoutes,
  SHORT_CYCLE_ROUTE_THRESHOLD_METERS,
  type CycleRouteInstruction,
  type CycleRoute,
  type CycleRoutePlan,
  type CycleRoutePoint,
  type CycleRouteWaypoint,
  type CycleRoutesByPlan,
} from '@/lib/cyclestreets';
import {
  buildPlaceSearchUrl,
  parsePlaceSearchResults,
  type PlaceSearchResult,
} from '@/lib/geocoder';
import {
  canUseGeolocation,
  clearLastLocation,
  clearWatch,
  getCurrentPosition,
  getLocationPermission,
  readLastLocation,
  saveLastLocation,
  watchPosition,
} from '@/lib/geolocation';
import {
  beginAutomaticLocationRequest,
  readLastArea,
  rememberLocationDenial,
  rememberLocationRequest,
  saveLastArea,
} from '@/lib/location-preferences';
import type {
  CyclingPoiCategory,
  CyclingPoiPoint,
  ParkingDataManifest,
  ParkingPoint,
  UserLocation,
} from '@/lib/types';
import { isCyclingPoiPoint } from '@/lib/types';
import {
  EDINBURGH_FALLBACK_LOCATION,
  formatDistance,
  distanceMeters,
  isResolvedLocation,
  sortByDistance,
} from '@/lib/geo';
import {
  getDirectionsParkingDetails,
  getParkingEssentialDetails,
  getParkingPopupDetails,
  type ParkingPopupDetail,
  type ParkingPopupIcon,
} from '@/lib/parking';
import { formatParkingDisplayName } from '@/lib/parking-names';
import { formatOpeningHoursLines } from '@/lib/opening-hours';
import {
  getBearingDegrees,
  getLiveRouteProgress,
  getRemainingRouteWaypoints,
  isLocationNearRoute,
  LIVE_ROUTE_MIN_HEADING_DISTANCE_METERS,
  type LiveRouteProgress,
} from '@/lib/route-progress';
import { getRouteInstructionManeuver } from '@/lib/route-instructions';
import { buildParkingShareUrl, parseShareLinkState } from '@/lib/share-links';
import {
  buildGoogleMapsLocationUrl,
  buildGoogleStreetViewEmbedUrl,
} from '@/lib/street-view';
import { usePwaInstallPrompt } from '@/components/pwa-install-prompt';
import { Bollard } from '@/components/icons/bollard';
import { useLanguage } from '@/components/language-provider';
import { RouteJourney } from '@/components/route-journey';
import { RoutePlanner } from '@/components/route-planner';
import { RouteDestinationSearch } from '@/components/route-destination-search';
import { DestinationParkingChooser } from '@/components/destination-parking-chooser';
import { SavedRoutesPanel } from '@/components/saved-routes-panel';
import { GpxImportReview } from '@/components/gpx-import-review';
import { OfflineAreasPanel } from '@/components/offline-areas-panel';
import { OfflineAreaSelection } from '@/components/offline-area-selection';
import { captureAnalyticsEvent } from '@/lib/analytics';
import { shareParkingLink, shareRouteFile } from '@/lib/share';
import {
  getParkingDataBaseUrl,
  getParkingTileKeysForDownloadBounds,
  isLocationInParkingCoverage,
  ParkingDataClient,
} from '@/lib/parking-data';
import {
  CyclingPoiDataClient,
  getCyclingPoiDataBaseUrl,
} from '@/lib/cycling-poi-data';
import {
  CycleNetworkDataClient,
  getCycleNetworkDataBaseUrl,
  type CycleNetworkFeature,
  type CycleNetworkManifest,
} from '@/lib/cycle-network-data';
import { getCyclingPoiWebsite } from '@/lib/cycling-poi-website';
import {
  getCyclingPoiServices,
  type CyclingPoiService,
} from '@/lib/cycling-poi-services';
import type { ParkingMapBounds } from '@/lib/map-pins';
import type { ParkingView } from '@/lib/map-pins';
import {
  initialParkingPanelState,
  reduceParkingPanel,
} from '@/lib/parking-panel';
import {
  countActiveParkingFilters,
  defaultParkingFilters,
  evaluateParkingFilters,
  filterAndSortParkingPoints,
  firstUncertainParkingResultIndex,
  hasActiveParkingFilters,
  parkingCapacitySteps,
  summarizeParkingFilterResults,
  type ParkingFilters,
  type ParkingSortMode,
} from '@/lib/parking-filters';
import {
  addSavedNeuk,
  getPointSavedNeukKey,
  getSavedNeukKey,
  isNeukSaved,
  readSavedNeuks,
  removeSavedNeuk,
  subscribeToSavedNeuks,
  writeSavedNeuks,
  type SavedNeukRecord,
} from '@/lib/saved-neuks';
import {
  localeDetails,
  supportedLocales,
  type AppLocale,
} from '@/lib/i18n/locales';
import { translate, type MessageKey } from '@/lib/i18n/messages';
import { createLocalId } from '@/lib/local-id';
import {
  getDestinationParkingShortlist,
  rankDestinationParkingCandidates,
  replaceRouteFinishWithParking,
  type DestinationParkingCandidate,
} from '@/lib/destination-parking';
import {
  addRouteWaypoint,
  buildRouteDraftPreview,
  canCalculateRoute,
  createRouteDraft,
  getDefaultRouteName,
  isRouteDraftMeaningful,
  moveRouteWaypoint,
  removeRouteWaypoint,
  setRouteDestination,
  swapRouteEndpoints,
  type RouteDraft,
} from '@/lib/route-draft';
import {
  createSavedRouteRecord,
  createImportedGpxRouteRecord,
  deleteSavedRoute,
  listSavedRoutes,
  putSavedRoute,
  savedRouteToCycleRoute,
  type SavedRouteRecord,
} from '@/lib/saved-routes';
import {
  createRouteGpxFile,
  downloadGpxFile,
  downloadRouteGpx,
  parseGpxFile,
  type ParsedGpx,
} from '@/lib/gpx';
import { buildRouteShareUrl, parseRouteShareHash } from '@/lib/route-links';
import {
  downloadOfflineArea,
  estimateMissingOfflineAreaBytes,
  getOfflineStorageEstimate,
  isCacheApiSupported,
  isIndexedDbSupported,
  listOfflineAreas,
  mergeOfflineAreaPlans,
  maximumOfflineAreaBytes,
  maximumOfflineAreas,
  maximumOfflineAreasBytes,
  offlineStorageHeadroomRatio,
  planOfflineArea,
  removeOfflineArea,
  requestOfflineStoragePersistence,
  type OfflineAreaDownloadProgress,
  type OfflineAreaPlan,
  type OfflineAreaRecord,
} from '@/lib/offline-areas';
import {
  fetchOfflineMapMetadata,
  planOfflineMapTiles,
  type OfflineMapMetadata,
} from '@/lib/offline-map-tiles';

const CycleParkingMap = dynamic(
  () => import('@/components/cycle-parking-map'),
  {
    ssr: false,
    loading: () => <LocalizedMapLoading />,
  },
);

function LocalizedMapLoading() {
  const { t } = useLanguage();
  return <div className="map-loading">{t('loadingMap')}</div>;
}

const maxPlaceSearchCacheEntries = 12;
const placeSearchDebounceMs = 300;
const placeSearchMinimumCharacters = 3;
const routePlannerCalculationDebounceMs = 250;
const maximumOfflineAreaResources = 5_000;
const closestParkingResultCount = 8;
type DiscoverCategory = 'parking' | CyclingPoiCategory;
type SavedResolvedPoint = ParkingPoint & { savedNeukKey: string };
const discoverCategories: {
  icon: LucideIcon;
  id: DiscoverCategory;
  labelKey: MessageKey;
}[] = [
  { icon: CircleParking, id: 'parking', labelKey: 'categoryParking' },
  { icon: Store, id: 'shop', labelKey: 'categoryShops' },
  { icon: Wrench, id: 'repair', labelKey: 'categoryRepair' },
  { icon: Bike, id: 'hire', labelKey: 'categoryHire' },
];

const cyclingPoiServicePresentation: Record<
  CyclingPoiService,
  { icon: LucideIcon; labelKey: MessageKey }
> = {
  pump: { icon: Gauge, labelKey: 'servicePump' },
  repair: { icon: Wrench, labelKey: 'serviceRepairs' },
  tools: { icon: Hammer, labelKey: 'serviceTools' },
};

const cycleRoutePlanPresentation: Record<
  CycleRoutePlan,
  { labelKey: MessageKey }
> = {
  quietest: { labelKey: 'routeQuietest' },
  balanced: { labelKey: 'routeBalanced' },
  fastest: { labelKey: 'routeFastest' },
};

function getInitialCycleRoutePlan(routes: CycleRoutesByPlan) {
  if (routes[CYCLESTREETS_DEFAULT_ROUTE_PLAN]) {
    return CYCLESTREETS_DEFAULT_ROUTE_PLAN;
  }

  return CYCLESTREETS_ROUTE_PLANS.find((plan) => routes[plan]) ?? null;
}

function getPointCategoryLabelKey(point: ParkingPoint): MessageKey {
  if (!isCyclingPoiPoint(point)) return 'categoryParking';
  if (point.categories[0] === 'shop') return 'categoryShop';
  if (point.categories[0] === 'repair') return 'categoryRepairPlace';
  if (point.categories[0] === 'hire') return 'categoryHirePlace';
  return 'drinkingWater';
}
const copiedMessageDurationMs = 1_800;
const themeStorageKey = 'cycle-parking-theme';
const cycleNetworkStorageKey = 'cycle-parking-cycle-network-visible';
const drinkingWaterStorageKey = 'cycle-parking-drinking-water-visible';
const mobileSheetCollapsedHeightRem = 5.4;
const mobileSheetDragIntentThresholdPx = 6;
const mobileSheetExpandedViewportRatio = 0.52;
const mobileDetailsSheetExpandedViewportRatio = 0.68;
const mobileSheetFlickVelocityPxPerMs = 0.45;
const googleStreetViewApiKey =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY?.trim() ?? '';
const offlineDownloadRequestIntervalMs = (() => {
  const configured = Number(
    process.env.NEXT_PUBLIC_OFFLINE_DOWNLOAD_REQUEST_INTERVAL_MS,
  );
  return Number.isFinite(configured) && configured >= 0 ? configured : 200;
})();
type PresenceMotion = {
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  initial: TargetAndTransition;
  transition: Transition;
};

function getRouteInstructionIcon(
  instruction: CycleRouteInstruction,
): LucideIcon {
  const maneuver = getRouteInstructionManeuver(instruction);

  if (maneuver === 'start') {
    return Route;
  }

  if (maneuver === 'arrive') {
    return MapPin;
  }

  if (maneuver === 'left') {
    return CornerUpLeft;
  }

  if (maneuver === 'right') {
    return CornerUpRight;
  }

  return ArrowUp;
}

const quickFadeTransition: Transition = { duration: 0.16, ease: 'easeOut' };
const smallRiseTransition: Transition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
};
const directionsRevealTransition: Transition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
};
const tooltipTransition: Transition = {
  type: 'spring',
  stiffness: 600,
  damping: 34,
  mass: 0.7,
};
const panelSlideTransition: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 40,
  mass: 0.9,
};
const parkingViewSlideTransition: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};
const panelReplaceTransition: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};
const rowLayoutTransition: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 42,
  mass: 0.8,
};
const buttonTap = { scale: 0.96 };

type PanelMotionContext = {
  direction: number;
  kind: 'crossfade' | 'navigate' | 'replace';
};

const parkingListIconByName: Partial<Record<ParkingPopupIcon, LucideIcon>> = {
  bollard: Bollard,
  building: Building2,
  covered: Umbrella,
  fixture: Boxes,
  'not-covered': UmbrellaOff,
  parking: CircleParking,
  stand: Bike,
  storage: Warehouse,
  unknown: CircleHelp,
};

function ParkingListDetailIcon({ icon }: { icon: ParkingPopupIcon }) {
  const Icon = parkingListIconByName[icon] ?? CircleHelp;

  return <Icon size={13} aria-hidden="true" />;
}

function ParkingDetailStrip({
  className,
  compact,
  details,
  includeDistance,
  point,
  showAllDetails,
}: {
  className?: string;
  compact?: boolean;
  details?: ParkingPopupDetail[];
  includeDistance?: boolean;
  point: ParkingPoint;
  showAllDetails?: boolean;
}) {
  const { locale, t } = useLanguage();
  const parkingDetails = getParkingPopupDetails(point, locale);
  const visibleDetails =
    details ??
    (showAllDetails
      ? parkingDetails.details
      : getParkingEssentialDetails(point, locale));

  if (!includeDistance && visibleDetails.length === 0) {
    return null;
  }

  return (
    <span
      aria-label={t('details')}
      className={[
        'parking-row-details',
        `parking-row-details-count-${visibleDetails.length + (includeDistance ? parkingDetails.metrics.length : 0)}`,
        compact ? 'parking-row-details-compact' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {includeDistance
        ? parkingDetails.metrics.map((metric) => (
            <span className="parking-row-detail" key={metric.label}>
              <MapPin size={13} aria-hidden="true" />
              <span>{metric.value}</span>
            </span>
          ))
        : null}
      {visibleDetails.map((detail, index) => (
        <Fragment key={detail.label}>
          {compact && index > 0 ? (
            <span aria-hidden="true" className="parking-row-detail-separator">
              ·
            </span>
          ) : null}
          <span
            className={`parking-row-detail parking-row-detail-${detail.kind}`}
          >
            {compact ? (
              <span>
                {detail.emphasis ? `${detail.emphasis} ` : ''}
                {detail.kind === 'spaces'
                  ? detail.value.toLowerCase()
                  : detail.value}
              </span>
            ) : (
              <>
                <span className="parking-row-detail-icon">
                  {detail.emphasis ?? (
                    <ParkingListDetailIcon icon={detail.icon} />
                  )}
                </span>
                <span>
                  {detail.kind === 'spaces'
                    ? detail.value.toLowerCase()
                    : detail.value}
                </span>
              </>
            )}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

function ParkingFiltersPanel({
  filters,
  onApply,
  onBack,
  points,
  sortMode,
}: {
  filters: ParkingFilters;
  onApply: (filters: ParkingFilters, sortMode: ParkingSortMode) => void;
  onBack: () => void;
  points: ParkingPoint[];
  sortMode: ParkingSortMode;
}) {
  const { t } = useLanguage();
  const [draftFilters, setDraftFilters] = useState(filters);
  const [draftSortMode, setDraftSortMode] = useState(sortMode);
  const hasDraftFilters = hasActiveParkingFilters(draftFilters);
  const resultSummary = useMemo(
    () => summarizeParkingFilterResults(points, draftFilters),
    [draftFilters, points],
  );
  const eligibleNeuksLabel =
    resultSummary.eligibleCount === 1
      ? t('eligibleNeuk')
      : t('eligibleNeuks', { count: resultSummary.eligibleCount });
  const capacityIndex = Math.max(
    0,
    parkingCapacitySteps.indexOf(
      draftFilters.minimumCapacity as (typeof parkingCapacitySteps)[number],
    ),
  );

  function toggleFilter(filter: keyof Omit<ParkingFilters, 'minimumCapacity'>) {
    const nextFilters = {
      ...draftFilters,
      [filter]: !draftFilters[filter],
    };
    setDraftFilters(nextFilters);
    if (!hasActiveParkingFilters(nextFilters)) {
      setDraftSortMode('nearest');
    }
  }

  function changeCapacity(direction: -1 | 1) {
    const nextIndex = Math.max(
      0,
      Math.min(parkingCapacitySteps.length - 1, capacityIndex + direction),
    );
    const nextFilters = {
      ...draftFilters,
      minimumCapacity: parkingCapacitySteps[nextIndex],
    };
    setDraftFilters(nextFilters);
    if (!hasActiveParkingFilters(nextFilters)) {
      setDraftSortMode('nearest');
    }
  }

  const filterOptions: Array<{
    key: keyof Omit<ParkingFilters, 'minimumCapacity'>;
    label: MessageKey;
  }> = [
    { key: 'covered', label: 'covered' },
    { key: 'publicAccess', label: 'accessPublic' },
    { key: 'frameLockable', label: 'frameLockable' },
    { key: 'cargoBike', label: 'cargoBikeSuitable' },
  ];

  return (
    <section
      aria-label={t('parkingFilters')}
      className="parking-filter-panel parking-filter-panel--overlay panel-view"
    >
      <div className="mobile-sheet-summary" aria-hidden="true">
        <span>
          <strong>{t('parkingFilters')}</strong>
          <small>{eligibleNeuksLabel}</small>
        </span>
      </div>
      <div className="mobile-sheet-body parking-filter-panel-body">
        <header className="parking-filter-header">
          <motion.button type="button" whileTap={buttonTap} onClick={onBack}>
            <ChevronLeft size={18} aria-hidden="true" />
            {t('back')}
          </motion.button>
          <h2>{t('parkingFilters')}</h2>
          <button
            type="button"
            onClick={() => {
              setDraftFilters(defaultParkingFilters);
              setDraftSortMode('nearest');
            }}
          >
            {t('clear')}
          </button>
        </header>

        <div className="parking-filter-scroll">
          <fieldset className="parking-filter-sort">
            <legend>{t('sortBy')}</legend>
            <div>
              {(['nearest', 'best-match'] as const).map((mode) => (
                <button
                  aria-pressed={draftSortMode === mode}
                  data-active={draftSortMode === mode ? 'true' : undefined}
                  disabled={mode === 'best-match' && !hasDraftFilters}
                  key={mode}
                  type="button"
                  onClick={() => setDraftSortMode(mode)}
                >
                  {mode === 'nearest' ? t('nearest') : t('bestMatch')}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="parking-filter-options">
            {filterOptions.map(({ key, label }) => (
              <button
                aria-pressed={draftFilters[key]}
                className="parking-filter-option"
                data-active={draftFilters[key] ? 'true' : undefined}
                key={key}
                type="button"
                onClick={() => toggleFilter(key)}
              >
                <span>{t(label)}</span>
                <span className="parking-filter-check" aria-hidden="true">
                  {draftFilters[key] ? <Check size={16} /> : null}
                </span>
              </button>
            ))}
            <div className="parking-filter-capacity">
              <span>
                <strong>{t('minimumCapacity')}</strong>
                <small>{t('minimumCapacityHelp')}</small>
              </span>
              <div>
                <button
                  aria-label={t('decreaseMinimumCapacity')}
                  disabled={capacityIndex === 0}
                  type="button"
                  onClick={() => changeCapacity(-1)}
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <output aria-live="polite">
                  {draftFilters.minimumCapacity > 0
                    ? draftFilters.minimumCapacity
                    : t('any')}
                </output>
                <button
                  aria-label={t('increaseMinimumCapacity')}
                  disabled={capacityIndex === parkingCapacitySteps.length - 1}
                  type="button"
                  onClick={() => changeCapacity(1)}
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <p className="parking-filter-unknown-note">
            <CircleHelp size={17} aria-hidden="true" />
            {t('unknownValuesRemainVisible')}
          </p>
        </div>

        <motion.button
          className="parking-filter-apply"
          data-testid="apply-parking-filters"
          type="button"
          whileTap={buttonTap}
          onClick={() => onApply(draftFilters, draftSortMode)}
        >
          {resultSummary.eligibleCount === 1
            ? t('showEligibleNeuk')
            : t('showEligibleNeuks', {
                count: resultSummary.eligibleCount,
              })}
        </motion.button>
      </div>
    </section>
  );
}

type LocationState =
  | { status: 'fallback'; location: UserLocation }
  | { status: 'locating'; location: UserLocation; label?: string }
  | { status: 'located'; location: UserLocation }
  | {
      status: 'searched';
      location: UserLocation;
      label: string;
      isCached?: boolean;
    }
  | { status: 'too-far'; location: UserLocation }
  | { status: 'denied'; location: UserLocation }
  | { status: 'unavailable'; location: UserLocation };

type DirectionsState =
  | { status: 'idle' }
  | { status: 'missing-key'; parkingId: string }
  | { status: 'loading'; parkingId: string }
  | {
      status: 'loaded';
      parkingId: string;
      routes: CycleRoutesByPlan;
      selectedPlan: CycleRoutePlan;
    }
  | { status: 'error'; parkingId: string; message: string };

type LiveRouteTrackingState =
  | { status: 'idle' }
  | { status: 'starting' }
  | {
      status: 'tracking';
      accuracyMeters: number | null;
      headingDegrees: number | null;
      location: UserLocation;
      updatedAt: number;
    }
  | { status: 'denied' }
  | { status: 'too-far' }
  | { status: 'unavailable' };

type ParkingActionSource = 'details' | 'list' | 'popup';
type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';
type MobileSheetState = 'expanded' | 'collapsed';
type ParkingDataStatus = 'loading' | 'ready' | 'error';
type SavedNeuksStatus = 'loading' | 'ready' | 'storage-error';
type RouteWorkspaceView =
  | 'destination-parking'
  | 'detail'
  | 'import'
  | 'library'
  | 'planner';
type RoutePlannerStatus =
  | 'error'
  | 'idle'
  | 'loaded'
  | 'loading'
  | 'missing-key';

type RouteWaypointPlacementSnapshot = {
  draft: RouteDraft;
  message: string | null;
  routes: CycleRoutesByPlan;
  status: RoutePlannerStatus;
};

type DestinationParkingState = {
  candidates: DestinationParkingCandidate[];
  expanded: boolean;
  originalDestination: CycleRouteWaypoint;
  selectedId: string | null;
  status: 'error' | 'loading' | 'ready';
};

type RouteDestinationSearchState = {
  activeResultIndex: number;
  isOpen: boolean;
  message: string | null;
  query: string;
  results: PlaceSearchResult[];
  searchStatus: 'error' | 'idle' | 'loading';
  selectedId: string | null;
};

const initialRouteDestinationSearchState: RouteDestinationSearchState = {
  activeResultIndex: 0,
  isOpen: false,
  message: null,
  query: '',
  results: [],
  searchStatus: 'idle',
  selectedId: null,
};

type ParkingMoreMenuPosition = {
  bottom?: number;
  right: number;
  top?: number;
};

type CopiedShareButton = {
  parkingId: string;
  source: ParkingActionSource;
};

const themeOptions: {
  icon: typeof Monitor;
  labelKey: MessageKey;
  mode: ThemeMode;
}[] = [
  { icon: Monitor, labelKey: 'system', mode: 'system' },
  { icon: Sun, labelKey: 'light', mode: 'light' },
  { icon: Moon, labelKey: 'dark', mode: 'dark' },
];

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return prefersDark ? 'dark' : 'light';
  }

  return mode;
}

function prepareDisplayPoints<T extends ParkingPoint>(
  points: T[],
  locale: AppLocale,
): T[] {
  return points.map((point) => ({
    ...point,
    name: formatParkingDisplayName(point, locale),
  }));
}

function keepParkingPointsWhenUnchanged(
  current: ParkingPoint[],
  next: ParkingPoint[],
) {
  return current.length === next.length &&
    current.every((point, index) => point.id === next[index]?.id)
    ? current
    : next;
}

function getOfflineAreaCenter(bounds: ParkingMapBounds): UserLocation {
  return {
    latitude: (bounds.north + bounds.south) / 2,
    longitude: (bounds.east + bounds.west) / 2,
  };
}

function getLoadedAppShellPlan(): OfflineAreaPlan {
  const origin = window.location.origin;
  const resources = performance
    .getEntriesByType('resource')
    .flatMap((entry) => {
      const resource = entry as PerformanceResourceTiming;
      const url = new URL(resource.name, window.location.href);
      if (
        url.origin !== origin ||
        (!url.pathname.includes('/_next/static/') &&
          !url.pathname.includes('/vendor/maplibre-gl/'))
      ) {
        return [];
      }
      return [
        {
          byteLength: Math.max(
            1_024,
            resource.transferSize || resource.decodedBodySize || 0,
          ),
          key: `app-shell:${url.pathname}`,
          url: url.toString(),
        },
      ];
    });
  const uniqueResources = [
    ...new Map(resources.map((resource) => [resource.url, resource])).values(),
  ];
  return {
    datasets: [],
    estimatedBytes: uniqueResources.reduce(
      (total, resource) => total + resource.byteLength,
      0,
    ),
    manifestRefreshedAt: '',
    resources: uniqueResources,
  };
}

export default function CycleParkingFinder() {
  const { formattingLocale, locale, setLocale, t } = useLanguage();
  const shouldReduceMotion = useReducedMotion();
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'fallback',
    location: EDINBURGH_FALLBACK_LOCATION,
  });
  const [parkingPoints, setParkingPoints] = useState<ParkingPoint[]>([]);
  const [discoverCategory, setDiscoverCategory] =
    useState<DiscoverCategory>('parking');
  const [parkingFilters, setParkingFilters] = useState(defaultParkingFilters);
  const [parkingSortMode, setParkingSortMode] =
    useState<ParkingSortMode>('nearest');
  const [cyclingPoiPoints, setCyclingPoiPoints] = useState<CyclingPoiPoint[]>(
    [],
  );
  const [cyclingPoiDataStatus, setCyclingPoiDataStatus] =
    useState<ParkingDataStatus>('loading');
  const [cyclingPoiDataMessage, setCyclingPoiDataMessage] = useState<
    string | null
  >(null);
  const [parkingManifest, setParkingManifest] =
    useState<ParkingDataManifest | null>(null);
  const [cycleNetworkManifest, setCycleNetworkManifest] =
    useState<CycleNetworkManifest | null>(null);
  const [cycleNetworkFeatures, setCycleNetworkFeatures] = useState<
    CycleNetworkFeature[]
  >([]);
  const [isCycleNetworkAvailable, setIsCycleNetworkAvailable] = useState(false);
  const [isCycleNetworkVisible, setIsCycleNetworkVisible] = useState(true);
  const [isDrinkingWaterVisible, setIsDrinkingWaterVisible] = useState(false);
  const [isMapLayersOpen, setIsMapLayersOpen] = useState(false);
  const [isOfflineAreasOpen, setIsOfflineAreasOpen] = useState(false);
  const [offlineAreas, setOfflineAreas] = useState<OfflineAreaRecord[]>([]);
  const [offlineAreasLoading, setOfflineAreasLoading] = useState(false);
  const [offlineAreaSelectionBounds, setOfflineAreaSelectionBounds] =
    useState<ParkingMapBounds | null>(null);
  const [offlineAreaPlan, setOfflineAreaPlan] =
    useState<OfflineAreaPlan | null>(null);
  const [offlineAreaName, setOfflineAreaName] = useState('');
  const [offlineAreaError, setOfflineAreaError] = useState<string | null>(null);
  const [offlineAreaMessage, setOfflineAreaMessage] = useState<string | null>(
    null,
  );
  const [offlineAreaStorageWarning, setOfflineAreaStorageWarning] = useState<
    string | null
  >(null);
  const [offlineAreaProgress, setOfflineAreaProgress] =
    useState<OfflineAreaDownloadProgress | null>(null);
  const [busyOfflineAreaId, setBusyOfflineAreaId] = useState<string | null>(
    null,
  );
  const [cycleNetworkZoom, setCycleNetworkZoom] = useState(13);
  const [parkingDataStatus, setParkingDataStatus] =
    useState<ParkingDataStatus>('loading');
  const [parkingDataMessage, setParkingDataMessage] = useState<string | null>(
    null,
  );
  const [currentLocationFocusRequestId, setCurrentLocationFocusRequestId] =
    useState(0);
  const [parkingPanelState, dispatchParkingPanel] = useReducer(
    reduceParkingPanel,
    initialParkingPanelState,
  );
  const parkingView = parkingPanelState.listContext;
  const selectedId = parkingPanelState.selectedId;
  const [savedNeuksStatus, setSavedNeuksStatus] =
    useState<SavedNeuksStatus>('loading');
  const [savedNeuks, setSavedNeuks] = useState<SavedNeukRecord[]>([]);
  const [savedRawPoints, setSavedRawPoints] = useState<SavedResolvedPoint[]>(
    [],
  );
  const [missingSavedIds, setMissingSavedIds] = useState<string[]>([]);
  const [failedSavedIds, setFailedSavedIds] = useState<string[]>([]);
  const [isSavedPointsLoading, setIsSavedPointsLoading] = useState(false);
  const [savedPointsLoadRequestId, setSavedPointsLoadRequestId] = useState(0);
  const [savedNeuksMessage, setSavedNeuksMessage] = useState<string | null>(
    null,
  );
  const [placeQuery, setPlaceQuery] = useState('');
  const locationRequestId = useRef(0);
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [activePlaceResultIndex, setActivePlaceResultIndex] = useState(0);
  const [placeSearchMessage, setPlaceSearchMessage] = useState<string | null>(
    null,
  );
  const [copiedShareButton, setCopiedShareButton] =
    useState<CopiedShareButton | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [directionsState, setDirectionsState] = useState<DirectionsState>({
    status: 'idle',
  });
  const [routeWorkspaceView, setRouteWorkspaceView] =
    useState<RouteWorkspaceView | null>(null);
  const [routeLibraryReturnView, setRouteLibraryReturnView] = useState<
    'planner' | null
  >(null);
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null);
  const [journeyEditing, setJourneyEditing] = useState(false);
  const [journeySearchTarget, setJourneySearchTarget] = useState<
    'start' | 'destination'
  >('destination');
  const [pendingJourneyDestination, setPendingJourneyDestination] =
    useState<CycleRouteWaypoint | null>(null);
  const [routePlannerRoutes, setRoutePlannerRoutes] =
    useState<CycleRoutesByPlan>({});
  const [routePlannerStatus, setRoutePlannerStatus] =
    useState<RoutePlannerStatus>('idle');
  const [routePlannerMessage, setRoutePlannerMessage] = useState<string | null>(
    null,
  );
  const [destinationParkingState, setDestinationParkingState] =
    useState<DestinationParkingState | null>(null);
  const [routeDestinationSearch, setRouteDestinationSearch] =
    useState<RouteDestinationSearchState>(initialRouteDestinationSearchState);
  const [routeWaypointPlacementSnapshot, setRouteWaypointPlacementSnapshot] =
    useState<RouteWaypointPlacementSnapshot | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteRecord[]>([]);
  const [savedRoutesStatus, setSavedRoutesStatus] = useState<
    'error' | 'loading' | 'ready'
  >('loading');
  const [savedRoutesError, setSavedRoutesError] = useState<string | null>(null);
  const [savedRoutesMessage, setSavedRoutesMessage] = useState<string | null>(
    null,
  );
  const [selectedSavedRoute, setSelectedSavedRoute] =
    useState<SavedRouteRecord | null>(null);
  const [pendingGpxImport, setPendingGpxImport] = useState<ParsedGpx | null>(
    null,
  );
  const sharedRouteOpened = useRef(false);
  const [liveRouteTracking, setLiveRouteTracking] =
    useState<LiveRouteTrackingState>({
      status: 'idle',
    });
  const [activeInstruction, setActiveInstruction] = useState<{
    id: string;
    requestId: number;
  } | null>(null);
  const [routeInstructionFocusRequest, setRouteInstructionFocusRequest] =
    useState<{
      id: string;
      requestId: number;
    } | null>(null);
  const [isPlaceSearching, setIsPlaceSearching] = useState(false);
  const [hasUsedPlaceSearch, setHasUsedPlaceSearch] = useState(false);
  const [isAttributionModalOpen, setIsAttributionModalOpen] = useState(false);
  const [streetViewPoint, setStreetViewPoint] = useState<ParkingPoint | null>(
    null,
  );
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [openParkingMoreMenuId, setOpenParkingMoreMenuId] = useState<
    string | null
  >(null);
  const [parkingMoreMenuPosition, setParkingMoreMenuPosition] =
    useState<ParkingMoreMenuPosition | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [isClientReady, setIsClientReady] = useState(false);
  const [mobileSheetState, setMobileSheetState] =
    useState<MobileSheetState>('expanded');
  const [isMobileSheetDragging, setIsMobileSheetDragging] = useState(false);
  const [
    mobileContentSheetExpandedHeightPx,
    setMobileContentSheetExpandedHeightPx,
  ] = useState<number | null>(null);
  const [isMobileContentSheetOverflowing, setIsMobileContentSheetOverflowing] =
    useState(false);
  const mobileSheetProgressValue = useMotionValue(1);
  const mobileSheetBodyOffset = useTransform(
    mobileSheetProgressValue,
    (progress) => `${((1 - progress) * 10).toFixed(2)}px`,
  );
  const mobileSheetBodyOpacity = useTransform(
    mobileSheetProgressValue,
    (progress) => Math.max(0, Math.min(1, (progress - 0.15) / 0.7)),
  );
  const mobileSheetSummaryOffset = useTransform(
    mobileSheetProgressValue,
    (progress) => `${(progress * -6).toFixed(2)}px`,
  );
  const mobileSheetSummaryOpacity = useTransform(
    mobileSheetProgressValue,
    (progress) => Math.max(0, Math.min(1, (0.4 - progress) / 0.4)),
  );
  const { canInstall, installApp } = usePwaInstallPrompt();
  const placeSearchCache = useRef(new Map<string, PlaceSearchResult[]>());
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const parkingDataClient = useRef<ParkingDataClient | null>(null);
  const cyclingPoiDataClient = useRef<CyclingPoiDataClient | null>(null);
  const cycleNetworkDataClient = useRef<CycleNetworkDataClient | null>(null);
  const cycleNetworkRequestId = useRef(0);
  const offlineAreaPlanRequestId = useRef(0);
  const offlineMapMetadata = useRef<Promise<OfflineMapMetadata> | null>(null);
  const offlineAreaDownloadAbortController = useRef<AbortController | null>(
    null,
  );
  const cycleNetworkViewport = useRef<{
    bounds: ParkingMapBounds;
    zoom: number;
  } | null>(null);
  const routePlannerCache = useRef(new Map<string, CycleRoutesByPlan>());
  const placeSearchAbortController = useRef<AbortController | null>(null);
  const placeSearchDebounceTimeout = useRef<number | null>(null);
  const placeSearchRequestId = useRef(0);
  const directionsRequestId = useRef(0);
  const routePlannerRequestId = useRef(0);
  const destinationParkingRequestId = useRef(0);
  const routeDestinationSearchAbortController = useRef<AbortController | null>(
    null,
  );
  const routeDestinationSearchDebounceTimeout = useRef<number | null>(null);
  const routeDestinationSearchRequestId = useRef(0);
  const routePlannerCalculationTimeout = useRef<number | null>(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [rerouteError, setRerouteError] = useState<string | null>(null);
  const rerouteRequestId = useRef(0);
  const latestTrackingRoute = useRef<CycleRoute | null>(null);
  const confirmedRouteProgress = useRef(0);
  const liveRouteWatchId = useRef<number | null>(null);
  const previousLiveRouteMarkerPosition = useRef<CycleRoutePoint | null>(null);
  const copiedMessageTimeout = useRef<number | null>(null);
  const savedNeuksMessageTimeout = useRef<number | null>(null);
  const attributionDialog = useRef<HTMLDialogElement>(null);
  const streetViewDialog = useRef<HTMLDialogElement>(null);
  const controlPaneRef = useRef<HTMLElement | null>(null);
  const categoryChipsRef = useRef<HTMLDivElement>(null);
  const parkingFiltersButtonRef = useRef<HTMLButtonElement>(null);
  const parkingListScroll = useRef<HTMLDivElement>(null);
  const savedHeadingRef = useRef<HTMLHeadingElement>(null);
  const parkingMoreButtonRef = useRef<HTMLButtonElement>(null);
  const parkingMoreMenuRef = useRef<HTMLDivElement>(null);
  const parkingListItemRefs = useRef(new Map<string, HTMLLIElement>());
  const selectedPointCache = useRef<ParkingPoint | null>(null);
  const savedResolutionRequestId = useRef(0);
  const parkingViewState = useRef<
    Record<ParkingView, { scrollTop: number; selectedId: string | null }>
  >({
    nearby: { scrollTop: 0, selectedId: null },
    saved: { scrollTop: 0, selectedId: null },
  });
  const restoringParkingViewScroll = useRef<ParkingView | null>(null);
  const mobileSheetDrag = useRef<{
    currentY: number;
    lastTimestamp: number;
    lastY: number;
    pointerId: number;
    rangePx: number;
    startProgress: number;
    startY: number;
    velocityY: number;
  } | null>(null);
  const ignoreNextSheetGripClick = useRef(false);
  const subtleTap = shouldReduceMotion ? undefined : buttonTap;
  const fadePresence: PresenceMotion = {
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    initial: { opacity: 0 },
    transition: quickFadeTransition,
  };
  const risePresence: PresenceMotion = shouldReduceMotion
    ? fadePresence
    : {
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 6 },
        initial: { opacity: 0, y: 8 },
        transition: smallRiseTransition,
      };
  const directionsRevealPresence: PresenceMotion = shouldReduceMotion
    ? fadePresence
    : {
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 3 },
        initial: { opacity: 0, y: 4 },
        transition: directionsRevealTransition,
      };
  const panelMotionVariants = shouldReduceMotion
    ? {
        center: { opacity: 1, transition: quickFadeTransition },
        enter: { opacity: 0, transition: quickFadeTransition },
        exit: { opacity: 0, transition: quickFadeTransition },
      }
    : {
        center: ({ kind }: PanelMotionContext) => ({
          opacity: 1,
          scale: 1,
          transition:
            kind === 'crossfade'
              ? quickFadeTransition
              : kind === 'replace'
                ? panelReplaceTransition
                : panelSlideTransition,
          x: 0,
          y: 0,
        }),
        enter: ({ direction, kind }: PanelMotionContext) => ({
          opacity: kind === 'replace' || kind === 'crossfade' ? 0 : 1,
          scale: kind === 'replace' ? 0.99 : 1,
          transition:
            kind === 'crossfade'
              ? quickFadeTransition
              : kind === 'replace'
                ? panelReplaceTransition
                : panelSlideTransition,
          x:
            kind === 'replace' || kind === 'crossfade'
              ? 0
              : direction > 0
                ? '100%'
                : '-100%',
          y: kind === 'replace' ? 6 : 0,
        }),
        exit: ({ direction, kind }: PanelMotionContext) => ({
          opacity: 0,
          scale: kind === 'replace' ? 0.995 : 1,
          transition:
            kind === 'crossfade'
              ? quickFadeTransition
              : kind === 'replace'
                ? panelReplaceTransition
                : panelSlideTransition,
          x:
            kind === 'replace' || kind === 'crossfade'
              ? 0
              : direction > 0
                ? '-100%'
                : '100%',
          y: kind === 'replace' ? -3 : 0,
        }),
      };
  const parkingViewSlideVariants = shouldReduceMotion
    ? {
        center: { opacity: 1 },
        enter: { opacity: 0 },
        exit: { opacity: 0 },
      }
    : {
        center: { opacity: 1, x: 0 },
        enter: (direction: number) => ({
          opacity: 0,
          x: direction > 0 ? 22 : -22,
        }),
        exit: (direction: number) => ({
          opacity: 0,
          x: direction > 0 ? -14 : 14,
        }),
      };
  const routeContentVariants = shouldReduceMotion
    ? {
        animate: { opacity: 1 },
        initial: { opacity: 0 },
      }
    : {
        animate: {
          opacity: 1,
          transition: {
            delayChildren: 0.04,
            staggerChildren: 0.026,
          },
          y: 0,
        },
        initial: { opacity: 0, y: 4 },
      };
  const routeStepVariants = shouldReduceMotion
    ? {
        animate: { opacity: 1 },
        initial: { opacity: 0 },
      }
    : {
        animate: {
          opacity: 1,
          transition: directionsRevealTransition,
          y: 0,
        },
        initial: { opacity: 0, y: 5 },
      };
  const popoverPresence: PresenceMotion = shouldReduceMotion
    ? fadePresence
    : {
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: 6 },
        initial: { opacity: 0, scale: 0.98, y: 6 },
        transition: smallRiseTransition,
      };
  const tooltipPresence: PresenceMotion = shouldReduceMotion
    ? fadePresence
    : {
        animate: { opacity: 1, scale: 1, y: '-50%' },
        exit: { opacity: 0, scale: 0.96, y: '-50%' },
        initial: { opacity: 0, scale: 0.94, y: '-50%' },
        transition: tooltipTransition,
      };

  const refreshSavedRoutes = useCallback(async () => {
    setSavedRoutesStatus('loading');
    try {
      const records = await listSavedRoutes();
      setSavedRoutes(records);
      setSavedRoutesStatus('ready');
      setSavedRoutesError(null);
      return records;
    } catch {
      setSavedRoutesStatus('error');
      setSavedRoutesError(t('routeStorageError'));
      return [];
    }
  }, [t]);

  const refreshOfflineAreas = useCallback(async () => {
    if (!isCacheApiSupported() || !isIndexedDbSupported()) {
      setOfflineAreas([]);
      return [];
    }
    setOfflineAreasLoading(true);
    try {
      const records = await listOfflineAreas();
      setOfflineAreas(records);
      return records;
    } catch {
      setOfflineAreaError(t('offlineDownloadFailed'));
      return [];
    } finally {
      setOfflineAreasLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshSavedRoutes();
  }, [refreshSavedRoutes]);

  useEffect(() => {
    void refreshOfflineAreas();
  }, [refreshOfflineAreas]);

  useEffect(() => {
    let cancelled = false;

    async function initializeParkingData() {
      setIsClientReady(true);
      const client = new ParkingDataClient(
        getParkingDataBaseUrl(window.location.href),
      );
      parkingDataClient.current = client;

      try {
        const manifest = await client.initialize();
        const { referenceLocation, selectedParkingId } = parseShareLinkState(
          window.location.search,
        );
        const permission = await getLocationPermission();
        if (permission === 'denied') {
          clearLastLocation();
          rememberLocationDenial();
        }
        const lastLocation =
          permission === 'denied' ? null : readLastLocation();
        const cachedLocation =
          lastLocation && isLocationInParkingCoverage(lastLocation, manifest)
            ? lastLocation
            : null;
        const lastArea = readLastArea();
        const restoredReference: Extract<
          LocationState,
          { status: 'searched' }
        > | null =
          lastArea && isLocationInParkingCoverage(lastArea.location, manifest)
            ? {
                status: 'searched',
                location: lastArea.location,
                label:
                  lastArea.label ??
                  translate(localeRef.current, 'lastViewedArea'),
              }
            : cachedLocation
              ? {
                  status: 'searched',
                  location: cachedLocation,
                  label: translate(localeRef.current, 'lastKnownLocation'),
                  isCached: true,
                }
              : null;
        await client.loadLocation(
          referenceLocation ??
            restoredReference?.location ??
            EDINBURGH_FALLBACK_LOCATION,
        );
        const selectedPoint = selectedParkingId
          ? await client.loadPoint(selectedParkingId)
          : null;

        if (cancelled) {
          return;
        }

        setParkingManifest(manifest);
        setParkingPoints((current) =>
          keepParkingPointsWhenUnchanged(
            current,
            prepareDisplayPoints(client.getLoadedPoints(), localeRef.current),
          ),
        );
        setParkingDataStatus('ready');
        setParkingDataMessage(
          selectedParkingId && !selectedPoint
            ? translate(localeRef.current, 'parkingLinkMissing')
            : null,
        );

        if (referenceLocation) {
          if (isLocationInParkingCoverage(referenceLocation, manifest)) {
            dispatchParkingPanel({
              selectedId: selectedPoint?.id ?? null,
              type: 'INITIALIZE_SELECTION',
            });
            setLocationState({
              status: 'searched',
              label: translate(localeRef.current, 'sharedReference'),
              location: referenceLocation,
            });
          } else {
            dispatchParkingPanel({
              selectedId: null,
              type: 'INITIALIZE_SELECTION',
            });
            setLocationState({
              status: 'too-far',
              location: EDINBURGH_FALLBACK_LOCATION,
            });
          }
          return;
        }

        if (selectedPoint) {
          dispatchParkingPanel({
            selectedId: selectedPoint.id,
            type: 'INITIALIZE_SELECTION',
          });
          setLocationState({
            status: 'searched',
            label: selectedPoint.name,
            location: {
              latitude: selectedPoint.latitude,
              longitude: selectedPoint.longitude,
            },
          });
          requestCurrentLocationFocus();
          return;
        }

        if (restoredReference) {
          setLocationState(restoredReference);
          requestCurrentLocationFocus();
        }
        if (canUseGeolocation() && beginAutomaticLocationRequest(permission)) {
          requestLocation(undefined, false, restoredReference);
        }
      } catch {
        if (cancelled) {
          return;
        }
        setParkingDataStatus('error');
        setParkingDataMessage(translate(localeRef.current, 'dataUnavailable'));
      }
    }

    void initializeParkingData();
    return () => {
      cancelled = true;
      locationRequestId.current += 1;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const client = new CycleNetworkDataClient(
      getCycleNetworkDataBaseUrl(window.location.href),
    );
    cycleNetworkDataClient.current = client;
    try {
      setIsCycleNetworkVisible(
        window.localStorage.getItem(cycleNetworkStorageKey) !== 'false',
      );
      setIsDrinkingWaterVisible(
        window.localStorage.getItem(drinkingWaterStorageKey) === 'true',
      );
    } catch {
      setIsCycleNetworkVisible(true);
      setIsDrinkingWaterVisible(false);
    }
    void client
      .initialize()
      .then((manifest) => {
        if (!cancelled) setCycleNetworkManifest(manifest);
      })
      .catch(() => {
        if (!cancelled) setCycleNetworkManifest(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let stored: ReturnType<typeof readSavedNeuks>;
    try {
      stored = readSavedNeuks(window.localStorage);
    } catch {
      stored = { items: [], ok: false };
    }
    setSavedNeuks(stored.items);
    setSavedNeuksStatus(stored.ok ? 'ready' : 'storage-error');
    if (!stored.ok) {
      setSavedNeuksMessage(translate(localeRef.current, 'savedStorageError'));
    }

    return subscribeToSavedNeuks((items) => {
      setSavedNeuks(items);
      setSavedNeuksStatus('ready');
      setSavedNeuksMessage(null);
    });
  }, []);

  useEffect(() => {
    if (savedNeuksStatus === 'storage-error') {
      setSavedNeuksMessage(t('savedStorageError'));
    }
  }, [savedNeuksStatus, t]);

  useEffect(() => {
    const parkingClient = parkingDataClient.current;
    if (!parkingClient || !parkingManifest) {
      return;
    }

    const requestId = savedResolutionRequestId.current + 1;
    savedResolutionRequestId.current = requestId;
    if (savedNeuks.length === 0) {
      setIsSavedPointsLoading(false);
      setSavedRawPoints([]);
      setMissingSavedIds([]);
      setFailedSavedIds([]);
      return;
    }

    setIsSavedPointsLoading(true);
    const parkingRecords = savedNeuks.filter(({ kind }) => kind === 'parking');
    const cyclingPlaceRecords = savedNeuks.filter(
      ({ kind }) => kind === 'cycling-place',
    );
    const cyclingClient =
      cyclingPoiDataClient.current ??
      (cyclingPlaceRecords.length > 0
        ? new CyclingPoiDataClient(
            getCyclingPoiDataBaseUrl(window.location.href),
          )
        : null);
    if (cyclingClient) {
      cyclingPoiDataClient.current = cyclingClient;
    }

    void Promise.all([
      parkingClient.loadPoints(parkingRecords.map(({ id }) => id)),
      cyclingClient && cyclingPlaceRecords.length > 0
        ? cyclingClient.loadPoints(cyclingPlaceRecords.map(({ id }) => id))
        : Promise.resolve({ failedIds: [], missingIds: [], points: [] }),
    ])
      .then(([parkingResult, cyclingResult]) => {
        if (savedResolutionRequestId.current !== requestId) {
          return;
        }
        const failedKeys = [
          ...parkingResult.failedIds.map((id) =>
            getSavedNeukKey('parking', id),
          ),
          ...cyclingResult.failedIds.map((id) =>
            getSavedNeukKey('cycling-place', id),
          ),
        ];
        const missingKeys = [
          ...parkingResult.missingIds.map((id) =>
            getSavedNeukKey('parking', id),
          ),
          ...cyclingResult.missingIds.map((id) =>
            getSavedNeukKey('cycling-place', id),
          ),
        ];
        const failedKeySet = new Set(failedKeys);
        setSavedRawPoints((current) => {
          const nextPoints = new Map(
            current
              .filter(({ savedNeukKey }) => failedKeySet.has(savedNeukKey))
              .map((point) => [point.savedNeukKey, point]),
          );
          for (const point of parkingResult.points) {
            const savedNeukKey = getSavedNeukKey('parking', point.id);
            nextPoints.set(savedNeukKey, { ...point, savedNeukKey });
          }
          for (const point of cyclingResult.points) {
            const savedNeukKey = getSavedNeukKey('cycling-place', point.id);
            nextPoints.set(savedNeukKey, { ...point, savedNeukKey });
          }
          return [...nextPoints.values()];
        });
        setMissingSavedIds(missingKeys);
        setFailedSavedIds(failedKeys);
        setIsSavedPointsLoading(false);
      })
      .catch(() => {
        if (savedResolutionRequestId.current !== requestId) {
          return;
        }
        const savedKeySet = new Set(savedNeuks.map(({ key }) => key));
        setSavedRawPoints((current) =>
          current.filter(({ savedNeukKey }) => savedKeySet.has(savedNeukKey)),
        );
        setMissingSavedIds((current) =>
          current.filter((key) => savedKeySet.has(key)),
        );
        setFailedSavedIds(savedNeuks.map(({ key }) => key));
        setIsSavedPointsLoading(false);
      });
  }, [parkingManifest, savedNeuks, savedPointsLoadRequestId]);

  useEffect(() => {
    const client = parkingDataClient.current;
    if (client) {
      setParkingPoints(prepareDisplayPoints(client.getLoadedPoints(), locale));
    }
    const cyclingPoiClient = cyclingPoiDataClient.current;
    if (cyclingPoiClient) {
      setCyclingPoiPoints(
        prepareDisplayPoints(cyclingPoiClient.getLoadedPoints(), locale),
      );
    }
    if (placeSearchDebounceTimeout.current !== null) {
      window.clearTimeout(placeSearchDebounceTimeout.current);
      placeSearchDebounceTimeout.current = null;
    }
    placeSearchAbortController.current?.abort();
    placeSearchAbortController.current = null;
    placeSearchRequestId.current += 1;
    if (routeDestinationSearchDebounceTimeout.current !== null) {
      window.clearTimeout(routeDestinationSearchDebounceTimeout.current);
      routeDestinationSearchDebounceTimeout.current = null;
    }
    routeDestinationSearchAbortController.current?.abort();
    routeDestinationSearchAbortController.current = null;
    routeDestinationSearchRequestId.current += 1;
    placeSearchCache.current.clear();
    setIsPlaceSearching(false);
    setActivePlaceResultIndex(0);
    setPlaceResults([]);
    setPlaceSearchMessage(null);
    setRouteDestinationSearch(initialRouteDestinationSearchState);
  }, [locale]);

  useEffect(() => {
    const client = parkingDataClient.current;
    const manifest = client?.getManifest();
    if (!client || !manifest || parkingDataStatus === 'error') {
      return;
    }

    let cancelled = false;
    setParkingDataStatus('loading');
    setParkingDataMessage(t('loadingNearby'));
    void client
      .loadLocation(locationState.location)
      .then(() => {
        if (cancelled) {
          return;
        }
        setParkingPoints((current) =>
          keepParkingPointsWhenUnchanged(
            current,
            prepareDisplayPoints(client.getLoadedPoints(), locale),
          ),
        );
        setParkingDataStatus('ready');
        setParkingDataMessage(null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setParkingDataStatus('error');
        setParkingDataMessage(t('nearbyLoadError'));
      });

    return () => {
      cancelled = true;
    };
  }, [
    locationState.location.latitude,
    locationState.location.longitude,
    parkingManifest?.refreshedAt,
    locale,
    t,
  ]);

  useEffect(() => {
    if (discoverCategory === 'parking' && !isDrinkingWaterVisible) {
      setCyclingPoiDataMessage(null);
      return;
    }

    let cancelled = false;
    const client =
      cyclingPoiDataClient.current ??
      new CyclingPoiDataClient(getCyclingPoiDataBaseUrl(window.location.href));
    cyclingPoiDataClient.current = client;
    setCyclingPoiDataStatus('loading');
    setCyclingPoiDataMessage(
      discoverCategory === 'parking'
        ? t('loadingDrinkingWater')
        : t('loadingCyclingPlaces'),
    );

    void client
      .loadLocation(locationState.location)
      .then(() => {
        if (cancelled) return;
        const manifest = client.getManifest();
        setCyclingPoiPoints(
          prepareDisplayPoints(client.getLoadedPoints(), localeRef.current),
        );
        setCyclingPoiDataStatus('ready');
        setCyclingPoiDataMessage(
          manifest &&
            !isLocationInParkingCoverage(locationState.location, manifest)
            ? t('cyclingPlacesCoverageOnly')
            : null,
        );
        requestCurrentLocationFocus();
      })
      .catch(() => {
        if (cancelled) return;
        setCyclingPoiDataStatus('error');
        setCyclingPoiDataMessage(
          discoverCategory === 'parking'
            ? t('drinkingWaterLoadError')
            : t('cyclingPlacesLoadError'),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    discoverCategory,
    isDrinkingWaterVisible,
    locationState.location.latitude,
    locationState.location.longitude,
    t,
  ]);

  const loadCycleNetworkForBounds = useCallback(
    (bounds: ParkingMapBounds, zoom: number, loadFeatures: boolean) => {
      const networkClient = cycleNetworkDataClient.current;
      if (!networkClient) return;
      const requestId = cycleNetworkRequestId.current + 1;
      cycleNetworkRequestId.current = requestId;
      void networkClient
        .loadBounds(bounds, zoom, { loadFeatures })
        .then((data) => {
          if (cycleNetworkRequestId.current !== requestId) return;
          setIsCycleNetworkAvailable(data.available);
          setCycleNetworkFeatures(data.features);
        })
        .catch(() => {
          if (cycleNetworkRequestId.current !== requestId) return;
          setCycleNetworkFeatures([]);
        });
    },
    [],
  );

  useEffect(() => {
    const viewport = cycleNetworkViewport.current;
    if (!cycleNetworkManifest || !viewport) return;
    loadCycleNetworkForBounds(
      viewport.bounds,
      viewport.zoom,
      isCycleNetworkVisible,
    );
  }, [cycleNetworkManifest, isCycleNetworkVisible, loadCycleNetworkForBounds]);

  const loadMapDataForBounds = useCallback(
    (bounds: ParkingMapBounds, zoom: number) => {
      setCycleNetworkZoom(zoom);
      cycleNetworkViewport.current = { bounds, zoom };
      if (offlineAreaSelectionBounds) {
        setOfflineAreaSelectionBounds(bounds);
      }
      loadCycleNetworkForBounds(bounds, zoom, isCycleNetworkVisible);

      if (discoverCategory !== 'parking' || isDrinkingWaterVisible) {
        const client = cyclingPoiDataClient.current;
        if (client) {
          void client
            .loadBounds(bounds)
            .then(() =>
              setCyclingPoiPoints(
                prepareDisplayPoints(client.getLoadedPoints(), locale),
              ),
            )
            .catch(() =>
              setCyclingPoiDataMessage(
                discoverCategory === 'parking'
                  ? t('drinkingWaterLoadError')
                  : t('cyclingPlacesLoadError'),
              ),
            );
        }
        if (discoverCategory !== 'parking') return;
      }
      const client = parkingDataClient.current;
      const manifest = client?.getManifest();
      if (!client || !manifest) {
        return;
      }

      void client
        .loadBounds(bounds)
        .then(() => {
          setParkingPoints((current) =>
            keepParkingPointsWhenUnchanged(
              current,
              prepareDisplayPoints(client.getLoadedPoints(), locale),
            ),
          );
        })
        .catch(() => {
          setParkingDataMessage(t('loadAreaError'));
        });
    },
    [
      discoverCategory,
      isDrinkingWaterVisible,
      isCycleNetworkVisible,
      loadCycleNetworkForBounds,
      locale,
      offlineAreaSelectionBounds,
      t,
    ],
  );

  const buildOfflineAreaPlan = useCallback(
    async (bounds: ParkingMapBounds) => {
      const parkingClient = parkingDataClient.current;
      const currentParkingManifest =
        parkingClient?.getManifest() ?? parkingManifest;
      if (!currentParkingManifest) {
        throw new Error('Parking data is not ready.');
      }

      const poiClient =
        cyclingPoiDataClient.current ??
        new CyclingPoiDataClient(
          getCyclingPoiDataBaseUrl(window.location.href),
        );
      cyclingPoiDataClient.current = poiClient;
      const currentPoiManifest = await poiClient.initialize();

      const networkClient = cycleNetworkDataClient.current;
      const currentNetworkManifest =
        networkClient?.getManifest() ?? cycleNetworkManifest;
      const plans: OfflineAreaPlan[] = [];

      const parkingKeys = getParkingTileKeysForDownloadBounds(
        bounds,
        currentParkingManifest,
      );
      if (parkingKeys.length > 0) {
        const baseUrl = getParkingDataBaseUrl(window.location.href);
        plans.push(
          planOfflineArea(
            new URL('manifest.json', baseUrl),
            currentParkingManifest,
            parkingKeys,
            { datasetId: 'parking' },
          ),
        );
      }

      const poiKeys = getParkingTileKeysForDownloadBounds(
        bounds,
        currentPoiManifest,
      );
      if (poiKeys.length > 0) {
        const baseUrl = getCyclingPoiDataBaseUrl(window.location.href);
        plans.push(
          planOfflineArea(
            new URL('manifest.json', baseUrl),
            currentPoiManifest,
            poiKeys,
            { datasetId: 'cycling-pois' },
          ),
        );
      }

      if (currentNetworkManifest) {
        const networkKeys = getParkingTileKeysForDownloadBounds(
          bounds,
          currentNetworkManifest,
        );
        if (networkKeys.length > 0) {
          const baseUrl = getCycleNetworkDataBaseUrl(window.location.href);
          plans.push(
            planOfflineArea(
              new URL('manifest.json', baseUrl),
              currentNetworkManifest,
              networkKeys,
              { datasetId: 'cycle-network' },
            ),
          );
        }
      }

      if (plans.length === 0) {
        throw new Error(t('noOfflineDataHere'));
      }
      const metadataRequest =
        offlineMapMetadata.current ?? fetchOfflineMapMetadata();
      offlineMapMetadata.current = metadataRequest;
      let mapMetadata: OfflineMapMetadata;
      try {
        mapMetadata = await metadataRequest;
      } catch (error) {
        offlineMapMetadata.current = null;
        throw error;
      }
      const plan = mergeOfflineAreaPlans([
        ...plans,
        planOfflineMapTiles(bounds, mapMetadata),
        getLoadedAppShellPlan(),
      ]);
      if (
        plan.resources.length > maximumOfflineAreaResources ||
        plan.estimatedBytes > maximumOfflineAreaBytes
      ) {
        throw new Error(t('offlineAreaTooLarge'));
      }
      return plan;
    },
    [cycleNetworkManifest, parkingManifest, t],
  );

  useEffect(() => {
    if (!offlineAreaSelectionBounds) {
      setOfflineAreaPlan(null);
      return;
    }

    const requestId = offlineAreaPlanRequestId.current + 1;
    offlineAreaPlanRequestId.current = requestId;
    setOfflineAreaPlan(null);
    setOfflineAreaError(null);
    void buildOfflineAreaPlan(offlineAreaSelectionBounds)
      .then((plan) => {
        if (offlineAreaPlanRequestId.current === requestId) {
          setOfflineAreaPlan(plan);
        }
      })
      .catch((error: unknown) => {
        if (offlineAreaPlanRequestId.current === requestId) {
          setOfflineAreaError(
            error instanceof Error ? error.message : t('offlineDownloadFailed'),
          );
        }
      });
  }, [buildOfflineAreaPlan, offlineAreaSelectionBounds, t]);

  async function retryParkingData() {
    const client = parkingDataClient.current;
    const manifest = client?.getManifest();
    if (!client || !manifest) {
      return;
    }

    setParkingDataStatus('loading');
    setParkingDataMessage(t('loadingNearby'));
    try {
      await client.loadLocation(locationState.location);
      setParkingPoints((current) =>
        keepParkingPointsWhenUnchanged(
          current,
          prepareDisplayPoints(client.getLoadedPoints(), locale),
        ),
      );
      setParkingDataStatus('ready');
      setParkingDataMessage(null);
    } catch {
      setParkingDataStatus('error');
      setParkingDataMessage(t('nearbyLoadError'));
    }
  }

  function openOfflineAreas() {
    setIsSettingsMenuOpen(false);
    setOfflineAreaMessage(null);
    setOfflineAreaError(null);
    if (!isCacheApiSupported() || !isIndexedDbSupported()) {
      setOfflineAreaError(t('offlineDownloadUnsupported'));
    }
    setIsOfflineAreasOpen(true);
    void refreshOfflineAreas();
  }

  function startOfflineAreaSelection() {
    if (offlineAreas.length >= maximumOfflineAreas) {
      setOfflineAreaError(t('offlineAreaLimitReached'));
      return;
    }
    const viewport = cycleNetworkViewport.current;
    if (!viewport) {
      setOfflineAreaError(t('offlineDownloadFailed'));
      return;
    }
    setIsOfflineAreasOpen(false);
    setOfflineAreaError(null);
    setOfflineAreaMessage(null);
    setOfflineAreaStorageWarning(null);
    setOfflineAreaProgress(null);
    setOfflineAreaName(
      locationState.status === 'searched'
        ? locationState.label
        : t('currentMapArea'),
    );
    setOfflineAreaSelectionBounds(viewport.bounds);
  }

  function cancelOfflineAreaSelection() {
    offlineAreaDownloadAbortController.current?.abort();
    offlineAreaDownloadAbortController.current = null;
    setOfflineAreaSelectionBounds(null);
    setOfflineAreaPlan(null);
    setOfflineAreaProgress(null);
    setBusyOfflineAreaId(null);
  }

  async function performOfflineAreaDownload({
    bounds,
    id,
    name,
    plan,
  }: {
    bounds: ParkingMapBounds;
    id: string;
    name: string;
    plan: OfflineAreaPlan;
  }) {
    if (offlineAreaDownloadAbortController.current) {
      setOfflineAreaError(t('offlineDownloadInProgress'));
      return;
    }
    const controller = new AbortController();
    offlineAreaDownloadAbortController.current = controller;
    setBusyOfflineAreaId(id);
    setOfflineAreaError(null);
    setOfflineAreaMessage(null);
    setOfflineAreaProgress(null);

    try {
      const savedAreas = await listOfflineAreas();
      const existingArea = savedAreas.find((area) => area.id === id);
      if (!existingArea && savedAreas.length >= maximumOfflineAreas) {
        throw new Error(t('offlineAreaLimitReached'));
      }
      const totalEstimatedBytes = savedAreas
        .filter((area) => area.id !== id)
        .reduce((total, area) => total + area.estimatedBytes, 0);
      if (
        totalEstimatedBytes + plan.estimatedBytes >
        maximumOfflineAreasBytes
      ) {
        throw new Error(t('offlineTotalLimitReached'));
      }
      const missingBytes = await estimateMissingOfflineAreaBytes(plan);
      const storage = await getOfflineStorageEstimate();
      if (
        storage.quota !== undefined &&
        storage.usage !== undefined &&
        storage.usage + missingBytes >
          storage.quota * (1 - offlineStorageHeadroomRatio)
      ) {
        throw new Error(t('notEnoughOfflineStorage'));
      }
      const persistent = await requestOfflineStoragePersistence().catch(
        () => false,
      );
      setOfflineAreaStorageWarning(
        persistent ? null : t('storageMayBeCleared'),
      );
      await downloadOfflineArea(id, name.trim(), plan, {
        concurrency: 2,
        metadata: {
          bounds,
          center: getOfflineAreaCenter(bounds),
          datasets: plan.datasets,
        },
        onProgress: setOfflineAreaProgress,
        minimumRequestIntervalMs: offlineDownloadRequestIntervalMs,
        signal: controller.signal,
      });
      await refreshOfflineAreas();
      setOfflineAreaSelectionBounds(null);
      setOfflineAreaPlan(null);
      setOfflineAreaMessage(t('offlineDownloadReady'));
      setIsOfflineAreasOpen(true);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setOfflineAreaError(
          error instanceof Error ? error.message : t('offlineDownloadFailed'),
        );
      }
      await refreshOfflineAreas();
    } finally {
      if (offlineAreaDownloadAbortController.current === controller) {
        offlineAreaDownloadAbortController.current = null;
      }
      setBusyOfflineAreaId(null);
    }
  }

  function downloadSelectedOfflineArea() {
    if (!offlineAreaSelectionBounds || !offlineAreaPlan) return;
    void performOfflineAreaDownload({
      bounds: offlineAreaSelectionBounds,
      id: createLocalId(),
      name: offlineAreaName,
      plan: offlineAreaPlan,
    });
  }

  function updateSavedOfflineArea(area: OfflineAreaRecord) {
    if (!area.bounds) return;
    setOfflineAreaError(null);
    void buildOfflineAreaPlan(area.bounds)
      .then((plan) =>
        performOfflineAreaDownload({
          bounds: area.bounds!,
          id: area.id,
          name: area.name,
          plan,
        }),
      )
      .catch((error: unknown) =>
        setOfflineAreaError(
          error instanceof Error ? error.message : t('offlineDownloadFailed'),
        ),
      );
  }

  function viewSavedOfflineArea(area: OfflineAreaRecord) {
    if (!area.center) return;
    setIsOfflineAreasOpen(false);
    locationRequestId.current += 1;
    saveLastArea(area.center, area.name);
    setLocationState({
      status: 'searched',
      location: area.center,
      label: area.name,
    });
    requestCurrentLocationFocus();
  }

  function removeSavedOfflineArea(area: OfflineAreaRecord) {
    if (!window.confirm(t('removeOfflineAreaConfirm', { name: area.name }))) {
      return;
    }
    setOfflineAreaError(null);
    void removeOfflineArea(area.id)
      .then(() => refreshOfflineAreas())
      .catch(() => setOfflineAreaError(t('offlineDownloadFailed')));
  }

  useEffect(() => {
    try {
      const storedThemeMode = window.localStorage.getItem(themeStorageKey);
      if (isThemeMode(storedThemeMode)) {
        setThemeMode(storedThemeMode);
      }
    } catch {
      // Retain the default theme when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function updateResolvedTheme() {
      setResolvedTheme(resolveTheme(themeMode, mediaQuery.matches));
    }

    updateResolvedTheme();

    if (themeMode !== 'system') {
      return;
    }

    mediaQuery.addEventListener('change', updateResolvedTheme);

    return () => mediaQuery.removeEventListener('change', updateResolvedTheme);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(themeStorageKey, themeMode);
    } catch {
      // Keep the theme choice for this visit.
    }
  }, [themeMode]);

  useEffect(() => {
    return () => {
      if (copiedMessageTimeout.current !== null) {
        window.clearTimeout(copiedMessageTimeout.current);
      }
      if (savedNeuksMessageTimeout.current !== null) {
        window.clearTimeout(savedNeuksMessageTimeout.current);
      }
      if (placeSearchDebounceTimeout.current !== null) {
        window.clearTimeout(placeSearchDebounceTimeout.current);
      }
      if (routePlannerCalculationTimeout.current !== null) {
        window.clearTimeout(routePlannerCalculationTimeout.current);
      }
      if (routeDestinationSearchDebounceTimeout.current !== null) {
        window.clearTimeout(routeDestinationSearchDebounceTimeout.current);
      }
      placeSearchAbortController.current?.abort();
      routeDestinationSearchAbortController.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isSettingsMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element) || !target.closest('.settings-menu')) {
        setIsSettingsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsSettingsMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsMenuOpen]);

  useEffect(() => {
    if (!isMapLayersOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        !target.closest('.map-layers-control')
      ) {
        setIsMapLayersOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMapLayersOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapLayersOpen]);

  useEffect(() => {
    if (!openParkingMoreMenuId) {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      parkingMoreMenuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
        ?.focus();
    });

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        !(target instanceof Element) ||
        (!target.closest('.parking-more-menu-shell') &&
          !target.closest('.parking-more-menu'))
      ) {
        setOpenParkingMoreMenuId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      setOpenParkingMoreMenuId(null);
      window.requestAnimationFrame(() => parkingMoreButtonRef.current?.focus());
    }

    function closeForViewportChange() {
      setOpenParkingMoreMenuId(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeForViewportChange);
    parkingListScroll.current?.addEventListener(
      'scroll',
      closeForViewportChange,
      { passive: true },
    );

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeForViewportChange);
      parkingListScroll.current?.removeEventListener(
        'scroll',
        closeForViewportChange,
      );
    };
  }, [openParkingMoreMenuId]);

  useEffect(() => {
    setOpenParkingMoreMenuId(null);
  }, [parkingView, selectedId]);

  useEffect(() => {
    if (!openParkingMoreMenuId) {
      setParkingMoreMenuPosition(null);
    }
  }, [openParkingMoreMenuId]);

  useEffect(() => {
    const dialog = attributionDialog.current;
    if (!dialog) {
      return;
    }

    if (isAttributionModalOpen && !dialog.open) {
      dialog.showModal();
    }
  }, [isAttributionModalOpen]);

  useEffect(() => {
    const dialog = streetViewDialog.current;
    if (!dialog) {
      return;
    }

    if (streetViewPoint && !dialog.open) {
      dialog.showModal();
    }
  }, [streetViewPoint]);

  function closeAttributionDialog() {
    const dialog = attributionDialog.current;

    setIsAttributionModalOpen(false);

    if (dialog?.open) {
      dialog.close();
    }
  }

  function closeStreetViewDialogAfterExit() {
    const dialog = streetViewDialog.current;

    if (!streetViewPoint && dialog?.open) {
      dialog.close();
    }
  }

  const nearbyPointsByDistance = useMemo(() => {
    const points =
      discoverCategory === 'parking'
        ? parkingPoints
        : cyclingPoiPoints.filter(({ categories }) =>
            categories.includes(discoverCategory),
          );
    return sortByDistance(points, locationState.location);
  }, [
    cyclingPoiPoints,
    discoverCategory,
    locationState.location,
    parkingPoints,
  ]);
  const nearbyPoints = useMemo(
    () =>
      discoverCategory === 'parking'
        ? filterAndSortParkingPoints(
            nearbyPointsByDistance,
            parkingFilters,
            parkingSortMode,
          )
        : nearbyPointsByDistance,
    [discoverCategory, nearbyPointsByDistance, parkingFilters, parkingSortMode],
  );
  const activeParkingFilterCount = countActiveParkingFilters(parkingFilters);
  const parkingFiltersActive = hasActiveParkingFilters(parkingFilters);

  const closestPoints = useMemo(
    () => nearbyPoints.slice(0, closestParkingResultCount),
    [nearbyPoints],
  );
  const savedIds = useMemo(
    () => new Set(savedNeuks.map(({ id }) => id)),
    [savedNeuks],
  );
  const savedKeys = useMemo(
    () => new Set(savedNeuks.map(({ key }) => key)),
    [savedNeuks],
  );
  const savedPoints = useMemo(
    () =>
      sortByDistance(
        savedRawPoints.map((point) => ({
          ...prepareDisplayPoints([point], locale)[0],
          savedNeukKey: point.savedNeukKey,
        })),
        locationState.location,
      ).sort((left, right) => {
        const distanceDifference =
          (left.distanceMeters ?? 0) - (right.distanceMeters ?? 0);
        if (distanceDifference !== 0) {
          return distanceDifference;
        }
        const leftSavedAt = savedNeuks.find(
          ({ key }) => key === left.savedNeukKey,
        )?.savedAt;
        const rightSavedAt = savedNeuks.find(
          ({ key }) => key === right.savedNeukKey,
        )?.savedAt;
        const savedAtDifference =
          Date.parse(rightSavedAt ?? '') - Date.parse(leftSavedAt ?? '');
        return savedAtDifference || left.name.localeCompare(right.name, locale);
      }),
    [locale, locationState.location, savedNeuks, savedRawPoints],
  );
  const missingSavedRecords = useMemo(
    () =>
      savedNeuks
        .filter(({ key }) => missingSavedIds.includes(key))
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    [missingSavedIds, savedNeuks],
  );
  const availablePoints = useMemo(() => {
    const points = new Map<string, ParkingPoint>();
    for (const point of parkingView === 'saved' ? savedPoints : nearbyPoints) {
      points.set(point.id, point);
    }
    return [...points.values()];
  }, [nearbyPoints, parkingView, savedPoints]);
  const drinkingWaterPoints = useMemo(
    () =>
      isDrinkingWaterVisible
        ? sortByDistance(
            cyclingPoiPoints.filter(({ categories }) =>
              categories.includes('water'),
            ),
            locationState.location,
          ).map((point) => ({
            ...point,
            categories: [
              'water' as const,
              ...point.categories.filter((category) => category !== 'water'),
            ],
          }))
        : [],
    [cyclingPoiPoints, isDrinkingWaterVisible, locationState.location],
  );
  const mapPoints = useMemo(() => {
    const points = new Map<string, ParkingPoint>();
    for (const point of drinkingWaterPoints) points.set(point.id, point);
    for (const point of availablePoints) points.set(point.id, point);
    return [...points.values()];
  }, [availablePoints, drinkingWaterPoints]);
  const formattedParkingLocationCount = useMemo(
    () => (parkingManifest?.recordCount ?? 0).toLocaleString(formattingLocale),
    [formattingLocale, parkingManifest?.recordCount],
  );

  const nearestPoint = nearbyPoints[0] ?? null;
  const activeListPoints =
    parkingView === 'saved' ? savedPoints : closestPoints;
  const uncertainParkingResultIndex =
    parkingView === 'nearby' &&
    discoverCategory === 'parking' &&
    parkingFiltersActive
      ? firstUncertainParkingResultIndex(activeListPoints, parkingFilters)
      : -1;
  const selectedPointFromMap =
    selectedId !== null
      ? (mapPoints.find((point) => point.id === selectedId) ?? null)
      : null;
  if (selectedId === null) {
    selectedPointCache.current = null;
  } else if (selectedPointFromMap !== null) {
    selectedPointCache.current = selectedPointFromMap;
  } else if (selectedPointCache.current?.id !== selectedId) {
    selectedPointCache.current = null;
  }
  // Chunk updates replace mapPoints in batches. Keep the current selection
  // mounted through a batch that does not yet contain its still-selected ID.
  const explicitSelectedPoint =
    selectedPointFromMap ?? selectedPointCache.current;
  const explicitSelectedPointDetails = explicitSelectedPoint
    ? getParkingPopupDetails(explicitSelectedPoint, locale)
    : null;
  const parkingDetailMessage =
    shareError ??
    (savedNeuksStatus === 'storage-error' ? savedNeuksMessage : null);
  const parkingDetailAnnouncement = parkingDetailMessage
    ? null
    : savedNeuksMessage;
  const directionsParkingPoint =
    directionsState.status !== 'idle'
      ? (mapPoints.find((point) => point.id === directionsState.parkingId) ??
        null)
      : null;
  const activeRoute =
    routeWorkspaceView === 'planner' && routeDraft
      ? (routePlannerRoutes[routeDraft.plan] ?? null)
      : directionsState.status === 'loaded'
        ? (directionsState.routes[directionsState.selectedPlan] ?? null)
        : null;
  useLayoutEffect(() => {
    latestTrackingRoute.current = activeRoute;
    confirmedRouteProgress.current = 0;
  }, [activeRoute]);
  const isRouteWorkspace = routeWorkspaceView !== null;
  const isDestinationParkingMode =
    routeWorkspaceView === 'destination-parking' &&
    destinationParkingState !== null;
  const isRouteDestinationSearchMode =
    routeWorkspaceView === 'planner' &&
    routeDraft !== null &&
    routeDestinationSearch.isOpen;
  const isRouteWaypointPlacementActive =
    routeWaypointPlacementSnapshot !== null;
  const routePlacementStartWaypointCount =
    routeWaypointPlacementSnapshot?.draft.waypoints.length ?? 0;
  const routePlacementHasChanges = Boolean(
    routeDraft &&
    routeWaypointPlacementSnapshot &&
    routeDraft.waypoints.length !== routePlacementStartWaypointCount,
  );
  const routeDraftPreview = useMemo(
    () =>
      routeWorkspaceView === 'planner' && routeDraft
        ? buildRouteDraftPreview(routeDraft)
        : null,
    [routeDraft, routeWorkspaceView],
  );
  const selectedSavedCycleRoute = useMemo(
    () =>
      selectedSavedRoute ? savedRouteToCycleRoute(selectedSavedRoute) : null,
    [selectedSavedRoute],
  );
  const pendingGpxCycleRoute = useMemo<CycleRoute | null>(
    () =>
      pendingGpxImport
        ? {
            plan: 'balanced',
            distanceMeters: pendingGpxImport.distanceMeters,
            durationSeconds: pendingGpxImport.durationSeconds ?? 0,
            points: pendingGpxImport.points,
            segments: pendingGpxImport.segments,
            instructions: [],
            source: 'local',
          }
        : null,
    [pendingGpxImport],
  );
  const libraryPreviewRoute = useMemo(
    () => (savedRoutes[0] ? savedRouteToCycleRoute(savedRoutes[0]) : null),
    [savedRoutes],
  );
  const selectedDestinationParkingCandidate =
    destinationParkingState?.candidates.find(
      ({ point }) => point.id === destinationParkingState.selectedId,
    ) ??
    destinationParkingState?.candidates[0] ??
    null;
  const routeWorkspaceRoute =
    routeWorkspaceView === 'planner' && routeDraft
      ? (routePlannerRoutes[routeDraft.plan] ?? routeDraftPreview ?? null)
      : routeWorkspaceView === 'destination-parking'
        ? (selectedDestinationParkingCandidate?.route ??
          (routeDraft
            ? (routePlannerRoutes[routeDraft.plan] ??
              buildRouteDraftPreview(routeDraft))
            : null))
        : routeWorkspaceView === 'detail'
          ? selectedSavedCycleRoute
          : routeWorkspaceView === 'import'
            ? pendingGpxCycleRoute
            : routeWorkspaceView === 'library'
              ? libraryPreviewRoute
              : null;
  const routeWorkspaceWaypoints =
    routeWorkspaceView === 'planner' ||
    routeWorkspaceView === 'destination-parking'
      ? (routeDraft?.waypoints ?? [])
      : routeWorkspaceView === 'detail'
        ? (selectedSavedRoute?.waypoints ?? [])
        : routeWorkspaceView === 'import'
          ? (pendingGpxImport?.waypoints ?? [])
          : routeWorkspaceView === 'library'
            ? (savedRoutes[0]?.waypoints ?? [])
            : [];
  const activeRouteWaypointId =
    routeWorkspaceView === 'planner' &&
    routeDraft &&
    isRouteWaypointPlacementActive &&
    routePlacementHasChanges
      ? (routeDraft.waypoints.at(-1)?.id ?? null)
      : null;
  const displayedRoute = routeWorkspaceRoute ?? activeRoute;
  const mapUserLocation = locationState.location;
  const showRouteCurrentLocation = useMemo(
    () =>
      locationState.status === 'located' &&
      routeWorkspaceView === 'detail' &&
      routeWorkspaceRoute !== null &&
      isLocationNearRoute(mapUserLocation, routeWorkspaceRoute),
    [
      locationState.status,
      mapUserLocation,
      routeWorkspaceRoute,
      routeWorkspaceView,
    ],
  );
  const isRoutePlanSelectionLocked =
    liveRouteTracking.status === 'starting' ||
    liveRouteTracking.status === 'tracking';
  const activeRouteInstruction =
    activeRoute && activeInstruction
      ? (activeRoute.instructions.find(
          (instruction) => instruction.id === activeInstruction.id,
        ) ?? null)
      : null;
  const isDirectionsMode =
    parkingPanelState.view === 'directions' &&
    directionsState.status !== 'idle' &&
    directionsParkingPoint !== null;
  const mobileHeaderRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const header = mobileHeaderRef.current;
    const toolbar = header?.parentElement;
    const shell = header?.closest<HTMLElement>('.app-shell');
    if (!toolbar || !shell) return;
    const observer = new ResizeObserver(() => {
      shell.style.setProperty(
        '--finder-header-height',
        `${toolbar.getBoundingClientRect().height}px`,
      );
    });
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [isDirectionsMode, isRouteWorkspace]);

  const isParkingDetailsMode =
    parkingPanelState.view === 'details' &&
    explicitSelectedPoint !== null &&
    !isDirectionsMode &&
    !isRouteWorkspace;
  const isParkingFiltersMode =
    parkingPanelState.view === 'filters' &&
    parkingView === 'nearby' &&
    discoverCategory === 'parking' &&
    !isDirectionsMode &&
    !isRouteWorkspace;
  const isSavedListMode =
    parkingPanelState.view === 'list' &&
    parkingView === 'saved' &&
    !isDirectionsMode;
  const isContentSizedMobileSheet =
    isParkingDetailsMode || isSavedListMode || isRouteWaypointPlacementActive;
  const activeMobileSheetExpandedViewportRatio = isParkingDetailsMode
    ? mobileDetailsSheetExpandedViewportRatio
    : routeWorkspaceView === 'planner' &&
        !journeyEditing &&
        !isRouteDestinationSearchMode &&
        routePlannerStatus === 'loaded'
      ? 0.58
      : mobileSheetExpandedViewportRatio;
  const activeMobileSheetExpandedHeight =
    isContentSizedMobileSheet && mobileContentSheetExpandedHeightPx !== null
      ? `${mobileContentSheetExpandedHeightPx}px`
      : `${activeMobileSheetExpandedViewportRatio * 100}dvh`;
  const liveRouteProgress: LiveRouteProgress | null = useMemo(() => {
    if (liveRouteTracking.status !== 'tracking' || !activeRoute) {
      return null;
    }

    return getLiveRouteProgress({
      accuracyMeters: liveRouteTracking.accuracyMeters,
      headingDegrees: liveRouteTracking.headingDegrees,
      location: liveRouteTracking.location,
      route: activeRoute,
    });
  }, [activeRoute, liveRouteTracking]);
  // Unrelated ride UI updates must not restart the map's follow animation.
  const liveRouteMarker = useMemo(
    () =>
      liveRouteTracking.status === 'tracking' && liveRouteProgress
        ? {
            isOffRoute: liveRouteProgress.isOffRoute,
            headingDegrees: liveRouteProgress.headingDegrees,
            position: liveRouteProgress.markerPosition,
            updatedAt: liveRouteTracking.updatedAt,
          }
        : null,
    [liveRouteProgress, liveRouteTracking],
  );
  const panelDirection = parkingPanelState.direction;
  const parkingViewDirection = parkingView === 'saved' ? 1 : -1;
  const panelMotionContext: PanelMotionContext = {
    direction: panelDirection,
    kind: parkingPanelState.transition,
  };

  useEffect(() => {
    if (
      selectedId === null ||
      !window.matchMedia('(max-width: 820px)').matches
    ) {
      return;
    }

    const selectedListItem = parkingListItemRefs.current.get(selectedId);
    const scrollContainer = parkingListScroll.current;

    if (!scrollContainer) {
      return;
    }

    if (restoringParkingViewScroll.current === parkingView) {
      scrollContainer.scrollTop =
        parkingViewState.current[parkingView].scrollTop;
      return;
    }

    if (!selectedListItem) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const containerBounds = scrollContainer.getBoundingClientRect();
    const itemBounds = selectedListItem.getBoundingClientRect();
    const scrollDelta =
      itemBounds.top < containerBounds.top
        ? itemBounds.top - containerBounds.top
        : itemBounds.bottom > containerBounds.bottom
          ? itemBounds.bottom - containerBounds.bottom
          : 0;

    if (scrollDelta === 0) {
      return;
    }

    scrollContainer.scrollTo({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      top: scrollContainer.scrollTop + scrollDelta,
    });
  }, [activeListPoints, parkingView, selectedId]);

  useEffect(() => {
    parkingViewState.current[parkingView].selectedId = selectedId;
  }, [parkingView, selectedId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (parkingListScroll.current) {
        parkingListScroll.current.scrollTop =
          parkingViewState.current[parkingView].scrollTop;
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [parkingView]);

  useEffect(() => {
    if (isDirectionsMode) {
      setMobileSheetState('expanded');
      animateMobileSheetTo('expanded');
    }
  }, [isDirectionsMode]);

  useEffect(() => {
    if (
      parkingPanelState.view === 'details' &&
      explicitSelectedPoint === null
    ) {
      dispatchParkingPanel({ type: 'CLEAR_SELECTION' });
    }
  }, [explicitSelectedPoint, parkingPanelState.view]);

  useEffect(() => {
    if (!isParkingDetailsMode && !isParkingFiltersMode) {
      return;
    }

    setMobileSheetState('expanded');
    animateMobileSheetTo('expanded');
  }, [isParkingDetailsMode, isParkingFiltersMode]);

  useEffect(() => {
    if (parkingPanelState.view !== 'details') {
      return;
    }

    const mobileViewport = window.matchMedia('(max-width: 820px)');
    function restoreDesktopList(event?: MediaQueryListEvent) {
      if (!(event?.matches ?? mobileViewport.matches)) {
        dispatchParkingPanel({ type: 'RESTORE_DESKTOP_LIST' });
      }
    }

    restoreDesktopList();
    mobileViewport.addEventListener('change', restoreDesktopList);
    return () =>
      mobileViewport.removeEventListener('change', restoreDesktopList);
  }, [parkingPanelState.view]);

  useLayoutEffect(() => {
    const categoryChips = categoryChipsRef.current;
    if (!categoryChips) {
      return;
    }
    const measuredCategoryChips = categoryChips;

    let measurementFrame: number | null = null;

    function measureCategoryOverflow() {
      measuredCategoryChips.dataset.overflow = 'false';
      measuredCategoryChips.dataset.overflow =
        measuredCategoryChips.scrollWidth >
        measuredCategoryChips.clientWidth + 1
          ? 'true'
          : 'false';
    }

    function scheduleCategoryOverflowMeasurement() {
      if (measurementFrame !== null) {
        window.cancelAnimationFrame(measurementFrame);
      }
      measurementFrame = window.requestAnimationFrame(() => {
        measurementFrame = null;
        measureCategoryOverflow();
      });
    }

    function keepSelectedCategoryVisible() {
      const selectedCategory = measuredCategoryChips.querySelector<HTMLElement>(
        '[data-active="true"]',
      );
      if (!selectedCategory) {
        return;
      }

      const containerBounds = measuredCategoryChips.getBoundingClientRect();
      const selectedBounds = selectedCategory.getBoundingClientRect();
      if (selectedBounds.left < containerBounds.left) {
        measuredCategoryChips.scrollLeft +=
          selectedBounds.left - containerBounds.left;
      } else if (selectedBounds.right > containerBounds.right) {
        measuredCategoryChips.scrollLeft +=
          selectedBounds.right - containerBounds.right;
      }
    }

    measureCategoryOverflow();
    keepSelectedCategoryVisible();
    const resizeObserver = new ResizeObserver(
      scheduleCategoryOverflowMeasurement,
    );
    resizeObserver.observe(measuredCategoryChips);

    return () => {
      resizeObserver.disconnect();
      if (measurementFrame !== null) {
        window.cancelAnimationFrame(measurementFrame);
      }
    };
  }, [discoverCategory, locale, parkingView]);

  useLayoutEffect(() => {
    if (!isContentSizedMobileSheet) {
      setMobileContentSheetExpandedHeightPx(null);
      setIsMobileContentSheetOverflowing(false);
      return;
    }

    const controlPane = controlPaneRef.current;
    const contentBody = isRouteWorkspace
      ? controlPane?.querySelector<HTMLElement>('.route-workspace-view')
      : isParkingFiltersMode
        ? controlPane?.querySelector<HTMLElement>('.parking-filter-panel-body')
        : isParkingDetailsMode
          ? Array.from(
              controlPane?.querySelectorAll<HTMLElement>(
                '.parking-detail-body[data-parking-detail-id]',
              ) ?? [],
            ).find(
              (body) =>
                body.dataset.parkingDetailId === explicitSelectedPoint?.id,
            )
          : controlPane?.querySelector<HTMLElement>(
              `.parking-view-content[data-parking-view="${parkingView}"]`,
            );
    if (!controlPane || !contentBody) {
      return;
    }
    const measuredControlPane = controlPane;
    const measuredContentBody = contentBody;

    function getLayoutOffsetTop(element: HTMLElement, ancestor: HTMLElement) {
      let offsetTop = 0;
      let current: HTMLElement | null = element;

      while (current && current !== ancestor) {
        offsetTop += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }

      return current === ancestor ? offsetTop : null;
    }

    function measureContentHeight() {
      const lastContent = Array.from(measuredContentBody.children)
        .reverse()
        .find(
          (child): child is HTMLElement =>
            child instanceof HTMLElement &&
            window.getComputedStyle(child).display !== 'none' &&
            child.offsetHeight > 0,
        );
      if (!lastContent) {
        return;
      }

      const contentBottom = getLayoutOffsetTop(
        lastContent,
        measuredControlPane,
      );
      if (contentBottom === null) {
        return;
      }

      const controlPaneStyles = window.getComputedStyle(measuredControlPane);
      const paddingBottom = Number.parseFloat(controlPaneStyles.paddingBottom);
      const borderTopWidth = Number.parseFloat(
        controlPaneStyles.borderTopWidth,
      );
      const borderBottomWidth = Number.parseFloat(
        controlPaneStyles.borderBottomWidth,
      );
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      );
      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight;
      const collapsedHeight =
        (Number.isFinite(rootFontSize) ? rootFontSize : 16) *
        mobileSheetCollapsedHeightRem;
      const contentHeight =
        Math.ceil(
          contentBottom +
            lastContent.offsetHeight +
            (Number.isFinite(paddingBottom) ? paddingBottom : 0) +
            (Number.isFinite(borderTopWidth) ? borderTopWidth : 0) +
            (Number.isFinite(borderBottomWidth) ? borderBottomWidth : 0),
        ) + 1;
      const maximumExpandedHeight =
        viewportHeight * activeMobileSheetExpandedViewportRatio;
      const nextHeight = Math.round(
        Math.min(
          maximumExpandedHeight,
          Math.max(collapsedHeight + 1, contentHeight),
        ),
      );

      setMobileContentSheetExpandedHeightPx((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
      setIsMobileContentSheetOverflowing((currentValue) => {
        const nextValue = contentHeight > maximumExpandedHeight;
        return currentValue === nextValue ? currentValue : nextValue;
      });
    }

    let measurementFrame = 0;
    function scheduleContentHeightMeasurement() {
      window.cancelAnimationFrame(measurementFrame);
      measurementFrame = window.requestAnimationFrame(measureContentHeight);
    }

    measureContentHeight();
    if (isRouteWaypointPlacementActive) {
      return;
    }
    const resizeObserver = new ResizeObserver(scheduleContentHeightMeasurement);
    resizeObserver.observe(measuredContentBody);
    for (const child of measuredContentBody.children) {
      resizeObserver.observe(child);
    }
    const mutationObserver = new MutationObserver(() => {
      for (const child of measuredContentBody.children) {
        resizeObserver.observe(child);
      }
      scheduleContentHeightMeasurement();
    });
    mutationObserver.observe(measuredContentBody, {
      childList: true,
      subtree: true,
    });
    window.visualViewport?.addEventListener(
      'resize',
      scheduleContentHeightMeasurement,
    );

    return () => {
      window.cancelAnimationFrame(measurementFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.visualViewport?.removeEventListener(
        'resize',
        scheduleContentHeightMeasurement,
      );
    };
  }, [
    activeMobileSheetExpandedViewportRatio,
    explicitSelectedPoint?.id,
    failedSavedIds.length,
    isContentSizedMobileSheet,
    isParkingDetailsMode,
    isRouteWorkspace,
    isRouteWaypointPlacementActive,
    isSavedPointsLoading,
    locale,
    routeDraft?.waypoints.length,
    routeWorkspaceView,
    savedNeuks.length,
    savedNeuksMessage,
    savedPoints.length,
    savedRoutes.length,
    shareError,
  ]);

  useEffect(() => {
    if (!isParkingDetailsMode) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      closeParkingDetails();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isParkingDetailsMode, selectedId]);

  useEffect(() => {
    if (liveRouteTracking.status === 'idle') {
      return;
    }

    if (!activeRoute) {
      stopLiveRouteTracking();
    }
  }, [activeRoute, liveRouteTracking.status]);

  useEffect(() => {
    return () => {
      rerouteRequestId.current += 1;
      if (liveRouteWatchId.current !== null) {
        clearWatch(liveRouteWatchId.current);
        liveRouteWatchId.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const activeInstructionId = liveRouteProgress?.activeInstructionId;

    if (!activeInstructionId) {
      return;
    }

    setRouteInstructionFocusRequest(null);
    setActiveInstruction((current) =>
      current?.id === activeInstructionId
        ? current
        : {
            id: activeInstructionId,
            requestId: (current?.requestId ?? 0) + 1,
          },
    );
  }, [liveRouteProgress?.activeInstructionId]);

  function toggleMobileSheet() {
    const nextState =
      mobileSheetState === 'expanded' ? 'collapsed' : 'expanded';
    setMobileSheetState(nextState);
    animateMobileSheetTo(nextState);
  }

  function animateMobileSheetTo(nextState: MobileSheetState) {
    const targetProgress = nextState === 'expanded' ? 1 : 0;

    mobileSheetProgressValue.stop();
    if (shouldReduceMotion) {
      mobileSheetProgressValue.set(targetProgress);
      return;
    }

    animate(mobileSheetProgressValue, targetProgress, {
      duration: 0.26,
      ease: [0.22, 1, 0.36, 1],
    });
  }

  function snapMobileSheetFromDrag(
    drag: NonNullable<typeof mobileSheetDrag.current>,
    releaseTimestamp: number,
  ) {
    const deltaY = drag.currentY - drag.startY;
    if (Math.abs(deltaY) < mobileSheetDragIntentThresholdPx) {
      setIsMobileSheetDragging(false);
      animateMobileSheetTo(drag.startProgress === 1 ? 'expanded' : 'collapsed');
      return;
    }

    const finalProgress = Math.max(
      0,
      Math.min(1, drag.startProgress - deltaY / drag.rangePx),
    );
    const releaseVelocityY =
      releaseTimestamp - drag.lastTimestamp <= 80 ? drag.velocityY : 0;
    const nextState =
      Math.abs(releaseVelocityY) >= mobileSheetFlickVelocityPxPerMs
        ? releaseVelocityY < 0
          ? 'expanded'
          : 'collapsed'
        : finalProgress >= 0.5
          ? 'expanded'
          : 'collapsed';

    ignoreNextSheetGripClick.current = true;
    setMobileSheetState(nextState);
    setIsMobileSheetDragging(false);
    animateMobileSheetTo(nextState);
  }

  function handleSheetGripPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const rootFontSize = Number.parseFloat(
      window.getComputedStyle(document.documentElement).fontSize,
    );
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const collapsedHeight =
      (Number.isFinite(rootFontSize) ? rootFontSize : 16) *
      mobileSheetCollapsedHeightRem;
    const expandedHeight =
      isContentSizedMobileSheet && mobileContentSheetExpandedHeightPx !== null
        ? mobileContentSheetExpandedHeightPx
        : viewportHeight * activeMobileSheetExpandedViewportRatio;
    const rangePx = Math.max(expandedHeight - collapsedHeight, 1);
    const startProgress = mobileSheetState === 'expanded' ? 1 : 0;

    mobileSheetDrag.current = {
      currentY: event.clientY,
      lastTimestamp: event.timeStamp,
      lastY: event.clientY,
      pointerId: event.pointerId,
      rangePx,
      startProgress,
      startY: event.clientY,
      velocityY: 0,
    };
    mobileSheetProgressValue.stop();
    mobileSheetProgressValue.set(startProgress);
    setIsMobileSheetDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSheetGripPointerMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const drag = mobileSheetDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    drag.currentY = event.clientY;
    const elapsedMs = event.timeStamp - drag.lastTimestamp;
    if (elapsedMs > 0) {
      drag.velocityY = (event.clientY - drag.lastY) / elapsedMs;
    }
    drag.lastTimestamp = event.timeStamp;
    drag.lastY = event.clientY;

    const dragProgress = Math.max(
      0,
      Math.min(
        1,
        drag.startProgress - (event.clientY - drag.startY) / drag.rangePx,
      ),
    );
    mobileSheetProgressValue.set(dragProgress);
  }

  function handleSheetGripPointerEnd(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const drag = mobileSheetDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    mobileSheetDrag.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    snapMobileSheetFromDrag(drag, event.timeStamp);
  }

  function handleSheetGripClick() {
    if (ignoreNextSheetGripClick.current) {
      ignoreNextSheetGripClick.current = false;
      return;
    }

    toggleMobileSheet();
  }

  function handleSheetGripPointerCancel(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    mobileSheetDrag.current = null;
    setIsMobileSheetDragging(false);
    animateMobileSheetTo(mobileSheetState);
  }

  const controlPaneStyle = {
    '--mobile-sheet-body-offset': mobileSheetBodyOffset,
    '--mobile-sheet-body-opacity': mobileSheetBodyOpacity,
    '--mobile-sheet-drag-progress': mobileSheetProgressValue,
    '--mobile-sheet-expanded-height': activeMobileSheetExpandedHeight,
    '--mobile-sheet-summary-offset': mobileSheetSummaryOffset,
    '--mobile-sheet-summary-opacity': mobileSheetSummaryOpacity,
  } as MotionStyle;

  function clearLiveRouteWatch() {
    rerouteRequestId.current += 1;
    setIsRerouting(false);
    if (liveRouteWatchId.current === null) {
      return;
    }

    clearWatch(liveRouteWatchId.current);
    liveRouteWatchId.current = null;
  }

  function stopLiveRouteTracking() {
    rerouteRequestId.current += 1;
    setIsRerouting(false);
    setRerouteError(null);
    clearLiveRouteWatch();
    previousLiveRouteMarkerPosition.current = null;
    setLiveRouteTracking({ status: 'idle' });
  }

  function startLiveRouteTracking() {
    if (!activeRoute) {
      return;
    }

    if (!canUseGeolocation()) {
      setLiveRouteTracking({ status: 'unavailable' });
      return;
    }

    clearLiveRouteWatch();
    previousLiveRouteMarkerPosition.current = null;
    confirmedRouteProgress.current = 0;
    setRerouteError(null);
    setLiveRouteTracking({ status: 'starting' });

    liveRouteWatchId.current = watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        if (!isResolvedLocation(location)) {
          clearLiveRouteWatch();
          previousLiveRouteMarkerPosition.current = null;
          setLiveRouteTracking({ status: 'unavailable' });
          return;
        }

        const manifest = parkingDataClient.current?.getManifest();
        if (manifest && !isLocationInParkingCoverage(location, manifest)) {
          clearLiveRouteWatch();
          previousLiveRouteMarkerPosition.current = null;
          setLiveRouteTracking({ status: 'too-far' });
          return;
        }

        const accuracyMeters = Number.isFinite(position.coords.accuracy)
          ? position.coords.accuracy
          : null;
        const browserHeadingDegrees = Number.isFinite(position.coords.heading)
          ? position.coords.heading
          : null;
        const trackingRoute = latestTrackingRoute.current;
        if (!trackingRoute) return;
        const progressForMarkerPosition = getLiveRouteProgress({
          accuracyMeters,
          headingDegrees: browserHeadingDegrees,
          location,
          route: trackingRoute,
        });
        if (
          progressForMarkerPosition &&
          !progressForMarkerPosition.isOffRoute
        ) {
          confirmedRouteProgress.current = Math.max(
            confirmedRouteProgress.current,
            progressForMarkerPosition.travelledMeters,
          );
        }
        const markerPosition =
          progressForMarkerPosition?.markerPosition ??
          ([location.latitude, location.longitude] satisfies CycleRoutePoint);
        const previousMarkerPosition = previousLiveRouteMarkerPosition.current;
        const inferredHeadingDegrees =
          browserHeadingDegrees === null &&
          previousMarkerPosition &&
          distanceMeters(
            {
              latitude: previousMarkerPosition[0],
              longitude: previousMarkerPosition[1],
            },
            { latitude: markerPosition[0], longitude: markerPosition[1] },
          ) >= LIVE_ROUTE_MIN_HEADING_DISTANCE_METERS
            ? getBearingDegrees(previousMarkerPosition, markerPosition)
            : null;

        previousLiveRouteMarkerPosition.current = markerPosition;
        setLiveRouteTracking({
          status: 'tracking',
          accuracyMeters,
          headingDegrees: browserHeadingDegrees ?? inferredHeadingDegrees,
          location,
          updatedAt: position.timestamp,
        });
      },
      (error) => {
        clearLiveRouteWatch();
        previousLiveRouteMarkerPosition.current = null;
        setLiveRouteTracking({
          status:
            error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 12_000,
      },
    );
  }

  async function recalculateLiveRoute() {
    if (
      isRerouting ||
      liveRouteTracking.status !== 'tracking' ||
      !activeRoute ||
      !liveRouteProgress?.isOffRoute
    )
      return;
    const apiKey = process.env.NEXT_PUBLIC_CYCLESTREETS_API_KEY;
    if (!navigator.onLine) {
      setRerouteError(t('rideRerouteOffline'));
      return;
    }
    if (!apiKey) {
      setRerouteError(t('directionsNeedKey'));
      return;
    }
    const planner = routeWorkspaceView === 'planner' && routeDraft !== null;
    const waypoints = planner
      ? routeDraft.waypoints
      : directionsParkingPoint
        ? [
            {
              id: 'start',
              label: t('currentLocation'),
              latitude: activeRoute.points[0]![0],
              longitude: activeRoute.points[0]![1],
              source: 'current-location' as const,
            },
            {
              id: directionsParkingPoint.id,
              label: directionsParkingPoint.name,
              latitude: directionsParkingPoint.latitude,
              longitude: directionsParkingPoint.longitude,
              source: 'parking' as const,
            },
          ]
        : [];
    const remaining = getRemainingRouteWaypoints(
      activeRoute,
      waypoints,
      confirmedRouteProgress.current,
    );
    if (!remaining.length) return;
    const nextWaypoints: CycleRouteWaypoint[] = [
      {
        id: createLocalId(),
        label: t('currentLocation'),
        ...liveRouteTracking.location,
        source: 'current-location',
      },
      ...remaining,
    ];
    const requestId = ++rerouteRequestId.current;
    setIsRerouting(true);
    setRerouteError(null);
    try {
      const finish = remaining.at(-1)!;
      const point: ParkingPoint = {
        id: finish.id,
        name: finish.label,
        latitude: finish.latitude,
        longitude: finish.longitude,
        properties: {},
        sourceId: 'route-planner',
      };
      const routes =
        nextWaypoints.length === 2 &&
        distanceMeters(nextWaypoints[0]!, finish) <=
          SHORT_CYCLE_ROUTE_THRESHOLD_METERS
          ? buildShortCycleRoutes(nextWaypoints[0]!, point)
          : parseCycleStreetsRoutes(
              await fetchCycleStreetsDirections(
                buildCycleStreetsRouteRequest({
                  apiKey,
                  waypoints: nextWaypoints,
                }),
              ),
              point,
            );
      if (rerouteRequestId.current !== requestId) return;
      // Preserve the rider's chosen preference, and the old route if it is unavailable.
      const plan = activeRoute.plan;
      if (!routes[plan]) throw new Error('Selected route style unavailable');
      if (planner) {
        setRouteDraft({ ...routeDraft, waypoints: nextWaypoints });
        setRoutePlannerRoutes(routes);
        setRoutePlannerStatus('loaded');
        setRoutePlannerMessage(null);
      } else if (directionsState.status === 'loaded') {
        setDirectionsState({ ...directionsState, routes, selectedPlan: plan });
      }
      setActiveInstruction(null);
      setRouteInstructionFocusRequest(null);
      previousLiveRouteMarkerPosition.current = null;
    } catch {
      if (rerouteRequestId.current === requestId)
        setRerouteError(t('rideRerouteFailed'));
    } finally {
      if (rerouteRequestId.current === requestId) setIsRerouting(false);
    }
  }

  function toggleLiveRouteTracking() {
    if (liveRouteTracking.status === 'tracking') {
      stopLiveRouteTracking();
      return;
    }

    startLiveRouteTracking();
  }

  function clearDirectionsData() {
    directionsRequestId.current += 1;
    stopLiveRouteTracking();
    setDirectionsState({ status: 'idle' });
    setActiveInstruction(null);
    setRouteInstructionFocusRequest(null);
  }

  function exitDirections() {
    clearDirectionsData();
    dispatchParkingPanel({ type: 'EXIT_DIRECTIONS' });
  }

  function selectCycleRoutePlan(plan: CycleRoutePlan) {
    if (
      directionsState.status !== 'loaded' ||
      !directionsState.routes[plan] ||
      liveRouteTracking.status === 'starting' ||
      liveRouteTracking.status === 'tracking' ||
      directionsState.selectedPlan === plan
    ) {
      return;
    }

    const route = directionsState.routes[plan];
    setActiveInstruction(null);
    setRouteInstructionFocusRequest(null);
    setDirectionsState({
      ...directionsState,
      selectedPlan: plan,
    });
    captureAnalyticsEvent('directions_plan_selected', {
      parking_id: directionsState.parkingId,
      parking_name: directionsParkingPoint?.name ?? '',
      route_distance_metres: route.distanceMeters,
      route_duration_seconds: route.durationSeconds,
      route_plan: plan,
    });
  }

  function selectRouteInstruction(id: string) {
    setActiveInstruction((current) => ({
      id,
      requestId: (current?.requestId ?? 0) + 1,
    }));
    setRouteInstructionFocusRequest((current) => ({
      id,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }

  function cancelLocationRequest() {
    locationRequestId.current += 1;
    setLocationState((current) =>
      current.status === 'locating'
        ? {
            status: 'searched',
            location: current.location,
            label: current.label ?? t('selectedPlace'),
            isCached: true,
          }
        : current,
    );
  }

  function requestCurrentLocationFocus() {
    setCurrentLocationFocusRequestId((requestId) => requestId + 1);
  }

  function applyFallbackLocation(
    status: Extract<
      LocationState['status'],
      'denied' | 'too-far' | 'unavailable'
    >,
    previousReference: Extract<
      LocationState,
      { status: 'searched' }
    > | null = null,
  ) {
    const client = parkingDataClient.current;
    const manifest = client?.getManifest();
    const lastArea = readLastArea();
    const retainedReference =
      previousReference && (status !== 'denied' || !previousReference.isCached)
        ? previousReference
        : lastArea &&
            manifest &&
            isLocationInParkingCoverage(lastArea.location, manifest)
          ? {
              status: 'searched' as const,
              location: lastArea.location,
              label: lastArea.label ?? t('lastViewedArea'),
            }
          : null;
    const location = retainedReference?.location ?? EDINBURGH_FALLBACK_LOCATION;
    setLocationState(retainedReference ?? { status, location });
    if (client && manifest) {
      void client
        .loadLocation(location)
        .then(() => {
          setParkingPoints((current) =>
            keepParkingPointsWhenUnchanged(
              current,
              prepareDisplayPoints(client.getLoadedPoints(), locale),
            ),
          );
        })
        .catch(() => {
          setParkingDataMessage(t('nearbyLoadError'));
        });
    }
    requestCurrentLocationFocus();
  }

  function applyReferenceLocation(
    location: UserLocation,
    status: Extract<LocationState['status'], 'located' | 'searched'>,
    label?: string,
    selectedParkingId?: string,
  ) {
    locationRequestId.current += 1;
    dispatchParkingPanel({
      selectedId: selectedParkingId ?? null,
      type: 'RESET_LIST',
    });
    clearDirectionsData();

    const manifest = parkingDataClient.current?.getManifest();
    if (manifest && !isLocationInParkingCoverage(location, manifest)) {
      applyFallbackLocation('too-far');
      return false;
    }

    if (status === 'searched') saveLastArea(location, label);
    setLocationState(
      status === 'searched'
        ? {
            status,
            location,
            label: label ?? t('selectedPlace'),
          }
        : {
            status,
            location,
          },
    );

    return true;
  }

  function requestLocation(
    selectedParkingId?: string,
    userInitiated = false,
    restoredReference: Extract<
      LocationState,
      { status: 'searched' }
    > | null = null,
  ) {
    const requestId = ++locationRequestId.current;
    if (userInitiated) rememberLocationRequest();
    setPlaceSearchMessage(null);
    const fallbackReference =
      restoredReference ??
      (locationState.status === 'searched'
        ? locationState
        : locationState.status === 'located'
          ? {
              status: 'searched' as const,
              location: locationState.location,
              label: t('lastKnownLocation'),
              isCached: true,
            }
          : null);
    const fail = (status: 'denied' | 'unavailable' | 'too-far') => {
      if (requestId !== locationRequestId.current) return;
      applyFallbackLocation(status, fallbackReference);
      if (userInitiated) {
        setPlaceSearchMessage(
          t(
            status === 'denied'
              ? 'locationPermissionNeeded'
              : status === 'too-far'
                ? 'locationOutsideCoverage'
                : 'locationNotAvailable',
          ),
        );
      }
    };
    if (parkingView === 'saved') showNearby();
    dispatchParkingPanel({
      selectedId: selectedParkingId ?? null,
      type: 'RESET_LIST',
    });
    clearDirectionsData();

    if (!canUseGeolocation()) {
      fail('unavailable');
      return;
    }
    setLocationState({
      status: 'locating',
      location: fallbackReference?.location ?? locationState.location,
      label: fallbackReference?.label ?? t('edinburghReference'),
    });

    getCurrentPosition(
      (position) => {
        if (requestId !== locationRequestId.current) return;
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        if (!isResolvedLocation(location)) {
          fail('unavailable');
          return;
        }
        const manifest = parkingDataClient.current?.getManifest();
        if (manifest && !isLocationInParkingCoverage(location, manifest)) {
          clearLastLocation();
          captureAnalyticsEvent('location_denied', { reason: 'too_far' });
          fail('too-far');
          return;
        }
        if (
          applyReferenceLocation(
            location,
            'located',
            undefined,
            selectedParkingId,
          )
        ) {
          saveLastLocation(location, position.timestamp);
          captureAnalyticsEvent('location_granted');
          requestCurrentLocationFocus();
        }
      },
      (error) => {
        if (requestId !== locationRequestId.current) return;
        const status =
          error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
        if (status === 'denied') {
          clearLastLocation();
          // Browsers also report PERMISSION_DENIED when a dialog is dismissed.
          // A still-promptable permission gets the 24-hour cooldown; an actual
          // denial (or an unqueryable decision) stops automatic requests.
          void getLocationPermission().then((permission) => {
            if (requestId !== locationRequestId.current) return;
            if (permission !== 'prompt') rememberLocationDenial();
            fail(status);
          });
        } else {
          fail(status);
        }
        captureAnalyticsEvent('location_denied', { reason: status });
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  function cancelPlaceSearchWork() {
    if (placeSearchDebounceTimeout.current !== null) {
      window.clearTimeout(placeSearchDebounceTimeout.current);
      placeSearchDebounceTimeout.current = null;
    }
    placeSearchAbortController.current?.abort();
    placeSearchAbortController.current = null;
    placeSearchRequestId.current += 1;
    setIsPlaceSearching(false);
  }

  async function runPlaceSearch(query: string) {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      return;
    }

    if (placeSearchDebounceTimeout.current !== null) {
      window.clearTimeout(placeSearchDebounceTimeout.current);
      placeSearchDebounceTimeout.current = null;
    }
    placeSearchAbortController.current?.abort();

    const cacheKey = `${locale}:${trimmedQuery.toLowerCase()}`;
    const cachedResults = placeSearchCache.current.get(cacheKey);
    const requestId = placeSearchRequestId.current + 1;
    placeSearchRequestId.current = requestId;

    if (cachedResults) {
      placeSearchAbortController.current = null;
      setIsPlaceSearching(false);
      setActivePlaceResultIndex(0);
      setPlaceResults(cachedResults);
      setPlaceSearchMessage(
        cachedResults.length === 0 ? t('noPlaceResults') : null,
      );
      return;
    }

    const controller = new AbortController();
    placeSearchAbortController.current = controller;
    setIsPlaceSearching(true);
    setPlaceSearchMessage(null);

    try {
      const response = await fetch(
        buildPlaceSearchUrl(trimmedQuery, locale, locationState.location),
        {
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error('Place search failed');
      }

      const manifest = parkingDataClient.current?.getManifest();
      const results = parsePlaceSearchResults(await response.json()).filter(
        (result) =>
          !manifest || isLocationInParkingCoverage(result.location, manifest),
      );
      placeSearchCache.current.set(cacheKey, results);
      if (placeSearchCache.current.size > maxPlaceSearchCacheEntries) {
        const oldestKey = placeSearchCache.current.keys().next().value;
        if (oldestKey) {
          placeSearchCache.current.delete(oldestKey);
        }
      }
      if (requestId !== placeSearchRequestId.current) {
        return;
      }
      captureAnalyticsEvent('place_searched', {
        result_count: results.length,
      });
      setActivePlaceResultIndex(0);
      setPlaceResults(results);
      setPlaceSearchMessage(results.length === 0 ? t('noPlaceResults') : null);
      setHasUsedPlaceSearch(true);
    } catch {
      if (
        controller.signal.aborted ||
        requestId !== placeSearchRequestId.current
      ) {
        return;
      }
      captureAnalyticsEvent('place_searched', { error: true });
      setActivePlaceResultIndex(0);
      setPlaceResults([]);
      setPlaceSearchMessage(t('placeSearchError'));
    } finally {
      if (requestId === placeSearchRequestId.current) {
        placeSearchAbortController.current = null;
        setIsPlaceSearching(false);
      }
    }
  }

  function searchForPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runPlaceSearch(placeQuery);
  }

  function updatePlaceQuery(query: string) {
    cancelPlaceSearchWork();
    setPlaceQuery(query);
    setActivePlaceResultIndex(0);
    setPlaceResults([]);
    setPlaceSearchMessage(null);

    if (query.trim().length < placeSearchMinimumCharacters) {
      return;
    }

    placeSearchDebounceTimeout.current = window.setTimeout(() => {
      placeSearchDebounceTimeout.current = null;
      void runPlaceSearch(query);
    }, placeSearchDebounceMs);
  }

  function clearPlaceSearch(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.parentElement
      ?.querySelector<HTMLInputElement>('input')
      ?.focus();
    cancelPlaceSearchWork();
    setPlaceQuery('');
    setActivePlaceResultIndex(0);
    setPlaceResults([]);
    setPlaceSearchMessage(null);
  }

  function selectPlace(result: PlaceSearchResult) {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement &&
      activeElement.name === 'place-search'
    ) {
      activeElement.blur();
    }

    cancelPlaceSearchWork();
    captureAnalyticsEvent('place_selected', { place_name: result.name });
    setActivePlaceResultIndex(0);
    setPlaceResults([]);
    setPlaceSearchMessage(null);
    setPlaceQuery(result.name.split(',')[0] ?? result.name);
    setHasUsedPlaceSearch(true);
    applyReferenceLocation(
      result.location,
      'searched',
      result.name.split(',')[0] ?? result.name,
    );
  }

  function cancelRouteDestinationSearchWork() {
    if (routeDestinationSearchDebounceTimeout.current !== null) {
      window.clearTimeout(routeDestinationSearchDebounceTimeout.current);
      routeDestinationSearchDebounceTimeout.current = null;
    }
    routeDestinationSearchAbortController.current?.abort();
    routeDestinationSearchAbortController.current = null;
    routeDestinationSearchRequestId.current += 1;
  }

  async function runRouteDestinationSearch(query: string) {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < placeSearchMinimumCharacters) {
      return;
    }

    cancelRouteDestinationSearchWork();
    const cacheKey = `${locale}:${trimmedQuery.toLowerCase()}`;
    const cachedResults = placeSearchCache.current.get(cacheKey);
    const requestId = routeDestinationSearchRequestId.current + 1;
    routeDestinationSearchRequestId.current = requestId;

    if (cachedResults) {
      setRouteDestinationSearch((current) => ({
        ...current,
        activeResultIndex: 0,
        message: cachedResults.length === 0 ? t('noPlaceResults') : null,
        results: cachedResults,
        searchStatus: 'idle',
      }));
      return;
    }

    const controller = new AbortController();
    routeDestinationSearchAbortController.current = controller;
    setRouteDestinationSearch((current) => ({
      ...current,
      activeResultIndex: 0,
      message: null,
      results: [],
      searchStatus: 'loading',
    }));

    try {
      const focus = routeDraft?.waypoints.at(-1) ?? locationState.location;
      const response = await fetch(
        buildPlaceSearchUrl(trimmedQuery, locale, focus),
        {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error('Destination search failed');
      }

      const manifest = parkingDataClient.current?.getManifest();
      const results = parsePlaceSearchResults(await response.json()).filter(
        (result) =>
          !manifest || isLocationInParkingCoverage(result.location, manifest),
      );
      placeSearchCache.current.set(cacheKey, results);
      if (placeSearchCache.current.size > maxPlaceSearchCacheEntries) {
        const oldestKey = placeSearchCache.current.keys().next().value;
        if (oldestKey) {
          placeSearchCache.current.delete(oldestKey);
        }
      }
      if (requestId !== routeDestinationSearchRequestId.current) {
        return;
      }
      setRouteDestinationSearch((current) => ({
        ...current,
        activeResultIndex: 0,
        message: results.length === 0 ? t('noPlaceResults') : null,
        results,
        searchStatus: 'idle',
      }));
      captureAnalyticsEvent('route_destination_searched', {
        result_count: results.length,
      });
    } catch {
      if (
        controller.signal.aborted ||
        requestId !== routeDestinationSearchRequestId.current
      ) {
        return;
      }
      setRouteDestinationSearch((current) => ({
        ...current,
        activeResultIndex: 0,
        message: t('placeSearchError'),
        results: [],
        searchStatus: 'error',
      }));
      captureAnalyticsEvent('route_destination_searched', { error: true });
    } finally {
      if (requestId === routeDestinationSearchRequestId.current) {
        routeDestinationSearchAbortController.current = null;
      }
    }
  }

  function updateRouteDestinationQuery(query: string) {
    cancelRouteDestinationSearchWork();
    setRouteDestinationSearch((current) => ({
      ...current,
      activeResultIndex: 0,
      message: null,
      query,
      results: [],
      searchStatus: 'idle',
      selectedId: null,
    }));
    if (query.trim().length < placeSearchMinimumCharacters) {
      return;
    }
    routeDestinationSearchDebounceTimeout.current = window.setTimeout(() => {
      routeDestinationSearchDebounceTimeout.current = null;
      void runRouteDestinationSearch(query);
    }, placeSearchDebounceMs);
  }

  function openRouteDestinationSearch(
    target: 'start' | 'destination' = 'destination',
  ) {
    setJourneySearchTarget(target);
    if (!routeDraft) {
      return;
    }
    cancelRouteDestinationSearchWork();
    setRouteDestinationSearch({
      ...initialRouteDestinationSearchState,
      isOpen: true,
    });
    setMobileSheetState('expanded');
  }

  function closeRouteDestinationSearch() {
    cancelRouteDestinationSearchWork();
    setRouteDestinationSearch(initialRouteDestinationSearchState);
    setMobileSheetState('expanded');
  }

  function selectRouteDestination(result: PlaceSearchResult, index: number) {
    if (!routeDraft) return;
    cancelRouteDestinationSearchWork();
    const waypoint: CycleRouteWaypoint = {
      id: createLocalId(),
      label: result.name.split(',')[0]?.trim() || result.name,
      ...result.location,
      source: 'search',
    };
    if (journeySearchTarget === 'start') {
      const waypoints = [waypoint, ...routeDraft.waypoints.slice(1)];
      if (pendingJourneyDestination) waypoints.push(pendingJourneyDestination);
      setPendingJourneyDestination(null);
      commitRouteDraft({ ...routeDraft, waypoints });
      setRouteDestinationSearch(initialRouteDestinationSearchState);
    } else if (routeDraft.waypoints.length === 0) {
      setPendingJourneyDestination(waypoint);
      setJourneySearchTarget('start');
      setRouteDestinationSearch({
        ...initialRouteDestinationSearchState,
        isOpen: true,
      });
    } else {
      commitRouteDraft(setRouteDestination(routeDraft, waypoint));
      setRouteDestinationSearch(initialRouteDestinationSearchState);
    }
    captureAnalyticsEvent('route_destination_selected', {
      result_rank: index + 1,
    });
  }

  function selectParkingPoint(id: string) {
    captureAnalyticsEvent('parking_selected', { parking_id: id });
    restoringParkingViewScroll.current = null;
    setOpenParkingMoreMenuId(null);
    parkingViewState.current[parkingView].selectedId = id;
    clearDirectionsData();
    dispatchParkingPanel({ selectedId: id, type: 'SELECT_LIST_POINT' });
  }

  function openParkingDetails(
    point: ParkingPoint,
    origin: 'list' | 'map' = 'map',
  ) {
    restoringParkingViewScroll.current = null;
    if (!window.matchMedia('(max-width: 820px)').matches) {
      selectParkingPoint(point.id);
      return;
    }

    setOpenParkingMoreMenuId(null);
    parkingViewState.current[parkingView].selectedId = point.id;
    clearDirectionsData();
    dispatchParkingPanel({
      origin,
      selectedId: point.id,
      type: 'OPEN_DETAILS',
    });
    setMobileSheetState('expanded');
    animateMobileSheetTo('expanded');
    captureAnalyticsEvent('parking_details_opened', {
      parking_id: point.id,
      parking_name: point.name,
    });
  }

  function closeParkingDetails(event?: MouseEvent<HTMLButtonElement>) {
    const parkingId = selectedId;
    const detailsOrigin = parkingPanelState.detailsOrigin;
    dispatchParkingPanel({ type: 'CLOSE_DETAILS' });
    captureAnalyticsEvent('parking_details_closed', {
      parking_id: parkingId,
    });
    if (event && event.detail !== 0) {
      return;
    }

    window.requestAnimationFrame(() => {
      const markerButton = parkingId
        ? document.querySelector<HTMLElement>(
            `[data-testid="parking-marker-${parkingId}"]`,
          )
        : null;
      const listItem = parkingId
        ? parkingListItemRefs.current.get(parkingId)
        : null;
      const listDetailsButton = listItem?.querySelector<HTMLButtonElement>(
        '.parking-details-button',
      );
      const listButton =
        listItem?.querySelector<HTMLButtonElement>('.parking-row');
      const focusTarget =
        detailsOrigin === 'list'
          ? (listDetailsButton ?? listButton ?? markerButton)
          : (markerButton ?? listButton);
      focusTarget?.focus({ preventScroll: true });
    });
  }

  function clearSelectedParkingPoint() {
    restoringParkingViewScroll.current = null;
    setOpenParkingMoreMenuId(null);
    parkingViewState.current[parkingView].selectedId = null;
    clearDirectionsData();
    dispatchParkingPanel({ type: 'CLEAR_SELECTION' });
  }

  function rememberCurrentParkingView() {
    parkingViewState.current[parkingView] = {
      scrollTop: parkingListScroll.current?.scrollTop ?? 0,
      selectedId,
    };
  }

  function openMyNeuks(event?: MouseEvent<HTMLButtonElement>) {
    rememberCurrentParkingView();
    restoringParkingViewScroll.current = 'saved';
    const selectedSavedId =
      selectedId && savedIds.has(selectedId)
        ? selectedId
        : parkingViewState.current.saved.selectedId;
    parkingViewState.current.saved.selectedId = selectedSavedId;
    clearDirectionsData();
    dispatchParkingPanel({
      selectedId: selectedSavedId,
      type: 'SHOW_SAVED',
    });
    if (event?.detail === 0) {
      window.requestAnimationFrame(() => savedHeadingRef.current?.focus());
    }
    captureAnalyticsEvent('my_neuks_opened', {
      saved_count: savedNeuks.length,
    });
  }

  function showNearby() {
    rememberCurrentParkingView();
    restoringParkingViewScroll.current = 'nearby';
    const nearbySelectedId = parkingViewState.current.nearby.selectedId;
    clearDirectionsData();
    dispatchParkingPanel({
      selectedId: nearbySelectedId,
      type: 'SHOW_NEARBY',
    });
  }

  function selectDiscoverCategory(category: DiscoverCategory) {
    if (category === discoverCategory) return;
    rememberCurrentParkingView();
    clearDirectionsData();
    setOpenParkingMoreMenuId(null);
    setDiscoverCategory(category);
    dispatchParkingPanel({ selectedId: null, type: 'SHOW_NEARBY' });
    if (category === 'parking') {
      window.requestAnimationFrame(requestCurrentLocationFocus);
    }
    captureAnalyticsEvent('discover_category_selected', { category });
  }

  function openParkingFilters() {
    dispatchParkingPanel({ type: 'OPEN_FILTERS' });
    setMobileSheetState('expanded');
    animateMobileSheetTo('expanded');
    captureAnalyticsEvent('parking_filters_opened', {
      active_filter_count: activeParkingFilterCount,
    });
  }

  function closeParkingFilters() {
    dispatchParkingPanel({ type: 'CLOSE_FILTERS' });
    window.requestAnimationFrame(() =>
      parkingFiltersButtonRef.current?.focus({ preventScroll: true }),
    );
  }

  function applyParkingFilters(
    filters: ParkingFilters,
    sortMode: ParkingSortMode,
  ) {
    const effectiveSortMode = hasActiveParkingFilters(filters)
      ? sortMode
      : 'nearest';
    const selectedPointFailsFilters =
      explicitSelectedPoint !== null &&
      !isCyclingPoiPoint(explicitSelectedPoint) &&
      evaluateParkingFilters(explicitSelectedPoint, filters).failCount > 0;

    setParkingFilters(filters);
    setParkingSortMode(effectiveSortMode);
    if (selectedPointFailsFilters) {
      selectedPointCache.current = null;
      dispatchParkingPanel({ type: 'CLEAR_SELECTION' });
    } else {
      dispatchParkingPanel({ type: 'CLOSE_FILTERS' });
    }
    window.requestAnimationFrame(() =>
      parkingFiltersButtonRef.current?.focus({ preventScroll: true }),
    );
    captureAnalyticsEvent('parking_filters_applied', {
      active_filter_count: countActiveParkingFilters(filters),
      cargo_bike: filters.cargoBike,
      covered: filters.covered,
      frame_lockable: filters.frameLockable,
      minimum_capacity: filters.minimumCapacity,
      public_access: filters.publicAccess,
      sort_mode: effectiveSortMode,
    });
  }

  function showSavedNeuksConfirmation(message: string) {
    if (savedNeuksMessageTimeout.current !== null) {
      window.clearTimeout(savedNeuksMessageTimeout.current);
    }
    setSavedNeuksMessage(message);
    savedNeuksMessageTimeout.current = window.setTimeout(() => {
      setSavedNeuksMessage(null);
      savedNeuksMessageTimeout.current = null;
    }, copiedMessageDurationMs);
  }

  function commitSavedNeuks(items: SavedNeukRecord[]) {
    setSavedNeuks(items);
    let wasWritten = false;
    try {
      wasWritten = writeSavedNeuks(window.localStorage, items);
    } catch {
      // Access to localStorage itself can throw before writing.
    }
    setSavedNeuksStatus(wasWritten ? 'ready' : 'storage-error');
    if (!wasWritten) {
      if (savedNeuksMessageTimeout.current !== null) {
        window.clearTimeout(savedNeuksMessageTimeout.current);
        savedNeuksMessageTimeout.current = null;
      }
      setSavedNeuksMessage(t('savedStorageError'));
    }
    return wasWritten;
  }

  function toggleSavedPoint(point: ParkingPoint, source: ParkingActionSource) {
    const savedNeukKey = getPointSavedNeukKey(point);
    const wasSaved = isNeukSaved(savedNeuks, point);
    const nextItems = wasSaved
      ? removeSavedNeuk(savedNeuks, savedNeukKey)
      : addSavedNeuk(savedNeuks, point);
    const wasWritten = commitSavedNeuks(nextItems);

    if (wasSaved) {
      setSavedRawPoints((points) =>
        points.filter(
          ({ savedNeukKey: currentKey }) => currentKey !== savedNeukKey,
        ),
      );
      setMissingSavedIds((keys) => keys.filter((key) => key !== savedNeukKey));
      setFailedSavedIds((keys) => keys.filter((key) => key !== savedNeukKey));
      if (parkingView === 'saved' && selectedId === point.id) {
        clearSelectedParkingPoint();
      }
    } else {
      setFailedSavedIds((keys) => keys.filter((key) => key !== savedNeukKey));
      setSavedRawPoints((points) => [
        { ...point, savedNeukKey },
        ...points.filter(
          ({ savedNeukKey: currentKey }) => currentKey !== savedNeukKey,
        ),
      ]);
    }

    if (wasWritten) {
      showSavedNeuksConfirmation(
        t(wasSaved ? 'removedFromMyNeuks' : 'savedToMyNeuks'),
      );
    }
    captureAnalyticsEvent(wasSaved ? 'neuk_removed' : 'neuk_saved', {
      parking_id: point.id,
      parking_name: point.name,
      neuk_kind: isCyclingPoiPoint(point) ? 'cycling-place' : 'parking',
      saved_count: nextItems.length,
      source,
    });
  }

  function removeMissingSavedNeuk(record: SavedNeukRecord) {
    const nextItems = removeSavedNeuk(savedNeuks, record.key);
    const wasWritten = commitSavedNeuks(nextItems);
    setMissingSavedIds((keys) => keys.filter((key) => key !== record.key));
    setFailedSavedIds((keys) => keys.filter((key) => key !== record.key));
    if (wasWritten) {
      showSavedNeuksConfirmation(t('removedFromMyNeuks'));
    }
    captureAnalyticsEvent('neuk_removed', {
      parking_id: record.id,
      parking_name: record.snapshot.name,
      neuk_kind: record.kind,
      saved_count: nextItems.length,
      source: 'list',
    });
  }

  function openNewRoutePlanner(
    source: 'menu' | 'saved-routes' | 'map' = 'saved-routes',
  ) {
    cancelLocationRequest();
    stopLiveRouteTracking();
    setJourneyEditing(false);
    setRouteLibraryReturnView(null);
    setSelectedSavedRoute(null);
    setRouteWaypointPlacementSnapshot(null);
    setRouteWorkspaceView('planner');
    setMobileSheetState('expanded');
    if (routeDraft) {
      setRouteDestinationSearch(initialRouteDestinationSearchState);
      return;
    }
    const draft = createRouteDraft(
      createLocalId(),
      locationState.status === 'located'
        ? {
            id: createLocalId(),
            label: t('currentLocation'),
            ...locationState.location,
            source: 'current-location',
          }
        : undefined,
    );
    setRouteDraft(draft);
    setRoutePlannerRoutes({});
    setRoutePlannerStatus('idle');
    setRoutePlannerMessage(null);
    setDestinationParkingState(null);
    setJourneySearchTarget('destination');
    setRouteDestinationSearch({
      ...initialRouteDestinationSearchState,
      isOpen: true,
    });
    captureAnalyticsEvent('route_planner_opened', { source });
  }

  function openSavedRoutes() {
    cancelLocationRequest();
    stopLiveRouteTracking();
    const preservePlanner =
      routeWorkspaceView === 'planner' && routeDraft !== null;
    if (!preservePlanner) {
      if (routePlannerCalculationTimeout.current !== null) {
        window.clearTimeout(routePlannerCalculationTimeout.current);
        routePlannerCalculationTimeout.current = null;
      }
      routePlannerRequestId.current += 1;
    }
    setRouteLibraryReturnView(preservePlanner ? 'planner' : null);
    setSelectedSavedRoute(null);
    setPendingGpxImport(null);
    setSavedRoutesMessage(null);
    setRouteDestinationSearch(initialRouteDestinationSearchState);
    setRouteWaypointPlacementSnapshot(null);
    setRouteWorkspaceView('library');
    setMobileSheetState('expanded');
    void refreshSavedRoutes();
  }

  function returnToPreservedRouteDraft() {
    if (routeLibraryReturnView !== 'planner' || routeDraft === null) {
      return false;
    }
    setSelectedSavedRoute(null);
    setSavedRoutesError(null);
    setRouteWorkspaceView('planner');
    setMobileSheetState('expanded');
    return true;
  }

  function closeRouteWorkspace() {
    stopLiveRouteTracking();
    setActiveInstruction(null);
    setRouteInstructionFocusRequest(null);
    cancelRouteDestinationSearchWork();
    destinationParkingRequestId.current += 1;
    setRouteLibraryReturnView(null);
    setRouteWorkspaceView(null);
    setDestinationParkingState(null);
    setRouteDestinationSearch(initialRouteDestinationSearchState);
    setRouteWaypointPlacementSnapshot(null);
    setSelectedSavedRoute(null);
    setPendingGpxImport(null);
  }

  function resetJourney() {
    if (
      routeDraft &&
      routeDraft.waypoints.length > 1 &&
      !window.confirm(t('discardRouteDraft'))
    )
      return;
    stopLiveRouteTracking();
    cancelRouteDestinationSearchWork();
    routePlannerRequestId.current += 1;
    if (routePlannerCalculationTimeout.current !== null) {
      window.clearTimeout(routePlannerCalculationTimeout.current);
      routePlannerCalculationTimeout.current = null;
    }
    setRouteDraft(createRouteDraft(createLocalId()));
    setPendingJourneyDestination(null);
    setRoutePlannerRoutes({});
    setRoutePlannerStatus('idle');
    setRoutePlannerMessage(null);
    setJourneySearchTarget('destination');
    setRouteDestinationSearch({
      ...initialRouteDestinationSearchState,
      isOpen: true,
    });
  }

  function useJourneyLocation() {
    if (!routeDraft) return;
    cancelRouteDestinationSearchWork();
    const requestId = routeDestinationSearchRequestId.current;
    setRouteDestinationSearch((current) => ({
      ...current,
      searchStatus: 'loading',
      message: null,
    }));
    const fail = (message: string) => {
      if (requestId !== routeDestinationSearchRequestId.current) return;
      setRouteDestinationSearch((current) => ({
        ...current,
        searchStatus: 'idle',
        message,
      }));
    };
    if (!canUseGeolocation()) {
      fail(t('liveLocationUnavailable'));
      return;
    }
    getCurrentPosition(
      (position) => {
        if (requestId !== routeDestinationSearchRequestId.current) return;
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const manifest = parkingDataClient.current?.getManifest();
        if (!isResolvedLocation(location)) {
          fail(t('liveLocationUnavailable'));
          return;
        }
        if (manifest && !isLocationInParkingCoverage(location, manifest)) {
          fail(t('routeOutsideCoverage'));
          return;
        }
        const start: CycleRouteWaypoint = {
          id: createLocalId(),
          label: t('currentLocation'),
          ...location,
          source: 'current-location',
        };
        const waypoints = [start, ...routeDraft.waypoints.slice(1)];
        if (pendingJourneyDestination)
          waypoints.push(pendingJourneyDestination);
        setPendingJourneyDestination(null);
        commitRouteDraft({ ...routeDraft, waypoints });
        setRouteDestinationSearch(initialRouteDestinationSearchState);
      },
      (error) =>
        fail(
          t(
            error.code === error.PERMISSION_DENIED
              ? 'routeLocationPermission'
              : 'liveLocationUnavailable',
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  }

  function openJourneyToParking(point: ParkingPoint) {
    cancelLocationRequest();
    cancelRouteDestinationSearchWork();
    stopLiveRouteTracking();
    clearDirectionsData();
    const destination: CycleRouteWaypoint = {
      id: point.id,
      label: point.name,
      latitude: point.latitude,
      longitude: point.longitude,
      source: 'parking',
    };
    const draft = createRouteDraft(
      createLocalId(),
      locationState.status === 'located'
        ? {
            id: createLocalId(),
            label: t('currentLocation'),
            ...locationState.location,
            source: 'current-location',
          }
        : undefined,
    );
    setJourneyEditing(false);
    setRouteWaypointPlacementSnapshot(null);
    setRouteWorkspaceView('planner');
    setMobileSheetState('expanded');
    setDestinationParkingState(null);
    if (draft.waypoints.length) {
      setPendingJourneyDestination(null);
      commitRouteDraft(setRouteDestination(draft, destination));
      setRouteDestinationSearch(initialRouteDestinationSearchState);
    } else {
      setPendingJourneyDestination(destination);
      commitRouteDraft(draft);
      setJourneySearchTarget('start');
      setRouteDestinationSearch({
        ...initialRouteDestinationSearchState,
        isOpen: true,
      });
    }
  }

  async function calculateRouteDraft(nextDraft: RouteDraft) {
    routePlannerRequestId.current += 1;
    const requestId = routePlannerRequestId.current;

    if (
      nextDraft.waypoints.length === 2 &&
      distanceMeters(nextDraft.waypoints[0]!, nextDraft.waypoints[1]!) <=
        SHORT_CYCLE_ROUTE_THRESHOLD_METERS
    ) {
      const finish = nextDraft.waypoints[1]!;
      setRoutePlannerRoutes(
        buildShortCycleRoutes(nextDraft.waypoints[0]!, {
          id: finish.id,
          name: finish.label,
          latitude: finish.latitude,
          longitude: finish.longitude,
          properties: {},
          sourceId: 'route-planner',
        }),
      );
      setRoutePlannerStatus('loaded');
      setRoutePlannerMessage(null);
      return;
    }
    if (!canCalculateRoute(nextDraft)) {
      setRoutePlannerRoutes({});
      setRoutePlannerStatus('idle');
      setRoutePlannerMessage(null);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_CYCLESTREETS_API_KEY;
    if (!apiKey) {
      setRoutePlannerStatus('missing-key');
      setRoutePlannerRoutes({});
      return;
    }

    const cacheKey = buildCycleRouteWaypointsCacheKey(nextDraft.waypoints);
    const cached = routePlannerCache.current.get(cacheKey);
    if (cached) {
      if (routePlannerRequestId.current !== requestId) {
        return;
      }
      setRoutePlannerRoutes(cached);
      setRoutePlannerStatus('loaded');
      setRoutePlannerMessage(null);
      return;
    }

    setRoutePlannerStatus('loading');
    setRoutePlannerMessage(null);
    try {
      const request = buildCycleStreetsRouteRequest({
        apiKey,
        waypoints: nextDraft.waypoints,
      });
      const finish = nextDraft.waypoints.at(-1)!;
      const routes = parseCycleStreetsRoutes(
        await fetchCycleStreetsDirections(request),
        {
          id: finish.id,
          name: finish.label,
          latitude: finish.latitude,
          longitude: finish.longitude,
          properties: {},
          sourceId: 'route-planner',
        },
      );
      if (routePlannerRequestId.current !== requestId) {
        return;
      }
      routePlannerCache.current.set(cacheKey, routes);
      const availablePlan = routes[nextDraft.plan]
        ? nextDraft.plan
        : getInitialCycleRoutePlan(routes);
      if (!availablePlan) throw new Error('No routes returned');
      setRouteDraft((current) =>
        current?.id === nextDraft.id
          ? { ...current, plan: availablePlan }
          : current,
      );
      setRoutePlannerRoutes(routes);
      setRoutePlannerStatus('loaded');
      captureAnalyticsEvent('route_calculated', {
        plan_count: Object.keys(routes).length,
        stop_count: nextDraft.waypoints.length,
      });
    } catch {
      if (routePlannerRequestId.current !== requestId) {
        return;
      }
      setRoutePlannerRoutes({});
      setRoutePlannerStatus('error');
      setRoutePlannerMessage(t('directionsError'));
    }
  }

  async function openDestinationParkingChooser() {
    const draft = routeDraft;
    const originalDestination = draft?.waypoints.at(-1);
    const client = parkingDataClient.current;
    if (
      !draft ||
      !originalDestination ||
      draft.waypoints.length < 2 ||
      !client
    ) {
      return;
    }

    const requestId = ++destinationParkingRequestId.current;
    cancelRouteDestinationSearchWork();
    setRouteDestinationSearch(initialRouteDestinationSearchState);
    setDestinationParkingState({
      candidates: [],
      expanded: false,
      originalDestination,
      selectedId: null,
      status: 'loading',
    });
    setRouteWorkspaceView('destination-parking');
    setMobileSheetState('expanded');

    try {
      await client.loadLocation(originalDestination);
      if (destinationParkingRequestId.current !== requestId) {
        return;
      }

      const shortlist = getDestinationParkingShortlist(
        prepareDisplayPoints(client.getLoadedPoints(), locale),
        originalDestination,
      );
      const baselineRoute = routePlannerRoutes[draft.plan] ?? null;
      const apiKey = process.env.NEXT_PUBLIC_CYCLESTREETS_API_KEY;
      const outcomes = await Promise.allSettled(
        shortlist.map(async (point) => {
          if (!apiKey || !baselineRoute) {
            return {
              destinationDistanceMeters: point.distanceMeters ?? 0,
              point,
              route: null,
              routeDurationDeltaSeconds: null,
            } satisfies DestinationParkingCandidate;
          }

          const candidateDraft = replaceRouteFinishWithParking(draft, point);
          const cacheKey = buildCycleRouteWaypointsCacheKey(
            candidateDraft.waypoints,
          );
          let routes = routePlannerCache.current.get(cacheKey);
          if (!routes) {
            const request = buildCycleStreetsRouteRequest({
              apiKey,
              waypoints: candidateDraft.waypoints,
            });
            routes = parseCycleStreetsRoutes(
              await fetchCycleStreetsDirections(request),
              point,
            );
            routePlannerCache.current.set(cacheKey, routes);
          }
          const route = routes[draft.plan] ?? null;

          return {
            destinationDistanceMeters: point.distanceMeters ?? 0,
            point,
            route,
            routeDurationDeltaSeconds: route
              ? route.durationSeconds - baselineRoute.durationSeconds
              : null,
          } satisfies DestinationParkingCandidate;
        }),
      );
      if (destinationParkingRequestId.current !== requestId) {
        return;
      }

      const candidates = rankDestinationParkingCandidates(
        outcomes.map((outcome, index) =>
          outcome.status === 'fulfilled'
            ? outcome.value
            : {
                destinationDistanceMeters:
                  shortlist[index]?.distanceMeters ?? 0,
                point: shortlist[index]!,
                route: null,
                routeDurationDeltaSeconds: null,
              },
        ),
      );
      setDestinationParkingState({
        candidates,
        expanded: false,
        originalDestination,
        selectedId: candidates[0]?.point.id ?? null,
        status: 'ready',
      });
      captureAnalyticsEvent('destination_parking_opened', {
        candidate_count: candidates.length,
        route_comparisons: candidates.filter(({ route }) => route !== null)
          .length,
      });
    } catch {
      if (destinationParkingRequestId.current !== requestId) {
        return;
      }
      setDestinationParkingState({
        candidates: [],
        expanded: false,
        originalDestination,
        selectedId: null,
        status: 'error',
      });
    }
  }

  function closeDestinationParkingChooser() {
    destinationParkingRequestId.current += 1;
    setDestinationParkingState(null);
    setRouteWorkspaceView('planner');
    setMobileSheetState('expanded');
  }

  function confirmDestinationParking() {
    if (!routeDraft || !selectedDestinationParkingCandidate) {
      return;
    }
    const rank =
      destinationParkingState?.candidates.findIndex(
        ({ point }) =>
          point.id === selectedDestinationParkingCandidate.point.id,
      ) ?? -1;
    const nextDraft = replaceRouteFinishWithParking(
      routeDraft,
      selectedDestinationParkingCandidate.point,
    );
    destinationParkingRequestId.current += 1;
    setDestinationParkingState(null);
    setRouteWorkspaceView('planner');
    setMobileSheetState('expanded');
    commitRouteDraft(nextDraft);
    captureAnalyticsEvent('destination_parking_confirmed', {
      rank: rank + 1,
      route_comparison_available:
        selectedDestinationParkingCandidate.route !== null,
    });
  }

  useEffect(() => {
    if (!isClientReady || sharedRouteOpened.current) {
      return;
    }
    sharedRouteOpened.current = true;
    const shared = parseRouteShareHash(window.location.hash);
    if (!shared) {
      return;
    }
    const draft: RouteDraft = {
      ...createRouteDraft(createLocalId()),
      plan: shared.plan,
      waypoints: shared.waypoints.map((point, index) => ({
        id: createLocalId(),
        label:
          index === 0
            ? t('routeStart')
            : index === shared.waypoints.length - 1
              ? t('routeFinish')
              : t('routeMapStop', { count: index + 1 }),
        ...point,
        source: 'map',
      })),
    };
    stopLiveRouteTracking();
    setSelectedSavedRoute(null);
    setRouteDraft(draft);
    setRouteWorkspaceView('planner');
    setMobileSheetState('expanded');
    void calculateRouteDraft(draft);
    captureAnalyticsEvent('route_link_opened', {
      stop_count: draft.waypoints.length,
    });
  }, [isClientReady]);

  useEffect(() => {
    if (
      !routeDestinationSearch.isOpen ||
      routeDestinationSearch.selectedId === null ||
      routePlannerStatus !== 'loaded'
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setRouteDestinationSearch(initialRouteDestinationSearchState);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [
    routeDestinationSearch.isOpen,
    routeDestinationSearch.selectedId,
    routePlannerStatus,
  ]);

  function commitRouteDraft(nextDraft: RouteDraft) {
    if (routePlannerCalculationTimeout.current !== null) {
      window.clearTimeout(routePlannerCalculationTimeout.current);
      routePlannerCalculationTimeout.current = null;
    }
    setRouteDraft(nextDraft);
    setRoutePlannerRoutes({});
    setRoutePlannerStatus('idle');
    setRoutePlannerMessage(null);
    void calculateRouteDraft(nextDraft);
  }

  function scheduleRouteDraftCalculation(nextDraft: RouteDraft) {
    if (routePlannerCalculationTimeout.current !== null) {
      window.clearTimeout(routePlannerCalculationTimeout.current);
      routePlannerCalculationTimeout.current = null;
    }

    routePlannerRequestId.current += 1;
    setRoutePlannerRoutes({});
    setRoutePlannerMessage(null);

    if (!canCalculateRoute(nextDraft)) {
      setRoutePlannerStatus('idle');
      return;
    }

    if (!process.env.NEXT_PUBLIC_CYCLESTREETS_API_KEY) {
      setRoutePlannerStatus('missing-key');
      return;
    }

    setRoutePlannerStatus('loading');
    routePlannerCalculationTimeout.current = window.setTimeout(() => {
      routePlannerCalculationTimeout.current = null;
      void calculateRouteDraft(nextDraft);
    }, routePlannerCalculationDebounceMs);
  }

  function addWaypointToRouteDraft(waypoint: CycleRouteWaypoint) {
    if (!routeDraft) {
      return;
    }
    commitRouteDraft(addRouteWaypoint(routeDraft, waypoint));
  }

  function beginRouteWaypointPlacement() {
    if (
      !routeDraft ||
      routeDraft.waypoints.length >= CYCLESTREETS_MAX_WAYPOINTS
    ) {
      return;
    }

    if (routePlannerCalculationTimeout.current !== null) {
      window.clearTimeout(routePlannerCalculationTimeout.current);
      routePlannerCalculationTimeout.current = null;
    }
    routePlannerRequestId.current += 1;
    setRouteWaypointPlacementSnapshot({
      draft: {
        ...routeDraft,
        waypoints: [...routeDraft.waypoints],
      },
      message: routePlannerMessage,
      routes: routePlannerRoutes,
      status: routePlannerStatus,
    });
    setMobileSheetState('expanded');
  }

  function placeRouteWaypoint(location: UserLocation) {
    if (
      !routeDraft ||
      !isRouteWaypointPlacementActive ||
      routeDraft.waypoints.length >= CYCLESTREETS_MAX_WAYPOINTS
    ) {
      return;
    }

    const nextDraft = addRouteWaypoint(routeDraft, {
      id: createLocalId(),
      label: t('routeMapStop', { count: routeDraft.waypoints.length + 1 }),
      latitude: location.latitude,
      longitude: location.longitude,
      source: 'map',
    });
    setRouteDraft(nextDraft);
    scheduleRouteDraftCalculation(nextDraft);
  }

  function undoRouteWaypointPlacement() {
    if (
      !routeDraft ||
      !routeWaypointPlacementSnapshot ||
      routeDraft.waypoints.length <=
        routeWaypointPlacementSnapshot.draft.waypoints.length
    ) {
      return;
    }

    const nextDraft = {
      ...routeDraft,
      waypoints: routeDraft.waypoints.slice(0, -1),
    };
    setRouteDraft(nextDraft);

    if (
      nextDraft.waypoints.length ===
      routeWaypointPlacementSnapshot.draft.waypoints.length
    ) {
      if (routePlannerCalculationTimeout.current !== null) {
        window.clearTimeout(routePlannerCalculationTimeout.current);
        routePlannerCalculationTimeout.current = null;
      }
      routePlannerRequestId.current += 1;
      setRoutePlannerRoutes(routeWaypointPlacementSnapshot.routes);
      setRoutePlannerStatus(routeWaypointPlacementSnapshot.status);
      setRoutePlannerMessage(routeWaypointPlacementSnapshot.message);
      return;
    }

    scheduleRouteDraftCalculation(nextDraft);
  }

  function cancelRouteWaypointPlacement() {
    if (!routeWaypointPlacementSnapshot) {
      return;
    }

    const snapshot = routeWaypointPlacementSnapshot;
    if (routePlannerCalculationTimeout.current !== null) {
      window.clearTimeout(routePlannerCalculationTimeout.current);
      routePlannerCalculationTimeout.current = null;
    }
    routePlannerRequestId.current += 1;
    setRouteDraft(snapshot.draft);
    setRoutePlannerRoutes(snapshot.routes);
    setRoutePlannerStatus(snapshot.status);
    setRoutePlannerMessage(snapshot.message);
    setRouteWaypointPlacementSnapshot(null);

    if (snapshot.status === 'loading') {
      void calculateRouteDraft(snapshot.draft);
    }
  }

  function finishRouteWaypointPlacement() {
    if (!routeDraft || !routeWaypointPlacementSnapshot) {
      return;
    }

    const snapshot = routeWaypointPlacementSnapshot;
    const hasChanges =
      routeDraft.waypoints.length !== snapshot.draft.waypoints.length;
    setRouteWaypointPlacementSnapshot(null);

    if (hasChanges) {
      return;
    }

    if (routePlannerCalculationTimeout.current !== null) {
      window.clearTimeout(routePlannerCalculationTimeout.current);
      routePlannerCalculationTimeout.current = null;
    }
    routePlannerRequestId.current += 1;
    setRoutePlannerRoutes(snapshot.routes);
    setRoutePlannerStatus(snapshot.status);
    setRoutePlannerMessage(snapshot.message);
    if (snapshot.status === 'loading') {
      void calculateRouteDraft(snapshot.draft);
    }
  }

  async function saveRouteDraft() {
    if (!routeDraft) {
      return;
    }
    const route = routePlannerRoutes[routeDraft.plan];
    if (!route) {
      return;
    }

    const existing = savedRoutes.find(({ id }) => id === routeDraft.id);
    const now = new Date().toISOString();
    const record = createSavedRouteRecord({
      id: routeDraft.id,
      name:
        routeDraft.name.trim() ||
        getDefaultRouteName(routeDraft.waypoints, (start, finish) =>
          t('routeNameBetween', { start, finish }),
        ),
      route,
      waypoints: routeDraft.waypoints,
      createdAt: existing?.createdAt ?? now,
    });
    record.updatedAt = now;

    try {
      await putSavedRoute(record);
      await refreshSavedRoutes();
      setSelectedSavedRoute(record);
      setRouteLibraryReturnView(null);
      setRouteWorkspaceView('detail');
      setRoutePlannerMessage(null);
      captureAnalyticsEvent('route_saved', {
        plan: route.plan,
        stop_count: record.waypoints.length,
      });
    } catch {
      setRoutePlannerMessage(t('routeStorageError'));
      setRoutePlannerStatus('error');
    }
  }

  function editSavedRoute(record: SavedRouteRecord) {
    if (record.kind !== 'planned' || record.plan === null) {
      return;
    }
    if (
      routeLibraryReturnView === 'planner' &&
      routeDraft &&
      isRouteDraftMeaningful(routeDraft) &&
      !window.confirm(t('discardRouteDraft'))
    ) {
      return;
    }
    const route = savedRouteToCycleRoute(record);
    setRouteLibraryReturnView(null);
    setRouteWaypointPlacementSnapshot(null);
    setRouteDraft({
      id: record.id,
      name: record.name,
      plan: record.plan,
      waypoints: record.waypoints.map((waypoint) => ({
        ...waypoint,
        source: 'saved-route',
      })),
    });
    setRoutePlannerRoutes({ [record.plan]: route });
    setRoutePlannerStatus('loaded');
    setRoutePlannerMessage(null);
    setRouteWorkspaceView('planner');
  }

  async function renameSavedRoute(record: SavedRouteRecord, name: string) {
    const renamed = {
      ...record,
      name: name.trim(),
      updatedAt: new Date().toISOString(),
    };
    setSavedRoutesError(null);
    try {
      await putSavedRoute(renamed);
      await refreshSavedRoutes();
      setSelectedSavedRoute(renamed);
    } catch {
      setSavedRoutesError(t('routeStorageError'));
    }
  }

  async function duplicateSavedRoute(record: SavedRouteRecord) {
    const duplicated = {
      ...record,
      id: createLocalId(),
      name: t('routeCopyName', { name: record.name }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSavedRoutesError(null);
    try {
      await putSavedRoute(duplicated);
      await refreshSavedRoutes();
      setSelectedSavedRoute(duplicated);
    } catch {
      setSavedRoutesError(t('routeStorageError'));
    }
  }

  async function removeSavedRoute(record: SavedRouteRecord) {
    if (!window.confirm(t('routeDeleteConfirm', { name: record.name }))) {
      return;
    }
    setSavedRoutesError(null);
    try {
      await deleteSavedRoute(record.id);
      await refreshSavedRoutes();
      setSelectedSavedRoute(null);
      setRouteWorkspaceView('library');
      captureAnalyticsEvent('saved_route_deleted');
    } catch {
      setSavedRoutesError(t('routeStorageError'));
    }
  }

  function exportSavedRoute(record: SavedRouteRecord) {
    downloadRouteGpx({
      name: record.name,
      route: savedRouteToCycleRoute(record),
      waypoints: record.waypoints,
    });
    captureAnalyticsEvent('route_gpx_exported', {
      route_kind: record.kind,
      stop_count: record.waypoints.length,
    });
  }

  async function reviewGpxFile(file: File) {
    setSavedRoutesError(null);
    setSavedRoutesMessage(null);
    try {
      const parsed = await parseGpxFile(file);
      setPendingGpxImport(parsed);
      setSelectedSavedRoute(null);
      setRouteWorkspaceView('import');
      setMobileSheetState('expanded');
      captureAnalyticsEvent('route_gpx_reviewed', {
        point_count: parsed.points.length,
      });
    } catch {
      setSavedRoutesError(t('gpxImportError'));
      setPendingGpxImport(null);
      setRouteWorkspaceView('library');
    }
  }

  async function addImportedGpx(name: string) {
    if (!pendingGpxImport) {
      return;
    }
    const record = createImportedGpxRouteRecord({
      id: createLocalId(),
      name,
      fileName: pendingGpxImport.fileName,
      distanceMeters: pendingGpxImport.distanceMeters,
      durationSeconds: pendingGpxImport.durationSeconds,
      points: pendingGpxImport.points,
      segments: pendingGpxImport.segments,
      waypoints: pendingGpxImport.waypoints,
    });
    setSavedRoutesError(null);
    try {
      await putSavedRoute(record);
      await refreshSavedRoutes();
      setPendingGpxImport(null);
      setSelectedSavedRoute(record);
      setRouteWorkspaceView('detail');
      captureAnalyticsEvent('route_gpx_imported', {
        point_count: record.points.length,
      });
    } catch {
      setSavedRoutesError(t('routeStorageError'));
    }
  }

  async function shareSavedRouteLink(record: SavedRouteRecord) {
    if (record.kind !== 'planned' || record.plan === null) {
      return;
    }
    setSavedRoutesError(null);
    setSavedRoutesMessage(null);
    const result = await shareParkingLink({
      title: record.name,
      url: buildRouteShareUrl(
        window.location.origin,
        window.location.pathname,
        record.plan,
        record.waypoints,
      ),
    });
    if (result === 'copied') {
      setSavedRoutesMessage(t('routeLinkCopied'));
    } else if (result === 'failed') {
      setSavedRoutesError(t('routeShareError'));
    }
    if (result === 'shared' || result === 'copied') {
      captureAnalyticsEvent('route_link_shared', {
        method: result,
        stop_count: record.waypoints.length,
      });
    }
  }

  async function shareSavedRouteGpx(record: SavedRouteRecord) {
    setSavedRoutesError(null);
    setSavedRoutesMessage(null);
    const file = createRouteGpxFile({
      name: record.name,
      route: savedRouteToCycleRoute(record),
      waypoints: record.waypoints,
    });
    const result = await shareRouteFile(file, record.name, {
      download: downloadGpxFile,
    });
    if (result === 'failed') {
      setSavedRoutesError(t('routeShareError'));
    }
    if (result === 'shared' || result === 'downloaded') {
      captureAnalyticsEvent('route_gpx_shared', {
        method: result,
        route_kind: record.kind,
      });
    }
  }

  async function shareParkingLinkForPoint(
    point: ParkingPoint,
    source: ParkingActionSource,
  ) {
    const link = buildParkingShareUrl(
      window.location.origin,
      window.location.pathname,
      point.id,
    );

    if (copiedMessageTimeout.current !== null) {
      window.clearTimeout(copiedMessageTimeout.current);
      copiedMessageTimeout.current = null;
    }
    setCopiedShareButton(null);

    const result = await shareParkingLink({
      title: point.name,
      url: link,
    });

    if (result === 'shared') {
      captureAnalyticsEvent('parking_link_shared', {
        parking_id: point.id,
        parking_name: point.name,
        source,
      });
      setShareError(null);
      return;
    }

    if (result === 'copied') {
      captureAnalyticsEvent('parking_link_copied', {
        parking_id: point.id,
        parking_name: point.name,
        source,
      });
      setShareError(null);
      setCopiedShareButton({ parkingId: point.id, source });
      copiedMessageTimeout.current = window.setTimeout(() => {
        setCopiedShareButton(null);
        copiedMessageTimeout.current = null;
      }, copiedMessageDurationMs);
      return;
    }

    if (result === 'cancelled') {
      setShareError(null);
      return;
    }

    setShareError(t('shareLinkError'));
  }

  async function requestDirections(
    event: MouseEvent<HTMLButtonElement>,
    point: ParkingPoint,
  ) {
    event.stopPropagation();
    openJourneyToParking(point);
  }

  async function shareParkingLinkFromList(
    event: MouseEvent<HTMLButtonElement>,
    point: ParkingPoint,
  ) {
    event.stopPropagation();
    await shareParkingLinkForPoint(point, 'list');
  }

  function chooseThemeMode(mode: ThemeMode) {
    captureAnalyticsEvent('theme_changed', { theme: mode });
    setThemeMode(mode);
    setIsSettingsMenuOpen(false);
  }

  function chooseLanguage(nextLocale: AppLocale) {
    captureAnalyticsEvent('language_changed', { language: nextLocale });
    setLocale(nextLocale);
    setIsSettingsMenuOpen(false);
  }

  function installPwa() {
    captureAnalyticsEvent('pwa_install_triggered');
    setIsSettingsMenuOpen(false);
    void installApp();
  }

  function openAttributionsFromSettings() {
    setIsSettingsMenuOpen(false);
    setIsAttributionModalOpen(true);
  }

  function setCycleNetworkVisibility(visible: boolean) {
    setIsCycleNetworkVisible(visible);
    captureAnalyticsEvent('map_layer_changed', {
      layer: 'national_cycle_network',
      visible,
    });
    try {
      window.localStorage.setItem(cycleNetworkStorageKey, String(visible));
    } catch {
      // Keep the in-memory choice when storage is unavailable.
    }
  }

  function setDrinkingWaterVisibility(visible: boolean) {
    setIsDrinkingWaterVisible(visible);
    captureAnalyticsEvent('map_layer_changed', {
      layer: 'drinking_water',
      visible,
    });
    try {
      window.localStorage.setItem(drinkingWaterStorageKey, String(visible));
    } catch {
      // Keep the in-memory choice when storage is unavailable.
    }
    if (
      !visible &&
      explicitSelectedPoint &&
      isCyclingPoiPoint(explicitSelectedPoint) &&
      explicitSelectedPoint.categories[0] === 'water'
    ) {
      clearSelectedParkingPoint();
    }
  }

  function renderThemeSettings(
    className = '',
    triggerVariant: 'brand' | 'settings' = 'settings',
  ) {
    const isBrandTrigger = triggerVariant === 'brand';

    return (
      <div className={['settings-menu', className].filter(Boolean).join(' ')}>
        <motion.button
          aria-expanded={isSettingsMenuOpen}
          aria-label={isBrandTrigger ? t('bikeNeuksMenu') : t('themeSettings')}
          className={[
            'settings-trigger',
            isBrandTrigger ? 'settings-trigger--brand' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          type="button"
          whileTap={subtleTap}
          onClick={() => {
            setIsMapLayersOpen(false);
            setIsSettingsMenuOpen((isOpen) => !isOpen);
          }}
        >
          {isBrandTrigger ? (
            <img src="favicon.svg?v=white-pin-1" alt="" aria-hidden="true" />
          ) : (
            <Settings size={18} aria-hidden="true" />
          )}
        </motion.button>
        <AnimatePresence initial={false}>
          {isSettingsMenuOpen ? (
            <motion.div
              {...popoverPresence}
              className="settings-popover"
              role="menu"
              aria-label={isBrandTrigger ? t('bikeNeuksMenu') : t('settings')}
            >
              <span className="settings-label">{t('routes')}</span>
              <div className="settings-route-actions">
                <motion.button
                  className="settings-action-button"
                  data-testid="plan-route"
                  type="button"
                  whileTap={subtleTap}
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    openNewRoutePlanner('menu');
                  }}
                >
                  <Route size={15} aria-hidden="true" />
                  <span>{t(routeDraft ? 'resumeRoute' : 'planRoute')}</span>
                </motion.button>
                <motion.button
                  className="settings-action-button"
                  data-testid="open-my-routes"
                  type="button"
                  whileTap={subtleTap}
                  onClick={() => {
                    setIsSettingsMenuOpen(false);
                    openSavedRoutes();
                  }}
                >
                  <Bookmark
                    size={15}
                    fill={savedRoutes.length > 0 ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                  <span>{t('myRoutes')}</span>
                  <span className="settings-route-count">
                    {savedRoutes.length}
                  </span>
                </motion.button>
              </div>
              <span className="settings-section-divider" aria-hidden="true" />
              <span className="settings-label">{t('theme')}</span>
              <div
                className="theme-options"
                role="group"
                aria-label={t('theme')}
              >
                {themeOptions.map(({ icon: Icon, labelKey, mode }) => (
                  <motion.button
                    aria-pressed={themeMode === mode}
                    className={themeMode === mode ? 'selected' : undefined}
                    key={mode}
                    type="button"
                    whileTap={subtleTap}
                    onClick={() => chooseThemeMode(mode)}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {t(labelKey)}
                  </motion.button>
                ))}
              </div>
              <label className="settings-label" htmlFor="language-setting">
                {t('language')}
              </label>
              <select
                className="language-select"
                id="language-setting"
                value={locale}
                onChange={(event) =>
                  chooseLanguage(event.target.value as AppLocale)
                }
              >
                {supportedLocales.map((optionLocale) => (
                  <option key={optionLocale} value={optionLocale}>
                    {localeDetails[optionLocale].selfName}
                  </option>
                ))}
              </select>
              <span className="settings-label">{t('app')}</span>
              <motion.button
                className="settings-action-button"
                data-testid="open-offline-areas"
                type="button"
                whileTap={subtleTap}
                onClick={openOfflineAreas}
              >
                <Boxes size={15} aria-hidden="true" />
                {t('offlineAreas')}
              </motion.button>
              {canInstall ? (
                <Fragment key="install-app-action">
                  <motion.button
                    className="settings-action-button"
                    type="button"
                    whileTap={subtleTap}
                    onClick={installPwa}
                  >
                    <Download size={15} aria-hidden="true" />
                    {t('installApp')}
                  </motion.button>
                </Fragment>
              ) : null}
              <span className="settings-label">{t('about')}</span>
              <motion.button
                className="settings-action-button"
                type="button"
                whileTap={subtleTap}
                onClick={openAttributionsFromSettings}
              >
                <CircleHelp size={15} aria-hidden="true" />
                {t('attributions')}
              </motion.button>
              {isBrandTrigger ? (
                <p className="settings-credit">
                  {t('builtBy')} <a href="https://tau.gr">taugr</a>
                </p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  function renderPlaceSearchPanel(surface: 'desktop' | 'mobile') {
    const resultListId = `place-search-results-${surface}`;
    const hasSearchFeedback =
      isPlaceSearching ||
      placeResults.length > 0 ||
      placeSearchMessage !== null;

    return (
      <section
        className={`reference-panel reference-panel--${surface}`}
        aria-label={t('placeSearch')}
      >
        <form
          className="place-search-form"
          onSubmit={(event) => {
            void searchForPlace(event);
          }}
        >
          <div className="search-box">
            <Search className="search-box-icon" size={17} aria-hidden="true" />
            <label className="sr-only" htmlFor={`place-search-${surface}`}>
              {t('placeSearchLabel')}
            </label>
            <input
              aria-activedescendant={
                placeResults.length > 0
                  ? `place-search-result-${surface}-${activePlaceResultIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-controls={resultListId}
              aria-expanded={hasSearchFeedback}
              id={`place-search-${surface}`}
              name="place-search"
              type="search"
              value={placeQuery}
              placeholder={t('placeOrPostcode')}
              onChange={(event) => updatePlaceQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  cancelPlaceSearchWork();
                  setActivePlaceResultIndex(0);
                  setPlaceResults([]);
                  setPlaceSearchMessage(null);
                  return;
                }

                if (placeResults.length === 0) {
                  return;
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActivePlaceResultIndex((index) =>
                    Math.min(index + 1, placeResults.length - 1),
                  );
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActivePlaceResultIndex((index) => Math.max(index - 1, 0));
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  const result = placeResults[activePlaceResultIndex];
                  if (result) {
                    selectPlace(result);
                  }
                }
              }}
            />
            {placeQuery.length > 0 ? (
              <button
                aria-label={t('clearSearch')}
                className="search-clear-button"
                type="button"
                onClick={clearPlaceSearch}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <motion.button
            aria-label={
              locationState.status === 'locating'
                ? t('locating')
                : t('useCurrentLocation')
            }
            className="secondary-location-button"
            title={
              locationState.status === 'locating'
                ? t('locating')
                : t('useCurrentLocation')
            }
            type="button"
            onClick={() => {
              captureAnalyticsEvent('location_requested');
              requestLocation(undefined, true);
            }}
            disabled={locationState.status === 'locating'}
            whileTap={
              locationState.status === 'locating' ? undefined : subtleTap
            }
          >
            {locationState.status === 'locating' ? (
              <Crosshair size={18} aria-hidden="true" />
            ) : (
              <LocateFixed size={18} aria-hidden="true" />
            )}
            <span className="sr-only">
              {locationState.status === 'locating'
                ? t('locating')
                : t('nearMe')}
            </span>
          </motion.button>
          <motion.button
            className={[
              'place-search-button',
              surface === 'mobile' ? 'place-search-button--mobile' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            type="submit"
            disabled={isPlaceSearching || placeQuery.trim().length === 0}
            whileTap={
              isPlaceSearching || placeQuery.trim().length === 0
                ? undefined
                : subtleTap
            }
          >
            <Search size={18} aria-hidden="true" />
            <span className="mobile-action-label">
              {isPlaceSearching ? t('searching') : t('search')}
            </span>
          </motion.button>
        </form>

        <AnimatePresence initial={false}>
          {placeResults.length > 0 ? (
            <motion.ol
              {...risePresence}
              layout
              id={resultListId}
              className="place-results"
              aria-label={t('placeSearchResults')}
              role="listbox"
            >
              {placeResults.map((result, index) => (
                <motion.li
                  layout
                  key={result.id}
                  role="none"
                  transition={rowLayoutTransition}
                >
                  <motion.button
                    aria-selected={index === activePlaceResultIndex}
                    className={
                      index === activePlaceResultIndex ? 'is-active' : undefined
                    }
                    id={`place-search-result-${surface}-${index}`}
                    role="option"
                    type="button"
                    whileTap={subtleTap}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectPlace(result)}
                  >
                    <MapPin size={16} aria-hidden="true" />
                    <span>{result.name}</span>
                  </motion.button>
                </motion.li>
              ))}
            </motion.ol>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {isPlaceSearching || placeSearchMessage ? (
            <motion.div
              {...risePresence}
              key={isPlaceSearching ? 'searching' : placeSearchMessage}
              className="place-search-message"
              role="status"
            >
              {isPlaceSearching ? t('searching') : placeSearchMessage}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    );
  }

  function renderAttributionFooter(className = '') {
    return (
      <footer className={['attribution', className].filter(Boolean).join(' ')}>
        <button
          className="attribution-trigger"
          type="button"
          onClick={() => setIsAttributionModalOpen(true)}
        >
          {t('attributions')}
        </button>
        <span className="built-by-credit">
          {t('builtBy')} <a href="https://tau.gr">taugr</a>
        </span>
      </footer>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <main
        className="app-shell"
        data-directions-mode={isDirectionsMode ? 'true' : undefined}
        data-offline-area-selection={
          offlineAreaSelectionBounds ? 'true' : undefined
        }
        data-route-workspace={routeWorkspaceView ?? undefined}
        data-theme={resolvedTheme}
      >
        <section className="map-pane" aria-label={t('map')}>
          <CycleParkingMap
            locale={locale}
            points={
              isDestinationParkingMode
                ? destinationParkingState.candidates.map(({ point }) => point)
                : mapPoints
            }
            userLocation={mapUserLocation}
            referenceLocationLabel={
              locationState.status === 'located'
                ? t('currentLocation')
                : locationState.status === 'searched'
                  ? locationState.label
                  : locationState.status === 'locating'
                    ? (locationState.label ?? t('edinburghReference'))
                    : t('edinburghReference')
            }
            isReferenceCurrentLocation={locationState.status === 'located'}
            currentLocationFocusRequestId={currentLocationFocusRequestId}
            selectedPointId={
              isDestinationParkingMode
                ? destinationParkingState.selectedId
                : isRouteWorkspace
                  ? null
                  : selectedId
            }
            selectedPoint={
              isDestinationParkingMode
                ? (selectedDestinationParkingCandidate?.point ?? null)
                : isRouteWorkspace
                  ? null
                  : explicitSelectedPoint
            }
            nearestPoint={
              !isRouteWorkspace && parkingView === 'nearby'
                ? nearestPoint
                : null
            }
            rankedPoints={
              isDestinationParkingMode
                ? destinationParkingState.candidates.map(({ point }) => point)
                : !isRouteWorkspace && parkingView === 'nearby'
                  ? nearbyPoints
                  : []
            }
            parkingView={parkingView}
            savedPointKeys={[...savedKeys]}
            route={displayedRoute}
            routeWaypoints={routeWorkspaceWaypoints}
            activeRouteWaypointId={activeRouteWaypointId}
            isRouteWaypointPlacementActive={
              isRouteWorkspace && isRouteWaypointPlacementActive
            }
            routeInstructionFocusRequest={
              !isRouteWorkspace ||
              (routeWorkspaceView === 'planner' &&
                !journeyEditing &&
                !isRouteDestinationSearchMode &&
                !isRouteWaypointPlacementActive)
                ? routeInstructionFocusRequest
                : null
            }
            liveRouteMarker={liveRouteMarker}
            shouldFollowLiveRoute={liveRouteTracking.status === 'tracking'}
            isDirectionsMode={isDirectionsMode || isRouteWorkspace}
            isDestinationParkingMode={isDestinationParkingMode}
            isRouteCalculationLoading={
              routeWorkspaceView === 'planner' &&
              routePlannerStatus === 'loading'
            }
            isRoutePlanningMode={isRouteWorkspace}
            showCurrentLocationMarker={showRouteCurrentLocation}
            mobileSheetState={mobileSheetState}
            copiedShareButton={copiedShareButton}
            theme={resolvedTheme}
            canRequestDirections={isClientReady}
            canShowStreetView={googleStreetViewApiKey.length > 0}
            onClearSelection={clearSelectedParkingPoint}
            onSelectPoint={(id) => {
              if (isDestinationParkingMode) {
                setDestinationParkingState((current) =>
                  current
                    ? {
                        ...current,
                        selectedId: id,
                      }
                    : current,
                );
                return;
              }
              selectParkingPoint(id);
            }}
            onRequestDirections={(point) => {
              openJourneyToParking(point);
            }}
            onOpenStreetView={(point) => {
              setStreetViewPoint(point);
              captureAnalyticsEvent('street_view_opened', {
                parking_id: point.id,
                parking_name: point.name,
              });
            }}
            onShareParkingLink={(point) => {
              void shareParkingLinkForPoint(point, 'popup');
            }}
            onToggleSavedPoint={(point) => {
              toggleSavedPoint(point, 'popup');
            }}
            onOpenDetails={(point) => openParkingDetails(point, 'map')}
            onPlaceRouteWaypoint={placeRouteWaypoint}
            onViewportChange={loadMapDataForBounds}
            onBrowseLocation={
              isRouteWorkspace
                ? undefined
                : (location) => {
                    const manifest = parkingDataClient.current?.getManifest();
                    if (
                      manifest &&
                      isLocationInParkingCoverage(location, manifest)
                    ) {
                      cancelLocationRequest();
                      saveLastArea(location);
                    }
                  }
            }
            offlineAreaSelectionBounds={offlineAreaSelectionBounds}
            cycleNetworkFeatures={cycleNetworkFeatures}
            isCycleNetworkVisible={isCycleNetworkVisible}
          />
          {isDestinationParkingMode ? (
            <div
              className="destination-parking-map-bar"
              aria-label={t('originalDestination')}
            >
              <span className="destination-parking-map-bike" aria-hidden="true">
                <Bike size={21} />
              </span>
              <span className="destination-parking-map-copy">
                <Search size={17} aria-hidden="true" />
                <strong>
                  {destinationParkingState.originalDestination.label}
                </strong>
              </span>
              <span
                className="destination-parking-map-locate"
                aria-hidden="true"
              >
                <LocateFixed size={20} />
              </span>
            </div>
          ) : null}
          {journeyEditing &&
          routeWorkspaceView === 'planner' &&
          routeDraft &&
          routeDraft.waypoints.length > 0 &&
          !isRouteWaypointPlacementActive ? (
            <button
              className="route-destination-map-bar"
              data-testid="route-destination-map-search"
              type="button"
              onClick={() => openRouteDestinationSearch()}
            >
              <span className="route-destination-map-bike" aria-hidden="true">
                <Bike size={21} />
              </span>
              <span className="route-destination-map-copy">
                <small>{t('destination')}</small>
                <strong>
                  {routeDestinationSearch.query ||
                    (routeDraft.waypoints.length > 1
                      ? routeDraft.waypoints.at(-1)?.label
                      : t('searchDestination'))}
                </strong>
              </span>
              <span className="route-destination-map-status" aria-hidden="true">
                {routePlannerStatus === 'loading' ? (
                  <LoaderCircle className="is-spinning" size={22} />
                ) : (
                  <Search size={20} />
                )}
              </span>
            </button>
          ) : null}
          {offlineAreaSelectionBounds ? (
            <OfflineAreaSelection
              error={offlineAreaError}
              isDownloading={busyOfflineAreaId !== null}
              name={offlineAreaName}
              plan={offlineAreaPlan}
              progress={offlineAreaProgress}
              storageWarning={offlineAreaStorageWarning}
              onCancel={cancelOfflineAreaSelection}
              onDownload={downloadSelectedOfflineArea}
              onNameChange={setOfflineAreaName}
            />
          ) : null}
          {!isDirectionsMode && !isRouteWorkspace ? (
            <div className="map-layers-control">
              <motion.button
                className="map-plan-route-button"
                data-testid="map-plan-route"
                type="button"
                whileTap={subtleTap}
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  setIsMapLayersOpen(false);
                  openNewRoutePlanner('map');
                }}
              >
                <Route size={17} aria-hidden="true" />
                <span>{t(routeDraft ? 'resumeRoute' : 'planRoute')}</span>
              </motion.button>
              <motion.button
                aria-expanded={isMapLayersOpen}
                aria-label={t('mapLayers')}
                className="map-layers-trigger"
                data-testid="map-layers-trigger"
                type="button"
                whileTap={subtleTap}
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  setIsMapLayersOpen((isOpen) => !isOpen);
                }}
              >
                <Layers aria-hidden="true" size={19} strokeWidth={2.2} />
              </motion.button>
              <AnimatePresence initial={false}>
                {isMapLayersOpen ? (
                  <motion.div
                    {...popoverPresence}
                    aria-label={t('mapLayers')}
                    className="map-layers-popover"
                    data-testid="map-layers-popover"
                    role="dialog"
                  >
                    <strong>{t('mapLayers')}</strong>
                    {isCycleNetworkAvailable ? (
                      <label className="map-layers-option">
                        <span>
                          {t('nationalCycleNetwork')}
                          {cycleNetworkZoom <
                          (cycleNetworkManifest?.chunkZoom ?? 10) ? (
                            <small>{t('cycleNetworkZoomIn')}</small>
                          ) : null}
                        </span>
                        <input
                          aria-label={t('nationalCycleNetwork')}
                          checked={isCycleNetworkVisible}
                          role="switch"
                          type="checkbox"
                          onChange={(event) =>
                            setCycleNetworkVisibility(event.target.checked)
                          }
                        />
                      </label>
                    ) : null}
                    <label className="map-layers-option">
                      <span>{t('drinkingWater')}</span>
                      <input
                        aria-label={t('drinkingWater')}
                        checked={isDrinkingWaterVisible}
                        data-testid="drinking-water-layer-toggle"
                        role="switch"
                        type="checkbox"
                        onChange={(event) =>
                          setDrinkingWaterVisibility(event.target.checked)
                        }
                      />
                    </label>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </section>

        {!isDirectionsMode && !isRouteWorkspace ? (
          <section className="mobile-map-toolbar" aria-label={t('findNearby')}>
            <header
              ref={mobileHeaderRef}
              className="app-header app-header--mobile"
            >
              {renderThemeSettings('settings-menu--mobile', 'brand')}
              <h1 className="sr-only">Bike Neuks</h1>
              {renderPlaceSearchPanel('mobile')}
            </header>
          </section>
        ) : null}

        <motion.aside
          className="control-pane"
          ref={controlPaneRef}
          aria-label={t('nearestParking')}
          data-mobile-sheet-dragging={
            isMobileSheetDragging ? 'true' : undefined
          }
          data-mobile-sheet-state={mobileSheetState}
          data-content-overflow={
            (isParkingDetailsMode || isParkingFiltersMode) &&
            isMobileContentSheetOverflowing
              ? 'true'
              : undefined
          }
          data-panel-view={
            isRouteWaypointPlacementActive
              ? 'route-editing'
              : isRouteDestinationSearchMode
                ? 'route-destination-search'
                : isRouteWorkspace
                  ? routeWorkspaceView
                  : isDirectionsMode
                    ? 'directions'
                    : isParkingDetailsMode
                      ? 'details'
                      : isParkingFiltersMode
                        ? 'filters'
                        : 'list'
          }
          data-parking-view={parkingView}
          data-panel-transition={parkingPanelState.transition}
          initial={false}
          style={controlPaneStyle}
        >
          <motion.button
            aria-expanded={mobileSheetState === 'expanded'}
            aria-label={
              mobileSheetState === 'expanded'
                ? t('collapsePanel', {
                    panel: t(
                      isDirectionsMode
                        ? 'panelDirections'
                        : isParkingDetailsMode
                          ? 'panelDetails'
                          : isParkingFiltersMode
                            ? 'panelFilters'
                            : parkingView === 'saved'
                              ? 'panelSaved'
                              : 'panelResults',
                    ),
                  })
                : t('expandPanel', {
                    panel: t(
                      isDirectionsMode
                        ? 'panelDirections'
                        : isParkingDetailsMode
                          ? 'panelDetails'
                          : isParkingFiltersMode
                            ? 'panelFilters'
                            : parkingView === 'saved'
                              ? 'panelSaved'
                              : 'panelResults',
                    ),
                  })
            }
            className="mobile-sheet-grip"
            type="button"
            onClick={handleSheetGripClick}
            onPointerCancel={handleSheetGripPointerCancel}
            onPointerDown={handleSheetGripPointerDown}
            onPointerMove={handleSheetGripPointerMove}
            onPointerUp={handleSheetGripPointerEnd}
            whileTap={subtleTap}
          >
            <span aria-hidden="true" />
          </motion.button>
          <div className="panel-stack">
            <LayoutGroup>
              <AnimatePresence
                custom={panelMotionContext}
                initial={false}
                mode="popLayout"
              >
                {isRouteDestinationSearchMode ? (
                  <motion.div
                    animate="center"
                    custom={panelMotionContext}
                    exit="exit"
                    initial="enter"
                    key="route-destination-search"
                    className="route-workspace-view"
                    variants={panelMotionVariants}
                  >
                    <RouteDestinationSearch
                      onUseLocation={useJourneyLocation}
                      target={journeySearchTarget}
                      startLabel={routeDraft?.waypoints[0]?.label ?? null}
                      destinationLabel={
                        pendingJourneyDestination?.label ??
                        (routeDraft && routeDraft.waypoints.length > 1
                          ? routeDraft.waypoints.at(-1)!.label
                          : null)
                      }
                      activeResultIndex={
                        routeDestinationSearch.activeResultIndex
                      }
                      message={
                        routeDestinationSearch.message ??
                        (routePlannerStatus === 'missing-key'
                          ? t('directionsNeedKey')
                          : routePlannerStatus === 'error'
                            ? routePlannerMessage
                            : null)
                      }
                      query={routeDestinationSearch.query}
                      results={routeDestinationSearch.results}
                      routeStatus={routePlannerStatus}
                      searchStatus={routeDestinationSearch.searchStatus}
                      selectedId={routeDestinationSearch.selectedId}
                      onBack={closeRouteDestinationSearch}
                      onClear={() => updateRouteDestinationQuery('')}
                      onQueryChange={updateRouteDestinationQuery}
                      onRetry={() => {
                        if (routeDraft) {
                          void calculateRouteDraft(routeDraft);
                        }
                      }}
                      onSearch={() =>
                        void runRouteDestinationSearch(
                          routeDestinationSearch.query,
                        )
                      }
                      onSelect={selectRouteDestination}
                      onSetActiveResultIndex={(activeResultIndex) =>
                        setRouteDestinationSearch((current) => ({
                          ...current,
                          activeResultIndex,
                        }))
                      }
                    />
                  </motion.div>
                ) : isRouteWorkspace &&
                  routeWorkspaceView === 'planner' &&
                  routeDraft ? (
                  <motion.div
                    animate="center"
                    custom={panelMotionContext}
                    exit="exit"
                    initial="enter"
                    key="route-planner"
                    className="route-workspace-view"
                    variants={panelMotionVariants}
                  >
                    {!journeyEditing && !isRouteWaypointPlacementActive ? (
                      <RouteJourney
                        draft={routeDraft}
                        pendingDestination={pendingJourneyDestination}
                        routes={routePlannerRoutes}
                        status={routePlannerStatus}
                        message={routePlannerMessage}
                        trackingStatus={liveRouteTracking.status}
                        hasArrived={liveRouteProgress?.hasArrived ?? false}
                        rideGuidance={
                          activeRoute ? (
                            <RideGuidance
                              route={activeRoute}
                              progress={liveRouteProgress}
                              tracking={liveRouteTracking.status === 'tracking'}
                              rerouting={isRerouting}
                              rerouteError={rerouteError}
                              onReroute={() => void recalculateLiveRoute()}
                            />
                          ) : null
                        }
                        currentInstruction={activeRouteInstruction}
                        onInstruction={selectRouteInstruction}
                        onTrack={toggleLiveRouteTracking}
                        onNew={resetJourney}
                        onBack={closeRouteWorkspace}
                        onSearch={openRouteDestinationSearch}
                        onEdit={() => {
                          stopLiveRouteTracking();
                          setJourneyEditing(true);
                        }}
                        onSave={() => void saveRouteDraft()}
                        onLibrary={openSavedRoutes}
                        onParking={() => void openDestinationParkingChooser()}
                        onRetry={() => void calculateRouteDraft(routeDraft)}
                        onSelectPlan={(plan) => {
                          stopLiveRouteTracking();
                          setRouteDraft({ ...routeDraft, plan });
                        }}
                      />
                    ) : (
                      <RoutePlanner
                        draft={routeDraft}
                        message={routePlannerMessage}
                        placementActive={isRouteWaypointPlacementActive}
                        placementStartWaypointCount={
                          routePlacementStartWaypointCount
                        }
                        routes={routePlannerRoutes}
                        status={routePlannerStatus}
                        onAddWaypoint={addWaypointToRouteDraft}
                        onBack={() => setJourneyEditing(false)}
                        onCancelMapPlacement={cancelRouteWaypointPlacement}
                        onDoneMapPlacement={finishRouteWaypointPlacement}
                        onMoveWaypoint={(fromIndex, toIndex) =>
                          commitRouteDraft(
                            moveRouteWaypoint(routeDraft, fromIndex, toIndex),
                          )
                        }
                        onOpenDestinationParking={() =>
                          void openDestinationParkingChooser()
                        }
                        onOpenLibrary={openSavedRoutes}
                        onRemoveWaypoint={(id) =>
                          commitRouteDraft(removeRouteWaypoint(routeDraft, id))
                        }
                        onRename={(name) =>
                          setRouteDraft({ ...routeDraft, name })
                        }
                        onRequestMapPlacement={beginRouteWaypointPlacement}
                        onSave={() => void saveRouteDraft()}
                        onSelectPlan={(plan) =>
                          setRouteDraft({ ...routeDraft, plan })
                        }
                        onSwapEndpoints={() =>
                          commitRouteDraft(swapRouteEndpoints(routeDraft))
                        }
                        onUndoMapPlacement={undoRouteWaypointPlacement}
                      />
                    )}
                  </motion.div>
                ) : isDestinationParkingMode ? (
                  <motion.div
                    animate="center"
                    custom={panelMotionContext}
                    exit="exit"
                    initial="enter"
                    key="destination-parking"
                    className="route-workspace-view"
                    variants={panelMotionVariants}
                  >
                    <DestinationParkingChooser
                      candidates={destinationParkingState.candidates}
                      expanded={destinationParkingState.expanded}
                      originalDestination={
                        destinationParkingState.originalDestination
                      }
                      selectedId={destinationParkingState.selectedId}
                      status={destinationParkingState.status}
                      onBack={closeDestinationParkingChooser}
                      onConfirm={confirmDestinationParking}
                      onRestoreDestination={closeDestinationParkingChooser}
                      onSelect={(id) =>
                        setDestinationParkingState((current) =>
                          current
                            ? {
                                ...current,
                                selectedId: id,
                              }
                            : current,
                        )
                      }
                      onToggleExpanded={() =>
                        setDestinationParkingState((current) =>
                          current
                            ? {
                                ...current,
                                expanded: !current.expanded,
                              }
                            : current,
                        )
                      }
                    />
                  </motion.div>
                ) : isRouteWorkspace ? (
                  <motion.div
                    animate="center"
                    custom={panelMotionContext}
                    exit="exit"
                    initial="enter"
                    key={`saved-routes-${routeWorkspaceView}`}
                    className="route-workspace-view"
                    variants={panelMotionVariants}
                  >
                    {routeWorkspaceView === 'import' && pendingGpxImport ? (
                      <GpxImportReview
                        gpx={pendingGpxImport}
                        onAdd={(name) => void addImportedGpx(name)}
                        onBack={() => {
                          setPendingGpxImport(null);
                          setRouteWorkspaceView('library');
                        }}
                        onChooseFile={(file) => void reviewGpxFile(file)}
                      />
                    ) : (
                      <SavedRoutesPanel
                        error={savedRoutesError}
                        loading={savedRoutesStatus === 'loading'}
                        message={savedRoutesMessage}
                        routes={savedRoutes}
                        selectedRoute={
                          routeWorkspaceView === 'detail'
                            ? selectedSavedRoute
                            : null
                        }
                        onBack={() => {
                          if (routeWorkspaceView === 'detail') {
                            setSelectedSavedRoute(null);
                            setRouteWorkspaceView('library');
                          } else if (!returnToPreservedRouteDraft()) {
                            closeRouteWorkspace();
                          }
                        }}
                        onDelete={(record) => void removeSavedRoute(record)}
                        onDuplicate={(record) =>
                          void duplicateSavedRoute(record)
                        }
                        onEdit={editSavedRoute}
                        onExport={exportSavedRoute}
                        onImportFile={(file) => void reviewGpxFile(file)}
                        onNewRoute={() => {
                          if (!returnToPreservedRouteDraft()) {
                            openNewRoutePlanner('saved-routes');
                          }
                        }}
                        onRename={(record, name) =>
                          void renameSavedRoute(record, name)
                        }
                        onShareGpx={(record) => void shareSavedRouteGpx(record)}
                        onShareLink={(record) =>
                          void shareSavedRouteLink(record)
                        }
                        onSelect={(record) => {
                          setSavedRoutesError(null);
                          setSelectedSavedRoute(record);
                          setRouteWorkspaceView('detail');
                          captureAnalyticsEvent('saved_route_opened', {
                            route_kind: record.kind,
                            stop_count: record.waypoints.length,
                          });
                        }}
                      />
                    )}
                  </motion.div>
                ) : isDirectionsMode ? (
                  <motion.section
                    animate="center"
                    custom={panelMotionContext}
                    exit="exit"
                    initial="enter"
                    key="directions"
                    className="directions-mode panel-view"
                    aria-label={t('cycleDirections')}
                    variants={panelMotionVariants}
                  >
                    <motion.div
                      layout
                      className="directions-mode-header"
                      transition={rowLayoutTransition}
                    >
                      <motion.div
                        layout
                        className="directions-header-main"
                        transition={rowLayoutTransition}
                      >
                        <motion.div
                          layout
                          className="directions-title"
                          transition={rowLayoutTransition}
                        >
                          <motion.div
                            layout
                            className="brand-mark directions-mark"
                            aria-hidden="true"
                            transition={rowLayoutTransition}
                          >
                            <Route size={24} />
                          </motion.div>
                          <motion.div layout transition={rowLayoutTransition}>
                            <h1>
                              {directionsParkingPoint?.name ?? t('directions')}
                            </h1>
                            <AnimatePresence initial={false} mode="wait">
                              {directionsParkingPoint ? (
                                <motion.div
                                  {...risePresence}
                                  key="directions-parking-details"
                                >
                                  <ParkingDetailStrip
                                    className="directions-parking-details"
                                    compact
                                    details={getDirectionsParkingDetails(
                                      directionsParkingPoint,
                                      locale,
                                    )}
                                    point={directionsParkingPoint}
                                  />
                                </motion.div>
                              ) : (
                                <motion.p
                                  {...risePresence}
                                  key="directions-copy"
                                >
                                  {t('cycleRoute')}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        </motion.div>
                        <motion.div
                          layout
                          className="directions-header-actions"
                          transition={rowLayoutTransition}
                        >
                          {directionsState.status === 'loaded' ? (
                            <motion.button
                              className="directions-route-start-button"
                              disabled={liveRouteTracking.status === 'starting'}
                              type="button"
                              whileTap={subtleTap}
                              onClick={toggleLiveRouteTracking}
                            >
                              <Bike size={16} aria-hidden="true" />
                              {liveRouteTracking.status === 'tracking'
                                ? liveRouteProgress?.hasArrived
                                  ? t('done')
                                  : t('stop')
                                : liveRouteTracking.status === 'starting'
                                  ? t('starting')
                                  : t('startRoute')}
                            </motion.button>
                          ) : null}
                          <motion.button
                            className="directions-back-button"
                            type="button"
                            whileTap={subtleTap}
                            onClick={exitDirections}
                          >
                            <ChevronLeft size={17} aria-hidden="true" />
                            {t('back')}
                          </motion.button>
                        </motion.div>
                      </motion.div>
                      {activeRoute ? (
                        <RideGuidance
                          route={activeRoute}
                          progress={liveRouteProgress}
                          tracking={liveRouteTracking.status === 'tracking'}
                          rerouting={isRerouting}
                          rerouteError={rerouteError}
                          onReroute={() => void recalculateLiveRoute()}
                        />
                      ) : null}
                      {liveRouteProgress?.hasArrived ? (
                        <motion.p
                          {...directionsRevealPresence}
                          className="directions-live-status directions-live-status-arrived"
                          role="status"
                        >
                          {t('arrivedParking')}
                        </motion.p>
                      ) : null}
                      {liveRouteTracking.status === 'denied' ||
                      liveRouteTracking.status === 'too-far' ||
                      liveRouteTracking.status === 'unavailable' ? (
                        <motion.p
                          {...directionsRevealPresence}
                          className="directions-live-status"
                          role="status"
                        >
                          {liveRouteTracking.status === 'denied'
                            ? t('routeLocationPermission')
                            : liveRouteTracking.status === 'too-far'
                              ? t('routeOutsideCoverage')
                              : t('liveLocationUnavailable')}
                        </motion.p>
                      ) : null}
                      {liveRouteTracking.status === 'tracking' &&
                      !liveRouteProgress?.hasArrived &&
                      activeRouteInstruction ? (
                        <motion.div
                          {...directionsRevealPresence}
                          className="directions-current-step"
                        >
                          <span
                            className="directions-step-icon directions-current-step-icon"
                            aria-hidden="true"
                          >
                            {(() => {
                              const CurrentStepIcon = getRouteInstructionIcon(
                                activeRouteInstruction,
                              );
                              return <CurrentStepIcon size={20} />;
                            })()}
                          </span>
                          <span className="directions-current-step-text">
                            {describeCycleRouteInstruction(
                              activeRouteInstruction,
                              locale,
                            )}
                          </span>
                          <small className="directions-step-distance directions-current-step-distance">
                            {formatDistance(
                              activeRouteInstruction.distanceMeters,
                              locale,
                            )}
                          </small>
                        </motion.div>
                      ) : null}
                      <AnimatePresence initial={false}>
                        {directionsState.status === 'loaded' && activeRoute ? (
                          <motion.div
                            {...directionsRevealPresence}
                            key="directions-summary"
                            className="directions-summary"
                          >
                            <div
                              className="directions-route-options"
                              aria-label={t('routeStyle')}
                              role="group"
                            >
                              {CYCLESTREETS_ROUTE_PLANS.map((plan) => {
                                const route = directionsState.routes[plan];
                                const presentation =
                                  cycleRoutePlanPresentation[plan];
                                const isSelected =
                                  directionsState.selectedPlan === plan;
                                const [durationValue, ...durationUnitParts] =
                                  route
                                    ? formatCycleRouteDuration(
                                        route.durationSeconds,
                                        locale,
                                      ).split(/\s+/)
                                    : ['—'];
                                const durationUnit =
                                  durationUnitParts.join(' ');
                                return (
                                  <motion.button
                                    aria-pressed={isSelected}
                                    className={[
                                      'directions-route-option',
                                      isSelected
                                        ? 'directions-route-option-selected'
                                        : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                    data-testid={`route-plan-${plan}`}
                                    disabled={
                                      !route || isRoutePlanSelectionLocked
                                    }
                                    key={plan}
                                    type="button"
                                    whileTap={subtleTap}
                                    onClick={() => selectCycleRoutePlan(plan)}
                                  >
                                    <span className="directions-route-option-label">
                                      {t(presentation.labelKey)}
                                    </span>
                                    <span className="directions-route-option-duration">
                                      <strong>{durationValue}</strong>
                                      {durationUnit ? (
                                        <>
                                          {' '}
                                          <span className="directions-route-option-duration-unit">
                                            {durationUnit}
                                          </span>
                                        </>
                                      ) : null}
                                    </span>
                                    <small>
                                      {route
                                        ? formatDistance(
                                            route.distanceMeters,
                                            locale,
                                          )
                                        : t('routeUnavailable')}
                                    </small>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.div>

                    <div className="directions-scroll">
                      <AnimatePresence initial={false} mode="wait">
                        {directionsState.status === 'loading' ? (
                          <motion.p
                            {...risePresence}
                            key="directions-loading"
                            className="directions-message"
                          >
                            {t('findingRoute')}
                          </motion.p>
                        ) : null}

                        {directionsState.status === 'missing-key' ? (
                          <motion.p
                            {...risePresence}
                            key="directions-missing-key"
                            className="directions-message"
                          >
                            {t('directionsNeedKey')}
                          </motion.p>
                        ) : null}

                        {directionsState.status === 'error' ? (
                          <motion.p
                            {...risePresence}
                            key="directions-error"
                            className="directions-message"
                          >
                            {directionsState.message}
                          </motion.p>
                        ) : null}
                      </AnimatePresence>

                      {directionsState.status === 'loaded' && activeRoute ? (
                        <motion.div
                          animate="animate"
                          initial="initial"
                          key="directions-loaded"
                          className="directions-route-content"
                          variants={routeContentVariants}
                        >
                          {activeRoute.instructions.length > 0 ? (
                            <motion.ol
                              layout="position"
                              className="directions-list"
                              data-testid="directions-list"
                              transition={rowLayoutTransition}
                            >
                              {activeRoute.instructions.map((instruction) => {
                                const StepIcon =
                                  getRouteInstructionIcon(instruction);
                                const isActiveInstruction =
                                  activeInstruction?.id === instruction.id;
                                const isLiveActiveInstruction =
                                  liveRouteTracking.status === 'tracking' &&
                                  isActiveInstruction;
                                return (
                                  <motion.li
                                    layout="position"
                                    key={instruction.id}
                                    className={[
                                      'directions-list-item',
                                      isActiveInstruction
                                        ? 'directions-list-item-active'
                                        : '',
                                      isLiveActiveInstruction
                                        ? 'directions-list-item-live-active'
                                        : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                    onClick={() =>
                                      selectRouteInstruction(instruction.id)
                                    }
                                    data-testid={`directions-step-${instruction.id}`}
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === 'Enter' ||
                                        event.key === ' '
                                      ) {
                                        event.preventDefault();
                                        selectRouteInstruction(instruction.id);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    transition={rowLayoutTransition}
                                    variants={routeStepVariants}
                                  >
                                    <span
                                      className="directions-step-icon"
                                      aria-hidden="true"
                                    >
                                      <StepIcon size={18} />
                                    </span>
                                    <span className="directions-step-text">
                                      {describeCycleRouteInstruction(
                                        instruction,
                                        locale,
                                      )}
                                    </span>
                                    <small className="directions-step-distance">
                                      {formatDistance(
                                        instruction.distanceMeters,
                                        locale,
                                      )}
                                    </small>
                                  </motion.li>
                                );
                              })}
                            </motion.ol>
                          ) : null}
                          {activeRoute.source === 'cyclestreets' ? (
                            <motion.p
                              {...risePresence}
                              key="directions-attribution"
                              className="directions-attribution"
                            >
                              <Bike
                                key="directions-attribution-icon"
                                size={18}
                                aria-hidden="true"
                              />
                              <span key="directions-attribution-label">
                                {t('routeBy')}
                              </span>
                              <a
                                key="directions-attribution-link"
                                href={
                                  activeRoute.routeUrl ??
                                  'https://www.cyclestreets.net/'
                                }
                              >
                                CycleStreets
                                <ExternalLink size={16} aria-hidden="true" />
                              </a>
                            </motion.p>
                          ) : null}
                        </motion.div>
                      ) : null}
                    </div>
                    {renderAttributionFooter('directions-footer')}
                  </motion.section>
                ) : isParkingDetailsMode && explicitSelectedPoint ? (
                  <motion.section
                    animate="center"
                    aria-label={t('details')}
                    className="parking-detail-view panel-view"
                    custom={panelMotionContext}
                    exit="exit"
                    initial="enter"
                    key={`parking-details-${explicitSelectedPoint.id}`}
                    variants={panelMotionVariants}
                  >
                    <div
                      className="mobile-sheet-summary mobile-sheet-summary--details"
                      aria-hidden="true"
                    >
                      <strong className="mobile-sheet-summary-location">
                        {explicitSelectedPoint.name}
                      </strong>
                      {explicitSelectedPointDetails?.metrics[0] ? (
                        <small>
                          {explicitSelectedPointDetails.metrics[0].value}
                        </small>
                      ) : null}
                    </div>

                    <div
                      className="mobile-sheet-body parking-detail-body"
                      data-parking-detail-id={explicitSelectedPoint.id}
                    >
                      <div className="parking-details-toolbar">
                        <motion.button
                          className="parking-details-back"
                          type="button"
                          whileTap={subtleTap}
                          onClick={closeParkingDetails}
                        >
                          <ChevronLeft size={17} aria-hidden="true" />
                          {t(
                            parkingView === 'saved'
                              ? 'backToMyNeuks'
                              : 'backToNearbyNeuks',
                          )}
                        </motion.button>
                        <div
                          className="parking-details-utilities"
                          aria-label={t('moreActions', {
                            name: explicitSelectedPoint.name,
                          })}
                        >
                          <motion.button
                            aria-label={t(
                              savedIds.has(explicitSelectedPoint.id)
                                ? 'removeFromMyNeuks'
                                : 'saveToMyNeuks',
                              { name: explicitSelectedPoint.name },
                            )}
                            aria-pressed={savedIds.has(
                              explicitSelectedPoint.id,
                            )}
                            className="parking-detail-utility"
                            data-testid="parking-detail-save"
                            type="button"
                            whileTap={subtleTap}
                            onClick={() =>
                              toggleSavedPoint(explicitSelectedPoint, 'details')
                            }
                          >
                            <Bookmark
                              fill={
                                savedIds.has(explicitSelectedPoint.id)
                                  ? 'currentColor'
                                  : 'none'
                              }
                              size={21}
                              aria-hidden="true"
                            />
                          </motion.button>
                          <motion.button
                            aria-label={t('shareLink', {
                              name: explicitSelectedPoint.name,
                            })}
                            className="parking-detail-utility"
                            data-testid="parking-detail-share"
                            type="button"
                            whileTap={subtleTap}
                            onClick={() => {
                              void shareParkingLinkForPoint(
                                explicitSelectedPoint,
                                'details',
                              );
                            }}
                          >
                            <Share2 size={21} aria-hidden="true" />
                            {copiedShareButton?.source === 'details' &&
                            copiedShareButton.parkingId ===
                              explicitSelectedPoint.id ? (
                              <span
                                className="parking-share-tooltip"
                                role="status"
                              >
                                {t('copied')}
                              </span>
                            ) : null}
                          </motion.button>
                        </div>
                      </div>

                      <header className="parking-details-header">
                        <h1>{explicitSelectedPoint.name}</h1>
                        {explicitSelectedPointDetails?.metrics[0] ? (
                          <span>
                            {explicitSelectedPointDetails.metrics[0].value}
                          </span>
                        ) : null}
                      </header>

                      <div
                        className={[
                          'parking-detail-overview',
                          googleStreetViewApiKey.length === 0
                            ? 'parking-detail-overview--facts-only'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <ParkingDetailStrip
                          className="parking-detail-facts"
                          point={explicitSelectedPoint}
                          showAllDetails
                        />
                        {googleStreetViewApiKey.length > 0 ? (
                          <div className="parking-detail-street-view">
                            <iframe
                              aria-hidden="true"
                              className="parking-detail-street-view-frame"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                              src={buildGoogleStreetViewEmbedUrl(
                                explicitSelectedPoint,
                                googleStreetViewApiKey,
                              )}
                              tabIndex={-1}
                              title={t('streetViewFor', {
                                name: explicitSelectedPoint.name,
                              })}
                            />
                            <motion.button
                              aria-label={t('openStreetView', {
                                name: explicitSelectedPoint.name,
                              })}
                              className="parking-detail-street-view-trigger"
                              data-testid="parking-detail-street-view"
                              type="button"
                              whileTap={subtleTap}
                              onClick={() => {
                                setStreetViewPoint(explicitSelectedPoint);
                                captureAnalyticsEvent('street_view_opened', {
                                  parking_id: explicitSelectedPoint.id,
                                  parking_name: explicitSelectedPoint.name,
                                  source: 'details_preview',
                                });
                              }}
                            >
                              <span className="parking-detail-street-view-expand">
                                <Maximize2
                                  aria-hidden="true"
                                  data-testid="parking-detail-street-view-expand-icon"
                                  size={17}
                                />
                              </span>
                            </motion.button>
                          </div>
                        ) : null}
                      </div>

                      <AnimatePresence initial={false}>
                        {parkingDetailMessage ? (
                          <motion.div
                            {...risePresence}
                            className="parking-share-message parking-detail-message"
                            key={parkingDetailMessage}
                            role="status"
                          >
                            {parkingDetailMessage}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      {parkingDetailAnnouncement ? (
                        <span className="sr-only" role="status">
                          {parkingDetailAnnouncement}
                        </span>
                      ) : null}

                      <div
                        className="parking-detail-actions"
                        aria-label={t('moreActions', {
                          name: explicitSelectedPoint.name,
                        })}
                      >
                        <motion.a
                          aria-label={t('openInGoogleMaps', {
                            name: explicitSelectedPoint.name,
                          })}
                          className="parking-detail-action parking-detail-action--external"
                          data-testid="parking-detail-google-maps"
                          href={buildGoogleMapsLocationUrl(
                            explicitSelectedPoint,
                          )}
                          rel="noreferrer"
                          target="_blank"
                          whileTap={subtleTap}
                          onClick={() => {
                            captureAnalyticsEvent('google_maps_opened', {
                              parking_id: explicitSelectedPoint.id,
                              parking_name: explicitSelectedPoint.name,
                              source: 'details',
                            });
                          }}
                        >
                          <span className="parking-detail-action-icon">
                            <ExternalLink size={19} aria-hidden="true" />
                          </span>
                          <span className="parking-detail-action-label">
                            {t('googleMaps')}
                          </span>
                        </motion.a>
                        <motion.button
                          className="parking-detail-action parking-detail-action--primary"
                          data-testid="parking-detail-directions"
                          disabled={!isClientReady}
                          type="button"
                          whileTap={subtleTap}
                          onClick={() => {
                            openJourneyToParking(explicitSelectedPoint);
                          }}
                        >
                          <span className="parking-detail-action-icon">
                            <Navigation size={19} aria-hidden="true" />
                          </span>
                          <span className="parking-detail-action-label">
                            {t('directions')}
                          </span>
                        </motion.button>
                      </div>
                    </div>
                  </motion.section>
                ) : (
                  <motion.div
                    animate="center"
                    aria-hidden={isParkingFiltersMode ? true : undefined}
                    custom={panelMotionContext}
                    exit="exit"
                    initial="enter"
                    inert={isParkingFiltersMode ? true : undefined}
                    key="finder"
                    className="finder-panel-content panel-view"
                    variants={panelMotionVariants}
                  >
                    <header
                      className="app-header app-header--desktop"
                      key="finder-header"
                    >
                      <div className="brand-mark" aria-hidden="true">
                        <img src="favicon.svg?v=white-pin-1" alt="" />
                      </div>
                      <div>
                        <h1>Bike Neuks</h1>
                        <p>
                          {t('spotsAcrossCoverage', {
                            count: formattedParkingLocationCount,
                          })}
                        </p>
                      </div>
                      {renderThemeSettings('settings-menu--desktop')}
                    </header>

                    <div className="mobile-sheet-summary" aria-hidden="true">
                      <span>
                        <strong>
                          {t(
                            parkingView === 'saved'
                              ? 'myNeuks'
                              : 'nearbyBikeNeuks',
                          )}
                        </strong>
                        <small>
                          {t(
                            parkingView === 'saved'
                              ? 'savedCount'
                              : 'closestCount',
                            {
                              count:
                                parkingView === 'saved'
                                  ? savedNeuks.length
                                  : closestPoints.length,
                            },
                          )}
                        </small>
                      </span>
                      <span className="mobile-sheet-summary-location">
                        {parkingView === 'saved'
                          ? explicitSelectedPoint?.name
                          : nearestPoint?.name}
                      </span>
                    </div>

                    <div className="mobile-sheet-body">
                      <AnimatePresence
                        custom={parkingViewDirection}
                        initial={false}
                        mode="popLayout"
                      >
                        <motion.div
                          animate="center"
                          className="parking-view-content"
                          custom={parkingViewDirection}
                          data-parking-view={parkingView}
                          exit="exit"
                          initial="enter"
                          key={`parking-view-${parkingView}`}
                          onAnimationComplete={() => {
                            const scrollContainer = parkingListScroll.current;
                            if (
                              scrollContainer?.closest<HTMLElement>(
                                '.parking-view-content',
                              )?.dataset.parkingView === parkingView
                            ) {
                              scrollContainer.scrollTop =
                                parkingViewState.current[parkingView].scrollTop;
                            }
                          }}
                          transition={parkingViewSlideTransition}
                          variants={parkingViewSlideVariants}
                        >
                          {parkingView === 'nearby'
                            ? renderPlaceSearchPanel('desktop')
                            : null}

                          <div className="list-heading list-heading-actions">
                            <h2
                              ref={savedHeadingRef}
                              tabIndex={
                                parkingView === 'saved' ? -1 : undefined
                              }
                            >
                              {t(
                                parkingView === 'saved'
                                  ? 'myNeuks'
                                  : 'nearbyBikeNeuks',
                              )}{' '}
                              <span className="list-heading-count">
                                <span
                                  aria-hidden="true"
                                  className="list-heading-separator"
                                >
                                  ·{' '}
                                </span>
                                {t(
                                  parkingView === 'saved'
                                    ? 'savedCount'
                                    : 'closestCount',
                                  {
                                    count:
                                      parkingView === 'saved'
                                        ? savedNeuks.length
                                        : closestPoints.length,
                                  },
                                )}
                              </span>
                            </h2>
                            {parkingView === 'saved' ? (
                              <motion.button
                                className="parking-view-button"
                                type="button"
                                whileTap={subtleTap}
                                onClick={showNearby}
                              >
                                <ChevronLeft size={14} aria-hidden="true" />
                                {t('showNearby')}
                              </motion.button>
                            ) : (
                              <motion.button
                                className="parking-view-button"
                                data-testid="open-my-neuks"
                                disabled={savedNeuksStatus === 'loading'}
                                type="button"
                                whileTap={subtleTap}
                                onClick={openMyNeuks}
                              >
                                <Bookmark
                                  size={14}
                                  fill={
                                    savedNeuks.length > 0
                                      ? 'currentColor'
                                      : 'none'
                                  }
                                  aria-hidden="true"
                                />
                                <span>
                                  {t('myNeuks')} {savedNeuks.length}
                                </span>
                                <ChevronRight size={14} aria-hidden="true" />
                              </motion.button>
                            )}
                          </div>

                          {parkingView === 'nearby' ? (
                            <div
                              className="parking-discovery-toolbar"
                              data-testid="parking-discovery-toolbar"
                            >
                              <div
                                aria-label={t('filterNearbyNeuks')}
                                className="category-chips"
                                data-testid="category-chips"
                                ref={categoryChipsRef}
                                role="group"
                              >
                                {discoverCategories.map(
                                  ({ icon: Icon, id, labelKey }) =>
                                    id === 'parking' &&
                                    discoverCategory === 'parking' ? (
                                      <div
                                        className="category-chip-combo"
                                        data-active="true"
                                        key={id}
                                      >
                                        <motion.button
                                          aria-pressed="true"
                                          className="category-chip category-chip--combo"
                                          data-active="true"
                                          data-testid={`category-chip-${id}`}
                                          type="button"
                                          whileTap={subtleTap}
                                          onClick={() =>
                                            selectDiscoverCategory(id)
                                          }
                                        >
                                          <Icon size={15} aria-hidden="true" />
                                          {t(labelKey)}
                                        </motion.button>
                                        <button
                                          aria-label={
                                            parkingFiltersActive
                                              ? t('parkingFiltersActiveCount', {
                                                  count:
                                                    activeParkingFilterCount,
                                                })
                                              : t('parkingFilters')
                                          }
                                          className="parking-filters-button parking-filters-button--combo"
                                          data-active={
                                            parkingFiltersActive
                                              ? 'true'
                                              : undefined
                                          }
                                          data-testid="open-parking-filters"
                                          ref={parkingFiltersButtonRef}
                                          title={t('parkingFilters')}
                                          type="button"
                                          onClick={openParkingFilters}
                                        >
                                          <SlidersHorizontal
                                            size={17}
                                            aria-hidden="true"
                                          />
                                          {activeParkingFilterCount > 0 ? (
                                            <span
                                              aria-hidden="true"
                                              className="parking-filter-count"
                                            >
                                              {activeParkingFilterCount}
                                            </span>
                                          ) : null}
                                        </button>
                                      </div>
                                    ) : (
                                      <motion.button
                                        aria-pressed={discoverCategory === id}
                                        className="category-chip"
                                        data-active={
                                          discoverCategory === id
                                            ? 'true'
                                            : undefined
                                        }
                                        data-testid={`category-chip-${id}`}
                                        key={id}
                                        type="button"
                                        whileTap={subtleTap}
                                        onClick={() =>
                                          selectDiscoverCategory(id)
                                        }
                                      >
                                        <Icon size={15} aria-hidden="true" />
                                        {t(labelKey)}
                                      </motion.button>
                                    ),
                                )}
                              </div>
                            </div>
                          ) : null}

                          <AnimatePresence initial={false}>
                            {shareError || savedNeuksMessage ? (
                              <motion.div
                                {...risePresence}
                                key={shareError ?? savedNeuksMessage}
                                className="parking-share-message"
                                role="status"
                              >
                                {shareError ?? savedNeuksMessage}
                              </motion.div>
                            ) : null}
                          </AnimatePresence>

                          <div
                            className="parking-list-scroll"
                            onPointerDown={() => {
                              restoringParkingViewScroll.current = null;
                            }}
                            onWheel={() => {
                              restoringParkingViewScroll.current = null;
                            }}
                            ref={parkingListScroll}
                          >
                            <AnimatePresence initial={false} mode="popLayout">
                              {parkingView === 'nearby' &&
                              (discoverCategory === 'parking'
                                ? parkingDataMessage
                                : cyclingPoiDataMessage) ? (
                                <motion.div
                                  {...risePresence}
                                  key={
                                    discoverCategory === 'parking'
                                      ? parkingDataMessage
                                      : cyclingPoiDataMessage
                                  }
                                  className="parking-list-context"
                                  role="status"
                                >
                                  {discoverCategory === 'parking'
                                    ? parkingDataMessage
                                    : cyclingPoiDataMessage}
                                  {discoverCategory === 'parking' &&
                                  parkingDataStatus === 'error' ? (
                                    <button
                                      className="parking-retry-button"
                                      type="button"
                                      onClick={() => void retryParkingData()}
                                    >
                                      {t('retry')}
                                    </button>
                                  ) : null}
                                </motion.div>
                              ) : null}
                              {parkingView === 'nearby' &&
                              locationState.status === 'too-far' ? (
                                <motion.div
                                  {...risePresence}
                                  key="too-far"
                                  className="parking-list-context"
                                  role="status"
                                >
                                  {t('outsideCoverage')}
                                </motion.div>
                              ) : null}
                            </AnimatePresence>

                            {parkingView === 'saved' && isSavedPointsLoading ? (
                              <div
                                className="parking-list-context"
                                role="status"
                              >
                                {t('loadingSavedNeuks')}
                              </div>
                            ) : null}

                            {parkingView === 'saved' &&
                            !isSavedPointsLoading &&
                            failedSavedIds.length > 0 ? (
                              <div
                                className="parking-list-context"
                                role="status"
                              >
                                {t('savedLoadError')}
                                <button
                                  className="parking-retry-button"
                                  type="button"
                                  onClick={() =>
                                    setSavedPointsLoadRequestId((id) => id + 1)
                                  }
                                >
                                  {t('retry')}
                                </button>
                              </div>
                            ) : null}

                            {parkingView === 'saved' &&
                            !isSavedPointsLoading &&
                            savedNeuks.length === 0 ? (
                              <section className="saved-neuks-empty">
                                <Bookmark size={24} aria-hidden="true" />
                                <h3>{t('noSavedNeuks')}</h3>
                                <button type="button" onClick={showNearby}>
                                  {t('showNearby')}
                                </button>
                              </section>
                            ) : null}

                            {parkingView === 'saved' ||
                            (discoverCategory === 'parking'
                              ? parkingDataStatus === 'ready'
                              : cyclingPoiDataStatus === 'ready') ? (
                              <motion.ol
                                className="parking-list"
                                data-testid="parking-list"
                                aria-label={t(
                                  parkingView === 'saved'
                                    ? 'myNeuks'
                                    : 'nearbyBikeNeuks',
                                )}
                              >
                                {activeListPoints.map((point, index) => {
                                  const isActive =
                                    point.id === explicitSelectedPoint?.id;
                                  const isSaved = isNeukSaved(
                                    savedNeuks,
                                    point,
                                  );
                                  const website = isActive
                                    ? getCyclingPoiWebsite(point)
                                    : null;
                                  const openingHoursLines =
                                    isCyclingPoiPoint(point) &&
                                    typeof point.properties.openingHours ===
                                      'string'
                                      ? formatOpeningHoursLines(
                                          point.properties.openingHours,
                                          locale,
                                        )
                                      : [];
                                  const cyclingServices = isCyclingPoiPoint(
                                    point,
                                  )
                                    ? getCyclingPoiServices(point).filter(
                                        (service) =>
                                          parkingView !== 'nearby' ||
                                          discoverCategory !== 'repair' ||
                                          service !== 'repair',
                                      )
                                    : [];
                                  const filterEvaluation =
                                    parkingView === 'nearby' &&
                                    discoverCategory === 'parking'
                                      ? evaluateParkingFilters(
                                          point,
                                          parkingFilters,
                                        )
                                      : null;
                                  const isBestParkingMatch =
                                    parkingSortMode === 'best-match' &&
                                    parkingFiltersActive &&
                                    index === 0 &&
                                    filterEvaluation?.unknownCount === 0;
                                  const isUncertainParkingMatch =
                                    filterEvaluation !== null &&
                                    filterEvaluation.unknownCount > 0;
                                  return [
                                    index === uncertainParkingResultIndex ? (
                                      <li
                                        className="parking-filter-boundary"
                                        data-testid="parking-filter-boundary"
                                        key={`${getPointSavedNeukKey(point)}-filter-boundary`}
                                        role="separator"
                                      >
                                        <span>
                                          {t(
                                            index === 0
                                              ? 'noConfirmedMatchesShowingNearby'
                                              : 'moreNearbyDetailsUnknown',
                                          )}
                                        </span>
                                      </li>
                                    ) : null,
                                    <motion.li
                                      key={getPointSavedNeukKey(point)}
                                      className={[
                                        'parking-list-item',
                                        parkingView === 'saved'
                                          ? 'saved-list-item'
                                          : null,
                                        isUncertainParkingMatch
                                          ? 'parking-list-item--uncertain'
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      transition={rowLayoutTransition}
                                      ref={(item) => {
                                        if (item) {
                                          parkingListItemRefs.current.set(
                                            point.id,
                                            item,
                                          );
                                        } else {
                                          parkingListItemRefs.current.delete(
                                            point.id,
                                          );
                                        }
                                      }}
                                    >
                                      <motion.div
                                        className={[
                                          'parking-row',
                                          parkingView === 'saved'
                                            ? 'saved-parking-row'
                                            : null,
                                          parkingView === 'nearby' &&
                                          index === 0
                                            ? 'closest'
                                            : null,
                                          point.id === explicitSelectedPoint?.id
                                            ? 'selected'
                                            : null,
                                        ]
                                          .filter(Boolean)
                                          .join(' ')}
                                        data-testid={`parking-row-${point.id}`}
                                      >
                                        <motion.button
                                          aria-label={point.name}
                                          aria-pressed={isActive}
                                          className="parking-row-selection"
                                          type="button"
                                          whileTap={subtleTap}
                                          onClick={() =>
                                            selectParkingPoint(point.id)
                                          }
                                        />
                                        {parkingView === 'nearby' ? (
                                          <span
                                            className={`rank rank-${index + 1}`}
                                          >
                                            {index + 1}
                                          </span>
                                        ) : null}
                                        <span className="parking-row-copy">
                                          <span className="saved-neuk-title-row">
                                            <strong>{point.name}</strong>
                                            {isBestParkingMatch ? (
                                              <span className="parking-best-match">
                                                <Sparkles
                                                  size={11}
                                                  aria-hidden="true"
                                                />
                                                {t('bestMatch')}
                                              </span>
                                            ) : null}
                                            {parkingView === 'saved' ? (
                                              <span className="saved-neuk-kind">
                                                {t(
                                                  getPointCategoryLabelKey(
                                                    point,
                                                  ),
                                                )}
                                              </span>
                                            ) : null}
                                          </span>
                                          {!isCyclingPoiPoint(point) ? (
                                            <ParkingDetailStrip
                                              includeDistance
                                              point={point}
                                            />
                                          ) : (
                                            <span className="cycling-poi-row-meta">
                                              <span className="cycling-poi-meta-item">
                                                <MapPin
                                                  size={13}
                                                  aria-hidden="true"
                                                />
                                                {formatDistance(
                                                  point.distanceMeters ?? 0,
                                                  locale,
                                                )}
                                              </span>
                                              {openingHoursLines.length ===
                                              1 ? (
                                                <span className="cycling-poi-meta-item cycling-poi-opening-hours-inline">
                                                  <Clock
                                                    size={13}
                                                    aria-hidden="true"
                                                  />
                                                  <span>
                                                    {openingHoursLines[0]}
                                                  </span>
                                                </span>
                                              ) : openingHoursLines.length >
                                                1 ? (
                                                <span className="cycling-poi-opening-hours-block">
                                                  <Clock
                                                    size={13}
                                                    aria-hidden="true"
                                                  />
                                                  <span className="cycling-poi-opening-hours-lines">
                                                    {openingHoursLines.map(
                                                      (line) => (
                                                        <span key={line}>
                                                          {line}
                                                        </span>
                                                      ),
                                                    )}
                                                  </span>
                                                </span>
                                              ) : null}
                                              {cyclingServices.length > 0 ? (
                                                <span
                                                  className="cycling-poi-services"
                                                  data-testid={`cycling-poi-services-${point.id}`}
                                                >
                                                  {cyclingServices.map(
                                                    (service, serviceIndex) => {
                                                      const {
                                                        icon: ServiceIcon,
                                                        labelKey,
                                                      } =
                                                        cyclingPoiServicePresentation[
                                                          service
                                                        ];

                                                      return (
                                                        <Fragment key={service}>
                                                          {serviceIndex > 0 ? (
                                                            <span
                                                              aria-hidden="true"
                                                              className="cycling-poi-service-separator"
                                                            >
                                                              ·
                                                            </span>
                                                          ) : null}
                                                          <span className="cycling-poi-service">
                                                            <ServiceIcon
                                                              size={13}
                                                              strokeWidth={2}
                                                              aria-hidden="true"
                                                            />
                                                            <span>
                                                              {t(labelKey)}
                                                            </span>
                                                          </span>
                                                        </Fragment>
                                                      );
                                                    },
                                                  )}
                                                </span>
                                              ) : null}
                                              {website ? (
                                                <a
                                                  aria-label={t(
                                                    'visitWebsite',
                                                    {
                                                      name: point.name,
                                                    },
                                                  )}
                                                  className="parking-list-website"
                                                  data-testid={`parking-website-${point.id}`}
                                                  href={website}
                                                  rel="noopener noreferrer"
                                                  target="_blank"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    captureAnalyticsEvent(
                                                      'cycling_place_website_opened',
                                                      {
                                                        category:
                                                          point.categories.join(
                                                            ',',
                                                          ),
                                                        point_id: point.id,
                                                        source: 'list',
                                                      },
                                                    );
                                                  }}
                                                >
                                                  <Globe2
                                                    size={14}
                                                    aria-hidden="true"
                                                  />
                                                  <span>{t('website')}</span>
                                                  <ExternalLink
                                                    size={12}
                                                    aria-hidden="true"
                                                  />
                                                </a>
                                              ) : null}
                                            </span>
                                          )}
                                        </span>
                                        {parkingView === 'nearby' &&
                                        isSaved &&
                                        !isActive ? (
                                          <span
                                            className="parking-saved-indicator"
                                            data-testid={`parking-saved-status-${point.id}`}
                                          >
                                            <Bookmark
                                              size={16}
                                              fill="currentColor"
                                              aria-hidden="true"
                                            />
                                            <span className="sr-only">
                                              {t('savedMarker')}
                                            </span>
                                          </span>
                                        ) : null}
                                      </motion.div>
                                      {isActive ? (
                                        <motion.div
                                          className="parking-list-actions"
                                          data-testid={`parking-actions-${point.id}`}
                                        >
                                          {!isCyclingPoiPoint(point) ? (
                                            <motion.button
                                              aria-label={t(
                                                'viewParkingDetails',
                                                {
                                                  name: point.name,
                                                },
                                              )}
                                              className="parking-details-button"
                                              data-testid={`parking-details-${point.id}`}
                                              type="button"
                                              whileTap={subtleTap}
                                              onClick={() =>
                                                openParkingDetails(
                                                  point,
                                                  'list',
                                                )
                                              }
                                            >
                                              <span>{t('viewDetails')}</span>
                                              <ChevronRight
                                                size={17}
                                                aria-hidden="true"
                                              />
                                            </motion.button>
                                          ) : null}
                                          {isCyclingPoiPoint(point) ? (
                                            <motion.button
                                              aria-label={t(
                                                isSaved
                                                  ? 'removeFromMyNeuks'
                                                  : 'saveToMyNeuks',
                                                { name: point.name },
                                              )}
                                              aria-pressed={isSaved}
                                              className="parking-save-button parking-list-save-button"
                                              data-testid={`parking-save-${point.id}`}
                                              type="button"
                                              whileTap={subtleTap}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                toggleSavedPoint(point, 'list');
                                              }}
                                            >
                                              <Bookmark
                                                size={17}
                                                fill={
                                                  isSaved
                                                    ? 'currentColor'
                                                    : 'none'
                                                }
                                                aria-hidden="true"
                                              />
                                              <span>
                                                {t(isSaved ? 'saved' : 'save')}
                                              </span>
                                            </motion.button>
                                          ) : null}
                                          <motion.button
                                            aria-label={t('showDirections', {
                                              name: point.name,
                                            })}
                                            className="parking-directions-button"
                                            data-testid={`parking-directions-${point.id}`}
                                            disabled={!isClientReady}
                                            type="button"
                                            whileTap={subtleTap}
                                            onClick={(event) => {
                                              void requestDirections(
                                                event,
                                                point,
                                              );
                                            }}
                                          >
                                            <Navigation
                                              size={17}
                                              aria-hidden="true"
                                            />
                                            <span className="parking-directions-label">
                                              {t('directions')}
                                            </span>
                                          </motion.button>
                                          {!isCyclingPoiPoint(point) ? (
                                            <div className="parking-more-menu-shell">
                                              <motion.button
                                                ref={parkingMoreButtonRef}
                                                aria-expanded={
                                                  openParkingMoreMenuId ===
                                                  point.id
                                                }
                                                aria-haspopup="menu"
                                                aria-label={t('moreActions', {
                                                  name: point.name,
                                                })}
                                                className="parking-more-button"
                                                data-testid={`parking-more-${point.id}`}
                                                type="button"
                                                whileTap={subtleTap}
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  if (
                                                    openParkingMoreMenuId ===
                                                    point.id
                                                  ) {
                                                    setOpenParkingMoreMenuId(
                                                      null,
                                                    );
                                                    return;
                                                  }

                                                  const buttonBounds =
                                                    event.currentTarget.getBoundingClientRect();
                                                  const opensAbove =
                                                    buttonBounds.top >= 116;
                                                  setParkingMoreMenuPosition({
                                                    right: Math.max(
                                                      12,
                                                      window.innerWidth -
                                                        buttonBounds.right,
                                                    ),
                                                    ...(opensAbove
                                                      ? {
                                                          bottom:
                                                            window.innerHeight -
                                                            buttonBounds.top +
                                                            6,
                                                        }
                                                      : {
                                                          top:
                                                            buttonBounds.bottom +
                                                            6,
                                                        }),
                                                  });
                                                  setOpenParkingMoreMenuId(
                                                    point.id,
                                                  );
                                                }}
                                              >
                                                <EllipsisVertical
                                                  size={20}
                                                  aria-hidden="true"
                                                />
                                              </motion.button>
                                              {openParkingMoreMenuId ===
                                                point.id &&
                                              parkingMoreMenuPosition &&
                                              typeof document !== 'undefined'
                                                ? createPortal(
                                                    <motion.div
                                                      ref={parkingMoreMenuRef}
                                                      {...risePresence}
                                                      className="parking-more-menu"
                                                      data-testid={`parking-more-menu-${point.id}`}
                                                      role="menu"
                                                      style={
                                                        parkingMoreMenuPosition
                                                      }
                                                    >
                                                      <motion.button
                                                        aria-label={t(
                                                          isSaved
                                                            ? 'removeFromMyNeuks'
                                                            : 'saveToMyNeuks',
                                                          {
                                                            name: point.name,
                                                          },
                                                        )}
                                                        className="parking-more-menu-item parking-save-button"
                                                        data-testid={`parking-save-${point.id}`}
                                                        role="menuitem"
                                                        type="button"
                                                        whileTap={subtleTap}
                                                        onClick={(event) => {
                                                          event.stopPropagation();
                                                          setOpenParkingMoreMenuId(
                                                            null,
                                                          );
                                                          toggleSavedPoint(
                                                            point,
                                                            'list',
                                                          );
                                                        }}
                                                      >
                                                        <Bookmark
                                                          size={17}
                                                          fill={
                                                            isSaved
                                                              ? 'currentColor'
                                                              : 'none'
                                                          }
                                                          aria-hidden="true"
                                                        />
                                                        {t(
                                                          isSaved
                                                            ? 'removeFromMyNeuksShort'
                                                            : 'saveToMyNeuksShort',
                                                        )}
                                                      </motion.button>
                                                      <motion.button
                                                        aria-label={t(
                                                          'shareLink',
                                                          {
                                                            name: point.name,
                                                          },
                                                        )}
                                                        className="parking-more-menu-item parking-share-button"
                                                        role="menuitem"
                                                        type="button"
                                                        whileTap={subtleTap}
                                                        onClick={(event) => {
                                                          void shareParkingLinkFromList(
                                                            event,
                                                            point,
                                                          );
                                                        }}
                                                      >
                                                        <Share2
                                                          size={17}
                                                          aria-hidden="true"
                                                        />
                                                        {t('share')}
                                                        {copiedShareButton?.source ===
                                                          'list' &&
                                                        copiedShareButton.parkingId ===
                                                          point.id ? (
                                                          <span
                                                            className="parking-share-tooltip"
                                                            role="status"
                                                          >
                                                            {t('copied')}
                                                          </span>
                                                        ) : null}
                                                      </motion.button>
                                                    </motion.div>,
                                                    document.body,
                                                  )
                                                : null}
                                            </div>
                                          ) : null}
                                        </motion.div>
                                      ) : null}
                                    </motion.li>,
                                  ];
                                })}
                                {parkingView === 'saved'
                                  ? missingSavedRecords.map((record) => (
                                      <motion.li
                                        className="parking-list-item saved-list-item saved-list-item-missing"
                                        key={record.key}
                                        layout="position"
                                      >
                                        <div className="parking-row saved-parking-row">
                                          <span className="parking-row-copy">
                                            <span className="saved-neuk-title-row">
                                              <strong>
                                                {record.snapshot.name}
                                              </strong>
                                              <span className="saved-neuk-kind">
                                                {t(
                                                  record.kind === 'parking'
                                                    ? 'categoryParking'
                                                    : record.snapshot.categories?.includes(
                                                          'shop',
                                                        )
                                                      ? 'categoryShop'
                                                      : record.snapshot.categories?.includes(
                                                            'repair',
                                                          )
                                                        ? 'categoryRepairPlace'
                                                        : 'categoryHirePlace',
                                                )}
                                              </span>
                                            </span>
                                            <span>{t('noLongerInData')}</span>
                                          </span>
                                        </div>
                                        <motion.button
                                          aria-label={t('removeFromMyNeuks', {
                                            name: record.snapshot.name,
                                          })}
                                          aria-pressed="true"
                                          className="parking-save-button"
                                          type="button"
                                          whileTap={subtleTap}
                                          onClick={() =>
                                            removeMissingSavedNeuk(record)
                                          }
                                        >
                                          <Bookmark
                                            size={18}
                                            fill="currentColor"
                                            aria-hidden="true"
                                          />
                                        </motion.button>
                                      </motion.li>
                                    ))
                                  : null}
                              </motion.ol>
                            ) : null}
                            {parkingView === 'nearby' &&
                            discoverCategory !== 'parking' &&
                            cyclingPoiDataStatus === 'ready' &&
                            activeListPoints.length === 0 ? (
                              <div
                                className="parking-list-context"
                                role="status"
                              >
                                {t('noCyclingPlacesNearby')}
                              </div>
                            ) : null}
                          </div>

                          {renderAttributionFooter()}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </LayoutGroup>
            {isParkingFiltersMode ? (
              <ParkingFiltersPanel
                filters={parkingFilters}
                points={nearbyPointsByDistance}
                sortMode={parkingSortMode}
                onApply={applyParkingFilters}
                onBack={closeParkingFilters}
              />
            ) : null}
          </div>
        </motion.aside>
        {isOfflineAreasOpen ? (
          <OfflineAreasPanel
            areas={offlineAreas}
            busyAreaId={busyOfflineAreaId}
            error={offlineAreaError}
            loading={offlineAreasLoading}
            message={offlineAreaMessage}
            progress={offlineAreaProgress}
            onClose={() => setIsOfflineAreasOpen(false)}
            onDownloadNew={startOfflineAreaSelection}
            onRemove={removeSavedOfflineArea}
            onRetry={updateSavedOfflineArea}
            onView={viewSavedOfflineArea}
          />
        ) : null}
        <dialog
          ref={attributionDialog}
          className="attribution-modal"
          aria-labelledby="attribution-modal-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeAttributionDialog();
            }
          }}
          onClose={() => setIsAttributionModalOpen(false)}
        >
          <AnimatePresence initial={false}>
            {isAttributionModalOpen ? (
              <motion.div
                {...popoverPresence}
                key="attribution-modal-content"
                className="attribution-modal-content"
              >
                <div className="attribution-modal-header">
                  <h2 id="attribution-modal-title">{t('attributions')}</h2>
                </div>
                <div className="attribution-details">
                  {parkingManifest?.sources.map((source) => (
                    <Fragment key={source.id}>
                      <span>{source.attribution}</span>
                      <a href={source.licenceUrl}>{source.licenceName}</a>
                    </Fragment>
                  ))}
                  {cycleNetworkManifest ? (
                    <Fragment key="cycle-network-source">
                      <span>{cycleNetworkManifest.source.attribution}</span>
                      <a href={cycleNetworkManifest.source.licenceUrl}>
                        {cycleNetworkManifest.source.licenceName}
                      </a>
                    </Fragment>
                  ) : null}
                  <span>
                    Map interface by{' '}
                    <a href="https://maplibre.org/">MapLibre GL JS</a>.
                  </span>
                  {hasUsedPlaceSearch ? (
                    <span>
                      Place search by{' '}
                      <a href="https://photon.komoot.io/">Photon</a> using
                      OpenStreetMap data.
                    </span>
                  ) : null}
                  <span>
                    Cycle directions by{' '}
                    <a href="https://www.cyclestreets.net/">CycleStreets</a>
                    {'.'}
                  </span>
                </div>
                <div className="attribution-modal-footer">
                  <motion.button
                    className="attribution-modal-close"
                    type="button"
                    whileTap={subtleTap}
                    onClick={closeAttributionDialog}
                  >
                    {t('close')}
                  </motion.button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </dialog>
        <dialog
          ref={streetViewDialog}
          className="street-view-modal"
          aria-labelledby="street-view-modal-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setStreetViewPoint(null);
            }
          }}
          onClose={() => setStreetViewPoint(null)}
        >
          <AnimatePresence
            initial={false}
            onExitComplete={closeStreetViewDialogAfterExit}
          >
            {streetViewPoint ? (
              <motion.div
                {...popoverPresence}
                key="street-view-modal-content"
                className="street-view-modal-content"
              >
                <div className="street-view-modal-header">
                  <h2 id="street-view-modal-title">{streetViewPoint.name}</h2>
                  <motion.button
                    aria-label={t('closeStreetView')}
                    className="street-view-modal-close"
                    type="button"
                    whileTap={subtleTap}
                    onClick={() => setStreetViewPoint(null)}
                  >
                    <X size={18} aria-hidden="true" />
                  </motion.button>
                </div>
                <iframe
                  allowFullScreen
                  className="street-view-frame"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={buildGoogleStreetViewEmbedUrl(
                    streetViewPoint,
                    googleStreetViewApiKey,
                  )}
                  title={t('streetViewFor', { name: streetViewPoint.name })}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </dialog>
      </main>
    </MotionConfig>
  );
}
