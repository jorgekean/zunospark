/* ------------------------------------------------------------------ */
/*  ZunoSpriteRenderer — procedural HTML5 Canvas art                   */
/*  Zuno the Spark-Fox + scenery, drawn every frame with zero images.  */
/*  Callers are responsible for devicePixelRatio scaling (setTransform)*/
/* ------------------------------------------------------------------ */

export type ZunoMood = 'AWAKE_POP' | 'SLEEP_PAUSE' | 'HAPPY_LEAP' | 'STATIC_POOF';

export const ZUNO_PALETTE = {
  night: '#0f0a2c',
  twilight: '#1e1b4b',
  violet: '#9810fa',
  cyan: '#00f2fe',
  gold: '#fbbf24',
  coral: '#fb7185',
  lavender: '#e9d5ff',
  tail: '#7e22ce',
  emerald: '#34d399',
  ink: '#2e1065',
} as const;

const TAU = Math.PI * 2;

interface Point {
  x: number;
  y: number;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function pseudoRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const iu = 1 - u;
  const a = iu * iu * iu;
  const b = 3 * iu * iu * u;
  const c = 3 * iu * u * u;
  const d = u * u * u;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function auraColorFor(mood: ZunoMood): string {
  if (mood === 'SLEEP_PAUSE') return ZUNO_PALETTE.gold;
  if (mood === 'STATIC_POOF') return ZUNO_PALETTE.coral;
  return ZUNO_PALETTE.cyan;
}

/* ============================== AURA =============================== */

function drawElectricArcs(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string): void {
  const flickerSeed = Math.floor(t / 80);
  ctx.save();
  ctx.strokeStyle = hexToRgba(color, 0.75);
  ctx.lineWidth = Math.max(1.5, r * 0.025);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 0.15;
  for (let i = 0; i < 3; i += 1) {
    if (pseudoRandom(flickerSeed + i * 13) < 0.35) continue;
    const base = t * 0.0012 + i * (TAU / 3);
    const span = 0.55;
    const segments = 6;
    ctx.beginPath();
    for (let s = 0; s <= segments; s += 1) {
      const angle = base + (s / segments) * span;
      const jitter = (pseudoRandom(flickerSeed * 7 + i * 31 + s) - 0.5) * r * 0.16;
      const rad = r * 1.42 + jitter;
      const px = x + Math.cos(angle) * rad;
      const py = y + Math.sin(angle) * rad;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawAura(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, mood: ZunoMood, t: number): void {
  const color = auraColorFor(mood);
  const speed = mood === 'SLEEP_PAUSE' ? 0.0015 : 0.004;
  const pulse = 0.85 + 0.15 * Math.sin(t * speed);
  const gradient = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.95);
  gradient.addColorStop(0, hexToRgba(color, 0.42 * pulse));
  gradient.addColorStop(0.45, hexToRgba(color, 0.16 * pulse));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.95, 0, TAU);
  ctx.fill();
  if (mood === 'AWAKE_POP' || mood === 'HAPPY_LEAP') drawElectricArcs(ctx, x, y, r, t, color);
}

/* ============================== TAIL =============================== */

function drawTail(ctx: CanvasRenderingContext2D, r: number, mood: ZunoMood, t: number, curledFront: boolean): void {
  let p0: Point;
  let p1: Point;
  let p2: Point;
  let p3: Point;

  if (curledFront) {
    const breathe = Math.sin(t * 0.0016) * r * 0.025;
    p0 = { x: r * 0.55, y: r * 0.6 };
    p1 = { x: r * 1.3, y: r * 0.85 };
    p2 = { x: r * 0.75, y: r * 1.22 + breathe };
    p3 = { x: -r * 0.7, y: r * 0.98 + breathe };
  } else {
    const wagSpeed = mood === 'HAPPY_LEAP' ? 0.016 : mood === 'STATIC_POOF' ? 0.03 : 0.006;
    const wagAmount = mood === 'STATIC_POOF' ? 0.08 : 0.18;
    const wag = Math.sin(t * wagSpeed) * r * wagAmount;
    p0 = { x: r * 0.45, y: r * 0.55 };
    p1 = { x: r * 1.35, y: r * 0.7 };
    p2 = { x: r * 1.45 + wag * 0.5, y: -r * 0.2 };
    p3 = { x: r * 1.0 + wag, y: -r * 0.85 };
  }

  const poof = mood === 'STATIC_POOF';
  const tipColor = curledFront ? ZUNO_PALETTE.gold : poof ? ZUNO_PALETTE.coral : ZUNO_PALETTE.cyan;
  const steps = 28;
  const samples: { p: Point; w: number; u: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    const p = cubicBezier(p0, p1, p2, p3, u);
    let w = r * (0.08 + 0.24 * Math.sin(Math.PI * (0.12 + 0.8 * u)));
    if (u > 0.9) w *= 1 - (u - 0.9) * 3;
    if (poof) w *= 1.2 + 0.12 * Math.sin(t * 0.05 + i);
    samples.push({ p, w, u });
  }

  ctx.save();
  // Outline pass for a fluffy silhouette.
  ctx.fillStyle = '#4c1d95';
  for (const s of samples) {
    ctx.beginPath();
    ctx.arc(s.p.x, s.p.y, s.w + r * 0.03, 0, TAU);
    ctx.fill();
  }
  // Fur body.
  for (const s of samples) {
    if (s.u > 0.72) continue;
    const g = ctx.createRadialGradient(s.p.x - s.w * 0.3, s.p.y - s.w * 0.3, s.w * 0.1, s.p.x, s.p.y, s.w);
    g.addColorStop(0, '#a855f7');
    g.addColorStop(1, ZUNO_PALETTE.tail);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.p.x, s.p.y, s.w, 0, TAU);
    ctx.fill();
  }
  // Glowing electric tip.
  const glow = 0.75 + 0.25 * Math.sin(t * 0.006);
  ctx.shadowColor = tipColor;
  ctx.shadowBlur = r * 0.45 * glow;
  for (const s of samples) {
    if (s.u <= 0.72) continue;
    const g = ctx.createRadialGradient(s.p.x, s.p.y, 0, s.p.x, s.p.y, s.w);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, tipColor);
    g.addColorStop(1, hexToRgba(tipColor, 0.85));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.p.x, s.p.y, s.w, 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  // Fur highlight strokes.
  ctx.strokeStyle = 'rgba(216, 180, 254, 0.45)';
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.lineCap = 'round';
  for (let i = 3; i < samples.length - 6; i += 4) {
    const s = samples[i];
    ctx.beginPath();
    ctx.arc(s.p.x, s.p.y, s.w * 0.55, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

/* ============================== BODY =============================== */

function drawBody(ctx: CanvasRenderingContext2D, r: number, sleeping: boolean): void {
  const by = sleeping ? r * 0.5 : r * 0.42;
  const rx = sleeping ? r * 0.78 : r * 0.6;
  const ry = sleeping ? r * 0.42 : r * 0.52;
  const g = ctx.createRadialGradient(-rx * 0.3, by - ry * 0.5, r * 0.05, 0, by, rx * 1.2);
  g.addColorStop(0, '#c26bff');
  g.addColorStop(0.5, ZUNO_PALETTE.violet);
  g.addColorStop(1, '#5b0ea8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, by, rx, ry, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = ZUNO_PALETTE.lavender;
  if (!sleeping) {
    ctx.beginPath();
    ctx.ellipse(0, by + ry * 0.1, rx * 0.5, ry * 0.62, 0, 0, TAU);
    ctx.fill();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * rx * 0.45, by + ry * 0.86, r * 0.15, r * 0.095, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(91, 14, 168, 0.5)';
      ctx.lineWidth = Math.max(1, r * 0.018);
      ctx.beginPath();
      ctx.moveTo(side * rx * 0.45 - r * 0.04, by + ry * 0.86);
      ctx.lineTo(side * rx * 0.45 - r * 0.04, by + ry * 0.86 + r * 0.06);
      ctx.moveTo(side * rx * 0.45 + r * 0.04, by + ry * 0.86);
      ctx.lineTo(side * rx * 0.45 + r * 0.04, by + ry * 0.86 + r * 0.06);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(-rx * 0.6, by + ry * 0.72, r * 0.15, r * 0.085, -0.2, 0, TAU);
    ctx.fill();
  }
}

/* ============================== HEAD =============================== */

function drawEar(ctx: CanvasRenderingContext2D, side: number, hr: number, mood: ZunoMood, t: number): void {
  let angle: number;
  let len = hr * 0.95;
  const width = hr * 0.36;
  if (mood === 'SLEEP_PAUSE') {
    angle = side * 1.2;
    len = hr * 0.78;
  } else if (mood === 'STATIC_POOF') {
    angle = side * 0.1;
    len = hr * 1.15;
  } else if (mood === 'HAPPY_LEAP') {
    angle = side * (0.3 + Math.sin(t * 0.018) * 0.08);
  } else {
    const twitch = Math.max(0, Math.sin(t * 0.0021 + (side > 0 ? 1.7 : 0)) - 0.94) * 3;
    angle = side * (0.32 + twitch);
  }

  ctx.save();
  ctx.translate(side * hr * 0.55, -hr * 0.5);
  ctx.rotate(angle);

  ctx.fillStyle = '#8b0fe0';
  ctx.beginPath();
  ctx.moveTo(-width, 0);
  ctx.quadraticCurveTo(-width * 0.7, -len * 0.65, 0, -len);
  ctx.quadraticCurveTo(width * 0.7, -len * 0.65, width, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#4c1d95';
  ctx.beginPath();
  ctx.moveTo(-width * 0.3, -len * 0.74);
  ctx.quadraticCurveTo(0, -len * 1.02, width * 0.3, -len * 0.74);
  ctx.quadraticCurveTo(0, -len * 0.8, -width * 0.3, -len * 0.74);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f5d0fe';
  ctx.beginPath();
  ctx.moveTo(-width * 0.55, -len * 0.05);
  ctx.quadraticCurveTo(-width * 0.38, -len * 0.5, 0, -len * 0.72);
  ctx.quadraticCurveTo(width * 0.38, -len * 0.5, width * 0.55, -len * 0.05);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCheekTuft(ctx: CanvasRenderingContext2D, side: number, hr: number, mood: ZunoMood): void {
  const k = mood === 'STATIC_POOF' ? 1.45 : 1;
  const bx = side * hr * 0.8;
  ctx.fillStyle = ZUNO_PALETTE.lavender;
  ctx.beginPath();
  ctx.moveTo(bx, -hr * 0.12);
  ctx.lineTo(bx + side * hr * 0.38 * k, hr * 0.02);
  ctx.lineTo(bx + side * hr * 0.12 * k, hr * 0.12);
  ctx.lineTo(bx + side * hr * 0.42 * k, hr * 0.26);
  ctx.lineTo(bx + side * hr * 0.1 * k, hr * 0.32);
  ctx.lineTo(bx + side * hr * 0.3 * k, hr * 0.5);
  ctx.lineTo(bx - side * hr * 0.12, hr * 0.42);
  ctx.closePath();
  ctx.fill();
}

function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, t: number): void {
  const pts: [number, number][] = [
    [0.12, -1],
    [-0.45, 0.12],
    [-0.04, 0.12],
    [-0.2, 1],
    [0.45, -0.16],
    [0.05, -0.16],
  ];
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = s * (1.2 + 0.6 * Math.sin(t * 0.008));
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    if (i === 0) ctx.moveTo(x + px * s, y + py * s);
    else ctx.lineTo(x + px * s, y + py * s);
  });
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEyes(ctx: CanvasRenderingContext2D, hr: number, mood: ZunoMood, t: number): void {
  const eyeY = -hr * 0.04;
  const eyeX = hr * 0.38;
  ctx.save();
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const ex = side * eyeX;
    if (mood === 'SLEEP_PAUSE') {
      ctx.strokeStyle = ZUNO_PALETTE.ink;
      ctx.lineWidth = hr * 0.06;
      ctx.beginPath();
      ctx.arc(ex, eyeY, hr * 0.13, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.lineWidth = hr * 0.03;
      ctx.beginPath();
      ctx.moveTo(ex + side * hr * 0.12, eyeY + hr * 0.06);
      ctx.lineTo(ex + side * hr * 0.19, eyeY + hr * 0.1);
      ctx.stroke();
    } else if (mood === 'HAPPY_LEAP') {
      ctx.strokeStyle = ZUNO_PALETTE.ink;
      ctx.lineWidth = hr * 0.065;
      ctx.beginPath();
      ctx.arc(ex, eyeY + hr * 0.07, hr * 0.13, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (mood === 'STATIC_POOF') {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = ZUNO_PALETTE.ink;
      ctx.lineWidth = hr * 0.035;
      ctx.beginPath();
      ctx.arc(ex, eyeY, hr * 0.2, 0, TAU);
      ctx.fill();
      ctx.stroke();
      const angle = t * 0.02 * side;
      ctx.fillStyle = '#0b0620';
      ctx.beginPath();
      ctx.arc(ex + Math.cos(angle) * hr * 0.075, eyeY + Math.sin(angle) * hr * 0.075, hr * 0.065, 0, TAU);
      ctx.fill();
    } else {
      const blinking = t % 3600 < 140;
      if (blinking) {
        ctx.strokeStyle = ZUNO_PALETTE.ink;
        ctx.lineWidth = hr * 0.06;
        ctx.beginPath();
        ctx.moveTo(ex - hr * 0.12, eyeY);
        ctx.lineTo(ex + hr * 0.12, eyeY);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#130a36';
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, hr * 0.15, hr * 0.19, 0, 0, TAU);
        ctx.fill();
        ctx.save();
        ctx.shadowColor = ZUNO_PALETTE.cyan;
        ctx.shadowBlur = hr * 0.25;
        ctx.fillStyle = ZUNO_PALETTE.cyan;
        ctx.beginPath();
        ctx.arc(ex + hr * 0.015, eyeY + hr * 0.03, hr * 0.1, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#0b0620';
        ctx.beginPath();
        ctx.arc(ex + hr * 0.015, eyeY + hr * 0.04, hr * 0.055, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - hr * 0.05, eyeY - hr * 0.07, hr * 0.05, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + hr * 0.045, eyeY + hr * 0.075, hr * 0.022, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function drawMouth(ctx: CanvasRenderingContext2D, hr: number, mood: ZunoMood): void {
  ctx.save();
  ctx.strokeStyle = ZUNO_PALETTE.ink;
  ctx.fillStyle = ZUNO_PALETTE.ink;
  ctx.lineWidth = hr * 0.045;
  ctx.lineCap = 'round';
  const my = hr * 0.36;
  if (mood === 'HAPPY_LEAP') {
    ctx.beginPath();
    ctx.arc(0, my, hr * 0.14, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#9d174d';
    ctx.fill();
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.ellipse(0, my + hr * 0.09, hr * 0.07, hr * 0.04, 0, 0, TAU);
    ctx.fill();
  } else if (mood === 'STATIC_POOF') {
    ctx.beginPath();
    ctx.ellipse(0, my + hr * 0.04, hr * 0.06, hr * 0.08, 0, 0, TAU);
    ctx.fill();
  } else if (mood === 'SLEEP_PAUSE') {
    ctx.beginPath();
    ctx.arc(0, my - hr * 0.02, hr * 0.06, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-hr * 0.07, my - hr * 0.02, hr * 0.07, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hr * 0.07, my - hr * 0.02, hr * 0.07, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, r: number, mood: ZunoMood, t: number): void {
  const sleeping = mood === 'SLEEP_PAUSE';
  const hx = sleeping ? -r * 0.14 : 0;
  const hy = sleeping ? r * 0.18 : -r * 0.3;
  const hr = r * 0.55;

  ctx.save();
  ctx.translate(hx, hy);
  if (sleeping) ctx.rotate(-0.16);
  else if (mood === 'HAPPY_LEAP') ctx.rotate(Math.sin(t * 0.009) * 0.08);
  else if (mood === 'AWAKE_POP') ctx.rotate(Math.sin(t * 0.0013) * 0.04);

  drawEar(ctx, -1, hr, mood, t);
  drawEar(ctx, 1, hr, mood, t);
  drawCheekTuft(ctx, -1, hr, mood);
  drawCheekTuft(ctx, 1, hr, mood);

  const g = ctx.createRadialGradient(-hr * 0.3, -hr * 0.4, hr * 0.1, 0, 0, hr * 1.2);
  g.addColorStop(0, '#c77dff');
  g.addColorStop(0.55, ZUNO_PALETTE.violet);
  g.addColorStop(1, '#6a0dad');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, hr * 1.05, hr * 0.9, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = ZUNO_PALETTE.lavender;
  ctx.beginPath();
  ctx.ellipse(0, hr * 0.36, hr * 0.5, hr * 0.36, 0, 0, TAU);
  ctx.fill();

  const boltColor = sleeping ? ZUNO_PALETTE.gold : mood === 'STATIC_POOF' ? ZUNO_PALETTE.coral : ZUNO_PALETTE.cyan;
  drawBolt(ctx, 0, -hr * 0.52, hr * 0.2, boltColor, t);

  drawEyes(ctx, hr, mood, t);

  ctx.fillStyle = ZUNO_PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(0, hr * 0.24, hr * 0.085, hr * 0.06, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(-hr * 0.025, hr * 0.215, hr * 0.022, 0, TAU);
  ctx.fill();

  drawMouth(ctx, hr, mood);

  ctx.fillStyle = 'rgba(251, 113, 133, 0.45)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * hr * 0.6, hr * 0.28, hr * 0.13, hr * 0.08, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ============================ EFFECTS ============================== */

function drawPoofFur(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  const spikes = 22;
  ctx.save();
  ctx.fillStyle = hexToRgba(ZUNO_PALETTE.coral, 0.5);
  ctx.beginPath();
  for (let i = 0; i <= spikes * 2; i += 1) {
    const angle = (i / (spikes * 2)) * TAU;
    const outer = i % 2 === 0;
    const rad = outer ? r * 1.08 + Math.sin(t * 0.05 + i) * r * 0.06 : r * 0.84;
    const px = Math.cos(angle) * rad;
    const py = r * 0.08 + Math.sin(angle) * rad * 0.95;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStar4(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.closePath();
  ctx.fill();
}

function drawSparkles(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, colors: string[]): void {
  const count = 7;
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + t * 0.0018;
    const dist = r * (1.3 + 0.12 * Math.sin(t * 0.01 + i));
    const size = r * 0.09 * (0.6 + 0.4 * Math.sin(t * 0.012 + i * 1.7));
    const color = colors[i % colors.length];
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 0.2;
    drawStar4(ctx, x + Math.cos(angle) * dist, y + Math.sin(angle) * dist * 0.85, size);
  }
  ctx.restore();
}

function drawStaticCrackles(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  const seed = Math.floor(t / 70);
  ctx.save();
  ctx.strokeStyle = ZUNO_PALETTE.coral;
  ctx.lineWidth = Math.max(1.5, r * 0.03);
  ctx.lineCap = 'round';
  ctx.shadowColor = ZUNO_PALETTE.coral;
  ctx.shadowBlur = r * 0.15;
  for (let i = 0; i < 5; i += 1) {
    const angle = pseudoRandom(seed + i * 9) * TAU;
    const start = r * 1.15;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * start, y + Math.sin(angle) * start);
    for (let s = 1; s <= 3; s += 1) {
      const rad = start + s * r * 0.09;
      const jitter = (pseudoRandom(seed * 3 + i * 17 + s) - 0.5) * 0.35;
      ctx.lineTo(x + Math.cos(angle + jitter) * rad, y + Math.sin(angle + jitter) * rad);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawZzz(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i += 1) {
    const phase = (t * 0.00045 + i / 3) % 1;
    const px = x + phase * r * 0.55 + Math.sin(phase * 6 + i) * r * 0.06;
    const py = y - phase * r * 0.95;
    const size = r * (0.16 + phase * 0.18);
    ctx.globalAlpha = Math.sin(phase * Math.PI);
    ctx.fillStyle = i % 2 === 0 ? ZUNO_PALETTE.lavender : ZUNO_PALETTE.gold;
    ctx.shadowColor = ZUNO_PALETTE.gold;
    ctx.shadowBlur = r * 0.12;
    ctx.font = `700 ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
    ctx.fillText('Z', px, py);
  }
  ctx.restore();
}

/* ============================ ZUNO FOX ============================= */

/**
 * Draws Zuno the Spark-Fox centred at (x, y). `radius` is the core body
 * radius; the aura extends to ~1.95 × radius and the awake tail to ~1.6 ×.
 */
export function drawZunoFox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  mood: ZunoMood,
  timeMs: number,
): void {
  const r = Math.max(4, radius);
  const t = timeMs;
  let ox = 0;
  let oy = 0;
  let sx = 1;
  let sy = 1;

  if (mood === 'AWAKE_POP') {
    const breath = Math.sin(t * 0.004);
    oy = breath * r * 0.03;
    sy = 1 + breath * 0.02;
  } else if (mood === 'SLEEP_PAUSE') {
    const breath = Math.sin(t * 0.0016);
    sy = 1 + breath * 0.035;
    sx = 1 - breath * 0.01;
    oy = r * 0.08;
  } else if (mood === 'HAPPY_LEAP') {
    const leap = Math.abs(Math.sin(t * 0.009));
    oy = -leap * r * 0.35;
    sy = 0.94 + leap * 0.1;
    sx = 1.04 - leap * 0.06;
  } else {
    ox = Math.sin(t * 0.06) * r * 0.035;
  }

  ctx.save();
  drawAura(ctx, x, y + oy * 0.5, r, mood, t);

  ctx.save();
  ctx.translate(x + ox, y + oy);
  ctx.scale(sx, sy);
  const sleeping = mood === 'SLEEP_PAUSE';
  if (mood === 'STATIC_POOF') drawPoofFur(ctx, r, t);
  if (!sleeping) drawTail(ctx, r, mood, t, false);
  drawBody(ctx, r, sleeping);
  drawHead(ctx, r, mood, t);
  if (sleeping) drawTail(ctx, r, mood, t, true);
  ctx.restore();

  if (sleeping) drawZzz(ctx, x + r * 0.45, y - r * 0.35, r, t);
  if (mood === 'HAPPY_LEAP') drawSparkles(ctx, x, y + oy, r, t, [ZUNO_PALETTE.gold, ZUNO_PALETTE.cyan, ZUNO_PALETTE.lavender]);
  if (mood === 'STATIC_POOF') drawStaticCrackles(ctx, x + ox, y, r, t);
  ctx.restore();
}

/* ============================ SCENERY ============================== */

export interface SkyStar {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
}

export function createStars(count: number): SkyStar[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random() * 0.75,
    size: 0.6 + Math.random() * 1.6,
    phase: Math.random() * TAU,
    speed: 0.5 + Math.random() * 1.5,
  }));
}

export function drawNightSky(ctx: CanvasRenderingContext2D, w: number, h: number, moonBlend: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, ZUNO_PALETTE.night);
  g.addColorStop(0.65, '#170f3d');
  g.addColorStop(1, ZUNO_PALETTE.twilight);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const nebula = ctx.createRadialGradient(w * 0.2, h * 0.1, 0, w * 0.2, h * 0.1, Math.max(w, h) * 0.6);
  nebula.addColorStop(0, 'rgba(152, 16, 250, 0.22)');
  nebula.addColorStop(1, 'rgba(152, 16, 250, 0)');
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, w, h);

  if (moonBlend > 0.01) {
    const moonWash = ctx.createLinearGradient(0, 0, 0, h);
    moonWash.addColorStop(0, `rgba(59, 130, 246, ${0.28 * moonBlend})`);
    moonWash.addColorStop(1, `rgba(233, 213, 255, ${0.08 * moonBlend})`);
    ctx.fillStyle = moonWash;
    ctx.fillRect(0, 0, w, h);
  }
}

export function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, stars: SkyStar[], t: number): void {
  ctx.save();
  for (const star of stars) {
    const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.0015 * star.speed + star.phase));
    ctx.fillStyle = `rgba(233, 213, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(star.x * w, star.y * h, star.size, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFullMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 3);
  halo.addColorStop(0, 'rgba(254, 243, 199, 0.5)');
  halo.addColorStop(1, 'rgba(254, 243, 199, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, TAU);
  ctx.fill();

  const disc = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  disc.addColorStop(0, '#fffbeb');
  disc.addColorStop(1, '#fde68a');
  ctx.fillStyle = disc;
  ctx.shadowColor = '#fef3c7';
  ctx.shadowBlur = r * (0.8 + 0.2 * Math.sin(t * 0.002));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(217, 119, 6, 0.18)';
  const craters: [number, number, number][] = [
    [-0.3, -0.2, 0.18],
    [0.25, 0.1, 0.24],
    [-0.1, 0.4, 0.12],
    [0.35, -0.38, 0.1],
  ];
  for (const [cx, cy, cr] of craters) {
    ctx.beginPath();
    ctx.arc(x + cx * r, y + cy * r, cr * r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawForestGround(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, t: number): void {
  ctx.save();
  // Distant pine silhouettes.
  ctx.fillStyle = '#140d36';
  const trees = Math.max(6, Math.round(w / 90));
  for (let i = 0; i <= trees; i += 1) {
    const tx = (i / trees) * w + Math.sin(i * 12.9) * 20;
    const th = h * (0.14 + pseudoRandom(i * 3.3) * 0.12);
    const tw = th * 0.42;
    ctx.beginPath();
    ctx.moveTo(tx, groundY - th);
    ctx.lineTo(tx - tw, groundY + 4);
    ctx.lineTo(tx + tw, groundY + 4);
    ctx.closePath();
    ctx.fill();
  }

  const ground = ctx.createLinearGradient(0, groundY - 8, 0, h);
  ground.addColorStop(0, '#1d1550');
  ground.addColorStop(1, '#0b0720');
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= w; x += 24) {
    ctx.lineTo(x, groundY + Math.sin(x * 0.02) * 5);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Fireflies.
  for (let i = 0; i < 10; i += 1) {
    const fx = (pseudoRandom(i * 7.7) * w + Math.sin(t * 0.0006 + i) * 30 + w) % w;
    const fy = groundY - 20 - pseudoRandom(i * 4.1) * h * 0.25 + Math.cos(t * 0.0009 + i * 2) * 14;
    const alpha = 0.3 + 0.7 * Math.max(0, Math.sin(t * 0.002 + i * 1.3));
    ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
    ctx.shadowColor = ZUNO_PALETTE.gold;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(fx, fy, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Spark Berry Bush, base-centred at (cx, groundY). Height ≈ 0.5 × width. */
export function drawSparkBerryBush(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  width: number,
  t: number,
  rustle: number,
): void {
  const leaves: [number, number, number][] = [
    [-0.4, -0.12, 0.17],
    [-0.24, -0.26, 0.2],
    [0, -0.3, 0.21],
    [0.24, -0.26, 0.2],
    [0.4, -0.12, 0.17],
    [-0.16, -0.08, 0.2],
    [0.16, -0.08, 0.2],
  ];
  ctx.save();
  leaves.forEach(([lx, ly, lr], i) => {
    const wobble = Math.sin(t * 0.02 + i * 1.3) * rustle * width * 0.012;
    const x = cx + lx * width + wobble;
    const y = groundY + ly * width;
    const g = ctx.createRadialGradient(x - lr * width * 0.3, y - lr * width * 0.4, lr * width * 0.1, x, y, lr * width);
    g.addColorStop(0, '#2dd4bf');
    g.addColorStop(0.35, '#0f766e');
    g.addColorStop(1, '#134e4a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, lr * width, 0, TAU);
    ctx.fill();
  });

  const berries: [number, number][] = [
    [-0.32, -0.2],
    [-0.12, -0.34],
    [0.1, -0.36],
    [0.3, -0.22],
    [-0.22, -0.06],
    [0.04, -0.14],
    [0.24, -0.06],
    [-0.42, -0.04],
    [0.42, -0.04],
  ];
  const berryColors = [ZUNO_PALETTE.cyan, ZUNO_PALETTE.violet, ZUNO_PALETTE.gold];
  berries.forEach(([bx, by], i) => {
    const pulse = 0.6 + 0.4 * Math.sin(t * 0.004 + i * 1.9);
    const color = berryColors[i % berryColors.length];
    const x = cx + bx * width + Math.sin(t * 0.02 + i) * rustle * width * 0.01;
    const y = groundY + by * width;
    ctx.shadowColor = color;
    ctx.shadowBlur = width * 0.06 * pulse;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, width * 0.028, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(x - width * 0.008, y - width * 0.009, width * 0.008, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

/** Golden Static-Bug distractor: flapping wings and crackling antennae. */
export function drawStaticBug(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.004) * 0.3);

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.6);
  glow.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
  glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.6, 0, TAU);
  ctx.fill();

  const flap = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.045));
  ctx.fillStyle = 'rgba(233, 213, 255, 0.6)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.15, -s * 0.38, s * 0.42, s * 0.22 * flap, -0.5, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 0.15, -s * 0.38, s * 0.42, s * 0.22 * flap, 0.5, 0, TAU);
  ctx.fill();

  const body = ctx.createLinearGradient(-s * 0.4, 0, s * 0.4, 0);
  body.addColorStop(0, '#f59e0b');
  body.addColorStop(1, '#fde68a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.45, s * 0.32, 0, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = 'rgba(120, 53, 15, 0.55)';
  ctx.lineWidth = Math.max(1, s * 0.07);
  for (const sx of [-0.15, 0.05]) {
    ctx.beginPath();
    ctx.moveTo(s * sx, -s * 0.28);
    ctx.lineTo(s * sx, s * 0.28);
    ctx.stroke();
  }

  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.arc(s * 0.45, 0, s * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(s * 0.52, -s * 0.05, s * 0.06, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(s * 0.5, -s * 0.14);
  ctx.quadraticCurveTo(s * 0.62, -s * 0.5, s * 0.82, -s * 0.52);
  ctx.moveTo(s * 0.58, -s * 0.1);
  ctx.quadraticCurveTo(s * 0.8, -s * 0.3, s * 0.95, -s * 0.24);
  ctx.stroke();
  ctx.fillStyle = ZUNO_PALETTE.cyan;
  ctx.shadowColor = ZUNO_PALETTE.cyan;
  ctx.shadowBlur = s * 0.5;
  ctx.beginPath();
  ctx.arc(s * 0.82, -s * 0.52, s * 0.07, 0, TAU);
  ctx.arc(s * 0.95, -s * 0.24, s * 0.07, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Glowing energy orb used by Twin Currents. */
export function drawEnergyOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, t: number): void {
  ctx.save();
  const pulse = 0.85 + 0.15 * Math.sin(t * 0.006);
  const halo = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
  halo.addColorStop(0, hexToRgba(color, 0.55 * pulse));
  halo.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, TAU);
  ctx.fill();

  const core = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.05, x, y, r);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.4, color);
  core.addColorStop(1, hexToRgba(color, 0.7));
  ctx.fillStyle = core;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 0.8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  drawStar4(ctx, x + Math.cos(t * 0.004) * r * 0.35, y + Math.sin(t * 0.004) * r * 0.35, r * 0.22);
  ctx.restore();
}
