import React, { useEffect, useRef, useState, useCallback } from 'react';
import { retroAudio } from '../../audio/retroAudio';
import { ArcadeControlsState } from '../../input/useArcadeInput';
import {
  City,
  Silo,
  IncomingICBM,
  PlayerABM,
  ExplosionCloud,
  EnemyAircraft,
  MissileCommandHighScore,
} from './types';
import {
  Trophy,
  Sparkles,
  Volume2,
  VolumeX,
  Crosshair,
  Shield,
  Play,
  Flame,
  Building,
} from 'lucide-react';

interface MissileCommandProps {
  controlsRef: React.MutableRefObject<ArcadeControlsState>;
  onBackToArcade?: () => void;
  credits: number;
  onUseCredit: () => boolean;
  scanlines: boolean;
  hasGamepad: boolean;
}

const DEFAULT_MISSILE_SCORES: MissileCommandHighScore[] = [
  { initials: 'NOR', score: 34500, wave: 8, date: '1981' },
  { initials: 'DEF', score: 22800, wave: 6, date: '1980' },
  { initials: 'DAL', score: 15400, wave: 4, date: '1982' },
  { initials: 'ABM', score: 9800, wave: 3, date: '1980' },
  { initials: 'CIT', score: 4200, wave: 2, date: '1983' },
];

