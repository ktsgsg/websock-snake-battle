export type Direction = 'up' | 'down' | 'left' | 'right';

export type Cell = { x: number; y: number };

export type Player = {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
};

export type SnakeState = {
  playerId: string;
  name: string;
  color: string;
  segments: Cell[];
  alive: boolean;
  dir: Direction;
};

export type PlayerResult = {
  playerId: string;
  name: string;
  rank: number;
};

export type GridSize = { w: number; h: number };

export type ClientMessage =
  | { type: 'create_room'; name: string }
  | { type: 'join_room'; code: string; name: string }
  | { type: 'start_game' }
  | { type: 'set_direction'; dir: Direction }
  | { type: 'restart' };

export type ServerMessage =
  | {
      type: 'room_joined';
      code: string;
      playerId: string;
      isHost: boolean;
      players: Player[];
    }
  | { type: 'lobby_update'; players: Player[] }
  | { type: 'game_start'; grid: GridSize; tickMs: number }
  | {
      type: 'state';
      tick: number;
      snakes: SnakeState[];
      foods: Cell[];
    }
  | {
      type: 'game_over';
      winnerId: string | null;
      ranking: PlayerResult[];
    }
  | { type: 'error'; message: string };

export const GRID: GridSize = { w: 40, h: 30 };
export const TICK_MS = 120;
export const MAX_PLAYERS = 4;
export const PLAYER_COLORS = ['#ff5252', '#42a5f5', '#66bb6a', '#ffca28'];
