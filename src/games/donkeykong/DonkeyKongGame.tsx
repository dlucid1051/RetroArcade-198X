import React, { useEffect, useRef, useState, useCallback } from 'react';
import { retroAudio } from '../../audio/retroAudio';
import { ArcadeControlsState } from '../../input/useArcadeInput';
import {
  DKGameState,
  Girder,
  Ladder,
  Jumpman,
  Barrel,
  Fireball,
  HammerItem,
  Pauline,
  Kong,
  OilDrum,
  DKScorePopup,
  DKHighScore,
} from './types';
import {
  drawJumpman,
  drawDonkeyKong,
  drawPauline,
  drawBarrel,
  drawSingleBarrel,
  drawOilDrum,
  drawFireball,
  drawHammerItem,
  drawGirder,
  drawLadder,
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

interface DonkeyKongGameProps {
  controlsRef: React.MutableRefObject<ArcadeControlsState>;
  onBackToArcade?: () => void;
  credits: number;
  onUseCredit: () => boolean;
  scanlines: boolean;
  hasGamepad: boolean;
}

const DEFAULT_DK_SCORES: DKHighScore[] = [
  { initials: 'BIL', score: 87400, level: 5, date: '1981' },
  { initials: 'STE', score: 54200, level: 3, date: '1982' },
  { initials: 'MAR', score: 32600, level: 2, date: '1981' },
  { initials: 'JMP', score: 18400, level: 1, date: '1981' },
  { initials: 'D_K', score: 7500, level: 1, date: '1981' },
];

// Logical Canvas Dimensions
const GAME_WIDTH = 480;
const GAME_HEIGHT = 560;

// Girders Geometry (Level 25m)
const GIRDERS: Girder[] = [
  // Girder 0: Bottom floor (x: 20 to 460, y: 520)
  { id: 0, x1: 20, y1: 520, x2: 460, y2: 520 },
  // Girder 1: Slants downward to the right (x: 20, y: 442 to x: 440, y: 456)
  { id: 1, x1: 20, y1: 442, x2: 440, y2: 456 },
  // Girder 2: Slants downward to the left (x: 40, y: 390 to x: 460, y: 374)
  { id: 2, x1: 40, y1: 390, x2: 460, y2: 374 },
  // Girder 3: Slants downward to the right (x: 20, y: 308 to x: 440, y: 324)
  { id: 3, x1: 20, y1: 308, x2: 440, y2: 324 },
  // Girder 4: Slants downward to the left (x: 40, y: 256 to x: 460, y: 240)
  { id: 4, x1: 40, y1: 256, x2: 460, y2: 240 },
  // Girder 5: Top Donkey Kong platform (x: 30 to 200, flat y: 156) & slanted section (x: 200, y: 156 to x: 440, y: 172)
  { id: 5, x1: 30, y1: 156, x2: 440, y2: 172 },
  // Pauline's Platform: (x: 180 to 280, y: 90)
  { id: 6, x1: 180, y1: 90, x2: 280, y2: 90 },
];

// Ladders connecting the girders
const LADDERS: Ladder[] = [
  // Girder 0 -> 1: Right intact ladder (x: 410, yTop: 454, yBottom: 520)
  { id: 0, x: 410, yTop: 454, yBottom: 520 },
  // Girder 0 -> 1: Middle broken ladder (x: 240)
  { id: 1, x: 240, yTop: 450, yBottom: 520, isBroken: true, brokenYStart: 470, brokenYEnd: 495 },

  // Girder 1 -> 2: Left intact ladder (x: 80, yTop: 388, yBottom: 444)
  { id: 2, x: 80, yTop: 388, yBottom: 444 },
  // Girder 1 -> 2: Middle broken ladder (x: 220)
  { id: 3, x: 220, yTop: 382, yBottom: 449, isBroken: true, brokenYStart: 400, brokenYEnd: 425 },

  // Girder 2 -> 3: Right intact ladder (x: 410, yTop: 322, yBottom: 376)
  { id: 4, x: 410, yTop: 322, yBottom: 376 },
  // Girder 2 -> 3: Left middle intact ladder (x: 170, yTop: 314, yBottom: 384)
  { id: 5, x: 170, yTop: 314, yBottom: 384 },

  // Girder 3 -> 4: Left intact ladder (x: 80, yTop: 254, yBottom: 310)
  { id: 6, x: 80, yTop: 254, yBottom: 310 },
  // Girder 3 -> 4: Middle broken ladder (x: 270)
  { id: 7, x: 270, yTop: 248, yBottom: 318, isBroken: true, brokenYStart: 270, brokenYEnd: 295 },

  // Girder 4 -> 5: Right intact ladder (x: 410, yTop: 170, yBottom: 242)
  { id: 8, x: 410, yTop: 170, yBottom: 242 },
  // Girder 4 -> 5: Left middle ladder (x: 210, yTop: 156, yBottom: 250)
  { id: 9, x: 210, yTop: 156, yBottom: 250 },

  // Girder 5 -> Pauline: Top Ladder (x: 200, yTop: 90, yBottom: 156)
  { id: 10, x: 200, yTop: 90, yBottom: 156 },
];

/** Get surface Y for a given girder and X coordinate */
function getGirderY(girder: Girder, x: number): number {
  if (girder.id === 5 && x < 200) {
    // Left side of top girder is flat for Donkey Kong
    return 156;
  }
  const ratio = (x - girder.x1) / (girder.x2 - girder.x1);
  return girder.y1 + (girder.y2 - girder.y1) * Math.max(0, Math.min(1, ratio));
}

/** Check which girder is directly beneath an entity at (x, y) */
function findGirderUnder(x: number, y: number): { girder: Girder; surfaceY: number } | null {
  for (const g of GIRDERS) {
    if (x >= g.x1 - 10 && x <= g.x2 + 10) {
      const surfaceY = getGirderY(g, x);
      // If entity is within 14px above or 8px below surface
      if (y >= surfaceY - 14 && y <= surfaceY + 12) {
        return { girder: g, surfaceY };
      }
    }
  }
  return null;
}

export const DonkeyKongGame: React.FC<DonkeyKongGameProps> = ({
  controlsRef,
  onBackToArcade,
  credits,
  onUseCredit,
  scanlines,
  hasGamepad,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // High Scores State
  const [highScores, setHighScores] = useState<DKHighScore[]>(() => {
    try {
      const saved = localStorage.getItem('retro_arcade_dk_scores');
      return saved ? JSON.parse(saved) : DEFAULT_DK_SCORES;
    } catch {
      return DEFAULT_DK_SCORES;
    }
  });

  const [gameState, setGameState] = useState<DKGameState>('start');
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [lives, setLives] = useState<number>(3);
  const [bonusTimer, setBonusTimer] = useState<number>(5000);
  const [showScoresModal, setShowScoresModal] = useState<boolean>(false);
  const [initials, setInitials] = useState<string>('AAA');
  const [isMuted, setIsMuted] = useState<boolean>(() => retroAudio.getMuted());

  // Game Engine Refs
  const gameStateRef = useRef<{
    state: DKGameState;
    score: number;
    level: number;
    lives: number;
    bonusTimer: number;
    bonusAccumulator: number;
    jumpman: Jumpman;
    kong: Kong;
    pauline: Pauline;
    oilDrum: OilDrum;
    barrels: Barrel[];
    fireballs: Fireball[];
    hammers: HammerItem[];
    scorePopups: DKScorePopup[];
    barrelSpawnTimer: number;
    animTimer: number;
    deathTimer: number;
    clearTimer: number;
    kongChestTimer: number;
    hammerSwingTick: number;
  }>({
    state: 'start',
    score: 0,
    level: 1,
    lives: 3,
    bonusTimer: 5000,
    bonusAccumulator: 0,
    jumpman: {
      x: 100,
      y: 520,
      vx: 0,
      vy: 0,
      width: 22,
      height: 28,
      facing: 'right',
      state: 'idle',
      isGrounded: true,
      onLadder: false,
      ladderId: null,
      animFrame: 0,
      animTimer: 0,
      hammerTimer: 0,
      hammerStep: 0,
      hammerAngle: 0,
    },
    kong: {
      x: 110,
      y: 156,
      state: 'idle',
      stateTimer: 0,
      animFrame: 0,
      chestBeatCount: 0,
    },
    pauline: {
      x: 230,
      y: 90,
      animTimer: 0,
      helpTimer: 0,
    },
    oilDrum: {
      x: 60,
      y: 520,
      width: 32,
      height: 38,
      isLit: false,
      fireTimer: 0,
    },
    barrels: [],
    fireballs: [],
    hammers: [
      { id: 0, x: 80, y: 256, active: true },
      { id: 1, x: 420, y: 374, active: true },
    ],
    scorePopups: [],
    barrelSpawnTimer: 2.0,
    animTimer: 0,
    deathTimer: 0,
    clearTimer: 0,
    kongChestTimer: 0,
    hammerSwingTick: 0,
  });

  // Keep state sync
  useEffect(() => {
    gameStateRef.current.state = gameState;
  }, [gameState]);

  // Reset Jumpman for new round or respawn
  const resetJumpman = useCallback((retainScoreAndLevel = true) => {
    const s = gameStateRef.current;
    s.jumpman = {
      x: 100,
      y: 520,
      vx: 0,
      vy: 0,
      width: 22,
      height: 28,
      facing: 'right',
      state: 'idle',
      isGrounded: true,
      onLadder: false,
      ladderId: null,
      animFrame: 0,
      animTimer: 0,
      hammerTimer: 0,
      hammerStep: 0,
      hammerAngle: 0,
    };
    s.barrels = [];
    s.fireballs = [];
    s.barrelSpawnTimer = 2.0;

    if (!retainScoreAndLevel) {
      s.score = 0;
      s.level = 1;
      s.lives = 3;
      s.bonusTimer = 5000;
      s.hammers = [
        { id: 0, x: 80, y: 256, active: true },
        { id: 1, x: 420, y: 374, active: true },
      ];
      s.oilDrum.isLit = false;
      setScore(0);
      setLevel(1);
      setLives(3);
      setBonusTimer(5000);
    }
  }, []);

  // Start / Insert Coin & Play
  const handleStartGame = useCallback(() => {
    if (credits <= 0) {
      retroAudio.buttonClick();
      return;
    }
    onUseCredit();
    retroAudio.insertCoin();
    resetJumpman(false);
    gameStateRef.current.state = 'playing';
    setGameState('playing');
  }, [credits, onUseCredit, resetJumpman]);

  // Restart after game over
  const handleRestart = useCallback(() => {
    if (credits > 0) {
      handleStartGame();
    } else {
      gameStateRef.current.state = 'start';
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
    const newEntry: DKHighScore = {
      initials: (initials.trim().toUpperCase() || 'AAA').slice(0, 3),
      score: gameStateRef.current.score,
      level: gameStateRef.current.level,
      date: new Date().getFullYear().toString(),
    };

    const updated = [...highScores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    setHighScores(updated);
    try {
      localStorage.setItem('retro_arcade_dk_scores', JSON.stringify(updated));
    } catch {
      // ignore
    }
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

      // Ensure crisp pixel scaling
      if (canvas.width !== GAME_WIDTH || canvas.height !== GAME_HEIGHT) {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
      }

      const s = gameStateRef.current;
      s.animTimer += dt;
      const controls = controlsRef.current;

      // -------------------------------------------------------------
      // UPDATE GAME LOGIC
      // -------------------------------------------------------------
      if (s.state === 'playing') {
        // Bonus timer countdown: decreases by 100 every ~2.5s
        s.bonusAccumulator += dt;
        if (s.bonusAccumulator >= 2.5) {
          s.bonusAccumulator = 0;
          s.bonusTimer = Math.max(0, s.bonusTimer - 100);
          setBonusTimer(s.bonusTimer);
          if (s.bonusTimer === 0) {
            // Time out: Kill Jumpman
            s.state = 'dying';
            s.deathTimer = 2.0;
            s.jumpman.state = 'dead';
            retroAudio.dkDeath();
          }
        }

        // 1. Update Jumpman
        const p = s.jumpman;
        const walkSpeed = 110;
        const climbSpeed = 80;
        const gravity = 580;
        const jumpForce = -230;

        // Hammer active timer
        if (p.hammerTimer > 0) {
          p.hammerTimer -= dt;
          s.hammerSwingTick += dt;
          if (s.hammerSwingTick >= 0.14) {
            s.hammerSwingTick = 0;
            p.hammerStep++;
            p.hammerAngle = p.hammerStep % 2;
            retroAudio.dkHammer(p.hammerStep);
          }
        }

        // Check if Jumpman picked up a hammer
        s.hammers.forEach(h => {
          if (h.active) {
            const dist = Math.hypot(p.x - h.x, p.y - h.y);
            if (dist < 20) {
              h.active = false;
              p.hammerTimer = 10.0; // 10 seconds of hammer power!
              p.hammerStep = 0;
              p.hammerAngle = 0;
              retroAudio.buttonClick();
              // Popup score +100
              s.score += 100;
              setScore(s.score);
              s.scorePopups.push({
                x: h.x,
                y: h.y - 10,
                text: '+100',
                color: '#eab308',
                opacity: 1,
              });
            }
          }
        });

        // Jumpman Ladder Interaction
        // Find if Jumpman is near any ladder
        let nearbyLadder: Ladder | null = null;
        for (const l of LADDERS) {
          if (Math.abs(p.x - l.x) < 14 && p.y >= l.yTop - 6 && p.y <= l.yBottom + 8) {
            if (!l.isBroken || (l.brokenYStart && l.brokenYEnd && (p.y < l.brokenYStart || p.y > l.brokenYEnd))) {
              nearbyLadder = l;
              break;
            }
          }
        }

        // Can only climb if NOT holding a hammer!
        if (p.hammerTimer <= 0) {
          if (nearbyLadder && (controls.up || controls.down)) {
            // Snap to ladder center
            p.x = nearbyLadder.x;
            p.onLadder = true;
            p.ladderId = nearbyLadder.id;
            p.isGrounded = false;
            p.state = 'climbing';
          }
        }

        if (p.onLadder && nearbyLadder) {
          p.vx = 0;
          p.vy = 0;
          if (controls.up) {
            p.y -= climbSpeed * dt;
            p.animFrame += dt * 6;
            if (Math.floor(p.animFrame) % 4 === 0) retroAudio.dkFootstep();
          } else if (controls.down) {
            p.y += climbSpeed * dt;
            p.animFrame += dt * 6;
            if (Math.floor(p.animFrame) % 4 === 0) retroAudio.dkFootstep();
          }

          // Check if reached top of ladder (land on upper girder)
          if (p.y <= nearbyLadder.yTop) {
            p.y = nearbyLadder.yTop;
            p.onLadder = false;
            p.isGrounded = true;
            p.state = 'idle';
          }
          // Check if reached bottom of ladder
          else if (p.y >= nearbyLadder.yBottom) {
            p.y = nearbyLadder.yBottom;
            p.onLadder = false;
            p.isGrounded = true;
            p.state = 'idle';
          }
        } else {
          // Horizontal Walking
          if (controls.left) {
            p.vx = -walkSpeed;
            p.facing = 'left';
            if (p.isGrounded) {
              p.state = 'running';
              p.animFrame += dt * 9;
              if (Math.floor(p.animFrame) % 5 === 0) retroAudio.dkFootstep();
            }
          } else if (controls.right) {
            p.vx = walkSpeed;
            p.facing = 'right';
            if (p.isGrounded) {
              p.state = 'running';
              p.animFrame += dt * 9;
              if (Math.floor(p.animFrame) % 5 === 0) retroAudio.dkFootstep();
            }
          } else {
            p.vx = 0;
            if (p.isGrounded) p.state = 'idle';
          }

          // Jump (Only when grounded and NOT holding hammer)
          if ((controls.fire || controls.up) && p.isGrounded && p.hammerTimer <= 0) {
            p.vy = jumpForce;
            p.isGrounded = false;
            p.state = 'jumping';
            retroAudio.dkJump();
          }

          // Apply Gravity
          if (!p.isGrounded) {
            p.vy += gravity * dt;
            p.state = 'jumping';
          }

          // Apply Movement
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // Boundary clamping
          p.x = Math.max(30, Math.min(GAME_WIDTH - 30, p.x));

          // Check Girder Landing
          const girderInfo = findGirderUnder(p.x, p.y);
          if (girderInfo && p.vy >= 0) {
            p.y = girderInfo.surfaceY;
            p.vy = 0;
            p.isGrounded = true;
          } else if (!girderInfo && p.isGrounded) {
            // Walked off the edge of a girder
            p.isGrounded = false;
          }

          // Pit death: fell below screen
          if (p.y > GAME_HEIGHT) {
            s.state = 'dying';
            s.deathTimer = 2.0;
            p.state = 'dead';
            retroAudio.dkDeath();
          }
        }

        // 2. Check Level Clear (Reached Pauline at the summit)
        if (p.x >= 180 && p.x <= 280 && p.y <= 95) {
          s.state = 'level_clear';
          s.clearTimer = 3.2;
          // Add remaining bonus timer to score
          s.score += s.bonusTimer;
          setScore(s.score);
          retroAudio.dkVictory();
        }

        // 3. Donkey Kong AI & Barrel Spawning
        const k = s.kong;
        s.barrelSpawnTimer -= dt;
        s.kongChestTimer += dt;

        // DK periodic chest beat animation
        if (s.kongChestTimer >= 6.0 && k.state === 'idle') {
          k.state = 'chest_beat';
          k.stateTimer = 1.2;
          s.kongChestTimer = 0;
          retroAudio.dkKongChest();
        }

        if (k.state === 'chest_beat') {
          k.stateTimer -= dt;
          if (k.stateTimer <= 0) {
            k.state = 'idle';
          }
        }

        // Barrel Throw sequence
        const spawnInterval = Math.max(2.4, 4.2 - s.level * 0.35);
        if (s.barrelSpawnTimer <= 0 && k.state === 'idle') {
          k.state = 'hold';
          k.stateTimer = 0.8;
          s.barrelSpawnTimer = spawnInterval;
        }

        if (k.state === 'hold') {
          k.stateTimer -= dt;
          if (k.stateTimer <= 0) {
            k.state = 'roll';
            k.stateTimer = 0.4;
            // Spawn new barrel on Girder 5
            const isBlue = Math.random() < 0.15; // 15% chance for blue fire barrel
            s.barrels.push({
              id: Date.now() + Math.random(),
              x: 180,
              y: 156,
              vx: 90 + s.level * 10,
              vy: 0,
              radius: 11,
              girderIndex: 5,
              state: 'rolling',
              rotation: 0,
              isBlue,
              scoredJump: false,
            });
            retroAudio.dkBarrelRoll();
          }
        } else if (k.state === 'roll') {
          k.stateTimer -= dt;
          if (k.stateTimer <= 0) {
            k.state = 'idle';
          }
        }

        // 4. Update Barrels
        for (let i = s.barrels.length - 1; i >= 0; i--) {
          const b = s.barrels[i];

          // Barrel rotation visual
          b.rotation += (b.vx / b.radius) * dt;

          if (b.state === 'rolling') {
            // Check current girder
            const currentGirder = GIRDERS[b.girderIndex];
            if (currentGirder) {
              b.x += b.vx * dt;
              b.y = getGirderY(currentGirder, b.x) - b.radius;

              // Check if barrel is over a ladder and might drop down it
              for (const l of LADDERS) {
                if (
                  !l.isBroken &&
                  Math.abs(b.x - l.x) < 8 &&
                  Math.abs(b.y - (l.yTop - b.radius)) < 10
                ) {
                  // 25% random chance to take ladder down
                  if (Math.random() < 0.02) {
                    b.state = 'dropping_ladder';
                    b.x = l.x;
                    b.vy = 120;
                    break;
                  }
                }
              }

              // Check if barrel rolled off edge of girder
              if (b.vx > 0 && b.x > currentGirder.x2) {
                b.state = 'falling';
                b.vy = 60;
              } else if (b.vx < 0 && b.x < currentGirder.x1) {
                b.state = 'falling';
                b.vy = 60;
              }
            }
          } else if (b.state === 'dropping_ladder') {
            b.y += b.vy * dt;
            // Check if landed on the girder below
            const nextGirderIndex = Math.max(0, b.girderIndex - 1);
            const nextGirder = GIRDERS[nextGirderIndex];
            if (nextGirder && b.y >= getGirderY(nextGirder, b.x) - b.radius) {
              b.girderIndex = nextGirderIndex;
              b.state = 'rolling';
              // Reverse direction on alternate girders
              b.vx = nextGirderIndex % 2 === 1 ? 90 + s.level * 8 : -(90 + s.level * 8);
            }
          } else if (b.state === 'falling') {
            b.vy += gravity * dt * 0.8;
            b.y += b.vy * dt;

            // Find next girder down
            const nextGirderIndex = Math.max(0, b.girderIndex - 1);
            const nextGirder = GIRDERS[nextGirderIndex];
            if (nextGirder) {
              const targetY = getGirderY(nextGirder, b.x) - b.radius;
              if (b.y >= targetY) {
                b.y = targetY;
                b.girderIndex = nextGirderIndex;
                b.state = 'rolling';
                b.vy = 0;
                // Alternate roll direction
                b.vx = nextGirderIndex % 2 === 1 ? 90 + s.level * 8 : -(90 + s.level * 8);
                retroAudio.dkBarrelRoll();
              }
            }
          }

          // Check if barrel reached the Oil Drum at bottom left (Girder 0)
          if (b.girderIndex === 0 && b.x <= s.oilDrum.x + 12) {
            // Lit the oil drum!
            s.oilDrum.isLit = true;
            // Spawn fireball enemy from drum
            if (s.fireballs.length < 3 + s.level) {
              s.fireballs.push({
                id: Date.now() + Math.random(),
                x: s.oilDrum.x + 10,
                y: s.oilDrum.y,
                vx: 45 + Math.random() * 25,
                vy: 0,
                girderIndex: 0,
                state: 'walking',
                ladderId: null,
                targetY: 0,
                animTimer: Math.random() * 10,
              });
            }
            // Remove barrel
            s.barrels.splice(i, 1);
            continue;
          }

          // Remove barrels that fell off screen
          if (b.y > GAME_HEIGHT) {
            s.barrels.splice(i, 1);
            continue;
          }

          // Collision: Jumpman vs Barrel
          const distJumpman = Math.hypot(p.x - b.x, p.y - 14 - b.y);

          // If Jumpman is swinging hammer, smash the barrel!
          if (p.hammerTimer > 0 && distJumpman < 34) {
            retroAudio.dkSmash();
            s.barrels.splice(i, 1);
            const pts = 300;
            s.score += pts;
            setScore(s.score);
            s.scorePopups.push({
              x: b.x,
              y: b.y - 12,
              text: `+${pts}`,
              color: '#38bdf8',
              opacity: 1,
            });
            continue;
          }

          // Jump Scoring: If Jumpman is jumping over the barrel
          if (
            !b.scoredJump &&
            p.state === 'jumping' &&
            Math.abs(p.x - b.x) < 20 &&
            p.y < b.y - 10 &&
            p.y > b.y - 45
          ) {
            b.scoredJump = true;
            s.score += 100;
            setScore(s.score);
            retroAudio.buttonClick();
            s.scorePopups.push({
              x: b.x,
              y: b.y - 16,
              text: '+100',
              color: '#fde047',
              opacity: 1,
            });
          }

          // Lethal contact with Jumpman
          if (p.hammerTimer <= 0 && distJumpman < 18) {
            s.state = 'dying';
            s.deathTimer = 2.0;
            p.state = 'dead';
            retroAudio.dkDeath();
            break;
          }
        }

        // 5. Update Fireball Enemies
        for (let i = s.fireballs.length - 1; i >= 0; i--) {
          const f = s.fireballs[i];
          f.animTimer += dt;

          const currentGirder = GIRDERS[f.girderIndex];
          if (currentGirder) {
            f.x += f.vx * dt;
            f.y = getGirderY(currentGirder, f.x);

            // Rebound at edges
            if (f.x < currentGirder.x1 + 10) {
              f.x = currentGirder.x1 + 10;
              f.vx = Math.abs(f.vx);
            } else if (f.x > currentGirder.x2 - 10) {
              f.x = currentGirder.x2 - 10;
              f.vx = -Math.abs(f.vx);
            }

            // Occasional direction change
            if (Math.random() < 0.005) {
              f.vx *= -1;
            }
          }

          // Collision with Jumpman
          const distFire = Math.hypot(p.x - f.x, p.y - 14 - f.y);

          // Hammer smash fireball
          if (p.hammerTimer > 0 && distFire < 34) {
            retroAudio.dkSmash();
            s.fireballs.splice(i, 1);
            const pts = 500;
            s.score += pts;
            setScore(s.score);
            s.scorePopups.push({
              x: f.x,
              y: f.y - 12,
              text: `+${pts}`,
              color: '#f97316',
              opacity: 1,
            });
            continue;
          }

          // Lethal contact
          if (p.hammerTimer <= 0 && distFire < 18) {
            s.state = 'dying';
            s.deathTimer = 2.0;
            p.state = 'dead';
            retroAudio.dkDeath();
            break;
          }
        }

        // 6. Update Score Popups
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
            resetJumpman(true);
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

      // Handle Level Clear State
      else if (s.state === 'level_clear') {
        s.clearTimer -= dt;
        if (s.clearTimer <= 0) {
          s.level++;
          setLevel(s.level);
          s.bonusTimer = 5000 + s.level * 500;
          setBonusTimer(s.bonusTimer);
          resetJumpman(true);
          s.state = 'playing';
          setGameState('playing');
        }
      }

      // -------------------------------------------------------------
      // RENDER GAME CANVAS
      // -------------------------------------------------------------
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Deep Black Arcade CRT Background
      ctx.fillStyle = '#020408';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // 1. Draw Girders
      GIRDERS.forEach(g => {
        if (g.id === 5) {
          // Top girder: flat DK portion + slanted section
          drawGirder(ctx, 30, 156, 200, 156);
          drawGirder(ctx, 200, 156, 440, 172);
        } else {
          drawGirder(ctx, g.x1, g.y1, g.x2, g.y2);
        }
      });

      // 2. Draw Ladders
      LADDERS.forEach(l => {
        drawLadder(ctx, l.x, l.yTop, l.yBottom, l.isBroken, l.brokenYStart, l.brokenYEnd);
      });

      // 3. Draw Barrel Stack next to Donkey Kong (arcade details)
      drawSingleBarrel(ctx, 55, 126, 12, 0, false);
      drawSingleBarrel(ctx, 75, 126, 12, 0, false);
      drawSingleBarrel(ctx, 65, 104, 12, 0, false);

      // 4. Draw Oil Drum
      drawOilDrum(ctx, s.oilDrum, s.animTimer);

      // 5. Draw Hammers
      s.hammers.forEach(h => {
        drawHammerItem(ctx, h, s.animTimer);
      });

      // 6. Draw Pauline
      drawPauline(ctx, s.pauline, s.animTimer);

      // 7. Draw Donkey Kong
      drawDonkeyKong(ctx, s.kong, s.animTimer);

      // 8. Draw Barrels
      s.barrels.forEach(b => {
        drawBarrel(ctx, b);
      });

      // 9. Draw Fireball Enemies
      s.fireballs.forEach(f => {
        drawFireball(ctx, f, s.animTimer);
      });

      // 10. Draw Jumpman
      drawJumpman(ctx, s.jumpman, s.animTimer);

      // 11. Level Clear Heart Animation
      if (s.state === 'level_clear') {
        ctx.fillStyle = '#ec4899';
        ctx.font = '24px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('♥', 200, 70);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px "Press Start 2P", monospace';
        ctx.fillText('STAGE CLEAR!', GAME_WIDTH / 2, 280);
      }

      // 12. Score Popups
      s.scorePopups.forEach(pop => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.opacity);
        ctx.fillStyle = pop.color;
        ctx.font = 'bold 10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pop.text, pop.x, pop.y);
        ctx.restore();
      });

      // 13. Top Arcade Scoreboard HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "Press Start 2P", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`1UP`, 30, 24);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(s.score.toString().padStart(6, '0'), 30, 38);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`BONUS`, GAME_WIDTH / 2, 24);
      ctx.fillStyle = s.bonusTimer < 1000 ? '#ef4444' : '#f59e0b';
      ctx.fillText(s.bonusTimer.toString().padStart(4, '0'), GAME_WIDTH / 2, 38);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(`L=${s.level}`, GAME_WIDTH - 30, 24);

      // Jumpman Lives Icons
      for (let l = 0; l < s.lives; l++) {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(GAME_WIDTH - 35 - l * 18, 30, 10, 10);
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(GAME_WIDTH - 35 - l * 18, 36, 10, 4);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [resetJumpman]);

  return (
    <div className="relative flex flex-col h-full w-full select-none overflow-hidden bg-[#030508]">
      {/* Top HUD Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-1.5 bg-[#060911] border-b border-rose-900/40 text-xs font-arcade tracking-wider z-20 flex-none">
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] text-gray-500">1UP SCORE</span>
            <span className="text-rose-300 font-bold text-sm tracking-widest">
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
            <span className="text-[9px] text-gray-500">BONUS</span>
            <span className={`font-bold text-sm ${bonusTimer < 1000 ? 'text-red-400' : 'text-amber-400'}`}>
              {bonusTimer.toString().padStart(4, '0')}
            </span>
          </div>

          <div className="hidden sm:flex flex-col">
            <span className="text-[9px] text-gray-500">LEVEL</span>
            <span className="text-cyan-400 font-bold text-sm">#{level}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Lives Counter */}
          <div className="flex items-center gap-1 mr-1 sm:mr-2">
            {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
              <div key={i} className="w-3.5 h-3.5 bg-rose-600 border border-blue-500 rounded-xs"></div>
            ))}
          </div>

          <button
            onClick={() => setShowScoresModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-rose-950/60 border border-rose-500/50 hover:bg-rose-900/60 text-rose-300 text-[9px] font-arcade cursor-pointer"
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
              className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/50 text-[10px] text-rose-300 cursor-pointer"
            >
              CABINET ROW
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center p-1 sm:p-2">
        <div className="relative h-full max-h-full aspect-[480/560] rounded-lg overflow-hidden border border-gray-800 bg-black shadow-[0_0_25px_rgba(244,63,94,0.3)]">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="w-full h-full object-contain block image-rendering-pixelated"
          />

          {/* Start Screen Overlay */}
          {gameState === 'start' && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="text-rose-500 text-2xl sm:text-3xl font-arcade font-bold tracking-widest crt-glow mb-2 animate-pulse">
                DONKEY KONG
              </div>
              <div className="text-[10px] font-mono text-gray-400 mb-6 tracking-wide">
                © 1981 NINTENDO OF AMERICA INC.
              </div>

              <div className="max-w-xs text-xs text-gray-300 font-sans leading-relaxed mb-6 space-y-2 bg-[#090d16] p-4 rounded-lg border border-rose-500/30">
                <p>
                  Rescue Pauline from Donkey Kong atop the 25m scaffold!
                </p>
                <p className="text-[10px] text-yellow-300 font-mono">
                  • Leap over rolling barrels (+100 PTS)<br />
                  • Grab the sledgehammer to smash obstacles (+300 PTS)<br />
                  • Climb ladders to reach Pauline before bonus time runs out!
                </p>
              </div>

              {credits > 0 ? (
                <button
                  onClick={handleStartGame}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-arcade text-xs tracking-wider shadow-[0_0_20px_rgba(244,63,94,0.6)] cursor-pointer active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
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
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-arcade text-xs tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.5)] cursor-pointer active:scale-95 transition-all"
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
            className="rounded bg-gray-800/80 active:bg-rose-600 text-white text-xs font-arcade flex items-center justify-center border border-gray-700"
          >
            ▲
          </button>
          <div></div>
          <button
            onTouchStart={() => (controlsRef.current.left = true)}
            onTouchEnd={() => (controlsRef.current.left = false)}
            className="rounded bg-gray-800/80 active:bg-rose-600 text-white text-xs font-arcade flex items-center justify-center border border-gray-700"
          >
            ◀
          </button>
          <div></div>
          <button
            onTouchStart={() => (controlsRef.current.right = true)}
            onTouchEnd={() => (controlsRef.current.right = false)}
            className="rounded bg-gray-800/80 active:bg-rose-600 text-white text-xs font-arcade flex items-center justify-center border border-gray-700"
          >
            ▶
          </button>
          <div></div>
          <button
            onTouchStart={() => (controlsRef.current.down = true)}
            onTouchEnd={() => (controlsRef.current.down = false)}
            className="rounded bg-gray-800/80 active:bg-rose-600 text-white text-xs font-arcade flex items-center justify-center border border-gray-700"
          >
            ▼
          </button>
          <div></div>
        </div>

        {/* Action Button: JUMP */}
        <div className="flex items-center gap-3">
          <button
            onTouchStart={() => {
              controlsRef.current.fire = true;
              if (navigator.vibrate) navigator.vibrate(20);
            }}
            onTouchEnd={() => (controlsRef.current.fire = false)}
            className="w-16 h-16 rounded-full bg-rose-600/90 active:bg-rose-400 text-white font-arcade text-xs flex flex-col items-center justify-center border-2 border-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.6)] cursor-pointer"
          >
            <span>JUMP</span>
          </button>
        </div>
      </div>

      {/* Top 5 High Scores Modal */}
      {showScoresModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b0f19] border-2 border-rose-500 rounded-xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(244,63,94,0.4)]">
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="text-sm font-arcade text-rose-300">
                  DONKEY KONG HALL OF FAME
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
                    <span className="text-rose-400 font-bold">{entry.initials}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-gray-400 font-mono">LVL {entry.level}</span>
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
                    className="w-24 text-center px-2 py-1 bg-black border border-rose-400 rounded text-rose-300 font-arcade text-lg tracking-widest outline-none"
                  />
                  <button
                    onClick={handleSaveScore}
                    className="px-4 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-arcade text-xs cursor-pointer"
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
