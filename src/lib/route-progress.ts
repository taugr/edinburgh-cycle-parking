import type { CycleRoute, CycleRoutePoint } from '@/lib/cyclestreets';
import type { UserLocation } from '@/lib/types';

export const LIVE_ROUTE_BASE_SNAP_THRESHOLD_METERS = 35;
export const LIVE_ROUTE_MAX_SNAP_THRESHOLD_METERS = 60;
export const LIVE_ROUTE_ARRIVAL_THRESHOLD_METERS = 12;
export const LIVE_ROUTE_MIN_HEADING_DISTANCE_METERS = 2;
export const ROUTE_VIEW_NEARBY_THRESHOLD_METERS = 5_000;
const activeInstructionGraceMeters = 10;
const metersPerDegreeLatitude = 111_320;

type ProjectedPoint = {
  x: number;
  y: number;
};

type RouteProjection = {
  distanceFromRouteMeters: number;
  travelledMeters: number;
  snappedPosition: CycleRoutePoint;
  totalDistanceMeters: number;
};

export type LiveRouteProgress = {
  activeInstructionId: string | null;
  distanceFromRouteMeters: number;
  hasArrived: boolean;
  headingDegrees: number | null;
  isOffRoute: boolean;
  markerPosition: CycleRoutePoint;
  rawPosition: CycleRoutePoint;
  remainingMeters: number;
  snappedPosition: CycleRoutePoint;
  travelledMeters: number;
};

/** Distance to the next maneuver, rather than the full length of the current leg. */
export function getNextRouteGuidance(
  route: CycleRoute,
  travelledMeters: number,
) {
  const upcoming = getInstructionDistances(route).find(
    (instruction) => instruction.travelledMeters > travelledMeters + 1,
  );
  if (!upcoming) return null;
  const instruction = route.instructions.find(({ id }) => id === upcoming.id);
  return instruction
    ? {
        instruction,
        distanceMeters: Math.max(0, upcoming.travelledMeters - travelledMeters),
      }
    : null;
}

/** Keep ordered, unvisited stops; never drop the destination. Use confirmed on-route progress. */
export function getRemainingRouteWaypoints(
  route: CycleRoute,
  waypoints: import('@/lib/cyclestreets').CycleRouteWaypoint[],
  travelledMeters: number,
) {
  return waypoints.slice(1).filter((waypoint, index, remaining) => {
    if (index === remaining.length - 1) return true;
    const projection = projectLocationToRoute(waypoint, route.points);
    return !projection || projection.travelledMeters + 20 >= travelledMeters;
  });
}

function getSnapThresholdMeters(accuracyMeters?: number | null) {
  if (
    typeof accuracyMeters !== 'number' ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters <= 0
  ) {
    return LIVE_ROUTE_BASE_SNAP_THRESHOLD_METERS;
  }

  return Math.max(
    LIVE_ROUTE_BASE_SNAP_THRESHOLD_METERS,
    Math.min(accuracyMeters, LIVE_ROUTE_MAX_SNAP_THRESHOLD_METERS),
  );
}

function normalizeHeadingDegrees(headingDegrees?: number | null) {
  if (typeof headingDegrees !== 'number' || !Number.isFinite(headingDegrees)) {
    return null;
  }

  return ((headingDegrees % 360) + 360) % 360;
}

function toProjectedPoint(
  point: CycleRoutePoint | UserLocation,
  originLatitude: number,
): ProjectedPoint {
  const latitude = Array.isArray(point) ? point[0] : point.latitude;
  const longitude = Array.isArray(point) ? point[1] : point.longitude;

  return {
    x:
      longitude *
      metersPerDegreeLatitude *
      Math.cos((originLatitude * Math.PI) / 180),
    y: latitude * metersPerDegreeLatitude,
  };
}

