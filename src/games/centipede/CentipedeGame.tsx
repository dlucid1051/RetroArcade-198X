import React, { useEffect, useRef, useState, useCallback } from 'react';
import { retroAudio } from '../../audio/retroAudio';
import { ArcadeControlsState } from '../../input/useArcadeInput';
import {
  CentipedeState,
  Mushroom,
  Blaster,
  Dart,
  CentipedeSegment,
  Spider,
  Flea,
  Scorpion,
  CentipedeScorePopup,
  CentipedeHighScore,
} from './types';
import {
  CELL_SIZE,
  drawBlaster,
  drawMushroom,
  drawCentipedeSegment,
  drawSpider,
  drawFlea,
  drawScorpion,
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

interface CentipedeGameProps {
  controlsRef: React.MutableRefObject<ArcadeControlsState>;
  onBackToArcade?: () => void;
  credits: number;
  onUseCredit: () => boolean;
  scanlines: boolean;
  hasGamepad: boolean;
}

const DEFAULT_CENTIPEDE_SCORES: CentipedeHighScore[] = [
  { initials: 'DON', score: 48950, wave: 6, date: '1980' },
  { initials: 'BAI', score: 34200, wave: 4, date: '1981' },
  { initials: 'EDL', score: 22100, wave: 3, date: '1980' },
  { initials: 'ARC', score: 14500, wave: 2, date: '1980' },
  { initials: 'BUG', score: 7600, wave: 1, date: '1980' },
];

const COLS = 30;
const ROWS = 32;
const GAME_WIDTH = COLS * CELL_SIZE; // 480
const GAME_HEIGHT = ROWS * CELL_SIZE; // 512
const PLAYER_MIN_ROW = 25; // Player restricted to rows 25..31

/** Generate initial scattered mushroom patch */
function generateMushrooms(): Map<string, Mushroom> {
  const map = new Map<string, Mushroom>();
  // Bounded attempt count to prevent infinite loops
  const targetCount = 42;
  let attempts = 0;
  while (map.size < targetCount && attempts < 200) {
    attempts++;
    const col = Math.floor(Math.random() * (COLS - 2)) + 1;
    const row = Math.floor(Math.random() * (PLAYER_MIN_ROW - 2)) + 1;
    const key = `${col},${row}`;
    if (!map.has(key)) {
      map.set(key, { col, row, health: 4, isPoisoned: false });
    }
  }
  return map;
}

/** Create a full initial 12-segment centipede train */
function createCentipedeTrain(wave: number): CentipedeSegment[] {
  const segments: CentipedeSegment[] = [];
  const startCol = 14;
  for (let i = 0; i < 12; i++) {
    const col = startCol - i;
    segments.push({
      id: i,
      col,
      row: 0,
      x: col * CELL_SIZE + CELL_SIZE / 2,
      y: CELL_SIZE / 2,
      isHead: i === 0,
      dirX: 1,
      dirY: 1,
      isPoisonedPlunge: false,
      targetCol: col + 1,
      targetRow: 0,
      progress: 0,
    });
  }
  return segments;
}

export const CentipedeGame: React.FC<CentipedeGameProps> = ({
  controlsRef,
  onBackToArcade,
  credits,
  onUseCredit,
  scanlines,
  hasGamepad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High Scores State
  const [highScores, setHighScores] = useState<CentipedeHighScore[]>(() => {
    try {
      const saved = localStorage.getItem('retro_arcade_centipede_scores');
      return saved ? JSON.parse(saved) : DEFAULT_CENTIPEDE_SCORES;
    } catch {
      return DEFAULT_CENTIPEDE_SCORES;
    }
  });

  const [gameState, setGameState] = useState<CentipedeState>('start');
  const [score, setScore] = useState<number>(0);
  const [wave, setWave] = useState<number>(1);
  const [lives, setLives] = useState<number>(3);
  const [showScoresModal, setShowScoresModal] = useState<boolean>(false);
  const [initials, setInitials] = useState<string>('AAA');
  const [isMuted, setIsMuted] = useState<boolean>(() => retroAudio.getMuted());

  // Game Engine State Ref
  const engine = useRef<{
    state: CentipedeState;
    score: number;
    wave: number;
    lives: number;
    blaster: Blaster;
    darts: Dart[];
    dartCooldown: number;
    mushrooms: Map<string, Mushroom>;
    centipede: CentipedeSegment[];
    spider: Spider;
    flea: Flea;
    scorpion: Scorpion;
    scorePopups: CentipedeScorePopup[];
    animTimer: number;
    beatTimer: number;
    beatStep: number;
    spiderSpawnTimer: number;
    fleaSpawnTimer: number;
    scorpionSpawnTimer: number;
    deathTimer: number;
  }>({
    state: 'start',
    score: 0,
    wave: 1,
    lives: 3,
    blaster: {
      x: GAME_WIDTH / 2,
      y: (ROWS - 2) * CELL_SIZE + CELL_SIZE / 2,
      width: 14,
      height: 14,
      speed: 210,
      isDead: false,
    },
    darts: [],
    dartCooldown: 0,
    mushrooms: generateMushrooms(),
    centipede: createCentipedeTrain(1),
    spider: {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      timer: 0,
      scoreValue: 300,
    },
    flea: {
      active: false,
      col: 0,
      x: 0,
      y: 0,
      vy: 0,
      health: 2,
    },
    scorpion: {
      active: false,
      row: 0,
      x: 0,
      y: 0,
      vx: 0,
    },
    scorePopups: [],
    animTimer: 0,
    beatTimer: 0,
    beatStep: 0,
    spiderSpawnTimer: 4.0,
    fleaSpawnTimer: 10.0,
    scorpionSpawnTimer: 14.0,
    deathTimer: 0,
  });

  // Keep state sync
  useEffect(() => {
    engine.current.state = gameState;
  }, [gameState]);

  // Reset Blaster and field for new wave or respawn
  const resetField = useCallback((retainScoreAndWave = true) => {
    const s = engine.current;
    s.blaster = {
      x: GAME_WIDTH / 2,
      y: (ROWS - 2) * CELL_SIZE + CELL_SIZE / 2,
      width: 14,
      height: 14,
      speed: 210,
      isDead: false,
    };
    s.darts = [];
    s.spider.active = false;
    s.flea.active = false;
    s.scorpion.active = false;
    s.spiderSpawnTimer = 3.5;
    s.fleaSpawnTimer = 8.0;
    s.scorpionSpawnTimer = 12.0;

    if (!retainScoreAndWave) {
      s.score = 0;
      s.wave = 1;
      s.lives = 3;
      s.mushrooms = generateMushrooms();
      s.centipede = createCentipedeTrain(1);
      setScore(0);
      setWave(1);
      setLives(3);
    } else {
      // Regenerate damaged mushrooms with sound and bonus tally
      s.mushrooms.forEach(m => {
        if (m.health < 4) {
          m.health = 4;
          s.score += 5;
        }
      });
      setScore(s.score);
      s.centipede = createCentipedeTrain(s.wave);
    }
  }, []);

  // Start game with coin credit
  const handleStartGame = useCallback(() => {
    if (credits <= 0) {
      retroAudio.buttonClick();
      return;
    }
    onUseCredit();
    retroAudio.insertCoin();
    resetField(false);
    engine.current.state = 'playing';
    setGameState('playing');
  }, [credits, onUseCredit, resetField]);

  // Restart
  const handleRestart = useCallback(() => {
    if (credits > 0) {
      handleStartGame();
    } else {
      engine.current.state = 'start';
      setGameState('start');
    }
  }, [credits, handleStartGame]);

  // Keyboard shortcut listener for Start / Restart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'start') {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Digit1') {
          e.preventDefault();
          handleStartGame();
        }
      } else if (gameState === 'game_over') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleRestart();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleStartGame, handleRestart]);

  // Save High Score
  const handleSaveScore = useCallback(() => {
    const newEntry: CentipedeHighScore = {
      initials: (initials.trim().toUpperCase() || 'AAA').slice(0, 3),
      score: engine.current.score,
      wave: engine.current.wave,
      date: new Date().getFullYear().toString(),
    };

    const updated = [...highScores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setHighScores(updated);
    try {
      localStorage.setItem('retro_arcade_centipede_scores', JSON.stringify(updated));
    } catch {}
    setShowScoresModal(false);
  }, [highScores, initials]);

  // Main Loop Effect
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      if (canvas.width !== GAME_WIDTH || canvas.height !== GAME_HEIGHT) {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
      }

      const s = engine.current;
      s.animTimer += dt;
      const controls = controlsRef.current;

      // -------------------------------------------------------------
      // UPDATE GAME LOGIC
      // -------------------------------------------------------------
      if (s.state === 'playing') {
        // 1. Update Bug Blaster
        const b = s.blaster;
        if (!b.isDead) {
          let moveX = 0;
          let moveY = 0;

          if (controls.left) moveX -= 1;
          if (controls.right) moveX += 1;
          if (controls.up) moveY -= 1;
          if (controls.down) moveY += 1;

          if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.7071;
            moveY *= 0.7071;
          }

          b.x += moveX * b.speed * dt;
          b.y += moveY * b.speed * dt;

          // Confine to player zone (bottom rows)
          b.x = Math.max(8, Math.min(GAME_WIDTH - 8, b.x));
          b.y = Math.max(PLAYER_MIN_ROW * CELL_SIZE + 8, Math.min(GAME_HEIGHT - 8, b.y));

          // Blaster Firing
          s.dartCooldown -= dt;
          if (controls.fire && s.dartCooldown <= 0 && s.darts.length < 3) {
            s.dartCooldown = 0.16; // Rapid fire dart
            s.darts.push({
              x: b.x,
              y: b.y - 8,
              vy: -600,
              active: true,
            });
            retroAudio.centipedeShot();
          }
        }

        // 2. Update Laser Darts
        for (let i = s.darts.length - 1; i >= 0; i--) {
          const dart = s.darts[i];
          dart.y += dart.vy * dt;

          if (dart.y < 0) {
            s.darts.splice(i, 1);
            continue;
          }

          const dartCol = Math.floor(dart.x / CELL_SIZE);
          const dartRow = Math.floor(dart.y / CELL_SIZE);
          const key = `${dartCol},${dartRow}`;

          // Collision: Dart vs Mushroom
          if (s.mushrooms.has(key)) {
            const m = s.mushrooms.get(key)!;
            m.health--;
            if (m.health <= 0) {
              s.mushrooms.delete(key);
              s.score += 5;
              retroAudio.mushroomDestroy();
            } else {
              s.score += 1;
              retroAudio.mushroomHit();
            }
            setScore(s.score);
            s.darts.splice(i, 1);
            continue;
          }

          // Collision: Dart vs Centipede Segment
          let hitSegment = false;
          for (let cIdx = s.centipede.length - 1; cIdx >= 0; cIdx--) {
            const seg = s.centipede[cIdx];
            const dist = Math.hypot(dart.x - seg.x, dart.y - seg.y);
            if (dist < 10) {
              hitSegment = true;
              s.darts.splice(i, 1);

              // Segment destroyed: Drop new mushroom at its current tile
              const mCol = Math.max(0, Math.min(COLS - 1, Math.round((seg.x - CELL_SIZE / 2) / CELL_SIZE)));
              const mRow = Math.max(0, Math.min(ROWS - 1, Math.round((seg.y - CELL_SIZE / 2) / CELL_SIZE)));
              const mKey = `${mCol},${mRow}`;
              if (!s.mushrooms.has(mKey)) {
                s.mushrooms.set(mKey, { col: mCol, row: mRow, health: 4, isPoisoned: false });
              }

              // Award Score
              const pts = seg.isHead ? 100 : 10;
              s.score += pts;
              setScore(s.score);
              retroAudio.centipedeKill(seg.isHead);
              s.scorePopups.push({
                x: seg.x,
                y: seg.y - 10,
                text: `+${pts}`,
                color: seg.isHead ? '#f59e0b' : '#34d399',
                opacity: 1,
              });

              // The segment directly behind this one becomes a new Head!
              if (cIdx + 1 < s.centipede.length) {
                s.centipede[cIdx + 1].isHead = true;
              }

              // Remove destroyed segment
              s.centipede.splice(cIdx, 1);
              break;
            }
          }
          if (hitSegment) continue;

          // Collision: Dart vs Spider
          if (s.spider.active) {
            const distSpider = Math.hypot(dart.x - s.spider.x, dart.y - s.spider.y);
            if (distSpider < 14) {
              s.spider.active = false;
              s.score += s.spider.scoreValue;
              setScore(s.score);
              retroAudio.centipedeKill(true);
              s.scorePopups.push({
                x: s.spider.x,
                y: s.spider.y - 10,
                text: `+${s.spider.scoreValue}`,
                color: '#60a5fa',
                opacity: 1,
              });
              s.darts.splice(i, 1);
              continue;
            }
          }

          // Collision: Dart vs Flea
          if (s.flea.active) {
            const distFlea = Math.hypot(dart.x - s.flea.x, dart.y - s.flea.y);
            if (distFlea < 12) {
              s.flea.health--;
              if (s.flea.health <= 0) {
                s.flea.active = false;
                s.score += 200;
                setScore(s.score);
                retroAudio.centipedeKill(true);
                s.scorePopups.push({
                  x: s.flea.x,
                  y: s.flea.y - 10,
                  text: '+200',
                  color: '#f59e0b',
                  opacity: 1,
                });
              } else {
                retroAudio.mushroomHit();
              }
              s.darts.splice(i, 1);
              continue;
            }
          }

          // Collision: Dart vs Scorpion
          if (s.scorpion.active) {
            const distScorp = Math.hypot(dart.x - s.scorpion.x, dart.y - s.scorpion.y);
            if (distScorp < 14) {
              s.scorpion.active = false;
              s.score += 1000;
              setScore(s.score);
              retroAudio.centipedeKill(true);
              s.scorePopups.push({
                x: s.scorpion.x,
                y: s.scorpion.y - 10,
                text: '+1000',
                color: '#c084fc',
                opacity: 1,
              });
              s.darts.splice(i, 1);
              continue;
            }
          }
        }

        // 3. Update Centipede Movement
        // Crawl speed increases as segments are cleared and in higher waves
        const crawlSpeed = 6.0 + (12 - s.centipede.length) * 0.4 + s.wave * 0.8;

        // Audio Beat Drone
        s.beatTimer += dt;
        const beatInterval = Math.max(0.12, 0.4 - (12 - s.centipede.length) * 0.02);
        if (s.beatTimer >= beatInterval) {
          s.beatTimer = 0;
          s.beatStep++;
          if (s.centipede.length > 0) {
            retroAudio.centipedeBeat(s.beatStep);
          }
        }

        for (const seg of s.centipede) {
          seg.progress += crawlSpeed * dt;

          if (seg.progress >= 1.0) {
            seg.progress = 0;
            seg.col = seg.targetCol;
            seg.row = seg.targetRow;

            // Check next tile ahead
            let nextCol = seg.col + seg.dirX;
            let nextRow = seg.row;

            const nextKey = `${nextCol},${nextRow}`;
            const hitsMushroom = s.mushrooms.has(nextKey);
            const hitsWall = nextCol < 0 || nextCol >= COLS;

            if (hitsMushroom) {
              const m = s.mushrooms.get(nextKey)!;
              if (m.isPoisoned) {
                // Poisoned plunge: head straight to the bottom!
                seg.isPoisonedPlunge = true;
              }
            }

            if (seg.isPoisonedPlunge) {
              // Plunge down row by row
              nextCol = seg.col;
              nextRow = seg.row + 1;
              if (nextRow >= ROWS - 1) {
                seg.isPoisonedPlunge = false;
                seg.dirY = -1;
              }
            } else if (hitsMushroom || hitsWall) {
              // Drop down 1 row and reverse horizontal direction
              seg.dirX = (seg.dirX === 1 ? -1 : 1);
              nextCol = seg.col;
              nextRow = seg.row + seg.dirY;

              // Check if reached top of player zone while moving up
              if (nextRow <= PLAYER_MIN_ROW && seg.dirY === -1) {
                seg.dirY = 1;
              }
              // Check if reached bottom of screen
              else if (nextRow >= ROWS - 1) {
                seg.dirY = -1;
              }
            }

            seg.targetCol = Math.max(0, Math.min(COLS - 1, nextCol));
            seg.targetRow = Math.max(0, Math.min(ROWS - 1, nextRow));
          }

          // Smooth interpolation between cells
          seg.x = (seg.col + (seg.targetCol - seg.col) * seg.progress) * CELL_SIZE + CELL_SIZE / 2;
          seg.y = (seg.row + (seg.targetRow - seg.row) * seg.progress) * CELL_SIZE + CELL_SIZE / 2;

          // Collision with Blaster
          if (!b.isDead) {
            const dist = Math.hypot(b.x - seg.x, b.y - seg.y);
            if (dist < 12) {
              b.isDead = true;
              s.state = 'dying';
              s.deathTimer = 2.0;
              retroAudio.playerExplosion();
              break;
            }
          }
        }

        // 4. Update Spider
        s.spiderSpawnTimer -= dt;
        if (s.spiderSpawnTimer <= 0 && !s.spider.active) {
          const spawnLeft = Math.random() < 0.5;
          s.spider = {
            active: true,
            x: spawnLeft ? 0 : GAME_WIDTH,
            y: (PLAYER_MIN_ROW + Math.random() * 4) * CELL_SIZE,
            vx: (spawnLeft ? 1 : -1) * (90 + Math.random() * 40),
            vy: (Math.random() < 0.5 ? 1 : -1) * (80 + Math.random() * 40),
            timer: 0,
            scoreValue: 300,
          };
          s.spiderSpawnTimer = 8.0 + Math.random() * 6.0;
          retroAudio.spiderChirp();
        }

        if (s.spider.active) {
          const sp = s.spider;
          sp.x += sp.vx * dt;
          sp.y += sp.vy * dt;

          // Bounce vertically within player zone
          if (sp.y < PLAYER_MIN_ROW * CELL_SIZE) {
            sp.y = PLAYER_MIN_ROW * CELL_SIZE;
            sp.vy = Math.abs(sp.vy);
          } else if (sp.y > (ROWS - 1) * CELL_SIZE) {
            sp.y = (ROWS - 1) * CELL_SIZE;
            sp.vy = -Math.abs(sp.vy);
          }

          // Eat mushrooms it touches
          const spCol = Math.floor(sp.x / CELL_SIZE);
          const spRow = Math.floor(sp.y / CELL_SIZE);
          const spKey = `${spCol},${spRow}`;
          if (s.mushrooms.has(spKey)) {
            s.mushrooms.delete(spKey);
          }

          // Calculate proximity score value to blaster
          const distToBlaster = Math.hypot(b.x - sp.x, b.y - sp.y);
          if (distToBlaster < 40) sp.scoreValue = 900;
          else if (distToBlaster < 90) sp.scoreValue = 600;
          else sp.scoreValue = 300;

          // Lethal contact with Blaster
          if (!b.isDead && distToBlaster < 14) {
            b.isDead = true;
            s.state = 'dying';
            s.deathTimer = 2.0;
            retroAudio.playerExplosion();
          }

          // Exits screen
          if ((sp.vx > 0 && sp.x > GAME_WIDTH + 20) || (sp.vx < 0 && sp.x < -20)) {
            sp.active = false;
          }
        }

        // 5. Update Flea
        s.fleaSpawnTimer -= dt;
        // Count mushrooms in player area
        let playerMushrooms = 0;
        s.mushrooms.forEach(m => {
          if (m.row >= PLAYER_MIN_ROW) playerMushrooms++;
        });

        if (playerMushrooms < 5 && s.fleaSpawnTimer <= 0 && !s.flea.active) {
          const col = Math.floor(Math.random() * COLS);
          s.flea = {
            active: true,
            col,
            x: col * CELL_SIZE + CELL_SIZE / 2,
            y: 0,
            vy: 240,
            health: 2,
          };
          s.fleaSpawnTimer = 12.0;
          retroAudio.fleaDrop();
        }

        if (s.flea.active) {
          const fl = s.flea;
          fl.y += fl.vy * dt;

          // Occasionally plant mushrooms in path
          if (Math.random() < 0.25) {
            const mRow = Math.floor(fl.y / CELL_SIZE);
            const mKey = `${fl.col},${mRow}`;
            if (!s.mushrooms.has(mKey) && mRow < ROWS - 1) {
              s.mushrooms.set(mKey, { col: fl.col, row: mRow, health: 4, isPoisoned: false });
            }
          }

          // Contact with Blaster
          if (!b.isDead) {
            const dist = Math.hypot(b.x - fl.x, b.y - fl.y);
            if (dist < 12) {
              b.isDead = true;
              s.state = 'dying';
              s.deathTimer = 2.0;
              retroAudio.playerExplosion();
            }
          }

          if (fl.y > GAME_HEIGHT) {
            fl.active = false;
          }
        }

        // 6. Update Scorpion (Wave 2+)
        if (s.wave >= 2) {
          s.scorpionSpawnTimer -= dt;
          if (s.scorpionSpawnTimer <= 0 && !s.scorpion.active) {
            const spawnLeft = Math.random() < 0.5;
            const scorpRow = Math.floor(Math.random() * (PLAYER_MIN_ROW - 8)) + 4;
            s.scorpion = {
              active: true,
              row: scorpRow,
              x: spawnLeft ? 0 : GAME_WIDTH,
              y: scorpRow * CELL_SIZE + CELL_SIZE / 2,
              vx: (spawnLeft ? 1 : -1) * 110,
            };
            s.scorpionSpawnTimer = 14.0 + Math.random() * 8.0;
            retroAudio.scorpionBuzz();
          }

          if (s.scorpion.active) {
            const sc = s.scorpion;
            sc.x += sc.vx * dt;

            // Poison mushrooms it crosses!
            const scCol = Math.floor(sc.x / CELL_SIZE);
            const scKey = `${scCol},${sc.row}`;
            if (s.mushrooms.has(scKey)) {
              s.mushrooms.get(scKey)!.isPoisoned = true;
            }

            if ((sc.vx > 0 && sc.x > GAME_WIDTH + 20) || (sc.vx < 0 && sc.x < -20)) {
              sc.active = false;
            }
          }
        }

        // 7. Check Wave Clear
        if (s.centipede.length === 0) {
          s.wave++;
          setWave(s.wave);
          retroAudio.levelComplete();
          resetField(true);
        }

        // 8. Update Score Popups
        for (let i = s.scorePopups.length - 1; i >= 0; i--) {
          const pop = s.scorePopups[i];
          pop.y -= 25 * dt;
          pop.opacity -= 1.2 * dt;
          if (pop.opacity <= 0) {
            s.scorePopups.splice(i, 1);
          }
        }
      }

      // Handle Dying State
      else if (s.state === 'dying') {
        s.deathTimer -= dt;
        if (s.deathTimer <= 0) {
          s.lives--;
          setLives(s.lives);
          if (s.lives > 0) {
            resetField(true);
            s.state = 'playing';
            setGameState('playing');
          } else {
            s.state = 'game_over';
            setGameState('game_over');
            setShowScoresModal(true);
            retroAudio.gameOver();
          }
        }
      }

      // -------------------------------------------------------------
      // RENDER GAME CANVAS
      // -------------------------------------------------------------
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Deep Black Arcade CRT Background
      ctx.fillStyle = '#020408';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Subtle Player Area Boundary Line (Row 25)
      ctx.strokeStyle = '#065f46';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(0, PLAYER_MIN_ROW * CELL_SIZE);
      ctx.lineTo(GAME_WIDTH, PLAYER_MIN_ROW * CELL_SIZE);
      ctx.stroke();
      ctx.setLineDash([]);

      // 1. Draw Mushrooms
      s.mushrooms.forEach(m => {
        drawMushroom(ctx, m);
      });

      // 2. Draw Scorpion
      drawScorpion(ctx, s.scorpion, s.animTimer);

      // 3. Draw Flea
      drawFlea(ctx, s.flea, s.animTimer);

      // 4. Draw Spider
      drawSpider(ctx, s.spider, s.animTimer);

      // 5. Draw Centipede
      s.centipede.forEach(seg => {
        drawCentipedeSegment(ctx, seg, s.animTimer);
      });

      // 6. Draw Laser Darts
      ctx.fillStyle = '#22d3ee'; // Neon Cyan
      s.darts.forEach(dart => {
        ctx.fillRect(dart.x - 1, dart.y - 6, 2, 8);
      });

      // 7. Draw Blaster
      drawBlaster(ctx, s.blaster, s.animTimer);

      // 8. Draw Score Popups
      s.scorePopups.forEach(pop => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.opacity);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 9px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      });

      // 9. Top HUD Banner
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "Press Start 2P", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`1UP`, 20, 20);
      ctx.fillStyle = '#10b981';
      ctx.fillText(s.score.toString().padStart(6, '0'), 20, 34);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${s.wave}`, GAME_WIDTH / 2, 20);

      // Lives remaining indicator
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      for (let l = 0; l < s.lives; l++) {
        const lx = GAME_WIDTH - 25 - l * 18;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(lx, 26);
        ctx.lineTo(lx + 6, 36);
        ctx.lineTo(lx - 6, 36);
        ctx.closePath();
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [resetField]);

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-[#030508]">
      {/* Top HUD Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-1.5 bg-[#060911] border-b border-teal-900/40 text-xs font-arcade tracking-wider z-20 flex-none">
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">1UP SCORE</span>
            <span className="text-teal-300 font-bold text-sm tracking-widest">
              {score.toString().padStart(6, '0')}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">HIGH SCORE</span>
            <span className="text-yellow-400 font-bold text-sm tracking-widest">
              {(highScores[0]?.score || 0).toString().padStart(6, '0')}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">WAVE</span>
            <span className="text-cyan-400 font-bold text-sm">#{wave}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Lives Counter */}
          <div className="flex items-center gap-1 mr-1 sm:mr-2">
            {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
              <svg key={i} className="w-3.5 h-3.5 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12,2 4,20 12,16 20,20" />
              </svg>
            ))}
          </div>

          <button
            onClick={() => setShowScoresModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-teal-950/60 border border-teal-500/50 hover:bg-teal-900/60 text-teal-300 text-[9px] font-arcade cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span className="hidden sm:inline">TOP 5</span>
          </button>

          <button
            onClick={() => {
              const nextMute = retroAudio.toggleMute();
              setIsMuted(nextMute);
            }}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {onBackToArcade && (
            <button
              onClick={onBackToArcade}
              className="px-2 py-1 rounded bg-teal-950 hover:bg-teal-900 border border-teal-500/50 text-[10px] text-teal-300 cursor-pointer"
            >
              CABINET ROW
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center p-1 sm:p-2">
        <div className="relative h-full max-h-full aspect-[480/512] rounded-lg overflow-hidden border border-gray-800 bg-black shadow-[0_0_25px_rgba(20,184,166,0.3)]">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="w-full h-full object-contain block image-rendering-pixelated"
          />

          {/* Start Screen Overlay */}
          {gameState === 'start' && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="text-teal-400 text-2xl sm:text-3xl font-arcade font-bold tracking-widest crt-glow mb-2 animate-pulse">
                CENTIPEDE
              </div>
              <div className="text-[10px] font-mono text-gray-400 mb-6 tracking-wide">
                © 1980 ATARI INC.
              </div>

              <div className="max-w-xs text-xs text-gray-300 font-sans leading-relaxed mb-6 space-y-2 bg-[#090d16] p-4 rounded-lg border border-teal-500/30">
                <p>
                  Defend the enchanted mushroom garden from the descending centipede!
                </p>
                <p className="text-[10px] text-teal-300 font-mono">
                  • Shoot centipede segments to split it into heads (+100 PTS)<br />
                  • Blast jumping spiders (+300 to +900 PTS)<br />
                  • Beware plunging fleas & toxic scorpions!
                </p>
              </div>

              {credits > 0 ? (
                <button
                  onClick={handleStartGame}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-black font-arcade text-xs tracking-wider shadow-[0_0_20px_rgba(20,184,166,0.6)] cursor-pointer active:scale-95 transition-all font-bold"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>START GAME (1 CREDIT)</span>
                </button>
              ) : (
                <div className="text-center">
                  <div className="text-xs font-arcade text-amber-400 animate-pulse mb-2">
                    INSERT COIN TO PLAY
                  </div>
                  <div className="text-[10px] font-mono text-gray-500">
                    CLICK "INSERT 25¢" OR PRESS KEY [C]
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Game Over Screen Overlay */}
          {gameState === 'game_over' && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="text-red-500 text-3xl font-arcade font-bold tracking-widest crt-glow mb-3">
                GAME OVER
              </div>
              <div className="text-xs font-arcade text-gray-300 mb-1">FINAL SCORE</div>
              <div className="text-2xl font-arcade text-yellow-400 mb-6">
                {score.toString().padStart(6, '0')}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-black font-arcade text-xs tracking-wider shadow-[0_0_15px_rgba(20,184,166,0.5)] cursor-pointer active:scale-95 transition-all font-bold"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>PLAY AGAIN</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* On-Screen Touch Virtual Controls for Mobile Devices */}
      <div className="flex-none w-full max-w-xl mt-2 px-2 flex items-center justify-between z-10 sm:hidden">
        {/* D-Pad */}
        <div className="grid grid-cols-3 gap-1 w-28 h-28">
          <div></div>
          <button
            onTouchStart={() => (controlsRef.current.up = true)}
            onTouchEnd={() => (controlsRef.current.up = false)}
            className="rounded bg-gray-800/80 active:bg-teal-600 text-white text-xs font-arcade flex items-center justify-center border border-gray-700"
          >
            ▲
          </button>
          <div></div>
          <button
            onTouchStart={() => (controlsRef.current.left = true)}
            onTouchEnd={() => (controlsRef.current.left = false)}
            className="rounded bg-gray-800/80 active:bg-teal-600 text-white text-xs font-arcade flex items-center justify-center border border-gray-700"
          >
            ◀
          </button>
          <div></div>
          <button
            onTouchStart={() => (controlsRef.current.right = true)}
            onTouchEnd={() => (controlsRef.current.right = false)}
            className="rounded bg-gray-800/80 active:bg-teal-600 text-white text-xs font-arcade flex items-center justify-center border border-gray-700"
          >
            ▶
          </button>
          <div></div>
          <button
            onTouchStart={() => (controlsRef.current.down = true)}
            onTouchEnd={() => (controlsRef.current.down = false)}
            className="rounded bg-gray-800/80 active:bg-teal-600 text-white text-xs font-arcade flex items-center justify-center border border-gray-700"
          >
            ▼
          </button>
          <div></div>
        </div>

        {/* Action Button: FIRE */}
        <div className="flex items-center gap-3">
          <button
            onTouchStart={() => {
              controlsRef.current.fire = true;
              if (navigator.vibrate) navigator.vibrate(20);
            }}
            onTouchEnd={() => (controlsRef.current.fire = false)}
            className="w-16 h-16 rounded-full bg-teal-600/90 active:bg-teal-400 text-black font-arcade text-xs flex flex-col items-center justify-center border-2 border-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.6)] cursor-pointer font-bold"
          >
            <span>FIRE</span>
          </button>
        </div>
      </div>

      {/* Top 5 High Scores Modal */}
      {showScoresModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b0f19] border-2 border-teal-500 rounded-xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(20,184,166,0.4)]">
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="text-sm font-arcade text-teal-300">
                  CENTIPEDE TOP SCORES
                </h3>
              </div>
              <button
                onClick={() => setShowScoresModal(false)}
                className="text-gray-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Score List */}
            <div className="space-y-2 mb-6">
              {highScores.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 rounded bg-black/50 border border-gray-800/60 font-arcade text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-4">{idx + 1}.</span>
                    <span className="text-teal-400 font-bold">{entry.initials}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-gray-400 font-mono">WAVE {entry.wave}</span>
                    <span className="text-yellow-400 font-bold tracking-wider">
                      {entry.score.toString().padStart(6, '0')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Initials Input when Game Over */}
            {gameState === 'game_over' && (
              <div className="border-t border-gray-800 pt-4 flex flex-col items-center">
                <span className="text-[10px] font-arcade text-gray-300 mb-2">
                  ENTER INITIALS (3 LETTERS):
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={3}
                    value={initials}
                    onChange={(e) => setInitials(e.target.value.toUpperCase())}
                    className="w-24 text-center px-2 py-1 bg-black border border-teal-400 rounded text-teal-300 font-arcade text-lg tracking-widest outline-none"
                  />
                  <button
                    onClick={handleSaveScore}
                    className="px-4 py-1 rounded bg-teal-600 hover:bg-teal-500 text-black font-arcade text-xs cursor-pointer font-bold"
                  >
                    SAVE
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
