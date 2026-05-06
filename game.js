// ===== CANVAS SETUP =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ===== GAME STATE =====
let gameState = 'menu'; // menu | playing | paused | gameover
let selectedVehicle = 'truck';
let bestDistance = parseInt(localStorage.getItem('mcBest') || '0');
let totalCoins = parseInt(localStorage.getItem('mcCoins') || '0');
let sessionCoins = 0;
let distance = 0;
let fuel = 100;
let wheelRotation = 0;
let gameTime = 0;

// ===== MULTIPLAYER =====
let ws = null;
let myId = null;
let myColor = '#e74c3c';
let otherPlayers = {};
let playerName = localStorage.getItem('mcName') || 'Player';
let onlineCount = 1;
let sendCounter = 0;
let gameMode = 'single'; // 'single' or 'multi'
let multiplayerMode = 'race'; // 'race', 'jump', 'demo'
let currentRoomCode = null;

// ===== CONTROLS =====
let gasPressed = false;
let brakePressed = false;

// ===== CAMERA =====
const camera = { x: 0, y: 0 };
let zoomLevel = 1;
const ZOOM_MIN = 0.75;
const ZOOM_MAX = 1.4;
let spectatingId = null;
let isSpectating = false;

const car = {
  x: 250, y: 0, vx: 0, vy: 0,
  angle: 0, angularVel: 0,
  wheelBase: 64, wheelRadius: 15,
  onGround: true, flipTimer: 0,
  // Suspension state
  frontSusp: 0, rearSusp: 0,       // current offset (positive = compressed)
  frontSuspVel: 0, rearSuspVel: 0,  // velocity for spring physics
  bodyTilt: 0                        // body pitch from acceleration
};

// ===== PHYSICS CONSTANTS =====
const GRAVITY = 0.35;
const ENGINE_POWER = { truck: 0.35, jeep: 0.42 };
const BRAKE_POWER = 0.2;
const MAX_SPEED = { truck: 14, jeep: 16 };
const FRICTION = 0.994;
const FUEL_RATE = 0.02;
const BOUNCE = 0.3;

// ===== COLLECTIBLES =====
let collectibles = [];
let particles = [];

// ===== TERRAIN =====
const terrainCache = {};
const TERRAIN_STEP = 3;

function getTerrainY(x) {
  const key = Math.round(x / TERRAIN_STEP) * TERRAIN_STEP;
  if (terrainCache[key] !== undefined) return terrainCache[key];

  const base = canvas.height * 0.55;
  let y = base;
  y += Math.sin(x * 0.0018) * 130;
  y += Math.sin(x * 0.0045 + 1.3) * 70;
  y += Math.sin(x * 0.011 + 0.7) * 35;
  y += Math.sin(x * 0.022 + 2.1) * 18;

  const diff = Math.min(x / 6000, 2.8);
  y += Math.sin(x * 0.007 + 3) * 55 * diff;
  y += Math.sin(x * 0.016 + 1.5) * 28 * diff;

  terrainCache[key] = y;
  return y;
}

function getTerrainAngle(x) {
  const d = 4;
  return Math.atan2(getTerrainY(x + d) - getTerrainY(x - d), 2 * d);
}

// ===== GENERATE COLLECTIBLES =====
function ensureCollectibles() {
  const ahead = car.x + canvas.width * 2;
  const lastX = collectibles.length > 0 ? collectibles[collectibles.length - 1].x : 300;

  for (let x = Math.max(lastX + 200, car.x); x < ahead; x += 120 + Math.random() * 200) {
    const ty = getTerrainY(x);
    const type = Math.random() < 0.2 ? 'fuel' : 'coin';
    // Place coins on the ground surface
    collectibles.push({ x, y: ty - 18, type, collected: false });
  }
  collectibles = collectibles.filter(c => c.x > car.x - 500);
}

// ===== PARTICLES =====
function spawnDust(x, y) {
  for (let i = 0; i < 3; i++) {
    particles.push({
      x, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2 - 1,
      life: 1, decay: 0.02 + Math.random() * 0.02, size: 3 + Math.random() * 4,
      color: `hsla(30, 40%, ${50 + Math.random() * 30}%, `
    });
  }
}