export function getBearingDegrees(
  from: CycleRoutePoint | UserLocation,
  to: CycleRoutePoint | UserLocation,
) {
  const fromLatitude = Array.isArray(from) ? from[0] : from.latitude;
  const fromLongitude = Array.isArray(from) ? from[1] : from.longitude;
  const toLatitude = Array.isArray(to) ? to[0] : to.latitude;
  const toLongitude = Array.isArray(to) ? to[1] : to.longitude;

  const fromLatitudeRadians = (fromLatitude * Math.PI) / 180;
  const toLatitudeRadians = (toLatitude * Math.PI) / 180;
  const longitudeDeltaRadians = ((toLongitude - fromLongitude) * Math.PI) / 180;
  const y = Math.sin(longitudeDeltaRadians) * Math.cos(toLatitudeRadians);
  const x =
    Math.cos(fromLatitudeRadians) * Math.sin(toLatitudeRadians) -
    Math.sin(fromLatitudeRadians) *
      Math.cos(toLatitudeRadians) *
      Math.cos(longitudeDeltaRadians);

  return normalizeHeadingDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

function toRoutePoint(
  point: ProjectedPoint,
  originLatitude: number,
): CycleRoutePoint {
  return [
    point.y / metersPerDegreeLatitude,
    point.x /
      (metersPerDegreeLatitude * Math.cos((originLatitude * Math.PI) / 180)),
  ];
}

function projectLocationToRoute(
  location: UserLocation,
  points: CycleRoutePoint[],
): RouteProjection | null {
  if (points.length === 0) {
    return null;
  }

  const originLatitude = location.latitude;
  const target = toProjectedPoint(location, originLatitude);

  if (points.length === 1) {
    const snappedPosition = points[0]!;
    const projected = toProjectedPoint(snappedPosition, originLatitude);

    return {
      distanceFromRouteMeters: Math.hypot(
        target.x - projected.x,
        target.y - projected.y,
      ),
      travelledMeters: 0,
      snappedPosition,
      totalDistanceMeters: 0,
    };
  }

  let travelledBeforeSegment = 0;
  let totalDistanceMeters = 0;
  let bestProjection: RouteProjection | null = null;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = toProjectedPoint(points[index]!, originLatitude);
    const end = toProjectedPoint(points[index + 1]!, originLatitude);
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const segmentLength = Math.sqrt(segmentLengthSquared);

    if (segmentLength === 0) {
      continue;
    }

    const rawPositionOnSegment =
      ((target.x - start.x) * segmentX + (target.y - start.y) * segmentY) /
      segmentLengthSquared;
    const positionOnSegment = Math.min(Math.max(rawPositionOnSegment, 0), 1);
    const projected = {
      x: start.x + segmentX * positionOnSegment,
      y: start.y + segmentY * positionOnSegment,
    };
    const distanceFromRouteMeters = Math.hypot(
      target.x - projected.x,
      target.y - projected.y,
    );
    const travelledMeters =
      travelledBeforeSegment + segmentLength * positionOnSegment;

    totalDistanceMeters += segmentLength;

    if (
      !bestProjection ||
      distanceFromRouteMeters < bestProjection.distanceFromRouteMeters
    ) {
      bestProjection = {
        distanceFromRouteMeters,
        travelledMeters,
        snappedPosition: toRoutePoint(projected, originLatitude),
        totalDistanceMeters,
      };
    }

    travelledBeforeSegment += segmentLength;
  }

  if (!bestProjection) {
    const snappedPosition = points[0]!;
    const projected = toProjectedPoint(snappedPosition, originLatitude);

    return {
      distanceFromRouteMeters: Math.hypot(
        target.x - projected.x,
        target.y - projected.y,
      ),
      travelledMeters: 0,
      snappedPosition,
      totalDistanceMeters: 0,
    };
  }

  return {
    ...bestProjection,
    totalDistanceMeters,
  };
}

export function isLocationNearRoute(
  location: UserLocation,
  route: CycleRoute,
  thresholdMeters = ROUTE_VIEW_NEARBY_THRESHOLD_METERS,
) {
  const projection = projectLocationToRoute(location, route.points);
  return Boolean(
    projection && projection.distanceFromRouteMeters <= thresholdMeters,
  );
}

function getInstructionDistances(route: CycleRoute) {
  return route.instructions
    .map((instruction) => {
      const projection = projectLocationToRoute(
        {
          latitude: instruction.anchor[0],
          longitude: instruction.anchor[1],
        },
        route.points,
      );

      return projection
        ? {
            id: instruction.id,
            travelledMeters: projection.travelledMeters,
          }
        : null;
    })
    .filter((instruction) => instruction !== null)
    .sort((left, right) => left.travelledMeters - right.travelledMeters);
}

function getActiveInstructionId(route: CycleRoute, travelledMeters: number) {
  const instructionDistances = getInstructionDistances(route);

  if (instructionDistances.length === 0) {
    return null;
  }

  let activeInstructionId = instructionDistances[0]!.id;

  for (const instruction of instructionDistances) {
    if (
      instruction.travelledMeters <=
      travelledMeters + activeInstructionGraceMeters
    ) {
      activeInstructionId = instruction.id;
      continue;
    }

    break;
  }

  return activeInstructionId;
}

export function getLiveRouteProgress({
  accuracyMeters,
  headingDegrees,
  location,
  route,
}: {
  accuracyMeters?: number | null;
  headingDegrees?: number | null;
  location: UserLocation;
  route: CycleRoute;
}): LiveRouteProgress | null {
  const projection = projectLocationToRoute(location, route.points);

  if (!projection) {
    return null;
  }

  const snapThresholdMeters = getSnapThresholdMeters(accuracyMeters);
  const isOffRoute = projection.distanceFromRouteMeters > snapThresholdMeters;
  const rawPosition: CycleRoutePoint = [location.latitude, location.longitude];
  const remainingMeters = Math.max(
    projection.totalDistanceMeters - projection.travelledMeters,
    0,
  );

  return {
    activeInstructionId: getActiveInstructionId(
      route,
      projection.travelledMeters,
    ),
    distanceFromRouteMeters: projection.distanceFromRouteMeters,
    hasArrived:
      !isOffRoute && remainingMeters <= LIVE_ROUTE_ARRIVAL_THRESHOLD_METERS,
    headingDegrees: normalizeHeadingDegrees(headingDegrees),
    isOffRoute,
    markerPosition: isOffRoute ? rawPosition : projection.snappedPosition,
    rawPosition,
    remainingMeters,
    snappedPosition: projection.snappedPosition,
    travelledMeters: projection.travelledMeters,
  };
}
