import { isResolvedLocation } from '@/lib/geo';
import type { UserLocation } from '@/lib/types';

export const locationRequestStorageKey = 'neuk-bike:location-request:v1';
export const lastAreaStorageKey = 'neuk-bike:last-area:v1';
export const locationRequestCooldownMs = 24 * 60 * 60 * 1000;

type LocationRequestRecord = { attemptedAt: number; denied: boolean };
export type BrowsedArea = { location: UserLocation; label?: string };

function writeLocationRequest(denied: boolean): boolean {
  try {
    window.localStorage.setItem(
      locationRequestStorageKey,
      JSON.stringify({ attemptedAt: Date.now(), denied }),
    );
    return true;
  } catch {
    return false;
  }
}

export function rememberLocationRequest() {
  return writeLocationRequest(false);
}

export function rememberLocationDenial() {
  writeLocationRequest(true);
}

// Record the attempt before asking, including when the permission dialog stays
// open or the page closes. A browser grant always takes precedence over this
// app-side cooldown; it is never inferred from a saved response or position.
export function beginAutomaticLocationRequest(
  permission: PermissionState | 'unknown',
): boolean {
  if (permission === 'denied') {
    rememberLocationDenial();
    return false;
  }
  if (permission === 'granted') {
    rememberLocationRequest();
    return true;
  }
  try {
    const raw = window.localStorage.getItem(locationRequestStorageKey);
    if (raw) {
      let record: LocationRequestRecord;
      try {
        record = JSON.parse(raw);
      } catch {
        // Corrupt records must not cause repeated permission dialogs.
        rememberLocationRequest();
        return false;
      }
      if (
        !record ||
        !Number.isFinite(record.attemptedAt) ||
        typeof record.denied !== 'boolean' ||
        record.attemptedAt > Date.now()
      ) {
        rememberLocationRequest();
        return false;
      }
      if (
        record.denied ||
        Date.now() - record.attemptedAt < locationRequestCooldownMs
      )
        return false;
    }
    // Without writable storage, leave permission requests to the location
    // button: we cannot reliably remember whether a previous visit asked.
    return rememberLocationRequest();
  } catch {
    return false;
  }
}

export function readLastArea(): BrowsedArea | null {
  try {
    const area = JSON.parse(
      window.localStorage.getItem(lastAreaStorageKey) ?? 'null',
    );
    if (
      area &&
      typeof area.location?.latitude === 'number' &&
      typeof area.location?.longitude === 'number' &&
      isResolvedLocation(area.location) &&
      (area.label === undefined || typeof area.label === 'string')
    ) {
      return {
        location: {
          latitude: area.location.latitude,
          longitude: area.location.longitude,
        },
        label: area.label?.slice(0, 200),
      };
    }
  } catch {
    // A saved map reference is optional, including in private browsing.
  }
  return null;
}

export function saveLastArea(location: UserLocation, label?: string) {
  if (!isResolvedLocation(location)) return;
  try {
    window.localStorage.setItem(
      lastAreaStorageKey,
      JSON.stringify({
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        label: label?.slice(0, 200),
      }),
    );
  } catch {
    // Browsing must work when persistence is unavailable.
  }
}
