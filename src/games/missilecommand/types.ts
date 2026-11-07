export interface City {
  id: number;
  x: number;
  y: number;
  alive: boolean;
}

export interface Silo {
  id: number;
  x: number;
  y: number;
  missiles: number;
  maxMissiles: number;
  alive: boolean;
  label: 'ALPHA' | 'DELTA' | 'OMEGA';
}

export interface IncomingICBM {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  isMirv: boolean;
  hasMirved: boolean;
  color: string;
}

export interface PlayerABM {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  reached: boolean;
}

export interface ExplosionCloud {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  growing: boolean;
  life: number;
  maxLife: number;
  color: string;
  source: 'player' | 'icbm';
}

export interface EnemyAircraft {
  id: number;
  x: number;
  y: number;
  vx: number;
  type: 'bomber' | 'satellite';
  dropTimer: number;
  points: number;
  alive: boolean;
}

export interface MissileCommandHighScore {
  initials: string;
  score: number;
  wave: number;
  date: string;
}
