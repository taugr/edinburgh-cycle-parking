'use client';

import { improveDarkMapReadability } from '@/lib/map-readability';

import * as maplibregl from 'maplibre-gl';
import type {
  FilterSpecification,
  GeoJSONSource,
  LineLayerSpecification,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  PaddingOptions,
  PositionAnchor,
  Popup as MapLibrePopup,
  StyleSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import {
  Bike,
  Bookmark,
  Boxes,
  Building2,
  ChartSpline,
  CircleHelp,
  Droplet,
  GraduationCap,
  Layers,
  Lightbulb,
  LightbulbOff,
  Lock,
  LockOpen,
  MapPin,
  Navigation,
  ParkingCircle,
  Route,
  ScanSearch,
  Share2,
  Ship,
  ShoppingBag,
  TriangleAlert,
  Umbrella,
  UmbrellaOff,
  Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Bollard } from '@/components/icons/bollard';
import type {
  CyclingPoiCategory,
  ParkingPoint,
  UserLocation,
} from '@/lib/types';
import { isCyclingPoiPoint } from '@/lib/types';
import {
  getParkingEssentialDetails,
  getParkingPopupDetails,
} from '@/lib/parking';
import type { ParkingPopupIcon } from '@/lib/parking';
import type {
  CycleRoute,
  CycleRoutePoint,
  CycleRouteWaypoint,
} from '@/lib/cyclestreets';
import {
  getRouteInstructionManeuver,
  type RouteInstructionManeuver,
} from '@/lib/route-instructions';
import {
  getParkingMarkerVariant,
  getRenderableParkingPoints,
  type ParkingMapBounds,
  type ParkingView,
} from '@/lib/map-pins';
import {
  hasMapFocusTargetChanged,
  shouldApplyMapFocus,
  type MapFocusTarget,
} from '@/lib/map-focus';
import type { AppLocale } from '@/lib/i18n/locales';
import { translate } from '@/lib/i18n/messages';
import { getPointSavedNeukKey } from '@/lib/saved-neuks';
import type { CycleNetworkFeature } from '@/lib/cycle-network-data';
import {
  getCycleNetworkCoRoutes,
  getCycleNetworkPopupDetails,
  getCycleNetworkRouteBundles,
  getCycleNetworkRouteIdentity,
  type CycleNetworkRouteBundle,
  type CycleNetworkRouteIdentity,
} from '@/lib/cycle-network-presentation';

maplibregl.setWorkerUrl('/vendor/maplibre-gl/maplibre-gl-worker.mjs');

type CycleParkingMapProps = {
  locale: AppLocale;
  points: ParkingPoint[];
  cycleNetworkFeatures: CycleNetworkFeature[];
  isCycleNetworkVisible: boolean;
  userLocation: UserLocation;
  referenceLocationLabel: string;
  isReferenceCurrentLocation: boolean;
  currentLocationFocusRequestId: number;
  selectedPointId: string | null;
  selectedPoint: ParkingPoint | null;
  nearestPoint: ParkingPoint | null;
  rankedPoints: ParkingPoint[];
  parkingView: ParkingView;
  savedPointKeys: string[];
  route: CycleRoute | null;
  routeWaypoints?: CycleRouteWaypoint[];
  activeRouteWaypointId?: string | null;
  isRouteWaypointPlacementActive?: boolean;
  routeInstructionFocusRequest: {
    id: string;
    requestId: number;
  } | null;
  liveRouteMarker: {
    headingDegrees: number | null;
    isOffRoute: boolean;
    position: CycleRoutePoint;
    updatedAt: number;
  } | null;
  shouldFollowLiveRoute: boolean;
  isDirectionsMode: boolean;
  isDestinationParkingMode?: boolean;
  isRouteCalculationLoading?: boolean;
  isRoutePlanningMode?: boolean;
  showCurrentLocationMarker?: boolean;
  mobileSheetState: 'collapsed' | 'expanded';
  copiedShareButton: {
    parkingId: string;
    source: 'details' | 'list' | 'popup';
  } | null;
  theme: 'light' | 'dark';
  canRequestDirections: boolean;
  canShowStreetView: boolean;
  onClearSelection: () => void;
  onSelectPoint: (id: string) => void;
  onRequestDirections: (point: ParkingPoint) => void;
  onOpenStreetView: (point: ParkingPoint) => void;
  onShareParkingLink: (point: ParkingPoint) => void;
  onToggleSavedPoint: (point: ParkingPoint) => void;
  onOpenDetails: (point: ParkingPoint) => void;
  onPlaceRouteWaypoint?: (location: UserLocation) => void;
  onViewportChange: (bounds: ParkingMapBounds, zoom: number) => void;
  onBrowseLocation?: (location: UserLocation) => void;
  offlineAreaSelectionBounds?: ParkingMapBounds | null;
};

type VisibleMapArea = {
  bottom: number;
  center: { x: number; y: number };
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type RenderedMarker = {
  anchor?: PositionAnchor;
  element?: HTMLElement;
  marker: MapLibreMarker;
  popup?: MapLibrePopup;
  popupRoot?: Root;
};

type LineLayerStyle = {
  color: string;
  dashArray?: number[];
  opacity: number;
  width: number;
};

type RouteLineData = {
  features: {
    geometry: {
      coordinates: [number, number][];
      type: 'LineString';
    };
    properties: Record<string, never>;
    type: 'Feature';
  }[];
  type: 'FeatureCollection';
};

type ParkingMarkerPresentation = {
  anchor: PositionAnchor;
  className: string;
  label: string;
  offset: [number, number];
  popupAnchor: PositionAnchor;
  zIndex: string;
};

const defaultCenter: CycleRoutePoint = [55.9533, -3.1883];
const mapLibreBasemapStyleUrls = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/liberty',
} satisfies Record<'dark' | 'light', string>;

function createOfflineBasemapStyle(
  theme: 'dark' | 'light',
): StyleSpecification {
  return {
    version: 8,
    name: 'Bike Neuks offline background',
    sources: {},
    layers: [
      {
        id: 'offline-background',
        type: 'background',
        paint: {
          'background-color': theme === 'dark' ? '#0f1715' : '#e9f0ec',
        },
      },
    ],
  };
}
const mapLibreShieldLayerIds = new Set([
  'highway-shield-non-us',
  'highway-shield-us-interstate',
  'road_shield_us',
]);
const highlightedRankCount = 3;
const rankedPointCount = 8;
const nearbyFocusMaximumDistanceMeters = 50_000;
const collapsedSheetPopupFocusDelayMs = 320;
const popupIconByName: Record<ParkingPopupIcon, LucideIcon> = {
  'access-open': LockOpen,
  bollard: Bollard,
  building: Building2,
  covered: Umbrella,
  customer: ShoppingBag,
  distance: Route,
  fixture: Boxes,
  'not-covered': UmbrellaOff,
  parking: ParkingCircle,
  restricted: Lock,
  stand: Bike,
  storage: Warehouse,
  university: GraduationCap,
  unknown: CircleHelp,
};

function getMapLibreLocale(locale: AppLocale) {
  return {
    'AttributionControl.ToggleAttribution': translate(
      locale,
      'toggleAttribution',
    ),
    'NavigationControl.ResetBearing': translate(locale, 'resetBearing'),
    'NavigationControl.ZoomIn': translate(locale, 'zoomIn'),
    'NavigationControl.ZoomOut': translate(locale, 'zoomOut'),
    'Popup.Close': translate(locale, 'closePopup'),
  };
}

function applyMapLibreLocale(map: MapLibreMap, locale: AppLocale) {
  const localizedLabels = getMapLibreLocale(locale);

  Object.assign(map._locale, localizedLabels);

  const updateControlLabel = (selector: string, label: string) => {
    const control = map.getContainer().querySelector<HTMLElement>(selector);

    if (!control) {
      return;
    }

    control.setAttribute('aria-label', label);
    control.setAttribute('title', label);
  };

  updateControlLabel(
    '.maplibregl-ctrl-zoom-in',
    localizedLabels['NavigationControl.ZoomIn'],
  );
  updateControlLabel(
    '.maplibregl-ctrl-zoom-out',
    localizedLabels['NavigationControl.ZoomOut'],
  );
  updateControlLabel(
    '.maplibregl-ctrl-attrib-button',
    localizedLabels['AttributionControl.ToggleAttribution'],
  );

  map
    .getContainer()
    .querySelectorAll<HTMLElement>('.maplibregl-popup-close-button')
    .forEach((button) => {
      button.setAttribute('aria-label', localizedLabels['Popup.Close']);
    });
}

function toLngLat(point: CycleRoutePoint): [number, number] {
  return [point[1], point[0]];
}

function getMapLibreWorldSize(zoom: number) {
  return 512 * 2 ** zoom;
}

function projectPointAtZoom(point: CycleRoutePoint, zoom: number) {
  const coordinate = maplibregl.MercatorCoordinate.fromLngLat({
    lat: point[0],
    lng: point[1],
  });
  const worldSize = getMapLibreWorldSize(zoom);

  return {
    x: coordinate.x * worldSize,
    y: coordinate.y * worldSize,
  };
}

function unprojectPointAtZoom(
  point: { x: number; y: number },
  zoom: number,
): [number, number] {
  const worldSize = getMapLibreWorldSize(zoom);
  const x = point.x / worldSize;
  const y = point.y / worldSize;
  const lng = x * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

  return [lng, lat];
}

function patchOpenFreeMapLibertyStyle(
  style: StyleSpecification,
): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (!mapLibreShieldLayerIds.has(layer.id)) {
        return layer;
      }

      const existingFilter = 'filter' in layer ? layer.filter : undefined;

      return {
        ...layer,
        filter: [
          'all',
          ['!=', ['get', 'ref_length'], null],
          ...(existingFilter ? [existingFilter] : []),
        ] as FilterSpecification,
      };
    }),
  };
}

async function loadMapLibreBasemapStyle(
  signal: AbortSignal,
  theme: 'dark' | 'light',
) {
  const response = await fetch(mapLibreBasemapStyleUrls[theme], { signal });

  if (!response.ok) {
    throw new Error(`Map style request failed with ${response.status}`);
  }

  const style = (await response.json()) as StyleSpecification;

  return theme === 'light'
    ? patchOpenFreeMapLibertyStyle(style)
    : improveDarkMapReadability(style);
}

function userLocationToPoint(userLocation: UserLocation): CycleRoutePoint {
  return [userLocation.latitude, userLocation.longitude];
}

function parkingPointToRoutePoint(point: ParkingPoint): CycleRoutePoint {
  return [point.latitude, point.longitude];
}

function getMapSize(map: MapLibreMap) {
  const container = map.getContainer();

  return {
    x: container.clientWidth,
    y: container.clientHeight,
  };
}

function getVisibleMapArea(map: MapLibreMap): VisibleMapArea {
  const mapElement = map.getContainer();
  const size = getMapSize(map);
  const fallbackArea = {
    bottom: size.y,
    center: { x: size.x / 2, y: size.y / 2 },
    height: size.y,
    left: 0,
    right: size.x,
    top: 0,
    width: size.x,
  };
  const controlPane = document.querySelector<HTMLElement>('.control-pane');

  if (!controlPane) {
    return fallbackArea;
  }

  const mapRect = mapElement.getBoundingClientRect();
  const controlPaneRect = controlPane.getBoundingClientRect();
  const overlapLeft = Math.max(mapRect.left, controlPaneRect.left);
  const overlapRight = Math.min(mapRect.right, controlPaneRect.right);
  const overlapTop = Math.max(mapRect.top, controlPaneRect.top);
  const overlapBottom = Math.min(mapRect.bottom, controlPaneRect.bottom);
  const horizontalOverlap = Math.round(overlapRight - overlapLeft);
  const verticalOverlap = Math.round(overlapBottom - overlapTop);

  if (horizontalOverlap <= 0 || verticalOverlap <= 0) {
    return fallbackArea;
  }

  let left = 0;
  let right = size.x;
  let top = 0;
  let bottom = size.y;
  const minVisibleWidth = Math.min(160, Math.round(size.x * 0.5));
  const minVisibleHeight = Math.min(160, Math.round(size.y * 0.5));

  if (
    horizontalOverlap > size.x * 0.5 &&
    controlPaneRect.top > mapRect.top &&
    controlPaneRect.top < mapRect.bottom
  ) {
    bottom = Math.max(
      minVisibleHeight,
      Math.round(controlPaneRect.top - mapRect.top),
    );
  } else if (
    horizontalOverlap > size.x * 0.5 &&
    controlPaneRect.bottom > mapRect.top &&
    controlPaneRect.bottom < mapRect.bottom
  ) {
    top = Math.min(
      size.y - minVisibleHeight,
      Math.round(controlPaneRect.bottom - mapRect.top),
    );
  } else if (
    verticalOverlap > size.y * 0.5 &&
    controlPaneRect.left > mapRect.left &&
    controlPaneRect.left < mapRect.right
  ) {
    right = Math.max(
      minVisibleWidth,
      Math.round(controlPaneRect.left - mapRect.left),
    );
  } else if (
    verticalOverlap > size.y * 0.5 &&
    controlPaneRect.right > mapRect.left &&
    controlPaneRect.right < mapRect.right
  ) {
    left = Math.min(
      size.x - minVisibleWidth,
      Math.round(controlPaneRect.right - mapRect.left),
    );
  }

  const mobileToolbar = document.querySelector<HTMLElement>(
    '.mobile-map-toolbar',
  );

  if (mobileToolbar) {
    const toolbarRect = mobileToolbar.getBoundingClientRect();
    const toolbarOverlapLeft = Math.max(mapRect.left, toolbarRect.left);
    const toolbarOverlapRight = Math.min(mapRect.right, toolbarRect.right);
    const toolbarOverlapWidth = toolbarOverlapRight - toolbarOverlapLeft;

    if (
      toolbarOverlapWidth > size.x * 0.5 &&
      toolbarRect.bottom > mapRect.top &&
      toolbarRect.bottom < mapRect.bottom
    ) {
      top = Math.max(
        top,
        Math.min(
          size.y - minVisibleHeight,
          Math.round(toolbarRect.bottom - mapRect.top + 12),
        ),
      );
    }
  }

  const width = right - left;
  const height = bottom - top;

  return {
    bottom,
    center: { x: left + width / 2, y: top + height / 2 },
    height,
    left,
    right,
    top,
    width,
  };
}

