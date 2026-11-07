import React, { useEffect, useRef, useState, useCallback } from 'react';
import { retroAudio } from '../../audio/retroAudio';
import { ArcadeControlsState } from '../../input/useArcadeInput';
import {
  Point3D,
  WireframeMesh,
  Enemy,
  Obstacle,
  Projectile,
  Debris3D,
  BattlezoneHighScore,
} from './types';
import {
  Trophy,
  Sparkles,
  Volume2,
  VolumeX,
  Crosshair,
  Shield,
  Play,
  RotateCcw,
} from 'lucide-react';

interface BattlezoneGameProps {
  controlsRef: React.MutableRefObject<ArcadeControlsState>;
  onBackToArcade?: () => void;
  credits: number;
  onUseCredit: () => boolean;
  scanlines: boolean;
  hasGamepad: boolean;
}

const DEFAULT_BATTLEZONE_SCORES: BattlezoneHighScore[] = [
  { initials: 'GEN', score: 28000, kills: 14, date: '1980' },
  { initials: 'DAL', score: 18000, kills: 9, date: '1982' },
  { initials: 'TNK', score: 12000, kills: 6, date: '1981' },
  { initials: 'COM', score: 7000, kills: 4, date: '1983' },
  { initials: 'VEC', score: 3000, kills: 2, date: '1980' },
];

