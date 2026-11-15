const FILTERS = ['["building"]', '["aeroway"]', '["amenity"="parking"]', '["natural"="water"]', '["landuse"~"^(residential|industrial|commercial|retail|construction|railway|garages|quarry|reservoir|basin)$"]', '["waterway"~"^(river|stream|canal|dock)$"]', '["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|service|pedestrian)$"]', '["bridge"]', '["man_made"="bridge"]'];
const ENDPOINTS = ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export function validPlot(plot) {
  return Array.isArray(plot) && plot.length >= 3 && plot.length <= 40 && plot.every(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && point[0] >= -85 && point[0] <= 85 && point[1] >= -180 && point[1] <= 180);
}

export function queryBox(plot) {
  const pad = 0.0008;
  const south = Math.min(...plot.map(point => point[0])) - pad;
  const north = Math.max(...plot.map(point => point[0])) + pad;
  const west = Math.min(...plot.map(point => point[1])) - pad;
  const east = Math.max(...plot.map(point => point[1])) + pad;
  if (!(north > south) || !(east > west) || north - south > 0.25 || east - west > 0.25) return null;
  return { south, west, north, east };
}

export function overpassQuery(box) {
  const bounds = `${box.south},${box.west},${box.north},${box.east}`;
  return `[out:json][timeout:12];(${FILTERS.map(filter => `nwr(${bounds})${filter}`).join(';')};);out tags geom qt;`;
}

export function normalizeElements(elements) {
  const features = [];
  for (const element of elements || []) {
    const tags = element.tags || {};
    const rings = [];
    if (element.geometry?.length) rings.push(element.geometry.map(point => [point.lat, point.lon]));
    for (const member of element.members || []) {
      if (member.role === 'inner' || !member.geometry?.length) continue;
      rings.push(member.geometry.map(point => [point.lat, point.lon]));
    }
    if (!rings.length && typeof element.lat === 'number' && typeof element.lon === 'number') rings.push([[element.lat, element.lon]]);
    for (const geometry of rings) {
      features.push({ tags, geometry });
      if (features.length >= 500) return features;
    }
  }
  return features;
}

export async function surfaceResponse(request, fetchImpl = fetch) {
  if (request.method !== 'POST') return Response.json({ error: 'POST required' }, { status: 405 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!validPlot(body?.plot)) return Response.json({ error: 'Invalid plot' }, { status: 400 });
  const box = queryBox(body.plot);
  if (!box) return Response.json({ error: 'Plot is too large to check' }, { status: 400 });
  const query = overpassQuery(box);
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'Kisht/0.1 (field surface check)' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      return Response.json({ features: normalizeElements(payload.elements) }, { headers: { 'Cache-Control': 'private, max-age=300' } });
    } catch { /* try the next map service */ }
  }
  return Response.json({ error: 'Surface service unavailable' }, { status: 503 });
}