function centerPopupInVisibleMapArea(map: MapLibreMap, popup: MapLibrePopup) {
  if (!popup.isOpen()) {
    return;
  }

  const popupElement = popup.getElement();

  if (!popupElement) {
    return;
  }

  const mapRect = map.getContainer().getBoundingClientRect();
  const visibleArea = getVisibleMapArea(map);
  const visibleCenterX = mapRect.left + visibleArea.center.x;
  const visibleCenterY = mapRect.top + visibleArea.center.y;
  const popupRect = popupElement.getBoundingClientRect();
  const popupCenterX = (popupRect.left + popupRect.right) / 2;
  const popupCenterY = (popupRect.top + popupRect.bottom) / 2;
  const panX = Math.round(popupCenterX - visibleCenterX);
  const panY = Math.round(popupCenterY - visibleCenterY);

  if (Math.abs(panX) < 12 && Math.abs(panY) < 12) {
    return;
  }

  map.panBy([panX, panY], {
    duration: 650,
    easing: (progress) => progress * (2 - progress),
  });
}

function keepPopupInVisibleMapArea(map: MapLibreMap, popup: MapLibrePopup) {
  if (!popup.isOpen()) return;
  const popupElement = popup.getElement();
  if (!popupElement) return;

  const margin = 16;
  const mapRect = map.getContainer().getBoundingClientRect();
  const visibleArea = getVisibleMapArea(map);
  const visibleLeft = mapRect.left + visibleArea.left + margin;
  const visibleRight = mapRect.left + visibleArea.right - margin;
  const visibleTop = mapRect.top + visibleArea.top + margin;
  const visibleBottom = mapRect.top + visibleArea.bottom - margin;
  const popupRect = popupElement.getBoundingClientRect();
  let panX = 0;
  let panY = 0;

  if (popupRect.left < visibleLeft) panX = popupRect.left - visibleLeft;
  else if (popupRect.right > visibleRight)
    panX = popupRect.right - visibleRight;
  if (popupRect.top < visibleTop) panY = popupRect.top - visibleTop;
  else if (popupRect.bottom > visibleBottom)
    panY = popupRect.bottom - visibleBottom;

  if (panX === 0 && panY === 0) return;
  map.panBy([Math.round(panX), Math.round(panY)], {
    duration: 450,
    easing: (progress) => progress * (2 - progress),
  });
}

function getFocusPadding(map: MapLibreMap): PaddingOptions {
  const visibleArea = getVisibleMapArea(map);
  const size = getMapSize(map);
  const coveredLeft = visibleArea.left;
  const coveredRight = size.x - visibleArea.right;
  const coveredTop = visibleArea.top;
  const coveredBottom = size.y - visibleArea.bottom;

  return {
    bottom: 40 + coveredBottom,
    left: 40 + coveredLeft,
    right: 40 + coveredRight,
    top: 40 + coveredTop,
  };
}

function getMapPointFocusCenter(
  map: MapLibreMap,
  point: CycleRoutePoint,
  zoom: number,
  mobileSheetState: 'collapsed' | 'expanded',
): [number, number] {
  const size = getMapSize(map);
  const visibleArea = getVisibleMapArea(map);

  if (
    visibleArea.left === 0 &&
    visibleArea.top === 0 &&
    visibleArea.right === size.x &&
    visibleArea.bottom === size.y
  ) {
    return toLngLat(point);
  }

  const targetY =
    mobileSheetState === 'collapsed'
      ? Math.round(visibleArea.top + visibleArea.height * 0.62)
      : Math.min(
          Math.max(visibleArea.top + 48, visibleArea.bottom - 56),
          Math.max(
            visibleArea.top + 180,
            Math.round(visibleArea.top + visibleArea.height * 0.75),
          ),
        );
  const targetPoint = {
    x: visibleArea.center.x,
    y: targetY,
  };
  return getMapPointCenterAtScreenPosition(map, point, zoom, targetPoint);
}

function getMapPointCenterAtScreenPosition(
  map: MapLibreMap,
  point: CycleRoutePoint,
  zoom: number,
  targetPoint: { x: number; y: number },
): [number, number] {
  const size = getMapSize(map);
  const mapCenterPoint = { x: size.x / 2, y: size.y / 2 };
  const projectedPoint = projectPointAtZoom(point, zoom);
  const projectedCenter = {
    x: projectedPoint.x - (targetPoint.x - mapCenterPoint.x),
    y: projectedPoint.y - (targetPoint.y - mapCenterPoint.y),
  };

  return unprojectPointAtZoom(projectedCenter, zoom);
}

function getPopupFocusCenter(
  map: MapLibreMap,
  point: CycleRoutePoint,
  popup: MapLibrePopup,
  zoom: number,
  mobileSheetState: 'collapsed' | 'expanded',
): [number, number] {
  const popupElement = popup.getElement();

  if (!popup.isOpen() || !popupElement) {
    return getMapPointFocusCenter(map, point, zoom, mobileSheetState);
  }

  const popupRect = popupElement.getBoundingClientRect();

  if (popupRect.width === 0 || popupRect.height === 0) {
    return getMapPointFocusCenter(map, point, zoom, mobileSheetState);
  }

  const mapRect = map.getContainer().getBoundingClientRect();
  const pointPosition = map.project(toLngLat(point));
  const popupCenter = {
    x: (popupRect.left + popupRect.right) / 2 - mapRect.left,
    y: (popupRect.top + popupRect.bottom) / 2 - mapRect.top,
  };
  const popupOffsetFromPoint = {
    x: popupCenter.x - pointPosition.x,
    y: popupCenter.y - pointPosition.y,
  };
  const visibleCenter = getVisibleMapArea(map).center;

  return getMapPointCenterAtScreenPosition(map, point, zoom, {
    x: visibleCenter.x - popupOffsetFromPoint.x,
    y: visibleCenter.y - popupOffsetFromPoint.y,
  });
}

function isPointInVisibleMapArea(map: MapLibreMap, point: CycleRoutePoint) {
  const visibleArea = getVisibleMapArea(map);
  const projectedPoint = map.project(toLngLat(point));
  const insetX = Math.min(32, visibleArea.width * 0.18);
  const insetY = Math.min(32, visibleArea.height * 0.18);

  return (
    projectedPoint.x >= visibleArea.left + insetX &&
    projectedPoint.x <= visibleArea.right - insetX &&
    projectedPoint.y >= visibleArea.top + insetY &&
    projectedPoint.y <= visibleArea.bottom - insetY
  );
}

function getVisibleMapBounds(map: MapLibreMap): ParkingMapBounds {
  const visibleArea = getVisibleMapArea(map);
  const northWest = map.unproject([visibleArea.left, visibleArea.top]);
  const southEast = map.unproject([visibleArea.right, visibleArea.bottom]);

  return {
    east: southEast.lng,
    north: northWest.lat,
    south: southEast.lat,
    west: northWest.lng,
  };
}