function spawnStars(x, y) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({
      x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3,
      life: 1, decay: 0.03, size: 3 + Math.random() * 3,
      color: `hsla(45, 100%, 60%, `
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.05; p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ===== CAR PHYSICS =====
function updateCar() {
  const ep = ENGINE_POWER[selectedVehicle];
  const ms = MAX_SPEED[selectedVehicle];
  const terrainY = getTerrainY(car.x);
  const terrainAngle = getTerrainAngle(car.x);

  if (car.onGround) {
    // Snap car to terrain surface
    car.y = terrainY;

    // Compute current speed along terrain surface
    const cosA = Math.cos(terrainAngle);
    const sinA = Math.sin(terrainAngle);
    let speed = car.vx * cosA + car.vy * sinA;

    // Gravity effect along slope (going uphill slows, downhill accelerates)
    speed += sinA * GRAVITY;

    // Engine force
    if (gasPressed && fuel > 0) {
      speed += ep;
      fuel -= FUEL_RATE;
    }

    // Brake (only slows down, no reverse)
    if (brakePressed) {
      speed *= 0.90;
      if (speed > 0.3) speed -= BRAKE_POWER;
      if (speed < 0) speed = 0;
    }

    // Clamp speed (forward only, no reverse)
    speed = Math.max(0, Math.min(ms, speed));
    speed *= FRICTION;

    // Convert speed back to vx, vy components along surface
    car.vx = speed * cosA;
    car.vy = speed * sinA;

    // Smooth car body angle to match terrain
    let angleDiff = terrainAngle - car.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    car.angle += angleDiff * 0.3;
    car.angularVel = 0;

    // Launch detection: if terrain drops away ahead
    const lookAhead = car.x + speed * 6;
    const futureTerrainY = getTerrainY(lookAhead);
    const expectedY = terrainY + (speed * sinA) * 6;
    if (futureTerrainY - expectedY > 10 && Math.abs(speed) > 3.5) {
      car.onGround = false;
    }

    // Dust particles when driving
    if (Math.abs(speed) > 2 && Math.random() > 0.5) {
      spawnDust(car.x - cosA * 30, terrainY);
    }

    wheelRotation += speed * 0.08;

  } else {
    // ===== AIRBORNE PHYSICS =====
    car.vy += GRAVITY;

    // Rotation control in air
    if (gasPressed) car.angularVel += 0.003;
    if (brakePressed) car.angularVel -= 0.003;
    car.angularVel *= 0.98;
    car.angle += car.angularVel;
    car.vx *= 0.999;
    wheelRotation += car.vx * 0.08;
  }

  // Update position
  car.x += car.vx;
  car.y += car.vy;

  // ===== GROUND COLLISION =====
  const groundY = getTerrainY(car.x);
  if (car.y >= groundY) {
    car.y = groundY;

    if (!car.onGround) {
      // Landing from air
      const groundAngle = getTerrainAngle(car.x);
      const landAngle = car.angle - groundAngle;
      const norm = ((landAngle % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      if (Math.abs(norm) > Math.PI * 0.5) {
        endGame('flip');
        return;
      }
      // Successful landing
      car.angle = groundAngle;
      car.vy = 0;
      spawnDust(car.x, groundY);
      spawnDust(car.x - 20, groundY);
      spawnDust(car.x + 20, groundY);
    }

    car.onGround = true;
    car.angularVel = 0;
  }

  // Fuel check
  if (fuel <= 0) { fuel = 0; endGame('fuel'); return; }

  // Distance
  const d = Math.max(0, Math.floor((car.x - 250) / 8));
  if (d > distance) distance = d;

  // Collectible pickup
  for (const c of collectibles) {
    if (c.collected) continue;
    const dx = car.x - c.x, dy = (car.y - 20) - c.y;
    if (dx * dx + dy * dy < 1600) {
      c.collected = true;
      if (c.type === 'coin') { sessionCoins++; spawnStars(c.x, c.y); }
      else { fuel = Math.min(100, fuel + 25); spawnStars(c.x, c.y); }
    }
  }
}

// ===== CAMERA =====
function updateCamera() {
  let focusX, focusY;
  if (isSpectating && spectatingId && otherPlayers[spectatingId]) {
    const sp = otherPlayers[spectatingId];
    focusX = sp.drawX; focusY = sp.drawY;
  } else {
    focusX = car.x; focusY = car.y;
  }
  const targetX = focusX - (canvas.width / zoomLevel) * 0.35;
  const targetY = focusY - (canvas.height / zoomLevel) * 0.5;
  camera.x += (targetX - camera.x) * 0.08;
  camera.y += (targetY - camera.y) * 0.06;
}

// ===== DRAWING =====
function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0b1026');
  grad.addColorStop(0.3, '#1a1040');
  grad.addColorStop(0.55, '#5c2d6e');
  grad.addColorStop(0.75, '#c0543a');
  grad.addColorStop(0.9, '#e8832a');
  grad.addColorStop(1, '#f4a742');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
  if (gameState === 'playing' || gameState === 'paused') {
    const seed = 42;
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137 + seed) % canvas.width);
      const sy = ((i * 97 + seed * 3) % (canvas.height * 0.45));
      const brightness = 0.3 + (i % 5) * 0.15;
      ctx.fillStyle = `rgba(255,255,255,${brightness})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  }
}

function drawMountainLayer(parallax, color, amplitude, freq, baseOffset) {
  const offsetX = -camera.x * parallax;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let x = 0; x <= canvas.width + 20; x += 8) {
    const wx = x - offsetX;
    let y = canvas.height * baseOffset;
    y += Math.sin(wx * freq) * amplitude;
    y += Math.sin(wx * freq * 2.3 + 1) * amplitude * 0.4;
    y += Math.sin(wx * freq * 0.5 + 2) * amplitude * 0.7;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();
}

function drawBackground() {
  drawSky();
  drawMountainLayer(0.03, 'rgba(20, 10, 40, 0.8)', 80, 0.0015, 0.4);
  drawMountainLayer(0.06, 'rgba(40, 20, 50, 0.7)', 90, 0.002, 0.45);
  drawMountainLayer(0.1, 'rgba(60, 30, 40, 0.6)', 70, 0.003, 0.5);
}

function drawTerrain() {
  const left = Math.floor(camera.x - 50);
  const right = Math.ceil(camera.x + canvas.width + 50);

  // Ground fill
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let wx = left; wx <= right; wx += TERRAIN_STEP) {
    const sx = wx - camera.x;
    const sy = getTerrainY(wx) - camera.y;
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height);
  grad.addColorStop(0, '#5a3d2b');
  grad.addColorStop(0.15, '#4a3222');
  grad.addColorStop(0.5, '#3a2518');
  grad.addColorStop(1, '#1a1008');
  ctx.fillStyle = grad;
  ctx.fill();

  // Surface line
  ctx.beginPath();
  for (let wx = left; wx <= right; wx += TERRAIN_STEP) {
    const sx = wx - camera.x;
    const sy = getTerrainY(wx) - camera.y;
    if (wx === left) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.strokeStyle = '#6b8a3d';
  ctx.lineWidth = 4;
  ctx.stroke();

}

function drawWheel(x, y, r) {
  // Tire
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Treads
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(wheelRotation);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
    ctx.stroke();
  }
  ctx.restore();

  // Rim
  ctx.beginPath();
  ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#aaa';
  ctx.fill();

  // Hub
  ctx.beginPath();
  ctx.arc(x, y, r * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#666';
  ctx.fill();
}

// ===== SUSPENSION PHYSICS =====
function updateSuspension() {
  const SPRING = 0.15;   // spring stiffness
  const DAMPING = 0.7;   // damping factor
  const speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);

  // Target suspension offsets
  let rearTarget = 0;
  let frontTarget = 0;

  if (car.onGround) {
    // Wheelie: gas compresses rear, lifts front
    if (gasPressed && fuel > 0) {
      rearTarget = 5 + Math.min(speed * 0.3, 4);  // rear squats down
      frontTarget = -4 - Math.min(speed * 0.2, 3); // front lifts up
      car.bodyTilt += (0.06 + Math.min(speed * 0.003, 0.04) - car.bodyTilt) * 0.1;
    }
    // Braking: front compresses
    else if (brakePressed && speed > 0.5) {
      frontTarget = 4 + Math.min(speed * 0.3, 5);
      rearTarget = -2;
      car.bodyTilt += (-0.04 - car.bodyTilt) * 0.1;
    } else {
      car.bodyTilt *= 0.9;
    }

    // Terrain bump detection: sudden height changes cause bounce
    const terrainAhead = getTerrainY(car.x + 10);
    const terrainBehind = getTerrainY(car.x - 10);
    const terrainHere = getTerrainY(car.x);
    const bumpFront = (terrainAhead - terrainHere) * speed * 0.04;
    const bumpRear = (terrainBehind - terrainHere) * speed * 0.04;
    frontTarget += Math.max(-6, Math.min(6, bumpFront));
    rearTarget += Math.max(-6, Math.min(6, bumpRear));
  } else {
    // In air, suspension extends fully
    frontTarget = -3;
    rearTarget = -3;
    car.bodyTilt *= 0.95;
  }

  // Spring physics for rear
  const rearForce = (rearTarget - car.rearSusp) * SPRING;
  car.rearSuspVel = (car.rearSuspVel + rearForce) * DAMPING;
  car.rearSusp += car.rearSuspVel;

  // Spring physics for front
  const frontForce = (frontTarget - car.frontSusp) * SPRING;
  car.frontSuspVel = (car.frontSuspVel + frontForce) * DAMPING;
  car.frontSusp += car.frontSuspVel;

  // Clamp suspension travel
  car.rearSusp = Math.max(-6, Math.min(10, car.rearSusp));
  car.frontSusp = Math.max(-6, Math.min(10, car.frontSusp));
}

// ===== DRAW SPRING (zigzag shock absorber) =====
function drawSpring(x1, y1, x2, y2, coils) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;  // perpendicular
  const ny = dx / len;
  const amplitude = 4;

  ctx.beginPath();
  ctx.moveTo(x1, y1);

  for (let i = 1; i <= coils; i++) {
    const t = i / (coils + 1);
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    const side = (i % 2 === 0) ? 1 : -1;
    ctx.lineTo(px + nx * amplitude * side, py + ny * amplitude * side);
  }

  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawCar() {
  const sx = car.x - camera.x;
  const sy = car.y - camera.y;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle + car.bodyTilt);

  const wb = car.wheelBase;
  const wr = car.wheelRadius;
  const isTruck = selectedVehicle === 'truck';

  // Wheel positions with suspension offset
  const rearWheelY = wr * 0.4 + car.rearSusp;
  const frontWheelY = wr * 0.4 + car.frontSusp;
  const bodyY = -6;  // body base Y

  // Draw shock absorber springs (rear)
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 2;
  drawSpring(-wb/2, bodyY, -wb/2, rearWheelY - wr * 0.3, 5);

  // Draw shock absorber springs (front)
  drawSpring(wb/2, bodyY, wb/2, frontWheelY - wr * 0.3, 5);

  // Shock absorber cylinders (rear)
  ctx.fillStyle = '#888';
  ctx.fillRect(-wb/2 - 3, bodyY - 2, 6, 4);
  ctx.fillStyle = '#666';
  ctx.fillRect(-wb/2 - 2, rearWheelY - wr * 0.3 - 3, 4, 6);

  // Shock absorber cylinders (front)
  ctx.fillStyle = '#888';
  ctx.fillRect(wb/2 - 3, bodyY - 2, 6, 4);
  ctx.fillStyle = '#666';
  ctx.fillRect(wb/2 - 2, frontWheelY - wr * 0.3 - 3, 4, 6);

  // Chassis
  const bodyColor = isTruck ? '#1c2833' : '#0e6637';
  const roofColor = isTruck ? '#2c3e50' : '#1a8a4a';

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-wb / 2 - 12, bodyY);
  ctx.lineTo(wb / 2 + 16, bodyY);
  ctx.lineTo(wb / 2 + 12, -22);
  ctx.lineTo(-wb / 2 - 4, -22);
  ctx.closePath();
  ctx.fill();

  // Cabin
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(-2, -22);
  ctx.lineTo(wb / 2 + 2, -22);
  ctx.lineTo(wb / 2 - 6, -40);
  ctx.lineTo(4, -40);
  ctx.closePath();
  ctx.fill();

  // Window
  ctx.fillStyle = 'rgba(130, 200, 255, 0.6)';
  ctx.beginPath();
  ctx.moveTo(2, -23);
  ctx.lineTo(wb / 2 - 2, -23);
  ctx.lineTo(wb / 2 - 8, -37);
  ctx.lineTo(6, -37);
  ctx.closePath();
  ctx.fill();

  // Headlight
  ctx.fillStyle = '#ffeaa7';
  ctx.fillRect(wb / 2 + 10, -18, 5, 6);

  // Exhaust smoke when accelerating
  if (gasPressed && fuel > 0) {
    ctx.fillStyle = `rgba(100,100,100,${0.3 + Math.random() * 0.3})`;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-wb / 2 - 15 - Math.random() * 15, -10 - Math.random() * 10,
        3 + Math.random() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Wheels at suspension positions
  drawWheel(-wb / 2, rearWheelY, wr);
  drawWheel(wb / 2, frontWheelY, wr);

  ctx.restore();
}

function drawCollectibles() {
  for (const c of collectibles) {
    if (c.collected) continue;
    const sx = c.x - camera.x;
    const sy = c.y - camera.y;
    if (sx < -50 || sx > canvas.width + 50) continue;

    const bob = Math.sin(gameTime * 3 + c.x) * 5;
    ctx.save();
    ctx.translate(sx, sy + bob);

    if (c.type === 'coin') {
      // Glow
      ctx.shadowColor = '#ffd93d';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f0c420';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 0);
    } else {
      // Fuel can
      ctx.shadowColor = '#6bff6b';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#27ae60';
      roundRect(ctx, -10, -12, 20, 24, 4, true);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', 0, 1);
    }
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
}

function drawParticles() {
  for (const p of particles) {
    const sx = p.x - camera.x;
    const sy = p.y - camera.y;
    ctx.fillStyle = p.color + p.life + ')';
    ctx.beginPath();
    ctx.arc(sx, sy, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateHUD() {
  document.getElementById('distanceValue').textContent = distance + 'm';
  document.getElementById('coinValue').textContent = sessionCoins;
  document.getElementById('bestValue').textContent = bestDistance + 'm';
  document.getElementById('fuelBar').style.width = fuel + '%';
  const speed = Math.abs(Math.round(car.vx * 8));
  document.getElementById('speedValue').textContent = speed;
  document.getElementById('onlineValue').textContent = onlineCount;
}

// ===== MULTIPLAYER NETWORKING =====
// Set this to your deployed server URL for online play (e.g., 'wss://mountain-car.onrender.com')
// Leave empty to auto-detect (works for local dev and same-origin deployment)
const SERVER_URL = 'wss://mountain-car-game.onrender.com';

let isHost = false;
let isReady = false;

function connectMultiplayer() {
  try {
    let wsUrl;
    if (SERVER_URL) {
      wsUrl = SERVER_URL;
    } else {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      wsUrl = `${protocol}://${location.host}`;
    }
    ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('Connected');
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'init') { myId = msg.id; myColor = msg.color; }
        else if (msg.type === 'players') {
          const np = {};
          for (const p of msg.players) {
            if (p.id !== myId) {
              const old = otherPlayers[p.id];
              if (old) { np[p.id] = { ...p, drawX: old.drawX+(p.x-old.drawX)*0.3, drawY: old.drawY+(p.y-old.drawY)*0.3, drawAngle: old.drawAngle+(p.angle-old.drawAngle)*0.3 }; }
              else { np[p.id] = { ...p, drawX: p.x, drawY: p.y, drawAngle: p.angle }; }
            }
          }
          otherPlayers = np;
        }
        else if (msg.type === 'room_created' || msg.type === 'room_joined') {
          currentRoomCode = msg.code;
          isReady = false;
          document.getElementById('displayRoomCode').textContent = msg.code;
          document.getElementById('readyBtn').classList.remove('is-ready');
          document.getElementById('readyBtn').textContent = '✋ READY';
          hideAllScreens(); document.getElementById('roomScreen').classList.remove('hidden');
        }
        else if (msg.type === 'lobby_state') {
          renderLobbyPlayers(msg);
          isHost = msg.hostId === myId;
          onlineCount = msg.players.length;
          const startBtn = document.getElementById('roomStartBtn');
          startBtn.style.display = isHost ? 'inline-block' : 'none';
          startBtn.disabled = !msg.allReady;
          document.getElementById('startHint').textContent =
            !isHost ? 'Waiting for host to start...' :
            msg.allReady ? '✅ All ready! Start the game!' : 'All players must be ready to start';
        }
        else if (msg.type === 'room_error') {
          const el = document.getElementById('joinError');
          el.textContent = msg.error; el.style.display = 'block';
        }
        else if (msg.type === 'game_start') { startGame(); }
      } catch(e) {}
    };
    ws.onclose = () => setTimeout(connectMultiplayer, 2000);
    ws.onerror = () => ws.close();
  } catch(e) {}
}

