import { isResolvedLocation } from '@/lib/geo';
import type { UserLocation } from '@/lib/types';

export const lastLocationStorageKey = 'neuk-bike:last-location:v1';
export const lastLocationMaxAgeMs = 24 * 60 * 60 * 1000;

export function clearLastLocation() {
  try {
    window.localStorage.removeItem(lastLocationStorageKey);
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

export function readLastLocation(): UserLocation | null {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(lastLocationStorageKey) ?? 'null',
    );
    if (
      value &&
      typeof value.latitude === 'number' &&
      typeof value.longitude === 'number' &&
      isResolvedLocation(value) &&
      typeof value.timestamp === 'number' &&
      Number.isFinite(value.timestamp) &&
      value.timestamp <= Date.now() &&
      Date.now() - value.timestamp < lastLocationMaxAgeMs
    ) {
      return { latitude: value.latitude, longitude: value.longitude };
    }
  } catch {
    // A corrupt or inaccessible cache must not prevent startup.
  }
  clearLastLocation();
  return null;
}

export function saveLastLocation(location: UserLocation, timestamp: number) {
  if (!isResolvedLocation(location) || !Number.isFinite(timestamp)) return;
  try {
    window.localStorage.setItem(
      lastLocationStorageKey,
      JSON.stringify({ ...location, timestamp }),
    );
  } catch {
    // GPS remains usable when storage is blocked or full.
  }
}

// Permission belongs to the browser: never infer a grant from saved coordinates.
export async function getLocationPermission(): Promise<
  PermissionState | 'unknown'
> {
  // Preserve deterministic local GPS scenarios without invoking real permissions.
  if (getMockGeolocationConfig()) return 'granted';
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'unknown';
  }
}

type GeolocationSuccess = PositionCallback;
type GeolocationFailure = PositionErrorCallback | null | undefined;

type MockGeolocationPoint = {
  accuracy: number;
  latitude: number;
  longitude: number;
};

type MockGeolocationConfig =
  | {
      status: 'available';
      points: MockGeolocationPoint[];
      stepMs: number;
    }
  | {
      status: 'denied' | 'unavailable';
    };

const defaultMockAccuracyMeters = 5;
const defaultMockStepMs = 1000;
let nextMockWatchId = -1;
const mockWatches = new Map<
  number,
  {
    intervalId: number | null;
    timeoutId: number;
  }
>();

function getMockError(
  status: 'denied' | 'unavailable',
): GeolocationPositionError {
  return {
    code: status === 'denied' ? 1 : 2,
    message:
      status === 'denied'
        ? 'Mock permission denied'
        : 'Mock position unavailable',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

function toPosition(point: MockGeolocationPoint): GeolocationPosition {
  return {
    coords: {
      accuracy: point.accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude: point.latitude,
      longitude: point.longitude,
      speed: null,
      toJSON: () => ({
        accuracy: point.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: point.latitude,
        longitude: point.longitude,
        speed: null,
      }),
    },
    timestamp: Date.now(),
    toJSON: () => ({
      coords: {
        accuracy: point.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        latitude: point.latitude,
        longitude: point.longitude,
        speed: null,
      },
      timestamp: Date.now(),
    }),
  };
}

function parseMockPoint(value: string | null): MockGeolocationPoint | null {
  if (!value) {
    return null;
  }

  if (value === 'null-island') {
    return {
      accuracy: defaultMockAccuracyMeters,
      latitude: 0,
      longitude: 0,
    };
  }

  const [latitude, longitude, accuracyValue] = value
    .split(',')
    .map((part) => Number(part.trim()));
  const accuracy = accuracyValue ?? defaultMockAccuracyMeters;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(accuracy)
  ) {
    return null;
  }

  return { accuracy, latitude, longitude };
}

function getMockGeolocationConfig(): MockGeolocationConfig | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isLocalMockHost(window.location.hostname)) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const mockGps = params.get('mockGps');
  const mockPath = params.get('mockGpsPath');

  if (!mockGps && !mockPath) {
    return null;
  }

  if (mockGps === 'denied' || mockGps === 'unavailable') {
    return { status: mockGps };
  }

  const points = (mockPath?.split(';') ?? [mockGps])
    .map(parseMockPoint)
    .filter((point) => point !== null);

  if (points.length === 0) {
    return { status: 'unavailable' };
  }

  const stepMs = Number(params.get('mockGpsStepMs') ?? defaultMockStepMs);

  return {
    points,
    status: 'available',
    stepMs: Number.isFinite(stepMs) && stepMs > 0 ? stepMs : defaultMockStepMs,
  };
}

function isLocalMockHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

export function canUseGeolocation() {
  return getMockGeolocationConfig() !== null || 'geolocation' in navigator;
}

export function getCurrentPosition(
  success: GeolocationSuccess,
  failure: GeolocationFailure,
  options?: PositionOptions,
) {
  const mockConfig = getMockGeolocationConfig();

  if (!mockConfig) {
    navigator.geolocation.getCurrentPosition(success, failure, options);
    return;
  }

  window.setTimeout(() => {
    if (mockConfig.status !== 'available') {
      failure?.(getMockError(mockConfig.status));
      return;
    }

    success(toPosition(mockConfig.points[0]!));
  }, 0);
}

export function watchPosition(
  success: GeolocationSuccess,
  failure: GeolocationFailure,
  options?: PositionOptions,
) {
  const mockConfig = getMockGeolocationConfig();

  if (!mockConfig) {
    return navigator.geolocation.watchPosition(success, failure, options);
  }

  const watchId = nextMockWatchId;
  nextMockWatchId -= 1;

  if (mockConfig.status !== 'available') {
    const timeoutId = window.setTimeout(() => {
      mockWatches.delete(watchId);
      failure?.(getMockError(mockConfig.status));
    }, 0);
    mockWatches.set(watchId, { intervalId: null, timeoutId });
    return watchId;
  }

  let index = 0;
  const timeoutId = window.setTimeout(() => {
    const watch = mockWatches.get(watchId);

    if (!watch) {
      return;
    }

    success(toPosition(mockConfig.points[0]!));

    if (mockConfig.points.length === 1) {
      mockWatches.delete(watchId);
    }
  }, 0);
  mockWatches.set(watchId, { intervalId: null, timeoutId });

  if (mockConfig.points.length > 1) {
    const intervalId = window.setInterval(() => {
      if (!mockWatches.has(watchId)) {
        return;
      }

      index = Math.min(index + 1, mockConfig.points.length - 1);
      success(toPosition(mockConfig.points[index]!));

      if (index === mockConfig.points.length - 1) {
        clearMockWatch(watchId);
      }
    }, mockConfig.stepMs);

    mockWatches.set(watchId, { intervalId, timeoutId });
  }

  return watchId;
}

function clearMockWatch(watchId: number) {
  const watch = mockWatches.get(watchId);

  if (!watch) {
    return;
  }

  window.clearTimeout(watch.timeoutId);

  if (watch.intervalId !== null) {
    window.clearInterval(watch.intervalId);
  }

  mockWatches.delete(watchId);
}

export function clearWatch(watchId: number) {
  if (watchId < 0) {
    clearMockWatch(watchId);
    return;
  }

  navigator.geolocation.clearWatch(watchId);
}
