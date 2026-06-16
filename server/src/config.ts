import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GRID,
  MAX_PLAYERS,
  TICK_MS,
} from '../../shared/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '../../.env'), quiet: true });

function num(value: string | undefined, fallback: number, min = 1): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

function numFloat(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export const config = {
  tickMs: num(process.env.GAME_TICK_MS, TICK_MS, 20),
  grid: {
    w: num(process.env.GAME_GRID_W, GRID.w, 8),
    h: num(process.env.GAME_GRID_H, GRID.h, 8),
  },
  maxPlayers: num(process.env.GAME_MAX_PLAYERS, MAX_PLAYERS, 1),
  initialLength: num(process.env.GAME_INITIAL_LENGTH, 3, 1),
  timeLimitSec: num(process.env.GAME_TIME_LIMIT_SEC, 0, 0),
  goalLength: num(process.env.GAME_GOAL_LENGTH, 0, 0),
  countdownSec: num(process.env.GAME_COUNTDOWN_SEC, 3, 0),
  bombFuseTicks: num(process.env.GAME_BOMB_FUSE_TICKS, 3, 1),
  bombRange: num(process.env.GAME_BOMB_RANGE, 3, 1),
  bombFoodChance: numFloat(process.env.GAME_BOMB_FOOD_CHANCE, 0.25, 0, 1),
};

console.log('[config]', config);
