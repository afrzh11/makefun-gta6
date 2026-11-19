// The heat: a wanted level 0–5. Reckless driving, stealing in sight and hitting things
// raise it; police cars spawn and pursue, ram, and set roadblocks at heat 3+. Heat decays
// when no police car can see the player for a while.
import { clamp, angleDiff } from './utils.js';
import { ROADS, WORLD } from './city.js';
import { createCar, addSparks } from './car.js';

export const MAX_HEAT = 5;

export function addHeat(G, n, reason) {
  const before = G.heat;
  G.heat = clamp(G.heat + n, 0, MAX_HEAT);
  if (G.heat > before) {
    G.message = `HEAT ${G.heat} — ${reason}`;
    G.messageT = 2.5;
    if (G.heat >= 3 && before < 3) setRoadblock(G);
  }
}

/** Two police cars parked across the road ahead of the player. */
function setRoadblock(G) {
  const car = G.playerCar;
  if (!car) return;
  const ahead = 420;
  const ax = car.x + Math.cos(car.angle) * ahead;
  const ay = car.y + Math.sin(car.angle) * ahead;
  const perp = car.angle + Math.PI / 2;
  for (const s of [-1, 1]) {
    const p = createCar('sedan', ax + Math.cos(perp) * 26 * s, ay + Math.sin(perp) * 26 * s, car.angle + Math.PI / 2);
    p.driver = 'police';
    p.roadblock = true;
    p.color = '#2e4a6b';
    G.police.push(p);
  }
  G.message = 'ROADBLOCK AHEAD!';
  G.messageT = 3;
}

function spawnPolice(G) {
  // Spawn on a road near the player but off-screen.
  const px = G.playerCar ? G.playerCar.x : G.player.x;
  const py = G.playerCar ? G.playerCar.y : G.player.y;
  const angle = Math.random() * Math.PI * 2;
  const dist = 700 + Math.random() * 300;
  let x = clamp(px + Math.cos(angle) * dist, 80, WORLD - 80);
  let y = clamp(py + Math.sin(angle) * dist, 80, WORLD - 80);
  // Snap onto the nearest road so it arrives driving, not through buildings.
  const road = G.city.nearestRoad(x);
  if (Math.abs(x - road) < Math.abs(y - G.city.nearestRoad(y))) x = road;
  else y = G.city.nearestRoad(y);
  const p = createCar('sedan', x, y, Math.atan2(py - y, px - x));
  p.driver = 'police';
  p.color = '#2e4a6b';
  G.police.push(p);
}

export function updatePolice(G, dt) {
  const px = G.playerCar ? G.playerCar.x : G.player.x;
  const py = G.playerCar ? G.playerCar.y : G.player.y;

  // Keep the pursuit sized to the heat: one police car per level (roadblock cars extra).
  const hunters = G.police.filter((p) => !p.roadblock);
  const wanted = G.heat;
  if (hunters.length < wanted) spawnPolice(G);
  if (hunters.length > wanted && wanted === 0) {
    // Heat cleared: the pursuit gives up and drives off (despawn the furthest).
    hunters.sort((a, b) => Math.hypot(b.x - px, b.y - py) - Math.hypot(a.x - px, a.y - py));
    G.police.splice(G.police.indexOf(hunters[0]), 1);
  }

  let nearest = Infinity;
  for (const p of G.police) {
    if (p.roadblock) continue; // roadblock cars hold their ground
    const d = Math.hypot(p.x - px, p.y - py);
    nearest = Math.min(nearest, d);
    // Pursuit: steer toward the player, faster at higher heat.
    const want = Math.atan2(py - p.y, px - p.x);
    p.angle += clamp(angleDiff(p.angle, want), -2.4 * dt, 2.4 * dt);
    const top = 300 + G.heat * 45;
    p.speed = clamp(p.speed + 260 * dt, 0, top);
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (!G.city.solidAt(nx, ny, 20)) {
      p.x = nx;
      p.y = ny;
    } else {
      p.speed *= 0.5;
      p.angle += 0.6 * dt;
    }
    // Ram: contact damages the player's car (or the player on foot) and sparks.
    if (d < 46) {
      if (G.playerCar) {
        G.playerCar.damage = Math.min(100, G.playerCar.damage + 9 * dt);
        G.playerCar.speed *= 0.92;
        G.shake = Math.min(12, G.shake + 4);
        addSparks(G, p.x, p.y, 3);
        if (Math.random() < dt * 4) G.audio.thud();
      } else if (G.player.health > 0) {
        G.player.health -= 25 * dt;
        G.shake = Math.min(12, G.shake + 4);
      }
    }
  }

  // Roadblock cars: despawn once the player is far past them.
  G.police = G.police.filter((p) => {
    if (!p.roadblock) return true;
    return Math.hypot(p.x - px, p.y - py) < 900;
  });

  // Heat decay: 15 seconds with no police car in sight drops one level.
  if (G.heat > 0) {
    if (nearest > 520) {
      G.heatTimer += dt;
      if (G.heatTimer > 15) {
        G.heatTimer = 0;
        G.heat -= 1;
        G.message = `Heat down — ${G.heat}`;
        G.messageT = 2;
      }
    } else {
      G.heatTimer = 0;
    }
  }
}
