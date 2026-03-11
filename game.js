const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hud = {
  hp: document.getElementById("hp"),
  shield: document.getElementById("shield"),
  ammo: document.getElementById("ammo"),
  score: document.getElementById("score"),
  wave: document.getElementById("wave"),
  notice: document.getElementById("notice"),
};

const state = {
  width: canvas.width,
  height: canvas.height,
  time: 0,
  pointerLocked: false,
  keys: new Set(),
  mouseDeltaX: 0,
  mouseDeltaY: 0,
  shooting: false,
  player: {
    x: 8,
    y: 8,
    angle: 0,
    hp: 100,
    shield: 40,
    ammo: 24,
    reserveAmmo: 168,
    maxAmmo: 24,
    fireCooldown: 0,
    reloadTimer: 0,
    speedBoost: 1,
    hitPulse: 0,
    recoil: 0,
    dashCooldown: 0,
    dashTimer: 0,
    pulseCooldown: 0,
    slowCooldown: 0,
    slowTimer: 0,
  },
  world: {
    mapW: 24,
    mapH: 24,
    walls: [],
    enemies: [],
    particles: [],
    pickups: [],
    bullets: [],
  },
  score: 0,
  wave: 1,
  gameOver: false,
  waveTimer: 4,
};

function rng(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function initMap() {
  const { mapW, mapH } = state.world;
  const walls = Array.from({ length: mapH }, (_, y) =>
    Array.from({ length: mapW }, (_, x) =>
      x === 0 || y === 0 || x === mapW - 1 || y === mapH - 1 ? 1 : 0,
    ),
  );

  for (let y = 2; y < mapH - 2; y++) {
    for (let x = 2; x < mapW - 2; x++) {
      if (Math.random() < 0.11 && (x + y) % 3 !== 0) walls[y][x] = 1;
    }
  }

  walls[8][8] = 0;
  walls[8][9] = 0;
  walls[9][8] = 0;
  walls[7][8] = 0;

  state.world.walls = walls;
}

function isWall(x, y) {
  const gx = Math.floor(x);
  const gy = Math.floor(y);
  if (gy < 0 || gx < 0 || gy >= state.world.mapH || gx >= state.world.mapW) return true;
  return state.world.walls[gy][gx] === 1;
}

function spawnEnemy(kind = "scout") {
  let x = 0;
  let y = 0;
  let attempts = 0;
  while (attempts < 250) {
    x = Math.floor(rng(1, state.world.mapW - 1)) + 0.5;
    y = Math.floor(rng(1, state.world.mapH - 1)) + 0.5;
    if (!isWall(x, y)) {
      const dx = x - state.player.x;
      const dy = y - state.player.y;
      if (dx * dx + dy * dy > 30) break;
    }
    attempts++;
  }

  const presets = {
    scout: { hp: 30, speed: 1.2, color: "#ff6b9a", radius: 0.24, score: 30 },
    brute: { hp: 65, speed: 0.72, color: "#ff9f45", radius: 0.33, score: 70 },
    phantom: { hp: 40, speed: 1.45, color: "#94a8ff", radius: 0.2, score: 50 },
  };

  state.world.enemies.push({
    x,
    y,
    dir: rng(-Math.PI, Math.PI),
    hp: presets[kind].hp + state.wave * 4,
    speed: presets[kind].speed + state.wave * 0.03,
    color: presets[kind].color,
    radius: presets[kind].radius,
    kind,
    score: presets[kind].score,
    hitFlash: 0,
    attackCooldown: 0,
  });
}

function spawnWave() {
  const n = 4 + state.wave * 2;
  for (let i = 0; i < n; i++) {
    const roll = Math.random();
    if (roll < 0.55) spawnEnemy("scout");
    else if (roll < 0.82) spawnEnemy("phantom");
    else spawnEnemy("brute");
  }
  hud.notice.textContent = `웨이브 ${state.wave} 시작! 적 ${n}개체가 접근 중.`;
}

function castRay(px, py, angle, maxDist = 24) {
  let dist = 0;
  const step = 0.04;
  while (dist < maxDist) {
    const x = px + Math.cos(angle) * dist;
    const y = py + Math.sin(angle) * dist;
    if (isWall(x, y)) return dist;
    dist += step;
  }
  return maxDist;
}

function lineOfSight(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  const steps = Math.ceil(d / 0.08);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const y = ay + dy * t;
    if (isWall(x, y)) return false;
  }
  return true;
}