function getDistanceMeters(a: CycleRoutePoint, b: CycleRoutePoint) {
  const earthRadiusMeters = 6_371_000;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const deltaLat = ((b[0] - a[0]) * Math.PI) / 180;
  const deltaLng = ((b[1] - a[1]) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return earthRadiusMeters * centralAngle;
}

function createBounds(points: CycleRoutePoint[]) {
  const bounds = new maplibregl.LngLatBounds();

  points.forEach((point) => bounds.extend(toLngLat(point)));

  return bounds;
}

function createMarkerElement(className: string, label = '') {
  const element = document.createElement('div');
  const span = document.createElement('span');
  element.className = className;
  span.textContent = label;
  element.append(span);

  return element;
}

function updateMarkerElement(
  element: HTMLElement,
  className: string,
  label = '',
) {
  const mapLibreClasses = Array.from(element.classList).filter((className) =>
    className.startsWith('maplibregl-'),
  );
  element.className = [className, ...mapLibreClasses].join(' ');

  const labelElement = element.querySelector(':scope > span:first-child');

  if (labelElement) {
    labelElement.textContent = label;
  }
}

const bookmarkMarkerMarkup = renderToStaticMarkup(
  <Bookmark
    size={13}
    strokeWidth={2.5}
    fill="currentColor"
    aria-hidden="true"
  />,
);

const drinkingWaterMarkerMarkup = renderToStaticMarkup(
  <Droplet
    aria-hidden="true"
    fill="currentColor"
    size={15}
    strokeWidth={2.4}
  />,
);

function updateCyclingPoiMarkerIcon(
  element: HTMLElement,
  category: 'parking' | CyclingPoiCategory,
) {
  if (category !== 'water') return;
  const labelElement = element.querySelector(':scope > span:first-child');
  if (labelElement) labelElement.innerHTML = drinkingWaterMarkerMarkup;
}

function updateMarkerSavedBadge(element: HTMLElement, isSaved: boolean) {
  const existingBadge = element.querySelector('.parking-marker-bookmark');
  if (!isSaved) {
    existingBadge?.remove();
    return;
  }

  if (existingBadge) {
    return;
  }

  const badge = document.createElement('span');
  badge.className = 'parking-marker-bookmark';
  badge.innerHTML = bookmarkMarkerMarkup;
  element.append(badge);
}

function getParkingMarkerPresentation({
  isDirectionsMode,
  isSaved,
  isSelected,
  parkingView,
  rank,
}: {
  isDirectionsMode: boolean;
  isSaved: boolean;
  isSelected: boolean;
  parkingView: ParkingView;
  rank: number | undefined;
}): ParkingMarkerPresentation {
  const variant = getParkingMarkerVariant({
    isDirectionsMode,
    isSaved,
    isSelected,
    parkingView,
    rank,
  });

  if (variant === 'destination') {
    return {
      anchor: 'bottom',
      className: 'destination-marker',
      label: '',
      offset: [0, -34],
      popupAnchor: 'bottom',
      zIndex: '1000',
    };
  }

  if (variant === 'selected-ranked' || variant === 'selected-ranked-saved') {
    return {
      anchor: 'center',
      className: [
        'parking-marker parking-marker-selected-ranked',
        isSaved ? 'parking-marker-saved' : '',
      ]
        .filter(Boolean)
        .join(' '),
      label: String(rank),
      offset: [0, -18],
      popupAnchor: 'bottom',
      zIndex: '1000',
    };
  }

  if (variant === 'selected' || variant === 'selected-saved') {
    return {
      anchor: 'center',
      className: [
        'parking-marker parking-marker-selected',
        isSaved ? 'parking-marker-saved' : '',
      ]
        .filter(Boolean)
        .join(' '),
      label: '',
      offset: [0, -18],
      popupAnchor: 'bottom',
      zIndex: '1000',
    };
  }

  if (variant === 'ranked' || variant === 'ranked-saved') {
    return {
      anchor: 'center',
      className: [
        `parking-marker parking-marker-ranked parking-marker-rank-${rank}`,
        isSaved ? 'parking-marker-saved' : '',
      ]
        .filter(Boolean)
        .join(' '),
      label: String(rank),
      offset: [0, -18],
      popupAnchor: 'bottom',
      zIndex: '',
    };
  }

  return variant === 'saved'
    ? {
        anchor: 'center',
        className: 'parking-marker parking-marker-saved',
        label: '',
        offset: [0, -18],
        popupAnchor: 'bottom',
        zIndex: '',
      }
    : {
        anchor: 'center',
        className: 'parking-marker parking-marker-default',
        label: '',
        offset: [0, -18],
        popupAnchor: 'bottom',
        zIndex: '',
      };
}

function createParkingMarkerElement(
  kind: 'default' | 'selected' | 'selected-ranked',
  label = '',
) {
  return createMarkerElement(`parking-marker parking-marker-${kind}`, label);
}

function createRankedParkingMarkerElement(rank: number) {
  return createMarkerElement(
    `parking-marker parking-marker-ranked parking-marker-rank-${rank}`,
    String(rank),
  );
}

function createPinMarkerElement(className: string) {
  return createMarkerElement(className);
}

function createRouteWaypointMarkerElement(
  index: number,
  isFinish: boolean,
  isActive: boolean,
) {
  const element = createMarkerElement(
    [
      'route-waypoint-marker',
      isFinish ? 'route-waypoint-marker-finish' : '',
      isActive ? 'route-waypoint-marker-active' : '',
    ]
      .filter(Boolean)
      .join(' '),
    String(index + 1),
  );
  element.dataset.testid = `route-waypoint-marker-${index}`;
  return element;
}

function createLiveRouteMarkerElement({
  headingDegrees,
  isOffRoute,
}: {
  headingDegrees: number | null;
  isOffRoute: boolean;
}) {
  const element = document.createElement('div');
  const span = document.createElement('span');
  const headingCue =
    headingDegrees === null
      ? ''
      : `<i class="live-route-heading" style="transform: translateX(-50%) rotate(${headingDegrees}deg)" aria-hidden="true"></i>`;

  element.className = isOffRoute
    ? 'live-route-marker live-route-marker-off-route'
    : 'live-route-marker';
  element.dataset.testid = 'live-route-marker';
  span.innerHTML = `${headingCue}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="18.5" cy="17.5" r="3.5"></circle><circle cx="5.5" cy="17.5" r="3.5"></circle><circle cx="15" cy="5" r="1"></circle><path d="m12 17.5 3-6 2 3h2"></path><path d="m5.5 17.5 3-6h4l3 6"></path><path d="m8.5 11.5 2-4h3.5"></path></svg>`;
  element.append(span);

  return element;
}

function getSelectedInstructionMarkerSvg(maneuver: RouteInstructionManeuver) {
  if (maneuver === 'start') {
    return '<path d="M5 19V5"></path><path d="m5 5 12 3-12 3"></path>';
  }

  if (maneuver === 'arrive') {
    return '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>';
  }

  if (maneuver === 'left') {
    return '<path d="M15 18v-6a4 4 0 0 0-4-4H5"></path><path d="m8 5-3 3 3 3"></path>';
  }

  if (maneuver === 'right') {
    return '<path d="M9 18v-6a4 4 0 0 1 4-4h6"></path><path d="m16 5 3 3-3 3"></path>';
  }

  return '<path d="M12 19V5"></path><path d="m5 12 7-7 7 7"></path>';
}

function createSelectedInstructionMarkerElement(
  maneuver: RouteInstructionManeuver,
) {
  const element = document.createElement('div');
  const span = document.createElement('span');
  element.className = `selected-route-instruction-marker selected-route-instruction-marker-${maneuver}`;
  span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4">${getSelectedInstructionMarkerSvg(maneuver)}</svg>`;
  element.append(span);

  return element;
}

function ParkingPopupIcon({ icon }: { icon: ParkingPopupIcon }) {
  const Icon = popupIconByName[icon] ?? MapPin;

  return <Icon size={15} strokeWidth={2.25} aria-hidden="true" />;
}

const cycleNetworkDetailIcon = {
  lighting: Lightbulb,
  'lighting-off': LightbulbOff,
  quality: ChartSpline,
  surface: Layers,
} as const;

function CycleNetworkPopupContent({
  coRoutes,
  feature,
  locale,
}: {
  coRoutes: CycleNetworkRouteIdentity[];
  feature: CycleNetworkFeature;
  locale: AppLocale;
}) {
  const routeNumber =
    feature.properties.routeNumber ?? feature.properties.linkNumber;
  const title =
    routeNumber === undefined
      ? translate(locale, 'nationalCycleNetwork')
      : translate(
          locale,
          feature.properties.routeType === 'link'
            ? 'cycleNetworkLinkRoute'
            : 'cycleNetworkRoute',
          { number: routeNumber },
        );
  const kind = translate(
    locale,
    feature.properties.kind === 'traffic-free'
      ? 'cycleNetworkTrafficFree'
      : feature.properties.kind === 'on-road'
        ? 'cycleNetworkOnRoad'
        : feature.properties.kind === 'ferry'
          ? 'cycleNetworkFerry'
          : 'nationalCycleNetwork',
  );
  const KindIcon =
    feature.properties.kind === 'ferry'
      ? Ship
      : feature.properties.kind === 'traffic-free'
        ? Bike
        : Route;
  const details = getCycleNetworkPopupDetails(feature, locale);
  const factCount = details.length + 1;

  return (
    <div className="cycle-network-popup" data-testid="cycle-network-popup">
      <div className="cycle-network-popup-title">
        {routeNumber === undefined ? (
          <Bike aria-hidden="true" />
        ) : (
          <span
            aria-hidden="true"
            className={`cycle-network-route-shield cycle-network-route-shield-${feature.properties.routeType}`}
          >
            {routeNumber}
          </span>
        )}
        <strong>{title}</strong>
      </div>
      {coRoutes.length > 0 ? (
        <div
          className="cycle-network-popup-co-routes"
          data-testid="cycle-network-popup-co-routes"
        >
          <span>{translate(locale, 'cycleNetworkAlsoOnRoute')}</span>
          <span className="cycle-network-popup-co-route-shields">
            {coRoutes.map((routeIdentity) => (
              <span
                aria-label={translate(locale, 'cycleNetworkRoute', {
                  number: routeIdentity.routeNumber,
                })}
                className={`cycle-network-route-shield cycle-network-route-shield-${routeIdentity.shieldType}`}
                key={routeIdentity.key}
              >
                {routeIdentity.routeNumber}
              </span>
            ))}
          </span>
        </div>
      ) : null}
      {feature.properties.openStatus === 'temporary-closure' ? (
        <div className="cycle-network-popup-warning">
          <TriangleAlert aria-hidden="true" />
          <span>{translate(locale, 'cycleNetworkTemporaryClosure')}</span>
        </div>
      ) : null}
      <div
        className={`cycle-network-popup-details cycle-network-popup-details-count-${factCount}`}
        data-testid="cycle-network-popup-facts"
      >
        <div
          aria-label={kind}
          className="cycle-network-popup-detail"
          title={kind}
        >
          <KindIcon aria-hidden="true" />
          <span>{kind}</span>
        </div>
        {details.map((detail) => {
          const Icon = cycleNetworkDetailIcon[detail.icon];
          return (
            <div
              aria-label={`${detail.label}: ${detail.value}`}
              className="cycle-network-popup-detail"
              key={detail.icon}
              title={detail.label}
            >
              <Icon aria-hidden="true" />
              <span>{detail.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ParkingPopupContent({
  canRequestDirections,
  canShowStreetView,
  copiedShareButton,
  isDirectionsMode,
  isSaved,
  onShareParkingLink,
  onOpenStreetView,
  onRequestDirections,
  onToggleSavedPoint,
  point,
  locale,
}: {
  canRequestDirections: boolean;
  canShowStreetView: boolean;
  copiedShareButton: {
    parkingId: string;
    source: 'details' | 'list' | 'popup';
  } | null;
  isDirectionsMode: boolean;
  isSaved: boolean;
  onShareParkingLink: (point: ParkingPoint) => void;
  onOpenStreetView: (point: ParkingPoint) => void;
  onRequestDirections: (point: ParkingPoint) => void;
  onToggleSavedPoint: (point: ParkingPoint) => void;
  point: ParkingPoint;
  locale: AppLocale;
}) {
  const isParking = !isCyclingPoiPoint(point);
  const isWaterPoint =
    isCyclingPoiPoint(point) && point.categories[0] === 'water';
  const essentialDetails = isParking
    ? getParkingEssentialDetails(point, locale)
    : [];
  const popupDetails = getParkingPopupDetails(point, locale);

  if (isWaterPoint) {
    return (
      <div className="parking-popup parking-popup-water">
        <div className="parking-popup-water-title">
          <span className="parking-popup-water-icon" aria-hidden="true">
            <Droplet fill="currentColor" size={16} strokeWidth={2.4} />
          </span>
          <span>
            <strong>{point.name}</strong>
            {popupDetails.metrics.map((metric) => (
              <span
                className="parking-popup-distance"
                data-testid={`parking-popup-distance-${point.id}`}
                key={metric.label}
                title={metric.label}
              >
                {metric.value}
              </span>
            ))}
          </span>
        </div>
        {isDirectionsMode ? null : (
          <div className="parking-popup-actions">
            <button
              className="parking-popup-directions-button"
              disabled={!canRequestDirections}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRequestDirections(point);
              }}
            >
              <Navigation size={15} aria-hidden="true" />
              {translate(locale, 'directions')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={
        isParking
          ? 'parking-popup'
          : 'parking-popup parking-popup-cycling-place'
      }
    >
      <div
        className="parking-popup-preview"
        data-testid={`parking-popup-details-${point.id}`}
      >
        <span className="parking-popup-title-row">
          <strong>{point.name}</strong>
          {isParking
            ? null
            : popupDetails.metrics.map((metric) => (
                <span
                  className="parking-popup-distance"
                  data-testid={`parking-popup-distance-${point.id}`}
                  key={metric.label}
                  title={metric.label}
                >
                  {metric.value}
                </span>
              ))}
        </span>
        {essentialDetails.length > 0 ? (
          <span
            className={`parking-popup-details parking-popup-details-count-${essentialDetails.length}`}
            aria-label={translate(locale, 'details')}
          >
            {essentialDetails.map((detail) => (
              <span
                aria-label={`${detail.label}: ${detail.value}`}
                className={`parking-popup-detail parking-popup-tone-${detail.tone}`}
                key={detail.label}
              >
                <span className="parking-popup-detail-icon">
                  {detail.emphasis ?? <ParkingPopupIcon icon={detail.icon} />}
                </span>
                <span className="parking-popup-detail-value">
                  {detail.value}
                </span>
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <div className="parking-popup-desktop">
        <div className="parking-popup-title-row">
          <strong>{point.name}</strong>
          {popupDetails.metrics.map((metric) => (
            <span
              className="parking-popup-distance"
              data-testid={`parking-popup-distance-${point.id}`}
              key={metric.label}
              title={metric.label}
            >
              {metric.value}
            </span>
          ))}
        </div>
        {isParking ? (
          <div
            className={`parking-popup-details parking-popup-details-count-${popupDetails.details.length}`}
            aria-label={translate(locale, 'details')}
          >
            {popupDetails.details.map((detail) => (
              <div
                aria-label={`${detail.label}: ${detail.value}`}
                className={`parking-popup-detail parking-popup-tone-${detail.tone}`}
                key={detail.label}
              >
                <span className="parking-popup-detail-icon">
                  {detail.emphasis ?? <ParkingPopupIcon icon={detail.icon} />}
                </span>
                <span className="parking-popup-detail-value">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {isDirectionsMode ? null : (
          <div className="parking-popup-actions">
            <button
              className="parking-popup-directions-button"
              disabled={!canRequestDirections}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRequestDirections(point);
              }}
            >
              <Navigation size={15} aria-hidden="true" />
              {translate(locale, 'directions')}
            </button>
            {isParking && canShowStreetView ? (
              <button
                aria-label={translate(locale, 'openStreetView', {
                  name: point.name,
                })}
                className="parking-popup-street-view-button"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenStreetView(point);
                }}
              >
                <ScanSearch size={15} aria-hidden="true" />
                {translate(locale, 'street')}
              </button>
            ) : null}
            {isParking ? (
              <button
                aria-label={translate(locale, 'shareLink', {
                  name: point.name,
                })}
                className="parking-popup-share-button"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onShareParkingLink(point);
                }}
              >
                <Share2 size={15} aria-hidden="true" />
                {translate(locale, 'share')}
                {copiedShareButton?.source === 'popup' &&
                copiedShareButton.parkingId === point.id ? (
                  <span className="parking-popup-share-feedback" role="status">
                    {translate(locale, 'copied')}
                  </span>
                ) : null}
              </button>
            ) : null}
            <button
              aria-label={translate(
                locale,
                isSaved ? 'removeFromMyNeuks' : 'saveToMyNeuks',
                { name: point.name },
              )}
              aria-pressed={isSaved}
              className="parking-popup-save-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleSavedPoint(point);
              }}
            >
              <Bookmark
                size={16}
                fill={isSaved ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
              {translate(locale, isSaved ? 'saved' : 'save')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StartPopupContent({
  locale,
  label,
}: {
  locale: AppLocale;
  label: string;
}) {
  return (
    <div className="parking-popup">
      <strong>{translate(locale, 'startPosition')}</strong>
      <span>{label}</span>
    </div>
  );
}

function createRenderedPopup(
  content: ReactNode,
  options: maplibregl.PopupOptions = {},
) {
  const container = document.createElement('div');
  const root = createRoot(container);
  root.render(content);

  return {
    popup: new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      focusAfterOpen: false,
      maxWidth: '340px',
      ...options,
    }).setDOMContent(container),
    root,
  };
}

function cleanupRenderedMarker(renderedMarker: RenderedMarker | null) {
  if (!renderedMarker) {
    return;
  }

  renderedMarker.popup?.remove();
  renderedMarker.marker.remove();
  renderedMarker.popupRoot?.unmount();
}

function getFinalApproachPositions(
  route: CycleRoute | null,
  selectedPoint: ParkingPoint | null,
): CycleRoutePoint[] | null {
  const routeEnd = route?.points.at(-1);

  if (!routeEnd || !selectedPoint) {
    return null;
  }

  const destination = parkingPointToRoutePoint(selectedPoint);
  const distanceMeters = getDistanceMeters(routeEnd, destination);

  if (distanceMeters < 2) {
    return null;
  }

  return [routeEnd, destination];
}

function getInitialApproachPositions(
  route: CycleRoute | null,
  userLocation: UserLocation,
): CycleRoutePoint[] | null {
  const routeStart = route?.points.at(0);

  if (!routeStart) {
    return null;
  }

  const start = userLocationToPoint(userLocation);
  const distanceMeters = getDistanceMeters(start, routeStart);

  if (distanceMeters < 2) {
    return null;
  }

  return [start, routeStart];
}

function createLineData(
  positions: CycleRoutePoint[] | null,
  segments?: CycleRoutePoint[][],
): RouteLineData {
  const lineSegments = segments?.length
    ? segments
    : positions
      ? [positions]
      : [];
  return {
    features: lineSegments.map((segment) => ({
      geometry: {
        coordinates: segment.map(toLngLat),
        type: 'LineString',
      },
      properties: {},
      type: 'Feature',
    })),
    type: 'FeatureCollection',
  };
}

function syncLineLayer({
  data,
  id,
  map,
  style,
}: {
  data: RouteLineData;
  id: string;
  map: MapLibreMap;
  style: LineLayerStyle;
}) {
  const layerId = `${id}-layer`;
  const source = map.getSource(id) as GeoJSONSource | undefined;

  if (source) {
    void source.setData(data);
  } else {
    map.addSource(id, {
      data,
      type: 'geojson',
    });
  }

  if (map.getLayer(layerId)) {
    map.setPaintProperty(layerId, 'line-color', style.color);
    map.setPaintProperty(layerId, 'line-opacity', style.opacity);
    map.setPaintProperty(layerId, 'line-width', style.width);
    map.setPaintProperty(layerId, 'line-dasharray', style.dashArray ?? [1, 0]);
    return;
  }

  const paint: NonNullable<LineLayerSpecification['paint']> = {
    'line-color': style.color,
    'line-opacity': style.opacity,
    'line-width': style.width,
  };

  if (style.dashArray) {
    paint['line-dasharray'] = style.dashArray;
  }

  map.addLayer({
    id: layerId,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint,
    source: id,
    type: 'line',
  });
}

const cycleNetworkSourceId = 'cycle-network-lines';
const cycleNetworkBundleSourceId = 'cycle-network-route-bundles';
const offlineAreaSelectionSourceId = 'offline-area-selection';
const offlineAreaSelectionFillLayerId = 'offline-area-selection-fill';
const offlineAreaSelectionLineLayerId = 'offline-area-selection-line';
const cycleNetworkHitLayerId = 'cycle-network-hit';
const cycleNetworkCasingLayerId = 'cycle-network-casing';
const cycleNetworkSelectedCasingLayerId = 'cycle-network-selected-casing';
const cycleNetworkBundleLayerId = 'cycle-network-bundle-labels';
const cycleNetworkShieldImageScale = 3;
// Popup selection re-runs layer styling. Preserve unchanged source data so
// MapLibre does not remove and re-place labels while the popup opens or closes.
const cycleNetworkFeaturesByMap = new WeakMap<
  MapLibreMap,
  CycleNetworkFeature[]
>();
const cycleNetworkBundlesByMap = new WeakMap<
  MapLibreMap,
  CycleNetworkRouteBundle[]
>();

function getCycleNetworkShieldImageId(
  routeIdentities: CycleNetworkRouteIdentity[],
) {
  return `cycle-network-shield-${routeIdentities
    .map((routeIdentity) =>
      `${routeIdentity.shieldType}-${routeIdentity.routeNumber}`.replaceAll(
        /[^a-z0-9-]/g,
        '-',
      ),
    )
    .join('-')}`;
}

function addCycleNetworkShieldImage(
  map: MapLibreMap,
  routeIdentities: CycleNetworkRouteIdentity[],
) {
  const id = getCycleNetworkShieldImageId(routeIdentities);
  if (map.hasImage(id)) return id;
  const scale = cycleNetworkShieldImageScale;
  const gap = 2 * scale;
  const shieldHeight = 22 * scale;
  const horizontalPadding = 7 * scale;
  const routeWidths = routeIdentities.map((routeIdentity) =>
    Math.max(
      24 * scale,
      routeIdentity.routeNumber.toString().length * 7 * scale +
        horizontalPadding * 2,
    ),
  );
  const canvas = document.createElement('canvas');
  canvas.width =
    routeWidths.reduce((total, width) => total + width, 0) +
    gap * (routeWidths.length - 1) +
    4 * scale;
  canvas.height = shieldHeight + 4 * scale;
  const context = canvas.getContext('2d');
  if (!context) return null;

  let left = 2 * scale;
  routeIdentities.forEach((routeIdentity, index) => {
    const width = routeWidths[index];
    const top = 2 * scale;
    const radius = 5 * scale;
    context.beginPath();
    context.roundRect(left, top, width, shieldHeight, radius);
    context.fillStyle =
      routeIdentity.shieldType === 'ncn'
        ? '#b4232f'
        : routeIdentity.shieldType === 'rcn'
          ? '#275dad'
          : '#52606d';
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.96)';
    context.lineWidth = 2 * scale;
    context.stroke();
    context.fillStyle = '#ffffff';
    context.font = `800 ${12 * scale}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(
      routeIdentity.routeNumber.toString(),
      Math.round(left + width / 2),
      Math.round(top + shieldHeight / 2 + scale * 0.25),
    );
    left += width + gap;
  });

  map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: scale,
  });
  return id;
}

function addCycleNetworkBundleImage(
  map: MapLibreMap,
  bundle: CycleNetworkRouteBundle,
) {
  return addCycleNetworkShieldImage(map, bundle.routes);
}

function syncCycleNetworkBundleSource({
  bundles,
  map,
}: {
  bundles: CycleNetworkRouteBundle[];
  map: MapLibreMap;
}) {
  const source = map.getSource(cycleNetworkBundleSourceId) as
    | GeoJSONSource
    | undefined;
  if (source && cycleNetworkBundlesByMap.get(map) === bundles) return;
  const bundleData = {
    features: bundles.flatMap((bundle) => {
      const imageId = addCycleNetworkBundleImage(map, bundle);
      if (!imageId) return [];
      return [
        {
          geometry: { coordinates: bundle.anchor, type: 'Point' as const },
          id: bundle.key,
          properties: {
            imageId,
            routeKeys: bundle.routes.map((routeIdentity) => routeIdentity.key),
          },
          type: 'Feature' as const,
        },
      ];
    }),
    type: 'FeatureCollection' as const,
  };
  if (source) void source.setData(bundleData);
  else
    map.addSource(cycleNetworkBundleSourceId, {
      data: bundleData,
      type: 'geojson',
    });
  cycleNetworkBundlesByMap.set(map, bundles);
}

function syncCycleNetworkLayers({
  bundles,
  features,
  isDirectionsMode,
  map,
  selectedRouteKey,
  theme,
}: {
  bundles: CycleNetworkRouteBundle[];
  features: CycleNetworkFeature[];
  isDirectionsMode: boolean;
  map: MapLibreMap;
  selectedRouteKey: string | null;
  theme: 'light' | 'dark';
}) {
  const lineSource = map.getSource(cycleNetworkSourceId) as
    | GeoJSONSource
    | undefined;
  if (!lineSource || cycleNetworkFeaturesByMap.get(map) !== features) {
    const lineData = {
      features: features.map((feature) => {
        const routeIdentity = getCycleNetworkRouteIdentity(feature);
        return {
          ...feature,
          properties: {
            ...feature.properties,
            routeKey: routeIdentity?.key ?? '',
            shieldImageId: routeIdentity
              ? addCycleNetworkShieldImage(map, [routeIdentity])
              : '',
          },
        };
      }),
      type: 'FeatureCollection' as const,
    };
    if (lineSource) void lineSource.setData(lineData);
    else
      map.addSource(cycleNetworkSourceId, { data: lineData, type: 'geojson' });
    cycleNetworkFeaturesByMap.set(map, features);
  }
  syncCycleNetworkBundleSource({ bundles, map });

  const firstSymbolLayer = map
    .getStyle()
    .layers?.find((layer) => layer.type === 'symbol')?.id;
  const selectedOpacity = isDirectionsMode ? 0.3 : 1;
  const unselectedOpacity = isDirectionsMode
    ? 0.12
    : selectedRouteKey
      ? 0.24
      : 0.86;
  const lineOpacity: NonNullable<
    LineLayerSpecification['paint']
  >['line-opacity'] = selectedRouteKey
    ? [
        'case',
        ['==', ['get', 'routeKey'], selectedRouteKey],
        selectedOpacity,
        unselectedOpacity,
      ]
    : unselectedOpacity;
  const selectedRouteFilter = [
    '==',
    ['get', 'routeKey'],
    selectedRouteKey ?? '__no-selected-cycle-network-route__',
  ] as FilterSpecification;

  if (map.getLayer(cycleNetworkCasingLayerId)) {
    map.setPaintProperty(
      cycleNetworkCasingLayerId,
      'line-color',
      theme === 'dark' ? '#020617' : '#ffffff',
    );
    map.setPaintProperty(
      cycleNetworkCasingLayerId,
      'line-opacity',
      isDirectionsMode ? 0.16 : selectedRouteKey ? 0.28 : 0.68,
    );
  } else {
    map.addLayer(
      {
        id: cycleNetworkCasingLayerId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': theme === 'dark' ? '#020617' : '#ffffff',
          'line-opacity': isDirectionsMode
            ? 0.16
            : selectedRouteKey
              ? 0.28
              : 0.68,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5.2, 15, 7],
        },
        source: cycleNetworkSourceId,
        type: 'line',
      },
      firstSymbolLayer,
    );
  }
  if (map.getLayer(cycleNetworkSelectedCasingLayerId)) {
    map.setFilter(cycleNetworkSelectedCasingLayerId, selectedRouteFilter);
    map.setPaintProperty(
      cycleNetworkSelectedCasingLayerId,
      'line-color',
      theme === 'dark' ? '#f8fafc' : '#ffffff',
    );
    map.setPaintProperty(
      cycleNetworkSelectedCasingLayerId,
      'line-opacity',
      isDirectionsMode ? 0.3 : 0.98,
    );
  } else {
    map.addLayer(
      {
        filter: selectedRouteFilter,
        id: cycleNetworkSelectedCasingLayerId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': theme === 'dark' ? '#f8fafc' : '#ffffff',
          'line-opacity': isDirectionsMode ? 0.3 : 0.98,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 7.2, 15, 9.4],
        },
        source: cycleNetworkSourceId,
        type: 'line',
      },
      firstSymbolLayer,
    );
  }
  const styles = [
    {
      color: theme === 'dark' ? '#42d6a4' : '#087f5b',
      filter: ['==', ['get', 'kind'], 'traffic-free'],
      id: 'cycle-network-traffic-free',
      width: 3.4,
    },
    {
      color: theme === 'dark' ? '#a5b4fc' : '#4f46a5',
      dash: [2, 1.4],
      filter: ['==', ['get', 'kind'], 'on-road'],
      id: 'cycle-network-on-road',
      width: 2.4,
    },
    {
      color: theme === 'dark' ? '#67e8f9' : '#08799c',
      dash: [0.4, 2],
      filter: ['==', ['get', 'kind'], 'ferry'],
      id: 'cycle-network-ferry',
      width: 2.6,
    },
    {
      color: theme === 'dark' ? '#cbd5e1' : '#64748b',
      dash: [1, 1.5],
      filter: ['==', ['get', 'kind'], 'unknown'],
      id: 'cycle-network-other',
      width: 2,
    },
  ];
  for (const style of styles) {
    if (map.getLayer(style.id)) {
      map.setPaintProperty(style.id, 'line-color', style.color);
      map.setPaintProperty(style.id, 'line-opacity', lineOpacity);
      continue;
    }
    const paint: NonNullable<LineLayerSpecification['paint']> = {
      'line-color': style.color,
      'line-opacity': lineOpacity,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        style.width,
        15,
        style.width + 1.2,
      ],
    };
    if (style.dash) paint['line-dasharray'] = style.dash;
    map.addLayer(
      {
        filter: style.filter as FilterSpecification,
        id: style.id,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint,
        source: cycleNetworkSourceId,
        type: 'line',
      },
      firstSymbolLayer,
    );
  }
  if (map.getLayer('cycle-network-temporary-closure')) {
    map.setPaintProperty(
      'cycle-network-temporary-closure',
      'line-color',
      theme === 'dark' ? '#fb923c' : '#c2410c',
    );
    map.setPaintProperty(
      'cycle-network-temporary-closure',
      'line-opacity',
      isDirectionsMode ? 0.3 : 1,
    );
  } else {
    map.addLayer(
      {
        filter: ['==', ['get', 'openStatus'], 'temporary-closure'],
        id: 'cycle-network-temporary-closure',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': theme === 'dark' ? '#fb923c' : '#c2410c',
          'line-dasharray': [0.8, 1.2],
          'line-opacity': isDirectionsMode ? 0.3 : 1,
          'line-width': 5,
        },
        source: cycleNetworkSourceId,
        type: 'line',
      },
      firstSymbolLayer,
    );
  }
  if (!map.getLayer(cycleNetworkHitLayerId)) {
    map.addLayer({
      id: cycleNetworkHitLayerId,
      paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 14 },
      source: cycleNetworkSourceId,
      type: 'line',
    });
  }
  const bundleOpacity = isDirectionsMode ? 0.38 : selectedRouteKey ? 0.5 : 1;
  if (map.getLayer(cycleNetworkBundleLayerId)) {
    map.setPaintProperty(
      cycleNetworkBundleLayerId,
      'icon-opacity',
      bundleOpacity,
    );
  } else {
    map.addLayer({
      id: cycleNetworkBundleLayerId,
      layout: {
        'icon-allow-overlap': true,
        'icon-image': ['get', 'imageId'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10.5, 0.86, 14, 1],
      },
      minzoom: 10.5,
      paint: { 'icon-opacity': bundleOpacity },
      source: cycleNetworkBundleSourceId,
      type: 'symbol',
    });
  }
  const numberedRouteFilter = [
    'all',
    ['in', ['get', 'routeType'], ['literal', ['ncn', 'rcn', 'link']]],
    ['any', ['has', 'routeNumber'], ['has', 'linkNumber']],
  ] as FilterSpecification;
  const routeLabelOpacity: NonNullable<
    SymbolLayerSpecification['paint']
  >['icon-opacity'] = isDirectionsMode
    ? 0.32
    : selectedRouteKey
      ? ['case', ['==', ['get', 'routeKey'], selectedRouteKey], 1, 0.42]
      : 1;
  if (map.getLayer('cycle-network-labels')) {
    map.setFilter('cycle-network-labels', numberedRouteFilter);
    map.setLayoutProperty('cycle-network-labels', 'icon-image', [
      'get',
      'shieldImageId',
    ]);
    map.setPaintProperty(
      'cycle-network-labels',
      'icon-opacity',
      routeLabelOpacity,
    );
  } else {
    map.addLayer({
      filter: numberedRouteFilter,
      id: 'cycle-network-labels',
      layout: {
        'icon-allow-overlap': false,
        'icon-image': ['get', 'shieldImageId'],
        'icon-keep-upright': true,
        'icon-padding': 80,
        'icon-rotation-alignment': 'viewport',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10.5, 0.86, 14, 1],
        'symbol-placement': 'line',
        'symbol-spacing': 570,
      },
      minzoom: 10.5,
      paint: { 'icon-opacity': routeLabelOpacity },
      source: cycleNetworkSourceId,
      type: 'symbol',
    });
  }
}

export default function CycleParkingMap({
  locale,
  points,
  cycleNetworkFeatures,
  isCycleNetworkVisible,
  userLocation,
  referenceLocationLabel,
  isReferenceCurrentLocation,
  currentLocationFocusRequestId,
  selectedPointId,
  selectedPoint,
  nearestPoint,
  rankedPoints,
  parkingView,
  savedPointKeys,
  route,
  routeWaypoints = [],
  activeRouteWaypointId = null,
  isRouteWaypointPlacementActive = false,
  routeInstructionFocusRequest,
  liveRouteMarker,
  shouldFollowLiveRoute,
  isDirectionsMode,
  isDestinationParkingMode = false,
  isRouteCalculationLoading = false,
  isRoutePlanningMode = false,
  showCurrentLocationMarker = false,
  mobileSheetState,
  copiedShareButton,
  theme,
  canRequestDirections,
  canShowStreetView,
  onClearSelection,
  onSelectPoint,
  onRequestDirections,
  onOpenStreetView,
  onShareParkingLink,
  onToggleSavedPoint,
  onOpenDetails,
  onPlaceRouteWaypoint,
  onViewportChange,
  onBrowseLocation,
  offlineAreaSelectionBounds = null,
}: CycleParkingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onViewportChangeRef = useRef(onViewportChange);
  const onBrowseLocationRef = useRef(onBrowseLocation);
  const selectedPointIdRef = useRef(selectedPointId);
  const parkingMarkerRefs = useRef(new Map<string, RenderedMarker>());
  const startMarkerRef = useRef<RenderedMarker | null>(null);
  const liveMarkerRef = useRef<RenderedMarker | null>(null);
  const instructionMarkerRef = useRef<RenderedMarker | null>(null);
  const routeWaypointMarkerRefs = useRef(new Map<string, RenderedMarker>());
  const cycleNetworkPopupRef = useRef<MapLibrePopup | null>(null);
  const cycleNetworkPopupRootRef = useRef<Root | null>(null);
  const previousFocusTargetRef = useRef<MapFocusTarget | null>(null);
  const previousParkingViewRef = useRef(parkingView);
  const nearbyCameraRef = useRef<{
    center: [number, number];
    zoom: number;
  } | null>(null);
  const previousJourneyModeRef = useRef(isRoutePlanningMode);
  const discoveryCameraRef = useRef<{
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  } | null>(null);
  const suppressParkingViewFocusRef = useRef(false);
  const hasAppliedNearbyFocusRef = useRef(false);
  const isAutomaticFocusAnimationRef = useRef(false);
  const mobileSheetStateRef = useRef(mobileSheetState);
  const previousMobileSheetStateRef = useRef(mobileSheetState);
  const previousRouteSheetStateRef = useRef(mobileSheetState);
  const centeredCollapsedPopupPointRef = useRef<string | null>(null);
  const centeredExpandedPopupPointRef = useRef<string | null>(null);
  const deferredExpandedSelectionFocusRef = useRef<string | null>(null);
  const previousSelectedPointIdRef = useRef(selectedPointId);
  const hasUserAdjustedSelectionCameraRef = useRef(false);
  const hasCompletedNearbySelectionFocusRef = useRef(false);
  const suppressNextSelectionClearFocusRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const savedCameraRef = useRef<{
    center: [number, number];
    zoom: number;
  } | null>(null);
  const initialBasemapThemeRef = useRef(theme);
  const initialLocaleRef = useRef(locale);
  const activeBasemapThemeRef = useRef(theme);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isOfflineBasemap, setIsOfflineBasemap] = useState(false);
  const [renderedBasemapFeatureCount, setRenderedBasemapFeatureCount] =
    useState(0);
  const [styleRevision, setStyleRevision] = useState(0);
  const [selectedCycleNetworkRouteKey, setSelectedCycleNetworkRouteKey] =
    useState<string | null>(null);
  const [viewport, setViewport] = useState<{
    bounds: ParkingMapBounds | null;
    center: [number, number] | null;
    zoom: number;
  }>({
    bounds: null,
    center: null,
    zoom: 13,
  });
  const cycleNetworkBundles = useMemo(
    () => getCycleNetworkRouteBundles(cycleNetworkFeatures),
    [cycleNetworkFeatures],
  );
  onViewportChangeRef.current = onViewportChange;
  onBrowseLocationRef.current = onBrowseLocation;
  const closeCycleNetworkPopup = useCallback(() => {
    const popup = cycleNetworkPopupRef.current;
    const root = cycleNetworkPopupRootRef.current;
    cycleNetworkPopupRef.current = null;
    cycleNetworkPopupRootRef.current = null;
    setSelectedCycleNetworkRouteKey(null);
    if (popup?.isOpen()) {
      popup.remove();
    } else {
      root?.unmount();
    }
  }, []);
  const closeMarkerPopups = useCallback((exceptPointId?: string) => {
    startMarkerRef.current?.popup?.remove();
    parkingMarkerRefs.current.forEach((renderedMarker, pointId) => {
      if (pointId !== exceptPointId) {
        renderedMarker.popup?.remove();
      }
    });
  }, []);
  const handleViewportChange = useCallback(
    ({ bounds, zoom }: { bounds: ParkingMapBounds; zoom: number }) => {
      onViewportChangeRef.current(bounds, zoom);
      const mapCenter = mapRef.current?.getCenter();
      const center = mapCenter
        ? ([mapCenter.lng, mapCenter.lat] satisfies [number, number])
        : null;
      setViewport((current) => {
        if (
          current.zoom === zoom &&
          current.center?.[0] === center?.[0] &&
          current.center?.[1] === center?.[1] &&
          current.bounds?.north === bounds.north &&
          current.bounds.south === bounds.south &&
          current.bounds.east === bounds.east &&
          current.bounds.west === bounds.west
        ) {
          return current;
        }

        return { bounds, center, zoom };
      });
    },
    [],
  );
  const updateViewport = useCallback(() => {
    if (!mapRef.current || frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;

      if (!mapRef.current) {
        return;
      }

      handleViewportChange({
        bounds: getVisibleMapBounds(mapRef.current),
        zoom: mapRef.current.getZoom(),
      });
    });
  }, [handleViewportChange]);
  const selectedInstruction = useMemo(() => {
    if (!route || !routeInstructionFocusRequest) {
      return null;
    }

    return (
      route.instructions.find(
        (instruction) => instruction.id === routeInstructionFocusRequest.id,
      ) ?? null
    );
  }, [route, routeInstructionFocusRequest]);
  const rankedPointRanks = useMemo(() => {
    return new Map(
      rankedPoints
        .slice(0, rankedPointCount)
        .map((point, index) => [point.id, index + 1]),
    );
  }, [rankedPoints]);
  const savedPointKeySet = useMemo(
    () => new Set(savedPointKeys),
    [savedPointKeys],
  );
  const highlightedPoints = useMemo(
    () => rankedPoints.slice(0, highlightedRankCount),
    [rankedPoints],
  );
  const finalApproachPositions = useMemo(
    () =>
      isRoutePlanningMode
        ? null
        : getFinalApproachPositions(route, selectedPoint),
    [isRoutePlanningMode, route, selectedPoint],
  );
  const initialApproachPositions = useMemo(
    () =>
      isRoutePlanningMode
        ? null
        : getInitialApproachPositions(route, userLocation),
    [isRoutePlanningMode, route, userLocation],
  );
  const routeFocusPoints = useMemo(() => {
    if (isRoutePlanningMode) {
      const waypointPoints = routeWaypoints.map(
        (waypoint) =>
          [waypoint.latitude, waypoint.longitude] satisfies CycleRoutePoint,
      );
      return showCurrentLocationMarker
        ? [userLocationToPoint(userLocation), ...waypointPoints]
        : waypointPoints;
    }

    return routeWaypoints.length >= 2
      ? routeWaypoints.map(
          (waypoint) =>
            [waypoint.latitude, waypoint.longitude] satisfies CycleRoutePoint,
        )
      : [
          userLocationToPoint(userLocation),
          ...(selectedPoint ? [parkingPointToRoutePoint(selectedPoint)] : []),
        ];
  }, [
    isRoutePlanningMode,
    routeWaypoints,
    selectedPoint,
    showCurrentLocationMarker,
    referenceLocationLabel,
    isReferenceCurrentLocation,
    userLocation,
  ]);
  const visiblePoints = useMemo(
    () =>
      isDestinationParkingMode
        ? points
        : isRoutePlanningMode
          ? []
          : isDirectionsMode && selectedPoint
            ? [selectedPoint]
            : getRenderableParkingPoints({
                bounds: viewport.bounds,
                pinnedPoints: rankedPoints,
                points,
                selectedPoint,
                zoom: viewport.zoom,
              }),
    [
      isDirectionsMode,
      isDestinationParkingMode,
      isRoutePlanningMode,
      points,
      rankedPoints,
      selectedPoint,
      viewport.bounds,
      viewport.zoom,
    ],
  );

  useEffect(() => {
    mobileSheetStateRef.current = mobileSheetState;
  }, [mobileSheetState]);

  useEffect(() => {
    selectedPointIdRef.current = selectedPointId;
  }, [selectedPointId]);

  useEffect(() => {
    const container = mapContainerRef.current;

    if (!container || mapRef.current) {
      return;
    }

    const abortController = new AbortController();
    let nextMap: MapLibreMap | null = null;
    let isDisposed = false;
    const stopAutomaticFocusOnInteraction = () => {
      if (selectedPointIdRef.current !== null) {
        hasUserAdjustedSelectionCameraRef.current = true;
      }
      if (!isAutomaticFocusAnimationRef.current) {
        return;
      }

      isAutomaticFocusAnimationRef.current = false;
      nextMap?.stop();
    };

    const createMap = (
      style: StyleSpecification | string,
      offlineBasemap = false,
    ) => {
      if (isDisposed) {
        return;
      }

      const mapInstance = new maplibregl.Map({
        attributionControl: false,
        center: savedCameraRef.current?.center ?? toLngLat(defaultCenter),
        container,
        dragRotate: false,
        locale: getMapLibreLocale(initialLocaleRef.current),
        minZoom: 1,
        pitchWithRotate: false,
        style,
        touchPitch: false,
        zoom: savedCameraRef.current?.zoom ?? 13,
      });
      nextMap = mapInstance;
      setIsOfflineBasemap(offlineBasemap);
      mapInstance.touchZoomRotate.disableRotation();
      container.addEventListener(
        'pointerdown',
        stopAutomaticFocusOnInteraction,
        { capture: true },
      );
      container.addEventListener('wheel', stopAutomaticFocusOnInteraction, {
        capture: true,
        passive: true,
      });
      container.addEventListener('keydown', stopAutomaticFocusOnInteraction, {
        capture: true,
      });
      const navigationControl = new maplibregl.NavigationControl({
        showCompass: false,
      });
      const attributionControl = new maplibregl.AttributionControl({
        compact: false,
      });

      mapInstance.addControl(navigationControl, 'top-left');
      mapInstance.addControl(attributionControl, 'bottom-right');
      mapInstance.setMissingStyleImageResolver((id) => {
        if (mapInstance.hasImage(id)) {
          return;
        }

        mapInstance.addImage(id, {
          data: new Uint8Array([0, 0, 0, 0]),
          height: 1,
          width: 1,
        });
      });
      mapInstance.on('load', () => {
        setIsMapLoaded(true);
        setStyleRevision((revision) => revision + 1);
        handleViewportChange({
          bounds: getVisibleMapBounds(mapInstance),
          zoom: mapInstance.getZoom(),
        });
      });
      mapInstance.on('idle', () => {
        const count = mapInstance
          .queryRenderedFeatures()
          .filter(
            (feature) =>
              feature.source === 'openmaptiles' ||
              feature.source === 'offline-test-rendered',
          ).length;
        setRenderedBasemapFeatureCount(count);
      });
      mapInstance.on('moveend', (event) => {
        isAutomaticFocusAnimationRef.current = false;
        // Remember intentional browsing, not startup focus, GPS, or route fits.
        if (event.originalEvent) {
          const bounds = getVisibleMapBounds(mapInstance);
          onBrowseLocationRef.current?.({
            latitude: (bounds.north + bounds.south) / 2,
            longitude: (bounds.east + bounds.west) / 2,
          });
        }
        handleViewportChange({
          bounds: getVisibleMapBounds(mapInstance),
          zoom: mapInstance.getZoom(),
        });
      });
      mapInstance.on('zoomend', () => {
        handleViewportChange({
          bounds: getVisibleMapBounds(mapInstance),
          zoom: mapInstance.getZoom(),
        });
      });

      mapRef.current = mapInstance;
      setMap(mapInstance);
    };

    void loadMapLibreBasemapStyle(
      abortController.signal,
      initialBasemapThemeRef.current,
    )
      .then((style) => createMap(style))
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        console.warn('Falling back to the offline map background.', error);
        createMap(
          createOfflineBasemapStyle(initialBasemapThemeRef.current),
          true,
        );
      });

    return () => {
      isDisposed = true;
      abortController.abort();
      container.removeEventListener(
        'pointerdown',
        stopAutomaticFocusOnInteraction,
        { capture: true },
      );
      container.removeEventListener('wheel', stopAutomaticFocusOnInteraction, {
        capture: true,
      });
      container.removeEventListener(
        'keydown',
        stopAutomaticFocusOnInteraction,
        { capture: true },
      );

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      parkingMarkerRefs.current.forEach(cleanupRenderedMarker);
      parkingMarkerRefs.current.clear();
      cleanupRenderedMarker(startMarkerRef.current);
      cleanupRenderedMarker(liveMarkerRef.current);
      cleanupRenderedMarker(instructionMarkerRef.current);
      closeCycleNetworkPopup();
      startMarkerRef.current = null;
      liveMarkerRef.current = null;
      instructionMarkerRef.current = null;
      if (nextMap) {
        const center = nextMap.getCenter();
        savedCameraRef.current = {
          center: [center.lng, center.lat],
          zoom: nextMap.getZoom(),
        };
        nextMap.remove();
      }
      mapRef.current = null;
      setMap(null);
      setIsMapLoaded(false);
      setRenderedBasemapFeatureCount(0);
    };
  }, [closeCycleNetworkPopup, handleViewportChange, updateViewport]);

  useEffect(() => {
    if (!map) {
      return;
    }

    applyMapLibreLocale(map, locale);
  }, [locale, map]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const container = map.getContainer();
    container.classList.toggle('bike-map-dark', theme === 'dark');
    container.classList.toggle('bike-map-light', theme === 'light');
  }, [map, theme]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const abortController = new AbortController();
    const applyStyle = (style: StyleSpecification, offlineBasemap: boolean) => {
      setIsMapLoaded(false);
      setIsOfflineBasemap(offlineBasemap);
      setRenderedBasemapFeatureCount(0);
      void map.once('style.load', () => {
        setIsMapLoaded(true);
        setStyleRevision((revision) => revision + 1);
        handleViewportChange({
          bounds: getVisibleMapBounds(map),
          zoom: map.getZoom(),
        });
      });
      map.setStyle(style);
    };
    const handleOnline = () => {
      if (!isOfflineBasemap) {
        return;
      }
      void loadMapLibreBasemapStyle(abortController.signal, theme)
        .then((style) => applyStyle(style, false))
        .catch(() => {
          // Keep the dependable local background until the provider is reachable.
        });
    };

    window.addEventListener('online', handleOnline);

    return () => {
      abortController.abort();
      window.removeEventListener('online', handleOnline);
    };
  }, [handleViewportChange, isOfflineBasemap, map, theme]);

  useEffect(() => {
    if (!map || !isMapLoaded) {
      return;
    }

    const coordinates = offlineAreaSelectionBounds
      ? [
          [
            [offlineAreaSelectionBounds.west, offlineAreaSelectionBounds.north],
            [offlineAreaSelectionBounds.east, offlineAreaSelectionBounds.north],
            [offlineAreaSelectionBounds.east, offlineAreaSelectionBounds.south],
            [offlineAreaSelectionBounds.west, offlineAreaSelectionBounds.south],
            [offlineAreaSelectionBounds.west, offlineAreaSelectionBounds.north],
          ],
        ]
      : [];
    const data = {
      type: 'FeatureCollection' as const,
      features: offlineAreaSelectionBounds
        ? [
            {
              type: 'Feature' as const,
              properties: {},
              geometry: {
                type: 'Polygon' as const,
                coordinates,
              },
            },
          ]
        : [],
    };
    const source = map.getSource(offlineAreaSelectionSourceId) as
      | GeoJSONSource
      | undefined;

    if (source) {
      void source.setData(data);
    } else {
      map.addSource(offlineAreaSelectionSourceId, {
        type: 'geojson',
        data,
      });
    }

    if (!map.getLayer(offlineAreaSelectionFillLayerId)) {
      map.addLayer({
        id: offlineAreaSelectionFillLayerId,
        type: 'fill',
        source: offlineAreaSelectionSourceId,
        paint: {
          'fill-color': theme === 'dark' ? '#5eead4' : '#0f766e',
          'fill-opacity': 0.1,
        },
      });
    }
    if (!map.getLayer(offlineAreaSelectionLineLayerId)) {
      map.addLayer({
        id: offlineAreaSelectionLineLayerId,
        type: 'line',
        source: offlineAreaSelectionSourceId,
        paint: {
          'line-color': theme === 'dark' ? '#99f6e4' : '#0b5c55',
          'line-dasharray': [2, 1.5],
          'line-width': 3,
        },
      });
    }
  }, [isMapLoaded, map, offlineAreaSelectionBounds, styleRevision, theme]);

  useEffect(() => {
    if (!map || activeBasemapThemeRef.current === theme) {
      return;
    }

    const abortController = new AbortController();
    let isActive = true;

    const handleStyleLoad = () => {
      if (!isActive) {
        return;
      }

      activeBasemapThemeRef.current = theme;
      setIsMapLoaded(true);
      setStyleRevision((revision) => revision + 1);
      handleViewportChange({
        bounds: getVisibleMapBounds(map),
        zoom: map.getZoom(),
      });
    };
    const applyStyle = (
      style: StyleSpecification | string,
      offlineBasemap = false,
    ) => {
      if (!isActive) {
        return;
      }

      setIsMapLoaded(false);
      setIsOfflineBasemap(offlineBasemap);
      void map.once('style.load', handleStyleLoad);
      map.setStyle(style);
    };

    void loadMapLibreBasemapStyle(abortController.signal, theme)
      .then((style) => applyStyle(style))
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        console.warn('Falling back to the offline map background.', error);
        applyStyle(createOfflineBasemapStyle(theme), true);
      });

    return () => {
      isActive = false;
      abortController.abort();
      map.off('style.load', handleStyleLoad);
    };
  }, [handleViewportChange, map, theme]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const mapElement = map.getContainer();
    const controlPane = document.querySelector<HTMLElement>('.control-pane');
    const resizeMap = () => {
      map.resize();
      updateViewport();
    };

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resizeMap);

      return () => window.removeEventListener('resize', resizeMap);
    }

    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(mapElement);

    if (controlPane) {
      resizeObserver.observe(controlPane);
    }

    window.addEventListener('resize', resizeMap);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeMap);
    };
  }, [map, mobileSheetState, updateViewport]);

  useEffect(() => {
    if (!map || previousJourneyModeRef.current === isRoutePlanningMode) return;
    previousJourneyModeRef.current = isRoutePlanningMode;
    if (isRoutePlanningMode) {
      const center = map.getCenter();
      discoveryCameraRef.current = {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
    } else if (discoveryCameraRef.current) {
      map.stop();
      map.jumpTo(discoveryCameraRef.current);
      suppressParkingViewFocusRef.current = true;
    }
  }, [map, isRoutePlanningMode]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const previousView = previousParkingViewRef.current;
    previousParkingViewRef.current = parkingView;
    if (previousView === parkingView) {
      return;
    }

    suppressParkingViewFocusRef.current = true;
    if (previousView === 'nearby' && parkingView === 'saved') {
      const center = map.getCenter();
      nearbyCameraRef.current = {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
      };
      return;
    }

    if (previousView === 'saved' && parkingView === 'nearby') {
      const camera = nearbyCameraRef.current;
      if (camera) {
        map.jumpTo(camera);
      }
    }
  }, [map, parkingView]);

  useEffect(() => {
    if (!map || !isMapLoaded) {
      return;
    }

    syncCycleNetworkLayers({
      bundles: cycleNetworkBundles,
      features: isCycleNetworkVisible ? cycleNetworkFeatures : [],
      isDirectionsMode: isDirectionsMode && !isRoutePlanningMode,
      map,
      selectedRouteKey: selectedCycleNetworkRouteKey,
      theme,
    });
  }, [
    cycleNetworkBundles,
    cycleNetworkFeatures,
    isCycleNetworkVisible,
    isDirectionsMode,
    isRoutePlanningMode,
    isMapLoaded,
    map,
    selectedCycleNetworkRouteKey,
    styleRevision,
    theme,
  ]);

  useEffect(() => {
    if (
      !map ||
      !isMapLoaded ||
      isRoutePlanningMode ||
      !map.getLayer(cycleNetworkHitLayerId)
    ) {
      return;
    }

    const featuresById = new Map(
      cycleNetworkFeatures.map((feature) => [feature.id, feature]),
    );
    const featuresBySegmentId = new Map(
      cycleNetworkFeatures.map((feature) => [
        String(feature.properties.segmentId),
        feature,
      ]),
    );
    const openCycleNetworkPopup = (
      feature: CycleNetworkFeature,
      coRoutes: CycleNetworkRouteIdentity[],
      lngLat: maplibregl.LngLat,
    ) => {
      const selectedRouteIdentity = getCycleNetworkRouteIdentity(feature);
      if (!selectedRouteIdentity) return;
      closeCycleNetworkPopup();
      closeMarkerPopups();
      if (selectedPoint) {
        suppressNextSelectionClearFocusRef.current = true;
        onClearSelection();
      }
      setSelectedCycleNetworkRouteKey(selectedRouteIdentity.key);
      const { popup, root } = createRenderedPopup(
        <CycleNetworkPopupContent
          coRoutes={coRoutes}
          feature={feature}
          locale={locale}
        />,
        {
          anchor: 'bottom',
          closeButton: true,
          closeOnClick: true,
          offset: 8,
        },
      );
      cycleNetworkPopupRef.current = popup;
      cycleNetworkPopupRootRef.current = root;
      popup.once('close', () => {
        root.unmount();
        if (cycleNetworkPopupRef.current === popup) {
          cycleNetworkPopupRef.current = null;
          cycleNetworkPopupRootRef.current = null;
          setSelectedCycleNetworkRouteKey(null);
        }
      });
      popup.setLngLat(lngLat).addTo(map);
      window.requestAnimationFrame(() => keepPopupInVisibleMapArea(map, popup));
    };
    const handleLineClick = (event: maplibregl.MapLayerMouseEvent) => {
      // Combined shields are informational: selecting a route from the group
      // without a distinct hit target would silently favour one route.
      if (
        map.queryRenderedFeatures(event.point, {
          layers: [cycleNetworkBundleLayerId],
        }).length > 0
      ) {
        return;
      }
      const renderedFeature = event.features?.[0];
      const feature = renderedFeature
        ? (featuresById.get(String(renderedFeature.id)) ??
          featuresBySegmentId.get(String(renderedFeature.properties.segmentId)))
        : null;
      if (!feature) return;
      const coRoutes = getCycleNetworkCoRoutes(feature, cycleNetworkBundles, [
        event.lngLat.lng,
        event.lngLat.lat,
      ]);
      openCycleNetworkPopup(feature, coRoutes, event.lngLat);
    };
    const showPointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('click', cycleNetworkHitLayerId, handleLineClick);
    map.on('mouseenter', cycleNetworkHitLayerId, showPointer);
    map.on('mouseleave', cycleNetworkHitLayerId, clearPointer);
    return () => {
      map.off('click', cycleNetworkHitLayerId, handleLineClick);
      map.off('mouseenter', cycleNetworkHitLayerId, showPointer);
      map.off('mouseleave', cycleNetworkHitLayerId, clearPointer);
      clearPointer();
    };
  }, [
    closeCycleNetworkPopup,
    closeMarkerPopups,
    cycleNetworkBundles,
    cycleNetworkFeatures,
    isMapLoaded,
    isRoutePlanningMode,
    locale,
    map,
    onClearSelection,
    selectedPoint,
    styleRevision,
  ]);

  useEffect(() => {
    if (isCycleNetworkVisible && !isRoutePlanningMode) return;
    closeCycleNetworkPopup();
  }, [closeCycleNetworkPopup, isCycleNetworkVisible, isRoutePlanningMode]);

  useEffect(() => {
    closeCycleNetworkPopup();
  }, [closeCycleNetworkPopup, locale, theme]);

  useEffect(() => {
    if (!map || !isMapLoaded) {
      return;
    }

    syncLineLayer({
      data: createLineData(route?.points ?? null, route?.segments),
      id: 'route-line',
      map,
      style:
        route?.source === 'local'
          ? isRouteCalculationLoading
            ? {
                color: '#0f766e',
                dashArray: [1.2, 1.8],
                opacity: 0.76,
                width: 5,
              }
            : {
                color: '#f97316',
                dashArray: [1.5, 2],
                opacity: 0.9,
                width: 4,
              }
          : {
              color: '#2563eb',
              opacity: 0.82,
              width: 6,
            },
    });
    syncLineLayer({
      data: createLineData(initialApproachPositions),
      id: 'initial-approach-line',
      map,
      style: {
        color: '#f97316',
        dashArray: [1.5, 2],
        opacity: 0.9,
        width: 4,
      },
    });
    syncLineLayer({
      data: createLineData(finalApproachPositions),
      id: 'final-approach-line',
      map,
      style: {
        color: '#f97316',
        dashArray: [1.5, 2],
        opacity: 0.9,
        width: 4,
      },
    });
  }, [
    finalApproachPositions,
    initialApproachPositions,
    isMapLoaded,
    isRouteCalculationLoading,
    map,
    route,
    styleRevision,
  ]);

  useEffect(() => {
    if (!map) {
      return;
    }

    cleanupRenderedMarker(startMarkerRef.current);
    startMarkerRef.current = null;

    if (isRoutePlanningMode && !showCurrentLocationMarker) {
      return;
    }

    const { popup, root } = createRenderedPopup(
      <StartPopupContent locale={locale} label={referenceLocationLabel} />,
      {
        closeButton: true,
        closeOnClick: true,
        offset: [0, -32],
      },
    );
    const element = createPinMarkerElement(
      isReferenceCurrentLocation
        ? 'start-marker'
        : 'start-marker reference-marker',
    );
    if (showCurrentLocationMarker) {
      element.style.zIndex = '1250';
    }
    element.setAttribute('aria-label', referenceLocationLabel);
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    const marker = new maplibregl.Marker({
      anchor: 'bottom',
      element,
    })
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .setPopup(popup)
      .addTo(map);

    const openStartPopup = () => {
      closeCycleNetworkPopup();
      closeMarkerPopups();
      popup
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);
    };
    element.onclick = (event) => {
      event.stopImmediatePropagation();
      openStartPopup();
    };
    element.onkeydown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      openStartPopup();
    };

    startMarkerRef.current = {
      marker,
      popup,
      popupRoot: root,
    };

    return () => {
      cleanupRenderedMarker(startMarkerRef.current);
      startMarkerRef.current = null;
    };
  }, [
    closeCycleNetworkPopup,
    closeMarkerPopups,
    isRoutePlanningMode,
    locale,
    map,
    showCurrentLocationMarker,
    referenceLocationLabel,
    isReferenceCurrentLocation,
    userLocation,
  ]);

  useEffect(() => {
    if (!map) {
      return;
    }

    routeWaypointMarkerRefs.current.forEach(cleanupRenderedMarker);
    routeWaypointMarkerRefs.current.clear();

    routeWaypoints.forEach((waypoint, index) => {
      const element = createRouteWaypointMarkerElement(
        index,
        index === routeWaypoints.length - 1,
        waypoint.id === activeRouteWaypointId,
      );
      element.setAttribute('aria-label', waypoint.label);
      const marker = new maplibregl.Marker({ anchor: 'bottom', element })
        .setLngLat([waypoint.longitude, waypoint.latitude])
        .addTo(map);
      routeWaypointMarkerRefs.current.set(waypoint.id, { element, marker });
    });

    return () => {
      routeWaypointMarkerRefs.current.forEach(cleanupRenderedMarker);
      routeWaypointMarkerRefs.current.clear();
    };
  }, [activeRouteWaypointId, map, routeWaypoints]);

  useEffect(() => {
    if (!map) {
      return;
    }

    cleanupRenderedMarker(liveMarkerRef.current);
    liveMarkerRef.current = null;

    if (!liveRouteMarker) {
      return;
    }

    const element = createLiveRouteMarkerElement({
      headingDegrees: liveRouteMarker.headingDegrees,
      isOffRoute: liveRouteMarker.isOffRoute,
    });
    element.style.zIndex = '1250';

    const marker = new maplibregl.Marker({
      anchor: 'center',
      element,
    })
      .setLngLat(toLngLat(liveRouteMarker.position))
      .addTo(map);

    liveMarkerRef.current = { marker };

    return () => {
      cleanupRenderedMarker(liveMarkerRef.current);
      liveMarkerRef.current = null;
    };
  }, [liveRouteMarker, map]);

  useEffect(() => {
    if (!map) {
      return;
    }

    cleanupRenderedMarker(instructionMarkerRef.current);
    instructionMarkerRef.current = null;

    if (!selectedInstruction) {
      return;
    }

    const element = createSelectedInstructionMarkerElement(
      getRouteInstructionManeuver(selectedInstruction),
    );
    element.style.zIndex = '900';

    const marker = new maplibregl.Marker({
      anchor: 'center',
      element,
    })
      .setLngLat(toLngLat(selectedInstruction.anchor))
      .addTo(map);

    instructionMarkerRef.current = { marker };

    return () => {
      cleanupRenderedMarker(instructionMarkerRef.current);
      instructionMarkerRef.current = null;
    };
  }, [map, selectedInstruction]);

  useEffect(() => {
    if (!map) {
      return;
    }

    if (!selectedPoint) {
      centeredCollapsedPopupPointRef.current = null;
      centeredExpandedPopupPointRef.current = null;
    }

    const reconciledVisiblePoints =
      (!isRoutePlanningMode || isDestinationParkingMode) &&
      selectedPoint &&
      !visiblePoints.some((point) => point.id === selectedPoint.id)
        ? [selectedPoint, ...visiblePoints]
        : visiblePoints;
    const visiblePointIds = new Set(
      reconciledVisiblePoints.map((point) => point.id),
    );

    parkingMarkerRefs.current.forEach((renderedMarker, pointId) => {
      if (!visiblePointIds.has(pointId)) {
        cleanupRenderedMarker(renderedMarker);
        parkingMarkerRefs.current.delete(pointId);
      }
    });

    reconciledVisiblePoints.forEach((point) => {
      const pointCategory: 'parking' | CyclingPoiCategory = isCyclingPoiPoint(
        point,
      )
        ? (point.categories[0] ?? 'hire')
        : 'parking';
      const rank = rankedPointRanks.get(point.id);
      const isSaved = savedPointKeySet.has(getPointSavedNeukKey(point));
      const isSelected = point.id === selectedPoint?.id;
      const presentation = getParkingMarkerPresentation({
        isDirectionsMode: isDirectionsMode && !isDestinationParkingMode,
        isSaved,
        isSelected,
        parkingView,
        rank,
      });
      if (pointCategory !== 'parking') {
        presentation.className = `${presentation.className} cycling-poi-marker cycling-poi-marker-${pointCategory}`;
      }
      const popupContent = (
        <ParkingPopupContent
          canRequestDirections={canRequestDirections}
          canShowStreetView={canShowStreetView}
          copiedShareButton={copiedShareButton}
          isDirectionsMode={isDirectionsMode}
          isSaved={isSaved}
          onShareParkingLink={onShareParkingLink}
          onOpenStreetView={onOpenStreetView}
          onRequestDirections={onRequestDirections}
          onToggleSavedPoint={onToggleSavedPoint}
          point={point}
          locale={locale}
        />
      );
      const existingMarker = parkingMarkerRefs.current.get(point.id);
      const canReuseMarker =
        existingMarker?.element &&
        existingMarker.anchor === presentation.anchor;
      let renderedMarker = existingMarker;

      if (existingMarker && !canReuseMarker) {
        cleanupRenderedMarker(existingMarker);
        renderedMarker = undefined;
      }

      if (renderedMarker?.element && renderedMarker.popupRoot) {
        updateMarkerElement(
          renderedMarker.element,
          presentation.className,
          presentation.label,
        );
        updateCyclingPoiMarkerIcon(renderedMarker.element, pointCategory);
        updateMarkerSavedBadge(
          renderedMarker.element,
          isSaved && !isDirectionsMode,
        );
        renderedMarker.element.style.zIndex = presentation.zIndex;
        renderedMarker.popupRoot.render(popupContent);
        renderedMarker.popup?.setOffset(presentation.offset);
        renderedMarker.marker.setLngLat([point.longitude, point.latitude]);
      } else {
        const { popup, root } = createRenderedPopup(popupContent, {
          anchor: presentation.popupAnchor,
          offset: presentation.offset,
        });
        const element = createMarkerElement(
          presentation.className,
          presentation.label,
        );
        updateCyclingPoiMarkerIcon(element, pointCategory);
        updateMarkerSavedBadge(element, isSaved && !isDirectionsMode);
        const marker = new maplibregl.Marker({
          anchor: presentation.anchor,
          element,
        })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(popup)
          .addTo(map);

        renderedMarker = {
          anchor: presentation.anchor,
          element,
          marker,
          popup,
          popupRoot: root,
        };
        parkingMarkerRefs.current.set(point.id, renderedMarker);
      }

      const markerElement = renderedMarker.element;

      if (!markerElement) {
        return;
      }

      const markerLabel = [
        point.name,
        rank
          ? translate(locale, 'rank', { count: rank })
          : translate(
              locale,
              pointCategory === 'parking'
                ? 'genericParking'
                : pointCategory === 'water'
                  ? 'drinkingWater'
                  : pointCategory === 'shop'
                    ? 'categoryShop'
                    : pointCategory === 'repair'
                      ? 'categoryRepairPlace'
                      : 'categoryHirePlace',
            ),
        isSelected ? translate(locale, 'selected') : null,
        isSaved ? translate(locale, 'savedMarker') : null,
      ]
        .filter(Boolean)
        .join(', ');
      markerElement.setAttribute('aria-label', markerLabel);
      markerElement.setAttribute('role', 'button');
      markerElement.setAttribute('title', point.name);
      markerElement.dataset.testid = `parking-marker-${point.id}`;
      if (isSaved) {
        markerElement.dataset.saved = 'true';
      } else {
        delete markerElement.dataset.saved;
      }
      const interactionDisabled = isDirectionsMode && !isDestinationParkingMode;
      markerElement.tabIndex = interactionDisabled ? -1 : 0;

      markerElement.onclick = interactionDisabled
        ? null
        : (event) => {
            event.stopImmediatePropagation();
            if (isDestinationParkingMode) {
              onSelectPoint(point.id);
              return;
            }
            closeCycleNetworkPopup();
            closeMarkerPopups(point.id);
            renderedMarker.popup
              ?.setLngLat([point.longitude, point.latitude])
              .addTo(map);
            if (
              pointCategory === 'parking' &&
              window.matchMedia('(max-width: 820px)').matches
            ) {
              onOpenDetails(point);
            } else {
              onSelectPoint(point.id);
            }
          };
      markerElement.onkeydown = interactionDisabled
        ? null
        : (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
              return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();
            if (isDestinationParkingMode) {
              onSelectPoint(point.id);
              return;
            }
            closeCycleNetworkPopup();
            closeMarkerPopups(point.id);
            renderedMarker.popup
              ?.setLngLat([point.longitude, point.latitude])
              .addTo(map);
            if (
              pointCategory === 'parking' &&
              window.matchMedia('(max-width: 820px)').matches
            ) {
              onOpenDetails(point);
            } else {
              onSelectPoint(point.id);
            }
          };

      if (isSelected) {
        markerElement.style.zIndex = presentation.zIndex;

        if (route) {
          renderedMarker.popup?.remove();
        }
      } else {
        renderedMarker.popup?.remove();
      }
    });

    const currentSelectedPoint = selectedPoint;
    const selectedEntry = currentSelectedPoint
      ? parkingMarkerRefs.current.get(currentSelectedPoint.id)
      : null;

    if (
      currentSelectedPoint &&
      selectedEntry?.popup &&
      !route &&
      !isDestinationParkingMode
    ) {
      closeCycleNetworkPopup();
      closeMarkerPopups(currentSelectedPoint.id);
      selectedEntry.popup
        .setLngLat([
          currentSelectedPoint.longitude,
          currentSelectedPoint.latitude,
        ])
        .addTo(map);
    }
  }, [
    canRequestDirections,
    canShowStreetView,
    closeCycleNetworkPopup,
    closeMarkerPopups,
    copiedShareButton,
    isDirectionsMode,
    isDestinationParkingMode,
    isRoutePlanningMode,
    locale,
    map,
    onShareParkingLink,
    onOpenDetails,
    onOpenStreetView,
    onRequestDirections,
    onSelectPoint,
    onToggleSavedPoint,
    parkingView,
    rankedPointRanks,
    route,
    selectedPoint,
    savedPointKeySet,
    visiblePoints,
  ]);

  useEffect(() => {
    if (!map || !selectedPoint || route || isDestinationParkingMode) {
      return;
    }

    const isMobile = window.matchMedia('(max-width: 820px)').matches;
    if (
      (isMobile && mobileSheetState !== 'collapsed') ||
      (isMobile && previousMobileSheetStateRef.current !== 'collapsed') ||
      centeredCollapsedPopupPointRef.current === selectedPoint.id
    ) {
      return;
    }

    // Keep this timer independent from marker reconciliation. The tray resize
    // changes the visible chunks while it animates and used to cancel the pan.
    const timeoutId = window.setTimeout(
      () => {
        const popup = parkingMarkerRefs.current.get(selectedPoint.id)?.popup;
        if (
          !popup?.isOpen() ||
          (window.matchMedia('(max-width: 820px)').matches &&
            mobileSheetStateRef.current !== 'collapsed')
        ) {
          return;
        }

        centerPopupInVisibleMapArea(map, popup);
        centeredCollapsedPopupPointRef.current = selectedPoint.id;
      },
      isMobile ? collapsedSheetPopupFocusDelayMs : 100,
    );

    return () => window.clearTimeout(timeoutId);
  }, [isDestinationParkingMode, map, mobileSheetState, route, selectedPoint]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const target = event.originalEvent.target;
      const isInteractiveTarget =
        target instanceof Element &&
        Boolean(
          target.closest(
            '.parking-marker, .route-waypoint-marker, .maplibregl-popup, .maplibregl-ctrl',
          ),
        );

      if (isRouteWaypointPlacementActive && onPlaceRouteWaypoint) {
        if (isInteractiveTarget) {
          return;
        }
        onPlaceRouteWaypoint({
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
        });
        return;
      }

      if (!selectedPoint || route) {
        return;
      }

      const clearSelectionWithoutRefocus = () => {
        suppressNextSelectionClearFocusRef.current = true;
        onClearSelection();
      };
      if (!(target instanceof Element)) {
        clearSelectionWithoutRefocus();
        return;
      }

      if (
        isInteractiveTarget ||
        (map.getLayer(cycleNetworkHitLayerId) &&
          map.queryRenderedFeatures(event.point, {
            layers: [cycleNetworkHitLayerId],
          }).length > 0)
      ) {
        return;
      }

      clearSelectionWithoutRefocus();
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [
    isDestinationParkingMode,
    isRouteWaypointPlacementActive,
    map,
    onClearSelection,
    onPlaceRouteWaypoint,
    route,
    selectedPoint,
  ]);

  useEffect(() => {
    if (!map) {
      return;
    }
    map.getCanvas().style.cursor = isRouteWaypointPlacementActive
      ? 'crosshair'
      : '';
    return () => {
      map.getCanvas().style.cursor = '';
    };
  }, [isRouteWaypointPlacementActive, map]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const previousMobileSheetState = previousMobileSheetStateRef.current;
    previousMobileSheetStateRef.current = mobileSheetState;
    const isNewExpandedSelection =
      window.matchMedia('(max-width: 820px)').matches &&
      mobileSheetState === 'expanded' &&
      centeredExpandedPopupPointRef.current !== selectedPoint?.id;

    if (
      (previousMobileSheetState === mobileSheetState &&
        !isNewExpandedSelection) ||
      !selectedPoint ||
      route
    ) {
      return;
    }

    const shouldDeferSelectionFocus =
      mobileSheetState === 'expanded' &&
      (previousMobileSheetState === 'collapsed' || isNewExpandedSelection) &&
      previousFocusTargetRef.current?.selectedPointId !== selectedPoint.id;

    if (shouldDeferSelectionFocus) {
      deferredExpandedSelectionFocusRef.current = selectedPoint.id;
    }

    const timeoutId = window.setTimeout(
      () => {
        const popup = parkingMarkerRefs.current.get(selectedPoint.id)?.popup;

        if (!popup?.isOpen()) {
          return;
        }

        if (mobileSheetState === 'collapsed') {
          centeredCollapsedPopupPointRef.current = selectedPoint.id;
          centerPopupInVisibleMapArea(map, popup);
          return;
        }

        const zoom = Math.max(map.getZoom(), 16);
        if (deferredExpandedSelectionFocusRef.current === selectedPoint.id) {
          deferredExpandedSelectionFocusRef.current = null;
        }
        isAutomaticFocusAnimationRef.current = true;
        centeredExpandedPopupPointRef.current = selectedPoint.id;
        map.flyTo({
          center: getPopupFocusCenter(
            map,
            parkingPointToRoutePoint(selectedPoint),
            popup,
            zoom,
            mobileSheetState,
          ),
          duration: 700,
          zoom,
        });
      },
      previousMobileSheetState === mobileSheetState ? 100 : 380,
    );

    return () => {
      window.clearTimeout(timeoutId);
      if (deferredExpandedSelectionFocusRef.current === selectedPoint.id) {
        deferredExpandedSelectionFocusRef.current = null;
      }
    };
  }, [map, mobileSheetState, route, selectedPoint]);

  useEffect(() => {
    if (!map || !route || routeFocusPoints.length < 2) {
      previousRouteSheetStateRef.current = mobileSheetState;
      return;
    }

    const previousRouteSheetState = previousRouteSheetStateRef.current;
    previousRouteSheetStateRef.current = mobileSheetState;

    if (previousRouteSheetState === mobileSheetState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const bounds = createBounds([...routeFocusPoints, ...route.points]);

      isAutomaticFocusAnimationRef.current = true;
      map.fitBounds(bounds, {
        duration: 700,
        maxZoom: 17,
        padding: getFocusPadding(map),
      });
    }, 380);

    return () => window.clearTimeout(timeoutId);
  }, [map, mobileSheetState, route, routeFocusPoints]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const nextFocusTarget: MapFocusTarget = {
      currentLocationFocusRequestId,
      route,
      selectedPointId: selectedPoint?.id ?? null,
      userLatitude: userLocation.latitude,
      userLongitude: userLocation.longitude,
    };
    const previousFocusTarget = previousFocusTargetRef.current;
    const focusTargetChanged = hasMapFocusTargetChanged(
      previousFocusTarget,
      nextFocusTarget,
    );
    const focusCandidates =
      highlightedPoints.length > 0
        ? highlightedPoints
        : nearestPoint
          ? [nearestPoint]
          : [];
    const currentLocationPoint = userLocationToPoint(userLocation);
    const focusPoints = focusCandidates.filter(
      (point) =>
        getDistanceMeters(
          currentLocationPoint,
          parkingPointToRoutePoint(point),
        ) <= nearbyFocusMaximumDistanceMeters,
    );
    if (previousSelectedPointIdRef.current !== selectedPointId) {
      previousSelectedPointIdRef.current = selectedPointId;
      hasUserAdjustedSelectionCameraRef.current = false;
      hasCompletedNearbySelectionFocusRef.current = false;
    }
    // The finder retains the selected ID while data reconciliation can
    // temporarily omit its point. Keep the existing camera through that gap.
    if (!selectedPoint && selectedPointId !== null && !route) {
      return;
    }
    const needsInitialNearbySelectionFocus =
      selectedPoint !== null &&
      selectedPoint.id === nearestPoint?.id &&
      mobileSheetState === 'expanded' &&
      !hasUserAdjustedSelectionCameraRef.current &&
      !hasCompletedNearbySelectionFocusRef.current;
    if (suppressParkingViewFocusRef.current) {
      suppressParkingViewFocusRef.current = false;
      previousFocusTargetRef.current = nextFocusTarget;
      return;
    }
    if (
      !shouldApplyMapFocus({
        hasAppliedNearbyFocus: hasAppliedNearbyFocusRef.current,
        hasNearbyFocusPoints: focusPoints.length > 0,
        next: nextFocusTarget,
        previous: previousFocusTarget,
      }) &&
      !needsInitialNearbySelectionFocus
    ) {
      return;
    }

    previousFocusTargetRef.current = nextFocusTarget;
    const hadRoute = previousFocusTarget?.route != null;

    if (focusTargetChanged && !route && !selectedPoint) {
      hasAppliedNearbyFocusRef.current = false;
    }

    if (
      selectedPoint &&
      mobileSheetState === 'expanded' &&
      deferredExpandedSelectionFocusRef.current === selectedPoint.id
    ) {
      return;
    }

    isAutomaticFocusAnimationRef.current = false;
    map.stop();

    if (
      !route &&
      !selectedPoint &&
      suppressNextSelectionClearFocusRef.current
    ) {
      suppressNextSelectionClearFocusRef.current = false;
      hasAppliedNearbyFocusRef.current = true;
      return;
    }

    if (!route && hadRoute) {
      hasAppliedNearbyFocusRef.current = true;
      return;
    }

    if (parkingView === 'saved' && !route && !selectedPoint) {
      return;
    }

    if (route && routeFocusPoints.length >= 2) {
      const bounds = createBounds([...routeFocusPoints, ...route.points]);

      isAutomaticFocusAnimationRef.current = true;
      map.fitBounds(bounds, {
        duration: 700,
        maxZoom: 17,
        padding: getFocusPadding(map),
      });
      return;
    }

    if (selectedPoint) {
      if (mobileSheetState === 'collapsed') {
        return;
      }

      if (hasUserAdjustedSelectionCameraRef.current) {
        return;
      }

      if (
        selectedPoint.id === nearestPoint?.id &&
        mobileSheetState === 'expanded'
      ) {
        if (focusPoints.length >= highlightedRankCount) {
          hasCompletedNearbySelectionFocusRef.current = true;
        }
        const bounds = createBounds([
          userLocationToPoint(userLocation),
          ...focusPoints.map(parkingPointToRoutePoint),
        ]);

        isAutomaticFocusAnimationRef.current = true;
        map.fitBounds(bounds, {
          duration: 700,
          maxZoom: 17,
          padding: getFocusPadding(map),
        });
        return;
      }

      const zoom = Math.max(map.getZoom(), 16);
      const popup = parkingMarkerRefs.current.get(selectedPoint.id)?.popup;
      isAutomaticFocusAnimationRef.current = true;
      map.flyTo({
        center:
          window.matchMedia('(max-width: 820px)').matches &&
          mobileSheetState === 'expanded' &&
          popup
            ? getPopupFocusCenter(
                map,
                parkingPointToRoutePoint(selectedPoint),
                popup,
                zoom,
                mobileSheetState,
              )
            : getMapPointFocusCenter(
                map,
                parkingPointToRoutePoint(selectedPoint),
                zoom,
                mobileSheetState,
              ),
        duration: 700,
        zoom,
      });
      return;
    }

    if (focusPoints.length > 0) {
      hasAppliedNearbyFocusRef.current = true;
      const bounds = createBounds([
        currentLocationPoint,
        ...focusPoints.map(parkingPointToRoutePoint),
      ]);

      isAutomaticFocusAnimationRef.current = true;
      map.fitBounds(bounds, {
        duration: 700,
        maxZoom: 17,
        padding: getFocusPadding(map),
      });
      return;
    }

    isAutomaticFocusAnimationRef.current = false;
    map.jumpTo({
      center: [userLocation.longitude, userLocation.latitude],
      zoom: 16,
    });
  }, [
    currentLocationFocusRequestId,
    highlightedPoints,
    map,
    mobileSheetState,
    nearestPoint,
    parkingView,
    route,
    routeFocusPoints,
    selectedPoint,
    userLocation,
  ]);

  useEffect(() => {
    if (!map || !liveRouteMarker || !shouldFollowLiveRoute) {
      return;
    }

    if (isPointInVisibleMapArea(map, liveRouteMarker.position)) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    map.panTo(
      getMapPointFocusCenter(
        map,
        liveRouteMarker.position,
        map.getZoom(),
        mobileSheetState,
      ),
      {
        duration: prefersReducedMotion ? 0 : 450,
        easing: (progress) => progress * (2 - progress),
      },
    );
  }, [
    liveRouteMarker,
    liveRouteMarker?.updatedAt,
    map,
    mobileSheetState,
    shouldFollowLiveRoute,
  ]);

  useEffect(() => {
    if (!map || !routeInstructionFocusRequest || !route) {
      return;
    }

    const instruction = route.instructions.find(
      (candidate) => candidate.id === routeInstructionFocusRequest.id,
    );

    if (!instruction) {
      return;
    }

    const zoom = Math.max(map.getZoom(), 16);
    map.flyTo({
      center: getMapPointFocusCenter(
        map,
        instruction.anchor,
        zoom,
        mobileSheetState,
      ),
      duration: 650,
      zoom,
    });
  }, [
    map,
    mobileSheetState,
    route,
    routeInstructionFocusRequest,
    routeInstructionFocusRequest?.requestId,
  ]);

  return (
    <>
      <div
        className={`bike-map bike-map-${theme}`}
        data-map-east={viewport.bounds?.east}
        data-map-center-latitude={viewport.center?.[1]}
        data-map-center-longitude={viewport.center?.[0]}
        data-map-north={viewport.bounds?.north}
        data-map-south={viewport.bounds?.south}
        data-map-west={viewport.bounds?.west}
        data-map-zoom={viewport.zoom}
        data-rendered-basemap-features={renderedBasemapFeatureCount}
        data-cycle-network-enabled={isCycleNetworkVisible}
        data-cycle-network-presentation={
          isDirectionsMode && !isRoutePlanningMode ? 'dimmed' : 'full'
        }
        data-cycle-network-interactive={isRoutePlanningMode ? 'false' : 'true'}
        data-route-planning-mode={isRoutePlanningMode ? 'true' : undefined}
        data-current-location-marker={
          !isRoutePlanningMode || showCurrentLocationMarker
            ? 'visible'
            : 'hidden'
        }
        data-route-source={route?.source}
        data-initial-approach-point-count={
          initialApproachPositions?.length ?? 0
        }
        data-cycle-network-bundles={cycleNetworkBundles.length}
        data-cycle-network-features={cycleNetworkFeatures.length}
        data-cycle-network-selected-route={
          selectedCycleNetworkRouteKey ?? undefined
        }
        data-route-waypoint-placement-active={
          isRouteWaypointPlacementActive ? 'true' : undefined
        }
        data-testid="parking-map"
        ref={mapContainerRef}
      />
      {isOfflineBasemap ? (
        <div className="offline-basemap-notice" role="status">
          {translate(locale, 'offlineMapBackgroundUnavailable')}
        </div>
      ) : null}
    </>
  );
}
