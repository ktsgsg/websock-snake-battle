import {
  Cell,
  GridSize,
  Player,
  PlayerResult,
  ServerMessage,
  SnakeState,
  WallCell,
} from '../../shared/protocol.js';
import { bindDirectionKeys } from './input.js';
import { Net } from './net.js';
import { createCanvas } from './render.js';

type Scene = 'title' | 'lobby' | 'game' | 'result';

type State = {
  scene: Scene;
  name: string;
  net: Net;
  playerId: string | null;
  roomCode: string | null;
  isHost: boolean;
  players: Player[];
  grid: GridSize | null;
  snakes: SnakeState[];
  foods: Cell[];
  walls: WallCell[];
  result: { winnerId: string | null; ranking: PlayerResult[] } | null;
  error: string | null;
  unbindKeys: (() => void) | null;
};

const app = document.getElementById('app')!;
const state: State = {
  scene: 'title',
  name: localStorage.getItem('name') ?? '',
  net: new Net(),
  playerId: null,
  roomCode: null,
  isHost: false,
  players: [],
  grid: null,
  snakes: [],
  foods: [],
  walls: [],
  result: null,
  error: null,
  unbindKeys: null,
};

state.net.on(handleServer);

function handleServer(msg: ServerMessage) {
  switch (msg.type) {
    case 'room_joined':
      state.playerId = msg.playerId;
      state.roomCode = msg.code;
      state.isHost = msg.isHost;
      state.players = msg.players;
      state.error = null;
      state.scene = 'lobby';
      render();
      break;
    case 'lobby_update':
      state.players = msg.players;
      if (state.playerId) {
        const me = msg.players.find((p) => p.id === state.playerId);
        state.isHost = me?.isHost ?? false;
      }
      if (state.scene === 'result') {
        state.scene = 'lobby';
        state.result = null;
        render();
      } else if (state.scene === 'lobby') {
        render();
      }
      break;
    case 'game_start':
      state.grid = msg.grid;
      state.snakes = [];
      state.foods = [];
      state.result = null;
      state.scene = 'game';
      render();
      break;
    case 'state':
      state.snakes = msg.snakes;
      state.foods = msg.foods;
      state.walls = msg.walls;
      if (state.scene === 'game') drawGame();
      break;
    case 'game_over':
      state.result = { winnerId: msg.winnerId, ranking: msg.ranking };
      state.scene = 'result';
      render();
      break;
    case 'error':
      state.error = msg.message;
      render();
      break;
  }
}

let drawFn: ((input: {
  grid: GridSize;
  snakes: SnakeState[];
  foods: Cell[];
  walls: WallCell[];
  selfId: string;
}) => void) | null = null;

function leaveRoom() {
  state.net.disconnect();
  state.playerId = null;
  state.roomCode = null;
  state.isHost = false;
  state.players = [];
  state.grid = null;
  state.snakes = [];
  state.foods = [];
  state.walls = [];
  state.result = null;
  state.error = null;
  state.scene = 'title';
  render();
}

function drawGame() {
  if (!drawFn || !state.grid || !state.playerId) return;
  drawFn({
    grid: state.grid,
    snakes: state.snakes,
    foods: state.foods,
    walls: state.walls,
    selfId: state.playerId,
  });
}

function render() {
  if (state.unbindKeys) {
    state.unbindKeys();
    state.unbindKeys = null;
  }
  drawFn = null;
  app.innerHTML = '';
  switch (state.scene) {
    case 'title':
      app.appendChild(renderTitle());
      break;
    case 'lobby':
      app.appendChild(renderLobby());
      break;
    case 'game':
      app.appendChild(renderGame());
      break;
    case 'result':
      app.appendChild(renderResult());
      break;
  }
}

function renderTitle(): HTMLElement {
  const root = el('div', { className: 'screen' });
  root.appendChild(el('h1', { textContent: 'Snake Battle' }));
  root.appendChild(
    el('h2', {
      textContent: 'WASD or arrow keys. Last snake standing wins.',
    }),
  );

  const nameLabel = el('label', { textContent: 'Your name' });
  const nameInput = el('input', {
    type: 'text',
    value: state.name,
    placeholder: 'guest',
    maxLength: 16,
  }) as HTMLInputElement;
  nameInput.addEventListener('input', () => {
    state.name = nameInput.value;
    localStorage.setItem('name', state.name);
  });

  const codeLabel = el('label', { textContent: 'Room code (to join)' });
  const codeInput = el('input', {
    type: 'text',
    placeholder: 'XXXX',
    maxLength: 4,
  }) as HTMLInputElement;
  codeInput.style.textTransform = 'uppercase';

  const row = el('div', { className: 'row' });
  const createBtn = el('button', {
    className: 'primary',
    textContent: 'Create room',
  });
  createBtn.addEventListener('click', async () => {
    await state.net.connect();
    state.net.send({ type: 'create_room', name: state.name || 'guest' });
  });
  const joinBtn = el('button', { textContent: 'Join with code' });
  joinBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
      state.error = 'Enter a 4-character room code.';
      render();
      return;
    }
    await state.net.connect();
    state.net.send({
      type: 'join_room',
      code,
      name: state.name || 'guest',
    });
  });
  row.append(createBtn, joinBtn);

  root.append(nameLabel, nameInput, codeLabel, codeInput, row);

  if (state.error) {
    root.appendChild(el('div', { className: 'error', textContent: state.error }));
  }
  root.appendChild(
    el('div', {
      className: 'hint',
      textContent:
        'Up to 4 players. Share the room code shown after creating a room.',
    }),
  );
  return root;
}

