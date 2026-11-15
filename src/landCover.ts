import type {Point} from './domain';

export type BlockKind = 'building' | 'airport' | 'road' | 'water' | 'construction';

export interface SurfaceFeature { tags: Record<string, string>; geometry: Point[] }

const ROAD_METERS = 16;
const AREA_METERS = 10;
const AIRPORT_METERS = 40;

export function surfaceKind(tags: Record<string, string> | undefined): BlockKind | null {
  if (!tags) return null;
  if (tags.aeroway) return 'airport';
  if (tags.building && tags.building !== 'no') return 'building';
  if (tags.amenity === 'parking') return 'road';
  if (tags.man_made === 'bridge' || tags.bridge === 'yes') return 'road';
  if (tags.natural === 'water' || tags.landuse === 'reservoir' || tags.landuse === 'basin') return 'water';
  if (tags.waterway && /^(river|stream|canal|dock)$/.test(tags.waterway)) return 'water';
  if (tags.water && /^(river|lake|pond|reservoir|canal|stream)$/.test(tags.water)) return 'water';
  if (tags.landuse && /^(residential|industrial|commercial|retail|construction|railway|garages|quarry)$/.test(tags.landuse)) return 'construction';
  if (tags.highway && /^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|service|pedestrian)$/.test(tags.highway)) return 'road';
  if (tags.highway && tags.highway !== 'track' && tags.highway !== 'path' && tags.highway !== 'footway' && /^(asphalt|concrete|paved)$/.test(tags.surface || '')) return 'road';
  return null;
}

export function ringContains(lat: number, lon: number, ring: Point[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 0) + xi) inside = !inside;
  }
  return inside;
}

function metersTo(sample: Point, ring: Point[]) {
  const cos = Math.cos(sample[0] * Math.PI / 180);
  const xy = (q: Point): [number, number] => [(q[1] - sample[1]) * 111320 * cos, (q[0] - sample[0]) * 111320];
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = xy(ring[i]), [x2, y2] = xy(ring[i + 1]);
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (-x1 * dx - y1 * dy) / len2));
    best = Math.min(best, Math.hypot(x1 + t * dx, y1 + t * dy));
  }
  if (ring.length === 1) best = Math.min(best, Math.hypot(...xy(ring[0])));
  return best;
}

function closed(ring: Point[]) {
  return ring.length >= 4 && Math.abs(ring[0][0] - ring.at(-1)![0]) < 1e-6 && Math.abs(ring[0][1] - ring.at(-1)![1]) < 1e-6;
}

function covers(sample: Point, feature: SurfaceFeature, kind: BlockKind) {
  const ring = feature.geometry;
  if (!ring.length) return false;
  const limit = kind === 'airport' ? AIRPORT_METERS : kind === 'road' ? ROAD_METERS : AREA_METERS;
  if (closed(ring) && ringContains(sample[0], sample[1], ring)) return true;
  return metersTo(sample, ring.length > 1 ? ring : [ring[0], ring[0]]) <= limit;
}

/** Reject the outline when mapped non-farm surfaces cover a substantial part of it. */
export function unsuitableSurface(samples: Point[], features: SurfaceFeature[]): BlockKind[] {
  if (!samples.length) return [];
  const hits = new Set<BlockKind>();
  let blocked = 0;
  for (const sample of samples) {
    let hit = false;
    for (const feature of features) {
      const kind = surfaceKind(feature.tags);
      if (!kind || !covers(sample, feature, kind)) continue;
      hits.add(kind);
      hit = true;
      if (kind === 'airport') break;
    }
    if (hit) blocked++;
  }
  if (hits.has('airport')) return [...hits];
  return blocked / samples.length >= 0.34 ? [...hits] : [];
}

export function fieldSamples(plot: Point[], count = 12): Point[] {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [lat, lon] of plot) {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
  }
  const inside: Point[] = [];
  const steps = 8;
  for (let i = 0; i < steps; i++) for (let j = 0; j < steps; j++) {
    const lat = minLat + (maxLat - minLat) * (i + 0.5) / steps;
    const lon = minLon + (maxLon - minLon) * (j + 0.5) / steps;
    if (ringContains(lat, lon, plot)) inside.push([lat, lon]);
  }
  const picked: Point[] = [];
  const step = Math.max(1, Math.floor(inside.length / count));
  for (let i = 0; i < inside.length && picked.length < count; i += step) picked.push(inside[i]);
  if (picked.length < 6) {
    const stride = Math.max(1, Math.ceil(plot.length / 8));
    for (let i = 0; i < plot.length && picked.length < count; i += stride) picked.push(plot[i]);
  }
  return picked.length ? picked : [plot[0]];
}

export async function assessSowingLand(plot: Point[], fetchImpl: typeof fetch = fetch): Promise<BlockKind[]> {
  const response = await fetchImpl('/api/surface', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ plot }),
    signal: AbortSignal.timeout(26000),
  });
  if (!response.ok) throw Error('surface_check_failed');
  const payload = await response.json() as { features?: SurfaceFeature[] };
  if (!Array.isArray(payload.features)) throw Error('surface_check_failed');
  const features = payload.features.filter(feature => feature?.tags && Array.isArray(feature.geometry));
  return unsuitableSurface(fieldSamples(plot), features);
}
