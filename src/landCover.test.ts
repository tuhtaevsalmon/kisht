import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fieldSamples,ringContains,surfaceKind,unsuitableSurface,type SurfaceFeature} from './landCover.ts';
import type {Point} from './domain.ts';

const house: Point[] = [[38.57, 68.78], [38.57, 68.7804], [38.5703, 68.7804], [38.5703, 68.78], [38.57, 68.78]];
const field: Point[] = [[38.5, 68.7], [38.5, 68.704], [38.503, 68.704], [38.503, 68.7]];

test('open soil is kept and a building, road or water covering the outline is refused', () => {
  const samples = fieldSamples(field);
  assert.ok(samples.length >= 6);
  assert.ok(samples.every(([lat, lon]) => ringContains(lat, lon, field)));
  assert.deepEqual(unsuitableSurface(samples, []), []);
  assert.equal(surfaceKind({ landuse: 'farmland' }), null);
  assert.equal(surfaceKind({ highway: 'track' }), null);
  const building: SurfaceFeature = { tags: { building: 'house' }, geometry: house };
  assert.ok(unsuitableSurface(fieldSamples(house), [building]).includes('building'));
  const road: SurfaceFeature = { tags: { highway: 'primary', surface: 'asphalt' }, geometry: [[38.5015, 68.7], [38.5015, 68.704]] };
  assert.ok(unsuitableSurface(fieldSamples(field.map((p, i) => i < 2 ? [38.5014, p[1]] as Point : [38.5016, p[1]])), [road]).includes('road'));
  const water: SurfaceFeature = { tags: { natural: 'water' }, geometry: [...field, field[0]] };
  assert.ok(unsuitableSurface(fieldSamples(field), [water]).includes('water'));
  assert.equal(surfaceKind({ aeroway: 'runway' }), 'airport');
  assert.equal(surfaceKind({ landuse: 'construction' }), 'construction');
  assert.equal(surfaceKind({ man_made: 'bridge' }), 'road');
});
