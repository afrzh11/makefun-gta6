// The six chained missions for Tía Carmen. Sol needs $5,000 to buy back her late father's
// taxi medallion from the Port Cats before the city impounds it. Each mission pays cash;
// the finale is a getaway chase across the whole map.
import { addHeat } from './police.js';

export const MISSIONS = [
  {
    id: 1, name: 'First Fare', payout: 400, time: 120,
    brief: 'Tía Carmen: "First job, Sol. A fare is waiting at the marina gate. Get in your taxi and bring them to the market — easy money, no trouble."',
    hint: 'Drive to the yellow marker at the marina gate.',
  },
  {
    id: 2, name: 'Market Run', payout: 700, time: 120,
    brief: 'Tía Carmen: "Three crates of mangoes for the night market, and the stall opens in two minutes. Grab all three — on foot or by car, I don\'t care."',
    hint: 'Collect all 3 crates in the market plaza.',
  },
  {
    id: 3, name: 'The Tail', payout: 900, time: 180,
    brief: 'Tía Carmen: "A Port Cats van is running the north loop. Follow it — but stay back. If they spot you, the whole crew comes down on us."',
    hint: 'Stay 150–400 px behind the van for 25 s. Closer than 110 px and you are spotted.',
  },
  {
    id: 4, name: 'Cash Drop', payout: 1200, time: 150,
    brief: 'Tía Carmen: "Five drops of cash stashed around the marina. The cops are already sniffing — heat is on you from the start. Grab them all."',
    hint: 'Collect all 5 cash drops around the marina. Heat starts at 2.',
  },
  {
    id: 5, name: 'Port Heist', payout: 1500, time: 180,
    brief: 'Tía Carmen: "El Gato keeps his Cometa GT in the port yard. Take it. Then run — the whole port will be on you."',
    hint: 'Steal the red Cometa GT in the port, then reach the observatory.',
  },
  {
    id: 6, name: 'Sunset Getaway', payout: 1300, time: 150,
    brief: 'Tía Carmen: "Last one, Sol. $5,000 is almost yours. Cross the whole city at full heat and bring the medallion money to the observatory before sunset."',
    hint: 'Reach the observatory at heat 4 before the timer ends.',
  },
];

export function createMissions() {
  return {
    current: 0,           // index into MISSIONS
    state: 'idle',        // 'idle' | 'active' | 'done' | 'failed'
    timer: 0,
    progress: 0,          // mission-specific progress (tail seconds, crates collected)
    marker: null,         // {x, y} objective marker
    completed: [false, false, false, false, false, false],
    tailVan: null,
    failReason: '',
  };
}

function setMarker(G, x, y) { G.missions.marker = { x, y }; }

export function startMission(G, index) {
  const m = G.missions;
  const def = MISSIONS[index];
  m.current = index;
  m.state = 'active';
  m.timer = def.time;
  m.progress = 0;
  m.tailVan = null;
  G.cashDrops = G.cashDrops.filter((d) => d.kind === 'loot');
  if (index === 0) {
    setMarker(G, 300, 2100); // marina gate, on the ocean avenue
  } else if (index === 1) {
    setMarker(G, 900, 900);
    G.cashDrops.push(
      { x: 820, y: 830, amount: 0, taken: false, kind: 'crate' },
      { x: 1020, y: 900, amount: 0, taken: false, kind: 'crate' },
      { x: 900, y: 850, amount: 0, taken: false, kind: 'crate' },
    );
  } else if (index === 2) {
    // The Port Cats van loops the north ring road.
    m.tailVan = { x: 300, y: 300, angle: 0, speed: 150, leg: 0 };
    setMarker(G, 300, 300);
  } else if (index === 3) {
    setMarker(G, 300, 2100);
    addHeat(G, 2, 'the cops are watching the marina');
    // Drops on the beach / avenue strip — never inside a building.
    const spots = [[200, 2000], [320, 2150], [180, 2250], [300, 2050], [220, 2300]];
    for (const [x, y] of spots) G.cashDrops.push({ x, y, amount: 100, taken: false, kind: 'cash' });
  } else if (index === 4) {
    setMarker(G, 2080, 130); // the Cometa GT in the port
  } else if (index === 5) {
    setMarker(G, 2000, 1900); // observatory approach, south of the dome
    addHeat(G, 4, 'full heat — run!');
  }
  G.screen = 'briefing';
  G.briefingMission = index;
}

function playerPos(G) {
  return G.playerCar ? { x: G.playerCar.x, y: G.playerCar.y } : { x: G.player.x, y: G.player.y };
}

