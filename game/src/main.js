// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. Screens: title → briefing → playing →
// paused / complete / failed / busted. ?seed=N fixes the city; ?shot=drive|foot|chase|mission
// (with &seed=1) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { createCity, WORLD } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT } from './input.js';
import { createPlayer, updatePlayer, exitCar } from './player.js';
import { createCar, spawnParkedCars, updatePlayerCar, addSparks } from './car.js';
import { createTraffic, createPeds, updateTraffic } from './traffic.js';
import { updatePolice, addHeat } from './police.js';
import { createMissions, startMission, updateMissions } from './missions.js';
import { createRenderer } from './render.js';
import { drawHUD, drawTitle, drawPause, drawBriefing, drawComplete, drawFailed, drawBusted } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { clamp, mulberry32 } from './utils.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const BEST_KEY = 'solmar-best-cash';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

function createGame(input, audio) {
  const city = createCity(seed);
  const G = {
    canvas, ctx: renderer.ctx,
    vw: window.innerWidth, vh: window.innerHeight,
    time: 0, seed, city,
    screen: 'title',
    player: createPlayer(city),
    playerCar: null,
    parked: [],
    traffic: [],
    peds: [],
    police: [],
    particles: [],
    skids: [],
    cashDrops: [],
    cash: 0, best: readBest(),
    heat: 0, heatTimer: 0,
    missions: createMissions(),
    briefingMission: 0, lastPayout: 0,
    camera: { x: 700, y: 700 },
    input: input ?? createInput(window),
    audio: audio ?? createAudio(),
    shake: 0, message: '', messageT: 0,
    hitCd: 0, marketCd: 0,
    muted: false,
  };
  G.addHeat = (n, reason) => addHeat(G, n, reason);
  G.parked = spawnParkedCars(city, cityRng(seed));
  // Her taxi cab, parked where she left it on the road south of the market,
  // facing east along the road so a first drive goes somewhere.
  const taxi = createCar('taxi', 980, 1100, 0);
  G.parked.push(taxi);
  G.traffic = createTraffic(city, cityRng(seed + 7), 10);
  G.peds = createPeds(city, cityRng(seed + 13), 26);
  // A few rival Port Cats hanging around the market and the port.
  for (const [x, y] of [[850, 800], [1000, 850], [2050, 180], [2100, 220]]) {
    G.peds.push({ x, y, angle: 0, speed: 0, kind: 'rival', color: '#3a3a3a', down: 0, vx: 0, vy: 0, fleeT: 0, changeT: 3 });
  }
  return G;
}

// A second seeded stream for spawns, so the city layout and the traffic never correlate.
function cityRng(s) { return mulberry32(s); }

const G = createGame();

// Debug hook for automated playtests: read-only state, nothing else.
window.__solmarDebug = () => ({
  screen: G.screen,
  cash: G.cash,
  heat: G.heat,
  mission: G.missions.current + 1,
  missionState: G.missions.state,
  timer: Math.round(G.missions.timer),
  player: { x: Math.round(G.player.x), y: Math.round(G.player.y), onFoot: G.player.onFoot },
  car: G.playerCar ? { cls: G.playerCar.cls, speed: Math.round(G.playerCar.speed), damage: Math.round(G.playerCar.damage), angle: G.playerCar.angle, x: Math.round(G.playerCar.x), y: Math.round(G.playerCar.y) } : null,
  police: G.police.length,
  traffic: G.traffic.length,
  peds: G.peds.length,
});

function announce(message) { status.textContent = message; }

function overlayFor(screen) {
  switch (screen) {
    case 'title': return drawTitle;
    case 'paused': return (g) => { drawHUD(g); drawPause(g); };
    case 'briefing': return drawBriefing;
    case 'complete': return drawComplete;
    case 'failed': return drawFailed;
    case 'busted': return drawBusted;
    default: return drawHUD;
  }
}

