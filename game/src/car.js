// Vehicles: the four car classes, arcade driving physics, parked cars and stealing.
// A car is plain data; physics lives here and nowhere else.
import { clamp, circleRect, pushOutCircleRect, angleDiff } from './utils.js';
import { ROAD_HALF, ROADS, WORLD } from './city.js';

export const CAR_CLASSES = {
  sedan:  { name: 'Sedan',     maxSpeed: 340, accel: 240, turn: 2.5, color: '#4a7a9e', len: 46, wid: 24 },
  taxi:   { name: 'Taxi',      maxSpeed: 360, accel: 260, turn: 2.6, color: '#e8b73a', len: 46, wid: 24 },
  pickup: { name: 'Pickup',    maxSpeed: 320, accel: 210, turn: 2.2, color: '#8a5a3a', len: 52, wid: 26 },
  sport:  { name: 'Cometa GT', maxSpeed: 520, accel: 340, turn: 3.1, color: '#c23b4e', len: 48, wid: 24 },
};

export function createCar(cls, x, y, angle) {
  const def = CAR_CLASSES[cls];
  return {
    cls, name: def.name, color: def.color, len: def.len, wid: def.wid,
    x, y, angle, speed: 0, damage: 0,
    driver: 'parked', // 'parked' | 'player' | 'traffic' | 'police'
    // traffic AI
    axis: 'x', dir: 1, targetSpeed: 0, waitT: 0,
    // police AI
    roadblock: false,
    // skid
    skidding: false,
  };
}

/** Parked cars along the roads: the fleet the player can steal. */
export function spawnParkedCars(city, rng) {
  const cars = [];
  const classes = ['sedan', 'sedan', 'taxi', 'pickup', 'sedan', 'sport'];
  // One special Cometa GT parked in the port for mission 5.
  cars.push(Object.assign(createCar('sport', 2080, 130, 0), { driver: 'parked', special: 'heist' }));
  for (let i = 0; i < 14; i++) {
    const vertical = rng() < 0.5;
    const road = ROADS[Math.floor(rng() * ROADS.length)];
    const along = 120 + rng() * (WORLD - 240);
    const lane = (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 14);
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    const angle = vertical ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI);
    const cls = classes[Math.floor(rng() * classes.length)];
    // Keep clear of the mission start taxi and of buildings.
    if (city.solidAt(x, y, 30)) continue;
    cars.push(createCar(cls, x, y, angle));
  }
  return cars;
}

/**
 * Drive the player's car one step. Returns events: {hit:boolean, speed01:number}.
 * Steering scales with speed; Space is the handbrake (drift + skid marks).
 */
export function updatePlayerCar(G, car, dt) {
  const def = CAR_CLASSES[car.cls];
  const input = G.input;
  const throttle = input.throttle();
  const steer = input.steer();
  const handbrake = input.punchHeld();

  if (throttle > 0) car.speed += def.accel * dt;
  else if (throttle < 0) {
    car.speed -= (car.speed > 10 ? def.accel * 1.4 : def.accel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 120 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  const maxRev = -140;
  car.speed = clamp(car.speed, maxRev, def.maxSpeed);

  const grip = handbrake ? 0.45 : 1;
  const turnRate = def.turn * clamp(Math.abs(car.speed) / 140, 0, 1) * (car.speed < 0 ? -1 : 1) * grip;
  car.angle += steer * turnRate * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  let hit = false;

  // Buildings and containers stop the car hard.
  const solid = G.city.solidAt(nx, ny, car.len / 2 - 4);
  if (solid) {
    const before = Math.abs(car.speed);
    if (before > 120) {
      car.damage = Math.min(100, car.damage + (before - 120) * 0.06);
      hit = true;
      G.shake = Math.min(14, G.shake + before * 0.02);
      G.audio.thud();
      addSmoke(G, car.x, car.y, 6);
    }
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }

  // Sea is a wall for cars.
  if (car.x < 150) { car.x = 150; car.speed *= -0.2; hit = hit || Math.abs(car.speed) > 60; }
  car.x = clamp(car.x, 150, WORLD - 20);
  car.y = clamp(car.y, 20, WORLD - 20);

  // Skid marks + smoke while drifting or damaged.
  car.skidding = handbrake && Math.abs(car.speed) > 180;
  if (car.skidding) addSkid(G, car);
  if (car.damage > 55 && Math.random() < dt * 8) addSmoke(G, car.x, car.y, 1);

  return { hit, speed01: Math.abs(car.speed) / def.maxSpeed };
}

export function addSkid(G, car) {
  const back = { x: car.x - Math.cos(car.angle) * car.len * 0.4, y: car.y - Math.sin(car.angle) * car.len * 0.4 };
  G.skids.push({ x: back.x, y: back.y, angle: car.angle, life: 6 });
  if (G.skids.length > 220) G.skids.splice(0, G.skids.length - 220);
}

export function addSmoke(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    G.particles.push({
      x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30,
      life: 0.7 + Math.random() * 0.5, max: 1.2, size: 6 + Math.random() * 8,
      kind: 'smoke',
    });
  }
  if (G.particles.length > 400) G.particles.splice(0, G.particles.length - 400);
}

export function addSparks(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({
      x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
      life: 0.3, max: 0.3, size: 2 + Math.random() * 2, kind: 'spark',
    });
  }
}

/** Steal a parked car: the player gets in, heat rises if a cop or a pedestrian saw it. */
export function stealCar(G, car) {
  car.driver = 'player';
  G.playerCar = car;
  G.player.onFoot = false;
  const witnessed = G.police.some((p) => Math.hypot(p.x - car.x, p.y - car.y) < 500)
    || G.peds.some((p) => Math.hypot(p.x - car.x, p.y - car.y) < 160);
  if (witnessed) {
    G.addHeat(1, 'car stolen in plain sight');
  }
  G.message = `Stole the ${car.name}!`;
  G.messageT = 2.5;
}
