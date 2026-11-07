import { Jumpman, Kong, Pauline, Barrel, Fireball, HammerItem, OilDrum } from './types';

/**
 * Procedural Sprite Renderer for Donkey Kong (1981)
 * Renders pure vector/pixel art with zero external image dependencies
 */

// Draw an authentic 1981 Jumpman (Mario)
export function drawJumpman(
  ctx: CanvasRenderingContext2D,
  player: Jumpman,
  t: number
) {
  ctx.save();
  ctx.translate(player.x, player.y);

  if (player.facing === 'left') {
    ctx.scale(-1, 1);
  }

  const w = player.width;
  const h = player.height;

  // Dying animation: spinning upside down or starburst
  if (player.state === 'dead') {
    ctx.rotate(Math.sin(t * 10) * 0.5);
    ctx.fillStyle = '#f87171';
    // Flattened or tumbling sprite
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-w / 4, -h / 4, w / 2, h / 2);
    ctx.restore();
    return;
  }

  // Climbing pose (rear view)
  if (player.state === 'climbing') {
    const climbStep = Math.floor(player.y / 6) % 2 === 0;

    // Head / Cap back
    ctx.fillStyle = '#dc2626'; // Red Cap
    ctx.fillRect(-w * 0.35, -h, w * 0.7, h * 0.3);

    // Blue shirt back
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(-w * 0.4, -h * 0.7, w * 0.8, h * 0.35);

    // Overalls / Straps
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-w * 0.3, -h * 0.65, w * 0.15, h * 0.4);
    ctx.fillRect(w * 0.15, -h * 0.65, w * 0.15, h * 0.4);
    ctx.fillRect(-w * 0.35, -h * 0.35, w * 0.7, h * 0.25);

    // Hands reaching ladder rungs
    ctx.fillStyle = '#fcd34d';
    if (climbStep) {
      ctx.fillRect(-w * 0.5, -h * 0.9, w * 0.2, h * 0.2);
      ctx.fillRect(w * 0.3, -h * 0.5, w * 0.2, h * 0.2);
    } else {
      ctx.fillRect(-w * 0.5, -h * 0.5, w * 0.2, h * 0.2);
      ctx.fillRect(w * 0.3, -h * 0.9, w * 0.2, h * 0.2);
    }

    // Boots
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-w * 0.4, -h * 0.15, w * 0.3, h * 0.15);
    ctx.fillRect(w * 0.1, -h * 0.15, w * 0.3, h * 0.15);

    ctx.restore();
    return;
  }

  // Side view Jumpman (running, idle, jumping, hammering)
  // 1. Cap & Hair
  ctx.fillStyle = '#dc2626'; // Red cap visor & crown
  ctx.fillRect(-w * 0.25, -h, w * 0.75, h * 0.22);
  ctx.fillRect(-w * 0.4, -h * 0.95, w * 0.3, h * 0.15); // Visor brim

  // Face & Nose & Ear
  ctx.fillStyle = '#fcd34d'; // Skin tone
  ctx.fillRect(-w * 0.3, -h * 0.78, w * 0.6, h * 0.28);
  ctx.fillRect(w * 0.2, -h * 0.72, w * 0.25, h * 0.16); // Big Mario Nose

  // Eye
  ctx.fillStyle = '#111827';
  ctx.fillRect(w * 0.05, -h * 0.74, w * 0.12, h * 0.14);

  // Mustache & Sideburns
  ctx.fillStyle = '#78350f'; // Brown mustache
  ctx.fillRect(w * 0.02, -h * 0.6, w * 0.4, h * 0.12);
  ctx.fillRect(-w * 0.35, -h * 0.75, w * 0.15, h * 0.2); // Sideburn

  // 2. Torso (Blue shirt & Red overalls)
  ctx.fillStyle = '#2563eb'; // Blue sleeves/shirt
  ctx.fillRect(-w * 0.35, -h * 0.5, w * 0.7, h * 0.25);

  ctx.fillStyle = '#dc2626'; // Red overalls & suspenders
  ctx.fillRect(-w * 0.25, -h * 0.5, w * 0.5, h * 0.28);
  // Yellow button
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(0, -h * 0.42, w * 0.1, h * 0.08);

  // 3. Hands / Arms
  ctx.fillStyle = '#fcd34d'; // Hands
  if (player.state === 'jumping') {
    // Jump pose: arms up
    ctx.fillRect(-w * 0.45, -h * 0.65, w * 0.2, h * 0.2);
    ctx.fillRect(w * 0.25, -h * 0.75, w * 0.2, h * 0.2);
  } else {
    // Normal / running arms
    const armSwing = player.state === 'running' ? Math.sin(player.animFrame * 1.5) * 4 : 0;
    ctx.fillRect(w * 0.25, -h * 0.45 + armSwing, w * 0.2, h * 0.18);
  }

  // 4. Legs / Boots
  ctx.fillStyle = '#78350f'; // Brown boots
  if (player.state === 'jumping') {
    // Legs tucked
    ctx.fillRect(-w * 0.35, -h * 0.22, w * 0.3, h * 0.18);
    ctx.fillRect(w * 0.05, -h * 0.3, w * 0.3, h * 0.18);
  } else if (player.state === 'running') {
    // Alternating running legs
    const runStep = Math.floor(player.animFrame) % 3;
    if (runStep === 0) {
      ctx.fillRect(-w * 0.4, -h * 0.22, w * 0.35, h * 0.22);
      ctx.fillRect(w * 0.1, -h * 0.22, w * 0.35, h * 0.22);
    } else if (runStep === 1) {
      ctx.fillRect(-w * 0.2, -h * 0.22, w * 0.4, h * 0.22);
    } else {
      ctx.fillRect(-w * 0.5, -h * 0.22, w * 0.35, h * 0.22);
      ctx.fillRect(0, -h * 0.3, w * 0.35, h * 0.2);
    }
  } else {
    // Idle stance
    ctx.fillRect(-w * 0.35, -h * 0.22, w * 0.32, h * 0.22);
    ctx.fillRect(w * 0.05, -h * 0.22, w * 0.32, h * 0.22);
  }

  // 5. Hammer when active!
  if (player.hammerTimer > 0) {
    drawActiveHammer(ctx, player);
  }

  ctx.restore();
}

