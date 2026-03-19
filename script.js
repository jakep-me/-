const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hpValue = document.getElementById('hpValue');
const killValue = document.getElementById('killValue');
const waveValue = document.getElementById('waveValue');
const ammoValue = document.getElementById('ammoValue');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');

const pauseButton = document.getElementById('pauseButton');
const restartButton = document.getElementById('restartButton');
const dashButton = document.getElementById('dashButton');
const smokeButton = document.getElementById('smokeButton');
const reloadButton = document.getElementById('reloadButton');
const shootButton = document.getElementById('shootButton');

const movePad = document.getElementById('movePad');
const aimPad = document.getElementById('aimPad');
const moveStick = document.getElementById('moveStick');
const aimStick = document.getElementById('aimStick');

const state = {
  width: canvas.width,
  height: canvas.height,
  paused: false,
  gameOver: false,
  time: 0,
  kills: 0,
  wave: 1,
  smokeTime: 0,
  reloadTime: 0,
  lastShot: 0,
  input: {
    moveX: 0,
    moveY: 0,
    aimX: 1,
    aimY: 0,
    shootHeld: false,
  },
  player: {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 24,
    hp: 100,
    speed: 210,
    ammo: 18,
    magazine: 18,
    fireRate: 0.15,
    invulnerableTime: 0,
    dashCooldown: 0,
  },
  bullets: [],
  enemies: [],
  particles: [],
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(title, message) {
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

function spawnWave() {
  const count = 3 + state.wave * 2;
  for (let index = 0; index < count; index += 1) {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = rand(0, state.width);
      y = -40;
    } else if (edge === 1) {
      x = state.width + 40;
      y = rand(0, state.height);
    } else if (edge === 2) {
      x = rand(0, state.width);
      y = state.height + 40;
    } else {
      x = -40;
      y = rand(0, state.height);
    }

    state.enemies.push({
      x,
      y,
      radius: 18,
      speed: 55 + state.wave * 8 + rand(0, 20),
      hp: 30 + state.wave * 8,
      attackCooldown: rand(0.3, 1.2),
    });
  }

  setStatus(`웨이브 ${state.wave}`, `적 ${count}기가 진입했습니다. 엄폐와 스킬을 활용하세요.`);
}

function resetGame() {
  state.paused = false;
  state.gameOver = false;
  state.time = 0;
  state.kills = 0;
  state.wave = 1;
  state.smokeTime = 0;
  state.reloadTime = 0;
  state.lastShot = 0;
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  Object.assign(state.player, {
    x: state.width / 2,
    y: state.height / 2,
    hp: 100,
    ammo: 18,
    invulnerableTime: 0,
    dashCooldown: 0,
  });
  spawnWave();
  syncHud();
}

function syncHud() {
  hpValue.textContent = Math.max(0, Math.ceil(state.player.hp));
  killValue.textContent = state.kills;
  waveValue.textContent = state.wave;
  ammoValue.textContent = state.reloadTime > 0 ? '...' : state.player.ammo;
}

function createBurst(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: rand(-100, 100),
      vy: rand(-100, 100),
      life: rand(0.25, 0.7),
      size: rand(2, 5),
      color,
    });
  }
}

function shoot() {
  if (state.paused || state.gameOver || state.reloadTime > 0) {
    return;
  }

  if (state.player.ammo <= 0) {
    setStatus('탄약 부족', '재장전 버튼을 눌러 탄약을 보충하세요.');
    return;
  }

  const now = state.time;
  if (now - state.lastShot < state.player.fireRate) {
    return;
  }

  const { aimX, aimY } = state.input;
  const length = Math.hypot(aimX, aimY) || 1;
  const dirX = aimX / length;
  const dirY = aimY / length;

  state.lastShot = now;
  state.player.ammo -= 1;
  state.bullets.push({
    x: state.player.x + dirX * 28,
    y: state.player.y + dirY * 28,
    vx: dirX * 780,
    vy: dirY * 780,
    radius: 5,
    damage: 24,
    life: 0.9,
  });
  createBurst(state.player.x + dirX * 24, state.player.y + dirY * 24, '108,231,255', 4);
  syncHud();
}

function reload() {
  if (state.reloadTime > 0 || state.player.ammo === state.player.magazine) {
    return;
  }
  state.reloadTime = 1.3;
  setStatus('재장전', '탄창을 교체하는 중입니다. 잠시 몸을 숨기세요.');
  syncHud();
}

function dash() {
  if (state.player.dashCooldown > 0 || state.gameOver) {
    return;
  }

  const { moveX, moveY, aimX, aimY } = state.input;
  const baseX = Math.abs(moveX) + Math.abs(moveY) > 0.1 ? moveX : aimX;
  const baseY = Math.abs(moveX) + Math.abs(moveY) > 0.1 ? moveY : aimY;
  const length = Math.hypot(baseX, baseY) || 1;
  state.player.x = clamp(state.player.x + (baseX / length) * 120, 30, state.width - 30);
  state.player.y = clamp(state.player.y + (baseY / length) * 120, 30, state.height - 30);
  state.player.invulnerableTime = 0.35;
  state.player.dashCooldown = 4.0;
  createBurst(state.player.x, state.player.y, '132,255,179', 18);
  setStatus('대시 사용', '순간 가속으로 적의 조준을 벗어났습니다.');
}

