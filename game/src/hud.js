// HUD and menus, drawn on the main canvas: cash + heat flames (top-left), minimap
// (top-right), objective + timer (bottom), speed + damage while driving, and the
// title / pause / briefing / results / busted panels.
import { MISSIONS, objectiveText } from './missions.js';
import { WORLD } from './city.js';

const FONT = 'bold 16px system-ui, sans-serif';

function panel(ctx, vw, vh, w, h, title, lines, prompt, accent) {
  const x = (vw - w) / 2;
  const y = (vh - h) / 2;
  ctx.fillStyle = 'rgba(20, 14, 24, 0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent || '#e8b73a';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5e6c8';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(title, vw / 2, y + 52);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#d8c8a8';
  let ly = y + 96;
  for (const line of lines) {
    // Simple word wrap at panel width.
    const words = line.split(' ');
    let row = '';
    for (const word of words) {
      const test = row ? row + ' ' + word : word;
      if (ctx.measureText(test).width > w - 70 && row) {
        ctx.fillText(row, vw / 2, ly);
        ly += 26;
        row = word;
      } else row = test;
    }
    if (row) { ctx.fillText(row, vw / 2, ly); ly += 26; }
    ly += 8;
  }
  if (prompt) {
    ctx.fillStyle = '#e8b73a';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(prompt, vw / 2, y + h - 26);
  }
}