export const MissileCommandGame: React.FC<MissileCommandProps> = ({
  controlsRef,
  onBackToArcade,
  credits,
  onUseCredit,
  scanlines,
  hasGamepad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [highScores, setHighScores] = useState<MissileCommandHighScore[]>(() => {
    try {
      const saved = localStorage.getItem('retro_arcade_missile_scores');
      return saved ? JSON.parse(saved) : DEFAULT_MISSILE_SCORES;
    } catch {
      return DEFAULT_MISSILE_SCORES;
    }
  });

  const [gameState, setGameState] = useState<'attract' | 'playing' | 'wave_clear' | 'gameover' | 'new_high_score'>('attract');
  const [score, setScore] = useState(0);
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

  // Main Game Engine State
  const engine = useRef({
    status: 'attract' as 'attract' | 'playing' | 'wave_clear' | 'gameover' | 'new_high_score',
    score: 0,
    wave: 1,
    multiplier: 1,
    crosshairX: 400,
    crosshairY: 300,
    cities: [] as City[],
    silos: [] as Silo[],
    icbms: [] as IncomingICBM[],
    abms: [] as PlayerABM[],
    explosions: [] as ExplosionCloud[],
    aircraft: [] as EnemyAircraft[],
    icbmsToSpawn: 0,
    spawnCooldown: 0,
    waveClearTimer: 0,
    tallyStep: 0,
    tallyBonus: 0,
    nextRebuildScore: 10000,
    screenW: 800,
    screenH: 600,
  });

  // Setup Cities and 3 Silos
  const initDefenses = (w: number, h: number) => {
    const groundY = h - 36;
    const cities: City[] = [
      { id: 1, x: w * 0.20, y: groundY, alive: true },
      { id: 2, x: w * 0.28, y: groundY, alive: true },
      { id: 3, x: w * 0.36, y: groundY, alive: true },
      { id: 4, x: w * 0.64, y: groundY, alive: true },
      { id: 5, x: w * 0.72, y: groundY, alive: true },
      { id: 6, x: w * 0.80, y: groundY, alive: true },
    ];

    const silos: Silo[] = [
      { id: 1, x: w * 0.08, y: groundY, missiles: 10, maxMissiles: 10, alive: true, label: 'ALPHA' },
      { id: 2, x: w * 0.50, y: groundY - 4, missiles: 10, maxMissiles: 10, alive: true, label: 'DELTA' },
      { id: 3, x: w * 0.92, y: groundY, missiles: 10, maxMissiles: 10, alive: true, label: 'OMEGA' },
    ];

    return { cities, silos };
  };

  // Start Missile Command
  const startGame = useCallback(() => {
    if (credits > 0) {
      onUseCredit();
    } else {
      retroAudio.insertCoin();
    }

    const w = Math.max(engine.current.screenW || 0, 800);
    const h = Math.max(engine.current.screenH || 0, 600);
    const { cities, silos } = initDefenses(w, h);

    engine.current.status = 'playing';
    engine.current.score = 0;
    engine.current.wave = 1;
    engine.current.multiplier = 1;
    engine.current.crosshairX = w / 2;
    engine.current.crosshairY = h / 2;
    engine.current.cities = cities;
    engine.current.silos = silos;
    engine.current.icbms = [];
    engine.current.abms = [];
    engine.current.explosions = [];
    engine.current.aircraft = [];
    engine.current.icbmsToSpawn = 12;
    engine.current.spawnCooldown = 0.5;
    engine.current.waveClearTimer = 0;
    engine.current.nextRebuildScore = 10000;

    setScore(0);
    setWave(1);
    setGameState('playing');
    setIsPaused(false);
    retroAudio.extraLife();
  }, [credits, onUseCredit]);

  // Fire an ABM from specific silo or nearest available
  const fireABM = useCallback((targetX: number, targetY: number, preferredSiloIdx?: number) => {
    const state = engine.current;
    if (state.status !== 'playing' || isPausedRef.current) return;

    // Filter available silos with ammo
    const availableSilos = state.silos.filter(s => s.alive && s.missiles > 0);
    if (availableSilos.length === 0) return;

    let chosenSilo: Silo | null = null;
    if (preferredSiloIdx !== undefined && state.silos[preferredSiloIdx]?.alive && state.silos[preferredSiloIdx].missiles > 0) {
      chosenSilo = state.silos[preferredSiloIdx];
    } else {
      // Pick nearest silo with missiles
      let bestDist = Infinity;
      for (const silo of availableSilos) {
        const d = Math.abs(silo.x - targetX);
        if (d < bestDist) {
          bestDist = d;
          chosenSilo = silo;
        }
      }
    }

    if (!chosenSilo) return;

    chosenSilo.missiles -= 1;
    retroAudio.abmLaunch();

    // Center Delta silo fires faster ABMs!
    const speed = chosenSilo.label === 'DELTA' ? 580 : 440;

    state.abms.push({
      id: Math.random(),
      startX: chosenSilo.x,
      startY: chosenSilo.y - 12,
      x: chosenSilo.x,
      y: chosenSilo.y - 12,
      targetX,
      targetY,
      speed,
      reached: false,
    });
  }, []);

  // Trigger firecloud explosion
  const triggerExplosion = (x: number, y: number, source: 'player' | 'icbm' = 'player') => {
    retroAudio.firecloudBoom();
    engine.current.explosions.push({
      id: Math.random(),
      x,
      y,
      radius: 4,
      maxRadius: source === 'player' ? 38 : 26,
      growing: true,
      life: 0.9,
      maxLife: 0.9,
      color: '#fbbf24',
      source,
    });
  };

  // Save High Score
  const saveHighScore = () => {
    const initialsStr = initials.join('');
    const newEntry: MissileCommandHighScore = {
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
      localStorage.setItem('retro_arcade_missile_scores', JSON.stringify(updated));
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
        // 1/A = Left Silo, 2/S = Center Silo, 3/D = Right Silo
        if (e.code === 'Digit1' || e.code === 'KeyA') {
          fireABM(engine.current.crosshairX, engine.current.crosshairY, 0);
        } else if (e.code === 'Digit2' || e.code === 'KeyS' || e.code === 'Space') {
          fireABM(engine.current.crosshairX, engine.current.crosshairY, 1);
        } else if (e.code === 'Digit3' || e.code === 'KeyD') {
          fireABM(engine.current.crosshairX, engine.current.crosshairY, 2);
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, initialIndex, initials, score, wave, highScores, startGame, fireABM]);

  // Main Canvas & Game Loop
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
      const width = Math.floor(rect.width > 0 ? rect.width : 800);
      const height = Math.floor(rect.height > 0 ? rect.height : 600);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      engine.current.screenW = width;
      engine.current.screenH = height;

      if (engine.current.cities.length === 0) {
        const { cities, silos } = initDefenses(width, height);
        engine.current.cities = cities;
        engine.current.silos = silos;
        engine.current.icbmsToSpawn = 8;
        engine.current.spawnCooldown = 0.8;
      } else {
        const groundY = height - 36;
        engine.current.cities.forEach(c => {
          c.y = groundY;
          if (c.id === 1) c.x = Math.round(width * 0.20);
          if (c.id === 2) c.x = Math.round(width * 0.28);
          if (c.id === 3) c.x = Math.round(width * 0.36);
          if (c.id === 4) c.x = Math.round(width * 0.64);
          if (c.id === 5) c.x = Math.round(width * 0.72);
          if (c.id === 6) c.x = Math.round(width * 0.80);
        });
        engine.current.silos.forEach(s => {
          if (s.id === 1) { s.x = Math.round(width * 0.08); s.y = groundY; }
          if (s.id === 2) { s.x = Math.round(width * 0.50); s.y = groundY - 4; }
          if (s.id === 3) { s.x = Math.round(width * 0.92); s.y = groundY; }
        });
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const sw = Math.max(engine.current.screenW || 0, 800);
      const sh = Math.max(engine.current.screenH || 0, 600);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const paused = isPausedRef.current;
      const state = engine.current;

      // Reset matrix and apply device pixel ratio scaling cleanly
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep nocturnal ballistic sky
      ctx.fillStyle = '#050402';
      ctx.fillRect(0, 0, sw, sh);

      // Starfield dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      for (let i = 0; i < 45; i++) {
        const sx = (i * 189.7) % sw;
        const sy = (i * 97.3) % (sh - 60);
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }

      // --- 1. ICBM SPAWN & FLIGHT ---
      if (!paused && (state.status === 'playing' || state.status === 'attract')) {
        state.spawnCooldown -= dt;
        if (state.spawnCooldown <= 0) {
          const isPlaying = state.status === 'playing';
          if (isPlaying && state.icbmsToSpawn > 0) {
            state.spawnCooldown = Math.max(0.4, 2.2 - state.wave * 0.18);
            state.icbmsToSpawn -= 1;
          } else if (!isPlaying && state.icbms.length < 5) {
            // Ambient attract mode missiles
            state.spawnCooldown = 1.4;
          }

          if (isPlaying && state.icbmsToSpawn >= 0 || !isPlaying && state.icbms.length < 5) {
            // Pick random target: surviving city or silo
            const potentialTargets: { x: number; y: number }[] = [];
            state.cities.filter(c => c.alive).forEach(c => potentialTargets.push({ x: c.x, y: c.y }));
            state.silos.filter(s => s.alive).forEach(s => potentialTargets.push({ x: s.x, y: s.y }));

            const target = potentialTargets.length > 0
              ? potentialTargets[Math.floor(Math.random() * potentialTargets.length)]
              : { x: Math.random() * sw, y: sh - 36 };

            const startX = Math.random() * sw;
            const startY = 0;
            const baseSpeed = isPlaying
              ? (35 + state.wave * 8) * (0.85 + Math.random() * 0.35)
              : 32;
            const isMirv = isPlaying && state.wave >= 2 && Math.random() < 0.28;

            state.icbms.push({
              id: Math.random(),
              startX,
              startY,
              x: startX,
              y: startY,
              targetX: target.x,
              targetY: target.y,
              speed: baseSpeed,
              isMirv,
              hasMirved: false,
              color: '#ef4444',
            });
          }
        }
      }

      // Update ICBMs
      const activeIcbms: IncomingICBM[] = [];
      for (const icbm of state.icbms) {
        if (!paused && (state.status === 'playing' || state.status === 'attract')) {
          const dx = icbm.targetX - icbm.startX;
          const dy = icbm.targetY - icbm.startY;
          const dist = Math.hypot(dx, dy);
          const moveDist = icbm.speed * dt;

          const currDist = Math.hypot(icbm.x - icbm.startX, icbm.y - icbm.startY);
          const nextDist = currDist + moveDist;

          if (nextDist >= dist) {
            // Reached target -> Ground Impact!
            icbm.x = icbm.targetX;
            icbm.y = icbm.targetY;
            triggerExplosion(icbm.targetX, icbm.targetY, 'icbm');

            if (state.status === 'playing') {
              retroAudio.cityHitBoom();

              // Check if city was hit
              for (const city of state.cities) {
                if (city.alive && Math.abs(city.x - icbm.targetX) < 18) {
                  city.alive = false;
                  break;
                }
              }
              // Check if silo was hit
              for (const silo of state.silos) {
                if (silo.alive && Math.abs(silo.x - icbm.targetX) < 22) {
                  silo.alive = false;
                  silo.missiles = 0;
                  break;
                }
              }

              // Game over check: All cities destroyed?
              if (state.cities.every(c => !c.alive)) {
                state.status = 'gameover';
                setGameState('gameover');
                retroAudio.gameOver();
              }
            }
            continue;
          } else {
            icbm.x = icbm.startX + (dx / dist) * nextDist;
            icbm.y = icbm.startY + (dy / dist) * nextDist;

            // MIRV splitting at altitude
            if (icbm.isMirv && !icbm.hasMirved && icbm.y > sh * 0.35 && icbm.y < sh * 0.45) {
              icbm.hasMirved = true;
              // Split into two sub-warheads
              for (let i = 0; i < 2; i++) {
                const subTargetX = Math.random() * sw;
                state.icbms.push({
                  id: Math.random(),
                  startX: icbm.x,
                  startY: icbm.y,
                  x: icbm.x,
                  y: icbm.y,
                  targetX: subTargetX,
                  targetY: sh - 36,
                  speed: icbm.speed * 1.1,
                  isMirv: false,
                  hasMirved: true,
                  color: '#f97316',
                });
              }
            }
          }
        }

        activeIcbms.push(icbm);

        // Draw ICBM Red streak line
        ctx.save();
        ctx.strokeStyle = icbm.color;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = icbm.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(icbm.startX, icbm.startY);
        ctx.lineTo(icbm.x, icbm.y);
        ctx.stroke();

        // Glowing warhead tip
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(icbm.x, icbm.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      state.icbms = activeIcbms;

      // --- 2. PLAYER ABMs FLIGHT ---
      const activeAbms: PlayerABM[] = [];
      for (const abm of state.abms) {
        if (!paused && state.status === 'playing') {
          const dx = abm.targetX - abm.startX;
          const dy = abm.targetY - abm.startY;
          const totalDist = Math.hypot(dx, dy);
          const currDist = Math.hypot(abm.x - abm.startX, abm.y - abm.startY);
          const nextDist = currDist + abm.speed * dt;

          if (nextDist >= totalDist) {
            // Reached destination -> Detonate flak cloud!
            triggerExplosion(abm.targetX, abm.targetY, 'player');
            continue;
          } else {
            abm.x = abm.startX + (dx / totalDist) * nextDist;
            abm.y = abm.startY + (dy / totalDist) * nextDist;
          }
        }

        activeAbms.push(abm);

        // Draw ABM cyan/white launch vector streak
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(abm.startX, abm.startY);
        ctx.lineTo(abm.x, abm.y);
        ctx.stroke();

        // Tip cross marker
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(abm.x - 3, abm.y); ctx.lineTo(abm.x + 3, abm.y);
        ctx.moveTo(abm.x, abm.y - 3); ctx.lineTo(abm.x, abm.y + 3);
        ctx.stroke();
        ctx.restore();
      }
      state.abms = activeAbms;

      // --- 3. FLAK FIRECLOUD EXPLOSIONS & INTERCEPTIONS ---
      const activeExplosions: ExplosionCloud[] = [];
      for (const exp of state.explosions) {
        if (!paused && state.status === 'playing') {
          exp.life -= dt;
          if (exp.growing) {
            exp.radius += (exp.maxRadius / 0.35) * dt;
            if (exp.radius >= exp.maxRadius) {
              exp.radius = exp.maxRadius;
              exp.growing = false;
            }
          } else {
            exp.radius -= (exp.maxRadius / 0.55) * dt;
          }
        }

        if (exp.life > 0 && exp.radius > 1) {
          activeExplosions.push(exp);

          // Check interception against ICBMs (Chain reactions!)
          if (!paused && state.status === 'playing') {
            for (let i = state.icbms.length - 1; i >= 0; i--) {
              const icbm = state.icbms[i];
              if (Math.hypot(icbm.x - exp.x, icbm.y - exp.y) < exp.radius + 3) {
                // Destroyed ICBM!
                state.icbms.splice(i, 1);
                triggerExplosion(icbm.x, icbm.y, 'player');

                const points = 25 * state.multiplier;
                const newScore = state.score + points;
                state.score = newScore;
                setScore(newScore);

                // City rebuild check
                if (newScore >= state.nextRebuildScore) {
                  state.nextRebuildScore += 10000;
                  const deadCity = state.cities.find(c => !c.alive);
                  if (deadCity) {
                    deadCity.alive = true;
                    retroAudio.extraLife();
                  }
                }
              }
            }
          }

          // Draw Flak Firecloud
          ctx.save();
          const progress = 1 - (exp.life / exp.maxLife);
          // Color shifts: white -> amber -> orange -> red -> dark crimson
          const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
          if (progress < 0.25) {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.5, '#fef08a');
            gradient.addColorStop(1, 'rgba(245, 158, 11, 0.4)');
          } else if (progress < 0.6) {
            gradient.addColorStop(0, '#fde047');
            gradient.addColorStop(0.6, '#f97316');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
          } else {
            gradient.addColorStop(0, '#ef4444');
            gradient.addColorStop(0.7, '#991b1b');
            gradient.addColorStop(1, 'rgba(153, 27, 27, 0)');
          }

          ctx.fillStyle = gradient;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
          ctx.fill();

          // Outer shockwave ring
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      state.explosions = activeExplosions;

      // --- 4. WAVE COMPLETION CHECK & BONUS TALLY ---
      if (
        !paused &&
        state.status === 'playing' &&
        state.icbmsToSpawn === 0 &&
        state.icbms.length === 0 &&
        state.abms.length === 0 &&
        state.explosions.length === 0
      ) {
        state.status = 'wave_clear';
        setGameState('wave_clear');
        state.waveClearTimer = 3.5;

        // Calculate wave clear bonuses
        const survivingCities = state.cities.filter(c => c.alive).length;
        const remainingMissiles = state.silos.reduce((sum, s) => sum + s.missiles, 0);
        const waveBonus = survivingCities * 100 * state.multiplier + remainingMissiles * 5 * state.multiplier;

        state.tallyBonus = waveBonus;
        state.score += waveBonus;
        setScore(state.score);
        retroAudio.extraLife();
      }

      if (state.status === 'wave_clear') {
        state.waveClearTimer -= dt;
        if (state.waveClearTimer <= 0) {
          // Advance to next wave
          const nextWave = state.wave + 1;
          state.wave = nextWave;
          setWave(nextWave);
          state.multiplier = Math.min(6, Math.floor(nextWave / 2) + 1);
          state.icbmsToSpawn = 12 + nextWave * 4;
          state.spawnCooldown = 1.0;

          // Reload silos
          state.silos.forEach(s => {
            s.alive = true;
            s.missiles = s.maxMissiles;
          });

          state.status = 'playing';
          setGameState('playing');
        }
      }

      // --- 5. GROUND TERRAIN, CITIES & SILOS RENDERING ---
      const groundY = sh - 36;

      // Golden Terrain Base
      ctx.fillStyle = '#b45309'; // Warm amber golden earth
      ctx.beginPath();
      ctx.moveTo(0, groundY + 12);

      // Undulating hills for silos
      ctx.lineTo(sw * 0.04, groundY + 12);
      ctx.lineTo(sw * 0.08, groundY - 14); // Silo Alpha hill
      ctx.lineTo(sw * 0.12, groundY + 12);

      ctx.lineTo(sw * 0.46, groundY + 12);
      ctx.lineTo(sw * 0.50, groundY - 18); // Silo Delta hill
      ctx.lineTo(sw * 0.54, groundY + 12);

      ctx.lineTo(sw * 0.88, groundY + 12);
      ctx.lineTo(sw * 0.92, groundY - 14); // Silo Omega hill
      ctx.lineTo(sw * 0.96, groundY + 12);

      ctx.lineTo(sw, groundY + 12);
      ctx.lineTo(sw, sh);
      ctx.lineTo(0, sh);
      ctx.closePath();
      ctx.fill();

      // Top glowing neon edge of ground
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Draw Cities
      for (const city of state.cities) {
        if (city.alive) {
          // Authentic retro multi-building skyline silhouette
          ctx.fillStyle = '#06b6d4'; // Cyan neon city buildings
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 8;

          // 3 buildings
          ctx.fillRect(city.x - 14, city.y - 14, 8, 14);
          ctx.fillRect(city.x - 4, city.y - 20, 10, 20);
          ctx.fillRect(city.x + 8, city.y - 12, 7, 12);

          // Glowing windows
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(city.x - 12, city.y - 10, 2, 2);
          ctx.fillRect(city.x - 2, city.y - 16, 2, 2);
          ctx.fillRect(city.x + 2, city.y - 10, 2, 2);
        } else {
          // Destroyed city rubble
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(city.x - 14, city.y);
          ctx.lineTo(city.x - 8, city.y - 4);
          ctx.lineTo(city.x, city.y - 2);
          ctx.lineTo(city.x + 8, city.y - 5);
          ctx.lineTo(city.x + 14, city.y);
          ctx.stroke();
        }
      }

      // Draw Silos (Missile Batteries)
      for (const silo of state.silos) {
        if (silo.alive) {
          // Silo bunker roof
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(silo.x - 10, silo.y - 12, 20, 6);

          // Draw stacked missile indicator dots
          ctx.fillStyle = '#38bdf8';
          for (let m = 0; m < silo.missiles; m++) {
            const row = Math.floor(m / 5);
            const col = m % 5;
            ctx.fillRect(silo.x - 8 + col * 4, silo.y - 4 + row * 4, 2.5, 3);
          }
        } else {
          // Destroyed silo marker: "OUT"
          ctx.fillStyle = '#ef4444';
          ctx.font = '8px monospace';
          ctx.fillText('OUT', silo.x - 8, silo.y);
        }
      }

      // --- 6. TARGETING CROSSHAIR ---
      const chX = state.crosshairX;
      const chY = state.crosshairY;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(chX - 10, chY); ctx.lineTo(chX - 3, chY);
      ctx.moveTo(chX + 3, chY); ctx.lineTo(chX + 10, chY);
      ctx.moveTo(chX, chY - 10); ctx.lineTo(chX, chY - 3);
      ctx.moveTo(chX, chY + 3); ctx.lineTo(chX, chY + 10);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.restore();

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [triggerExplosion]);

  // Pointer move & click tracking for targeting
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    engine.current.crosshairX = e.clientX - rect.left;
    engine.current.crosshairY = e.clientY - rect.top;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState === 'attract') {
      startGame();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const targetX = e.clientX - rect.left;
    const targetY = e.clientY - rect.top;
    engine.current.crosshairX = targetX;
    engine.current.crosshairY = targetY;

    // Fire from closest available silo!
    fireABM(targetX, targetY);
  };

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-[#030508]">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 bg-[#080504] border-b border-amber-900/50 text-xs font-arcade tracking-wider z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">DEFENSE SCORE</span>
            <span className="text-amber-400 font-bold text-sm tracking-widest">
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
              <span className="text-[9px] text-gray-500">ATTACK WAVE</span>
              <span className="text-cyan-400 font-bold text-sm">#{wave}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const nextMute = retroAudio.toggleMute();
              setIsMuted(nextMute);
            }}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
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
              className="px-2.5 py-1 rounded bg-amber-950 hover:bg-amber-900 border border-amber-500/50 text-[10px] text-amber-300 cursor-pointer"
            >
              CABINET ROW
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center p-1 sm:p-3">
        <div className={`relative w-full h-full max-w-[1020px] max-h-[760px] rounded-lg overflow-hidden arcade-bezel ${scanlines ? 'crt-overlay crt-vignette' : ''}`}>
          <canvas
            ref={canvasRef}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            className="w-full h-full block bg-[#050402] cursor-crosshair"
          />

          {/* OVERLAY: Attract Mode */}
          {gameState === 'attract' && (
            <div
              onClick={startGame}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-[2px] p-4 text-center z-30 cursor-pointer"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="max-w-md w-full p-6 rounded-xl border border-amber-500/60 bg-[#0c0804]/95 shadow-[0_0_35px_rgba(245,158,11,0.4)]"
              >
                <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950 border border-amber-400/50 text-[10px] font-arcade text-amber-300">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>ATARI 1980 DEFENSE LEGEND</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-arcade text-amber-400 font-extrabold tracking-widest crt-glow mb-2">
                  MISSILE COMMAND
                </h1>
                <p className="text-xs text-gray-400 font-mono mb-5">
                  DEFEND CITIES FROM NUCLEAR BALLISTIC ATTACK
                </p>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-arcade text-left bg-black/60 p-3 rounded-lg border border-gray-800 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                    <span className="text-gray-300">ICBM: 25 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-cyan-400 rounded-sm"></span>
                    <span className="text-cyan-300">CITY: 100 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-amber-400 rounded-sm"></span>
                    <span className="text-amber-300">MISSILE: 5 PTS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-orange-500 rounded-full"></span>
                    <span className="text-orange-300">MIRV: SPLITS</span>
                  </div>
                </div>

                {/* Launch Button */}
                <div className="space-y-2.5">
                  <button
                    onClick={startGame}
                    className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-arcade text-sm font-bold tracking-widest shadow-[0_0_25px_rgba(245,158,11,0.8)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>DEFEND CITIES (1 CREDIT)</span>
                  </button>

                  <div className="text-[10px] font-arcade text-amber-300 flex items-center justify-center gap-3">
                    <span>CREDITS: {credits.toString().padStart(2, '0')}</span>
                    <span>•</span>
                    <span className="text-gray-400">TAP SCREEN OR [SPACE]</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800 text-[9px] font-mono text-gray-400 flex flex-wrap justify-center gap-3">
                  <span>CLICK/TAP TO LAUNCH FLAK</span>
                  <span>[A/1] LEFT SILO</span>
                  <span>[S/2] CENTER SILO</span>
                  <span>[D/3] RIGHT SILO</span>
                </div>
              </div>
            </div>
          )}

          {/* OVERLAY: Wave Clear Bonus */}
          {gameState === 'wave_clear' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border border-cyan-400 bg-[#040810]/95 shadow-[0_0_30px_rgba(6,182,212,0.6)]">
                <h3 className="text-2xl font-arcade text-cyan-300 font-bold mb-2 crt-glow">
                  ATTACK REPELLED!
                </h3>
                <p className="text-xs font-arcade text-gray-300 mb-4">
                  DEFENSE BONUS TALLY
                </p>
                <div className="text-sm font-arcade text-amber-300 mb-4">
                  +{engine.current.tallyBonus} BONUS POINTS
                </div>
                <div className="text-[10px] font-mono text-gray-400 animate-pulse">
                  PREPARING NEXT WAVE...
                </div>
              </div>
            </div>
          )}

          {/* OVERLAY: Game Over */}
          {gameState === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border-2 border-red-500/60 bg-[#0c0404]/95 shadow-[0_0_35px_rgba(239,68,68,0.5)]">
                <h2 className="text-3xl font-arcade text-red-500 font-bold tracking-widest mb-2 crt-glow">
                  THE END
                </h2>
                <div className="text-sm font-arcade text-gray-300 mb-1">
                  FINAL DEFENSE SCORE: <span className="text-amber-400">{score}</span>
                </div>
                <div className="text-xs font-arcade text-gray-500 mb-6">
                  WAVES SURVIVED: {wave}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={startGame}
                    className="w-full py-3 px-4 rounded bg-amber-600 hover:bg-amber-500 text-black font-arcade text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(245,158,11,0.5)] cursor-pointer"
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

          {/* OVERLAY: High Score */}
          {gameState === 'new_high_score' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border-2 border-yellow-500/80 bg-[#0e0c06]/95 shadow-[0_0_35px_rgba(234,179,8,0.5)]">
                <div className="flex items-center justify-center gap-2 mb-2 text-yellow-400 font-arcade text-xs">
                  <Trophy className="w-4 h-4 text-yellow-400 animate-bounce" />
                  <span>COMMANDER HIGH SCORE!</span>
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

      {/* Silo Quick Fire Buttons for Mobile / Touch */}
      <div className="w-full bg-[#080504] border-t border-amber-950/60 p-2 sm:p-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fireABM(engine.current.crosshairX, engine.current.crosshairY, 0)}
            className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-gray-900 border border-amber-500/50 active:bg-amber-600 active:text-black text-amber-300 font-arcade text-[10px] flex flex-col items-center justify-center transition-all shadow-md cursor-pointer"
          >
            <span>ALPHA [A]</span>
            <span className="text-[8px] font-mono text-gray-400">
              {engine.current.silos[0]?.missiles ?? 0} REMAINING
            </span>
          </button>

          <button
            onClick={() => fireABM(engine.current.crosshairX, engine.current.crosshairY, 1)}
            className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-amber-950/80 border-2 border-amber-400 active:bg-amber-500 active:text-black text-amber-300 font-arcade text-[10px] flex flex-col items-center justify-center transition-all shadow-[0_0_12px_rgba(245,158,11,0.4)] cursor-pointer"
          >
            <span>DELTA [S] (FAST)</span>
            <span className="text-[8px] font-mono text-amber-400">
              {engine.current.silos[1]?.missiles ?? 0} REMAINING
            </span>
          </button>

          <button
            onClick={() => fireABM(engine.current.crosshairX, engine.current.crosshairY, 2)}
            className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-gray-900 border border-amber-500/50 active:bg-amber-600 active:text-black text-amber-300 font-arcade text-[10px] flex flex-col items-center justify-center transition-all shadow-md cursor-pointer"
          >
            <span>OMEGA [D]</span>
            <span className="text-[8px] font-mono text-gray-400">
              {engine.current.silos[2]?.missiles ?? 0} REMAINING
            </span>
          </button>
        </div>

        <div className="hidden md:flex flex-col items-center text-center">
          <div className="text-[9px] font-arcade text-amber-400 flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            <span>CLICK OR TAP ANYWHERE TO INTERCEPT</span>
          </div>
          <span className="text-[8px] text-gray-500 font-mono mt-0.5">
            CHAIN REACTIONS DESTROY MULTIPLE WARHEADS
          </span>
        </div>

        <button
          onClick={() => fireABM(engine.current.crosshairX, engine.current.crosshairY)}
          className="px-5 py-2.5 sm:px-7 sm:py-3 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 border border-amber-400 text-white font-arcade text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(245,158,11,0.6)] cursor-pointer active:scale-95"
        >
          FIRE FLAK
        </button>
      </div>
    </div>
  );
};