/** Draws the swinging hammer when Jumpman holds the power-up */
function drawActiveHammer(ctx: CanvasRenderingContext2D, player: Jumpman) {
  ctx.save();
  const hammerUp = player.hammerAngle === 0;

  if (hammerUp) {
    // Hammer raised high above head
    ctx.translate(player.width * 0.1, -player.height * 1.05);

    // Wooden handle
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-3, -24, 6, 26);

    // Metallic dual-sided sledge head
    ctx.fillStyle = '#eab308'; // Golden yellow body
    ctx.fillRect(-16, -34, 32, 12);
    ctx.fillStyle = '#3b82f6'; // Blue strike faces
    ctx.fillRect(-18, -33, 4, 10);
    ctx.fillRect(14, -33, 4, 10);
    ctx.fillStyle = '#fef08a'; // Highlight
    ctx.fillRect(-14, -33, 28, 3);
  } else {
    // Hammer smashed down forward
    ctx.translate(player.width * 0.55, -player.height * 0.1);

    // Wooden handle
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-2, -18, 6, 20);

    // Metallic head on the ground
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-18, -4, 36, 12);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-20, -3, 4, 10);
    ctx.fillRect(16, -3, 4, 10);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(-16, -3, 32, 3);
  }

  ctx.restore();
}

