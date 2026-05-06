const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// ===== STATIC FILE SERVER =====
const MIME_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json'
};
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

// ===== ROOM SYSTEM =====
const rooms = new Map();
const playerRooms = new Map();
const COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e84393','#00cec9','#fd79a8','#6c5ce7','#fdcb6e'];

function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code; do { code = ''; for (let i=0;i<5;i++) code += c[Math.floor(Math.random()*c.length)]; } while (rooms.has(code));
  return code;
}

function buildLobbyState(code) {
  const room = rooms.get(code);
  if (!room) return null;
  const players = [];
  for (const [pid, p] of room.players) {
    players.push({ id: pid, name: p.name, color: p.color, ready: p.ready, isHost: pid === room.hostId });
  }
  return { type: 'lobby_state', code, players, hostId: room.hostId, allReady: players.length > 1 && players.every(p => p.ready) };
}

function broadcastLobby(code) {
  const room = rooms.get(code);
  if (!room) return;
  const state = buildLobbyState(code);
  const data = JSON.stringify(state);
  for (const [, p] of room.players) { if (p.ws && p.ws.readyState === 1) p.ws.send(data); }
}

function broadcastToRoom(code, msg) {
  const room = rooms.get(code);
  if (!room) return;
  const data = JSON.stringify(msg);
  for (const [, p] of room.players) { if (p.ws && p.ws.readyState === 1) p.ws.send(data); }
}

function leaveRoom(playerId) {
  const code = playerRooms.get(playerId);
  if (!code) return;
  const room = rooms.get(code);
  if (room) {
    room.players.delete(playerId);
    // Transfer host if host left
    if (room.hostId === playerId && room.players.size > 0) {
      room.hostId = room.players.keys().next().value;
    }
    if (room.players.size === 0) {
      setTimeout(() => { const r = rooms.get(code); if (r && r.players.size === 0) rooms.delete(code); }, 30000);
    } else {
      broadcastLobby(code);
    }
  }
  playerRooms.delete(playerId);
}

// ===== WEBSOCKET =====
const wss = new WebSocketServer({ server });
let nextId = 1;

wss.on('connection', (ws) => {
  const id = nextId++;
  const color = COLORS[(id - 1) % COLORS.length];
  let playerName = 'Player';

  ws.send(JSON.stringify({ type: 'init', id, color }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'create_room') {
        playerName = msg.name || 'Player';
        const code = genCode();
        rooms.set(code, { players: new Map(), hostId: id, createdAt: Date.now(), started: false });
        rooms.get(code).players.set(id, { ws, state: null, color, name: playerName, ready: false });
        playerRooms.set(id, code);
        ws.send(JSON.stringify({ type: 'room_created', code }));
        broadcastLobby(code);
      }

      else if (msg.type === 'join_room') {
        playerName = msg.name || 'Player';
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room) { ws.send(JSON.stringify({ type: 'room_error', error: 'Room not found' })); return; }
        if (room.players.size >= 8) { ws.send(JSON.stringify({ type: 'room_error', error: 'Room is full (max 8)' })); return; }
        if (room.started) { ws.send(JSON.stringify({ type: 'room_error', error: 'Game already started' })); return; }
        room.players.set(id, { ws, state: null, color, name: playerName, ready: false });
        playerRooms.set(id, code);
        ws.send(JSON.stringify({ type: 'room_joined', code }));
        broadcastLobby(code);
      }

      else if (msg.type === 'toggle_ready') {
        const code = playerRooms.get(id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room) return;
        const player = room.players.get(id);
        if (player) { player.ready = !player.ready; broadcastLobby(code); }
      }

      else if (msg.type === 'host_start') {
        const code = playerRooms.get(id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || room.hostId !== id) return;
        // Check all ready
        const players = [...room.players.values()];
        if (players.length < 2 || !players.every(p => p.ready)) return;
        room.started = true;
        broadcastToRoom(code, { type: 'game_start' });
      }

      else if (msg.type === 'leave_room') {
        leaveRoom(id);
        ws.send(JSON.stringify({ type: 'room_left' }));
      }

      else if (msg.type === 'update') {
        const code = playerRooms.get(id);
        if (!code) return;
        const room = rooms.get(code);
        if (!room) return;
        const player = room.players.get(id);
        if (player) { player.state = msg; player.name = msg.name || playerName; }
      }

    } catch (e) {}
  });

  ws.on('close', () => leaveRoom(id));
  ws.on('error', () => leaveRoom(id));
});

// Broadcast game states 20/sec
setInterval(() => {
  for (const [code, room] of rooms) {
    if (!room.started || room.players.size < 2) continue;
    const states = [];
    for (const [pid, p] of room.players) {
      if (p.state) states.push({ id: pid, color: p.color, name: p.name, x: p.state.x, y: p.state.y, angle: p.state.angle, vehicle: p.state.vehicle, speed: p.state.speed, distance: p.state.distance });
    }
    if (states.length > 0) {
      const msg = JSON.stringify({ type: 'players', players: states });
      for (const [, p] of room.players) { if (p.ws && p.ws.readyState === 1) p.ws.send(msg); }
    }
  }
}, 50);

// Cleanup
setInterval(() => { const now = Date.now(); for (const [c, r] of rooms) { if (r.players.size === 0 && now - r.createdAt > 60000) rooms.delete(c); } }, 300000);

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`\n  🏔️  Mountain Car Multiplayer Server`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  🌐 Play at: http://localhost:${PORT}`);
  console.log(`  👥 Share this URL on your network!\n`);
});
