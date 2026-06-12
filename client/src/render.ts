import { Cell, GridSize, SnakeState } from '../../shared/protocol.js';

export type RenderInput = {
  grid: GridSize;
  snakes: SnakeState[];
  foods: Cell[];
  selfId: string;
};

export function createCanvas(grid: GridSize): {
  canvas: HTMLCanvasElement;
  draw: (input: RenderInput) => void;
} {
  const cell = 20;
  const canvas = document.createElement('canvas');
  canvas.width = grid.w * cell;
  canvas.height = grid.h * cell;
  const ctx = canvas.getContext('2d')!;

  function draw(input: RenderInput) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= input.grid.w; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= input.grid.h; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(canvas.width, y * cell + 0.5);
      ctx.stroke();
    }

    for (const f of input.foods) {
      ctx.fillStyle = '#ffca28';
      ctx.beginPath();
      const cx = f.x * cell + cell / 2;
      const cy = f.y * cell + cell / 2;
      ctx.arc(cx, cy, cell * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of input.snakes) {
      const isSelf = s.playerId === input.selfId;
      ctx.fillStyle = s.alive ? s.color : 'rgba(0,0,0,0.15)';
      s.segments.forEach((seg, i) => {
        const pad = i === 0 ? 1 : 2;
        ctx.fillRect(
          seg.x * cell + pad,
          seg.y * cell + pad,
          cell - pad * 2,
          cell - pad * 2,
        );
      });
      if (isSelf && s.segments.length > 0) {
        const head = s.segments[0];
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          head.x * cell + 1.5,
          head.y * cell + 1.5,
          cell - 3,
          cell - 3,
        );
      }
      if (s.dummy && s.segments.length > 0) {
        const head = s.segments[0];
        ctx.fillStyle = '#1a202c';
        ctx.font = `bold ${cell * 0.6}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D', head.x * cell + cell / 2, head.y * cell + cell / 2);
      }
    }
  }

  return { canvas, draw };
}
