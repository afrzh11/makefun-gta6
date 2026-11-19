// Marisol "Sol" Reyes on foot: walk/run, punch rival crew, pick up cash, get in and out of cars.
// On foot she moves with WASD/arrows, runs with Shift, punches with Space, enters a car with E.
import { clamp, pushOutCircleRect } from './utils.js';
import { WORLD } from './city.js';
import { stealCar } from './car.js';
import { ACTION_INTERACT } from './input.js';

const WALK_SPEED = 170;
const RUN_SPEED = 260;
const RADIUS = 14;

export function createPlayer(city) {
  // Start beside her battered taxi cab on the road south of the market.
  return {
    x: 980, y: 1150, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null,
    punchT: 0, punchCd: 0, health: 100,
    cashCarried: 0,
  };
}

/** The nearest parked car within `range` of the player, or null. */
export function nearestParkedCar(G, range) {
  let best = null, bd = range;
  for (const car of G.parked) {
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function updatePlayer(G, dt, actions) {
  const p = G.player;
  const input = G.input;

  if (!p.onFoot) return;

  // Movement: WASD/arrows steer her like a top-down character.
  let mx = input.steer();
  let my = -input.throttle();
  const mag = Math.hypot(mx, my);
  if (mag > 0) {
    mx /= mag; my /= mag;
    p.angle = Math.atan2(my, mx);
  }
  const speed = input.runHeld() ? RUN_SPEED : WALK_SPEED;
  p.x += mx * speed * dt;
  p.y += my * speed * dt;

  // Walls: buildings, containers, the sea; the map edge.
  p.x = clamp(p.x, 150, WORLD - 16);
  p.y = clamp(p.y, 16, WORLD - 16);
  const solid = G.city.solidAt(p.x, p.y, RADIUS);
  if (solid) pushOutCircleRect(p, RADIUS, solid);

  // Punch: Space swings; a rival crew member in range gets knocked down and drops cash.
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.punchT = Math.max(0, p.punchT - dt);
  if (input.punchHeld() && p.punchCd <= 0) {
    p.punchT = 0.25;
    p.punchCd = 0.45;
    G.audio.ensure();
    for (const ped of G.peds) {
      if (ped.kind !== 'rival' || ped.down > 0) continue;
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 52) {
        ped.down = 4;
        ped.vx = Math.cos(p.angle) * 260;
        ped.vy = Math.sin(p.angle) * 260;
        G.cashDrops.push({ x: ped.x, y: ped.y, amount: 50, taken: false });
        G.audio.thud();
        G.message = 'Rival down — grabbed $50!';
        G.messageT = 2;
      }
    }
  }

  // Pick up cash drops.
  for (const drop of G.cashDrops) {
    if (drop.taken) continue;
    if (Math.hypot(drop.x - p.x, drop.y - p.y) < 30) {
      drop.taken = true;
      G.cash += drop.amount;
      G.audio.chime();
      G.message = `+$${drop.amount}`;
      G.messageT = 1.5;
    }
  }

  // Enter a car with E (the one-shot flags are taken once per frame by the loop).
  if (actions & ACTION_INTERACT) {
    const car = nearestParkedCar(G, 70);
    if (car) stealCar(G, car);
  }
}

/** Get out of the car: step beside it, back on foot. */
export function exitCar(G) {
  const p = G.player;
  const car = G.playerCar;
  if (!car) return;
  car.driver = 'parked';
  G.parked.push(car);
  G.playerCar = null;
  p.onFoot = true;
  p.x = car.x - Math.cos(car.angle) * 40;
  p.y = car.y - Math.sin(car.angle) * 40;
  p.angle = car.angle;
  // Switching cars drops one heat level — a clean getaway.
  if (G.heat > 0) {
    G.heat -= 1;
    G.message = 'Switched cars — heat down';
    G.messageT = 2;
  }
}