function smoke() {
  if (state.smokeTime > 0 || state.gameOver) {
    return;
  }
  state.smokeTime = 4.5;
  createBurst(state.player.x, state.player.y, '95,140,255', 32);
  setStatus('스모크 전개', '적의 돌진 속도가 감소하고 시야가 혼란스러워졌습니다.');
}

function updatePlayer(dt) {
  const { moveX, moveY } = state.input;
  const moveLength = Math.hypot(moveX, moveY);
  if (moveLength > 0.05) {
    const step = (state.player.speed * dt) / moveLength;
    state.player.x = clamp(state.player.x + moveX * step, 28, state.width - 28);
    state.player.y = clamp(state.player.y + moveY * step, 28, state.height - 28);
  }

  state.player.invulnerableTime = Math.max(0, state.player.invulnerableTime - dt);
  state.player.dashCooldown = Math.max(0, state.player.dashCooldown - dt);

  if (state.reloadTime > 0) {
    state.reloadTime = Math.max(0, state.reloadTime - dt);
    if (state.reloadTime === 0) {
      state.player.ammo = state.player.magazine;
      setStatus('재장전 완료', '탄약이 보충되었습니다. 다시 교전을 시작하세요.');
      syncHud();
    }
  }

  if (state.input.shootHeld) {
    shoot();
  }
}

function updateBullets(dt) {
  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    let active = bullet.life > 0;
    for (const enemy of state.enemies) {
      const distance = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
      if (distance <= bullet.radius + enemy.radius) {
        enemy.hp -= bullet.damage;
        createBurst(enemy.x, enemy.y, '255,107,134', 10);
        active = false;
        break;
      }
    }

    return (
      active &&
      bullet.x >= -20 &&
      bullet.x <= state.width + 20 &&
      bullet.y >= -20 &&
      bullet.y <= state.height + 20
    );
  });
}

function updateEnemies(dt) {
  const slowFactor = state.smokeTime > 0 ? 0.45 : 1;

  for (const enemy of state.enemies) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / distance) * enemy.speed * slowFactor * dt;
    enemy.y += (dy / distance) * enemy.speed * slowFactor * dt;
    enemy.attackCooldown -= dt;

    if (distance < enemy.radius + state.player.radius + 4 && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = 0.75;
      if (state.player.invulnerableTime <= 0) {
        state.player.hp -= 11;
        state.player.invulnerableTime = 0.4;
        createBurst(state.player.x, state.player.y, '255,255,255', 12);
        setStatus('피격!', '엄폐하거나 대시로 거리를 벌리세요.');
        if (state.player.hp <= 0) {
          state.gameOver = true;
          setStatus('작전 실패', '재시작으로 다시 도전하세요.');
        }
      }
    }
  }

  const alive = [];
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      alive.push(enemy);
    } else {
      state.kills += 1;
    }
  }
  state.enemies = alive;

  if (state.enemies.length === 0 && !state.gameOver) {
    state.wave += 1;
    state.player.hp = clamp(state.player.hp + 12, 0, 100);
    state.player.ammo = state.player.magazine;
    spawnWave();
  }
}

function updateParticles(dt) {
  state.particles = state.particles.filter((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    return particle.life > 0;
  });
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, '#183463');
  gradient.addColorStop(0.48, '#131d36');
  gradient.addColorStop(1, '#081118');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 40; x < state.width; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.height);
    ctx.stroke();
  }
  for (let y = 20; y < state.height; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  [[180, 160, 160, 80], [620, 280, 210, 70], [960, 150, 140, 140], [880, 520, 180, 90], [300, 500, 120, 120]].forEach(
    ([x, y, w, h]) => {
      ctx.fillRect(x, y, w, h);
    },
  );

  if (state.smokeTime > 0) {
    ctx.fillStyle = `rgba(110, 133, 210, ${Math.min(0.32, state.smokeTime / 10)})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }
}

function drawPlayer() {
  const angle = Math.atan2(state.input.aimY, state.input.aimX || 0.0001);
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(angle);

  ctx.fillStyle = state.player.invulnerableTime > 0 ? '#ffffff' : '#6ce7ff';
  ctx.beginPath();
  ctx.arc(0, 0, state.player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#05111b';
  ctx.fillRect(4, -6, 30, 12);

  ctx.restore();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.fillStyle = '#ff6b86';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(enemy.x - 20, enemy.y - 28, 40, 6);
    ctx.fillStyle = '#84ffb3';
    ctx.fillRect(enemy.x - 20, enemy.y - 28, 40 * (enemy.hp / (30 + state.wave * 8)), 6);
  }
}

function drawBullets() {
  ctx.fillStyle = '#fff3a1';
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.fillStyle = `rgba(${particle.color}, ${Math.max(particle.life, 0)})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOverlay() {
  if (!state.paused && !state.gameOver) {
    return;
  }

  ctx.fillStyle = 'rgba(4, 6, 14, 0.58)';
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.fillStyle = '#f5f7ff';
  ctx.textAlign = 'center';
  ctx.font = '700 48px Inter, sans-serif';
  ctx.fillText(state.gameOver ? 'MISSION FAILED' : 'PAUSED', state.width / 2, state.height / 2 - 10);
  ctx.font = '400 24px Inter, sans-serif';
  ctx.fillText('재시작 버튼으로 즉시 다시 플레이할 수 있습니다.', state.width / 2, state.height / 2 + 34);
}

let previousTime = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - previousTime) / 1000);
  previousTime = now;

  if (!state.paused && !state.gameOver) {
    state.time += dt;
    state.smokeTime = Math.max(0, state.smokeTime - dt);
    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateParticles(dt);
    syncHud();
  }

  drawBackground();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawOverlay();
  requestAnimationFrame(frame);
}