function shoot() {
  const p = state.player;
  if (p.fireCooldown > 0 || p.reloadTimer > 0 || p.ammo <= 0) return;

  p.ammo -= 1;
  p.fireCooldown = 0.09;
  p.recoil = 0.18;

  const spread = rng(-0.025, 0.025);
  const rayAngle = p.angle + spread;

  let bestEnemy = null;
  let bestDist = Infinity;

  for (const enemy of state.world.enemies) {
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const along = dx * Math.cos(rayAngle) + dy * Math.sin(rayAngle);
    if (along < 0) continue;

    const perp = Math.abs(-Math.sin(rayAngle) * dx + Math.cos(rayAngle) * dy);
    if (perp < enemy.radius + 0.06 && along < bestDist && lineOfSight(p.x, p.y, enemy.x, enemy.y)) {
      bestDist = along;
      bestEnemy = enemy;
    }
  }

  if (bestEnemy) {
    const dmg = 18 + rng(-4, 5);
    bestEnemy.hp -= dmg;
    bestEnemy.hitFlash = 0.18;
    for (let i = 0; i < 8; i++) {
      state.world.particles.push({
        x: bestEnemy.x,
        y: bestEnemy.y,
        vx: rng(-1.5, 1.5),
        vy: rng(-1.5, 1.5),
        life: rng(0.25, 0.45),
        color: "#ffd2e5",
      });
    }
  }

  const hitX = p.x + Math.cos(rayAngle) * Math.min(bestDist, 30);
  const hitY = p.y + Math.sin(rayAngle) * Math.min(bestDist, 30);
  state.world.bullets.push({ x1: p.x, y1: p.y, x2: hitX, y2: hitY, life: 0.06 });

  if (p.ammo <= 0) {
    p.reloadTimer = 1.4;
    hud.notice.textContent = "재장전 중...";
  }
}

function activatePulse() {
  const p = state.player;
  if (p.pulseCooldown > 0) return;
  p.pulseCooldown = 8;

  for (const enemy of state.world.enemies) {
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 5.8 && lineOfSight(p.x, p.y, enemy.x, enemy.y)) {
      const push = 2.8 / Math.max(0.3, dist);
      enemy.x += (dx / dist) * push;
      enemy.y += (dy / dist) * push;
      enemy.hp -= 10;
      enemy.hitFlash = 0.3;
    }
  }
  hud.notice.textContent = "PULSE 방출! 주변 적을 밀어냈습니다.";
}

function activateDash() {
  const p = state.player;
  if (p.dashCooldown > 0) return;
  p.dashCooldown = 5;
  p.dashTimer = 0.22;
  hud.notice.textContent = "DASH!";
}

function activateSlow() {
  const p = state.player;
  if (p.slowCooldown > 0) return;
  p.slowCooldown = 13;
  p.slowTimer = 3.2;
  hud.notice.textContent = "TIME-SLOW 발동!";
}

