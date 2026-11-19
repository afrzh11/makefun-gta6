// The city alive: traffic cars that follow the road grid and pedestrians on the sidewalks.
// Traffic stops at junctions when another car is close; pedestrians flee a speeding car.
import { clamp } from './utils.js';
import { ROAD_HALF, ROADS, WORLD } from './city.js';
import { createCar } from './car.js';

const TRAFFIC_COLORS = ['#5a6b7a', '#7a5a4a', '#4a7a5a', '#8a8a7a', '#6a5a8a', '#a89a6a'];

export function createTraffic(city, rng, n) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    const road = ROADS[Math.floor(rng() * ROADS.length)];
    const along = 100 + rng() * (WORLD - 200);
    const lane = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 18);
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    const dir = rng() < 0.5 ? 1 : -1;
    const car = createCar('sedan', x, y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
    car.driver = 'traffic';
    car.axis = vertical ? 'y' : 'x';
    car.dir = dir;
    car.targetSpeed = 90 + rng() * 60;
    car.color = TRAFFIC_COLORS[Math.floor(rng() * TRAFFIC_COLORS.length)];
    cars.push(car);
  }
  return cars;
}

export function createPeds(city, rng, n) {
  const peds = [];
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    const road = ROADS[Math.floor(rng() * ROADS.length)];
    const along = 100 + rng() * (WORLD - 200);
    const side = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF + 14);
    peds.push({
      x: vertical ? road + side : along,
      y: vertical ? along : road + side,
      angle: rng() * Math.PI * 2,
      speed: 30 + rng() * 30,
      kind: rng() < 0.12 ? 'rival' : 'civilian',
      color: ['#e8d8a8', '#a8c8e8', '#e8a8b8', '#b8e8c8', '#d8b8e8'][Math.floor(rng() * 5)],
      down: 0, vx: 0, vy: 0, fleeT: 0, changeT: rng() * 4,
    });
  }
  return peds;
}

/** A traffic car's next junction: the nearest road centre ahead on its axis. */
function nextJunction(car) {
  const pos = car.axis === 'x' ? car.x : car.y;
  for (const c of ROADS) {
    if (car.dir > 0 && c > pos + 20) return c;
    if (car.dir < 0 && c < pos - 20) return c;
  }
  return null;
}

export function updateTraffic(G, dt) {
  const city = G.city;
  for (const car of G.traffic) {
    // Slow for the car ahead on the same road.
    let speed = car.targetSpeed;
    for (const other of G.traffic) {
      if (other === car || other.axis !== car.axis) continue;
      const along = car.axis === 'x' ? other.x - car.x : other.y - car.y;
      const side = car.axis === 'x' ? Math.abs(other.y - car.y) : Math.abs(other.x - car.x);
      if (side < 30 && along * car.dir > 0 && along * car.dir < 70) speed = 0;
    }
    // At a junction, sometimes turn onto the crossing road.
    const j = nextJunction(car);
    const pos = car.axis === 'x' ? car.x : car.y;
    if (j !== null && Math.abs(pos - j) < speed * dt + 2) {
      if (Math.random() < 0.3) {
        const wasX = car.axis === 'x';
        car.axis = wasX ? 'y' : 'x';
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.angle = car.axis === 'y' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
        if (wasX) car.y = j; else car.x = j;
      }
    }
    const vx = car.axis === 'x' ? Math.cos(car.angle) * speed : 0;
    const vy = car.axis === 'y' ? Math.sin(car.angle) * speed : 0;
    car.x += vx * dt;
    car.y += vy * dt;
    // Wrap around the map edges so traffic never runs out.
    if (car.x < 60) car.x = WORLD - 60;
    if (car.x > WORLD - 60) car.x = 60;
    if (car.y < 60) car.y = WORLD - 60;
    if (car.y > WORLD - 60) car.y = 60;
  }

  // Pedestrians: stroll the sidewalks, change direction at random, flee speeding cars.
  const px = G.playerCar ? G.playerCar.x : G.player.x;
  const py = G.playerCar ? G.playerCar.y : G.player.y;
  const playerSpeed = G.playerCar ? Math.abs(G.playerCar.speed) : 0;
  for (const ped of G.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      ped.x += ped.vx * dt;
      ped.y += ped.vy * dt;
      ped.vx *= 0.9;
      ped.vy *= 0.9;
      continue;
    }
    const dPlayer = Math.hypot(ped.x - px, ped.y - py);
    if (playerSpeed > 220 && dPlayer < 130) {
      // Flee away from the car.
      ped.fleeT = 1.2;
      ped.angle = Math.atan2(ped.y - py, ped.x - px);
    }
    ped.changeT -= dt;
    if (ped.changeT <= 0) {
      ped.changeT = 2 + Math.random() * 4;
      // Turn onto a nearby sidewalk direction: keep it simple, pick a cardinal.
      ped.angle = Math.floor(Math.random() * 4) * (Math.PI / 2);
    }
    const sp = ped.fleeT > 0 ? 130 : ped.speed;
    ped.fleeT = Math.max(0, ped.fleeT - dt);
    ped.x += Math.cos(ped.angle) * sp * dt;
    ped.y += Math.sin(ped.angle) * sp * dt;
    // Stay out of buildings and the sea.
    ped.x = clamp(ped.x, 150, WORLD - 16);
    ped.y = clamp(ped.y, 16, WORLD - 16);
    const solid = city.solidAt(ped.x, ped.y, 10);
    if (solid) {
      ped.x -= Math.cos(ped.angle) * sp * dt;
      ped.y -= Math.sin(ped.angle) * sp * dt;
      ped.angle += Math.PI / 2;
    }
  }
}