function renderLobbyPlayers(state) {
  const list = document.getElementById('playerList');
  list.innerHTML = state.players.map(p => `
    <div class="player-row ${p.ready ? 'is-ready' : ''}">
      <div class="player-color" style="background:${p.color}"></div>
      <div class="player-name">${p.name}${p.id === myId ? ' (You)' : ''}</div>
      ${p.isHost ? '<span class="player-badge host-badge">HOST</span>' : ''}
      <span class="player-status ${p.ready ? 'status-ready' : 'status-waiting'}">${p.ready ? '✅ Ready' : '⏳ Waiting'}</span>
    </div>
  `).join('');
}

function sendUpdate() {
  if (ws && ws.readyState === 1 && gameMode === 'multi') {
    if (gameState === 'playing') {
      ws.send(JSON.stringify({ type:'update', name:playerName, x:Math.round(car.x), y:Math.round(car.y), angle:Math.round(car.angle*1000)/1000, vehicle:selectedVehicle, speed:Math.round(car.vx*10)/10, distance, alive:true }));
    } else if (isSpectating) {
      ws.send(JSON.stringify({ type:'update', name:playerName, x:Math.round(car.x), y:Math.round(car.y), angle:0, vehicle:selectedVehicle, speed:0, distance, alive:false }));
    }
  }
}