function update(dt) {
  if (state.gameOver) return;
  state.time += dt;

  const p = state.player;

  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.reloadTimer = Math.max(0, p.reloadTimer - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.pulseCooldown = Math.max(0, p.pulseCooldown - dt);
  p.slowCooldown = Math.max(0, p.slowCooldown - dt);
  p.dashTimer = Math.max(0, p.dashTimer - dt);
  p.slowTimer = Math.max(0, p.slowTimer - dt);
  p.hitPulse = Math.max(0, p.hitPulse - dt);
  p.recoil = Math.max(0, p.recoil - dt * 2.4);

  if (p.reloadTimer === 0 && p.ammo === 0 && p.reserveAmmo > 0) {
    const refill = Math.min(p.maxAmmo, p.reserveAmmo);
    p.ammo = refill;
    p.reserveAmmo -= refill;
    hud.notice.textContent = "재장전 완료.";
  }

  const mouseSensitivity = 0.0028;
  p.angle += state.mouseDeltaX * mouseSensitivity;
  state.mouseDeltaX = 0;

  const forward = Number(state.keys.has("KeyW")) - Number(state.keys.has("KeyS"));
  const side = Number(state.keys.has("KeyD")) - Number(state.keys.has("KeyA"));
  const walkSpeed = 3.1 * (p.dashTimer > 0 ? 3.2 : 1);

  if (forward || side) {
    const moveAngle = p.angle + Math.atan2(side, forward || 1);
    const mv = walkSpeed * dt;
    const nx = p.x + Math.cos(moveAngle) * mv;
    const ny = p.y + Math.sin(moveAngle) * mv;
    if (!isWall(nx, p.y)) p.x = nx;
    if (!isWall(p.x, ny)) p.y = ny;
  }

  if (state.shooting) shoot();

  const enemySlowFactor = p.slowTimer > 0 ? 0.35 : 1;

  for (let i = state.world.enemies.length - 1; i >= 0; i--) {
    const e = state.world.enemies[i];
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.attackCooldown = Math.max(0, e.attackCooldown - dt);

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.001) {
      const canSee = lineOfSight(e.x, e.y, p.x, p.y);
      if (canSee || e.kind === "phantom") {
        const spd = e.speed * enemySlowFactor;
        const step = spd * dt;
        const nx = e.x + (dx / dist) * step;
        const ny = e.y + (dy / dist) * step;
        if (!isWall(nx, e.y)) e.x = nx;
        if (!isWall(e.x, ny)) e.y = ny;
      }
    }

    if (dist < 0.8 && e.attackCooldown === 0) {
      e.attackCooldown = 0.85;
      const dmg = e.kind === "brute" ? 13 : e.kind === "phantom" ? 9 : 7;
      if (p.shield > 0) {
        const absorbed = Math.min(p.shield, dmg);
        p.shield -= absorbed;
        p.hp -= dmg - absorbed;
      } else {
        p.hp -= dmg;
      }
      p.hitPulse = 0.3;
    }

    if (e.hp <= 0) {
      state.score += e.score;
      if (Math.random() < 0.2) {
        state.world.pickups.push({
          x: e.x,
          y: e.y,
          type: Math.random() < 0.65 ? "ammo" : "shield",
          life: 16,
        });
      }
      state.world.enemies.splice(i, 1);
    }
  }

  for (let i = state.world.particles.length - 1; i >= 0; i--) {
    const par = state.world.particles[i];
    par.life -= dt;
    par.x += par.vx * dt;
    par.y += par.vy * dt;
    par.vx *= 0.96;
    par.vy *= 0.96;
    if (par.life <= 0) state.world.particles.splice(i, 1);
  }

  for (let i = state.world.pickups.length - 1; i >= 0; i--) {
    const pick = state.world.pickups[i];
    pick.life -= dt;
    const d = Math.hypot(pick.x - p.x, pick.y - p.y);
    if (d < 0.8) {
      if (pick.type === "ammo") {
        p.reserveAmmo = Math.min(p.reserveAmmo + 22, 250);
        hud.notice.textContent = "탄약 보급 획득 +22";
      } else {
        p.shield = Math.min(60, p.shield + 16);
        hud.notice.textContent = "쉴드 셀 획득 +16";
      }
      state.world.pickups.splice(i, 1);
      continue;
    }
    if (pick.life <= 0) state.world.pickups.splice(i, 1);
  }

  for (let i = state.world.bullets.length - 1; i >= 0; i--) {
    state.world.bullets[i].life -= dt;
    if (state.world.bullets[i].life <= 0) state.world.bullets.splice(i, 1);
  }

  if (state.world.enemies.length === 0) {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) {
      state.wave += 1;
      state.waveTimer = 4;
      p.shield = Math.min(60, p.shield + 8);
      spawnWave();
    }
  }

  if (p.hp <= 0) {
    state.gameOver = true;
    hud.notice.textContent = `GAME OVER - 최종 점수 ${state.score}점 / 새로고침으로 재시작`;
  }

  hud.hp.textContent = Math.max(0, Math.round(p.hp));
  hud.shield.textContent = Math.max(0, Math.round(p.shield));
  hud.ammo.textContent = `${p.ammo} / ${p.reserveAmmo}`;
  hud.score.textContent = Math.round(state.score);
  hud.wave.textContent = state.wave;
}

function renderSkyAndFloor() {
  const gradSky = ctx.createLinearGradient(0, 0, 0, state.height * 0.55);
  gradSky.addColorStop(0, "#0b1630");
  gradSky.addColorStop(1, "#131e41");
  ctx.fillStyle = gradSky;
  ctx.fillRect(0, 0, state.width, state.height * 0.55);

  const gradFloor = ctx.createLinearGradient(0, state.height * 0.55, 0, state.height);
  gradFloor.addColorStop(0, "#0e1320");
  gradFloor.addColorStop(1, "#070a14");
  ctx.fillStyle = gradFloor;
  ctx.fillRect(0, state.height * 0.55, state.width, state.height * 0.45);
}

