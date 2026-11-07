import React, { useEffect, useRef, useState, useCallback } from 'react';
import { retroAudio } from '../../audio/retroAudio';
import { ArcadeControlsState } from '../../input/useArcadeInput';
import {
  Ship,
  Bullet,
  Asteroid,
  DebrisParticle,
  Saucer,
  HighScoreEntry,
  ColorTheme,
} from './types';
import {
  Trophy,
  Sparkles,
  Volume2,
  VolumeX,
  Gamepad2,
  Zap,
  Play,
} from 'lucide-react';

interface AsteroidsGameProps {
  controlsRef: React.MutableRefObject<ArcadeControlsState>;
  onBackToArcade?: () => void;
  credits: number;
  onUseCredit: () => boolean;
  colorTheme: ColorTheme;
  scanlines: boolean;
  hasGamepad: boolean;
}

const DEFAULT_HIGH_SCORES: HighScoreEntry[] = [
  { initials: 'DAL', score: 14200, wave: 6, date: '1982' },
  { initials: 'ACE', score: 9850, wave: 4, date: '1983' },
  { initials: 'NEO', score: 6400, wave: 3, date: '1984' },
  { initials: 'VEC', score: 3800, wave: 2, date: '1981' },
  { initials: 'ARC', score: 1500, wave: 1, date: '1980' },
];

