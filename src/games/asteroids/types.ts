export interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // in radians, 0 pointing straight up (-PI/2)
  radius: number;
  thrusting: boolean;
  invulnerableTime: number; // seconds
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  fromSaucer: boolean;
}

export interface Asteroid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  tier: 1 | 2 | 3; // 3 = Large (40px), 2 = Medium (22px), 1 = Small (12px)
  angle: number;
  rotSpeed: number;
  points: [number, number][]; // Polygon vertices relative to center
}

export interface DebrisParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  length: number;
  angle: number;
  rotSpeed: number;
}

export interface Saucer {
  active: boolean;
  isSmall: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
  fireTimer: number;
  dirChangeTimer: number;
}

export interface HighScoreEntry {
  initials: string;
  score: number;
  wave: number;
  date: string;
}

export type ColorTheme = 'cyan' | 'monochrome' | 'green' | 'amber';
