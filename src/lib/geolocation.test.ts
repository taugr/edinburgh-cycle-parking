import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLocationPermission,
  lastLocationMaxAgeMs,
  lastLocationStorageKey,
  readLastLocation,
  saveLastLocation,
} from '@/lib/geolocation';

const location = { latitude: 55.9533, longitude: -3.1883 };
const now = 1_800_000_000_000;
let data: Map<string, string>;

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  data = new Map();
  vi.stubGlobal('window', {
    location: { hostname: 'neuk.bike', search: '' },
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('last known location', () => {
  it('reuses a GPS fix without extending its original lifetime', () => {
    saveLastLocation(location, now - 60_000);
    expect(readLastLocation()).toEqual(location);
    expect(JSON.parse(data.get(lastLocationStorageKey)!)).toEqual({
      ...location,
      timestamp: now - 60_000,
    });
  });

  it.each([
    'invalid json',
    'null',
    '{}',
    JSON.stringify({ ...location, timestamp: now - lastLocationMaxAgeMs }),
    JSON.stringify({ ...location, timestamp: now + 1 }),
    JSON.stringify({ ...location, timestamp: 'today' }),
    JSON.stringify({ latitude: 0, longitude: 0, timestamp: now }),
    JSON.stringify({ ...location, latitude: 91, timestamp: now }),
    JSON.stringify({ ...location, longitude: '0', timestamp: now }),
  ])('discards invalid or expired storage: %s', (value) => {
    data.set(lastLocationStorageKey, value);
    expect(readLastLocation()).toBeNull();
    expect(data.has(lastLocationStorageKey)).toBe(false);
  });

  it('tolerates blocked storage', () => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
    expect(() => saveLastLocation(location, now)).not.toThrow();
    expect(readLastLocation()).toBeNull();
  });

  it('rejects invalid fixes', () => {
    saveLastLocation({ latitude: 0, longitude: 0 }, now);
    saveLastLocation(location, Number.NaN);
    expect(data.size).toBe(0);
  });
});

describe('browser permission', () => {
  it.each(['granted', 'denied', 'prompt'])(
    'reads %s without requesting GPS',
    async (state) => {
      const query = vi.fn().mockResolvedValue({ state });
      const getCurrentPosition = vi.fn();
      vi.stubGlobal('navigator', {
        permissions: { query },
        geolocation: { getCurrentPosition },
      });
      saveLastLocation(location, now);
      expect(await getLocationPermission()).toBe(state);
      expect(query).toHaveBeenCalledWith({ name: 'geolocation' });
      expect(getCurrentPosition).not.toHaveBeenCalled();
    },
  );

  it('handles a missing or unsupported Permissions API', async () => {
    vi.stubGlobal('navigator', {});
    expect(await getLocationPermission()).toBe('unknown');
    vi.stubGlobal('navigator', {
      permissions: {
        query: vi.fn().mockRejectedValue(new Error('unsupported')),
      },
    });
    expect(await getLocationPermission()).toBe('unknown');
  });

  it('never enables local GPS mocks on production hosts', async () => {
    window.location.search = '?mockGps=55.9533,-3.1883';
    vi.stubGlobal('navigator', {});
    expect(await getLocationPermission()).toBe('unknown');
  });
});
