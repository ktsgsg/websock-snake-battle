import { Cell, GridSize, SnakeState, WallCell } from '../../shared/protocol.js';

export type RenderInput = {
  grid: GridSize;
  snakes: SnakeState[];
  foods: Cell[];
  walls: WallCell[];
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

    for (const w of input.walls) {
      ctx.fillStyle = w.color + 'aa';
      ctx.fillRect(w.x * cell + 1, w.y * cell + 1, cell - 2, cell - 2);
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x * cell + 2, w.y * cell + 2, cell - 4, cell - 4);
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
      const bodyColor = s.alive ? s.color : 'rgba(0,0,0,0.15)';
      const headColor = s.alive ? darken(s.color, 0.3) : bodyColor;
      s.segments.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? headColor : bodyColor;
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

    for (const s of input.snakes) {
      if (!s.alive || s.dummy || s.segments.length === 0) continue;
      const head = s.segments[0];
      const isSelf = s.playerId === input.selfId;
      const cx = head.x * cell + cell / 2;
      const above = head.y > 1;
      const baseY = above ? head.y * cell - 4 : head.y * cell + cell + 4;

      if (s.name) {
        ctx.font = `600 ${cell * 0.5}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = above ? 'bottom' : 'top';
        const w = ctx.measureText(s.name).width;
        const padX = 4;
        const padY = 2;
        const boxH = cell * 0.6;
        const boxY = above ? baseY - boxH : baseY;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(cx - w / 2 - padX, boxY - padY, w + padX * 2, boxH + padY * 2);
        ctx.fillStyle = darken(s.color, 0.2);
        ctx.fillText(s.name, cx, baseY);
      }

      if (isSelf) {
        const t = performance.now() / 250;
        const bob = Math.sin(t) * 2;
        const arrowH = cell * 0.7;
        const arrowW = cell * 0.5;
        const labelGap = s.name ? cell * 0.75 : 4;
        const tipY = above
          ? head.y * cell - labelGap + bob
          : head.y * cell + cell + labelGap - bob;
        ctx.fillStyle = darken(s.color, 0.15);
        ctx.beginPath();
        if (above) {
          ctx.moveTo(cx, tipY);
          ctx.lineTo(cx - arrowW / 2, tipY - arrowH);
          ctx.lineTo(cx + arrowW / 2, tipY - arrowH);
        } else {
          ctx.moveTo(cx, tipY);
          ctx.lineTo(cx - arrowW / 2, tipY + arrowH);
          ctx.lineTo(cx + arrowW / 2, tipY + arrowH);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  return { canvas, draw };
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
