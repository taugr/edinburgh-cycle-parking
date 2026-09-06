import { describe, expect, it } from 'vitest';
import type { CycleRoute } from '@/lib/cyclestreets';
import {
  getBearingDegrees,
  getLiveRouteProgress,
  getNextRouteGuidance,
  getRemainingRouteWaypoints,
  isLocationNearRoute,
} from '@/lib/route-progress';

describe('ride guidance and remaining stops', () => {
  it('counts down to the next maneuver instead of repeating the full leg distance', () => {
    const guidance = getNextRouteGuidance(straightRoute, 40);
    expect(guidance?.instruction.id).toBe('continue');
    expect(guidance?.distanceMeters).toBeCloseTo(71.32, 0);
    expect(getNextRouteGuidance(straightRoute, 180)).toBeNull();
    // A nearby turn must not disappear merely because it is within GPS snap grace.
    expect(getNextRouteGuidance(straightRoute, 106)?.instruction.id).toBe(
      'continue',
    );
  });
  it('keeps upcoming via stops in order and always retains the destination', () => {
    const waypoints = [0, 0.0005, 0.0015, 0.002].map((offset, index) => ({
      id: String(index),
      label: String(index),
      latitude: 55 + offset,
      longitude: -3,
      source: 'map' as const,
    }));
    expect(
      getRemainingRouteWaypoints(straightRoute, waypoints, 100).map(
        ({ id }) => id,
      ),
    ).toEqual(['2', '3']);
    expect(
      getRemainingRouteWaypoints(straightRoute, waypoints, 300).map(
        ({ id }) => id,
      ),
    ).toEqual(['3']);
    expect(getRemainingRouteWaypoints(straightRoute, waypoints, 0)).toEqual(
      waypoints.slice(1),
    );
  });
});

const straightRoute: CycleRoute = {
  plan: 'balanced',
  distanceMeters: 222,
  durationSeconds: 50,
  points: [
    [55, -3],
    [55.002, -3],
  ],
  instructions: [
    {
      id: 'start',
      anchor: [55, -3],
      streetName: 'Start Street',
      turn: 'start',
      distanceMeters: 100,
      durationSeconds: 20,
      travelMode: 'cycling',
    },
    {
      id: 'continue',
      anchor: [55.001, -3],
      streetName: 'Continue Street',
      turn: 'straight',
      distanceMeters: 122,
      durationSeconds: 30,
      travelMode: 'cycling',
    },
  ],
  source: 'cyclestreets',
};

const multiSegmentRoute: CycleRoute = {
  ...straightRoute,
  points: [
    [55, -3],
    [55.001, -3],
    [55.001, -2.998],
  ],
  instructions: [
    straightRoute.instructions[0]!,
    {
      id: 'turn-right',
      anchor: [55.001, -3],
      streetName: 'Turn Street',
      turn: 'turn right',
      distanceMeters: 128,
      durationSeconds: 31,
      travelMode: 'cycling',
    },
  ],
};

const zeroLengthRoute: CycleRoute = {
  ...straightRoute,
  distanceMeters: 0,
  durationSeconds: 60,
  points: [
    [55, -3],
    [55, -3],
  ],
  instructions: [
    {
      ...straightRoute.instructions[0]!,
      distanceMeters: 0,
    },
  ],
  source: 'local',
};