export function drawHUD(G) {
  const ctx = G.ctx;
  const vw = G.vw, vh = G.vh;
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash + heat flames, on a dark plate so they stay legible over
  // light buildings (the chase shot's orange tower washed the white text out).
  ctx.fillStyle = 'rgba(20, 14, 24, 0.45)';
  ctx.fillRect(8, 8, 232, 84);
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#f5e6c8';
  ctx.fillText(`$${G.cash.toLocaleString('en-US')}`, 18, 36);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#d8c8a8';
  ctx.fillText(`of $5,000 for the medallion`, 18, 58);
  // Heat flames: 5 flame icons, lit ones orange.
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * 30;
    const y = 78;
    ctx.fillStyle = i < G.heat ? '#ff7a2e' : 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 8, y - 6, x, y - 16);
    ctx.quadraticCurveTo(x + 8, y - 6, x, y);
    ctx.fill();
  }
  ctx.fillStyle = '#f5e6c8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('HEAT', 20 + 5 * 30 + 8, 82);

  drawMinimap(G);

  // Bottom: a dark strip so the objective, timer and hints stay legible over the city.
  ctx.fillStyle = 'rgba(20, 14, 24, 0.45)';
  ctx.fillRect(0, vh - 112, vw, 112);
  // Objective + timer + message.
  const obj = objectiveText(G);
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#fff3d0';
  const distTxt = obj.dist >= 0 ? `  (${obj.dist} m)` : '';
  ctx.fillText(obj.text + distTxt, vw / 2, vh - 52);
  if (G.missions.state === 'active') {
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = G.missions.timer < 20 ? '#ff6a4a' : '#f5e6c8';
    const t = Math.max(0, Math.ceil(G.missions.timer));
    ctx.fillText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, vw / 2, vh - 26);
  }
  if (G.messageT > 0) {
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(G.message, vw / 2, vh - 86);
  }

  // Driving: speed + damage bar (bottom-right).
  if (G.playerCar) {
    const car = G.playerCar;
    ctx.textAlign = 'right';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#f5e6c8';
    ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.36)} km/h`, vw - 18, vh - 26);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(vw - 168, vh - 52, 150, 10);
    ctx.fillStyle = car.damage > 60 ? '#ff5a3a' : '#7ac74f';
    ctx.fillRect(vw - 168, vh - 52, 150 * (1 - car.damage / 100), 10);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#d8c8a8';
    ctx.fillText(car.name, vw - 18, vh - 58);
  } else {
    // On foot: contextual hint.
    ctx.textAlign = 'center';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#d8c8a8';
    const near = G.parked.length > 0;
    ctx.fillText(near ? 'WASD walk · Shift run · Space punch · E steal a car · P pause' : 'WASD walk · Shift run · Space punch · P pause', vw / 2, vh - 8);
  }
}

function drawMinimap(G) {
  const ctx = G.ctx;
  const size = 150;
  const x0 = G.vw - size - 14;
  const y0 = 14;
  const s = size / WORLD;
  ctx.fillStyle = 'rgba(20, 14, 24, 0.75)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  // Sea + land.
  ctx.fillStyle = '#2e6f8f';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#e8d8a8';
  ctx.fillRect(x0 + 140 * s, y0, size - 140 * s, size);
  // Roads.
  ctx.strokeStyle = '#6a6a6a';
  ctx.lineWidth = 3;
  for (const c of G.city ? [300, 700, 1100, 1500, 1900] : []) {
    ctx.beginPath(); ctx.moveTo(x0 + c * s, y0); ctx.lineTo(x0 + c * s, y0 + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 + c * s); ctx.lineTo(x0 + size, y0 + c * s); ctx.stroke();
  }
  // Mission marker.
  if (G.missions.marker) {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(x0 + G.missions.marker.x * s, y0 + G.missions.marker.y * s, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police dots.
  ctx.fillStyle = '#4a9aff';
  for (const p of G.police) {
    ctx.beginPath();
    ctx.arc(x0 + p.x * s, y0 + p.y * s, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = G.playerCar ? G.playerCar.x : G.player.x;
  const py = G.playerCar ? G.playerCar.y : G.player.y;
  const pa = G.playerCar ? G.playerCar.angle : G.player.angle;
  ctx.save();
  ctx.translate(x0 + px * s, y0 + py * s);
  ctx.rotate(pa);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawTitle(G) {
  const ctx = G.ctx;
  panel(ctx, G.vw, G.vh, 620, 430, 'SOLMAR: SUNSET RUN', [
    'Marisol "Sol" Reyes drives a battered taxi by day and runs special',
    'deliveries by night. She needs $5,000 to buy back her father\'s taxi',
    'medallion from the Port Cats before the city impounds it.',
    '',
    'Steal cars, run six missions for Tía Carmen, dodge the Port Cats,',
    'and outrun the heat across the whole of Solmar City.',
    '',
    'WASD / arrows — drive or walk · E — enter / steal a car',
    'Space — handbrake / punch · Shift — run · P — pause · M — mute',
  ], 'Press Enter or click to start', '#e8b73a');
  ctx.textAlign = 'center';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#d8c8a8';
  if (G.best > 0) ctx.fillText(`Best run: $${G.best.toLocaleString('en-US')}`, G.vw / 2, G.vh / 2 + 250);
}

export function drawPause(G) {
  const ctx = G.ctx;
  const done = G.missions.completed.filter(Boolean).length;
  panel(ctx, G.vw, G.vh, 560, 380, 'PAUSED', [
    `Cash: $${G.cash.toLocaleString('en-US')} — missions done: ${done}/6`,
    '',
    'Enter — resume · M — mute · R — restart the run',
    'Missions (replay a finished one from here):',
    ...MISSIONS.map((m, i) => `${G.missions.completed[i] ? '✓' : '·'} ${i + 1}. ${m.name} — $${m.payout}`),
  ], 'Press P or Enter to resume', '#e8b73a');
}

export function drawBriefing(G) {
  const ctx = G.ctx;
  const def = MISSIONS[G.briefingMission];
  const done = G.missions.completed.filter(Boolean).length;
  panel(ctx, G.vw, G.vh, 620, 440, `MISSION ${def.id} — ${def.name.toUpperCase()}`, [
    def.brief,
    '',
    `Payout: $${def.payout} · Time limit: ${Math.floor(def.time / 60)}:${String(def.time % 60).padStart(2, '0')}`,
    def.hint,
    '',
    `Cash: $${G.cash.toLocaleString('en-US')} of $5,000 · Missions done: ${done}/6`,
  ], 'Press Enter to start the job', '#e8b73a');
}

export function drawComplete(G) {
  const ctx = G.ctx;
  const def = MISSIONS[G.missions.current];
  const next = G.missions.current + 1;
  const lines = [
    `Job done. Tía Carmen pays $${G.lastPayout}.`,
    `Total cash: $${G.cash.toLocaleString('en-US')} of $5,000.`,
  ];
  if (next < MISSIONS.length) lines.push('', `Next: ${MISSIONS[next].name} — $${MISSIONS[next].payout}`);
  else lines.push('', 'The medallion is yours. Solmar is yours. Sunset, at last.');
  panel(ctx, G.vw, G.vh, 560, 360, 'JOB COMPLETE', lines,
    next < MISSIONS.length ? 'Press Enter for the next job' : 'Press Enter to free-roam', '#7ac74f');
}

export function drawFailed(G) {
  const ctx = G.ctx;
  panel(ctx, G.vw, G.vh, 520, 300, 'JOB FAILED', [
    G.missions.failReason || 'The job went south.',
    '',
    'Tía Carmen is not angry. Just disappointed. Try again.',
  ], 'Press Enter to retry the job', '#ff6a4a');
}

export function drawBusted(G) {
  const ctx = G.ctx;
  panel(ctx, G.vw, G.vh, 520, 300, 'BUSTED', [
    'The Solmar police finally caught up with Sol.',
    `Cash kept: $${G.cash.toLocaleString('en-US')}. The medallion waits.`,
  ], 'Press Enter to try again', '#ff6a4a');
}