/** Draws Donkey Kong with menacing presence and animated moves */
export function drawDonkeyKong(
  ctx: CanvasRenderingContext2D,
  kong: Kong,
  t: number
) {
  ctx.save();
  ctx.translate(kong.x, kong.y);

  const w = 70;
  const h = 64;

  // Fur base (deep gorilla brown)
  const furColor = '#78350f';
  const chestColor = '#fde68a'; // Tan stomach/chest
  const mouthColor = '#ef4444';

  // 1. Massive Shoulders and Torso
  ctx.fillStyle = furColor;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.45, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Chest & Abdomen Plate
  ctx.fillStyle = chestColor;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.4, w * 0.28, h * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  // Chest muscle line
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.52);
  ctx.lineTo(0, -h * 0.25);
  ctx.stroke();

  // 3. Legs & Big Gorilla Feet
  ctx.fillStyle = furColor;
  ctx.fillRect(-w * 0.45, -h * 0.18, w * 0.35, h * 0.2);
  ctx.fillRect(w * 0.1, -h * 0.18, w * 0.35, h * 0.2);

  ctx.fillStyle = chestColor; // Toes
  ctx.fillRect(-w * 0.48, -4, w * 0.4, 6);
  ctx.fillRect(w * 0.08, -4, w * 0.4, 6);

  // 4. Arms & Paws / Chest Beat
  const isChestBeat = kong.state === 'chest_beat';
  const beatSide = Math.floor(t * 8) % 2 === 0;

  if (isChestBeat) {
    // Alternating fists pounding chest
    ctx.fillStyle = furColor;
    if (beatSide) {
      // Left arm thumping chest, right arm raised
      ctx.fillRect(-w * 0.2, -h * 0.52, w * 0.22, h * 0.22);
      ctx.fillRect(w * 0.35, -h * 0.75, w * 0.22, h * 0.4);
    } else {
      // Right arm thumping chest, left arm raised
      ctx.fillRect(w * 0.0, -h * 0.52, w * 0.22, h * 0.22);
      ctx.fillRect(-w * 0.55, -h * 0.75, w * 0.22, h * 0.4);
    }
  } else if (kong.state === 'hold') {
    // Both arms raised high holding a wooden barrel overhead!
    ctx.fillStyle = furColor;
    ctx.fillRect(-w * 0.45, -h * 0.9, w * 0.2, h * 0.5);
    ctx.fillRect(w * 0.25, -h * 0.9, w * 0.2, h * 0.5);

    // Draw the overhead barrel
    drawSingleBarrel(ctx, 0, -h * 1.15, 14, 0, false);
  } else if (kong.state === 'reach') {
    // Arm extended left reaching toward the barrel stack
    ctx.fillStyle = furColor;
    ctx.fillRect(-w * 0.65, -h * 0.6, w * 0.35, h * 0.22);
    ctx.fillRect(w * 0.3, -h * 0.5, w * 0.22, h * 0.35);
  } else if (kong.state === 'roll') {
    // Right arm throwing downward
    ctx.fillStyle = furColor;
    ctx.fillRect(-w * 0.4, -h * 0.55, w * 0.22, h * 0.35);
    ctx.fillRect(w * 0.25, -h * 0.35, w * 0.35, h * 0.22);
  } else {
    // Default stance: arms resting wide
    ctx.fillStyle = furColor;
    ctx.fillRect(-w * 0.55, -h * 0.6, w * 0.22, h * 0.45);
    ctx.fillRect(w * 0.33, -h * 0.6, w * 0.22, h * 0.45);
  }

  // 5. Head & Menacing Face
  ctx.fillStyle = furColor;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.75, w * 0.28, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face mask / snout
  ctx.fillStyle = chestColor;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.72, w * 0.22, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fierce Eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-w * 0.14, -h * 0.8, w * 0.1, h * 0.1);
  ctx.fillRect(w * 0.04, -h * 0.8, w * 0.1, h * 0.1);

  ctx.fillStyle = '#111827'; // Black pupils
  ctx.fillRect(-w * 0.1, -h * 0.78, w * 0.06, h * 0.07);
  ctx.fillRect(w * 0.05, -h * 0.78, w * 0.06, h * 0.07);

  // Brow ridge
  ctx.fillStyle = '#451a03';
  ctx.fillRect(-w * 0.18, -h * 0.84, w * 0.36, h * 0.06);

  // Mouth & White Fangs
  ctx.fillStyle = mouthColor;
  ctx.fillRect(-w * 0.12, -h * 0.68, w * 0.24, h * 0.08);

  ctx.fillStyle = '#ffffff'; // Teeth
  ctx.fillRect(-w * 0.1, -h * 0.68, 3, 3);
  ctx.fillRect(w * 0.08, -h * 0.68, 3, 3);
  ctx.fillRect(-w * 0.04, -h * 0.62, 3, 3);
  ctx.fillRect(w * 0.02, -h * 0.62, 3, 3);

  // Red Tie if in modern flair or classic collar
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.58);
  ctx.lineTo(-6, -h * 0.4);
  ctx.lineTo(0, -h * 0.32);
  ctx.lineTo(6, -h * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/** Draws Pauline in her pink dress crying for help */
export function drawPauline(
  ctx: CanvasRenderingContext2D,
  pauline: Pauline,
  t: number
) {
  ctx.save();
  ctx.translate(pauline.x, pauline.y);

  const w = 24;
  const h = 38;
  const wave = Math.sin(t * 8) > 0;

  // 1. Blonde Hair
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-w * 0.4, -h, w * 0.8, h * 0.35);
  ctx.fillRect(-w * 0.5, -h * 0.85, w * 0.2, h * 0.45); // Left locks
  ctx.fillRect(w * 0.3, -h * 0.85, w * 0.2, h * 0.45); // Right locks

  // 2. Face
  ctx.fillStyle = '#fcd34d';
  ctx.fillRect(-w * 0.25, -h * 0.88, w * 0.5, h * 0.25);

  // Eyes & Red lips
  ctx.fillStyle = '#2563eb'; // Blue eyes
  ctx.fillRect(-w * 0.18, -h * 0.82, 3, 4);
  ctx.fillRect(w * 0.08, -h * 0.82, 3, 4);
  ctx.fillStyle = '#e11d48'; // Lips
  ctx.fillRect(-w * 0.1, -h * 0.7, 5, 2);

  // 3. Pink / Magenta Ballgown
  ctx.fillStyle = '#ec4899'; // Bright pink dress
  ctx.beginPath();
  ctx.moveTo(-w * 0.25, -h * 0.6);
  ctx.lineTo(w * 0.25, -h * 0.6);
  ctx.lineTo(w * 0.45, -h * 0.1);
  ctx.lineTo(-w * 0.45, -h * 0.1);
  ctx.closePath();
  ctx.fill();

  // White ruffles at neckline & hem
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-w * 0.25, -h * 0.62, w * 0.5, 3);
  ctx.fillRect(-w * 0.45, -h * 0.1, w * 0.9, 3);

  // 4. Waving Arms (distress)
  ctx.fillStyle = '#fcd34d';
  if (wave) {
    ctx.fillRect(-w * 0.55, -h * 0.8, 5, 12);
    ctx.fillRect(w * 0.4, -h * 0.7, 5, 12);
  } else {
    ctx.fillRect(-w * 0.55, -h * 0.7, 5, 12);
    ctx.fillRect(w * 0.4, -h * 0.8, 5, 12);
  }

  // 5. "HELP!" speech bubble
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-16, -h - 22, 34, 16);
  // Bubble pointer
  ctx.beginPath();
  ctx.moveTo(-2, -h - 6);
  ctx.lineTo(4, -h - 6);
  ctx.lineTo(-2, -h - 1);
  ctx.fill();

  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 9px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HELP!', 1, -h - 10);

  ctx.restore();
}

