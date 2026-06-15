import {
  BombBlock,
  Cell,
  Direction,
  Food,
  PLAYER_COLORS,
  Segment,
  SnakeState,
  WallCell,
} from '../../shared/protocol.js';
import { config } from './config.js';

export type GameState = {
  tick: number;
  snakes: SnakeState[];
  foods: Food[];
  walls: WallCell[];
  bombs: BombBlock[];
  flashes: Cell[];
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
  const margin = Math.min(5, Math.floor(config.grid.w / 4));
  const spawns: { pos: Cell; dir: Direction }[] = [
    { pos: { x: margin, y: margin }, dir: 'right' },
    { pos: { x: config.grid.w - 1 - margin, y: margin }, dir: 'left' },
    { pos: { x: margin, y: config.grid.h - 1 - margin }, dir: 'right' },
    { pos: { x: config.grid.w - 1 - margin, y: config.grid.h - 1 - margin }, dir: 'left' },
  ];
  const snakes: SnakeState[] = players.map((p, i) => {
    const { pos, dir } = spawns[i];
    const dx = dir === 'right' ? -1 : 1;
    const segments: Segment[] = [];
    for (let j = 0; j < config.initialLength; j++) {
      segments.push({ x: pos.x + dx * j, y: pos.y });
    }
    return {
      playerId: p.id,
      name: p.name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      segments,
      alive: true,
      dir,
    };
  });
  const walls: WallCell[] = [];
  const bombs: BombBlock[] = [];
  const foods: Food[] = [spawnFood(snakes, walls, bombs, [])];
  return {
    tick: 0,
    snakes,
    foods,
    walls,
    bombs,
    flashes: [],
    finished: false,
    winnerId: null,
    playerCount: players.length,
  };
}

function computePopIdx(segments: Segment[]): number {
  let idx = segments.length - 1;
  while (idx > 0 && segments[idx].bomb) idx--;
  return idx;
}

function spawnFood(
  snakes: SnakeState[],
  walls: WallCell[],
  bombs: BombBlock[],
  foods: Food[],
): Food {
  const cell = randomEmptyCell(snakes, walls, bombs, foods);
  const kind = Math.random() < config.bombFoodChance ? 'bomb' : undefined;
  return kind ? { ...cell, kind } : cell;
}

export function setDirection(
  state: GameState,
  playerId: string,
  dir: Direction,
) {
  const snake = state.snakes.find((s) => s.playerId === playerId);
  if (!snake || !snake.alive) return;
  if (OPPOSITE[snake.dir] === dir) return;
  snake.pendingDir = dir;
}

export function killPlayer(state: GameState, playerId: string) {
  const snake = state.snakes.find((s) => s.playerId === playerId);
  if (snake) snake.alive = false;
}

export function dropBlock(state: GameState, playerId: string) {
  const snake = state.snakes.find((s) => s.playerId === playerId);
  if (!snake || !snake.alive || snake.dummy) return;
  if (snake.segments.length < 2) return;
  const tail = snake.segments.pop()!;
  if (tail.bomb) {
    state.bombs.push({
      x: tail.x,
      y: tail.y,
      color: snake.color,
      fuseTicks: config.bombFuseTicks,
    });
  } else {
    state.walls.push({ x: tail.x, y: tail.y, color: snake.color });
  }
}

