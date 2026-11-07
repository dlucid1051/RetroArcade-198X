export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface WireframeMesh {
  vertices: Point3D[];
  edges: [number, number][]; // Index pairs representing lines
}

export type EnemyType = 'tank' | 'supertank' | 'missile' | 'saucer';

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  z: number;
  y: number; // altitude (missiles descend, saucers hover)
  angle: number; // heading in radians
  speed: number;
  fireCooldown: number;
  health: number;
  scoreValue: number;
  alertState: 'patrol' | 'chase' | 'aiming';
  turnRate: number;
}

export interface Obstacle {
  x: number;
  z: number;
  type: 'pyramid' | 'cube';
  size: number;
  radius: number;
}

export interface Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  isEnemy: boolean;
}

export interface Debris3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  len: number;
}

export interface BattlezoneHighScore {
  initials: string;
  score: number;
  kills: number;
  date: string;
}