export const AsteroidsGame: React.FC<AsteroidsGameProps> = ({
  controlsRef,
  onBackToArcade,
  credits,
  onUseCredit,
  colorTheme,
  scanlines,
  hasGamepad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High Scores in localStorage
  const [highScores, setHighScores] = useState<HighScoreEntry[]>(() => {
    try {
      const saved = localStorage.getItem('retro_arcade_asteroids_scores');
      return saved ? JSON.parse(saved) : DEFAULT_HIGH_SCORES;
    } catch {
      return DEFAULT_HIGH_SCORES;
    }
  });

  const [gameState, setGameState] = useState<'attract' | 'playing' | 'gameover' | 'new_high_score'>('attract');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(() => retroAudio.getMuted());

  // Initials entry state for top scores
  const [initials, setInitials] = useState(['A', 'A', 'A']);
  const [initialIndex, setInitialIndex] = useState(0);

  // Refs for smooth 60fps game loop without effect recreation
  const colorThemeRef = useRef(colorTheme);
  useEffect(() => {
    colorThemeRef.current = colorTheme;
  }, [colorTheme]);

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const highScoresRef = useRef(highScores);
  useEffect(() => {
    highScoresRef.current = highScores;
  }, [highScores]);

  // Engine state that persists across loop iterations
  const engineState = useRef({
    score: 0,
    lives: 3,
    wave: 1,
    highScore: DEFAULT_HIGH_SCORES[0].score,
    nextExtraLife: 10000,
    status: 'attract' as 'attract' | 'playing' | 'gameover' | 'new_high_score',
    ship: null as Ship | null,
    bullets: [] as Bullet[],
    asteroids: [] as Asteroid[],
    debris: [] as DebrisParticle[],
    saucer: {
      active: false,
      isSmall: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      timer: 0,
      fireTimer: 0,
      dirChangeTimer: 0,
    } as Saucer,
    lastFireTime: 0,
    nextSaucerAt: 15,
    waveClearCooldown: 0,
    screenW: 800,
    screenH: 600,
  });

  // Theme palettes getter
  const getThemeColors = () => {
    const theme = colorThemeRef.current;
    switch (theme) {
      case 'monochrome':
        return {
          stroke: '#f8fafc',
          accent: '#94a3b8',
          glow: 'rgba(255, 255, 255, 0.35)',
          ufo: '#e2e8f0',
          debris: '#cbd5e1',
        };
      case 'green':
        return {
          stroke: '#22c55e',
          accent: '#eab308',
          glow: 'rgba(34, 197, 94, 0.45)',
          ufo: '#86efac',
          debris: '#4ade80',
        };
      case 'amber':
        return {
          stroke: '#f59e0b',
          accent: '#ef4444',
          glow: 'rgba(245, 158, 11, 0.45)',
          ufo: '#fbbf24',
          debris: '#fde68a',
        };
      case 'cyan':
      default:
        return {
          stroke: '#38bdf8',
          accent: '#f43f5e',
          glow: 'rgba(56, 189, 248, 0.45)',
          ufo: '#ec4899',
          debris: '#67e8f9',
        };
    }
  };

  // Helper to create an asteroid with procedurally jagged vertices
  const createAsteroid = (x: number, y: number, tier: 1 | 2 | 3, speedMod = 1): Asteroid => {
    const baseRadius = tier === 3 ? 42 : tier === 2 ? 24 : 14;
    const vertexCount = 10 + Math.floor(Math.random() * 4);
    const points: [number, number][] = [];

    for (let i = 0; i < vertexCount; i++) {
      const angle = (i / vertexCount) * Math.PI * 2;
      const r = baseRadius * (0.75 + Math.random() * 0.45);
      points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = (0.6 + Math.random() * 1.4) * (4 - tier) * 0.65 * speedMod;

    return {
      id: Math.random(),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: baseRadius,
      tier,
      angle: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      points,
    };
  };

  // Safe spawn wave - NO UNBOUNDED WHILE LOOPS
  const spawnAsteroidWave = (waveNum: number, w: number, h: number): Asteroid[] => {
    const effectiveW = Math.max(w || 0, 800);
    const effectiveH = Math.max(h || 0, 600);
    const count = Math.min(4 + waveNum * 2, 11);
    const asteroids: Asteroid[] = [];
    const centerX = effectiveW / 2;
    const centerY = effectiveH / 2;
    const safeRadius = Math.min(150, effectiveW * 0.25);

    for (let i = 0; i < count; i++) {
      let x = Math.random() * effectiveW;
      let y = Math.random() * effectiveH;
      let attempts = 0;

      // Max 15 attempts to find non-colliding spot, otherwise place along perimeter
      while (Math.hypot(x - centerX, y - centerY) < safeRadius && attempts < 15) {
        x = Math.random() * effectiveW;
        y = Math.random() * effectiveH;
        attempts++;
      }

      if (Math.hypot(x - centerX, y - centerY) < safeRadius) {
        // Place along border edges
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { x = Math.random() * effectiveW; y = 30; }
        else if (side === 1) { x = Math.random() * effectiveW; y = effectiveH - 30; }
        else if (side === 2) { x = 30; y = Math.random() * effectiveH; }
        else { x = effectiveW - 30; y = Math.random() * effectiveH; }
      }

      asteroids.push(createAsteroid(x, y, 3, 1 + waveNum * 0.12));
    }
    return asteroids;
  };

  // Spawn ship at center
  const createShip = (w: number, h: number): Ship => {
    const effectiveW = Math.max(w || 0, 800);
    const effectiveH = Math.max(h || 0, 600);
    return {
      x: effectiveW / 2,
      y: effectiveH / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2, // Upwards
      radius: 12,
      thrusting: false,
      invulnerableTime: 3.0,
    };
  };

  // Spawn debris particles
  const spawnDebris = (x: number, y: number, count = 10, speedMult = 1) => {
    const theme = getThemeColors();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (1 + Math.random() * 3.5) * speedMult;
      const life = 0.4 + Math.random() * 0.6;
      engineState.current.debris.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color: theme.debris,
        length: 3 + Math.random() * 6,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
      });
    }
  };

  // Start new game
  const startGame = useCallback(() => {
    if (credits <= 0) {
      retroAudio.insertCoin();
    } else {
      onUseCredit();
    }

    const w = Math.max(engineState.current.screenW || 0, 800);
    const h = Math.max(engineState.current.screenH || 0, 600);

    engineState.current.score = 0;
    engineState.current.lives = 3;
    engineState.current.wave = 1;
    engineState.current.nextExtraLife = 10000;
    engineState.current.status = 'playing';
    engineState.current.ship = createShip(w, h);
    engineState.current.bullets = [];
    engineState.current.asteroids = spawnAsteroidWave(1, w, h);
    engineState.current.debris = [];
    engineState.current.saucer.active = false;
    engineState.current.nextSaucerAt = 20;
    retroAudio.stopSaucerSound();
    retroAudio.extraLife();

    setScore(0);
    setLives(3);
    setWave(1);
    setGameState('playing');
    setIsPaused(false);
  }, [credits, onUseCredit]);

  // Hyperspace logic
  const triggerHyperspace = useCallback(() => {
    const s = engineState.current.ship;
    if (!s || s.invulnerableTime > 0) return;

    retroAudio.hyperspace();
    const w = Math.max(engineState.current.screenW || 0, 800);
    const h = Math.max(engineState.current.screenH || 0, 600);

    // 12% malfunction danger
    const malfunction = Math.random() < 0.12;

    if (malfunction) {
      spawnDebris(s.x, s.y, 25, 2);
      retroAudio.explosion('large');
      killShip();
    } else {
      spawnDebris(s.x, s.y, 10, 1.2);
      s.x = Math.random() * (w - 80) + 40;
      s.y = Math.random() * (h - 80) + 40;
      s.vx = 0;
      s.vy = 0;
      s.invulnerableTime = 1.2;
      spawnDebris(s.x, s.y, 10, 1.2);
    }
  }, []);

  // Handle ship death
  const killShip = () => {
    const s = engineState.current.ship;
    if (!s) return;

    spawnDebris(s.x, s.y, 24, 2.5);
    retroAudio.explosion('large');
    engineState.current.ship = null;

    const remainingLives = engineState.current.lives - 1;
    engineState.current.lives = remainingLives;
    setLives(remainingLives);

    if (remainingLives <= 0) {
      retroAudio.gameOver();
      retroAudio.stopSaucerSound();

      const finalScore = engineState.current.score;
      const currentHighs = highScoresRef.current;
      const isTopScore =
        finalScore > 0 &&
        (currentHighs.length < 5 || finalScore > currentHighs[currentHighs.length - 1].score);

      if (isTopScore) {
        engineState.current.status = 'new_high_score';
        setGameState('new_high_score');
      } else {
        engineState.current.status = 'gameover';
        setGameState('gameover');
      }
    } else {
      // Respawn ship after delay
      setTimeout(() => {
        if (engineState.current.status === 'playing') {
          engineState.current.ship = createShip(
            engineState.current.screenW,
            engineState.current.screenH
          );
        }
      }, 1400);
    }
  };

  // Submit high score
  const saveHighScore = () => {
    const initialsStr = initials.join('');
    const newEntry: HighScoreEntry = {
      initials: initialsStr,
      score: score,
      wave: wave,
      date: new Date().getFullYear().toString(),
    };

    const updated = [...highScores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setHighScores(updated);
    try {
      localStorage.setItem('retro_arcade_asteroids_scores', JSON.stringify(updated));
    } catch {
      // ignore
    }

    setGameState('attract');
    engineState.current.status = 'attract';
    retroAudio.buttonClick();
  };

  // Global key listener for starting game in attract mode
  useEffect(() => {
    const handleStartKey = (e: KeyboardEvent) => {
      if (gameState === 'attract') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener('keydown', handleStartKey);
    return () => window.removeEventListener('keydown', handleStartKey);
  }, [gameState, startGame]);

  // Keyboard controls for Initials Entry screen
  useEffect(() => {
    if (gameState !== 'new_high_score') return;

    const handleInitialsKey = (e: KeyboardEvent) => {
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
    };

    window.addEventListener('keydown', handleInitialsKey);
    return () => window.removeEventListener('keydown', handleInitialsKey);
  }, [gameState, initialIndex, initials, score, wave, highScores]);

  // Main Canvas & Game Loop (mounted ONCE, completely stable)
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
      engineState.current.screenW = width;
      engineState.current.screenH = height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initial asteroids for attract mode floating drift
    if (engineState.current.asteroids.length === 0) {
      engineState.current.asteroids = spawnAsteroidWave(
        1,
        engineState.current.screenW || 800,
        engineState.current.screenH || 600
      );
    }

    // Wrap position across toroidal space
    const wrap = (obj: { x: number; y: number }, r: number, w: number, h: number) => {
      if (obj.x < -r) obj.x = w + r;
      else if (obj.x > w + r) obj.x = -r;
      if (obj.y < -r) obj.y = h + r;
      else if (obj.y > h + r) obj.y = -r;
    };

    // Vector drawing helper: renders object and duplicate ghost images if crossing boundaries
    const renderWrapped = (
      x: number,
      y: number,
      r: number,
      w: number,
      h: number,
      drawFn: (ox: number, oy: number) => void
    ) => {
      drawFn(x, y);
      const nearLeft = x - r < 0;
      const nearRight = x + r > w;
      const nearTop = y - r < 0;
      const nearBottom = y + r > h;

      if (nearLeft) drawFn(x + w, y);
      if (nearRight) drawFn(x - w, y);
      if (nearTop) drawFn(x, y + h);
      if (nearBottom) drawFn(x, y - h);

      if (nearLeft && nearTop) drawFn(x + w, y + h);
      if (nearLeft && nearBottom) drawFn(x + w, y - h);
      if (nearRight && nearTop) drawFn(x - w, y + h);
      if (nearRight && nearBottom) drawFn(x - w, y - h);
    };

    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const w = Math.max(engineState.current.screenW || 0, 800);
      const h = Math.max(engineState.current.screenH || 0, 600);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const colors = getThemeColors();
      const paused = isPausedRef.current;

      // Clear Canvas
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#030508';
      ctx.fillRect(0, 0, w, h);

      // Starfield dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 137.5) % w;
        const sy = (i * 269.3) % h;
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }

      // --- 1. SHIP UPDATE & RENDER ---
      const ship = engineState.current.ship;
      const controls = controlsRef.current;

      if (ship && !paused && engineState.current.status === 'playing') {
        const rotSpeed = 3.8;
        if (controls.rotateLeft) ship.angle -= rotSpeed * dt;
        if (controls.rotateRight) ship.angle += rotSpeed * dt;

        ship.thrusting = controls.thrust;
        if (ship.thrusting) {
          const thrustAccel = 260;
          ship.vx += Math.cos(ship.angle) * thrustAccel * dt;
          ship.vy += Math.sin(ship.angle) * thrustAccel * dt;
          retroAudio.thrust();

          if (Math.random() < 0.6) {
            const flameAngle = ship.angle + Math.PI + (Math.random() - 0.5) * 0.4;
            engineState.current.debris.push({
              x: ship.x - Math.cos(ship.angle) * 12,
              y: ship.y - Math.sin(ship.angle) * 12,
              vx: Math.cos(flameAngle) * (40 + Math.random() * 60) + ship.vx * 0.5,
              vy: Math.sin(flameAngle) * (40 + Math.random() * 60) + ship.vy * 0.5,
              life: 0.15 + Math.random() * 0.15,
              maxLife: 0.3,
              color: '#f97316',
              length: 2,
              angle: 0,
              rotSpeed: 0,
            });
          }
        }

        const drag = Math.pow(0.985, dt * 60);
        ship.vx *= drag;
        ship.vy *= drag;

        const currentSpeed = Math.hypot(ship.vx, ship.vy);
        const maxSpeed = 380;
        if (currentSpeed > maxSpeed) {
          ship.vx = (ship.vx / currentSpeed) * maxSpeed;
          ship.vy = (ship.vy / currentSpeed) * maxSpeed;
        }

        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        wrap(ship, ship.radius, w, h);

        if (ship.invulnerableTime > 0) {
          ship.invulnerableTime -= dt;
        }

        // Fire laser
        if (controls.fire && currentTime - engineState.current.lastFireTime > 180) {
          if (engineState.current.bullets.filter(b => !b.fromSaucer).length < 4) {
            engineState.current.lastFireTime = currentTime;
            const muzzleX = ship.x + Math.cos(ship.angle) * 16;
            const muzzleY = ship.y + Math.sin(ship.angle) * 16;
            const bulletSpeed = 520;
            engineState.current.bullets.push({
              x: muzzleX,
              y: muzzleY,
              vx: Math.cos(ship.angle) * bulletSpeed + ship.vx * 0.3,
              vy: Math.sin(ship.angle) * bulletSpeed + ship.vy * 0.3,
              life: 1.1,
              fromSaucer: false,
            });
            retroAudio.laser();
          }
        }

        if (controls.hyperspace) {
          controls.hyperspace = false;
          triggerHyperspace();
        }
      }

      // Render Ship
      if (ship) {
        const isBlinking = ship.invulnerableTime > 0 && Math.floor(ship.invulnerableTime * 8) % 2 === 0;
        if (!isBlinking) {
          renderWrapped(ship.x, ship.y, ship.radius, w, h, (ox, oy) => {
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(ship.angle);

            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = 2.2;
            ctx.lineJoin = 'miter';
            ctx.shadowColor = colors.glow;
            ctx.shadowBlur = 12;

            ctx.beginPath();
            ctx.moveTo(16, 0);
            ctx.lineTo(-12, -10);
            ctx.lineTo(-7, 0);
            ctx.lineTo(-12, 10);
            ctx.closePath();
            ctx.stroke();

            if (ship.thrusting && Math.random() > 0.15) {
              ctx.strokeStyle = '#f97316';
              ctx.shadowColor = 'rgba(249, 115, 22, 0.8)';
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.moveTo(-7, -4);
              ctx.lineTo(-18 - Math.random() * 8, 0);
              ctx.lineTo(-7, 4);
              ctx.stroke();
            }

            if (ship.invulnerableTime > 0) {
              ctx.strokeStyle = colors.accent;
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.arc(0, 0, 20, 0, Math.PI * 2);
              ctx.stroke();
            }

            ctx.restore();
          });
        }
      }

      // --- 2. BULLETS UPDATE & RENDER ---
      const activeBullets: Bullet[] = [];
      for (const bullet of engineState.current.bullets) {
        if (!paused) {
          bullet.x += bullet.vx * dt;
          bullet.y += bullet.vy * dt;
          wrap(bullet, 4, w, h);
          bullet.life -= dt;
        }

        if (bullet.life > 0) {
          activeBullets.push(bullet);

          ctx.save();
          ctx.fillStyle = bullet.fromSaucer ? colors.ufo : colors.stroke;
          ctx.shadowColor = bullet.fromSaucer ? colors.ufo : colors.glow;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      engineState.current.bullets = activeBullets;

      // --- 3. ASTEROIDS UPDATE & RENDER (Always moves, even in attract mode!) ---
      for (const ast of engineState.current.asteroids) {
        if (!paused) {
          ast.x += ast.vx * dt;
          ast.y += ast.vy * dt;
          ast.angle += ast.rotSpeed;
          wrap(ast, ast.radius, w, h);
        }

        renderWrapped(ast.x, ast.y, ast.radius, w, h, (ox, oy) => {
          ctx.save();
          ctx.translate(ox, oy);
          ctx.rotate(ast.angle);

          ctx.strokeStyle = colors.stroke;
          ctx.lineWidth = 2.0;
          ctx.lineJoin = 'round';
          ctx.shadowColor = colors.glow;
          ctx.shadowBlur = 8;

          ctx.beginPath();
          for (let i = 0; i < ast.points.length; i++) {
            const [px, py] = ast.points[i];
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        });
      }

      // --- 4. SAUCER UPDATE & RENDER ---
      const saucer = engineState.current.saucer;
      if (!paused && engineState.current.status === 'playing') {
        if (!saucer.active) {
          saucer.timer += dt;
          if (saucer.timer >= engineState.current.nextSaucerAt) {
            saucer.active = true;
            saucer.timer = 0;
            saucer.isSmall = engineState.current.score > 4000 || engineState.current.wave >= 3;
            const fromLeft = Math.random() < 0.5;
            saucer.x = fromLeft ? -20 : w + 20;
            saucer.y = Math.random() * (h - 160) + 80;
            const speed = saucer.isSmall ? 180 : 120;
            saucer.vx = fromLeft ? speed : -speed;
            saucer.vy = 0;
            saucer.fireTimer = 0;
            saucer.dirChangeTimer = 0;
            retroAudio.startSaucerSound(saucer.isSmall);
          }
        } else {
          saucer.x += saucer.vx * dt;
          saucer.y += saucer.vy * dt;

          saucer.dirChangeTimer += dt;
          if (saucer.dirChangeTimer > 2.5) {
            saucer.dirChangeTimer = 0;
            const dirs = [0, 60, -60];
            saucer.vy = dirs[Math.floor(Math.random() * dirs.length)];
          }

          if ((saucer.vx > 0 && saucer.x > w + 40) || (saucer.vx < 0 && saucer.x < -40)) {
            saucer.active = false;
            retroAudio.stopSaucerSound();
            engineState.current.nextSaucerAt = 20 + Math.random() * 15;
          }

          saucer.fireTimer += dt;
          const fireInterval = saucer.isSmall ? 1.4 : 2.2;
          if (saucer.fireTimer >= fireInterval) {
            saucer.fireTimer = 0;
            let fireAngle = Math.random() * Math.PI * 2;

            if (saucer.isSmall && ship) {
              const dx = ship.x - saucer.x;
              const dy = ship.y - saucer.y;
              fireAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.35;
            }

            const bulletSpeed = 280;
            engineState.current.bullets.push({
              x: saucer.x,
              y: saucer.y,
              vx: Math.cos(fireAngle) * bulletSpeed,
              vy: Math.sin(fireAngle) * bulletSpeed,
              life: 1.8,
              fromSaucer: true,
            });
            retroAudio.laser();
          }

          const sr = saucer.isSmall ? 10 : 18;
          ctx.save();
          ctx.strokeStyle = colors.ufo;
          ctx.lineWidth = 2.0;
          ctx.shadowColor = colors.ufo;
          ctx.shadowBlur = 10;

          ctx.beginPath();
          ctx.moveTo(saucer.x - sr, saucer.y);
          ctx.lineTo(saucer.x + sr, saucer.y);
          ctx.lineTo(saucer.x + sr * 0.6, saucer.y + sr * 0.45);
          ctx.lineTo(saucer.x - sr * 0.6, saucer.y + sr * 0.45);
          ctx.closePath();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(saucer.x - sr, saucer.y);
          ctx.lineTo(saucer.x - sr * 0.4, saucer.y - sr * 0.4);
          ctx.lineTo(saucer.x + sr * 0.4, saucer.y - sr * 0.4);
          ctx.lineTo(saucer.x + sr, saucer.y);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(saucer.x, saucer.y - sr * 0.4, sr * 0.3, Math.PI, 0);
          ctx.stroke();

          ctx.restore();
        }
      }

      // --- 5. DEBRIS & PARTICLES ---
      const activeDebris: DebrisParticle[] = [];
      for (const p of engineState.current.debris) {
        if (!paused) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.angle += p.rotSpeed;
          p.life -= dt;
        }

        if (p.life > 0) {
          activeDebris.push(p);

          ctx.save();
          const alpha = p.life / p.maxLife;
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;

          ctx.beginPath();
          ctx.moveTo(
            p.x - Math.cos(p.angle) * p.length * 0.5,
            p.y - Math.sin(p.angle) * p.length * 0.5
          );
          ctx.lineTo(
            p.x + Math.cos(p.angle) * p.length * 0.5,
            p.y + Math.sin(p.angle) * p.length * 0.5
          );
          ctx.stroke();
          ctx.restore();
        }
      }
      engineState.current.debris = activeDebris;

      // --- 6. COLLISIONS ---
      if (!paused && engineState.current.status === 'playing') {
        const nextAsteroids: Asteroid[] = [];
        let scoreGained = 0;

        for (const ast of engineState.current.asteroids) {
          let destroyed = false;

          for (let bIdx = engineState.current.bullets.length - 1; bIdx >= 0; bIdx--) {
            const b = engineState.current.bullets[bIdx];
            if (b.fromSaucer) continue;

            if (Math.hypot(b.x - ast.x, b.y - ast.y) < ast.radius + 3) {
              destroyed = true;
              b.life = 0;
              break;
            }
          }

          if (destroyed) {
            spawnDebris(ast.x, ast.y, ast.tier * 6, ast.tier * 0.8);
            if (ast.tier === 3) {
              retroAudio.explosion('large');
              scoreGained += 20;
              nextAsteroids.push(createAsteroid(ast.x, ast.y, 2));
              nextAsteroids.push(createAsteroid(ast.x, ast.y, 2));
            } else if (ast.tier === 2) {
              retroAudio.explosion('med');
              scoreGained += 50;
              nextAsteroids.push(createAsteroid(ast.x, ast.y, 1));
              nextAsteroids.push(createAsteroid(ast.x, ast.y, 1));
            } else {
              retroAudio.explosion('small');
              scoreGained += 100;
            }
          } else {
            nextAsteroids.push(ast);
          }
        }
        engineState.current.asteroids = nextAsteroids;

        // Bullets vs Saucer
        if (saucer.active) {
          const sr = saucer.isSmall ? 12 : 20;
          for (const b of engineState.current.bullets) {
            if (!b.fromSaucer && Math.hypot(b.x - saucer.x, b.y - saucer.y) < sr + 3) {
              b.life = 0;
              saucer.active = false;
              retroAudio.stopSaucerSound();
              retroAudio.explosion('large');
              spawnDebris(saucer.x, saucer.y, 24, 2);
              scoreGained += saucer.isSmall ? 1000 : 200;
              engineState.current.nextSaucerAt = 25 + Math.random() * 15;
              break;
            }
          }
        }

        // Bullets vs Ship
        if (ship && ship.invulnerableTime <= 0) {
          for (const b of engineState.current.bullets) {
            if (b.fromSaucer && Math.hypot(b.x - ship.x, b.y - ship.y) < ship.radius + 3) {
              b.life = 0;
              killShip();
              break;
            }
          }
        }

        // Ship vs Asteroid Collision
        if (ship && ship.invulnerableTime <= 0) {
          for (const ast of engineState.current.asteroids) {
            if (Math.hypot(ship.x - ast.x, ship.y - ast.y) < ship.radius + ast.radius * 0.75) {
              killShip();
              break;
            }
          }
        }

        // Ship vs Saucer Collision
        if (ship && saucer.active && ship.invulnerableTime <= 0) {
          const sr = saucer.isSmall ? 12 : 20;
          if (Math.hypot(ship.x - saucer.x, ship.y - saucer.y) < ship.radius + sr) {
            saucer.active = false;
            retroAudio.stopSaucerSound();
            killShip();
          }
        }

        if (scoreGained > 0) {
          const newScore = engineState.current.score + scoreGained;
          engineState.current.score = newScore;
          setScore(newScore);

          if (newScore >= engineState.current.nextExtraLife) {
            engineState.current.lives += 1;
            engineState.current.nextExtraLife += 10000;
            setLives(engineState.current.lives);
            retroAudio.extraLife();
          }
        }

        // Wave Completion check
        if (engineState.current.asteroids.length === 0 && !saucer.active) {
          engineState.current.waveClearCooldown += dt;
          if (engineState.current.waveClearCooldown > 1.5) {
            engineState.current.waveClearCooldown = 0;
            const nextWave = engineState.current.wave + 1;
            engineState.current.wave = nextWave;
            setWave(nextWave);
            engineState.current.asteroids = spawnAsteroidWave(nextWave, w, h);
            retroAudio.extraLife();
          }
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
      retroAudio.stopSaucerSound();
    };
  }, [triggerHyperspace]);

  // Touch controls helpers
  const handleTouchDown = (action: keyof ArcadeControlsState) => {
    controlsRef.current[action] = true;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // ignore
      }
    }
  };

  const handleTouchUp = (action: keyof ArcadeControlsState) => {
    controlsRef.current[action] = false;
  };

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-[#030508]">
      {/* Top HUD Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 bg-[#060911] border-b border-cyan-900/40 text-xs font-arcade tracking-wider z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">1UP SCORE</span>
            <span className="text-cyan-300 font-bold text-sm tracking-widest">
              {score.toString().padStart(6, '0')}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">HIGH SCORE</span>
            <span className="text-pink-400 font-bold text-sm tracking-widest">
              {(highScores[0]?.score || 0).toString().padStart(6, '0')}
            </span>
          </div>

          {gameState === 'playing' && (
            <div className="hidden sm:flex flex-col">
              <span className="text-[9px] text-gray-500">WAVE</span>
              <span className="text-yellow-400 font-bold text-sm">#{wave}</span>
            </div>
          )}
        </div>

        {/* Lives Counter as mini vector ship icons */}
        <div className="flex items-center gap-3">
          {gameState === 'playing' && (
            <div className="flex items-center gap-1.5 mr-2">
              {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                <svg key={i} className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="12,2 4,20 12,16 20,20" />
                </svg>
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
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
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
              className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-[10px] text-cyan-300 cursor-pointer"
            >
              CABINET ROW
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport with CRT styling */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center p-1 sm:p-3">
        <div className={`relative w-full h-full max-w-[1020px] max-h-[760px] rounded-lg overflow-hidden arcade-bezel ${scanlines ? 'crt-overlay crt-vignette' : ''}`}>
          <canvas
            ref={canvasRef}
            onClick={() => {
              if (gameState === 'attract') {
                startGame();
              }
            }}
            className="w-full h-full block bg-[#030508] cursor-pointer"
          />

          {/* OVERLAY: Attract Mode Screen */}
          {gameState === 'attract' && (
            <div
              onClick={startGame}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px] p-4 text-center z-30 cursor-pointer"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="max-w-md w-full p-6 rounded-xl border border-cyan-500/50 bg-[#060912]/95 shadow-[0_0_35px_rgba(6,182,212,0.4)]"
              >
                <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950 border border-cyan-400/50 text-[10px] font-arcade text-cyan-300">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>ATARI 1979 VECTOR CLASSIC</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-arcade text-cyan-300 font-extrabold tracking-widest crt-glow mb-2">
                  ASTEROIDS
                </h1>
                <p className="text-xs text-gray-400 font-mono mb-5">
                  AUTHENTIC VECTOR INERTIA & HYPERSPACE
                </p>

                {/* Score legend */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-arcade text-left bg-black/60 p-3 rounded-lg border border-gray-800 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                    <span className="text-gray-300">LARGE: 20 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-300"></span>
                    <span className="text-gray-300">MED: 50 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-200"></span>
                    <span className="text-gray-300">SMALL: 100 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-pink-500"></span>
                    <span className="text-pink-300">UFO: 200/1000 PTS</span>
                  </div>
                </div>

                {/* Big Instant Launch Button */}
                <div className="space-y-2.5">
                  <button
                    onClick={startGame}
                    className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-arcade text-sm font-bold tracking-widest shadow-[0_0_25px_rgba(6,182,212,0.8)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>PRESS TO PLAY NOW</span>
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
                  <span>[↑] THRUST</span>
                  <span>[SPACE] FIRE</span>
                  <span>[SHIFT] HYPERSPACE</span>
                </div>
              </div>
            </div>
          )}

          {/* OVERLAY: Game Over */}
          {gameState === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border-2 border-red-500/60 bg-[#0c0608]/95 shadow-[0_0_35px_rgba(239,68,68,0.5)]">
                <h2 className="text-2xl sm:text-3xl font-arcade text-red-500 font-bold tracking-widest mb-2 crt-glow">
                  GAME OVER
                </h2>
                <div className="text-sm font-arcade text-gray-300 mb-1">
                  FINAL SCORE: <span className="text-cyan-300">{score}</span>
                </div>
                <div className="text-xs font-arcade text-gray-500 mb-6">
                  WAVES SURVIVED: {wave}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={startGame}
                    className="w-full py-3 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-arcade text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.5)] cursor-pointer"
                  >
                    PLAY AGAIN
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

          {/* OVERLAY: New High Score Initials Entry */}
          {gameState === 'new_high_score' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border-2 border-yellow-500/80 bg-[#0e0c06]/95 shadow-[0_0_35px_rgba(234,179,8,0.5)]">
                <div className="flex items-center justify-center gap-2 mb-2 text-yellow-400 font-arcade text-xs">
                  <Trophy className="w-4 h-4 text-yellow-400 animate-bounce" />
                  <span>NEW HIGH SCORE!</span>
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

                <div className="text-[9px] font-mono text-gray-400">
                  USE ARROW KEYS OR CLICK TO EDIT INITIALS
                </div>
              </div>
            </div>
          )}

          {/* Pause overlay */}
          {isPaused && gameState === 'playing' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-30">
              <div className="px-6 py-4 rounded-xl border border-cyan-400 bg-black/90 text-center shadow-[0_0_30px_rgba(6,182,212,0.5)]">
                <h3 className="text-xl font-arcade text-cyan-300 font-bold mb-3">PAUSED</h3>
                <button
                  onClick={() => setIsPaused(false)}
                  className="px-5 py-2.5 rounded bg-cyan-600 text-black font-arcade text-xs font-bold cursor-pointer hover:bg-cyan-500"
                >
                  RESUME GAME
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* On-Screen Mobile Virtual Arcade Controls */}
      <div className="w-full bg-[#05070d] border-t border-cyan-950/60 p-2 sm:p-3 flex items-center justify-between z-20">
        {/* Left Hand: Steering / Thrust controls */}
        <div className="flex items-center gap-2">
          <button
            onPointerDown={() => handleTouchDown('rotateLeft')}
            onPointerUp={() => handleTouchUp('rotateLeft')}
            onPointerLeave={() => handleTouchUp('rotateLeft')}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gray-900 border border-cyan-500/40 active:bg-cyan-600 active:text-black text-cyan-400 font-arcade text-xs flex items-center justify-center transition-all select-none shadow-md cursor-pointer"
            aria-label="Turn Left"
          >
            ◀
          </button>

          <button
            onPointerDown={() => handleTouchDown('thrust')}
            onPointerUp={() => handleTouchUp('thrust')}
            onPointerLeave={() => handleTouchUp('thrust')}
            className="w-14 h-12 sm:w-16 sm:h-14 rounded-lg bg-gray-900 border border-orange-500/50 active:bg-orange-500 active:text-black text-orange-400 font-arcade text-[10px] flex flex-col items-center justify-center transition-all select-none shadow-md cursor-pointer"
            aria-label="Thrust Engine"
          >
            <span>▲</span>
            <span className="text-[8px] font-sans">THRUST</span>
          </button>

          <button
            onPointerDown={() => handleTouchDown('rotateRight')}
            onPointerUp={() => handleTouchUp('rotateRight')}
            onPointerLeave={() => handleTouchUp('rotateRight')}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gray-900 border border-cyan-500/40 active:bg-cyan-600 active:text-black text-cyan-400 font-arcade text-xs flex items-center justify-center transition-all select-none shadow-md cursor-pointer"
            aria-label="Turn Right"
          >
            ▶
          </button>
        </div>

        {/* Center info */}
        <div className="hidden md:flex flex-col items-center text-center">
          <div className="text-[9px] font-arcade text-gray-500 flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{hasGamepad ? 'CONTROLLER CONNECTED' : 'KEYBOARD & TOUCH ACTIVE'}</span>
          </div>
          <span className="text-[8px] text-gray-600 font-mono mt-0.5">
            SPACE TO FIRE • UP TO THRUST • SHIFT FOR HYPERSPACE
          </span>
        </div>

        {/* Right Hand: Action buttons (Fire & Hyperspace) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onPointerDown={() => handleTouchDown('hyperspace')}
            onPointerUp={() => handleTouchUp('hyperspace')}
            onPointerLeave={() => handleTouchUp('hyperspace')}
            className="w-14 h-12 sm:w-16 sm:h-14 rounded-lg bg-blue-950/80 border border-blue-400/50 active:bg-blue-500 active:text-white text-blue-300 font-arcade text-[9px] flex flex-col items-center justify-center transition-all select-none shadow-[0_0_10px_rgba(59,130,246,0.3)] cursor-pointer"
            aria-label="Hyperspace Jump"
          >
            <Zap className="w-3.5 h-3.5 mb-0.5 text-blue-400" />
            <span className="text-[7.5px]">HYPER</span>
          </button>

          <button
            onPointerDown={() => handleTouchDown('fire')}
            onPointerUp={() => handleTouchUp('fire')}
            onPointerLeave={() => handleTouchUp('fire')}
            className="w-16 h-12 sm:w-20 sm:h-14 rounded-lg bg-gradient-to-b from-rose-600 to-red-700 border-2 border-red-400 active:from-red-400 active:to-rose-500 text-white font-arcade text-xs font-bold tracking-wider flex items-center justify-center transition-all select-none shadow-[0_0_15px_rgba(244,63,94,0.6)] cursor-pointer"
            aria-label="Fire Lasers"
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
};
