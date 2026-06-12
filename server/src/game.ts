import {
  Cell,
  Direction,
  GRID,
  PLAYER_COLORS,
  SnakeState,
} from '../../shared/protocol.js';

export type GameState = {
  tick: number;
  snakes: SnakeState[];
  foods: Cell[];
  finished: boolean;
  winnerId: string | null;
  playerCount: number;
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const DELTA: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function createInitialState(
  players: { id: string; name: string }[],
): GameState {
  const spawns: { pos: Cell; dir: Direction }[] = [
    { pos: { x: 5, y: 5 }, dir: 'right' },
    { pos: { x: GRID.w - 6, y: 5 }, dir: 'left' },
    { pos: { x: 5, y: GRID.h - 6 }, dir: 'right' },
    { pos: { x: GRID.w - 6, y: GRID.h - 6 }, dir: 'left' },
  ];
  const snakes: SnakeState[] = players.map((p, i) => {
    const { pos, dir } = spawns[i];
    const dx = dir === 'right' ? -1 : 1;
    const segments: Cell[] = [
      { x: pos.x, y: pos.y },
      { x: pos.x + dx, y: pos.y },
      { x: pos.x + dx * 2, y: pos.y },
    ];
    return {
      playerId: p.id,
      name: p.name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      segments,
      alive: true,
      dir,
    };
  });
  const foods = [randomEmptyCell(snakes, [])];
  return { tick: 0, snakes, foods, finished: false, winnerId: null, playerCount: players.length };
}

export function setDirection(
  state: GameState,
  playerId: string,
  dir: Direction,
) {
  const snake = state.snakes.find((s) => s.playerId === playerId);
  if (!snake || !snake.alive) return;
  if (OPPOSITE[snake.dir] === dir) return;
  snake.dir = dir;
}

export function killPlayer(state: GameState, playerId: string) {
  const snake = state.snakes.find((s) => s.playerId === playerId);
  if (snake) snake.alive = false;
}

export function addDummy(state: GameState) {
  const center = randomEmptyCell(state.snakes, state.foods);
  const id = `dummy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const segments: Cell[] = [
    { x: center.x, y: center.y },
    { x: Math.max(0, center.x - 1), y: center.y },
    { x: Math.max(0, center.x - 2), y: center.y },
  ];
  state.snakes.push({
    playerId: id,
    name: 'DUMMY',
    color: '#888888',
    segments,
    alive: true,
    dir: 'right',
    dummy: true,
  });
}

export function step(state: GameState): GameState {
  if (state.finished) return state;
  state.tick += 1;

  const proposedHeads = new Map<string, Cell>();
  for (const s of state.snakes) {
    if (!s.alive || s.dummy) continue;
    const head = s.segments[0];
    const d = DELTA[s.dir];
    proposedHeads.set(s.playerId, { x: head.x + d.x, y: head.y + d.y });
  }

  const headCounts = new Map<string, number>();
  for (const head of proposedHeads.values()) {
    const key = `${head.x},${head.y}`;
    headCounts.set(key, (headCounts.get(key) ?? 0) + 1);
  }

  const ateFoodBy = new Map<string, number>();

  for (const s of state.snakes) {
    if (!s.alive) continue;
    const newHead = proposedHeads.get(s.playerId)!;

    if (
      newHead.x < 0 ||
      newHead.x >= GRID.w ||
      newHead.y < 0 ||
      newHead.y >= GRID.h
    ) {
      s.alive = false;
      continue;
    }

    const headKey = `${newHead.x},${newHead.y}`;
    if ((headCounts.get(headKey) ?? 0) > 1) {
      s.alive = false;
      continue;
    }

    const foodIdx = state.foods.findIndex(
      (f) => f.x === newHead.x && f.y === newHead.y,
    );
    const willGrow = foodIdx !== -1;
    if (willGrow) ateFoodBy.set(s.playerId, foodIdx);

    let collided = false;
    for (const other of state.snakes) {
      const segs = other.segments;
      const limit =
        other.playerId === s.playerId
          ? segs.length - (willGrow ? 0 : 1)
          : segs.length - (other.alive && !willGrow ? 1 : 0);
      for (let i = 0; i < limit; i++) {
        if (segs[i].x === newHead.x && segs[i].y === newHead.y) {
          collided = true;
          break;
        }
      }
      if (collided) break;
    }
    if (collided) {
      s.alive = false;
      continue;
    }
  }

  for (const s of state.snakes) {
    if (!s.alive || s.dummy) continue;
    const newHead = proposedHeads.get(s.playerId)!;
    const grew = ateFoodBy.has(s.playerId);
    s.segments.unshift(newHead);
    if (!grew) s.segments.pop();
  }

  const eatenIdxs = new Set(ateFoodBy.values());
  if (eatenIdxs.size > 0) {
    state.foods = state.foods.filter((_, i) => !eatenIdxs.has(i));
    for (let i = 0; i < eatenIdxs.size; i++) {
      const newFood = randomEmptyCell(state.snakes, state.foods);
      if (newFood) state.foods.push(newFood);
    }
  }

  const alive = state.snakes.filter((s) => s.alive && !s.dummy);
  const threshold = state.playerCount > 1 ? 1 : 0;
  if (alive.length <= threshold) {
    state.finished = true;
    state.winnerId = alive.length === 1 ? alive[0].playerId : null;
  }

  return state;
}

function randomEmptyCell(snakes: SnakeState[], foods: Cell[]): Cell {
  const occupied = new Set<string>();
  for (const s of snakes) {
    for (const seg of s.segments) occupied.add(`${seg.x},${seg.y}`);
  }
  for (const f of foods) occupied.add(`${f.x},${f.y}`);

  const free: Cell[] = [];
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: 0, y: 0 };
  return free[Math.floor(Math.random() * free.length)];
}
