import { ClientMessage, ServerMessage } from '../../shared/protocol.js';

export type Handler = (msg: ServerMessage) => void;

export class Net {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private queue: ClientMessage[] = [];

  connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      ws.addEventListener('open', () => {
        for (const m of this.queue) ws.send(JSON.stringify(m));
        this.queue = [];
        resolve();
      });
      ws.addEventListener('error', () => reject(new Error('ws error')));
      ws.addEventListener('close', () => {
        this.ws = null;
      });
      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data) as ServerMessage;
          for (const h of this.handlers) h(msg);
        } catch {
          // ignore malformed
        }
      });
    });
  }

  send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
    }
  }

  on(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
}