// ===== DRAW OTHER PLAYERS =====
function drawOtherPlayers() {
  for (const id in otherPlayers) {
    const p = otherPlayers[id];
    // Ground the other player on terrain instead of using raw Y
    const groundY = getTerrainY(p.drawX);
    const groundAngle = getTerrainAngle(p.drawX);
    const correctedY = Math.min(p.drawY, groundY);
    const sx = (p.drawX - camera.x);
    const sy = (correctedY - camera.y);

    // Skip if off-screen
    if (sx < -300 || sx > canvas.width + 300) continue;

    // Draw name + distance above car
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font = 'bold 13px Outfit';
    ctx.textAlign = 'center';

    // Name background
    const nameText = p.name || 'Player';
    const distText = (p.distance || 0) + 'm';
    const fullText = nameText;
    const tw = ctx.measureText(fullText).width + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, sx - tw/2, sy - 65, tw, 20, 6, true);

    ctx.fillStyle = p.color || '#fff';
    ctx.fillText(fullText, sx, sy - 50);

    ctx.font = '11px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(distText, sx, sy - 38);
    ctx.restore();

    // Draw car body
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.translate(sx, sy);
    ctx.rotate(p.drawAngle || 0);

    const wb = car.wheelBase;
    const wr = car.wheelRadius;
    const color = p.color || '#e74c3c';

    // Chassis
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-wb/2 - 12, -6);
    ctx.lineTo(wb/2 + 16, -6);
    ctx.lineTo(wb/2 + 12, -22);
    ctx.lineTo(-wb/2 - 4, -22);
    ctx.closePath();
    ctx.fill();

    // Cabin
    ctx.fillStyle = shadeColor(color, -30);
    ctx.beginPath();
    ctx.moveTo(-2, -22);
    ctx.lineTo(wb/2 + 2, -22);
    ctx.lineTo(wb/2 - 6, -40);
    ctx.lineTo(4, -40);
    ctx.closePath();
    ctx.fill();

    // Window
    ctx.fillStyle = 'rgba(130, 200, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(2, -23);
    ctx.lineTo(wb/2 - 2, -23);
    ctx.lineTo(wb/2 - 8, -37);
    ctx.lineTo(6, -37);
    ctx.closePath();
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-wb/2, wr*0.4, wr, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(wb/2, wr*0.4, wr, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#888';
    ctx.beginPath(); ctx.arc(-wb/2, wr*0.4, wr*0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(wb/2, wr*0.4, wr*0.4, 0, Math.PI*2); ctx.fill();

    ctx.restore();
  }
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0xff) + percent));
  return `rgb(${r},${g},${b})`;
}

