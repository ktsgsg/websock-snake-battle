import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessage, ServerMessage } from '../../shared/protocol.js';
import { config } from './config.js';
import { Room } from './room.js';
import { RoomRegistry } from './rooms.js';

const PORT = Number(process.env.PORT ?? 8080);

const http = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('snake-battle server');
});

const wss = new WebSocketServer({ server: http, path: '/ws' });
const registry = new RoomRegistry();

type Session = {
  id: string;
  socket: WebSocket;
  room: Room | null;
  alive: boolean;
};

const sessions = new WeakMap<WebSocket, Session>();

const keepaliveMs = config.wsKeepaliveSec * 1000;
const keepalive = setInterval(() => {
  for (const ws of wss.clients) {
    const session = sessions.get(ws);
    if (!session) continue;
    if (!session.alive) {
      ws.terminate();
      continue;
    }
    session.alive = false;
    ws.ping();
  }
}, keepaliveMs);
keepalive.unref?.();
wss.on('close', () => clearInterval(keepalive));

wss.on('connection', (socket) => {
  const session: Session = { id: randomUUID(), socket, room: null, alive: true };
  sessions.set(socket, session);

  socket.on('pong', () => {
    session.alive = true;
  });

  socket.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      send(socket, { type: 'error', message: 'invalid json' });
      return;
    }
    handle(session, msg);
  });

  socket.on('close', () => {
    if (session.room) {
      session.room.removeMember(session.id);
      session.room = null;
    }
  });

  socket.on('error', () => {
    // swallow; close handler will clean up
  });
});

function handle(session: Session, msg: ClientMessage) {
  switch (msg.type) {
    case 'create_room': {
      if (session.room) {
        send(session.socket, { type: 'error', message: 'already in room' });
        return;
      }
      const name = sanitizeName(msg.name);
      const room = registry.create();
      session.room = room;
      room.addMember(session.id, name, session.socket);
      break;
    }
    case 'join_room': {
      if (session.room) {
        send(session.socket, { type: 'error', message: 'already in room' });
        return;
      }
      const room = registry.get(msg.code);
      if (!room) {
        send(session.socket, { type: 'error', message: 'room not found' });
        return;
      }
      if (!room.canJoin()) {
        send(session.socket, {
          type: 'error',
          message: 'room is full or already started',
        });
        return;
      }
      const name = sanitizeName(msg.name);
      session.room = room;
      room.addMember(session.id, name, session.socket);
      break;
    }
    case 'start_game':
    case 'set_direction':
    case 'restart':
    case 'place_dummy':
    case 'drop_block': {
      if (!session.room) return;
      session.room.handleMessage(session.id, msg);
      break;
    }
    default:
      break;
  }
}

function sanitizeName(raw: string): string {
  const trimmed = (raw ?? '').toString().trim().slice(0, 16);
  return trimmed.length === 0 ? 'guest' : trimmed;
}

function send(socket: WebSocket, msg: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

http.listen(PORT, () => {
  console.log(`[server] ws://localhost:${PORT}/ws`);
});
