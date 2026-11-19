// Drawing only: game state in, pixels out. Top-down camera follows the player;
// the world is painted ground → roads → zones → buildings → cars → people → effects.
// A warm sunset gradient washes the sea edge; the camera shakes on impacts.
import { WORLD, ROAD_W } from './city.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    // CSS pixels, not device pixels: the game logic and the canvas agree on vw/vh,
    // which keeps screenshots exactly 1280x720 at a 1280x720 window.
    canvas.width = Math.round(window.innerWidth);
    canvas.height = Math.round(window.innerHeight);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawGround(G) {
    // Land base covering the whole world (world space; the caller translated by camera).
    ctx.fillStyle = '#d8c49a';
    ctx.fillRect(0, 0, WORLD, WORLD);
    // Sea (west) + beach, marina, park, hill, roads, market — all in world space.
    // The caller has already translated by the camera.
    const seaGrad = ctx.createLinearGradient(0, 0, 160, 0);
    seaGrad.addColorStop(0, '#1e5a7a');
    seaGrad.addColorStop(1, '#3a8ab0');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, 140, WORLD);
    ctx.fillStyle = '#ecd9a8';
    ctx.fillRect(140, 0, 110, WORLD);
    // Marina docks.
    ctx.fillStyle = '#8a6a4a';
    for (let i = 0; i < 3; i++) ctx.fillRect(150, 2020 + i * 100, 90, 12);
    // Park grass.
    ctx.fillStyle = '#7fae62';
    ctx.fillRect(350, 1150, 300, 300);
    // Observatory hill.
    ctx.fillStyle = '#b8a888';
    ctx.beginPath();
    ctx.arc(2130, 1700, 190, 0, Math.PI * 2);
    ctx.fill();
    // Roads: asphalt with centre dashes.
    ctx.fillStyle = '#4a4a52';
    for (const c of [300, 700, 1100, 1500, 1900]) {
      ctx.fillRect(c - ROAD_W / 2, 0, ROAD_W, WORLD);
      ctx.fillRect(0, c - ROAD_W / 2, WORLD, ROAD_W);
    }
    ctx.strokeStyle = '#e8d878';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const c of [300, 700, 1100, 1500, 1900]) {
      ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, WORLD); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(WORLD, c); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Market plaza paving.
    ctx.fillStyle = '#c8b088';
    ctx.fillRect(750, 750, 300, 300);
  }

  function drawBuildings(G) {
    // World space; the caller has already translated by the camera.
    for (const b of G.city.buildings) {
      if (b.roof === 'dome') {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a8ab0';
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 4, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      if (b.roof === 'stall') {
        ctx.fillStyle = '#fff3d0';
        ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 10);
      } else {
        // Windows.
        ctx.fillStyle = '#2e3a4a';
        const cols = Math.max(1, Math.floor(b.w / 34));
        const rows = Math.max(1, Math.floor(b.h / 34));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            ctx.fillRect(b.x + 10 + c * 34, b.y + 14 + r * 34, 14, 12);
          }
        }
      }
    }
    for (const c of G.city.containers) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    }
    // Palms and park trees.
    for (const p of G.city.palms) drawPalm(p.x, p.y);
    for (const t of G.city.trees) {
      ctx.fillStyle = '#4a7a3a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(t.x - 2, t.y, 4, 10);
    }
  }

  function drawPalm(x, y) {
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y - 22);
    ctx.stroke();
    ctx.fillStyle = '#3f8f4a';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(x + 3 + Math.cos(a) * 12, y - 22 + Math.sin(a) * 8, 13, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(G, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid);
    ctx.fillStyle = car.color;
    ctx.fillRect(-car.len / 2, -car.wid / 2, car.len, car.wid);
    // Windshield + roof.
    ctx.fillStyle = '#bfe0ea';
    ctx.fillRect(car.len * 0.08, -car.wid / 2 + 3, car.len * 0.22, car.wid - 6);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-car.len * 0.28, -car.wid / 2 + 2, car.len * 0.3, car.wid - 4);
    if (car.cls === 'taxi') {
      ctx.fillStyle = '#222';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (car.driver === 'police') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 4, 10, 5);
      ctx.fillRect(-car.len / 2 + 4, car.wid / 2 - 9, 10, 5);
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(car.len / 2 - 12, -car.wid / 2 + 4, 8, 5);
      ctx.fillStyle = '#3a7aff';
      ctx.fillRect(car.len / 2 - 12, car.wid / 2 - 9, 8, 5);
    }
    if (car.damage > 55) {
      ctx.fillStyle = 'rgba(40,40,40,0.7)';
      ctx.fillRect(-car.len / 2, -car.wid / 2, car.len * 0.3, car.wid);
    }
    ctx.restore();
  }

  function drawPlayer(G) {
    const p = G.player;
    if (!p.onFoot) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // Sol: orange jacket, dark hair, a punch swing when punching.
    ctx.fillStyle = '#e86a2e';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e2a26';
    ctx.beginPath();
    ctx.arc(-2, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    if (p.punchT > 0) {
      ctx.strokeStyle = '#e86a2e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(26, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(G, ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.down > 0) {
      ctx.rotate(1.2);
      ctx.fillStyle = ped.color;
      ctx.fillRect(-9, -5, 18, 10);
    } else {
      ctx.fillStyle = ped.kind === 'rival' ? '#3a3a3a' : ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      if (ped.kind === 'rival') {
        ctx.fillStyle = '#c23b4e';
        ctx.fillRect(-8, -12, 16, 4);
      }
    }
    ctx.restore();
  }

  function drawMarker(G) {
    if (!G.missions.marker) return;
    const m = G.missions.marker;
    const bob = Math.sin(G.time * 3) * 6;
    ctx.save();
    ctx.translate(m.x, m.y + bob - 30);
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(-11, -8);
    ctx.lineTo(11, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a87a00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // A guiding line from the player to the marker when it is off-screen.
    const px = G.playerCar ? G.playerCar.x : G.player.x;
    const py = G.playerCar ? G.playerCar.y : G.player.y;
    const dx = m.x - px, dy = m.y - py;
    const d = Math.hypot(dx, dy);
    if (d > G.vw * 0.6) {
      const ex = G.vw / 2 + (dx / d) * (G.vw / 2 - 60);
      const ey = G.vh / 2 + (dy / d) * (G.vh / 2 - 60);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawDrops(G) {
    for (const d of G.cashDrops) {
      if (d.taken) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.kind === 'crate') {
        ctx.fillStyle = '#a8763e';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.strokeStyle = '#6a4a2a';
        ctx.lineWidth = 2;
        ctx.strokeRect(-11, -11, 22, 22);
      } else {
        ctx.fillStyle = '#2e8f5a';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 5);
      }
      ctx.restore();
    }
  }

  function drawEffects(G) {
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 5;
    for (const s of G.skids) {
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
      ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
      ctx.stroke();
    }
    // Particles.
    for (const p of G.particles) {
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(80,80,80,${a * 0.55})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,200,60,${a})`;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
  }

  /** Paint one frame: world, then HUD/menus per screen. drawHUD lives in hud.js. */
  function draw(G, drawOverlay) {
    const cam = G.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1e5a7a';
    ctx.fillRect(0, 0, G.vw, G.vh);
    const shakeX = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    const shakeY = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    ctx.save();
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
    drawGround(G);
    drawBuildings(G);
    // World-space entities.
    drawMarker(G);
    drawDrops(G);
    for (const car of G.parked) drawCar(G, car);
    for (const car of G.traffic) drawCar(G, car);
    if (G.missions.tailVan) {
      drawCar(G, { ...G.missions.tailVan, cls: 'pickup', color: '#3a3a3a', len: 52, wid: 26, damage: 0, driver: 'traffic' });
    }
    for (const car of G.police) drawCar(G, car);
    if (G.playerCar) drawCar(G, G.playerCar);
    for (const ped of G.peds) drawPed(G, ped);
    drawPlayer(G);
    drawEffects(G);
    ctx.restore();
    // Sunset wash over everything, in screen space.
    const grad = ctx.createLinearGradient(0, 0, 0, G.vh);
    grad.addColorStop(0, 'rgba(255,150,60,0.08)');
    grad.addColorStop(1, 'rgba(255,90,40,0.13)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, G.vw, G.vh);
    drawOverlay(G);
  }

  return { draw, ctx };
}