function collectDrops(G, kind, radius) {
  const pos = playerPos(G);
  let got = 0;
  for (const d of G.cashDrops) {
    if (d.taken || d.kind !== kind) continue;
    if (Math.hypot(d.x - pos.x, d.y - pos.y) < radius) {
      d.taken = true;
      got += 1;
      if (d.amount > 0) {
        G.cash += d.amount;
        G.audio.chime();
      }
    }
  }
  return got;
}

function completeMission(G) {
  const m = G.missions;
  const def = MISSIONS[m.current];
  m.completed[m.current] = true;
  m.state = 'done';
  G.cash += def.payout;
  G.audio.chime();
  G.lastPayout = def.payout;
  G.screen = 'complete';
  try {
    const best = Number(window.localStorage.getItem('solmar-best-cash') ?? '0') || 0;
    if (G.cash > best) window.localStorage.setItem('solmar-best-cash', String(G.cash));
  } catch { /* storage off */ }
}

function failMission(G, reason) {
  const m = G.missions;
  m.state = 'failed';
  m.failReason = reason;
  G.screen = 'failed';
}

export function updateMissions(G, dt) {
  const m = G.missions;
  if (m.state !== 'active') return;
  const def = MISSIONS[m.current];
  m.timer -= dt;
  if (m.timer <= 0) {
    failMission(G, 'Out of time.');
    return;
  }

  const pos = playerPos(G);

  if (m.current === 0) {
    if (Math.hypot(pos.x - 300, pos.y - 2100) < 70) completeMission(G);
  } else if (m.current === 1) {
    m.progress += collectDrops(G, 'crate', 40);
    const left = G.cashDrops.filter((d) => d.kind === 'crate' && !d.taken).length;
    if (left > 0) {
      const next = G.cashDrops.find((d) => d.kind === 'crate' && !d.taken);
      setMarker(G, next.x, next.y);
    }
    if (left === 0) completeMission(G);
  } else if (m.current === 2) {
    // The van drives the north loop: east along y=300, south along x=1900, west along y=1500, north along x=300.
    const van = m.tailVan;
    const legs = [[1900, 300], [1900, 1500], [300, 1500], [300, 300]];
    const target = legs[van.leg];
    const dx = target[0] - van.x, dy = target[1] - van.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) van.leg = (van.leg + 1) % 4;
    else {
      van.angle = Math.atan2(dy, dx);
      van.x += (dx / d) * van.speed * dt;
      van.y += (dy / d) * van.speed * dt;
    }
    setMarker(G, van.x, van.y);
    const pd = Math.hypot(pos.x - van.x, pos.y - van.y);
    if (pd < 110) {
      m.progress = 0;
      addHeat(G, 1, 'spotted by the Port Cats!');
      G.message = 'SPOTTED! Back off!';
      G.messageT = 2;
    } else if (pd < 400) {
      m.progress += dt;
      if (m.progress >= 25) completeMission(G);
    }
  } else if (m.current === 3) {
    collectDrops(G, 'cash', 40);
    const left = G.cashDrops.filter((d) => d.kind === 'cash' && !d.taken).length;
    if (left > 0) {
      const next = G.cashDrops.find((d) => d.kind === 'cash' && !d.taken);
      setMarker(G, next.x, next.y);
    }
    if (left === 0) completeMission(G);
  } else if (m.current === 4) {
    if (G.playerCar && G.playerCar.special === 'heist') {
      // Got the car — now reach the observatory.
      setMarker(G, 2000, 1900);
      if (Math.hypot(pos.x - 2000, pos.y - 1900) < 80) completeMission(G);
    }
  } else if (m.current === 5) {
    if (Math.hypot(pos.x - 2000, pos.y - 1900) < 80) completeMission(G);
  }
}

/** One-line objective text + distance for the HUD. */
export function objectiveText(G) {
  const m = G.missions;
  if (m.state === 'idle') return { text: 'Find Tía Carmen — press Enter for your first job', dist: -1 };
  const def = MISSIONS[m.current];
  let text = def.hint;
  if (m.current === 1) {
    const left = G.cashDrops.filter((d) => d.kind === 'crate' && !d.taken).length;
    text = `Market Run — crates left: ${left}/3`;
  } else if (m.current === 2) {
    text = `The Tail — stay behind the van: ${Math.floor(m.progress)}/25 s`;
  } else if (m.current === 3) {
    const left = G.cashDrops.filter((d) => d.kind === 'cash' && !d.taken).length;
    text = `Cash Drop — drops left: ${left}/5`;
  }
  const pos = playerPos(G);
  const dist = m.marker ? Math.round(Math.hypot(pos.x - m.marker.x, pos.y - m.marker.y)) : -1;
  return { text, dist };
}