/** Draws an authentic rolling wooden barrel */
export function drawBarrel(ctx: CanvasRenderingContext2D, barrel: Barrel) {
  drawSingleBarrel(
    ctx,
    barrel.x,
    barrel.y,
    barrel.radius,
    barrel.rotation,
    barrel.isBlue
  );
}

export function drawSingleBarrel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rotation: number,
  isBlue: boolean
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  const r = radius;

  // Barrel body (Wood / or Blue Fire Barrel)
  ctx.fillStyle = isBlue ? '#2563eb' : '#b45309';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Dark iron outer bands
  ctx.strokeStyle = isBlue ? '#93c5fd' : '#451a03';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Internal wood staves & rotating spokes
  ctx.strokeStyle = isBlue ? '#1d4ed8' : '#78350f';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  // Cross spokes rotate to show rolling
  ctx.moveTo(-r * 0.8, 0);
  ctx.lineTo(r * 0.8, 0);
  ctx.moveTo(0, -r * 0.8);
  ctx.lineTo(0, r * 0.8);
  ctx.stroke();

  // Center bung cap
  ctx.fillStyle = isBlue ? '#ffffff' : '#fde047';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Draws Flaming Oil Drum at the bottom left */
export function drawOilDrum(
  ctx: CanvasRenderingContext2D,
  drum: OilDrum,
  t: number
) {
  ctx.save();
  ctx.translate(drum.x, drum.y);

  const w = drum.width;
  const h = drum.height;

  // Drum body (Arcade Navy Blue)
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(-w / 2, -h, w, h);

  // Metal ribs
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h, w, h);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.65);
  ctx.lineTo(w / 2, -h * 0.65);
  ctx.moveTo(-w / 2, -h * 0.35);
  ctx.lineTo(w / 2, -h * 0.35);
  ctx.stroke();

  // Stenciled "OIL" text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('OIL', 0, -h * 0.4);

  // Animated procedural fire rising out of the top when lit
  if (drum.isLit) {
    const flameCount = 5;
    for (let i = 0; i < flameCount; i++) {
      const fx = -w * 0.4 + (i * w * 0.8) / (flameCount - 1);
      const flameHeight = 16 + Math.sin(t * 12 + i * 2) * 8;
      const gradient = ctx.createLinearGradient(fx, -h, fx, -h - flameHeight);
      gradient.addColorStop(0, '#ef4444');
      gradient.addColorStop(0.5, '#f97316');
      gradient.addColorStop(1, '#fef08a');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(fx - 4, -h);
      ctx.lineTo(fx + 4, -h);
      ctx.lineTo(fx + Math.sin(t * 10 + i) * 3, -h - flameHeight);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

/** Draws Fireball enemies roaming the girders */
export function drawFireball(
  ctx: CanvasRenderingContext2D,
  fire: Fireball,
  t: number
) {
  ctx.save();
  ctx.translate(fire.x, fire.y);

  const r = 10;
  const flicker = Math.sin(t * 15 + fire.animTimer) * 2;

  // Outer orange aura
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.arc(0, -r, r + flicker, 0, Math.PI * 2);
  ctx.fill();

  // Core yellow flame
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(0, -r, r * 0.65, 0, Math.PI * 2);
  ctx.fill();

  // Big white eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-6, -r - 4, 4, 6);
  ctx.fillRect(2, -r - 4, 4, 6);

  // Black pupils looking in direction of movement
  ctx.fillStyle = '#000000';
  const lookOffset = fire.vx >= 0 ? 1 : -1;
  ctx.fillRect(-5 + lookOffset, -r - 2, 2, 4);
  ctx.fillRect(3 + lookOffset, -r - 2, 2, 4);

  ctx.restore();
}

/** Draws a Hammer pickup sitting on a girder */
export function drawHammerItem(
  ctx: CanvasRenderingContext2D,
  hammer: HammerItem,
  t: number
) {
  if (!hammer.active) return;

  ctx.save();
  ctx.translate(hammer.x, hammer.y);

  // Pulsing arcade glow
  const glow = Math.sin(t * 6) * 2;

  // Handle
  ctx.fillStyle = '#d97706';
  ctx.fillRect(-2, -20, 4, 20);

  // Dual hammer head
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-14 - glow / 2, -28 - glow / 2, 28 + glow, 10 + glow);

  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(-16, -27, 3, 8);
  ctx.fillRect(13, -27, 3, 8);

  ctx.restore();
}

/** Draws Authentic Red Iron Girders with structural truss lattice */
export function drawGirder(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  ctx.save();

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const girderHeight = 12;

  ctx.translate(x1, y1);
  ctx.rotate(angle);

  // 1. Top and Bottom Steel Rail Flanges (Crimson / Magenta 80s arcade hue)
  ctx.fillStyle = '#dc2626'; // Vivid girder red
  ctx.fillRect(0, 0, len, 3);
  ctx.fillRect(0, girderHeight - 3, len, 3);

  // Highlight ridge
  ctx.fillStyle = '#f87171';
  ctx.fillRect(0, 0, len, 1);

  // 2. Diagonal Lattice Crossbars
  const step = 14;
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let x = 0; x < len; x += step) {
    ctx.moveTo(x, 2);
    ctx.lineTo(Math.min(x + step, len), girderHeight - 2);
    ctx.moveTo(Math.min(x + step, len), 2);
    ctx.lineTo(x, girderHeight - 2);
  }
  ctx.stroke();

  ctx.restore();
}