export const BattlezoneGame: React.FC<BattlezoneGameProps> = ({
  controlsRef,
  onBackToArcade,
  credits,
  onUseCredit,
  scanlines,
  hasGamepad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [highScores, setHighScores] = useState<BattlezoneHighScore[]>(() => {
    try {
      const saved = localStorage.getItem('retro_arcade_battlezone_scores');
      return saved ? JSON.parse(saved) : DEFAULT_BATTLEZONE_SCORES;
    } catch {
      return DEFAULT_BATTLEZONE_SCORES;
    }
  });

  const [gameState, setGameState] = useState<'attract' | 'playing' | 'gameover' | 'new_high_score'>('attract');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [kills, setKills] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(() => retroAudio.getMuted());
  const [targetLock, setTargetLock] = useState(false);
  const [radarWarning, setRadarWarning] = useState<string | null>(null);

  // Initials entry state
  const [initials, setInitials] = useState(['A', 'A', 'A']);
  const [initialIndex, setInitialIndex] = useState(0);

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const highScoresRef = useRef(highScores);
  useEffect(() => {
    highScoresRef.current = highScores;
  }, [highScores]);

  // 3D Game World Engine State
  const engine = useRef({
    status: 'attract' as 'attract' | 'playing' | 'gameover' | 'new_high_score',
    score: 0,
    lives: 3,
    kills: 0,
    playerX: 0,
    playerZ: 0,
    playerAngle: 0, // Heading in radians (0 = looking along +Z)
    playerSpeed: 0,
    playerInvuln: 0,
    cannonCooldown: 0,
    nextExtraLife: 15000,
    treadSoundTimer: 0,
    radarAngle: 0,
    lastRadarPing: 0,
    enemies: [] as Enemy[],
    obstacles: [] as Obstacle[],
    projectiles: [] as Projectile[],
    debris: [] as Debris3D[],
    volcanoSmoke: [] as { x: number; y: number; z: number; r: number; life: number }[],
    enemySpawnTimer: 0,
    screenW: 800,
    screenH: 600,
  });

  // Generate fixed battlefield obstacles
  const generateObstacles = (): Obstacle[] => {
    const list: Obstacle[] = [];
    // Place 24 geometric obstacles scattered on the field
    const positions = [
      [-60, 80], [70, 90], [-110, 160], [100, 180], [-40, 220], [50, 240],
      [-130, -70], [120, -90], [-80, -160], [90, -180], [-150, 40], [140, 30],
      [-30, 140], [40, 130], [-170, 220], [160, 210], [-90, 300], [80, 290],
      [0, 190], [0, -120], [-50, -40], [60, -50], [-120, 100], [110, 120]
    ];

    positions.forEach(([x, z], i) => {
      const type = i % 2 === 0 ? 'pyramid' : 'cube';
      const size = type === 'pyramid' ? 12 : 10;
      list.push({
        x,
        z,
        type,
        size,
        radius: size * 1.2,
      });
    });
    return list;
  };

  // 3D Wireframe Meshes Definitions
  const TANK_MESH: WireframeMesh = {
    vertices: [
      // Hull bottom
      { x: -7, y: -1.2, z: -8 }, { x: 7, y: -1.2, z: -8 },
      { x: 7, y: -1.2, z: 8 }, { x: -7, y: -1.2, z: 8 },
      // Hull top
      { x: -5.5, y: 1.2, z: -6 }, { x: 5.5, y: 1.2, z: -6 },
      { x: 5.5, y: 1.2, z: 6 }, { x: -5.5, y: 1.2, z: 6 },
      // Turret top
      { x: -3, y: 3.2, z: -2 }, { x: 3, y: 3.2, z: -2 },
      { x: 3, y: 3.2, z: 3 }, { x: -3, y: 3.2, z: 3 },
      // Cannon tip
      { x: 0, y: 2.4, z: 12 },
    ],
    edges: [
      // Bottom hull
      [0, 1], [1, 2], [2, 3], [3, 0],
      // Top hull
      [4, 5], [5, 6], [6, 7], [7, 4],
      // Vertical pillars
      [0, 4], [1, 5], [2, 6], [3, 7],
      // Turret
      [8, 9], [9, 10], [10, 11], [11, 8],
      // Turret to hull
      [4, 8], [5, 9], [6, 10], [7, 11],
      // Cannon barrel
      [10, 12], [11, 12],
    ],
  };

  const SUPERTANK_MESH: WireframeMesh = {
    vertices: [
      // Wedge lower
      { x: -8, y: -1.2, z: -7 }, { x: 8, y: -1.2, z: -7 },
      { x: 0, y: -1.2, z: 10 },
      // Wedge upper
      { x: -5, y: 2.2, z: -5 }, { x: 5, y: 2.2, z: -5 },
      { x: 0, y: 2.2, z: 6 },
      // Elevated spire
      { x: 0, y: 4.8, z: -1 },
      // Twin cannons
      { x: -2.5, y: 1.8, z: 14 },
      { x: 2.5, y: 1.8, z: 14 },
    ],
    edges: [
      [0, 1], [1, 2], [2, 0],
      [3, 4], [4, 5], [5, 3],
      [0, 3], [1, 4], [2, 5],
      [3, 6], [4, 6], [5, 6],
      [5, 7], [5, 8],
    ],
  };

  const MISSILE_MESH: WireframeMesh = {
    vertices: [
      { x: 0, y: 0, z: 8 }, // Nose tip
      { x: -1.5, y: 0, z: -5 }, { x: 1.5, y: 0, z: -5 },
      { x: 0, y: 1.5, z: -5 }, { x: 0, y: -1.5, z: -5 },
      // Tail fins
      { x: -3.5, y: 0, z: -7 }, { x: 3.5, y: 0, z: -7 },
      { x: 0, y: 3.5, z: -7 }, { x: 0, y: -3.5, z: -7 },
    ],
    edges: [
      [0, 1], [0, 2], [0, 3], [0, 4],
      [1, 2], [2, 3], [3, 4], [4, 1],
      [1, 5], [2, 6], [3, 7], [4, 8],
    ],
  };

  const SAUCER_MESH: WireframeMesh = {
    vertices: [
      // Outer ring (8 points)
      { x: -9, y: 0, z: 0 }, { x: -6.4, y: 0, z: 6.4 },
      { x: 0, y: 0, z: 9 }, { x: 6.4, y: 0, z: 6.4 },
      { x: 9, y: 0, z: 0 }, { x: 6.4, y: 0, z: -6.4 },
      { x: 0, y: 0, z: -9 }, { x: -6.4, y: 0, z: -6.4 },
      // Upper dome
      { x: -4, y: 2.5, z: 0 }, { x: 0, y: 2.5, z: 4 },
      { x: 4, y: 2.5, z: 0 }, { x: 0, y: 2.5, z: -4 },
      { x: 0, y: 4.5, z: 0 },
      // Lower rim
      { x: 0, y: -2, z: 0 },
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
      [8, 9], [9, 10], [10, 11], [11, 8],
      [0, 8], [2, 9], [4, 10], [6, 11],
      [8, 12], [9, 12], [10, 12], [11, 12],
      [0, 13], [2, 13], [4, 13], [6, 13],
    ],
  };

  // Spawn an enemy
  const spawnEnemy = (type?: 'tank' | 'supertank' | 'missile' | 'saucer') => {
    const k = engine.current.kills;
    const pickedType: 'tank' | 'supertank' | 'missile' | 'saucer' =
      type ||
      (Math.random() < 0.15 && k >= 2
        ? 'saucer'
        : Math.random() < 0.25 && k >= 4
        ? 'missile'
        : Math.random() < 0.35 && k >= 2
        ? 'supertank'
        : 'tank');

    const spawnDist = pickedType === 'missile' ? 240 : 180 + Math.random() * 80;
    const spawnAngle = Math.random() * Math.PI * 2;
    const x = engine.current.playerX + Math.sin(spawnAngle) * spawnDist;
    const z = engine.current.playerZ + Math.cos(spawnAngle) * spawnDist;

    let speed = 22;
    let scoreValue = 1000;
    let y = -1.2;

    if (pickedType === 'supertank') {
      speed = 38;
      scoreValue = 3000;
    } else if (pickedType === 'missile') {
      speed = 65;
      scoreValue = 2000;
      y = 28; // Drops from sky
    } else if (pickedType === 'saucer') {
      speed = 28;
      scoreValue = 5000;
      y = 14;
    }

    engine.current.enemies.push({
      id: Math.random(),
      type: pickedType,
      x,
      z,
      y,
      angle: Math.random() * Math.PI * 2,
      speed,
      fireCooldown: 2.5 + Math.random() * 2,
      health: 1,
      scoreValue,
      alertState: 'patrol',
      turnRate: pickedType === 'supertank' ? 1.8 : 1.1,
    });
  };

  // Start Battlezone Game
  const startGame = useCallback(() => {
    if (credits <= 0) {
      retroAudio.insertCoin();
    } else {
      onUseCredit();
    }

    engine.current.status = 'playing';
    engine.current.score = 0;
    engine.current.lives = 3;
    engine.current.kills = 0;
    engine.current.playerX = 0;
    engine.current.playerZ = 0;
    engine.current.playerAngle = 0;
    engine.current.playerSpeed = 0;
    engine.current.playerInvuln = 2.5;
    engine.current.cannonCooldown = 0;
    engine.current.enemies = [];
    engine.current.obstacles = generateObstacles();
    engine.current.projectiles = [];
    engine.current.debris = [];
    engine.current.enemySpawnTimer = 0;
    engine.current.volcanoSmoke = [];

    // Spawn first enemy tank
    spawnEnemy('tank');

    setScore(0);
    setLives(3);
    setKills(0);
    setGameState('playing');
    setIsPaused(false);
    retroAudio.extraLife();
  }, [credits, onUseCredit]);

  // Player destruction
  const killPlayer = () => {
    retroAudio.explosion('large');
    engine.current.playerInvuln = 3.0;

    // Spawn 3D debris around player cockpit
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 15 + Math.random() * 25;
      engine.current.debris.push({
        x: engine.current.playerX,
        y: 0,
        z: engine.current.playerZ,
        vx: Math.cos(a) * s,
        vy: 10 + Math.random() * 20,
        vz: Math.sin(a) * s,
        life: 0.8 + Math.random() * 0.6,
        maxLife: 1.4,
        len: 8 + Math.random() * 8,
      });
    }

    const nextLives = engine.current.lives - 1;
    engine.current.lives = nextLives;
    setLives(nextLives);

    if (nextLives <= 0) {
      retroAudio.gameOver();
      const finalScore = engine.current.score;
      const currentHighs = highScoresRef.current;
      const isTopScore =
        finalScore > 0 &&
        (currentHighs.length < 5 || finalScore > currentHighs[currentHighs.length - 1].score);

      if (isTopScore) {
        engine.current.status = 'new_high_score';
        setGameState('new_high_score');
      } else {
        engine.current.status = 'gameover';
        setGameState('gameover');
      }
    }
  };

  // Submit high score
  const saveHighScore = () => {
    const initialsStr = initials.join('');
    const newEntry: BattlezoneHighScore = {
      initials: initialsStr,
      score,
      kills,
      date: new Date().getFullYear().toString(),
    };

    const updated = [...highScores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setHighScores(updated);
    try {
      localStorage.setItem('retro_arcade_battlezone_scores', JSON.stringify(updated));
    } catch {
      // ignore
    }

    setGameState('attract');
    engine.current.status = 'attract';
    retroAudio.buttonClick();
  };

  // Key controls for initials screen & space/enter to start
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState === 'attract') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startGame();
        }
      } else if (gameState === 'new_high_score') {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!.-';
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setInitials(prev => {
            const next = [...prev];
            const currIdx = letters.indexOf(next[initialIndex]);
            next[initialIndex] = letters[(currIdx + 1) % letters.length];
            return next;
          });
          retroAudio.buttonClick();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setInitials(prev => {
            const next = [...prev];
            const currIdx = letters.indexOf(next[initialIndex]);
            next[initialIndex] = letters[(currIdx - 1 + letters.length) % letters.length];
            return next;
          });
          retroAudio.buttonClick();
        } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (initialIndex < 2) {
            setInitialIndex(prev => prev + 1);
            retroAudio.buttonClick();
          } else {
            saveHighScore();
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (initialIndex > 0) {
            setInitialIndex(prev => prev - 1);
            retroAudio.buttonClick();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, initialIndex, initials, score, kills, highScores, startGame]);

  // Main 3D Vector Engine Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = rect.width > 0 ? rect.width : 800;
      const height = rect.height > 0 ? rect.height : 600;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      engine.current.screenW = width;
      engine.current.screenH = height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initial obstacles
    if (engine.current.obstacles.length === 0) {
      engine.current.obstacles = generateObstacles();
    }

    // 3D Perspective Projection Function
    const projectPoint = (
      wx: number,
      wy: number,
      wz: number,
      px: number,
      pz: number,
      pa: number,
      sw: number,
      sh: number
    ): { sx: number; sy: number; cz: number } | null => {
      const dx = wx - px;
      const dz = wz - pz;

      // Rotate by negative player heading
      const sinA = Math.sin(-pa);
      const cosA = Math.cos(-pa);
      const cx = dx * cosA - dz * sinA;
      const cz = dx * sinA + dz * cosA;
      const cy = wy; // Eye altitude is Y=0

      // Near plane clipping
      if (cz <= 3.5) return null;

      const focal = sh * 1.1; // Field of view
      const sx = sw / 2 + (cx / cz) * focal;
      const sy = sh / 2 - (cy / cz) * focal;

      return { sx, sy, cz };
    };

    // Render wireframe mesh helper
    const drawMesh = (
      mesh: WireframeMesh,
      mx: number,
      my: number,
      mz: number,
      mAngle: number,
      px: number,
      pz: number,
      pa: number,
      sw: number,
      sh: number,
      color = '#22c55e'
    ) => {
      const sinM = Math.sin(mAngle);
      const cosM = Math.cos(mAngle);

      // Transform and project all vertices
      const projVerts: ({ sx: number; sy: number; cz: number } | null)[] = [];
      for (const v of mesh.vertices) {
        // Rotate local model vertex by model angle
        const rx = v.x * cosM - v.z * sinM;
        const rz = v.x * sinM + v.z * cosM;
        const ry = v.y;

        const p = projectPoint(mx + rx, my + ry, mz + rz, px, pz, pa, sw, sh);
        projVerts.push(p);
      }

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();

      for (const [i1, i2] of mesh.edges) {
        const p1 = projVerts[i1];
        const p2 = projVerts[i2];
        if (p1 && p2) {
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const sw = Math.max(engine.current.screenW || 0, 800);
      const sh = Math.max(engine.current.screenH || 0, 600);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const paused = isPausedRef.current;
      const state = engine.current;

      ctx.save();
      ctx.scale(dpr, dpr);
      // Clear viewport
      ctx.fillStyle = '#030805';
      ctx.fillRect(0, 0, sw, sh);

      // --- 1. HORIZON & VOLCANIC MOUNTAIN RANGE (Scrolls with player heading) ---
      const horizonY = sh / 2;
      ctx.save();
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(34, 197, 94, 0.4)';
      ctx.shadowBlur = 6;

      // Horizon line
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(sw, horizonY);
      ctx.stroke();

      // Distant 360-degree mountain silhouette
      const mountainSegments = 24;
      const fovRad = Math.PI * 0.75;
      const pxPerRad = sw / fovRad;

      ctx.beginPath();
      for (let i = -2; i <= mountainSegments + 2; i++) {
        const segAngle = (i / mountainSegments) * Math.PI * 2;
        let diff = segAngle - state.playerAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const screenX = sw / 2 + diff * pxPerRad;
        // Peak height variation (including active volcano at angle ~1.0)
        let peakH = 14 + Math.sin(i * 3.5) * 8;
        if (i === 4) peakH = 34; // Volcano peak

        const screenY = horizonY - peakH;
        if (i === -2) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);

        // Volcano crater notch
        if (i === 4) {
          ctx.lineTo(screenX + 10, screenY + 6);
          ctx.lineTo(screenX + 20, screenY);
        }
      }
      ctx.stroke();

      // Ground perspective grid ticks
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (let d = 20; d <= 220; d += 25) {
        const gy = horizonY + (sh * 0.45 * (10 / d));
        ctx.moveTo(0, gy);
        ctx.lineTo(sw, gy);
      }
      ctx.stroke();
      ctx.restore();

      // --- 2. PLAYER INPUT & TANK SIMULATION ---
      const controls = controlsRef.current;
      if (!paused && state.status === 'playing') {
        const turnSpeed = 1.8;
        if (controls.rotateLeft) state.playerAngle -= turnSpeed * dt;
        if (controls.rotateRight) state.playerAngle += turnSpeed * dt;

        let targetSpeed = 0;
        if (controls.thrust) targetSpeed = 35; // Forward
        else if (controls.hyperspace) targetSpeed = -18; // Reverse

        state.playerSpeed += (targetSpeed - state.playerSpeed) * 8 * dt;

        // Tread rumble audio
        if (Math.abs(state.playerSpeed) > 3) {
          state.treadSoundTimer += dt;
          if (state.treadSoundTimer > 0.12) {
            state.treadSoundTimer = 0;
            retroAudio.battlezoneTread();
          }
        }

        // Potential next player position
        const nextX = state.playerX + Math.sin(state.playerAngle) * state.playerSpeed * dt;
        const nextZ = state.playerZ + Math.cos(state.playerAngle) * state.playerSpeed * dt;

        // Obstacle collision check for player tank
        let playerBlocked = false;
        for (const obs of state.obstacles) {
          if (Math.hypot(nextX - obs.x, nextZ - obs.z) < obs.radius + 8) {
            playerBlocked = true;
            break;
          }
        }

        // Battlefield boundary clamp (radius 400)
        if (Math.hypot(nextX, nextZ) > 390) playerBlocked = true;

        if (!playerBlocked) {
          state.playerX = nextX;
          state.playerZ = nextZ;
        }

        // Invulnerability countdown
        if (state.playerInvuln > 0) state.playerInvuln -= dt;

        // Player Cannon Firing
        state.cannonCooldown -= dt;
        if (controls.fire && state.cannonCooldown <= 0) {
          // Check active player shells (max 1 shell at a time, authentic Battlezone rule)
          if (state.projectiles.filter(p => !p.isEnemy).length === 0) {
            state.cannonCooldown = 1.3;
            const shellSpeed = 160;
            state.projectiles.push({
              x: state.playerX + Math.sin(state.playerAngle) * 5,
              y: 0,
              z: state.playerZ + Math.cos(state.playerAngle) * 5,
              vx: Math.sin(state.playerAngle) * shellSpeed,
              vy: 0,
              vz: Math.cos(state.playerAngle) * shellSpeed,
              life: 2.2,
              isEnemy: false,
            });
            retroAudio.battlezoneCannon();
          }
        }
      }

      // --- 3. OBSTACLES 3D RENDERING ---
      for (const obs of state.obstacles) {
        if (obs.type === 'pyramid') {
          const s = obs.size;
          const pyramidMesh: WireframeMesh = {
            vertices: [
              { x: -s, y: -1.2, z: -s },
              { x: s, y: -1.2, z: -s },
              { x: s, y: -1.2, z: s },
              { x: -s, y: -1.2, z: s },
              { x: 0, y: s * 1.5, z: 0 }, // Apex
            ],
            edges: [
              [0, 1], [1, 2], [2, 3], [3, 0],
              [0, 4], [1, 4], [2, 4], [3, 4],
            ],
          };
          drawMesh(
            pyramidMesh,
            obs.x,
            0,
            obs.z,
            0,
            state.playerX,
            state.playerZ,
            state.playerAngle,
            sw,
            sh,
            '#22c55e'
          );
        } else {
          // Cube obstacle
          const s = obs.size;
          const cubeMesh: WireframeMesh = {
            vertices: [
              { x: -s, y: -1.2, z: -s }, { x: s, y: -1.2, z: -s },
              { x: s, y: -1.2, z: s }, { x: -s, y: -1.2, z: s },
              { x: -s, y: s * 1.4, z: -s }, { x: s, y: s * 1.4, z: -s },
              { x: s, y: s * 1.4, z: s }, { x: -s, y: s * 1.4, z: s },
            ],
            edges: [
              [0, 1], [1, 2], [2, 3], [3, 0],
              [4, 5], [5, 6], [6, 7], [7, 4],
              [0, 4], [1, 5], [2, 6], [3, 7],
            ],
          };
          drawMesh(
            cubeMesh,
            obs.x,
            0,
            obs.z,
            0,
            state.playerX,
            state.playerZ,
            state.playerAngle,
            sw,
            sh,
            '#22c55e'
          );
        }
      }

      // --- 4. ENEMIES AI & RENDERING ---
      let hasTargetInCrosshair = false;
      const activeEnemies: Enemy[] = [];

      // Spawning loop
      if (!paused && state.status === 'playing') {
        state.enemySpawnTimer += dt;
        if (state.enemies.length === 0 || (state.enemies.length < 2 && state.enemySpawnTimer > 8)) {
          state.enemySpawnTimer = 0;
          spawnEnemy();
        }
      }

      for (const enemy of state.enemies) {
        if (!paused && state.status === 'playing') {
          const dx = state.playerX - enemy.x;
          const dz = state.playerZ - enemy.z;
          const distToPlayer = Math.hypot(dx, dz);
          const targetAngle = Math.atan2(dx, dz);

          if (enemy.type === 'missile') {
            // Missile dives directly towards player at high speed
            enemy.angle = targetAngle;
            enemy.x += Math.sin(enemy.angle) * enemy.speed * dt;
            enemy.z += Math.cos(enemy.angle) * enemy.speed * dt;
            enemy.y -= 7.5 * dt;

            // Dive impact
            if (distToPlayer < 10 && enemy.y <= 0) {
              enemy.health = 0;
              if (state.playerInvuln <= 0) killPlayer();
            }
          } else if (enemy.type === 'saucer') {
            // Harmless flying saucer drifts across horizon
            enemy.x += Math.sin(enemy.angle) * enemy.speed * dt;
            enemy.z += Math.cos(enemy.angle) * enemy.speed * dt;
          } else {
            // Tanks (Standard & Super)
            let diff = targetAngle - enemy.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            enemy.angle += Math.sign(diff) * Math.min(Math.abs(diff), enemy.turnRate * dt);

            // Move forward if facing somewhat towards player and not too close
            if (distToPlayer > 35) {
              enemy.x += Math.sin(enemy.angle) * enemy.speed * dt;
              enemy.z += Math.cos(enemy.angle) * enemy.speed * dt;
            }

            // Shooting logic
            enemy.fireCooldown -= dt;
            if (enemy.fireCooldown <= 0 && distToPlayer < 220 && Math.abs(diff) < 0.28) {
              enemy.fireCooldown = enemy.type === 'supertank' ? 2.2 : 3.8;
              const shellSpeed = 120;
              state.projectiles.push({
                x: enemy.x + Math.sin(enemy.angle) * 8,
                y: 1.2,
                z: enemy.z + Math.cos(enemy.angle) * 8,
                vx: Math.sin(enemy.angle) * shellSpeed,
                vy: 0,
                vz: Math.cos(enemy.angle) * shellSpeed,
                life: 2.5,
                isEnemy: true,
              });
              retroAudio.battlezoneEnemyShot();
            }
          }
        }

        // Draw 3D Enemy Mesh
        let mesh = TANK_MESH;
        let color = '#22c55e';
        if (enemy.type === 'supertank') {
          mesh = SUPERTANK_MESH;
          color = '#f59e0b'; // Amber / Orange super-tank
        } else if (enemy.type === 'missile') {
          mesh = MISSILE_MESH;
          color = '#ef4444'; // Red dive missile
        } else if (enemy.type === 'saucer') {
          mesh = SAUCER_MESH;
          color = '#ec4899'; // Pink saucer
        }

        drawMesh(
          mesh,
          enemy.x,
          enemy.y,
          enemy.z,
          enemy.angle,
          state.playerX,
          state.playerZ,
          state.playerAngle,
          sw,
          sh,
          color
        );

        // Check if enemy is directly in crosshair reticle
        const p = projectPoint(
          enemy.x,
          enemy.y,
          enemy.z,
          state.playerX,
          state.playerZ,
          state.playerAngle,
          sw,
          sh
        );
        if (p && Math.abs(p.sx - sw / 2) < 35 && Math.abs(p.sy - sh / 2) < 35) {
          hasTargetInCrosshair = true;
        }

        if (enemy.health > 0) activeEnemies.push(enemy);
      }
      state.enemies = activeEnemies;
      setTargetLock(hasTargetInCrosshair);

      // --- 5. PROJECTILES (Player & Enemy Shells) ---
      const activeProjectiles: Projectile[] = [];
      for (const proj of state.projectiles) {
        if (!paused) {
          proj.x += proj.vx * dt;
          proj.y += proj.vy * dt;
          proj.z += proj.vz * dt;
          proj.life -= dt;
        }

        let hit = false;

        // Check obstacle collision
        for (const obs of state.obstacles) {
          if (Math.hypot(proj.x - obs.x, proj.z - obs.z) < obs.radius) {
            hit = true;
            retroAudio.battlezoneRicochet();
            // Debris burst
            for (let i = 0; i < 6; i++) {
              state.debris.push({
                x: proj.x, y: proj.y, z: proj.z,
                vx: (Math.random() - 0.5) * 30,
                vy: 5 + Math.random() * 20,
                vz: (Math.random() - 0.5) * 30,
                life: 0.4, maxLife: 0.4, len: 4,
              });
            }
            break;
          }
        }

        // Check player shell vs Enemy
        if (!proj.isEnemy && !hit) {
          for (const enemy of state.enemies) {
            const hitDist = enemy.type === 'saucer' ? 12 : 9;
            if (Math.hypot(proj.x - enemy.x, proj.z - enemy.z) < hitDist) {
              hit = true;
              enemy.health = 0;
              retroAudio.explosion('large');

              // Shatter enemy wireframe
              for (let i = 0; i < 18; i++) {
                state.debris.push({
                  x: enemy.x, y: enemy.y, z: enemy.z,
                  vx: (Math.random() - 0.5) * 45,
                  vy: 10 + Math.random() * 30,
                  vz: (Math.random() - 0.5) * 45,
                  life: 0.6 + Math.random() * 0.4,
                  maxLife: 1.0,
                  len: 6 + Math.random() * 8,
                });
              }

              const points = enemy.scoreValue;
              const newScore = state.score + points;
              state.score = newScore;
              state.kills += 1;
              setScore(newScore);
              setKills(state.kills);

              if (newScore >= state.nextExtraLife) {
                state.lives += 1;
                state.nextExtraLife += 15000;
                setLives(state.lives);
                retroAudio.extraLife();
              }
              break;
            }
          }
        }

        // Check enemy shell vs Player
        if (proj.isEnemy && !hit) {
          if (Math.hypot(proj.x - state.playerX, proj.z - state.playerZ) < 8) {
            hit = true;
            if (state.playerInvuln <= 0) killPlayer();
          }
        }

        if (!hit && proj.life > 0) {
          activeProjectiles.push(proj);

          // Project shell to screen
          const p = projectPoint(
            proj.x,
            proj.y,
            proj.z,
            state.playerX,
            state.playerZ,
            state.playerAngle,
            sw,
            sh
          );
          if (p) {
            const size = Math.max(2, (sh / p.cz) * 0.4);
            ctx.save();
            ctx.fillStyle = proj.isEnemy ? '#ef4444' : '#22c55e';
            ctx.shadowColor = proj.isEnemy ? '#ef4444' : '#22c55e';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
      state.projectiles = activeProjectiles;

      // --- 6. 3D DEBRIS PARTICLES ---
      const activeDebris: Debris3D[] = [];
      for (const d of state.debris) {
        if (!paused) {
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.z += d.vz * dt;
          d.vy -= 40 * dt; // Gravity
          d.life -= dt;
        }

        if (d.life > 0) {
          activeDebris.push(d);
          const p = projectPoint(d.x, d.y, d.z, state.playerX, state.playerZ, state.playerAngle, sw, sh);
          if (p) {
            ctx.save();
            ctx.strokeStyle = '#22c55e';
            ctx.globalAlpha = d.life / d.maxLife;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p.sx - 3, p.sy - 3);
            ctx.lineTo(p.sx + 3, p.sy + 3);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      state.debris = activeDebris;

      // --- 7. AUTHENTIC RETRO PERISCOPE & RADAR HUD OVERLAY ---
      ctx.save();

      // Binocular Periscope Bezel
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2.0;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;

      // Center crosshairs
      const cx = sw / 2;
      const cy = sh / 2;
      const chSize = 22;

      ctx.beginPath();
      // Reticle
      ctx.moveTo(cx - chSize, cy); ctx.lineTo(cx - 6, cy);
      ctx.moveTo(cx + 6, cy); ctx.lineTo(cx + chSize, cy);
      ctx.moveTo(cx, cy - chSize); ctx.lineTo(cx, cy - 6);
      ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy + chSize);
      ctx.stroke();

      // Center target lock box
      if (hasTargetInCrosshair) {
        ctx.strokeStyle = '#eab308';
        ctx.strokeRect(cx - 18, cy - 18, 36, 36);
      }

      // --- TOP CIRCULAR RADAR SCOPE ---
      const radarX = sw / 2;
      const radarY = 48;
      const radarR = 34;

      // Radar outer ring
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(radarX, radarY, radarR, 0, Math.PI * 2);
      ctx.stroke();

      // Radar inner range ring
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(radarX, radarY, radarR * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotating radar sweep beam
      state.radarAngle += 3.2 * dt;
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)';
      ctx.beginPath();
      ctx.moveTo(radarX, radarY);
      ctx.lineTo(
        radarX + Math.cos(state.radarAngle) * radarR,
        radarY + Math.sin(state.radarAngle) * radarR
      );
      ctx.stroke();

      // Radar ping audio periodic trigger
      if (currentTime - state.lastRadarPing > 1950 && state.status === 'playing') {
        state.lastRadarPing = currentTime;
        retroAudio.battlezoneRadarPing();
      }

      // Player dot on radar center
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(radarX, radarY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Plot enemies and obstacles on radar (relative to player heading)
      let enemyBehind = false;
      const maxRadarDist = 280;

      for (const enemy of state.enemies) {
        const dx = enemy.x - state.playerX;
        const dz = enemy.z - state.playerZ;

        // Rotate into player local coordinates
        const rx = dx * Math.cos(-state.playerAngle) - dz * Math.sin(-state.playerAngle);
        const rz = dx * Math.sin(-state.playerAngle) + dz * Math.cos(-state.playerAngle);

        const rDist = Math.hypot(rx, rz);
        if (rDist < maxRadarDist) {
          const plotDist = (rDist / maxRadarDist) * radarR;
          const plotAngle = Math.atan2(rx, rz) - Math.PI / 2; // Up is forward
          const px = radarX + Math.cos(plotAngle) * plotDist;
          const py = radarY + Math.sin(plotAngle) * plotDist;

          ctx.fillStyle = enemy.type === 'supertank' ? '#f59e0b' : enemy.type === 'missile' ? '#ef4444' : '#22c55e';
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();

          if (rz < -15 && rDist < 120) enemyBehind = true;
        }
      }
      setRadarWarning(enemyBehind ? 'ENEMY BEHIND' : null);

      ctx.restore();
      ctx.restore();

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Touch control handlers
  const handleTouchDown = (action: keyof ArcadeControlsState) => {
    controlsRef.current[action] = true;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(15); } catch {}
    }
  };

  const handleTouchUp = (action: keyof ArcadeControlsState) => {
    controlsRef.current[action] = false;
  };

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-[#030508]">
      {/* Top HUD Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 bg-[#040806] border-b border-emerald-900/50 text-xs font-arcade tracking-wider z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">SCORE</span>
            <span className="text-emerald-400 font-bold text-sm tracking-widest">
              {score.toString().padStart(6, '0')}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">HIGH SCORE</span>
            <span className="text-amber-400 font-bold text-sm tracking-widest">
              {(highScores[0]?.score || 0).toString().padStart(6, '0')}
            </span>
          </div>

          {gameState === 'playing' && (
            <div className="hidden sm:flex flex-col">
              <span className="text-[9px] text-gray-500">TANKS DESTROYED</span>
              <span className="text-emerald-300 font-bold text-sm">#{kills}</span>
            </div>
          )}
        </div>

        {/* Lives Counter as mini 3D Tank icons */}
        <div className="flex items-center gap-3">
          {gameState === 'playing' && (
            <div className="flex items-center gap-1.5 mr-2">
              {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                <div key={i} className="w-5 h-4 border border-emerald-400 rounded-sm bg-emerald-950/60 flex items-center justify-center">
                  <div className="w-2.5 h-1.5 bg-emerald-400"></div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              const nextMute = retroAudio.toggleMute();
              setIsMuted(nextMute);
            }}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {gameState === 'playing' && (
            <button
              onClick={() => setIsPaused(p => !p)}
              className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-200 cursor-pointer"
            >
              {isPaused ? 'RESUME' : 'PAUSE'}
            </button>
          )}

          {onBackToArcade && (
            <button
              onClick={onBackToArcade}
              className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-[10px] text-emerald-300 cursor-pointer"
            >
              CABINET ROW
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Viewport */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center p-1 sm:p-3">
        <div className={`relative w-full h-full max-w-[1020px] max-h-[760px] rounded-lg overflow-hidden arcade-bezel ${scanlines ? 'crt-overlay crt-vignette' : ''}`}>
          <canvas
            ref={canvasRef}
            onClick={() => {
              if (gameState === 'attract') startGame();
            }}
            className="w-full h-full block bg-[#030805] cursor-crosshair"
          />

          {/* HUD Status Alerts */}
          {gameState === 'playing' && (
            <div className="absolute top-3 left-4 pointer-events-none flex flex-col gap-1 z-20">
              {targetLock && (
                <div className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500 text-[10px] font-arcade text-amber-300 animate-pulse">
                  TARGET LOCKED
                </div>
              )}
              {radarWarning && (
                <div className="px-2.5 py-1 rounded bg-red-950/80 border border-red-500 text-[10px] font-arcade text-red-400 animate-bounce">
                  WARNING: {radarWarning}
                </div>
              )}
            </div>
          )}

          {/* OVERLAY: Attract Mode Screen */}
          {gameState === 'attract' && (
            <div
              onClick={startGame}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-[2px] p-4 text-center z-30 cursor-pointer"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="max-w-md w-full p-6 rounded-xl border border-emerald-500/60 bg-[#040a06]/95 shadow-[0_0_35px_rgba(16,185,129,0.4)]"
              >
                <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-400/50 text-[10px] font-arcade text-emerald-300">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>ATARI 1980 3D WIREFRAME SIMULATION</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-arcade text-emerald-400 font-extrabold tracking-widest crt-glow mb-2">
                  BATTLEZONE
                </h1>
                <p className="text-xs text-gray-400 font-mono mb-5">
                  FIRST-PERSON VECTOR TANK COMBAT & RADAR
                </p>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-arcade text-left bg-black/60 p-3 rounded-lg border border-gray-800 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-sm"></span>
                    <span className="text-gray-300">TANK: 1000 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></span>
                    <span className="text-amber-300">SUPER TANK: 3000</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-sm"></span>
                    <span className="text-red-300">MISSILE: 2000 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-pink-500 rounded-sm"></span>
                    <span className="text-pink-300">SAUCER: 5000 PTS</span>
                  </div>
                </div>

                {/* Launch Button */}
                <div className="space-y-2.5">
                  <button
                    onClick={startGame}
                    className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white font-arcade text-sm font-bold tracking-widest shadow-[0_0_25px_rgba(16,185,129,0.8)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>PRESS TO ENGAGE (1 CREDIT)</span>
                  </button>

                  <div className="text-[10px] font-arcade text-amber-300 flex items-center justify-center gap-3">
                    <span>CREDITS: {credits.toString().padStart(2, '0')}</span>
                    <span>•</span>
                    <span className="text-gray-400">OR PRESS [SPACE] / [ENTER]</span>
                  </div>
                </div>

                {/* Controls Cheat Sheet */}
                <div className="mt-4 pt-3 border-t border-gray-800 text-[9px] font-mono text-gray-400 flex flex-wrap justify-center gap-3">
                  <span>[←/→] STEER</span>
                  <span>[↑] DRIVE FWD</span>
                  <span>[↓] REVERSE</span>
                  <span>[SPACE] FIRE CANNON</span>
                </div>
              </div>
            </div>
          )}

          {/* OVERLAY: Game Over */}
          {gameState === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border-2 border-red-500/60 bg-[#0c0608]/95 shadow-[0_0_35px_rgba(239,68,68,0.5)]">
                <h2 className="text-2xl sm:text-3xl font-arcade text-red-500 font-bold tracking-widest mb-2 crt-glow">
                  PERISCOPE BREACHED
                </h2>
                <div className="text-sm font-arcade text-gray-300 mb-1">
                  FINAL SCORE: <span className="text-emerald-300">{score}</span>
                </div>
                <div className="text-xs font-arcade text-gray-500 mb-6">
                  TANKS DESTROYED: {kills}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={startGame}
                    className="w-full py-3 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-arcade text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-pointer"
                  >
                    DEPLOY AGAIN
                  </button>
                  <button
                    onClick={() => setGameState('attract')}
                    className="w-full py-2 px-4 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 font-arcade text-[10px] cursor-pointer"
                  >
                    MAIN MENU
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OVERLAY: New High Score */}
          {gameState === 'new_high_score' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border-2 border-yellow-500/80 bg-[#0e0c06]/95 shadow-[0_0_35px_rgba(234,179,8,0.5)]">
                <div className="flex items-center justify-center gap-2 mb-2 text-yellow-400 font-arcade text-xs">
                  <Trophy className="w-4 h-4 text-yellow-400 animate-bounce" />
                  <span>TANK COMMANDER HIGH SCORE!</span>
                </div>

                <h2 className="text-2xl font-arcade text-yellow-300 font-bold mb-1 crt-glow">
                  {score.toString().padStart(6, '0')}
                </h2>
                <p className="text-[10px] font-arcade text-gray-400 mb-6">
                  ENTER YOUR INITIALS
                </p>

                <div className="flex justify-center gap-4 mb-6">
                  {initials.map((char, idx) => (
                    <div
                      key={idx}
                      onClick={() => setInitialIndex(idx)}
                      className={`w-14 h-16 flex items-center justify-center text-3xl font-arcade rounded border-2 cursor-pointer transition-all ${
                        initialIndex === idx
                          ? 'border-yellow-400 bg-yellow-950/60 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.6)] animate-pulse'
                          : 'border-gray-700 bg-black/60 text-gray-300'
                      }`}
                    >
                      {char}
                    </div>
                  ))}
                </div>

                <div className="flex justify-center gap-3 mb-6">
                  <button
                    onClick={() => {
                      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!.-';
                      setInitials(prev => {
                        const next = [...prev];
                        const curr = letters.indexOf(next[initialIndex]);
                        next[initialIndex] = letters[(curr + 1) % letters.length];
                        return next;
                      });
                      retroAudio.buttonClick();
                    }}
                    className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs font-arcade text-yellow-300 cursor-pointer"
                  >
                    ▲ NEXT
                  </button>
                  <button
                    onClick={() => {
                      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!.-';
                      setInitials(prev => {
                        const next = [...prev];
                        const curr = letters.indexOf(next[initialIndex]);
                        next[initialIndex] = letters[(curr - 1 + letters.length) % letters.length];
                        return next;
                      });
                      retroAudio.buttonClick();
                    }}
                    className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-xs font-arcade text-yellow-300 cursor-pointer"
                  >
                    ▼ PREV
                  </button>
                  <button
                    onClick={() => {
                      if (initialIndex < 2) {
                        setInitialIndex(i => i + 1);
                        retroAudio.buttonClick();
                      } else {
                        saveHighScore();
                      }
                    }}
                    className="px-4 py-1.5 rounded bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-arcade font-bold cursor-pointer"
                  >
                    {initialIndex < 2 ? 'NEXT ▶' : 'SUBMIT'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* On-Screen Mobile Virtual Tank Controls */}
      <div className="w-full bg-[#040806] border-t border-emerald-950/60 p-2 sm:p-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            onPointerDown={() => handleTouchDown('rotateLeft')}
            onPointerUp={() => handleTouchUp('rotateLeft')}
            onPointerLeave={() => handleTouchUp('rotateLeft')}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gray-900 border border-emerald-500/40 active:bg-emerald-600 active:text-black text-emerald-400 font-arcade text-xs flex items-center justify-center transition-all select-none shadow-md cursor-pointer"
            aria-label="Steer Left"
          >
            ◀
          </button>

          <button
            onPointerDown={() => handleTouchDown('thrust')}
            onPointerUp={() => handleTouchUp('thrust')}
            onPointerLeave={() => handleTouchUp('thrust')}
            className="w-14 h-12 sm:w-16 sm:h-14 rounded-lg bg-gray-900 border border-emerald-500/60 active:bg-emerald-500 active:text-black text-emerald-400 font-arcade text-[10px] flex flex-col items-center justify-center transition-all select-none shadow-md cursor-pointer"
            aria-label="Drive Forward"
          >
            <span>▲</span>
            <span className="text-[8px] font-sans">DRIVE</span>
          </button>

          <button
            onPointerDown={() => handleTouchDown('hyperspace')}
            onPointerUp={() => handleTouchUp('hyperspace')}
            onPointerLeave={() => handleTouchUp('hyperspace')}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gray-900 border border-emerald-500/40 active:bg-emerald-600 active:text-black text-emerald-400 font-arcade text-[9px] flex flex-col items-center justify-center transition-all select-none shadow-md cursor-pointer"
            aria-label="Reverse Tank"
          >
            <span>▼</span>
            <span className="text-[7.5px] font-sans">REV</span>
          </button>

          <button
            onPointerDown={() => handleTouchDown('rotateRight')}
            onPointerUp={() => handleTouchUp('rotateRight')}
            onPointerLeave={() => handleTouchUp('rotateRight')}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gray-900 border border-emerald-500/40 active:bg-emerald-600 active:text-black text-emerald-400 font-arcade text-xs flex items-center justify-center transition-all select-none shadow-md cursor-pointer"
            aria-label="Steer Right"
          >
            ▶
          </button>
        </div>

        <div className="hidden md:flex flex-col items-center text-center">
          <div className="text-[9px] font-arcade text-emerald-400 flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            <span>RADAR SCOPE & RETICLE ACTIVE</span>
          </div>
          <span className="text-[8px] text-gray-500 font-mono mt-0.5">
            USE PYRAMIDS FOR DEFENSIVE COVER • DIVE MISSILES CAN BE SHOT DOWN
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onPointerDown={() => handleTouchDown('fire')}
            onPointerUp={() => handleTouchUp('fire')}
            onPointerLeave={() => handleTouchUp('fire')}
            className="w-20 h-12 sm:w-24 sm:h-14 rounded-lg bg-gradient-to-b from-emerald-600 to-green-700 border-2 border-emerald-400 active:from-emerald-400 active:to-green-500 text-white font-arcade text-xs font-bold tracking-wider flex items-center justify-center transition-all select-none shadow-[0_0_15px_rgba(16,185,129,0.7)] cursor-pointer"
            aria-label="Fire 120mm Tank Cannon"
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
};
