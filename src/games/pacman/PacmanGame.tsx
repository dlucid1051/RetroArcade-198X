import React, { useEffect, useRef, useState, useCallback } from 'react';
import { retroAudio } from '../../audio/retroAudio';
import { ArcadeControlsState } from '../../input/useArcadeInput';
import {
  Direction,
  Ghost,
  GhostState,
  PacmanState,
  BonusFruit,
  PacmanHighScore,
} from './types';
import {
  MAZE_COLS,
  MAZE_ROWS,
  INITIAL_MAZE_TILES,
} from './maze';
import {
  Trophy,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Ghost as GhostIcon,
} from 'lucide-react';

interface PacmanGameProps {
  controlsRef: React.MutableRefObject<ArcadeControlsState>;
  onBackToArcade?: () => void;
  credits: number;
  onUseCredit: () => boolean;
  scanlines: boolean;
  hasGamepad: boolean;
}

const DEFAULT_PACMAN_SCORES: PacmanHighScore[] = [
  { initials: 'PAC', score: 33330, round: 6, date: '1980' },
  { initials: 'NAM', score: 21400, round: 4, date: '1980' },
  { initials: 'DAL', score: 14800, round: 3, date: '1982' },
  { initials: 'ACE', score: 8600, round: 2, date: '1981' },
  { initials: 'GHO', score: 3200, round: 1, date: '1980' },
];

