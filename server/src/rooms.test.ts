import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { RoomRegistry } from './rooms.js';

function openSocketMock() {
  return {
    readyState: WebSocket.OPEN,
    send() {
      // no-op
    },
  } as unknown as WebSocket;
}

test('room code remains joinable after all members disconnect', () => {
  const dir = mkdtempSync(join(tmpdir(), 'room-registry-'));
  const registry = new RoomRegistry(join(dir, 'rooms.sqlite'));

  const firstRoom = registry.create();
  const socket = openSocketMock();
  firstRoom.addMember('p1', 'alice', socket);
  firstRoom.removeMember('p1');

  const reopened = registry.get(firstRoom.code);
  assert.ok(reopened);
  assert.equal(reopened.code, firstRoom.code);
  assert.notEqual(reopened, firstRoom);
});
