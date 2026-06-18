import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, StatementSync } from 'node:sqlite';
import { config } from './config.js';
import { Room } from './room.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomRegistry {
  private activeRooms = new Map<string, Room>();
  private db: DatabaseSync;
  private insertRoomStmt: StatementSync;
  private roomExistsStmt: StatementSync;

  constructor(dbPath = config.roomDbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        createdAt INTEGER NOT NULL
      )
    `);
    this.insertRoomStmt = this.db.prepare(
      'INSERT INTO rooms (code, createdAt) VALUES (?, ?)',
    );
    this.roomExistsStmt = this.db.prepare('SELECT 1 FROM rooms WHERE code = ?');
  }

  create(): Room {
    let code = this.generateCode();
    while (this.exists(code)) code = this.generateCode();
    this.insertRoomStmt.run(code, Date.now());
    const room = this.openRoom(code);
    return room;
  }

  get(code: string): Room | undefined {
    const normalized = code.toUpperCase();
    const existing = this.activeRooms.get(normalized);
    if (existing) return existing;
    if (!this.exists(normalized)) return undefined;
    return this.openRoom(normalized);
  }

  private generateCode(): string {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return s;
  }

  private exists(code: string): boolean {
    const row = this.roomExistsStmt.get(code);
    return row !== undefined;
  }

  private openRoom(code: string): Room {
    const existing = this.activeRooms.get(code);
    if (existing) return existing;
    const room = new Room(code, () => this.activeRooms.delete(code));
    this.activeRooms.set(code, room);
    return room;
  }
}
