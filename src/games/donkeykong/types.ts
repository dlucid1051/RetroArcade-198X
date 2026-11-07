export type DKGameState =
  | 'start'
  | 'playing'
  | 'dying'
  | 'level_clear'
  | 'game_over';

export interface Girder {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Ladder {
  id: number;
  x: number;
  yBottom: number;
  yTop: number;
  isBroken?: boolean;
  brokenYStart?: number;
  brokenYEnd?: number;
}

export interface Jumpman {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: 'left' | 'right';
  state: 'idle' | 'running' | 'jumping' | 'climbing' | 'hammering' | 'dead';
  isGrounded: boolean;
  onLadder: boolean;
  ladderId: number | null;
  animFrame: number;
  animTimer: number;
  hammerTimer: number; // Duration remaining with hammer active
  hammerStep: number;  // Up / Down swing animation
  hammerAngle: number; // 0 = up, 1 = down
}

export interface Barrel {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  girderIndex: number;
  state: 'rolling' | 'falling' | 'dropping_ladder';
  rotation: number;
  isBlue: boolean;
  scoredJump: boolean;
}

export interface Fireball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  girderIndex: number;
  state: 'walking' | 'climbing';
  ladderId: number | null;
  targetY: number;
  animTimer: number;
}

export interface HammerItem {
  id: number;
  x: number;
  y: number;
  active: boolean;
}

export interface Pauline {
  x: number;
  y: number;
  animTimer: number;
  helpTimer: number;
}

export interface Kong {
  x: number;
  y: number;
  state: 'idle' | 'reach' | 'hold' | 'roll' | 'chest_beat';
  stateTimer: number;
  animFrame: number;
  chestBeatCount: number;
}

export interface OilDrum {
  x: number;
  y: number;
  width: number;
  height: number;
  isLit: boolean;
  fireTimer: number;
}

export interface DKScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
}

export interface DKHighScore {
  initials: string;
  score: number;
  level: number;
  date: string;
}