// ===== GAME FLOW =====
const allScreens = ['menuScreen','gameModeScreen','vehicleScreen','lobbyScreen','joinScreen','roomScreen','gameOverScreen'];
function hideAllScreens() { allScreens.forEach(s => document.getElementById(s).classList.add('hidden')); }

function resetGame() {
  for (const k in terrainCache) delete terrainCache[k];
  car.x = 250; car.y = getTerrainY(250);
  car.vx = 0; car.vy = 0; car.angle = getTerrainAngle(250);
  car.angularVel = 0; car.onGround = true; car.flipTimer = 0;
  car.frontSusp = 0; car.rearSusp = 0; car.frontSuspVel = 0; car.rearSuspVel = 0; car.bodyTilt = 0;
  fuel = 100; distance = 0; sessionCoins = 0; wheelRotation = 0; gameTime = 0;
  collectibles = []; particles = []; otherPlayers = {};
}

function startGame() {
  const nameEl = document.getElementById(gameMode === 'multi' ? 'roomNameInput' : 'playerNameInput');
  playerName = (nameEl ? nameEl.value.trim() : '') || 'Player';
  localStorage.setItem('mcName', playerName);
  resetGame();
  gameState = 'playing';
  hideAllScreens();
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('pauseBtn').classList.remove('hidden');
  // Show/hide multiplayer HUD elements
  document.getElementById('onlineDisplay').style.display = gameMode === 'multi' ? 'flex' : 'none';
  document.getElementById('roomCodeHud').style.display = gameMode === 'multi' ? 'block' : 'none';
  if (gameMode === 'multi') document.getElementById('hudRoomCode').textContent = currentRoomCode;
}

