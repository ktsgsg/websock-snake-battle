import { config } from './config.js';
import { Room } from './room.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomRegistry {
  private rooms = new Map<string, Room>();
  private disposalTimers = new Map<string, NodeJS.Timeout>();

  create(): Room {
    let code = this.generateCode();
    while (this.rooms.has(code)) code = this.generateCode();
    const room = new Room(code, () => this.scheduleDisposal(code));
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    const upper = code.toUpperCase();
    const room = this.rooms.get(upper);
    if (room) this.cancelDisposal(upper);
    return room;
  }

  private scheduleDisposal(code: string) {
    this.cancelDisposal(code);
    const graceMs = config.roomEmptyGraceSec * 1000;
    if (graceMs <= 0) {
      this.rooms.delete(code);
      return;
    }
    const timer = setTimeout(() => {
      this.disposalTimers.delete(code);
      const room = this.rooms.get(code);
      if (room && room.isEmpty()) {
        this.rooms.delete(code);
      }
    }, graceMs);
    timer.unref?.();
    this.disposalTimers.set(code, timer);
  }

  private cancelDisposal(code: string) {
    const t = this.disposalTimers.get(code);
    if (t) {
      clearTimeout(t);
      this.disposalTimers.delete(code);
    }
  }

  private generateCode(): string {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return s;
  }
}
