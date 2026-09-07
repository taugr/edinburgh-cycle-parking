import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginAutomaticLocationRequest,
  lastAreaStorageKey,
  locationRequestCooldownMs,
  locationRequestStorageKey,
  readLastArea,
  rememberLocationDenial,
  rememberLocationRequest,
  saveLastArea,
} from '@/lib/location-preferences';

const location = { latitude: 40.1777, longitude: 44.5126 };
const now = 1_800_000_000_000;
let data: Map<string, string>;

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  data = new Map();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('automatic location requests', () => {
  it.each(['prompt', 'unknown'] as const)(
    'asks once with %s permission and waits 24 hours after dismissal',
    (permission) => {
      expect(beginAutomaticLocationRequest(permission)).toBe(true);
      expect(beginAutomaticLocationRequest(permission)).toBe(false);
      vi.spyOn(Date, 'now').mockReturnValue(
        now + locationRequestCooldownMs - 1,
      );
      expect(beginAutomaticLocationRequest(permission)).toBe(false);
      vi.spyOn(Date, 'now').mockReturnValue(now + locationRequestCooldownMs);
      expect(beginAutomaticLocationRequest(permission)).toBe(true);
    },
  );

  it('never retries an explicit denial automatically, even after the cooldown', () => {
    rememberLocationDenial();
    vi.spyOn(Date, 'now').mockReturnValue(now + locationRequestCooldownMs * 3);
    expect(beginAutomaticLocationRequest('prompt')).toBe(false);
    expect(beginAutomaticLocationRequest('unknown')).toBe(false);
    expect(beginAutomaticLocationRequest('denied')).toBe(false);
  });

  it('records browser denial even when no request is made', () => {
    expect(beginAutomaticLocationRequest('denied')).toBe(false);
    expect(JSON.parse(data.get(locationRequestStorageKey)!)).toEqual({
      attemptedAt: now,
      denied: true,
    });
  });

  it('refreshes every visit while permission is granted, clearing an earlier denial', () => {
    rememberLocationDenial();
    expect(beginAutomaticLocationRequest('granted')).toBe(true);
    expect(beginAutomaticLocationRequest('granted')).toBe(true);
    expect(JSON.parse(data.get(locationRequestStorageKey)!).denied).toBe(false);
    expect(beginAutomaticLocationRequest('prompt')).toBe(false);
  });

  it('a manual retry starts a new cooldown and can replace a denied choice', () => {
    rememberLocationDenial();
    expect(rememberLocationRequest()).toBe(true);
    expect(beginAutomaticLocationRequest('prompt')).toBe(false);
    vi.spyOn(Date, 'now').mockReturnValue(now + locationRequestCooldownMs);
    expect(beginAutomaticLocationRequest('prompt')).toBe(true);
  });

  it.each([
    'broken',
    'null',
    '{}',
    JSON.stringify({ attemptedAt: now + 1, denied: false }),
    JSON.stringify({ attemptedAt: 'today', denied: false }),
  ])('does not prompt from a corrupt request record: %s', (value) => {
    data.set(locationRequestStorageKey, value);
    expect(beginAutomaticLocationRequest('prompt')).toBe(false);
    expect(beginAutomaticLocationRequest('prompt')).toBe(false);
  });

  it('keeps denied requests separate from the saved browsing area', () => {
    saveLastArea(location, 'Yerevan');
    rememberLocationDenial();
    expect(readLastArea()).toEqual({ location, label: 'Yerevan' });
  });

  it('does not repeatedly prompt when storage is blocked or full', () => {
    window.localStorage.setItem = () => {
      throw new Error('full');
    };
    expect(beginAutomaticLocationRequest('prompt')).toBe(false);
    expect(beginAutomaticLocationRequest('granted')).toBe(true);
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
    expect(beginAutomaticLocationRequest('unknown')).toBe(false);
    expect(beginAutomaticLocationRequest('granted')).toBe(true);
    expect(rememberLocationRequest()).toBe(false);
  });
});

describe('last browsed area', () => {
  it('remembers a named search and replaces it with a manually viewed map area', () => {
    saveLastArea(location, 'Yerevan');
    expect(readLastArea()).toEqual({ location, label: 'Yerevan' });
    const other = { latitude: 55.9533, longitude: -3.1883 };
    saveLastArea(other);
    expect(readLastArea()).toEqual({ location: other, label: undefined });
  });

  it.each([
    'null',
    'bad json',
    '{}',
    JSON.stringify({ location: { latitude: 0, longitude: 0 } }),
    JSON.stringify({ location: { latitude: '40', longitude: 44 } }),
    JSON.stringify({ location: { latitude: 91, longitude: 44 } }),
    JSON.stringify({ location, label: {} }),
  ])('rejects malformed saved areas: %s', (value) => {
    data.set(lastAreaStorageKey, value);
    expect(readLastArea()).toBeNull();
  });

  it('ignores invalid coordinates and blocked storage', () => {
    saveLastArea({ latitude: 0, longitude: 0 });
    expect(data.size).toBe(0);
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
    expect(() => saveLastArea(location)).not.toThrow();
    expect(readLastArea()).toBeNull();
  });
});
