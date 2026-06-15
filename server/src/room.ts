import { WebSocket } from 'ws';
import {
  ClientMessage,
  PLAYER_COLORS,
  Player,
  PlayerResult,
  ServerMessage,
} from '../../shared/protocol.js';
import { config } from './config.js';
import {
  GameState,
  addDummy,
  createInitialState,
  dropBlock,
  finishByTimeLimit,
  killPlayer,
  setDirection,
  step,
} from './game.js';

type Member = {
  id: string;
  name: string;
  socket: WebSocket;
  isHost: boolean;
};

export class Room {
  readonly code: string;
  private members = new Map<string, Member>();
  private game: GameState | null = null;
  private loop: NodeJS.Timeout | null = null;
  private startedAt = 0;
  private eliminationOrder: string[] = [];
  private onEmpty: () => void;

  constructor(code: string, onEmpty: () => void) {
    this.code = code;
    this.onEmpty = onEmpty;
  }

  canJoin(): boolean {
    return this.members.size < config.maxPlayers && this.game === null;
  }

  isEmpty(): boolean {
    return this.members.size === 0;
  }

  addMember(id: string, name: string, socket: WebSocket): Member {
    const isHost = this.members.size === 0;
    const member: Member = { id, name, socket, isHost };
    this.members.set(id, member);
    this.send(socket, {
      type: 'room_joined',
      code: this.code,
      playerId: id,
      isHost,
      players: this.players(),
    });
    this.broadcastLobby();
    return member;
  }

  handleMessage(memberId: string, msg: ClientMessage) {
    const member = this.members.get(memberId);
    if (!member) return;

    switch (msg.type) {
      case 'start_game': {
        if (!member.isHost) return;
        if (this.game) return;
        if (this.members.size < 1) return;
        this.startGame();
        break;
      }
      case 'set_direction': {
        if (!this.game) return;
        setDirection(this.game, memberId, msg.dir);
        break;
      }
      case 'restart': {
        if (!member.isHost) return;
        this.stopLoop();
        this.game = null;
        this.eliminationOrder = [];
        this.broadcastLobby();
        break;
      }
      case 'place_dummy': {
        if (!this.game || this.game.finished) return;
        addDummy(this.game);
        break;
      }
      case 'drop_block': {
        if (!this.game || this.game.finished) return;
        dropBlock(this.game, memberId);
        break;
      }
      default:
        break;
    }
  }

  removeMember(memberId: string) {
    const member = this.members.get(memberId);
    if (!member) return;
    this.members.delete(memberId);

    if (this.game) {
      killPlayer(this.game, memberId);
    }

    if (this.members.size === 0) {
      this.stopLoop();
      this.onEmpty();
      return;
    }

    if (member.isHost) {
      const next = this.members.values().next().value;
      if (next) next.isHost = true;
    }

    this.broadcastLobby();
  }

  private players(): Player[] {
    return Array.from(this.members.values()).map((m, i) => ({
      id: m.id,
      name: m.name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      isHost: m.isHost,
    }));
  }

  private startGame() {
    const players = Array.from(this.members.values()).map((m) => ({
      id: m.id,
      name: m.name,
    }));
    this.game = createInitialState(players);
    this.eliminationOrder = [];
    this.startedAt = Date.now();
    this.broadcast({
      type: 'game_start',
      grid: config.grid,
      tickMs: config.tickMs,
      timeLimitMs: config.timeLimitSec > 0 ? config.timeLimitSec * 1000 : undefined,
      goalLength: config.goalLength > 0 ? config.goalLength : undefined,
    });
    this.broadcast({
      type: 'state',
      tick: this.game.tick,
      snakes: this.game.snakes,
      foods: this.game.foods,
      walls: this.game.walls,
      bombs: this.game.bombs,
      flashes: this.game.flashes,
      timeRemainingMs: this.remainingMs(),
    });

    this.loop = setInterval(() => this.tick(), config.tickMs);
  }

  private remainingMs(): number | undefined {
    if (config.timeLimitSec <= 0) return undefined;
    return Math.max(0, config.timeLimitSec * 1000 - (Date.now() - this.startedAt));
  }

  private tick() {
    if (!this.game) return;
    const aliveBefore = new Set(
      this.game.snakes.filter((s) => s.alive).map((s) => s.playerId),
    );
    step(this.game);

    if (
      !this.game.finished &&
      config.timeLimitSec > 0 &&
      Date.now() - this.startedAt >= config.timeLimitSec * 1000
    ) {
      finishByTimeLimit(this.game);
    }

    for (const s of this.game.snakes) {
      if (aliveBefore.has(s.playerId) && !s.alive) {
        this.eliminationOrder.push(s.playerId);
      }
    }

    this.broadcast({
      type: 'state',
      tick: this.game.tick,
      snakes: this.game.snakes,
      foods: this.game.foods,
      walls: this.game.walls,
      bombs: this.game.bombs,
      flashes: this.game.flashes,
      timeRemainingMs: this.remainingMs(),
    });

    if (this.game.finished) {
      const ranking = this.buildRanking();
      this.broadcast({
        type: 'game_over',
        winnerId: this.game.winnerId,
        ranking,
      });
      this.stopLoop();
    }
  }

  private buildRanking(): PlayerResult[] {
    if (!this.game) return [];
    const survivors = this.game.snakes
      .filter((s) => s.alive && !s.dummy)
      .sort((a, b) => b.segments.length - a.segments.length)
      .map((s) => s.playerId);
    const order = [...this.eliminationOrder].filter(
      (pid) => !this.game!.snakes.find((s) => s.playerId === pid)?.dummy,
    ).reverse();
    const ranked = [...survivors, ...order];
    return ranked.map((pid, idx) => {
      const m = this.members.get(pid);
      return {
        playerId: pid,
        name: m?.name ?? '???',
        rank: idx + 1,
      };
    });
  }

  private stopLoop() {
    if (this.loop) {
      clearInterval(this.loop);
      this.loop = null;
    }
  }

  private broadcastLobby() {
    this.broadcast({ type: 'lobby_update', players: this.players() });
  }

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const m of this.members.values()) {
      if (m.socket.readyState === WebSocket.OPEN) m.socket.send(data);
    }
  }

  private send(socket: WebSocket, msg: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }
}
