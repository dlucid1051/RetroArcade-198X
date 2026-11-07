export interface Invader {
  row: number;
  col: number;
  type: 'squid' | 'crab' | 'octopus';
  x: number;
  y: number;
  points: number;
  alive: boolean;
}

export interface Bunker {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  // 2D grid of 2x2 or 3x3 pixel cells (true = solid, false = eroded by blast)
  cells: boolean[][];
}

export interface PlayerLaser {
  x: number;
  y: number;
  vy: number;
  active: boolean;
}

export interface AlienBomb {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: 'rolling' | 'plunger' | 'squiggly';
  animTimer: number;
  animFrame: number;
}

export interface MysteryUFO {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  points: number;
  timer: number;
}

export interface SpaceInvadersHighScore {
  initials: string;
  score: number;
  wave: number;
  date: string;
}
