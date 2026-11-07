import React, { useEffect, useRef, useState, useCallback } from 'react';
import { retroAudio } from '../../audio/retroAudio';
import { ArcadeControlsState } from '../../input/useArcadeInput';
import {
  Invader,
  Bunker,
  PlayerLaser,
  AlienBomb,
  MysteryUFO,
  SpaceInvadersHighScore,
} from './types';
import {
  SPRITE_SQUID,
  SPRITE_CRAB,
  SPRITE_OCTOPUS,
  SPRITE_CANNON,
  SPRITE_UFO,
  SPRITE_EXPLOSION,
  drawBitmap,
} from './sprites';
import {
  Trophy,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface SpaceInvadersProps {
  controlsRef: React.MutableRefObject<ArcadeControlsState>;
  onBackToArcade?: () => void;
  credits: number;
  onUseCredit: () => boolean;
  scanlines: boolean;
  hasGamepad: boolean;
}

const DEFAULT_INVADER_SCORES: SpaceInvadersHighScore[] = [
  { initials: 'TAI', score: 9990, wave: 5, date: '1978' },
  { initials: 'MID', score: 7450, wave: 4, date: '1979' },
  { initials: 'DAL', score: 4800, wave: 3, date: '1981' },
  { initials: 'UFO', score: 2600, wave: 2, date: '1980' },
  { initials: 'ACE', score: 1200, wave: 1, date: '1979' },
];

// Classic 1978 Arcade Virtual Coordinate Resolution
const GAME_WIDTH = 600;
const GAME_HEIGHT = 700;
const CANNON_Y = 615;
const BASELINE_Y = 645;
const BUNKERS_Y = 515;

export const SpaceInvadersGame: React.FC<SpaceInvadersProps> = ({
  controlsRef,
  onBackToArcade,
  credits,
  onUseCredit,
  scanlines,
  hasGamepad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [highScores, setHighScores] = useState<SpaceInvadersHighScore[]>(() => {
    try {
      const saved = localStorage.getItem('retro_arcade_spaceinvaders_scores');
      return saved ? JSON.parse(saved) : DEFAULT_INVADER_SCORES;
    } catch {
      return DEFAULT_INVADER_SCORES;
    }
  });

  const [gameState, setGameState] = useState<'attract' | 'playing' | 'gameover' | 'new_high_score'>('attract');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(() => retroAudio.getMuted());

  // Initials entry
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

  // Main Engine State
  const engine = useRef({
    status: 'attract' as 'attract' | 'playing' | 'gameover' | 'new_high_score',
    score: 0,
    lives: 3,
    wave: 1,
    playerX: Math.round((GAME_WIDTH - 32) / 2),
    playerSpeed: 260,
    playerLaser: null as PlayerLaser | null,
    invaders: [] as Invader[],
    bunkers: [] as Bunker[],
    bombs: [] as AlienBomb[],
    ufo: {
      active: false,
      x: 0,
      y: 34,
      vx: 0,
      points: 100,
      timer: 0,
    } as MysteryUFO,
    invaderDir: 1, // 1 = right, -1 = left
    marchTimer: 0,
    marchStep: 0,
    animFrame: 0 as 0 | 1,
    deathExplosions: [] as { x: number; y: number; life: number }[],
    screenW: GAME_WIDTH,
    screenH: GAME_HEIGHT,
  });

  // Create 5x11 Invader Grid
  const createInvaderGrid = (waveNum: number): Invader[] => {
    const list: Invader[] = [];
    const gridCols = 11;
    const colSpacing = 36;
    const gridW = (gridCols - 1) * colSpacing + 24;
    const startX = Math.round((GAME_WIDTH - gridW) / 2);
    const startY = 70 + Math.min((waveNum - 1) * 14, 110);

    for (let r = 0; r < 5; r++) {
      const type: 'squid' | 'crab' | 'octopus' =
        r === 0 ? 'squid' : r < 3 ? 'crab' : 'octopus';
      const points = r === 0 ? 30 : r < 3 ? 20 : 10;

      for (let c = 0; c < 11; c++) {
        list.push({
          row: r,
          col: c,
          type,
          x: startX + c * colSpacing,
          y: startY + r * 30,
          points,
          alive: true,
        });
      }
    }
    return list;
  };

  // Create 4 Destructible Arch Bunkers
  const createBunkers = (): Bunker[] => {
    const bunkerW = 20; // 20 cells wide = 50px
    const bunkerH = 14; // 14 cells tall = 35px
    const bunkers: Bunker[] = [];
    const spacing = GAME_WIDTH / 5;

    for (let b = 1; b <= 4; b++) {
      const cells: boolean[][] = [];
      const bx = spacing * b - (bunkerW * 2.5) / 2;
      const by = BUNKERS_Y;

      for (let r = 0; r < bunkerH; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < bunkerW; c++) {
          // Arch shape with top rounded corners and center hollow notch
          const inTopLeft = r < 3 && c < 3 - r;
          const inTopRight = r < 3 && c >= bunkerW - (3 - r);
          const inBottomArch = r >= 8 && c >= 6 && c <= 13;

          row.push(!inTopLeft && !inTopRight && !inBottomArch);
        }
        cells.push(row);
      }

      bunkers.push({
        id: b,
        x: bx,
        y: by,
        width: bunkerW,
        height: bunkerH,
        cells,
      });
    }
    return bunkers;
  };

  // Erode Bunker Pixels when hit
  const damageBunker = (bunker: Bunker, hitX: number, hitY: number, blastRadius = 3) => {
    const cellSize = 2.5;
    const cellCol = Math.floor((hitX - bunker.x) / cellSize);
    const cellRow = Math.floor((hitY - bunker.y) / cellSize);

    retroAudio.bunkerHit();

    for (let r = cellRow - blastRadius; r <= cellRow + blastRadius; r++) {
      for (let c = cellCol - blastRadius; c <= cellCol + blastRadius; c++) {
        if (r >= 0 && r < bunker.height && c >= 0 && c < bunker.width) {
          if (Math.hypot(r - cellRow, c - cellCol) <= blastRadius) {
            bunker.cells[r][c] = false;
          }
        }
      }
    }
  };

  // Start Space Invaders
  const startGame = useCallback(() => {
    if (credits > 0) {
      onUseCredit();
    } else {
      retroAudio.insertCoin();
    }

    engine.current.status = 'playing';
    engine.current.score = 0;
    engine.current.lives = 3;
    engine.current.wave = 1;
    engine.current.playerX = Math.round((GAME_WIDTH - 32) / 2);
    engine.current.playerLaser = null;
    engine.current.invaders = createInvaderGrid(1);
    engine.current.bunkers = createBunkers();
    engine.current.bombs = [];
    engine.current.deathExplosions = [];
    engine.current.invaderDir = 1;
    engine.current.marchTimer = 0;
    engine.current.marchStep = 0;
    engine.current.animFrame = 0;
    engine.current.ufo.active = false;
    engine.current.ufo.timer = 0;

    setScore(0);
    setLives(3);
    setWave(1);
    setGameState('playing');
    setIsPaused(false);
    retroAudio.extraLife();
  }, [credits, onUseCredit]);

  // Player Laser Fire
  const firePlayerLaser = useCallback(() => {
    const state = engine.current;
    if (state.status !== 'playing' || isPausedRef.current) return;

    if (!state.playerLaser) {
      state.playerLaser = {
        x: state.playerX + 15,
        y: CANNON_Y - 4,
        vy: -580,
        active: true,
      };
      retroAudio.spaceLaser();
    }
  }, []);

  // Save High Score
  const saveHighScore = () => {
    const initialsStr = initials.join('');
    const newEntry: SpaceInvadersHighScore = {
      initials: initialsStr,
      score,
      wave,
      date: new Date().getFullYear().toString(),
    };

    const updated = [...highScores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setHighScores(updated);
    try {
      localStorage.setItem('retro_arcade_spaceinvaders_scores', JSON.stringify(updated));
    } catch {}

    setGameState('attract');
    engine.current.status = 'attract';
    retroAudio.buttonClick();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'attract') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startGame();
        }
      } else if (gameState === 'playing') {
        if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
          e.preventDefault();
          firePlayerLaser();
        }
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          controlsRef.current.rotateLeft = true;
          controlsRef.current.left = true;
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          controlsRef.current.rotateRight = true;
          controlsRef.current.right = true;
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

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        controlsRef.current.rotateLeft = false;
        controlsRef.current.left = false;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        controlsRef.current.rotateRight = false;
        controlsRef.current.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, initialIndex, initials, score, wave, highScores, startGame, firePlayerLaser, controlsRef]);

  // Main Canvas & Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = GAME_WIDTH * dpr;
      canvas.height = GAME_HEIGHT * dpr;
      engine.current.screenW = GAME_WIDTH;
      engine.current.screenH = GAME_HEIGHT;

      if (engine.current.invaders.length === 0) {
        engine.current.invaders = createInvaderGrid(1);
        engine.current.bunkers = createBunkers();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const paused = isPausedRef.current;
      const state = engine.current;
      const controls = controlsRef.current;

      // Keep canvas resolution synced
      if (canvas.width !== GAME_WIDTH * dpr || canvas.height !== GAME_HEIGHT * dpr) {
        canvas.width = GAME_WIDTH * dpr;
        canvas.height = GAME_HEIGHT * dpr;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#030303';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // --- 1. PLAYER CANNON LOCOMOTION ---
      if (!paused && state.status === 'playing') {
        const moveLeft = controls.rotateLeft || controls.left;
        const moveRight = controls.rotateRight || controls.right;
        if (moveLeft) {
          state.playerX = Math.max(16, state.playerX - state.playerSpeed * dt);
        }
        if (moveRight) {
          state.playerX = Math.min(GAME_WIDTH - 48, state.playerX + state.playerSpeed * dt);
        }
        if (controls.fire) {
          firePlayerLaser();
        }
      }

      // --- 2. INVADERS MARCHING SYSTEM ---
      const aliveInvaders = state.invaders.filter(inv => inv.alive);
      const aliveCount = aliveInvaders.length;

      if (!paused && (state.status === 'playing' || state.status === 'attract') && aliveCount > 0) {
        const marchInterval = state.status === 'playing'
          ? 0.07 + (aliveCount / 55) * 0.68
          : 0.65;
        state.marchTimer += dt;

        if (state.marchTimer >= marchInterval) {
          state.marchTimer = 0;
          state.animFrame = state.animFrame === 0 ? 1 : 0;
          state.marchStep = (state.marchStep + 1) % 4;
          if (state.status === 'playing') {
            retroAudio.invaderMarch(state.marchStep);
          }

          // Check boundary hits
          let hitEdge = false;
          for (const inv of aliveInvaders) {
            const nextX = inv.x + state.invaderDir * 12;
            if (nextX < 24 || nextX > GAME_WIDTH - 48) {
              hitEdge = true;
              break;
            }
          }

          if (hitEdge) {
            state.invaderDir = -state.invaderDir;
            for (const inv of aliveInvaders) {
              inv.y += 16;
              if (state.status === 'playing' && inv.y >= CANNON_Y - 18) {
                state.status = 'gameover';
                setGameState('gameover');
                retroAudio.gameOver();
                break;
              }
            }
          } else {
            for (const inv of aliveInvaders) {
              inv.x += state.invaderDir * 10;
            }
          }

          // Random alien bomb drop from bottom-most alive invaders
          if (state.status === 'playing' && state.bombs.length < 3 && Math.random() < 0.35) {
            const cols = new Map<number, Invader>();
            for (const inv of aliveInvaders) {
              const current = cols.get(inv.col);
              if (!current || inv.row > current.row) {
                cols.set(inv.col, inv);
              }
            }
            const bottomInvaders = Array.from(cols.values());
            const dropper = bottomInvaders[Math.floor(Math.random() * bottomInvaders.length)];
            if (dropper) {
              state.bombs.push({
                id: Math.random(),
                x: dropper.x + 10,
                y: dropper.y + 16,
                vy: 180 + state.wave * 15,
                type: 'squiggly',
                animTimer: 0,
                animFrame: 0,
              });
            }
          }
        }
      }

      // Wave Cleared check
      if (!paused && state.status === 'playing' && aliveCount === 0) {
        const nextWave = state.wave + 1;
        state.wave = nextWave;
        setWave(nextWave);
        state.invaders = createInvaderGrid(nextWave);
        state.invaderDir = 1;
        state.bombs = [];
        state.playerLaser = null;
        retroAudio.extraLife();
      }

      // --- 3. MYSTERY UFO (SAUCER) ---
      const ufo = state.ufo;
      if (!paused && state.status === 'playing') {
        if (!ufo.active) {
          ufo.timer += dt;
          if (ufo.timer > 22) {
            ufo.timer = 0;
            ufo.active = true;
            const fromLeft = Math.random() < 0.5;
            ufo.x = fromLeft ? -40 : GAME_WIDTH + 20;
            ufo.vx = fromLeft ? 120 : -120;
            const rewards = [50, 100, 150, 300];
            ufo.points = rewards[Math.floor(Math.random() * rewards.length)];
          }
        } else {
          ufo.x += ufo.vx * dt;
          if ((ufo.vx > 0 && ufo.x > GAME_WIDTH + 50) || (ufo.vx < 0 && ufo.x < -50)) {
            ufo.active = false;
          }
        }
      }

      // Draw UFO
      if (ufo.active) {
        drawBitmap(ctx, SPRITE_UFO, ufo.x, ufo.y, 2.0, '#ef4444');
      }

      // --- 4. RENDER ALIEN INVADERS WITH RETRO COLOR BANDS ---
      for (const inv of aliveInvaders) {
        let sprite = SPRITE_OCTOPUS;
        let color = '#22c55e'; // Bottom rows green
        if (inv.type === 'squid') {
          sprite = SPRITE_SQUID;
          color = '#ec4899'; // Top row pink
        } else if (inv.type === 'crab') {
          sprite = SPRITE_CRAB;
          color = '#06b6d4'; // Middle rows cyan
        }

        const frameBitmap = sprite[state.animFrame];
        drawBitmap(ctx, frameBitmap, inv.x, inv.y, 2.0, color);
      }

      // --- 5. PLAYER LASER ---
      const laser = state.playerLaser;
      if (laser && laser.active) {
        if (!paused && state.status === 'playing') {
          laser.y += laser.vy * dt;
          if (laser.y < 30) {
            laser.active = false;
            state.playerLaser = null;
          }
        }

        if (laser && laser.active) {
          // Check collision with UFO
          if (ufo.active && laser.x >= ufo.x && laser.x <= ufo.x + 32 && laser.y <= ufo.y + 14) {
            ufo.active = false;
            laser.active = false;
            state.playerLaser = null;
            retroAudio.invaderKilled();
            state.score += ufo.points;
            setScore(state.score);
          }

          // Check collision with Invaders
          if (laser && laser.active) {
            for (const inv of aliveInvaders) {
              if (
                laser.x >= inv.x - 2 &&
                laser.x <= inv.x + 24 &&
                laser.y >= inv.y &&
                laser.y <= inv.y + 16
              ) {
                inv.alive = false;
                laser.active = false;
                state.playerLaser = null;
                retroAudio.invaderKilled();
                state.deathExplosions.push({ x: inv.x, y: inv.y, life: 0.18 });

                const newScore = state.score + inv.points;
                state.score = newScore;
                setScore(newScore);
                break;
              }
            }
          }

          // Check collision with Bunkers
          if (laser && laser.active) {
            const cellSize = 2.5;
            for (const bunker of state.bunkers) {
              if (
                laser.x >= bunker.x &&
                laser.x <= bunker.x + bunker.width * cellSize &&
                laser.y >= bunker.y &&
                laser.y <= bunker.y + bunker.height * cellSize
              ) {
                damageBunker(bunker, laser.x, laser.y, 3);
                laser.active = false;
                state.playerLaser = null;
                break;
              }
            }
          }

          // Draw laser line
          if (laser && laser.active) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 8;
            ctx.fillRect(laser.x - 1, laser.y, 2.5, 12);
            ctx.shadowBlur = 0;
          }
        }
      }

      // --- 6. ALIEN BOMBS ---
      const activeBombs: AlienBomb[] = [];

      for (const bomb of state.bombs) {
        if (!paused && state.status === 'playing') {
          bomb.y += bomb.vy * dt;
          bomb.animTimer += dt;
          if (bomb.animTimer > 0.08) {
            bomb.animTimer = 0;
            bomb.animFrame = (bomb.animFrame + 1) % 4;
          }

          // Check Bunker collision
          const cellSize = 2.5;
          let hitBunker = false;
          for (const bunker of state.bunkers) {
            if (
              bomb.x >= bunker.x &&
              bomb.x <= bunker.x + bunker.width * cellSize &&
              bomb.y >= bunker.y &&
              bomb.y <= bunker.y + bunker.height * cellSize
            ) {
              damageBunker(bunker, bomb.x, bomb.y, 3);
              hitBunker = true;
              break;
            }
          }
          if (hitBunker) continue;

          // Check Player Cannon collision!
          if (
            bomb.x >= state.playerX - 2 &&
            bomb.x <= state.playerX + 34 &&
            bomb.y >= CANNON_Y &&
            bomb.y <= CANNON_Y + 20
          ) {
            retroAudio.explosion('med');
            state.deathExplosions.push({ x: state.playerX, y: CANNON_Y, life: 0.6 });
            const nextLives = state.lives - 1;
            state.lives = nextLives;
            setLives(nextLives);

            if (nextLives <= 0) {
              state.status = 'gameover';
              setGameState('gameover');
              retroAudio.gameOver();
            }
            continue;
          }

          // Offscreen bottom
          if (bomb.y > BASELINE_Y) continue;
        }

        activeBombs.push(bomb);

        // Draw bomb squiggly zigzag
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        const zag = bomb.animFrame % 2 === 0 ? 3 : -3;
        ctx.moveTo(bomb.x, bomb.y);
        ctx.lineTo(bomb.x + zag, bomb.y + 4);
        ctx.lineTo(bomb.x - zag, bomb.y + 8);
        ctx.lineTo(bomb.x, bomb.y + 12);
        ctx.stroke();
      }
      state.bombs = activeBombs;

      // --- 7. DESTRUCTIBLE BUNKERS RENDERING ---
      const cellSize = 2.5;
      ctx.fillStyle = '#22c55e'; // Green bunker pixels
      for (const bunker of state.bunkers) {
        for (let r = 0; r < bunker.height; r++) {
          for (let c = 0; c < bunker.width; c++) {
            if (bunker.cells[r][c]) {
              ctx.fillRect(bunker.x + c * cellSize, bunker.y + r * cellSize, cellSize, cellSize);
            }
          }
        }
      }

      // --- 8. DEATH EXPLOSIONS ---
      const activeExplosions: { x: number; y: number; life: number }[] = [];
      for (const exp of state.deathExplosions) {
        exp.life -= dt;
        if (exp.life > 0) {
          activeExplosions.push(exp);
          drawBitmap(ctx, SPRITE_EXPLOSION, exp.x, exp.y, 2.5, '#ffffff');
        }
      }
      state.deathExplosions = activeExplosions;

      // --- 9. LASER CANNON PLAYER RENDERING ---
      // Glowing retro green laser cannon (width 32.5px, height 20px)
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;
      drawBitmap(ctx, SPRITE_CANNON, state.playerX, CANNON_Y, 2.5, '#22c55e');
      ctx.shadowBlur = 0;

      // Bottom green baseline
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, BASELINE_Y);
      ctx.lineTo(GAME_WIDTH, BASELINE_Y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Bottom baseline indicators (Lives & Credit)
      ctx.fillStyle = '#22c55e';
      ctx.font = '10px monospace';
      ctx.fillText(`${state.lives}`, 20, BASELINE_Y + 26);
      for (let i = 0; i < state.lives - 1; i++) {
        drawBitmap(ctx, SPRITE_CANNON, 42 + i * 32, BASELINE_Y + 14, 1.6, '#22c55e');
      }

      ctx.fillStyle = '#22c55e';
      ctx.font = '10px monospace';
      ctx.fillText(`CREDIT 0${credits}`, GAME_WIDTH - 110, BASELINE_Y + 26);

      ctx.restore();

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [firePlayerLaser, credits]);

  // Touch control handlers
  const handleTouchDown = (action: keyof ArcadeControlsState) => {
    controlsRef.current[action] = true;
    if (action === 'rotateLeft') controlsRef.current.left = true;
    if (action === 'rotateRight') controlsRef.current.right = true;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(12); } catch {}
    }
  };

  const handleTouchUp = (action: keyof ArcadeControlsState) => {
    controlsRef.current[action] = false;
    if (action === 'rotateLeft') controlsRef.current.left = false;
    if (action === 'rotateRight') controlsRef.current.right = false;
  };

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-[#030508]">
      {/* Top HUD Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 bg-[#060408] border-b border-fuchsia-950/60 text-xs font-arcade tracking-wider z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">SCORE</span>
            <span className="text-white font-bold text-sm tracking-widest">
              {score.toString().padStart(6, '0')}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">HI-SCORE</span>
            <span className="text-pink-400 font-bold text-sm tracking-widest">
              {(highScores[0]?.score || 0).toString().padStart(6, '0')}
            </span>
          </div>

          {gameState === 'playing' && (
            <div className="hidden sm:flex flex-col">
              <span className="text-[9px] text-gray-500">WAVE</span>
              <span className="text-emerald-400 font-bold text-sm">#{wave}</span>
            </div>
          )}
        </div>

        {/* Lives Counter as mini Cannon sprites */}
        <div className="flex items-center gap-3">
          {gameState === 'playing' && (
            <div className="flex items-center gap-1.5 mr-2">
              {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                <div key={i} className="w-4 h-3 bg-emerald-500 rounded-xs flex items-center justify-center">
                  <div className="w-1.5 h-1 bg-black"></div>
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
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-fuchsia-400" />}
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
              className="px-2.5 py-1 rounded bg-fuchsia-950 hover:bg-fuchsia-900 border border-fuchsia-500/50 text-[10px] text-fuchsia-300 cursor-pointer"
            >
              CABINET ROW
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center p-1 sm:p-2">
        <div className={`relative h-full max-h-full aspect-[600/700] rounded-lg overflow-hidden arcade-bezel flex items-center justify-center bg-[#030303] ${scanlines ? 'crt-overlay crt-vignette' : ''}`}>
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              if (gameState === 'attract') {
                startGame();
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = ((e.clientX - rect.left) / rect.width) * GAME_WIDTH;
              if (clickX < engine.current.playerX) {
                engine.current.playerX = Math.max(16, engine.current.playerX - 24);
              } else if (clickX > engine.current.playerX + 32) {
                engine.current.playerX = Math.min(GAME_WIDTH - 48, engine.current.playerX + 24);
              }
              firePlayerLaser();
            }}
            className="w-full h-full block bg-[#030303] cursor-pointer"
          />

          {/* OVERLAY: Attract Mode */}
          {gameState === 'attract' && (
            <div
              onClick={startGame}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-[2px] p-4 text-center z-30 cursor-pointer"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="max-w-md w-full p-6 rounded-xl border border-fuchsia-500/60 bg-[#080309]/95 shadow-[0_0_35px_rgba(217,70,239,0.4)]"
              >
                <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-950 border border-fuchsia-400/50 text-[10px] font-arcade text-fuchsia-300">
                  <Sparkles className="w-3 h-3 text-fuchsia-400" />
                  <span>TAITO 1978 ARCADE PHENOMENON</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-arcade text-fuchsia-400 font-extrabold tracking-widest crt-glow mb-2">
                  SPACE INVADERS
                </h1>
                <p className="text-xs text-gray-400 font-mono mb-5">
                  STOP THE MARCHING ARMADA • DESTRUCTIBLE BUNKERS
                </p>

                {/* Score table */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-arcade text-left bg-black/60 p-3 rounded-lg border border-gray-800 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-xs"></span>
                    <span className="text-red-300">UFO: ?? MYSTERY</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-pink-500 rounded-xs"></span>
                    <span className="text-pink-300">SQUID: 30 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-cyan-400 rounded-xs"></span>
                    <span className="text-cyan-300">CRAB: 20 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-xs"></span>
                    <span className="text-emerald-300">OCTOPUS: 10 PTS</span>
                  </div>
                </div>

                {/* Launch Button */}
                <div className="space-y-2.5">
                  <button
                    onClick={startGame}
                    className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-700 hover:from-fuchsia-500 hover:to-pink-600 text-white font-arcade text-sm font-bold tracking-widest shadow-[0_0_25px_rgba(217,70,239,0.8)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>DEFEND EARTH (1 CREDIT)</span>
                  </button>

                  <div className="text-[10px] font-arcade text-amber-300 flex items-center justify-center gap-3">
                    <span>CREDITS: {credits.toString().padStart(2, '0')}</span>
                    <span>•</span>
                    <span className="text-gray-400">PRESS [SPACE] / [ENTER]</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800 text-[9px] font-mono text-gray-400 flex flex-wrap justify-center gap-3">
                  <span>[←/→] STEER CANNON</span>
                  <span>[SPACE] FIRE LASER</span>
                  <span>DESTRUCTIBLE BUNKERS</span>
                </div>
              </div>
            </div>
          )}

          {/* OVERLAY: Game Over */}
          {gameState === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border-2 border-red-500/60 bg-[#0c0307]/95 shadow-[0_0_35px_rgba(239,68,68,0.5)]">
                <h2 className="text-3xl font-arcade text-red-500 font-bold tracking-widest mb-2 crt-glow">
                  INVASION SUCCESSFUL
                </h2>
                <div className="text-sm font-arcade text-gray-300 mb-1">
                  FINAL SCORE: <span className="text-fuchsia-400">{score}</span>
                </div>
                <div className="text-xs font-arcade text-gray-500 mb-6">
                  WAVES DEFENDED: {wave}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={startGame}
                    className="w-full py-3 px-4 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-black font-arcade text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(217,70,239,0.5)] cursor-pointer"
                  >
                    DEFEND AGAIN
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
                  <span>EARTH DEFENDER HIGH SCORE!</span>
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

      {/* On-Screen Mobile Virtual Controls */}
      <div className="w-full bg-[#060408] border-t border-fuchsia-950/60 p-2 sm:p-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            onPointerDown={() => handleTouchDown('rotateLeft')}
            onPointerUp={() => handleTouchUp('rotateLeft')}
            onPointerLeave={() => handleTouchUp('rotateLeft')}
            className="w-14 h-12 sm:w-16 sm:h-14 rounded-lg bg-gray-900 border border-fuchsia-500/40 active:bg-fuchsia-600 active:text-black text-fuchsia-400 font-arcade text-xs flex items-center justify-center transition-all select-none shadow-md cursor-pointer"
            aria-label="Move Left"
          >
            ◀
          </button>

          <button
            onPointerDown={() => handleTouchDown('rotateRight')}
            onPointerUp={() => handleTouchUp('rotateRight')}
            onPointerLeave={() => handleTouchUp('rotateRight')}
            className="w-14 h-12 sm:w-16 sm:h-14 rounded-lg bg-gray-900 border border-fuchsia-500/40 active:bg-fuchsia-600 active:text-black text-fuchsia-400 font-arcade text-xs flex items-center justify-center transition-all select-none shadow-md cursor-pointer"
            aria-label="Move Right"
          >
            ▶
          </button>
        </div>

        <div className="hidden md:flex flex-col items-center text-center">
          <div className="text-[9px] font-arcade text-fuchsia-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>ACCELERATING HEARTBEAT TEMPO</span>
          </div>
          <span className="text-[8px] text-gray-500 font-mono mt-0.5">
            HIDE BEHIND GREEN BUNKERS • WATCH OUT FOR DROPPING BOMBS
          </span>
        </div>

        <button
          onClick={firePlayerLaser}
          className="w-20 h-12 sm:w-24 sm:h-14 rounded-lg bg-gradient-to-b from-fuchsia-600 to-pink-700 border-2 border-fuchsia-400 active:from-fuchsia-400 active:to-pink-500 text-white font-arcade text-xs font-bold tracking-wider flex items-center justify-center transition-all select-none shadow-[0_0_15px_rgba(217,70,239,0.7)] cursor-pointer"
        >
          FIRE
        </button>
      </div>
    </div>
  );
};