function endGame(reason) {
  gameState = 'gameover';
  const isNewBest = distance > bestDistance;
  if (isNewBest) { bestDistance = distance; localStorage.setItem('mcBest', bestDistance); }
  totalCoins += sessionCoins; localStorage.setItem('mcCoins', totalCoins);
  document.getElementById('gameOverTitle').textContent = reason === 'flip' ? 'WRECKED!' : 'OUT OF FUEL!';
  document.getElementById('goDistance').textContent = distance + 'm';
  document.getElementById('goCoins').textContent = sessionCoins;
  document.getElementById('newBestStat').style.display = isNewBest ? 'flex' : 'none';
  document.getElementById('goBest').textContent = bestDistance + 'm';
  // In multiplayer, offer spectate option
  const spectateBtn = document.getElementById('spectateBtn');
  if (gameMode === 'multi' && Object.keys(otherPlayers).length > 0) {
    spectateBtn.style.display = 'block';
  } else {
    spectateBtn.style.display = 'none';
  }
  document.getElementById('gameOverScreen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('pauseBtn').classList.add('hidden');
}

function showMenu() {
  gameState = 'menu'; gameMode = 'single'; currentRoomCode = null;
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'leave_room' }));
  hideAllScreens();
  document.getElementById('menuScreen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('pauseBtn').classList.add('hidden');
  document.getElementById('menuBest').textContent = bestDistance + 'm';
  document.getElementById('menuCoins').textContent = totalCoins;
}

