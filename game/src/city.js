// Solmar City: a deterministic seeded open world, 2400x2400 px.
// Roads form a grid; the west edge is the sea and a beach; the ocean avenue runs beside it.
// Named zones: night market (centre), marina (south-west docks), container port (north-east),
// park, observatory hill (south-east). Everything here is pure data + queries — no drawing.
import { mulberry32 } from './utils.js';

export const WORLD = 2400;
export const ROAD_W = 100;
export const ROAD_HALF = ROAD_W / 2;
export const ROADS = [300, 700, 1100, 1500, 1900]; // road centre lines, both axes

const PALETTE = ['#f2e3c6', '#e8cfa8', '#e6b48a', '#d99b6c', '#cfe0d8', '#f5d9a8', '#e9a86f'];

export function createCity(seed) {
  const rng = mulberry32(seed);
  const buildings = []; // {x,y,w,h,color,roof}
  const palms = [];     // {x,y}
  const containers = []; // {x,y,w,h,color} — port, collidable
  const trees = [];     // park trees {x,y}

  // Block bands between roads, plus the outer east/south strips.
  const bands = [[350, 650], [750, 1050], [1150, 1450], [1550, 1850], [1950, 2350]];
  const yBands = [[50, 250], ...bands];
  const xBands = bands;

  const zoneOf = (bx, by) => {
    if (bx === 2 && by === 2) return 'market';       // centre block
    if (bx === 0 && by === 3) return 'park';         // x 350-650, y 1150-1450
    if (bx === 4 && by === 0) return 'port';         // north-east corner
    if (bx === 4 && by === 4) return 'observatory';  // south-east hill
    return 'blocks';
  };

  for (let by = 0; by < yBands.length; by++) {
    for (let bx = 0; bx < xBands.length; bx++) {
      const [x0, x1] = xBands[bx];
      const [y0, y1] = yBands[by];
      const zone = zoneOf(bx, by);
      if (zone === 'market') {
        // Open plaza: market stalls (small collidable rects) around the edges.
        for (let i = 0; i < 6; i++) {
          const sx = x0 + 14 + i * 46;
          buildings.push({ x: sx, y: y0 + 40, w: 38, h: 30, color: '#d95f43', roof: 'stall', zone: 'market' });
          buildings.push({ x: sx, y: y1 - 70, w: 38, h: 30, color: '#3f8f7a', roof: 'stall', zone: 'market' });
        }
        palms.push({ x: (x0 + x1) / 2 - 90, y: (y0 + y1) / 2 });
        palms.push({ x: (x0 + x1) / 2 + 90, y: (y0 + y1) / 2 });
        continue;
      }
      if (zone === 'park') {
        for (let i = 0; i < 14; i++) {
          trees.push({ x: x0 + 30 + rng() * (x1 - x0 - 60), y: y0 + 30 + rng() * (y1 - y0 - 60) });
        }
        continue;
      }
      if (zone === 'port') {
        const cols = ['#b8442e', '#2e6f8f', '#c98a2e', '#4a7a3a', '#7a4a8f'];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 5; c++) {
            containers.push({
              x: x0 + 20 + c * 74, y: y0 + 24 + r * 62, w: 64, h: 46,
              color: cols[Math.floor(rng() * cols.length)],
            });
          }
        }
        continue;
      }
      if (zone === 'observatory') {
        // Hilltop dome: one round-ish building (stored as a rect, drawn as a dome).
        buildings.push({ x: x0 + 80, y: y0 + 70, w: 140, h: 140, color: '#efe6d0', roof: 'dome', zone: 'observatory' });
        for (let i = 0; i < 8; i++) {
          trees.push({ x: x0 + 20 + rng() * (x1 - x0 - 40), y: y0 + 20 + rng() * (y1 - y0 - 40) });
        }
        continue;
      }
      // Ordinary block: 1-3 buildings with a courtyard gap.
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const w = 90 + rng() * 120;
        const h = 80 + rng() * 110;
        const x = x0 + 20 + rng() * Math.max(1, (x1 - x0 - 40) - w);
        const y = y0 + 20 + rng() * Math.max(1, (y1 - y0 - 40) - h);
        buildings.push({ x, y, w, h, color: PALETTE[Math.floor(rng() * PALETTE.length)], roof: 'flat', zone: 'blocks' });
      }
    }
  }

  // Palms along the ocean avenue (x=300 road) and the beach edge.
  for (let y = 120; y < WORLD; y += 130) {
    palms.push({ x: 252, y: y + (rng() - 0.5) * 20 });
    if (rng() < 0.7) palms.push({ x: 348, y: y + 60 + (rng() - 0.5) * 20 });
  }
  // Marina docks: piers reaching into the sea at the south-west corner.
  const marina = { x: 60, y: 1980, w: 200, h: 340 };
  for (let i = 0; i < 3; i++) {
    buildings.push({ x: 210, y: 2020 + i * 100, w: 34, h: 70, color: '#8a6a4a', roof: 'pier', zone: 'marina' });
  }

  const zones = {
    sea: { x: 0, y: 0, w: 140, h: WORLD },
    beach: { x: 140, y: 0, w: 110, h: WORLD },
    market: { x: 750, y: 750, w: 300, h: 300 },
    marina,
    port: { x: 1950, y: 50, w: 400, h: 200 },
    park: { x: 350, y: 1150, w: 300, h: 300 },
    observatory: { x: 1950, y: 1550, w: 400, h: 300 },
  };

  function isRoad(x, y) {
    if (x < 0 || y < 0 || x > WORLD || y > WORLD) return false;
    for (const c of ROADS) {
      if (Math.abs(x - c) <= ROAD_HALF || Math.abs(y - c) <= ROAD_HALF) return true;
    }
    return false;
  }

  /** Nearest road centre line to (x,y) on the given axis. */
  function nearestRoad(v) {
    let best = ROADS[0], bd = Infinity;
    for (const c of ROADS) {
      const d = Math.abs(v - c);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /** The collidable rect (building/container) at (x,y), or null. */
  function solidAt(x, y, r) {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    for (const c of containers) {
      if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return c;
    }
    return null;
  }

  function zoneAt(x, y) {
    if (x < 140) return 'sea';
    if (x < 250) return 'beach';
    for (const [name, z] of Object.entries(zones)) {
      if (name === 'sea' || name === 'beach') continue;
      if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return name;
    }
    return isRoad(x, y) ? 'road' : 'block';
  }

  return {
    seed, size: WORLD, buildings, palms, containers, trees, zones,
    isRoad, nearestRoad, solidAt, zoneAt,
  };
}
