const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

let io;

const LANGUAGE_IDS = { javascript: 93, python: 71, cpp: 54 };
const userMapping = {};
const userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA'];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPistonOutput(pistonResponse) {
  if (!pistonResponse || typeof pistonResponse !== 'object') return '';
  const compileOutput = pistonResponse.compile?.output;
  const runOutput = pistonResponse.run?.output;
  return [compileOutput, runOutput].filter(Boolean).join('\n');
}

async function executeCodeWithPiston({ language, code }) {
  // Piston API mappings
  const languageMap = {
    javascript: { language: 'js', version: '18.15.0' },
    python: { language: 'python', version: '3.10.0' },
    cpp: { language: 'cpp', version: '10.2.0' },
  };

  const lang = languageMap[language];
  if (!lang) {
    const error = new Error('Unsupported language');
    error.statusCode = 400;
    throw error;
  }

  const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
    language: lang.language,
    version: lang.version,
    files: [{ content: code ?? '' }],
  });

  return response.data;
}

function getClientsInRoom(roomId) {
  const clients = [];
  const room = io.sockets.adapter.rooms.get(roomId);
  if (room) {
    for (const clientId of room) {
      if(userMapping[clientId]) clients.push(userMapping[clientId]);
    }
  }
  return clients;
}

app.get("/api/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = io.sockets.adapter.rooms.get(roomId);
  if (room && room.size > 0) res.json({ exists: true });
  else res.json({ exists: false });
});

app.post("/api/execute", async (req, res) => {
  try {
    const { language, code } = req.body || {};
    const pistonData = await executeCodeWithPiston({ language, code });
    res.json(pistonData);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ run: { output: "Error running code: " + error.message } });
  }
});

// Backwards-compatible endpoint used by the current frontend.
// Returns a stable `{ output }` shape.
app.post('/api/run', async (req, res) => {
  try {
    const { language, code } = req.body || {};
    const pistonData = await executeCodeWithPiston({ language, code });
    res.json({ output: buildPistonOutput(pistonData), raw: pistonData });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({ output: "Error running code: " + error.message });
  }
});

async function start() {
  // Use dynamic import so Node loads the ESM entrypoints (the CJS build currently
  // trips on Node's ESM/CJS rules under recent Node versions).
  const { setupWSConnection } = await import('@y/websocket-server/utils');

  // --- Yjs WebSocket endpoint (y-websocket protocol) ---
  // Client connects to: ws(s)://<host>/yjs/<roomId>
  // We strip the `/yjs` prefix before handing off so the doc name is just `<roomId>`.
  const yjsWss = new WebSocket.Server({ noServer: true });

  yjsWss.on('connection', (conn, req) => {
    setupWSConnection(conn, req, { gc: true });
  });

  server.on('upgrade', (request, socket, head) => {
    try {
      const { pathname } = new URL(request.url, `http://${request.headers.host}`);
      if (!pathname.startsWith('/yjs')) return;

      // Normalize URL (y-websocket protocol expects `/<docname>`)
      let normalizedUrl = request.url.replace(/^\/yjs/, '');
      if (!normalizedUrl.startsWith('/')) normalizedUrl = '/' + normalizedUrl;
      request.url = normalizedUrl;

      yjsWss.handleUpgrade(request, socket, head, (ws) => {
        yjsWss.emit('connection', ws, request);
      });
    } catch (_e) {
      // If URL parsing fails, don't crash the server — just reject this upgrade.
      socket.destroy();
    }
  });

  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('join_room', (payload) => {
      // Backwards compatible: payload can be `roomId` string.
      const roomId = typeof payload === 'string' ? payload : payload?.roomId;
      if (!roomId) return;

      socket.join(roomId);

      const providedUser = typeof payload === 'object' ? payload.user : null;
      const username =
        (typeof providedUser?.username === 'string' && providedUser.username.trim())
          ? providedUser.username.trim().slice(0, 32)
          : `User${Math.floor(Math.random() * 1000)}`;
      const color =
        (typeof providedUser?.color === 'string' && providedUser.color.trim())
          ? providedUser.color.trim()
          : pickRandom(userColors);

      userMapping[socket.id] = {
        id: socket.id,
        username,
        color,
      };

      const clients = getClientsInRoom(roomId);
      io.to(roomId).emit('room_update', clients);
    });

    socket.on('update_profile', (payload) => {
      // payload: { roomId, user: { username, color } }
      const roomId = payload?.roomId;
      if (!roomId) return;

      const user = userMapping[socket.id];
      if (!user) return;

      const nextUsername =
        (typeof payload?.user?.username === 'string' && payload.user.username.trim())
          ? payload.user.username.trim().slice(0, 32)
          : user.username;
      const nextColor =
        (typeof payload?.user?.color === 'string' && payload.user.color.trim())
          ? payload.user.color.trim()
          : user.color;

      userMapping[socket.id] = { ...user, username: nextUsername, color: nextColor };

      const clients = getClientsInRoom(roomId);
      io.to(roomId).emit('room_update', clients);
    });

    socket.on('code_change', (data) => {
      socket.to(data.room).emit('receive_code', data.code);
    });

    socket.on('reaction', (data) => {
      // Broadcast reaction to others in the room
      socket.to(data.room).emit('receive_reaction', data.reaction);
    });

    socket.on('chat_message', (data) => {
      // Broadcast chat to others in the room
      const user = userMapping[socket.id] || { username: 'Anonymous', color: '#FFF' };
      socket.to(data.room).emit('receive_chat', { ...data, user });
    });

    // --- WebRTC Signaling Logic ---
    socket.on('webrtc_offer', (data) => {
      socket.to(data.to).emit('webrtc_offer', { sdp: data.sdp, from: socket.id });
    });

    socket.on('webrtc_answer', (data) => {
      socket.to(data.to).emit('webrtc_answer', { sdp: data.sdp, from: socket.id });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      socket
        .to(data.to)
        .emit('webrtc_ice_candidate', { candidate: data.candidate, from: socket.id });
    });
    // --- End of WebRTC Signaling ---

    socket.on('disconnecting', () => {
      const rooms = Array.from(socket.rooms);
      rooms.forEach((roomId) => {
        if (roomId !== socket.id) {
          const clients = getClientsInRoom(roomId).filter(
            (client) => client && client.id !== socket.id
          );
          socket.to(roomId).emit('room_update', clients);
        }
      });
    });

    socket.on('disconnect', () => {
      delete userMapping[socket.id];
      console.log('User Disconnected', socket.id);
    });
  });

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