describe('live route progress', () => {
  it('identifies locations near enough to show when viewing a route', () => {
    expect(
      isLocationNearRoute(
        { latitude: 55.001, longitude: -3.0001 },
        straightRoute,
      ),
    ).toBe(true);
    expect(
      isLocationNearRoute({ latitude: 55.001, longitude: -3.1 }, straightRoute),
    ).toBe(false);
  });

  it('snaps a nearby location to a straight route', () => {
    const progress = getLiveRouteProgress({
      accuracyMeters: 12,
      location: { latitude: 55.001, longitude: -3.0001 },
      route: straightRoute,
    });

    expect(progress).not.toBeNull();
    expect(progress?.isOffRoute).toBe(false);
    expect(progress?.markerPosition[0]).toBeCloseTo(55.001, 5);
    expect(progress?.markerPosition[1]).toBeCloseTo(-3, 5);
    expect(progress?.distanceFromRouteMeters).toBeLessThan(10);
    expect(progress?.hasArrived).toBe(false);
    expect(progress?.travelledMeters).toBeGreaterThan(100);
    expect(progress?.remainingMeters).toBeGreaterThan(100);
    expect(progress?.activeInstructionId).toBe('continue');
  });

  it('projects progress across multiple route segments', () => {
    const progress = getLiveRouteProgress({
      accuracyMeters: 10,
      location: { latitude: 55.001, longitude: -2.999 },
      route: multiSegmentRoute,
    });

    expect(progress).not.toBeNull();
    expect(progress?.isOffRoute).toBe(false);
    expect(progress?.markerPosition[0]).toBeCloseTo(55.001, 5);
    expect(progress?.markerPosition[1]).toBeCloseTo(-2.999, 5);
    expect(progress?.travelledMeters).toBeGreaterThan(170);
    expect(progress?.activeInstructionId).toBe('turn-right');
  });

  it('uses raw GPS position when the location is clearly off route', () => {
    const progress = getLiveRouteProgress({
      accuracyMeters: 8,
      location: { latitude: 55.001, longitude: -3.002 },
      route: straightRoute,
    });

    expect(progress).not.toBeNull();
    expect(progress?.isOffRoute).toBe(true);
    expect(progress?.hasArrived).toBe(false);
    expect(progress?.markerPosition).toEqual([55.001, -3.002]);
    expect(progress?.snappedPosition[1]).toBeCloseTo(-3, 5);
    expect(progress?.distanceFromRouteMeters).toBeGreaterThan(35);
  });

  it('allows a wider snap tolerance for weaker but usable GPS accuracy', () => {
    const progress = getLiveRouteProgress({
      accuracyMeters: 55,
      location: { latitude: 55.001, longitude: -3.0007 },
      route: straightRoute,
    });

    expect(progress).not.toBeNull();
    expect(progress?.distanceFromRouteMeters).toBeGreaterThan(35);
    expect(progress?.isOffRoute).toBe(false);
    expect(progress?.markerPosition[1]).toBeCloseTo(-3, 5);
  });

  it('tracks progress on a zero-length local route', () => {
    const progress = getLiveRouteProgress({
      accuracyMeters: 5,
      location: { latitude: 55.00001, longitude: -3.00001 },
      route: zeroLengthRoute,
    });

    expect(progress).not.toBeNull();
    expect(progress?.isOffRoute).toBe(false);
    expect(progress?.markerPosition).toEqual([55, -3]);
    expect(progress?.remainingMeters).toBe(0);
    expect(progress?.travelledMeters).toBe(0);
    expect(progress?.hasArrived).toBe(true);
    expect(progress?.activeInstructionId).toBe('start');
  });

  it('marks the route arrived near the destination', () => {
    const progress = getLiveRouteProgress({
      accuracyMeters: 5,
      location: { latitude: 55.00195, longitude: -3 },
      route: straightRoute,
    });

    expect(progress).not.toBeNull();
    expect(progress?.remainingMeters).toBeLessThanOrEqual(12);
    expect(progress?.hasArrived).toBe(true);
  });

  it('does not mark arrival when off route near the destination', () => {
    const progress = getLiveRouteProgress({
      accuracyMeters: 5,
      location: { latitude: 55.002, longitude: -3.002 },
      route: straightRoute,
    });

    expect(progress).not.toBeNull();
    expect(progress?.remainingMeters).toBe(0);
    expect(progress?.isOffRoute).toBe(true);
    expect(progress?.hasArrived).toBe(false);
  });

  it('does not mark arrival before the threshold', () => {
    const progress = getLiveRouteProgress({
      accuracyMeters: 5,
      location: { latitude: 55.0018, longitude: -3 },
      route: straightRoute,
    });

    expect(progress).not.toBeNull();
    expect(progress?.remainingMeters).toBeGreaterThan(12);
    expect(progress?.hasArrived).toBe(false);
  });

  it('normalizes live heading values', () => {
    const progress = getLiveRouteProgress({
      accuracyMeters: 5,
      headingDegrees: -10,
      location: { latitude: 55.001, longitude: -3 },
      route: straightRoute,
    });

    expect(progress?.headingDegrees).toBe(350);
  });

  it('calculates a bearing from movement points', () => {
    expect(
      getBearingDegrees(
        { latitude: 55, longitude: -3 },
        { latitude: 55.001, longitude: -3 },
      ),
    ).toBeCloseTo(0, 1);
    expect(
      getBearingDegrees(
        { latitude: 55, longitude: -3 },
        { latitude: 55, longitude: -2.999 },
      ),
    ).toBeCloseTo(90, 1);
  });
});