/** Draws Classic Blue Arcade Ladder */
export function drawLadder(
  ctx: CanvasRenderingContext2D,
  x: number,
  yTop: number,
  yBottom: number,
  isBroken?: boolean,
  brokenYStart?: number,
  brokenYEnd?: number
) {
  ctx.save();

  const ladderWidth = 14;
  const rungSpacing = 8;
  const leftX = x - ladderWidth / 2;
  const rightX = x + ladderWidth / 2;

  ctx.fillStyle = '#38bdf8'; // Sky blue arcade ladder rails
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;

  if (isBroken && brokenYStart !== undefined && brokenYEnd !== undefined) {
    // Upper section
    drawLadderSegment(ctx, leftX, rightX, yTop, brokenYStart, rungSpacing);
    // Lower section
    drawLadderSegment(ctx, leftX, rightX, brokenYEnd, yBottom, rungSpacing);
  } else {
    // Continuous full ladder
    drawLadderSegment(ctx, leftX, rightX, yTop, yBottom, rungSpacing);
  }

  ctx.restore();
}

function drawLadderSegment(
  ctx: CanvasRenderingContext2D,
  leftX: number,
  rightX: number,
  y1: number,
  y2: number,
  spacing: number
) {
  // Rails
  ctx.fillRect(leftX - 1, y1, 2, y2 - y1);
  ctx.fillRect(rightX - 1, y1, 2, y2 - y1);

  // Rungs
  ctx.beginPath();
  for (let y = y1 + spacing / 2; y <= y2; y += spacing) {
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
  }
  ctx.stroke();
}