function runShot(name) {
  const screen = stageShot(name, G);
  G.screen = screen;
  let painted = 0;
  function paint() {
    renderer.draw(G, overlayFor(G.screen));
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function startRun() {
    // Rebuild the world but keep the one input listener set and the one audio context.
    const fresh = createGame(G.input, G.audio);
    Object.assign(G, fresh);
    // Rebind addHeat: createGame's closure captures the fresh object, not this one.
    G.addHeat = (n, reason) => addHeat(G, n, reason);
    G.screen = 'briefing';
    G.briefingMission = 0;
    startMission(G, 0);
    announce('Mission 1: First Fare. Tía Carmen is waiting.');
  }

  // Mute (M) and mission replay digits (1-6 on the pause screen) are edges the
  // input module does not queue; this listener handles exactly those two.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) {
      G.muted = !G.muted;
      G.audio.setMuted(G.muted);
      G.message = G.muted ? 'Muted' : 'Sound on';
      G.messageT = 1.5;
    }
    if (G.screen === 'paused' && /^Digit[1-6]$/.test(e.code) && !e.repeat) {
      const i = Number(e.code.slice(5)) - 1;
      if (G.missions.completed[i]) {
        G.audio.click();
        startMission(G, i);
      }
    }
    if (e.code === 'KeyR' && G.screen === 'paused' && !e.repeat) startRun();
  });

  // handleActions returns the one-shot flags it consumed, so the loop can keep
  // the rest pending for the next frame instead of dropping them.
  function handleActions(actions) {
    if (G.screen === 'title') {
      if (actions & ACTION_CONFIRM || G.input.mouse.clicked) {
        G.audio.ensure();
        G.audio.click();
        startRun();
        return ACTION_CONFIRM;
      }
      return 0;
    }
    if (G.screen === 'playing') {
      if (actions & ACTION_PAUSE) {
        G.screen = 'paused';
        announce('Paused.');
        return ACTION_PAUSE;
      }
      // E to exit the car is handled inside step(), not here: handling it here
      // and passing the same flags to step() would exit AND re-enter in one frame.
      return 0;
    }
    if (G.screen === 'paused') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        G.screen = 'playing';
        announce('Playing.');
        return actions & (ACTION_PAUSE | ACTION_CONFIRM);
      }
      return 0;
    }
    if (G.screen === 'briefing') {
      if (actions & ACTION_CONFIRM) {
        G.screen = 'playing';
        announce(`Mission ${G.missions.current + 1} started.`);
        return ACTION_CONFIRM;
      }
      return 0;
    }
    if (G.screen === 'complete') {
      if (actions & ACTION_CONFIRM) {
        const next = G.missions.current + 1;
        if (next < 6) startMission(G, next);
        else { G.screen = 'playing'; G.missions.state = 'idle'; G.missions.marker = null; }
        return ACTION_CONFIRM;
      }
      return 0;
    }
    if (G.screen === 'failed') {
      if (actions & ACTION_CONFIRM) {
        startMission(G, G.missions.current);
        return ACTION_CONFIRM;
      }
      return 0;
    }
    if (G.screen === 'busted') {
      if (actions & ACTION_CONFIRM) {
        startRun();
        return ACTION_CONFIRM;
      }
      return 0;
    }
    return 0;
  }

  /** One step of driving the player's car, including collisions and heat. */
  function driveCarStep(G, dt) {
    const res = updatePlayerCar(G, G.playerCar, dt);
    G.audio.engine(res.speed01, true);
    // Wrecked: the car stalls and smokes; get out and find another.
    if (G.playerCar.damage >= 100) {
      G.playerCar.speed = 0;
      G.message = 'Car wrecked — get out (E) and find another ride';
      G.messageT = 2;
    }
    // Hitting traffic cars and pedestrians costs heat (with a cooldown).
    for (const t of G.traffic) {
      if (Math.hypot(t.x - G.playerCar.x, t.y - G.playerCar.y) < 40 && Math.abs(G.playerCar.speed) > 80) {
        if (G.hitCd <= 0) {
          G.hitCd = 2;
          G.playerCar.damage = Math.min(100, G.playerCar.damage + 6);
          G.playerCar.speed *= 0.6;
          addSparks(G, t.x, t.y, 4);
          G.audio.thud();
          G.addHeat(1, 'hit a car in traffic');
        }
      }
    }
    for (const ped of G.peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(ped.x - G.playerCar.x, ped.y - G.playerCar.y) < 30 && Math.abs(G.playerCar.speed) > 60) {
        ped.down = 4;
        ped.vx = Math.cos(G.playerCar.angle) * 240;
        ped.vy = Math.sin(G.playerCar.angle) * 240;
        if (G.hitCd <= 0) {
          G.hitCd = 2;
          G.addHeat(1, 'hit a pedestrian');
          G.audio.thud();
        }
      }
    }
    // Speeding through the market square draws the cops.
    if (G.city.zoneAt(G.playerCar.x, G.playerCar.y) === 'market' && Math.abs(G.playerCar.speed) > 300 && G.marketCd <= 0) {
      G.marketCd = 10;
      G.addHeat(1, 'speeding through the market');
    }
  }

  function step(dt, actions) {
    G.time += dt;
    G.messageT = Math.max(0, G.messageT - dt);
    G.shake = Math.max(0, G.shake - dt * 30);
    G.hitCd = Math.max(0, G.hitCd - dt);
    G.marketCd = Math.max(0, G.marketCd - dt);

    if (G.playerCar) {
      // E exits the car here, inside step(): the same flags are never passed to
      // updatePlayer in this step, so an exit cannot instantly re-enter.
      if (actions & ACTION_INTERACT) exitCar(G);
      else driveCarStep(G, dt);
    } else {
      updatePlayer(G, dt, actions);
      G.audio.engine(0, false);
    }

    updateTraffic(G, dt);
    updatePolice(G, dt);
    updateMissions(G, dt);

    // Particles and skid marks age out.
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const p = G.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) G.particles.splice(i, 1);
    }
    for (let i = G.skids.length - 1; i >= 0; i--) {
      G.skids[i].life -= dt;
      if (G.skids[i].life <= 0) G.skids.splice(i, 1);
    }

    // Camera follows the player (or her car), clamped to the world.
    const px = G.playerCar ? G.playerCar.x : G.player.x;
    const py = G.playerCar ? G.playerCar.y : G.player.y;
    const tx = clamp(px - G.vw / 2, 0, Math.max(0, WORLD - G.vw));
    const ty = clamp(py - G.vh / 2, 0, Math.max(0, WORLD - G.vh));
    G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
    G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);

    G.audio.siren(G.heat > 0, dt);

    // Busted: the cops caught Sol on foot.
    if (G.player.health <= 0 && G.screen === 'playing') {
      G.screen = 'busted';
      announce('Busted. The Solmar police caught Sol.');
    }
  }

  function ambient(dt) {
    // Title screen: traffic rolls and the camera drifts over the market.
    G.time += dt;
    updateTraffic(G, dt);
    G.camera.x = 900 - G.vw / 2 + Math.sin(G.time * 0.05) * 120;
    G.camera.y = 900 - G.vh / 2 + Math.cos(G.time * 0.04) * 80;
  }

  // One-shot action flags are kept pending until a consumer takes them.
  // A frame can run with no fixed step (fast rAF, dt < STEP): taking the
  // flags and throwing them away there would silently lose a keypress —
  // that is exactly how the first E press after starting a run got lost.
  let pending = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    pending |= G.input.takeActions();
    pending &= ~handleActions(pending);
    if (G.screen === 'playing') {
      accumulator += dt;
      let stepped = false;
      while (accumulator >= STEP) {
        step(STEP, stepped ? 0 : pending);
        accumulator -= STEP;
        stepped = true;
      }
      // A step ran, so INTERACT (if any) was delivered to it. If no step
      // ran yet, the flags stay pending for the next frame.
      if (stepped) pending &= ~ACTION_INTERACT;
    } else if (G.screen === 'title') {
      accumulator += dt;
      while (accumulator >= STEP) {
        ambient(STEP);
        accumulator -= STEP;
      }
      pending &= ~ACTION_INTERACT;
    } else {
      accumulator = 0;
      // Outside play, E has no meaning — drop it so it can't fire later.
      pending &= ~ACTION_INTERACT;
    }
    renderer.draw(G, overlayFor(G.screen));
    G.input.endFrame();
  }

  window.addEventListener('resize', () => {
    G.vw = window.innerWidth;
    G.vh = window.innerHeight;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'playing') {
      G.screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Solmar: Sunset Run. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
