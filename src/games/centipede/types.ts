export type CentipedeState = 'start' | 'playing' | 'dying' | 'game_over';

export interface Mushroom {
  col: number;
  row: number;
  health: number; // 1 to 4 hits
  isPoisoned: boolean;
}

export interface Blaster {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  isDead: boolean;
}

export interface Dart {
  x: number;
  y: number;
  vy: number;
  active: boolean;
}

export interface CentipedeSegment {
  id: number;
  col: number;
  row: number;
  x: number;
  y: number;
  isHead: boolean;
  dirX: 1 | -1;
  dirY: 1 | -1;
  isPoisonedPlunge: boolean;
  targetCol: number;
  targetRow: number;
  progress: number; // 0 to 1 between grid cells
}

export interface Spider {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
  scoreValue: number;
}

export interface Flea {
  active: boolean;
  col: number;
  x: number;
  y: number;
  vy: number;
  health: number;
}

export interface Scorpion {
  active: boolean;
  row: number;
  x: number;
  y: number;
  vx: number;
}

export interface CentipedeScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
}

export interface CentipedeHighScore {
  initials: string;
  score: number;
  wave: number;
  date: string;
}