function renderLobby(): HTMLElement {
  const root = el('div', { className: 'screen' });
  root.appendChild(el('h1', { textContent: 'Lobby' }));
  root.appendChild(el('h2', { textContent: 'Share this code with friends:' }));
  root.appendChild(el('div', { className: 'code', textContent: state.roomCode ?? '' }));

  const list = el('ul', { className: 'players' });
  for (const p of state.players) {
    const li = el('li');
    const sw = el('span', { className: 'swatch' });
    sw.style.background = p.color;
    li.appendChild(sw);
    li.appendChild(document.createTextNode(p.name));
    if (p.isHost) li.appendChild(el('span', { className: 'host-tag', textContent: 'HOST' }));
    list.appendChild(li);
  }
  root.appendChild(list);

  const row = el('div', { className: 'row' });
  if (state.isHost) {
    const startBtn = el('button', {
      className: 'primary',
      textContent: 'Start game (Enter)',
    });
    startBtn.addEventListener('click', () => state.net.send({ type: 'start_game' }));
    row.appendChild(startBtn);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') state.net.send({ type: 'start_game' });
    };
    window.addEventListener('keydown', onKey);
    state.unbindKeys = () => window.removeEventListener('keydown', onKey);
  } else {
    row.appendChild(
      el('div', {
        className: 'hint',
        textContent: 'Waiting for the host to start the game…',
      }),
    );
  }
  const backBtn = el('button', { textContent: '← タイトルへ' });
  backBtn.addEventListener('click', leaveRoom);
  row.appendChild(backBtn);
  root.appendChild(row);
  return root;
}

function renderGame(): HTMLElement {
  const root = el('div', { className: 'screen', id: 'gameWrap' });
  const grid = state.grid!;
  const { canvas, draw } = createCanvas(grid);
  drawFn = draw;
  root.appendChild(canvas);

  const hud = el('div', { className: 'hud' });
  for (const p of state.players) {
    const item = el('span', { className: 'item' });
    const sw = el('span', { className: 'swatch' });
    sw.style.background = p.color;
    item.append(sw, document.createTextNode(p.name + (p.id === state.playerId ? ' (you)' : '')));
    hud.appendChild(item);
  }
  root.appendChild(hud);
  const debugRow = el('div', { className: 'row' });
  const dummyBtn = el('button', { textContent: '[DEBUG] Place dummy' });
  dummyBtn.addEventListener('click', () => state.net.send({ type: 'place_dummy' }));
  const leaveBtn = el('button', { textContent: '← タイトルへ' });
  leaveBtn.addEventListener('click', leaveRoom);
  debugRow.append(dummyBtn, leaveBtn);
  root.appendChild(debugRow);

  root.appendChild(
    el('div', {
      className: 'hint',
      textContent: 'WASD / 矢印: 移動　Space: ブロックを切り離して壁を置く',
    }),
  );

  state.unbindKeys = bindDirectionKeys(
    (dir) => state.net.send({ type: 'set_direction', dir }),
    () => state.net.send({ type: 'drop_block' }),
  );

  drawGame();
  return root;
}

function renderResult(): HTMLElement {
  const root = el('div', { className: 'screen' });
  const result = state.result!;
  const winner = result.ranking.find((r) => r.playerId === result.winnerId);
  root.appendChild(
    el('h1', {
      textContent: winner ? `${winner.name} wins!` : 'Draw',
    }),
  );

  const list = el('ul', { className: 'ranking' });
  for (const r of result.ranking) {
    const li = el('li');
    if (r.rank === 1) li.classList.add('rank-1');
    li.appendChild(el('span', { textContent: `#${r.rank}` }));
    li.appendChild(document.createTextNode(' ' + r.name));
    if (r.playerId === state.playerId) {
      li.appendChild(document.createTextNode(' (you)'));
    }
    list.appendChild(li);
  }
  root.appendChild(list);

  const row = el('div', { className: 'row' });
  if (state.isHost) {
    const again = el('button', {
      className: 'primary',
      textContent: 'Play again (Enter)',
    });
    again.addEventListener('click', () => state.net.send({ type: 'restart' }));
    row.appendChild(again);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') state.net.send({ type: 'restart' });
    };
    window.addEventListener('keydown', onKey);
    state.unbindKeys = () => window.removeEventListener('keydown', onKey);
  } else {
    row.appendChild(
      el('div', {
        className: 'hint',
        textContent: 'Waiting for the host to start the next match…',
      }),
    );
  }
  const backBtn = el('button', { textContent: '← タイトルへ' });
  backBtn.addEventListener('click', leaveRoom);
  row.appendChild(backBtn);
  root.appendChild(row);
  return root;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { [k: string]: unknown } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  return node;
}

render();
