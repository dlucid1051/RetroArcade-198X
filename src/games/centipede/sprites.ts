import {
  Mushroom,
  Blaster,
  CentipedeSegment,
  Spider,
  Flea,
  Scorpion,
} from './types';

export const CELL_SIZE = 16;

/** Draw the Bug Blaster Player Ship */
export function drawBlaster(
  ctx: CanvasRenderingContext2D,
  blaster: Blaster,
  t: number
) {
  ctx.save();
  ctx.translate(blaster.x, blaster.y);

  if (blaster.isDead) {
    // Explosion particles
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const r = 8 + Math.sin(t * 15 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const w = blaster.width;
  const h = blaster.height;

  // Base Ship Body (Arcade White / Cyan Vector highlight)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(w / 4, h / 3);
  ctx.lineTo(-w / 4, h / 3);
  ctx.lineTo(-w / 2, h / 2);
  ctx.closePath();
  ctx.fill();

  // Cyan Core
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Forward Laser Emitter
  ctx.fillStyle = '#22d3ee';
  ctx.fillRect(-1.5, -h / 2 - 4, 3, 5);

  ctx.restore();
}

/** Draw a Mushroom with 4 damage stages and toxic poison coloring */
export function drawMushroom(ctx: CanvasRenderingContext2D, m: Mushroom) {
  ctx.save();
  const x = m.col * CELL_SIZE + CELL_SIZE / 2;
  const y = m.row * CELL_SIZE + CELL_SIZE / 2;
  ctx.translate(x, y);

  // Toxic Poison coloring or Normal vibrant mushroom colors
  const capColor = m.isPoisoned ? '#a855f7' : '#f43f5e'; // Purple or Rose
  const spotColor = m.isPoisoned ? '#4ade80' : '#fef08a'; // Toxic Green or Cream
  const stemColor = m.isPoisoned ? '#7e22ce' : '#cbd5e1';

  const r = CELL_SIZE / 2 - 1.5;

  // 1. Stem
  ctx.fillStyle = stemColor;
  ctx.fillRect(-2.5, 0, 5, r);

  // 2. Dome Cap
  ctx.fillStyle = capColor;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  // 3. Spots on Cap
  ctx.fillStyle = spotColor;
  ctx.beginPath();
  ctx.arc(-3, -4, 1.8, 0, Math.PI * 2);
  ctx.arc(3, -4, 1.8, 0, Math.PI * 2);
  ctx.arc(0, -6, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // 4. Damage chipping according to remaining health (health 4=fresh, 3=cracked, 2=half, 1=crumbled)
  if (m.health < 4) {
    ctx.fillStyle = '#020408'; // Carve out damage holes
    if (m.health <= 3) {
      ctx.beginPath();
      ctx.arc(r * 0.5, -r * 0.6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (m.health <= 2) {
      ctx.beginPath();
      ctx.arc(-r * 0.4, -r * 0.4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (m.health <= 1) {
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/** Draw Centipede Segment (Head or Body) */
export function drawCentipedeSegment(
  ctx: CanvasRenderingContext2D,
  seg: CentipedeSegment,
  t: number
) {
  ctx.save();
  ctx.translate(seg.x, seg.y);

  const r = CELL_SIZE / 2 - 1;
  const legCycle = Math.sin(t * 20 + seg.col) * 3;

  if (seg.isHead) {
    // 1. Head Segment (Vivid Red / Orange with mandibles and eyes)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Mandibles / Antennae pointing in moving direction
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(seg.dirX * 4, -4);
    ctx.lineTo(seg.dirX * 8, -6);
    ctx.moveTo(seg.dirX * 4, 4);
    ctx.lineTo(seg.dirX * 8, 6);
    ctx.stroke();

    // Eyes (menacing yellow/white)
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(seg.dirX * 2, -4, 3, 3);
    ctx.fillRect(seg.dirX * 2, 1, 3, 3);
    ctx.fillStyle = '#000000';
    ctx.fillRect(seg.dirX * 3, -3, 1.5, 1.5);
    ctx.fillRect(seg.dirX * 3, 2, 1.5, 1.5);
  } else {
    // 2. Body Segment (Green/Teal segmented bulb with undulating legs)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Tiny crawling legs on top and bottom
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, -r);
    ctx.lineTo(-4 + legCycle, -r - 3);
    ctx.moveTo(3, -r);
    ctx.lineTo(4 - legCycle, -r - 3);
    ctx.moveTo(-3, r);
    ctx.lineTo(-4 - legCycle, r + 3);
    ctx.moveTo(3, r);
    ctx.lineTo(4 + legCycle, r + 3);
    ctx.stroke();
  }

  ctx.restore();
}

/** Draw the Zigzagging Spider */
export function drawSpider(
  ctx: CanvasRenderingContext2D,
  spider: Spider,
  t: number
) {
  if (!spider.active) return;
  ctx.save();
  ctx.translate(spider.x, spider.y);

  const r = 9;
  const legOffset = Math.sin(t * 22) * 4;

  // Spider Body (Electric Blue / Magenta)
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // Spindly 8-legs
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1.8;
  const legAngles = [-0.9, -0.4, 0.4, 0.9];
  legAngles.forEach((a, i) => {
    // Left legs
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, a * r);
    ctx.lineTo(-r * 1.5, a * r + (i % 2 === 0 ? legOffset : -legOffset));
    ctx.lineTo(-r * 2.1, a * r * 1.4);
    ctx.stroke();

    // Right legs
    ctx.beginPath();
    ctx.moveTo(r * 0.7, a * r);
    ctx.lineTo(r * 1.5, a * r + (i % 2 === 0 ? -legOffset : legOffset));
    ctx.lineTo(r * 2.1, a * r * 1.4);
    ctx.stroke();
  });

  // Glowing eyes
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(-3, -2, 2, 2);
  ctx.fillRect(1, -2, 2, 2);

  ctx.restore();
}

/** Draw the Flea plunging down */
export function drawFlea(ctx: CanvasRenderingContext2D, flea: Flea, t: number) {
  if (!flea.active) return;
  ctx.save();
  ctx.translate(flea.x, flea.y);

  // Elongated segmented body (Amber / Orange)
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spores
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  // Wiggling legs
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.5;
  const wiggle = Math.sin(t * 30) * 3;
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(-9, wiggle);
  ctx.moveTo(5, 0);
  ctx.lineTo(9, -wiggle);
  ctx.stroke();

  ctx.restore();
}

/** Draw the Scorpion scurrying horizontally */
export function drawScorpion(
  ctx: CanvasRenderingContext2D,
  scorp: Scorpion,
  t: number
) {
  if (!scorp.active) return;
  ctx.save();
  ctx.translate(scorp.x, scorp.y);

  const dir = scorp.vx > 0 ? 1 : -1;
  ctx.scale(dir, 1);

  // Toxic Cyan / Purple Body
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(-8, -4, 16, 8);

  // Claws at front
  ctx.fillStyle = '#c084fc';
  ctx.beginPath();
  ctx.moveTo(8, -3);
  ctx.lineTo(14, -6);
  ctx.lineTo(12, -1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, 3);
  ctx.lineTo(14, 6);
  ctx.lineTo(12, 1);
  ctx.fill();

  // Arched Stinger Tail at rear
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.quadraticCurveTo(-14, -8, -10, -12);
  ctx.lineTo(-6, -10);
  ctx.stroke();

  // Toxic stinger tip
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(-7, -12, 3, 3);

  // Legs
  ctx.strokeStyle = '#e9d5ff';
  ctx.lineWidth = 1.2;
  const legWiggle = Math.sin(t * 25) * 2;
  for (let i = -4; i <= 4; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 4);
    ctx.lineTo(i + legWiggle, 8);
    ctx.moveTo(i, -4);
    ctx.lineTo(i - legWiggle, -8);
    ctx.stroke();
  }

  ctx.restore();
}