// ===== SPECTATOR MODE =====
function startSpectating() {
  isSpectating = true;
  const ids = Object.keys(otherPlayers).filter(id => otherPlayers[id].alive !== false);
  spectatingId = ids.length > 0 ? ids[0] : Object.keys(otherPlayers)[0];
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('pauseBtn').classList.remove('hidden');
  document.getElementById('spectatorBar').style.display = 'flex';
  updateSpectatorName();
}

function cycleSpectate(dir) {
  const ids = Object.keys(otherPlayers).filter(id => otherPlayers[id].alive !== false);
  if (ids.length === 0) return;
  let idx = ids.indexOf(spectatingId);
  idx = (idx + dir + ids.length) % ids.length;
  spectatingId = ids[idx];
  updateSpectatorName();
}

function updateSpectatorName() {
  const p = otherPlayers[spectatingId];
  const el = document.getElementById('spectatingName');
  if (el && p) el.textContent = p.name || 'Player';
}

function stopSpectating() {
  isSpectating = false; spectatingId = null;
  document.getElementById('spectatorBar').style.display = 'none';
  showMenu();
}

// ===== MAIN LOOP =====
function gameLoop() {
  if (gameState === 'playing') {
    gameTime += 0.016; updateCar(); updateSuspension(); updateCamera(); updateParticles(); ensureCollectibles();
    if (++sendCounter % 3 === 0) sendUpdate();
  } else if (isSpectating) {
    updateCamera(); updateParticles();
    if (++sendCounter % 3 === 0) sendUpdate();
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (gameState === 'playing' || gameState === 'paused' || gameState === 'gameover' || isSpectating) {
    ctx.save();
    ctx.scale(zoomLevel, zoomLevel);
    drawBackground(); drawTerrain(); drawCollectibles();
    if (gameMode === 'multi') drawOtherPlayers();
    if (!isSpectating) drawCar();
    drawParticles();
    ctx.restore();
    if (gameState === 'playing') updateHUD();
    // Draw spectator HUD
    if (isSpectating && spectatingId && otherPlayers[spectatingId]) {
      const sp = otherPlayers[spectatingId];
      document.getElementById('distValue').textContent = (sp.distance || 0) + 'm';
    }
  }
  requestAnimationFrame(gameLoop);
}

// ===== INPUT =====
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'd') gasPressed = true;
  if (e.key === 'ArrowLeft' || e.key === 'a') brakePressed = true;
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowRight' || e.key === 'd') gasPressed = false;
  if (e.key === 'ArrowLeft' || e.key === 'a') brakePressed = false;
});

function addPressEvents(el, onDown, onUp) {
  el.addEventListener('mousedown', e => { e.preventDefault(); onDown(); el.classList.add('pressed'); });
  el.addEventListener('mouseup', () => { onUp(); el.classList.remove('pressed'); });
  el.addEventListener('mouseleave', () => { onUp(); el.classList.remove('pressed'); });
  el.addEventListener('touchstart', e => { e.preventDefault(); onDown(); el.classList.add('pressed'); }, { passive: false });
  el.addEventListener('touchend', e => { e.preventDefault(); onUp(); el.classList.remove('pressed'); });
  el.addEventListener('touchcancel', () => { onUp(); el.classList.remove('pressed'); });
}
addPressEvents(document.getElementById('gasBtn'), () => gasPressed = true, () => gasPressed = false);
addPressEvents(document.getElementById('brakeBtn'), () => brakePressed = true, () => brakePressed = false);

// Name editor
document.getElementById('editNameBtn').addEventListener('click', () => {
  document.getElementById('playerTag').classList.add('hidden');
  document.getElementById('nameEditor').classList.remove('hidden');
  const inp = document.getElementById('menuNameInput');
  inp.value = playerName; inp.focus();
});
document.getElementById('saveNameBtn').addEventListener('click', () => {
  const name = document.getElementById('menuNameInput').value.trim() || 'Player';
  playerName = name; localStorage.setItem('mcName', playerName);
  document.getElementById('menuPlayerName').textContent = playerName;
  document.getElementById('playerNameInput').value = playerName;
  document.getElementById('roomNameInput').value = playerName;
  document.getElementById('nameEditor').classList.add('hidden');
  document.getElementById('playerTag').classList.remove('hidden');
});