export const PacmanGame: React.FC<PacmanGameProps> = ({
  controlsRef,
  onBackToArcade,
  credits,
  onUseCredit,
  scanlines,
  hasGamepad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [highScores, setHighScores] = useState<PacmanHighScore[]>(() => {
    try {
      const saved = localStorage.getItem('retro_arcade_pacman_scores');
      return saved ? JSON.parse(saved) : DEFAULT_PACMAN_SCORES;
    } catch {
      return DEFAULT_PACMAN_SCORES;
    }
  });

  const [gameState, setGameState] = useState<'attract' | 'playing' | 'round_clear' | 'gameover' | 'new_high_score'>('attract');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [round, setRound] = useState(1);
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
    status: 'attract' as 'attract' | 'playing' | 'round_clear' | 'gameover' | 'new_high_score',
    score: 0,
    lives: 3,
    round: 1,
    dotsEaten: 0,
    totalDots: 0,
    wakaAlt: false,
    energizerTimer: 0,
    ghostsEatenInEnergizer: 0,
    scatterTimer: 7,
    isScatterMode: true,
    maze: [] as number[][],
    pacman: {
      x: 13.5,
      y: 23,
      dir: 'LEFT' as Direction,
      nextDir: 'LEFT' as Direction,
      mouthAngle: 0.25,
      mouthOpening: true,
      speed: 7.5,
    } as PacmanState,
    ghosts: [] as Ghost[],
    fruit: {
      active: false,
      type: 'cherry',
      points: 100,
      x: 13.5,
      y: 17,
      timer: 0,
    } as BonusFruit,
    screenW: 800,
    screenH: 600,
    tileSize: 18,
    offsetX: 0,
    offsetY: 0,
  });

  // Clone initial maze and count total dots
  const resetMaze = () => {
    let dots = 0;
    const cloned = INITIAL_MAZE_TILES.map(row =>
      row.map(cell => {
        if (cell === 2 || cell === 3) dots++;
        return cell;
      })
    );
    engine.current.maze = cloned;
    engine.current.totalDots = dots;
    engine.current.dotsEaten = 0;
  };

  // Reset positions of Pac-Man and the 4 ghosts
  const resetPositions = () => {
    engine.current.pacman = {
      x: 13.5,
      y: 23,
      dir: 'LEFT',
      nextDir: 'LEFT',
      mouthAngle: 0.25,
      mouthOpening: true,
      speed: 7.5,
    };

    engine.current.ghosts = [
      {
        name: 'blinky',
        x: 13.5,
        y: 11,
        dir: 'LEFT',
        state: 'scatter',
        color: '#ef4444', // Red
        speed: 7.0,
        scatterTarget: { x: 25, y: 0 },
        inHouse: false,
        exitTimer: 0,
      },
      {
        name: 'pinky',
        x: 13.5,
        y: 14,
        dir: 'UP',
        state: 'scatter',
        color: '#f472b6', // Pink
        speed: 6.8,
        scatterTarget: { x: 2, y: 0 },
        inHouse: true,
        exitTimer: 2.0,
      },
      {
        name: 'inky',
        x: 11.5,
        y: 14,
        dir: 'UP',
        state: 'scatter',
        color: '#22d3ee', // Cyan
        speed: 6.6,
        scatterTarget: { x: 27, y: 31 },
        inHouse: true,
        exitTimer: 5.0,
      },
      {
        name: 'clyde',
        x: 15.5,
        y: 14,
        dir: 'UP',
        state: 'scatter',
        color: '#fb923c', // Orange
        speed: 6.4,
        scatterTarget: { x: 0, y: 31 },
        inHouse: true,
        exitTimer: 8.0,
      },
    ];
  };

  // Start Pacman Game
  const startGame = useCallback(() => {
    if (credits <= 0) {
      retroAudio.insertCoin();
    } else {
      onUseCredit();
    }

    engine.current.status = 'playing';
    engine.current.score = 0;
    engine.current.lives = 3;
    engine.current.round = 1;
    engine.current.energizerTimer = 0;
    engine.current.fruit.active = false;

    resetMaze();
    resetPositions();

    setScore(0);
    setLives(3);
    setRound(1);
    setGameState('playing');
    setIsPaused(false);
    retroAudio.extraLife();
  }, [credits, onUseCredit]);

  // Handle Pacman death
  const killPacman = () => {
    retroAudio.pacmanDeath();
    const nextLives = engine.current.lives - 1;
    engine.current.lives = nextLives;
    setLives(nextLives);

    if (nextLives <= 0) {
      engine.current.status = 'gameover';
      setGameState('gameover');
      retroAudio.gameOver();

      const finalScore = engine.current.score;
      const currentHighs = highScoresRef.current;
      const isTopScore =
        finalScore > 0 &&
        (currentHighs.length < 5 || finalScore > currentHighs[currentHighs.length - 1].score);

      if (isTopScore) {
        engine.current.status = 'new_high_score';
        setGameState('new_high_score');
      }
    } else {
      // Reposition actors
      setTimeout(() => {
        if (engine.current.status === 'playing') {
          resetPositions();
        }
      }, 1200);
    }
  };

  // Save High Score
  const saveHighScore = () => {
    const initialsStr = initials.join('');
    const newEntry: PacmanHighScore = {
      initials: initialsStr,
      score,
      round,
      date: new Date().getFullYear().toString(),
    };

    const updated = [...highScores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setHighScores(updated);
    try {
      localStorage.setItem('retro_arcade_pacman_scores', JSON.stringify(updated));
    } catch {}

    setGameState('attract');
    engine.current.status = 'attract';
    retroAudio.buttonClick();
  };

  // Steer Pacman helper
  const steerPacman = useCallback((dir: Direction) => {
    engine.current.pacman.nextDir = dir;
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'attract') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          startGame();
        }
      } else if (gameState === 'playing') {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          steerPacman('UP');
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          steerPacman('DOWN');
        } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          steerPacman('LEFT');
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          steerPacman('RIGHT');
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
  }, [gameState, initialIndex, initials, score, round, highScores, startGame, steerPacman]);

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
      const width = rect.width > 0 ? rect.width : 800;
      const height = rect.height > 0 ? rect.height : 600;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      engine.current.screenW = width;
      engine.current.screenH = height;

      // Calculate tile size and centering offsets
      const maxTileW = width / MAZE_COLS;
      const maxTileH = (height - 30) / MAZE_ROWS;
      const tSize = Math.floor(Math.min(maxTileW, maxTileH));

      engine.current.tileSize = tSize;
      engine.current.offsetX = Math.floor((width - MAZE_COLS * tSize) / 2);
      engine.current.offsetY = Math.floor((height - MAZE_ROWS * tSize) / 2);

      if (engine.current.maze.length === 0) {
        resetMaze();
        resetPositions();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Wall collision test
    const isWall = (tileX: number, tileY: number, isGhost = false): boolean => {
      if (tileY < 0 || tileY >= MAZE_ROWS) return false;
      // Warp tunnels are passable
      if (tileX < 0 || tileX >= MAZE_COLS) return false;

      const cell = engine.current.maze[tileY]?.[tileX];
      if (cell === 1) return true; // Wall
      if (cell === 4) return !isGhost; // Ghost door (passable only by ghosts)
      if (cell === 5 && !isGhost) return true; // Interior
      return false;
    };

    const gameLoop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const sw = Math.max(engine.current.screenW || 0, 800);
      const sh = Math.max(engine.current.screenH || 0, 600);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const paused = isPausedRef.current;
      const state = engine.current;
      const controls = controlsRef.current;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#030508';
      ctx.fillRect(0, 0, sw, sh);

      const tSize = state.tileSize;
      const ox = state.offsetX;
      const oy = state.offsetY;

      // --- 1. PAC-MAN LOCOMOTION & CORNER PRE-STEERING ---
      if (!paused && state.status === 'playing') {
        // Read input controls
        if (controls.rotateLeft) state.pacman.nextDir = 'LEFT';
        else if (controls.rotateRight) state.pacman.nextDir = 'RIGHT';
        else if (controls.thrust) state.pacman.nextDir = 'UP';
        else if (controls.hyperspace) state.pacman.nextDir = 'DOWN';

        const p = state.pacman;

        // Direction offset map
        const dirDeltas = {
          UP: { dx: 0, dy: -1 },
          DOWN: { dx: 0, dy: 1 },
          LEFT: { dx: -1, dy: 0 },
          RIGHT: { dx: 1, dy: 0 },
          NONE: { dx: 0, dy: 0 },
        };

        // Try queued direction if near tile center
        const currTileX = Math.round(p.x);
        const currTileY = Math.round(p.y);
        const nearCenterX = Math.abs(p.x - currTileX) < 0.25;
        const nearCenterY = Math.abs(p.y - currTileY) < 0.25;

        // Reverse immediately
        const isOpposite =
          (p.dir === 'LEFT' && p.nextDir === 'RIGHT') ||
          (p.dir === 'RIGHT' && p.nextDir === 'LEFT') ||
          (p.dir === 'UP' && p.nextDir === 'DOWN') ||
          (p.dir === 'DOWN' && p.nextDir === 'UP');

        if (isOpposite) {
          p.dir = p.nextDir;
        } else if (nearCenterX && nearCenterY && p.nextDir !== p.dir && p.nextDir !== 'NONE') {
          const nextTargetTileX = currTileX + dirDeltas[p.nextDir].dx;
          const nextTargetTileY = currTileY + dirDeltas[p.nextDir].dy;
          if (!isWall(nextTargetTileX, nextTargetTileY)) {
            p.x = currTileX;
            p.y = currTileY;
            p.dir = p.nextDir;
          }
        }

        // Move Pacman in current direction
        if (p.dir !== 'NONE') {
          const targetTileX = currTileX + dirDeltas[p.dir].dx;
          const targetTileY = currTileY + dirDeltas[p.dir].dy;
          const blocked = isWall(targetTileX, targetTileY);

          if (!blocked || (p.dir === 'LEFT' && p.x > currTileX) || (p.dir === 'RIGHT' && p.x < currTileX) || (p.dir === 'UP' && p.y > currTileY) || (p.dir === 'DOWN' && p.y < currTileY)) {
            p.x += dirDeltas[p.dir].dx * p.speed * dt;
            p.y += dirDeltas[p.dir].dy * p.speed * dt;

            // Mouth animation
            if (p.mouthOpening) {
              p.mouthAngle += 3.8 * dt;
              if (p.mouthAngle >= 0.35) p.mouthOpening = false;
            } else {
              p.mouthAngle -= 3.8 * dt;
              if (p.mouthAngle <= 0.05) p.mouthOpening = true;
            }
          } else {
            p.x = currTileX;
            p.y = currTileY;
          }
        }

        // Side Warp Tunnels on row 14
        if (p.y >= 13.5 && p.y <= 14.5) {
          if (p.x < -0.5) p.x = MAZE_COLS - 0.5;
          else if (p.x > MAZE_COLS - 0.5) p.x = -0.5;
        }

        // Pellet & Energizer Consumption
        const eatX = Math.round(p.x);
        const eatY = Math.round(p.y);
        if (eatX >= 0 && eatX < MAZE_COLS && eatY >= 0 && eatY < MAZE_ROWS) {
          const cell = state.maze[eatY][eatX];
          if (cell === 2) {
            // Small Pellet
            state.maze[eatY][eatX] = 0;
            state.dotsEaten += 1;
            state.score += 10;
            setScore(state.score);
            state.wakaAlt = !state.wakaAlt;
            retroAudio.pacmanMunch(state.wakaAlt);
          } else if (cell === 3) {
            // Energizer (Power Pellet)
            state.maze[eatY][eatX] = 0;
            state.dotsEaten += 1;
            state.score += 50;
            setScore(state.score);
            state.energizerTimer = 6.5; // 6.5 seconds of blue ghosts
            state.ghostsEatenInEnergizer = 0;
            retroAudio.pacmanMunch(true);

            // Turn non-eaten ghosts frightened
            for (const ghost of state.ghosts) {
              if (ghost.state !== 'eaten') {
                ghost.state = 'frightened';
              }
            }
          }

          // Bonus Fruit trigger
          if ((state.dotsEaten === 70 || state.dotsEaten === 170) && !state.fruit.active) {
            state.fruit.active = true;
            state.fruit.timer = 10;
          }

          // Round Cleared Check
          if (state.dotsEaten >= state.totalDots && state.totalDots > 0) {
            state.status = 'round_clear';
            setGameState('round_clear');
            retroAudio.extraLife();
            setTimeout(() => {
              const nextRound = state.round + 1;
              state.round = nextRound;
              setRound(nextRound);
              resetMaze();
              resetPositions();
              state.status = 'playing';
              setGameState('playing');
            }, 2500);
          }
        }

        // Check Fruit collision
        if (state.fruit.active) {
          state.fruit.timer -= dt;
          if (state.fruit.timer <= 0) state.fruit.active = false;
          if (Math.hypot(p.x - state.fruit.x, p.y - state.fruit.y) < 1.0) {
            state.fruit.active = false;
            state.score += state.fruit.points;
            setScore(state.score);
            retroAudio.pacmanFruit();
          }
        }
      }

      // --- 2. GHOSTS AI STATE MACHINE & MOVEMENT ---
      if (!paused && state.status === 'playing') {
        // Scatter / Chase mode timer
        if (state.energizerTimer > 0) {
          state.energizerTimer -= dt;
          if (state.energizerTimer <= 0) {
            for (const ghost of state.ghosts) {
              if (ghost.state === 'frightened') {
                ghost.state = state.isScatterMode ? 'scatter' : 'chase';
              }
            }
          }
        } else {
          state.scatterTimer -= dt;
          if (state.scatterTimer <= 0) {
            state.isScatterMode = !state.isScatterMode;
            state.scatterTimer = state.isScatterMode ? 7 : 20;
            for (const ghost of state.ghosts) {
              if (ghost.state !== 'eaten') {
                ghost.state = state.isScatterMode ? 'scatter' : 'chase';
              }
            }
          }
        }

        // Process each ghost
        for (const ghost of state.ghosts) {
          // Ghost house exit sequence
          if (ghost.inHouse) {
            ghost.exitTimer -= dt;
            if (ghost.exitTimer <= 0) {
              // Move towards door at (13.5, 11)
              ghost.x += (13.5 - ghost.x) * 4 * dt;
              ghost.y -= 3.5 * dt;
              if (ghost.y <= 11) {
                ghost.y = 11;
                ghost.inHouse = false;
                ghost.dir = 'LEFT';
              }
            }
            continue;
          }

          // Return to house if eaten
          if (ghost.state === 'eaten') {
            const targetX = 13.5;
            const targetY = 11;
            const dx = targetX - ghost.x;
            const dy = targetY - ghost.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.6) {
              ghost.state = state.isScatterMode ? 'scatter' : 'chase';
              ghost.inHouse = true;
              ghost.exitTimer = 1.0;
            } else {
              ghost.x += (dx / dist) * 11 * dt;
              ghost.y += (dy / dist) * 11 * dt;
            }
            continue;
          }

          // Compute target tile for Chase/Scatter
          let targetX = ghost.scatterTarget.x;
          let targetY = ghost.scatterTarget.y;

          if (ghost.state === 'chase') {
            const pac = state.pacman;
            if (ghost.name === 'blinky') {
              targetX = pac.x;
              targetY = pac.y;
            } else if (ghost.name === 'pinky') {
              // 4 tiles in front of Pacman
              targetX = pac.x + (pac.dir === 'LEFT' ? -4 : pac.dir === 'RIGHT' ? 4 : 0);
              targetY = pac.y + (pac.dir === 'UP' ? -4 : pac.dir === 'DOWN' ? 4 : 0);
            } else if (ghost.name === 'inky') {
              // Blinky vector offset
              const blinky = state.ghosts.find(g => g.name === 'blinky');
              const bx = blinky?.x ?? 0;
              const by = blinky?.y ?? 0;
              targetX = pac.x * 2 - bx;
              targetY = pac.y * 2 - by;
            } else if (ghost.name === 'clyde') {
              // Chases when far (> 8 tiles), scatters when close
              const distToPac = Math.hypot(ghost.x - pac.x, ghost.y - pac.y);
              if (distToPac > 8) {
                targetX = pac.x;
                targetY = pac.y;
              } else {
                targetX = ghost.scatterTarget.x;
                targetY = ghost.scatterTarget.y;
              }
            }
          } else if (ghost.state === 'frightened') {
            // Random target
            targetX = Math.random() * MAZE_COLS;
            targetY = Math.random() * MAZE_ROWS;
          }

          // Ghost intersection navigation
          const gx = Math.round(ghost.x);
          const gy = Math.round(ghost.y);
          const isAtCenter = Math.abs(ghost.x - gx) < 0.25 && Math.abs(ghost.y - gy) < 0.25;

          const ghostSpeed = ghost.state === 'frightened' ? 4.8 : ghost.speed;

          if (isAtCenter) {
            ghost.x = gx;
            ghost.y = gy;

            const possibleDirs: { dir: Direction; tx: number; ty: number }[] = [
              { dir: 'UP', tx: gx, ty: gy - 1 },
              { dir: 'DOWN', tx: gx, ty: gy + 1 },
              { dir: 'LEFT', tx: gx - 1, ty: gy },
              { dir: 'RIGHT', tx: gx + 1, ty: gy },
            ];

            // Ghosts cannot reverse 180 degrees at an intersection
            const oppositeMap: { [k in Direction]: Direction } = {
              UP: 'DOWN',
              DOWN: 'UP',
              LEFT: 'RIGHT',
              RIGHT: 'LEFT',
              NONE: 'NONE',
            };

            const validDirs = possibleDirs.filter(
              d => d.dir !== oppositeMap[ghost.dir] && !isWall(d.tx, d.ty, true)
            );

            if (validDirs.length > 0) {
              if (ghost.state === 'frightened') {
                ghost.dir = validDirs[Math.floor(Math.random() * validDirs.length)].dir;
              } else {
                // Pick direction with shortest Euclidean distance to target tile
                validDirs.sort((a, b) => {
                  const da = Math.hypot(a.tx - targetX, a.ty - targetY);
                  const db = Math.hypot(b.tx - targetX, b.ty - targetY);
                  return da - db;
                });
                ghost.dir = validDirs[0].dir;
              }
            }
          }

          // Move Ghost along chosen direction
          const gDeltas = {
            UP: { dx: 0, dy: -1 },
            DOWN: { dx: 0, dy: 1 },
            LEFT: { dx: -1, dy: 0 },
            RIGHT: { dx: 1, dy: 0 },
            NONE: { dx: 0, dy: 0 },
          };

          ghost.x += gDeltas[ghost.dir].dx * ghostSpeed * dt;
          ghost.y += gDeltas[ghost.dir].dy * ghostSpeed * dt;

          // Ghost Warp tunnel wrap
          if (ghost.y >= 13.5 && ghost.y <= 14.5) {
            if (ghost.x < -0.5) ghost.x = MAZE_COLS - 0.5;
            else if (ghost.x > MAZE_COLS - 0.5) ghost.x = -0.5;
          }

          // Ghost Collision with Pacman
          const distToPac = Math.hypot(ghost.x - state.pacman.x, ghost.y - state.pacman.y);
          if (distToPac < 0.8) {
            if (ghost.state === 'frightened') {
              // Pacman eats the ghost!
              ghost.state = 'eaten';
              state.ghostsEatenInEnergizer += 1;
              const bonusMultiplier = Math.pow(2, state.ghostsEatenInEnergizer);
              const ghostPoints = 100 * bonusMultiplier;
              state.score += ghostPoints;
              setScore(state.score);
              retroAudio.pacmanEatGhost();
            } else if (ghost.state === 'chase' || ghost.state === 'scatter') {
              // Pacman caught!
              killPacman();
              break;
            }
          }
        }
      }

      // --- 3. RENDER AUTHENTIC PAC-MAN MAZE ---
      ctx.save();
      for (let r = 0; r < MAZE_ROWS; r++) {
        for (let c = 0; c < MAZE_COLS; c++) {
          const tile = state.maze[r][c];
          const px = ox + c * tSize;
          const py = oy + r * tSize;

          if (tile === 1) {
            // Neon Blue Wall Borders
            ctx.fillStyle = '#1e3a8a';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.8;
            ctx.shadowColor = 'rgba(59, 130, 246, 0.7)';
            ctx.shadowBlur = 6;
            ctx.strokeRect(px + 1, py + 1, tSize - 2, tSize - 2);
          } else if (tile === 2) {
            // Small Pellet (Dot)
            ctx.fillStyle = '#fed7aa'; // Warm cream pellet
            ctx.beginPath();
            ctx.arc(px + tSize / 2, py + tSize / 2, 2.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (tile === 3) {
            // Energizer (Power Pellet - Blinks!)
            if (Math.floor(currentTime / 220) % 2 === 0) {
              ctx.fillStyle = '#fed7aa';
              ctx.shadowColor = '#fed7aa';
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.arc(px + tSize / 2, py + tSize / 2, 5.5, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (tile === 4) {
            // Ghost House Door
            ctx.strokeStyle = '#f472b6';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(px, py + tSize / 2);
            ctx.lineTo(px + tSize, py + tSize / 2);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // --- 4. RENDER BONUS FRUIT ---
      if (state.fruit.active) {
        const fx = ox + state.fruit.x * tSize + tSize / 2;
        const fy = oy + state.fruit.y * tSize + tSize / 2;
        ctx.save();
        // Draw Cherry
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(fx - 4, fy + 2, 4.5, 0, Math.PI * 2);
        ctx.arc(fx + 4, fy + 3, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fx - 4, fy); ctx.quadraticCurveTo(fx, fy - 6, fx + 3, fy - 7);
        ctx.moveTo(fx + 4, fy); ctx.quadraticCurveTo(fx + 2, fy - 6, fx + 3, fy - 7);
        ctx.stroke();
        ctx.restore();
      }

      // --- 5. RENDER PAC-MAN ---
      const p = state.pacman;
      const pacPx = ox + p.x * tSize + tSize / 2;
      const pacPy = oy + p.y * tSize + tSize / 2;
      const pacRadius = tSize * 0.65;

      const angleOffsets = {
        RIGHT: 0,
        DOWN: Math.PI / 2,
        LEFT: Math.PI,
        UP: -Math.PI / 2,
        NONE: 0,
      };
      const baseAngle = angleOffsets[p.dir];

      ctx.save();
      ctx.fillStyle = '#facc15'; // Authentic bright yellow
      ctx.shadowColor = 'rgba(250, 204, 21, 0.7)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(
        pacPx,
        pacPy,
        pacRadius,
        baseAngle + p.mouthAngle * Math.PI,
        baseAngle + (2 - p.mouthAngle) * Math.PI
      );
      ctx.lineTo(pacPx, pacPy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // --- 6. RENDER GHOSTS ---
      for (const ghost of state.ghosts) {
        const gx = ox + ghost.x * tSize + tSize / 2;
        const gy = oy + ghost.y * tSize + tSize / 2;
        const gr = tSize * 0.62;

        ctx.save();

        if (ghost.state === 'eaten') {
          // Floating eyeballs only!
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(gx - 4, gy, 3.5, 0, Math.PI * 2);
          ctx.arc(gx + 4, gy, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1e3a8a';
          ctx.beginPath();
          ctx.arc(gx - 4, gy, 1.8, 0, Math.PI * 2);
          ctx.arc(gx + 4, gy, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        // Ghost body color (Frightened blue vs Normal)
        let bodyColor = ghost.color;
        if (ghost.state === 'frightened') {
          // Flash white in last 2 seconds
          const isFlashing = state.energizerTimer < 2.0 && Math.floor(currentTime / 180) % 2 === 0;
          bodyColor = isFlashing ? '#ffffff' : '#1d4ed8'; // Dark blue
        }

        ctx.fillStyle = bodyColor;
        ctx.shadowColor = bodyColor;
        ctx.shadowBlur = 8;

        // Head Dome
        ctx.beginPath();
        ctx.arc(gx, gy - 2, gr, Math.PI, 0);

        // Skirt waves
        const waveStep = (gr * 2) / 3;
        const skirtY = gy + gr - 1;
        ctx.lineTo(gx + gr, skirtY);
        ctx.lineTo(gx + gr - waveStep * 0.5, skirtY - 3);
        ctx.lineTo(gx + gr - waveStep, skirtY);
        ctx.lineTo(gx - waveStep * 0.5, skirtY - 3);
        ctx.lineTo(gx - gr + waveStep, skirtY);
        ctx.lineTo(gx - gr + waveStep * 0.5, skirtY - 3);
        ctx.lineTo(gx - gr, skirtY);
        ctx.closePath();
        ctx.fill();

        // Eyes
        if (ghost.state === 'frightened') {
          // Frightened wavy mouth
          ctx.strokeStyle = '#fed7aa';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(gx - 4, gy + 3);
          ctx.lineTo(gx - 2, gy + 1);
          ctx.lineTo(gx, gy + 3);
          ctx.lineTo(gx + 2, gy + 1);
          ctx.lineTo(gx + 4, gy + 3);
          ctx.stroke();
        } else {
          // Looking eyeballs towards direction
          const eyeLook = {
            LEFT: { dx: -1.8, dy: 0 },
            RIGHT: { dx: 1.8, dy: 0 },
            UP: { dx: 0, dy: -1.8 },
            DOWN: { dx: 0, dy: 1.8 },
            NONE: { dx: 0, dy: 0 },
          }[ghost.dir];

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(gx - 4, gy - 2, 3.5, 0, Math.PI * 2);
          ctx.arc(gx + 4, gy - 2, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#1e3a8a'; // Blue pupils
          ctx.beginPath();
          ctx.arc(gx - 4 + eyeLook.dx, gy - 2 + eyeLook.dy, 1.8, 0, Math.PI * 2);
          ctx.arc(gx + 4 + eyeLook.dx, gy - 2 + eyeLook.dy, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      ctx.restore();

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-[#030508]">
      {/* Top HUD Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 bg-[#060408] border-b border-yellow-950/60 text-xs font-arcade tracking-wider z-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">1UP SCORE</span>
            <span className="text-yellow-400 font-bold text-sm tracking-widest">
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
              <span className="text-[9px] text-gray-500">ROUND</span>
              <span className="text-cyan-400 font-bold text-sm">#{round}</span>
            </div>
          )}
        </div>

        {/* Lives Counter as mini Pac-Man icons */}
        <div className="flex items-center gap-3">
          {gameState === 'playing' && (
            <div className="flex items-center gap-1.5 mr-2">
              {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                <div key={i} className="w-4 h-4 rounded-full bg-yellow-400 border border-yellow-200"></div>
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
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-yellow-400" />}
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
              className="px-2.5 py-1 rounded bg-yellow-950 hover:bg-yellow-900 border border-yellow-500/50 text-[10px] text-yellow-300 cursor-pointer"
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
            onClick={() => {
              if (gameState === 'attract') startGame();
            }}
            className="w-full h-full block bg-[#030508] cursor-pointer"
          />

          {/* OVERLAY: Attract Mode */}
          {gameState === 'attract' && (
            <div
              onClick={startGame}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-[2px] p-4 text-center z-30 cursor-pointer"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="max-w-md w-full p-6 rounded-xl border border-yellow-500/60 bg-[#090703]/95 shadow-[0_0_35px_rgba(234,179,8,0.4)]"
              >
                <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-950 border border-yellow-400/50 text-[10px] font-arcade text-yellow-300">
                  <Sparkles className="w-3 h-3 text-yellow-400" />
                  <span>NAMCO 1980 MAZE MASTERPIECE</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-arcade text-yellow-400 font-extrabold tracking-widest crt-glow mb-2">
                  PAC-MAN
                </h1>
                <p className="text-xs text-gray-400 font-mono mb-5">
                  WAKA-WAKA CHOMPING • ENERGIZERS & GHOST SQUAD
                </p>

                {/* Ghost squad roster */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-arcade text-left bg-black/60 p-3 rounded-lg border border-gray-800 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span className="text-red-400">BLINKY: SHADOW</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-400"></span>
                    <span className="text-pink-300">PINKY: SPEEDY</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                    <span className="text-cyan-300">INKY: BASHFUL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span>
                    <span className="text-orange-300">CLYDE: POKEY</span>
                  </div>
                </div>

                {/* Launch Button */}
                <div className="space-y-2.5">
                  <button
                    onClick={startGame}
                    className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-yellow-500 via-amber-600 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-black font-arcade text-sm font-bold tracking-widest shadow-[0_0_25px_rgba(234,179,8,0.8)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>PRESS TO CHOMP (1 CREDIT)</span>
                  </button>

                  <div className="text-[10px] font-arcade text-amber-300 flex items-center justify-center gap-3">
                    <span>CREDITS: {credits.toString().padStart(2, '0')}</span>
                    <span>•</span>
                    <span className="text-gray-400">PRESS [SPACE] / [ENTER]</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800 text-[9px] font-mono text-gray-400 flex flex-wrap justify-center gap-3">
                  <span>[ARROWS/WASD] STEER</span>
                  <span>PRE-STEER CORNERING ACTIVE</span>
                </div>
              </div>
            </div>
          )}

          {/* OVERLAY: Round Cleared */}
          {gameState === 'round_clear' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border border-yellow-400 bg-[#090703]/95 shadow-[0_0_30px_rgba(234,179,8,0.6)]">
                <h3 className="text-2xl font-arcade text-yellow-300 font-bold mb-2 crt-glow">
                  MAZE CLEARED!
                </h3>
                <p className="text-xs font-arcade text-cyan-300 mb-4 animate-pulse">
                  PREPARING NEXT ROUND...
                </p>
              </div>
            </div>
          )}

          {/* OVERLAY: Game Over */}
          {gameState === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border-2 border-red-500/60 bg-[#0c0303]/95 shadow-[0_0_35px_rgba(239,68,68,0.5)]">
                <h2 className="text-3xl font-arcade text-red-500 font-bold tracking-widest mb-2 crt-glow">
                  GAME OVER
                </h2>
                <div className="text-sm font-arcade text-gray-300 mb-1">
                  FINAL SCORE: <span className="text-yellow-400">{score}</span>
                </div>
                <div className="text-xs font-arcade text-gray-500 mb-6">
                  ROUNDS SURVIVED: {round}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={startGame}
                    className="w-full py-3 px-4 rounded bg-yellow-500 hover:bg-yellow-400 text-black font-arcade text-xs font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(234,179,8,0.5)] cursor-pointer"
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

          {/* OVERLAY: New High Score */}
          {gameState === 'new_high_score' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4 text-center z-30">
              <div className="max-w-sm w-full p-6 rounded-xl border-2 border-yellow-500/80 bg-[#0e0c06]/95 shadow-[0_0_35px_rgba(234,179,8,0.5)]">
                <div className="flex items-center justify-center gap-2 mb-2 text-yellow-400 font-arcade text-xs">
                  <Trophy className="w-4 h-4 text-yellow-400 animate-bounce" />
                  <span>PAC-MAN HIGH SCORE!</span>
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

      {/* On-Screen Mobile Virtual D-Pad */}
      <div className="w-full bg-[#060408] border-t border-yellow-950/60 p-2 sm:p-3 flex items-center justify-between z-20">
        <div className="grid grid-cols-3 gap-1.5 w-36 h-28 sm:w-40 sm:h-32">
          <div></div>
          <button
            onClick={() => steerPacman('UP')}
            className="rounded-lg bg-gray-900 border border-yellow-500/40 active:bg-yellow-500 active:text-black text-yellow-300 font-arcade text-xs flex items-center justify-center transition-all shadow-md cursor-pointer"
            aria-label="Up"
          >
            ▲
          </button>
          <div></div>

          <button
            onClick={() => steerPacman('LEFT')}
            className="rounded-lg bg-gray-900 border border-yellow-500/40 active:bg-yellow-500 active:text-black text-yellow-300 font-arcade text-xs flex items-center justify-center transition-all shadow-md cursor-pointer"
            aria-label="Left"
          >
            ◀
          </button>
          <div className="flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-yellow-400 animate-ping"></div>
          </div>
          <button
            onClick={() => steerPacman('RIGHT')}
            className="rounded-lg bg-gray-900 border border-yellow-500/40 active:bg-yellow-500 active:text-black text-yellow-300 font-arcade text-xs flex items-center justify-center transition-all shadow-md cursor-pointer"
            aria-label="Right"
          >
            ▶
          </button>

          <div></div>
          <button
            onClick={() => steerPacman('DOWN')}
            className="rounded-lg bg-gray-900 border border-yellow-500/40 active:bg-yellow-500 active:text-black text-yellow-300 font-arcade text-xs flex items-center justify-center transition-all shadow-md cursor-pointer"
            aria-label="Down"
          >
            ▼
          </button>
          <div></div>
        </div>

        <div className="hidden md:flex flex-col items-center text-center">
          <div className="text-[9px] font-arcade text-yellow-400 flex items-center gap-1.5">
            <GhostIcon className="w-3.5 h-3.5" />
            <span>AUTHENTIC ENERGIZERS & GHOST AI PERSONALITIES</span>
          </div>
          <span className="text-[8px] text-gray-500 font-mono mt-0.5">
            USE SIDE WARP TUNNELS TO SHAKE PURSUING GHOSTS
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-[9px] font-arcade text-yellow-400">POWER PELLETS</span>
          <span className="text-[8px] font-mono text-gray-400">CHOMP BLUE GHOSTS FOR 200-1600 PTS</span>
        </div>
      </div>
    </div>
  );
};