function renderWorld() {
  const rays = 260;
  const fov = Math.PI / 2.8;
  const p = state.player;

  const wallDistances = [];

  for (let i = 0; i < rays; i++) {
    const t = i / (rays - 1);
    const angle = p.angle - fov / 2 + t * fov;
    let dist = castRay(p.x, p.y, angle, 20);
    dist *= Math.cos(angle - p.angle);
    wallDistances.push(dist);

    const wallHeight = Math.min(state.height, 710 / (dist + 0.001));
    const x = (i / rays) * state.width;
    const shade = Math.max(0.12, 1 - dist / 14);
    ctx.fillStyle = `rgba(${Math.floor(70 * shade)}, ${Math.floor(170 * shade)}, ${Math.floor(220 * shade)}, 1)`;
    ctx.fillRect(x, (state.height - wallHeight) / 2, state.width / rays + 1, wallHeight);
  }

  const sprites = [];

  for (const enemy of state.world.enemies) {
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const dist = Math.hypot(dx, dy);
    const relAngle = Math.atan2(dy, dx) - p.angle;
    const wrapped = Math.atan2(Math.sin(relAngle), Math.cos(relAngle));
    if (Math.abs(wrapped) > fov * 0.7 || dist < 0.2) continue;

    sprites.push({
      type: "enemy",
      enemy,
      dist,
      screenX: ((wrapped + fov / 2) / fov) * state.width,
    });
  }

  for (const pick of state.world.pickups) {
    const dx = pick.x - p.x;
    const dy = pick.y - p.y;
    const dist = Math.hypot(dx, dy);
    const relAngle = Math.atan2(dy, dx) - p.angle;
    const wrapped = Math.atan2(Math.sin(relAngle), Math.cos(relAngle));
    if (Math.abs(wrapped) > fov * 0.7 || dist < 0.2) continue;
    sprites.push({
      type: "pickup",
      pick,
      dist,
      screenX: ((wrapped + fov / 2) / fov) * state.width,
    });
  }

  sprites.sort((a, b) => b.dist - a.dist);

  for (const s of sprites) {
    const size = Math.min(380, 360 / (s.dist + 0.01));
    const x = s.screenX - size / 2;
    const y = state.height / 2 - size * 0.45;

    const rayIndex = Math.floor((s.screenX / state.width) * rays);
    const wallDist = wallDistances[clamp(rayIndex, 0, wallDistances.length - 1)];
    if (s.dist > wallDist) continue;

    if (s.type === "enemy") {
      const e = s.enemy;
      ctx.fillStyle = e.hitFlash > 0 ? "#ffffff" : e.color;
      ctx.beginPath();
      ctx.arc(s.screenX, y + size * 0.56, size * 0.28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(x, y + size * 0.9, size, 8);
      ctx.fillStyle = "#ff5f7a";
      ctx.fillRect(x, y + size * 0.9, size * clamp(e.hp / (80 + state.wave * 4), 0, 1), 8);
    } else {
      const pick = s.pick;
      ctx.fillStyle = pick.type === "ammo" ? "#67ffcc" : "#73b9ff";
      ctx.fillRect(x + size * 0.2, y + size * 0.34, size * 0.6, size * 0.6);
    }
  }

  for (const b of state.world.bullets) {
    const points = [
      { x: b.x1, y: b.y1 },
      { x: b.x2, y: b.y2 },
    ].map((pt) => {
      const dx = pt.x - p.x;
      const dy = pt.y - p.y;
      const dist = Math.hypot(dx, dy);
      const relAngle = Math.atan2(dy, dx) - p.angle;
      const wrapped = Math.atan2(Math.sin(relAngle), Math.cos(relAngle));
      return {
        x: ((wrapped + fov / 2) / fov) * state.width,
        y: state.height / 2 + 90 / (dist + 0.2),
      };
    });

    ctx.strokeStyle = "rgba(220,255,255,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
  }
}

function renderParticlesAndFx() {
  const p = state.player;
  const fov = Math.PI / 2.8;

  for (const par of state.world.particles) {
    const dx = par.x - p.x;
    const dy = par.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.1) continue;
    const relAngle = Math.atan2(dy, dx) - p.angle;
    const wrapped = Math.atan2(Math.sin(relAngle), Math.cos(relAngle));
    if (Math.abs(wrapped) > fov / 2) continue;

    const x = ((wrapped + fov / 2) / fov) * state.width;
    const y = state.height / 2 + 50 / (dist + 0.2);
    const size = 5 / (dist * 0.35 + 1);
    ctx.fillStyle = par.color;
    ctx.fillRect(x, y, size, size);
  }

  if (p.slowTimer > 0) {
    ctx.fillStyle = "rgba(90,130,255,0.09)";
    ctx.fillRect(0, 0, state.width, state.height);
  }

  if (p.hitPulse > 0) {
    ctx.fillStyle = `rgba(255, 20, 60, ${p.hitPulse * 0.35})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }
}

function renderCrosshair() {
  const p = state.player;
  const cx = state.width / 2;
  const cy = state.height / 2;
  const gap = 8 + p.recoil * 24;
  ctx.strokeStyle = "#dfffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - gap - 9, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(cx + gap + 9, cy);
  ctx.moveTo(cx, cy - gap - 9);
  ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap);
  ctx.lineTo(cx, cy + gap + 9);
  ctx.stroke();
}

function renderMinimap() {
  const scale = 9;
  const pad = 16;
  const mapW = state.world.mapW;
  const mapH = state.world.mapH;

  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = "rgba(4,8,20,0.72)";
  ctx.fillRect(pad, state.height - mapH * scale - pad, mapW * scale, mapH * scale);

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      if (state.world.walls[y][x]) {
        ctx.fillStyle = "#2e4f75";
        ctx.fillRect(pad + x * scale, state.height - mapH * scale - pad + y * scale, scale, scale);
      }
    }
  }

  for (const e of state.world.enemies) {
    ctx.fillStyle = e.color;
    ctx.fillRect(
      pad + e.x * scale - 1,
      state.height - mapH * scale - pad + e.y * scale - 1,
      3,
      3,
    );
  }

  const p = state.player;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(pad + p.x * scale, state.height - mapH * scale - pad + p.y * scale, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(pad + p.x * scale, state.height - mapH * scale - pad + p.y * scale);
  ctx.lineTo(
    pad + (p.x + Math.cos(p.angle) * 1.4) * scale,
    state.height - mapH * scale - pad + (p.y + Math.sin(p.angle) * 1.4) * scale,
  );
  ctx.stroke();

  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, state.width, state.height);
  renderSkyAndFloor();
  renderWorld();
  renderParticlesAndFx();
  renderCrosshair();
  renderMinimap();
}

let last = performance.now();
function loop(ts) {
  const dt = Math.min(0.033, (ts - last) / 1000);
  last = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", (e) => {
  state.keys.add(e.code);
  if (e.code === "KeyQ") activatePulse();
  if (e.code === "KeyE") activateDash();
  if (e.code === "KeyR") activateSlow();
  if (e.code === "KeyF" && state.player.reloadTimer === 0 && state.player.ammo < state.player.maxAmmo && state.player.reserveAmmo > 0) {
    state.player.reloadTimer = 1.25;
    state.player.ammo = 0;
  }
});

document.addEventListener("keyup", (e) => {
  state.keys.delete(e.code);
});

canvas.addEventListener("mousedown", () => {
  if (!state.pointerLocked) {
    canvas.requestPointerLock();
    return;
  }
  state.shooting = true;
});

document.addEventListener("mouseup", () => {
  state.shooting = false;
});

document.addEventListener("pointerlockchange", () => {
  state.pointerLocked = document.pointerLockElement === canvas;
  if (state.pointerLocked) {
    hud.notice.textContent = "생존하고 웨이브를 돌파하세요. (WASD 이동 / 좌클릭 사격 / F 재장전)";
  }
});

document.addEventListener("mousemove", (e) => {
  if (!state.pointerLocked) return;
  state.mouseDeltaX += e.movementX;
  state.mouseDeltaY += e.movementY;
});

function fitCanvas() {
  const ratio = 16 / 9;
  const w = window.innerWidth;
  const h = window.innerHeight;
  let drawW = w;
  let drawH = w / ratio;
  if (drawH > h) {
    drawH = h;
    drawW = h * ratio;
  }

  canvas.width = Math.floor(drawW);
  canvas.height = Math.floor(drawH);
  state.width = canvas.width;
  state.height = canvas.height;
}

window.addEventListener("resize", fitCanvas);

initMap();
fitCanvas();
spawnWave();
requestAnimationFrame(loop);
