// The screenshot scenes behind ?shot=drive|foot|chase|mission (with &seed=1).
// Each one builds a fixed, deterministic scene out of the real game state — a real frame
// of the game, not a mockup — then the loop paints it twice and sets window.__shotReady.
import { createCar } from './car.js';
import { startMission } from './missions.js';

function placePlayerInCar(G, cls, x, y, angle, speed) {
  const car = createCar(cls, x, y, angle);
  car.driver = 'player';
  car.speed = speed;
  G.playerCar = car;
  G.player.onFoot = false;
  G.player.x = x;
  G.player.y = y;
  G.camera.x = x - G.vw / 2;
  G.camera.y = y - G.vh / 2;
  return car;
}

function placePlayerOnFoot(G, x, y, angle) {
  G.playerCar = null;
  G.player.onFoot = true;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  G.camera.x = x - G.vw / 2;
  G.camera.y = y - G.vh / 2;
}

/**
 * Stage the named scene on the live game state G and return the screen to draw.
 * Names: drive (cover), foot, chase, mission. Anything else is the title screen.
 */
export function stageShot(name, G) {
  G.cash = 2350;
  G.best = 2350;
  if (name === 'drive') {
    // Cover: the Cometa GT flying down the palm-lined ocean avenue at sunset,
    // heat 2, a police car in pursuit, traffic ahead, the sea on the left.
    const car = placePlayerInCar(G, 'sport', 300, 1500, -Math.PI / 2, 380);
    car.damage = 12;
    G.heat = 2;
    const cop = createCar('sedan', 300, 1720, -Math.PI / 2);
    cop.driver = 'police';
    cop.color = '#2e4a6b';
    cop.speed = 360;
    G.police.push(cop);
    // Traffic ahead on the avenue.
    const t1 = createCar('sedan', 318, 1150, -Math.PI / 2);
    t1.driver = 'traffic'; t1.color = '#5a6b7a'; t1.speed = 120;
    const t2 = createCar('taxi', 282, 950, -Math.PI / 2);
    t2.driver = 'traffic'; t2.speed = 100;
    G.traffic.push(t1, t2);
    // A couple of skid marks from the getaway.
    G.skids.push(
      { x: 300, y: 1620, angle: -Math.PI / 2 + 0.2, life: 6 },
      { x: 300, y: 1590, angle: -Math.PI / 2 - 0.15, life: 6 },
    );
    startMission(G, 5); // Sunset Getaway active: marker + timer visible
    G.missions.state = 'active';
    G.missions.timer = 132;
    G.heat = 2; // startMission(5) adds heat 4; the cover wants a 2-flame pursuit
    G.message = '';
    G.messageT = 0;
    G.screen = 'playing';
    return 'playing';
  }
  if (name === 'foot') {
    // On foot in the night market: Sol next to a cash pickup, mission marker
    // overhead, pedestrians on the sidewalks, Tía Carmen's stall in frame.
    placePlayerOnFoot(G, 900, 900, -Math.PI / 2);
    G.cashDrops.push(
      { x: 940, y: 880, amount: 100, taken: false, kind: 'cash' },
      { x: 820, y: 830, amount: 0, taken: false, kind: 'crate' },
      { x: 1020, y: 900, amount: 0, taken: false, kind: 'crate' },
    );
    G.missions.current = 1;
    G.missions.state = 'active';
    G.missions.timer = 96;
    G.missions.marker = { x: 900, y: 820 };
    G.screen = 'playing';
    return 'playing';
  }
  if (name === 'chase') {
    // Heat-3 chase: two police cars + a roadblock ahead, smoke from the damaged
    // player car, skid marks, three heat flames lit.
    const car = placePlayerInCar(G, 'sedan', 1100, 1500, -Math.PI / 2, 300);
    car.damage = 62;
    // Frame the shot looking north so the roadblock ahead is in view.
    G.camera.y = 1500 - G.vh / 2 - 170;
    G.heat = 3;
    const cop1 = createCar('sedan', 1100, 1720, -Math.PI / 2);
    cop1.driver = 'police'; cop1.color = '#2e4a6b'; cop1.speed = 380;
    const cop2 = createCar('sedan', 1100, 1660, -Math.PI / 2);
    cop2.driver = 'police'; cop2.color = '#2e4a6b'; cop2.speed = 370;
    G.police.push(cop1, cop2);
    // Roadblock across the road ahead (the y=1100 road).
    const rb1 = createCar('sedan', 1075, 1100, 0);
    rb1.driver = 'police'; rb1.color = '#2e4a6b'; rb1.roadblock = true;
    const rb2 = createCar('sedan', 1125, 1100, 0);
    rb2.driver = 'police'; rb2.color = '#2e4a6b'; rb2.roadblock = true;
    G.police.push(rb1, rb2);
    for (let i = 0; i < 5; i++) {
      G.skids.push({ x: 1100 + (i % 2 ? 8 : -8), y: 1560 + i * 22, angle: -Math.PI / 2 + (i % 2 ? 0.25 : -0.2), life: 6 });
    }
    G.particles.push({ x: 1100, y: 1500, vx: 0, vy: -30, life: 0.9, max: 1.2, size: 14, kind: 'smoke' });
    G.particles.push({ x: 1090, y: 1490, vx: -10, vy: -25, life: 0.7, max: 1.2, size: 10, kind: 'smoke' });
    G.missions.current = 4;
    G.missions.state = 'active';
    G.missions.timer = 141;
    G.missions.marker = { x: 2000, y: 1900 };
    G.message = 'ROADBLOCK AHEAD!';
    G.messageT = 3;
    G.screen = 'playing';
    return 'playing';
  }
  if (name === 'mission') {
    // Mission briefing card over the marina: payout, mission list with two
    // complete and the next unlocked, cash total.
    G.camera.x = 300 - G.vw / 2;
    G.camera.y = 2100 - G.vh / 2;
    G.missions.completed = [true, true, false, false, false, false];
    G.cash = 1100;
    startMission(G, 3); // Cash Drop briefing (payout $1,200)
    G.screen = 'briefing';
    return 'briefing';
  }
  return 'title';
}