export function addDummy(state: GameState) {
  const center = randomEmptyCell(state.snakes, state.walls, state.bombs, state.foods);
  const id = `dummy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const segments: Segment[] = [
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
  state.flashes = [];

  for (const s of state.snakes) {
    if (s.pendingDir && OPPOSITE[s.dir] !== s.pendingDir) {
      s.dir = s.pendingDir;
    }
    s.pendingDir = undefined;
  }

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
    if (!s.alive || s.dummy) continue;
    const newHead = proposedHeads.get(s.playerId)!;

    if (
      newHead.x < 0 ||
      newHead.x >= config.grid.w ||
      newHead.y < 0 ||
      newHead.y >= config.grid.h
    ) {
      s.alive = false;
      continue;
    }

    if (state.walls.some((w) => w.x === newHead.x && w.y === newHead.y)) {
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
      const otherGrows =
        other.playerId === s.playerId ? willGrow : !other.alive;
      const exemptIdx = otherGrows ? -1 : computePopIdx(segs);
      for (let i = 0; i < segs.length; i++) {
        if (i === exemptIdx) continue;
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
    if (!grew) {
      const popIdx = computePopIdx(s.segments);
      s.segments.splice(popIdx, 1);
    }
  }

  for (const [playerId, foodIdx] of ateFoodBy) {
    if (state.foods[foodIdx]?.kind !== 'bomb') continue;
    const snake = state.snakes.find((s) => s.playerId === playerId);
    if (!snake) continue;
    for (let i = snake.segments.length - 1; i >= 0; i--) {
      if (!snake.segments[i].bomb) {
        snake.segments[i].bomb = true;
        break;
      }
    }
  }

  const eatenIdxs = new Set(ateFoodBy.values());
  if (eatenIdxs.size > 0) {
    state.foods = state.foods.filter((_, i) => !eatenIdxs.has(i));
    for (let i = 0; i < eatenIdxs.size; i++) {
      state.foods.push(spawnFood(state.snakes, state.walls, state.bombs, state.foods));
    }
  }

  detonateBombs(state);

  const alive = state.snakes.filter((s) => s.alive && !s.dummy);

  if (config.goalLength > 0) {
    const reached = alive
      .filter((s) => s.segments.length >= config.goalLength)
      .sort((a, b) => b.segments.length - a.segments.length);
    if (reached.length > 0) {
      state.finished = true;
      state.winnerId =
        reached.length === 1 ||
        reached[0].segments.length > reached[1].segments.length
          ? reached[0].playerId
          : null;
      return state;
    }
  }

  const threshold = state.playerCount > 1 ? 1 : 0;
  if (alive.length <= threshold) {
    state.finished = true;
    state.winnerId = alive.length === 1 ? alive[0].playerId : null;
  }

  return state;
}

export function finishByTimeLimit(state: GameState) {
  if (state.finished) return;
  state.finished = true;
  const alive = state.snakes
    .filter((s) => s.alive && !s.dummy)
    .sort((a, b) => b.segments.length - a.segments.length);
  if (alive.length === 0) {
    state.winnerId = null;
  } else if (
    alive.length === 1 ||
    alive[0].segments.length > alive[1].segments.length
  ) {
    state.winnerId = alive[0].playerId;
  } else {
    state.winnerId = null;
  }
}

function randomEmptyCell(
  snakes: SnakeState[],
  walls: WallCell[],
  bombs: BombBlock[],
  foods: Food[],
): Cell {
  const occupied = new Set<string>();
  for (const s of snakes) {
    for (const seg of s.segments) occupied.add(`${seg.x},${seg.y}`);
  }
  for (const w of walls) occupied.add(`${w.x},${w.y}`);
  for (const b of bombs) occupied.add(`${b.x},${b.y}`);
  for (const f of foods) occupied.add(`${f.x},${f.y}`);

  const free: Cell[] = [];
  for (let y = 0; y < config.grid.h; y++) {
    for (let x = 0; x < config.grid.w; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: 0, y: 0 };
  return free[Math.floor(Math.random() * free.length)];
}

const DIRS_4: Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function detonateBombs(state: GameState) {
  const queue: BombBlock[] = [];
  state.bombs = state.bombs.filter((b) => {
    b.fuseTicks -= 1;
    if (b.fuseTicks <= 0) {
      queue.push(b);
      return false;
    }
    return true;
  });

  const flashSet = new Set<string>();
  const addFlash = (x: number, y: number) => {
    const k = `${x},${y}`;
    if (!flashSet.has(k)) {
      flashSet.add(k);
      state.flashes.push({ x, y });
    }
  };

  while (queue.length > 0) {
    const b = queue.shift()!;
    const affected: Cell[] = [{ x: b.x, y: b.y }];
    addFlash(b.x, b.y);

    for (const d of DIRS_4) {
      for (let r = 1; r <= config.bombRange; r++) {
        const x = b.x + d.x * r;
        const y = b.y + d.y * r;
        if (x < 0 || x >= config.grid.w || y < 0 || y >= config.grid.h) break;

        const wallIdx = state.walls.findIndex((w) => w.x === x && w.y === y);
        if (wallIdx !== -1) {
          state.walls.splice(wallIdx, 1);
          addFlash(x, y);
          break;
        }

        const bombIdx = state.bombs.findIndex((bb) => bb.x === x && bb.y === y);
        if (bombIdx !== -1) {
          const chained = state.bombs.splice(bombIdx, 1)[0];
          chained.fuseTicks = 0;
          queue.push(chained);
          addFlash(x, y);
          break;
        }

        addFlash(x, y);
        affected.push({ x, y });
      }
    }

    for (const cell of affected) {
      for (const s of state.snakes) {
        if (!s.alive) continue;
        if (s.segments.length === 0) continue;
        const head = s.segments[0];
        if (head.x === cell.x && head.y === cell.y) {
          s.alive = false;
          continue;
        }
        const hitIdx = s.segments.findIndex(
          (seg, i) => i >= 1 && seg.x === cell.x && seg.y === cell.y,
        );
        if (hitIdx !== -1) {
          const cutOff = s.segments.splice(hitIdx);
          for (const seg of cutOff) {
            if (seg.bomb) {
              queue.push({
                x: seg.x,
                y: seg.y,
                color: s.color,
                fuseTicks: 0,
              });
            }
          }
        }
      }
    }
  }
}