function bindButton(button, action, hold = false) {
  const start = (event) => {
    event.preventDefault();
    action(true);
  };
  const end = (event) => {
    event.preventDefault();
    if (hold) {
      action(false);
    }
  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', end);
  button.addEventListener('pointerleave', end);
  button.addEventListener('pointercancel', end);
}

function setupPad(pad, stick, onMove) {
  const pointerState = { active: false, id: null, rect: null };

  const updateFromEvent = (event) => {
    pointerState.rect = pad.getBoundingClientRect();
    const cx = pointerState.rect.left + pointerState.rect.width / 2;
    const cy = pointerState.rect.top + pointerState.rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const maxRadius = pointerState.rect.width * 0.34;
    const distance = Math.min(Math.hypot(dx, dy), maxRadius);
    const angle = Math.atan2(dy, dx);
    const nx = (Math.cos(angle) * distance) / maxRadius;
    const ny = (Math.sin(angle) * distance) / maxRadius;
    stick.style.transform = `translate(${nx * maxRadius}px, ${ny * maxRadius}px)`;
    onMove(nx, ny);
  };

  pad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pointerState.active = true;
    pointerState.id = event.pointerId;
    pad.setPointerCapture(event.pointerId);
    updateFromEvent(event);
  });

  pad.addEventListener('pointermove', (event) => {
    if (!pointerState.active || event.pointerId !== pointerState.id) {
      return;
    }
    updateFromEvent(event);
  });

  const reset = (event) => {
    if (!pointerState.active || (event && event.pointerId !== pointerState.id)) {
      return;
    }
    pointerState.active = false;
    pointerState.id = null;
    stick.style.transform = 'translate(0px, 0px)';
    onMove(0, 0);
  };

  pad.addEventListener('pointerup', reset);
  pad.addEventListener('pointercancel', reset);
  pad.addEventListener('pointerleave', reset);
}

pauseButton.addEventListener('click', () => {
  state.paused = !state.paused;
  setStatus(state.paused ? '일시정지' : '작전 재개', state.paused ? '잠시 호흡을 가다듬고 다음 교전을 준비하세요.' : '전장을 다시 장악하세요.');
});
restartButton.addEventListener('click', resetGame);

bindButton(shootButton, (pressed) => {
  state.input.shootHeld = pressed;
  if (pressed) {
    shoot();
  }
}, true);
bindButton(dashButton, () => dash());
bindButton(smokeButton, () => smoke());
bindButton(reloadButton, () => reload());

setupPad(movePad, moveStick, (x, y) => {
  state.input.moveX = x;
  state.input.moveY = y;
});

setupPad(aimPad, aimStick, (x, y) => {
  if (Math.hypot(x, y) > 0.1) {
    state.input.aimX = x;
    state.input.aimY = y;
  }
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === ' ') {
    state.input.shootHeld = true;
    shoot();
  }
  if (key === 'r') reload();
  if (key === 'q') dash();
  if (key === 'e') smoke();
  if (key === 'p') state.paused = !state.paused;
});

window.addEventListener('keyup', (event) => {
  if (event.key === ' ') {
    state.input.shootHeld = false;
  }
});

window.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * state.width;
  const y = ((event.clientY - rect.top) / rect.height) * state.height;
  state.input.aimX = x - state.player.x;
  state.input.aimY = y - state.player.y;
});

window.addEventListener('keydown', (event) => {
  const move = 1;
  const key = event.key.toLowerCase();
  if (key === 'w') state.input.moveY = -move;
  if (key === 's') state.input.moveY = move;
  if (key === 'a') state.input.moveX = -move;
  if (key === 'd') state.input.moveX = move;
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if ((key === 'w' && state.input.moveY < 0) || (key === 's' && state.input.moveY > 0)) state.input.moveY = 0;
  if ((key === 'a' && state.input.moveX < 0) || (key === 'd' && state.input.moveX > 0)) state.input.moveX = 0;
});

resetGame();
requestAnimationFrame(frame);
