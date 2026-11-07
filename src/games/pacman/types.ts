export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export type GhostName = 'blinky' | 'pinky' | 'inky' | 'clyde';

export type GhostState = 'chase' | 'scatter' | 'frightened' | 'eaten';

export interface Ghost {
  name: GhostName;
  x: number; // In grid tile units (e.g. 13.5)
  y: number;
  dir: Direction;
  state: GhostState;
  color: string;
  speed: number;
  scatterTarget: { x: number; y: number };
  inHouse: boolean;
  exitTimer: number;
}

export interface PacmanState {
  x: number;
  y: number;
  dir: Direction;
  nextDir: Direction;
  mouthAngle: number;
  mouthOpening: boolean;
  speed: number;
}

export interface BonusFruit {
  active: boolean;
  type: 'cherry' | 'strawberry' | 'orange' | 'apple';
  points: number;
  x: number;
  y: number;
  timer: number;
}

export interface PacmanHighScore {
  initials: string;
  score: number;
  round: number;
  date: string;
}
