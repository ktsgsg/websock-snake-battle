import { Direction } from '../../shared/protocol.js';

const MAP: Record<string, Direction> = {
  w: 'up',
  W: 'up',
  ArrowUp: 'up',
  a: 'left',
  A: 'left',
  ArrowLeft: 'left',
  s: 'down',
  S: 'down',
  ArrowDown: 'down',
  d: 'right',
  D: 'right',
  ArrowRight: 'right',
};

export function bindDirectionKeys(
  onDir: (dir: Direction) => void,
  onDrop: () => void,
): () => void {
  let lastSent: Direction | null = null;
  let lastTime = 0;

  const handler = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      onDrop();
      return;
    }
    const dir = MAP[e.key];
    if (!dir) return;
    e.preventDefault();
    const now = performance.now();
    if (dir === lastSent && now - lastTime < 80) return;
    lastSent = dir;
    lastTime = now;
    onDir(dir);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