// Menu buttons
document.getElementById('careerBtn').addEventListener('click', () => {
  gameMode = 'single'; hideAllScreens();
  document.getElementById('vehicleScreen').classList.remove('hidden');
});
document.getElementById('friendsBtn').addEventListener('click', () => {
  gameMode = 'multi'; hideAllScreens();
  document.getElementById('gameModeScreen').classList.remove('hidden');
});

// Game mode selection
document.getElementById('modeRaceBtn').addEventListener('click', () => {
  multiplayerMode = 'race'; hideAllScreens();
  document.getElementById('lobbyScreen').classList.remove('hidden');
});
document.getElementById('modeJumpBtn').addEventListener('click', () => {
  multiplayerMode = 'jump'; hideAllScreens();
  document.getElementById('lobbyScreen').classList.remove('hidden');
});
document.getElementById('modeDemoBtn').addEventListener('click', () => {
  multiplayerMode = 'demo'; hideAllScreens();
  document.getElementById('lobbyScreen').classList.remove('hidden');
});
document.getElementById('gameModeBackBtn').addEventListener('click', showMenu);

document.getElementById('startGameBtn').addEventListener('click', startGame);
document.getElementById('vehicleBackBtn').addEventListener('click', showMenu);

// Lobby buttons
document.getElementById('createRoomBtn').addEventListener('click', () => {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'create_room', name: playerName }));
});
document.getElementById('joinRoomBtn').addEventListener('click', () => {
  hideAllScreens(); document.getElementById('joinScreen').classList.remove('hidden');
  document.getElementById('joinError').style.display = 'none';
});
document.getElementById('lobbyBackBtn').addEventListener('click', showMenu);

// Join room
document.getElementById('confirmJoinBtn').addEventListener('click', () => {
  const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if (code.length < 5) { document.getElementById('joinError').textContent = 'Enter a 5-character code'; document.getElementById('joinError').style.display = 'block'; return; }
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'join_room', code, name: playerName }));
});
document.getElementById('joinBackBtn').addEventListener('click', () => {
  hideAllScreens(); document.getElementById('lobbyScreen').classList.remove('hidden');
});

// Room screen
document.getElementById('readyBtn').addEventListener('click', () => {
  isReady = !isReady;
  const btn = document.getElementById('readyBtn');
  btn.classList.toggle('is-ready', isReady);
  btn.textContent = isReady ? '✅ READY!' : '✋ READY';
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'toggle_ready' }));
});
document.getElementById('roomStartBtn').addEventListener('click', () => {
  if (isHost && ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'host_start' }));
});
document.getElementById('roomBackBtn').addEventListener('click', () => {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'leave_room' }));
  currentRoomCode = null; isReady = false; showMenu();
});
document.getElementById('copyCodeBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(currentRoomCode || '').then(() => {
    document.getElementById('copyCodeBtn').textContent = '✅ Copied!';
    setTimeout(() => document.getElementById('copyCodeBtn').textContent = '📋 Copy Code', 2000);
  });
});

// Game over
document.getElementById('retryBtn').addEventListener('click', () => { isSpectating = false; startGame(); });
document.getElementById('menuBtn').addEventListener('click', () => { isSpectating = false; showMenu(); });
document.getElementById('spectateBtn').addEventListener('click', startSpectating);

// Pause menu
document.getElementById('pauseBtn').addEventListener('click', () => {
  if (isSpectating) { stopSpectating(); return; }
  if (gameState === 'playing') {
    gameState = 'paused';
    document.getElementById('pauseMenu').classList.remove('hidden');
  }
});
document.getElementById('resumeBtn').addEventListener('click', () => {
  gameState = 'playing';
  document.getElementById('pauseMenu').classList.add('hidden');
});
document.getElementById('pauseExitBtn').addEventListener('click', () => {
  document.getElementById('pauseMenu').classList.add('hidden');
  showMenu();
});


// Spectator navigation
document.getElementById('specPrev').addEventListener('click', () => cycleSpectate(-1));
document.getElementById('specNext').addEventListener('click', () => cycleSpectate(1));
document.getElementById('specExit').addEventListener('click', stopSpectating);

// Pinch to zoom (mobile)
let lastPinchDist = 0;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastPinchDist = Math.sqrt(dx * dx + dy * dy);
  }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (lastPinchDist > 0) {
      const scale = dist / lastPinchDist;
      zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel * scale));
    }
    lastPinchDist = dist;
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { lastPinchDist = 0; }, { passive: true });

// Vehicle selection (works on both screens)
document.querySelectorAll('.vehicle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.vehicle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedVehicle = btn.dataset.vehicle;
  });
});

// ===== INIT =====
document.getElementById('playerNameInput').value = playerName;
document.getElementById('roomNameInput').value = playerName;
showMenu();
connectMultiplayer();
gameLoop();
