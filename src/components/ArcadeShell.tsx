import React, { useState, useEffect, useCallback, useRef } from 'react';
import { retroAudio } from '../audio/retroAudio';
import { useArcadeInput } from '../input/useArcadeInput';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { AsteroidsGame } from '../games/asteroids/AsteroidsGame';
import { BattlezoneGame } from '../games/battlezone/BattlezoneGame';
import { MissileCommandGame } from '../games/missilecommand/MissileCommandGame';
import { SpaceInvadersGame } from '../games/spaceinvaders/SpaceInvadersGame';
import { PacmanGame } from '../games/pacman/PacmanGame';
import { DonkeyKongGame } from '../games/donkeykong/DonkeyKongGame';
import { CentipedeGame } from '../games/centipede/CentipedeGame';
import { ColorTheme } from '../games/asteroids/types';
import {
  Coins,
  Trophy,
  Volume2,
  VolumeX,
  Tv,
  Gamepad2,
  Sparkles,
  Info,
  CircleDot,
  Radio,
  Flame,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export interface CabinetDefinition {
  id: string;
  title: string;
  year: number;
  developer: string;
  genre: string;
  status: 'playable' | 'upcoming';
  description: string;
  bannerGradient: string;
  accentColor: string;
  tagline: string;
}

const CABINETS: CabinetDefinition[] = [
  {
    id: 'asteroids',
    title: 'ASTEROIDS',
    year: 1979,
    developer: 'ATARI INC.',
    genre: 'Vector Space Combat',
    status: 'playable',
    description: 'Pilot your triangle ship through a deadly field of splitting space boulders and hostile alien saucers. Featuring pure vector physics, inertia, and hyperspace escape.',
    bannerGradient: 'from-cyan-900 via-blue-950 to-black',
    accentColor: '#38bdf8',
    tagline: 'FEATURING QUADRA-SCAN VECTOR GENERATOR',
  },
  {
    id: 'battlezone',
    title: 'BATTLEZONE',
    year: 1980,
    developer: 'ATARI INC.',
    genre: 'First-Person 3D Vector Tank',
    status: 'playable',
    description: 'Peer through the tank periscope into a wireframe volcanic wasteland. Track enemy super-tanks and flying saucers on your green radar scope.',
    bannerGradient: 'from-emerald-950 via-green-900 to-black',
    accentColor: '#22c55e',
    tagline: 'THE ORIGINAL 3D WIREFRAME SIMULATION',
  },
  {
    id: 'missile-command',
    title: 'MISSILE COMMAND',
    year: 1980,
    developer: 'ATARI INC.',
    genre: 'Trajectory ICBM Defense',
    status: 'playable',
    description: 'Defend your six cities from raining nuclear ballistic streaks with three antiballistic missile batteries. Time your shockwave detonations precisely.',
    bannerGradient: 'from-amber-950 via-orange-950 to-black',
    accentColor: '#f59e0b',
    tagline: 'THE DEFENSE OF HUMANITY IS IN YOUR HANDS',
  },
  {
    id: 'space-invaders',
    title: 'SPACE INVADERS',
    year: 1978,
    developer: 'TAITO',
    genre: 'Fixed Grid Shooter',
    status: 'playable',
    description: 'Stop the descending 5x11 armada of alien invaders. Destructible defense bunkers erode with every laser impact as the march tempo accelerates.',
    bannerGradient: 'from-fuchsia-950 via-purple-950 to-black',
    accentColor: '#d946ef',
    tagline: 'THE PHENOMENON THAT STARTED THE GOLDEN AGE',
  },
  {
    id: 'centipede',
    title: 'CENTIPEDE',
    year: 1980,
    developer: 'ATARI INC.',
    genre: 'Grid Trackball Shooter',
    status: 'playable',
    description: 'Defend your garden from the segmented centipede winding down through the mushroom patch. Watch out for dropping fleas and scurrying spiders!',
    bannerGradient: 'from-teal-950 via-emerald-950 to-black',
    accentColor: '#14b8a6',
    tagline: 'FAST-PACED BUG BLASTER ACTION',
  },
  {
    id: 'pacman',
    title: 'PAC-MAN',
    year: 1980,
    developer: 'NAMCO',
    genre: 'Maze Chase',
    status: 'playable',
    description: 'Navigate the labyrinth, devour glowing pellets, and evade the iconic ghost squad: Blinky, Pinky, Inky, and Clyde. Grab the power pellet to turn the tables.',
    bannerGradient: 'from-yellow-950 via-amber-900 to-black',
    accentColor: '#eab308',
    tagline: 'THE MOST CELEBRATED MAZE GAME IN HISTORY',
  },
  {
    id: 'donkey-kong',
    title: 'DONKEY KONG',
    year: 1981,
    developer: 'NINTENDO',
    genre: 'Platformer',
    status: 'playable',
    description: 'Scale the construction scaffolds, hop over rolling timber barrels, and climb ladders to rescue Pauline from the giant ape at the summit.',
    bannerGradient: 'from-rose-950 via-red-950 to-black',
    accentColor: '#f43f5e',
    tagline: 'HOW HIGH CAN YOU GET?',
  },
];

export const ArcadeShell: React.FC = () => {
  // Game selection & credits
  const [selectedCabinetId, setSelectedCabinetId] = useState<string>('asteroids');
  const [activeGame, setActiveGame] = useState<string | null>('asteroids'); // Launch Asteroids right away!
  const [credits, setCredits] = useState<number>(4);
  const [isMuted, setIsMuted] = useState<boolean>(() => retroAudio.getMuted());
  const [showHighScores, setShowHighScores] = useState<boolean>(false);

  // CRT & Visual customization (Scanlines removed as requested)
  const scanlines = false;
  const [colorTheme] = useState<ColorTheme>('cyan');

  // Coin insertion handler with sound
  const handleInsertCoin = useCallback(() => {
    retroAudio.insertCoin();
    setCredits(prev => Math.min(prev + 1, 99));
  }, []);

  // Keep track of current credits synchronously
  const creditsRef = useRef(credits);
  creditsRef.current = credits;

  const handleUseCredit = useCallback(() => {
    if (creditsRef.current > 0) {
      setCredits(prev => Math.max(0, prev - 1));
      creditsRef.current = Math.max(0, creditsRef.current - 1);
      return true;
    }
    return false;
  }, []);

  // Input manager
  const { controlsRef, hasGamepad, gamepadName } = useArcadeInput(
    handleInsertCoin
  );

  const currentCabinet = CABINETS.find(c => c.id === selectedCabinetId) || CABINETS[0];

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#030508] text-white">
      {/* Offline status banner */}
      <OfflineIndicator />

      {/* Retro Backlit Arcade Marquee Header */}
      <header className="relative flex-none bg-[#070b14] border-b-2 border-cyan-500/50 px-2 sm:px-4 py-1.5 shadow-[0_2px_15px_rgba(6,182,212,0.25)] z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Brand Logo & Marquee Glow */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 shadow-[0_0_12px_rgba(6,182,212,0.8)] border border-cyan-300">
              <span className="font-arcade text-xs font-black text-black">8X</span>
            </div>
            <div>
              <span className="text-[11px] sm:text-xs font-arcade tracking-wider text-cyan-300 crt-glow">
                RETRO ARCADE 198X
              </span>
            </div>
          </div>

          {/* Quick Cabinet Selector Tabs - Always visible & scrollable */}
          <div className="flex items-center gap-1 bg-black/70 p-1 rounded-lg border border-gray-800 overflow-x-auto max-w-[48vw] md:max-w-none scrollbar-none flex-shrink">
            <button
              onClick={() => {
                setActiveGame(null);
                retroAudio.buttonClick();
              }}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-arcade transition-all cursor-pointer whitespace-nowrap ${
                activeGame === null
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => {
                setActiveGame('asteroids');
                retroAudio.buttonClick();
              }}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-arcade transition-all cursor-pointer whitespace-nowrap ${
                activeGame === 'asteroids'
                  ? 'bg-cyan-950 border border-cyan-400/80 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                  : 'text-gray-400 hover:text-cyan-300'
              }`}
            >
              ASTEROIDS
            </button>
            <button
              onClick={() => {
                setActiveGame('battlezone');
                retroAudio.buttonClick();
              }}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-arcade transition-all cursor-pointer whitespace-nowrap ${
                activeGame === 'battlezone'
                  ? 'bg-emerald-950 border border-emerald-400/80 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                  : 'text-gray-400 hover:text-emerald-300'
              }`}
            >
              BATTLEZONE
            </button>
            <button
              onClick={() => {
                setActiveGame('missile-command');
                retroAudio.buttonClick();
              }}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-arcade transition-all cursor-pointer whitespace-nowrap ${
                activeGame === 'missile-command'
                  ? 'bg-amber-950 border border-amber-400/80 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  : 'text-gray-400 hover:text-amber-300'
              }`}
            >
              MISSILE CMD
            </button>
            <button
              onClick={() => {
                setActiveGame('space-invaders');
                retroAudio.buttonClick();
              }}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-arcade transition-all cursor-pointer whitespace-nowrap ${
                activeGame === 'space-invaders'
                  ? 'bg-fuchsia-950 border border-fuchsia-400/80 text-fuchsia-300 shadow-[0_0_8px_rgba(217,70,239,0.4)]'
                  : 'text-gray-400 hover:text-fuchsia-300'
              }`}
            >
              INVADERS
            </button>
            <button
              onClick={() => {
                setActiveGame('pacman');
                retroAudio.buttonClick();
              }}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-arcade transition-all cursor-pointer whitespace-nowrap ${
                activeGame === 'pacman'
                  ? 'bg-yellow-950 border border-yellow-400/80 text-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.4)]'
                  : 'text-gray-400 hover:text-yellow-300'
              }`}
            >
              PAC-MAN
            </button>
            <button
              onClick={() => {
                setActiveGame('centipede');
                retroAudio.buttonClick();
              }}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-arcade transition-all cursor-pointer whitespace-nowrap ${
                activeGame === 'centipede'
                  ? 'bg-teal-950 border border-teal-400/80 text-teal-300 shadow-[0_0_8px_rgba(20,184,166,0.4)]'
                  : 'text-gray-400 hover:text-teal-300'
              }`}
            >
              CENTIPEDE
            </button>
            <button
              onClick={() => {
                setActiveGame('donkey-kong');
                retroAudio.buttonClick();
              }}
              className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-arcade transition-all cursor-pointer whitespace-nowrap ${
                activeGame === 'donkey-kong'
                  ? 'bg-rose-950 border border-rose-400/80 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                  : 'text-gray-400 hover:text-rose-300'
              }`}
            >
              DONKEY KONG
            </button>
          </div>

          {/* Center: Interactive Coin Slot & Credits */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={handleInsertCoin}
              className="group relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e1626] hover:bg-[#131f36] border border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)] hover:shadow-[0_0_18px_rgba(245,158,11,0.6)] active:scale-95 transition-all cursor-pointer"
              title="Insert a quarter (Key: C or 5)"
            >
              <div className="w-2 h-3.5 bg-gray-900 border border-amber-500/60 rounded-xs flex items-center justify-center">
                <div className="w-0.5 h-2 bg-amber-400 animate-pulse"></div>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[8px] sm:text-[9px] font-arcade text-amber-300 group-hover:text-amber-200">
                  25¢ COIN
                </span>
                <span className="text-[7px] sm:text-[8px] font-mono text-amber-500/90 leading-none">
                  CR: <strong className="text-white font-bold">{credits.toString().padStart(2, '0')}</strong>
                </span>
              </div>
            </button>

            {/* PWA Install Button Component */}
            <PWAInstallButton />

            {/* Mute Toggle */}
            <button
              onClick={() => {
                const nextMute = retroAudio.toggleMute();
                setIsMuted(nextMute);
              }}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area: Either Active Game or Cabinet Row */}
      <main className="relative flex-1 w-full overflow-hidden flex flex-col">
        {activeGame === 'asteroids' ? (
          <AsteroidsGame
            controlsRef={controlsRef}
            onBackToArcade={() => setActiveGame(null)}
            credits={credits}
            onUseCredit={handleUseCredit}
            colorTheme={colorTheme}
            scanlines={scanlines}
            hasGamepad={hasGamepad}
          />
        ) : activeGame === 'battlezone' ? (
          <BattlezoneGame
            controlsRef={controlsRef}
            onBackToArcade={() => setActiveGame(null)}
            credits={credits}
            onUseCredit={handleUseCredit}
            scanlines={scanlines}
            hasGamepad={hasGamepad}
          />
        ) : activeGame === 'missile-command' ? (
          <MissileCommandGame
            controlsRef={controlsRef}
            onBackToArcade={() => setActiveGame(null)}
            credits={credits}
            onUseCredit={handleUseCredit}
            scanlines={scanlines}
            hasGamepad={hasGamepad}
          />
        ) : activeGame === 'space-invaders' ? (
          <SpaceInvadersGame
            controlsRef={controlsRef}
            onBackToArcade={() => setActiveGame(null)}
            credits={credits}
            onUseCredit={handleUseCredit}
            scanlines={scanlines}
            hasGamepad={hasGamepad}
          />
        ) : activeGame === 'pacman' ? (
          <PacmanGame
            controlsRef={controlsRef}
            onBackToArcade={() => setActiveGame(null)}
            credits={credits}
            onUseCredit={handleUseCredit}
            scanlines={scanlines}
            hasGamepad={hasGamepad}
          />
        ) : activeGame === 'donkey-kong' ? (
          <DonkeyKongGame
            controlsRef={controlsRef}
            onBackToArcade={() => setActiveGame(null)}
            credits={credits}
            onUseCredit={handleUseCredit}
            scanlines={scanlines}
            hasGamepad={hasGamepad}
          />
        ) : activeGame === 'centipede' ? (
          <CentipedeGame
            controlsRef={controlsRef}
            onBackToArcade={() => setActiveGame(null)}
            credits={credits}
            onUseCredit={handleUseCredit}
            scanlines={scanlines}
            hasGamepad={hasGamepad}
          />
        ) : (
          /* Cabinet Marquee Gallery / Arcade Floor */
          <div className="flex-1 w-full h-full overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-start">
            <div className="max-w-6xl w-full">
              {/* Arcade Row Header */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-arcade text-cyan-300 tracking-wider crt-glow">
                    ARCADE CABINET ROW
                  </h2>
                  <p className="text-xs text-gray-400 font-mono mt-1">
                    SELECT A CLASSIC CABINET TO PLAY OR PREVIEW
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-arcade text-gray-400">CREDITS AVAILABLE:</span>
                  <span className="px-2.5 py-1 rounded bg-amber-950 border border-amber-500 text-amber-300 font-arcade text-xs">
                    {credits.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Cabinet Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {CABINETS.map((cabinet) => {
                  const isPlayable = cabinet.status === 'playable';
                  const isSelected = selectedCabinetId === cabinet.id;

                  return (
                    <div
                      key={cabinet.id}
                      onClick={() => {
                        setSelectedCabinetId(cabinet.id);
                        retroAudio.buttonClick();
                      }}
                      className={`relative flex flex-col rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.4)] scale-[1.02]'
                          : 'border-gray-800/90 hover:border-gray-700 bg-[#080c16]'
                      }`}
                    >
                      {/* Marquee Backlit Header */}
                      <div className={`p-4 bg-gradient-to-r ${cabinet.bannerGradient} border-b border-gray-800 relative overflow-hidden`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-arcade text-gray-400">
                            {cabinet.developer} • {cabinet.year}
                          </span>
                          {isPlayable ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-400 text-[8px] font-arcade text-emerald-300 animate-pulse">
                              PLAYABLE NOW
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-gray-900 border border-gray-700 text-[8px] font-arcade text-gray-400">
                              NEXT IN QUEUE
                            </span>
                          )}
                        </div>

                        <h3 className="text-xl font-arcade font-bold tracking-wider text-white crt-glow mb-1">
                          {cabinet.title}
                        </h3>
                        <p className="text-[10px] font-mono text-cyan-300/80">
                          {cabinet.tagline}
                        </p>
                      </div>

                      {/* Cabinet Body & Specs */}
                      <div className="p-4 flex-1 flex flex-col justify-between bg-[#060911]">
                        <p className="text-xs text-gray-300 font-sans leading-relaxed mb-4">
                          {cabinet.description}
                        </p>

                        <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-gray-500">
                            GENRE: <strong className="text-gray-300">{cabinet.genre}</strong>
                          </span>

                          {isPlayable ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveGame(cabinet.id);
                                retroAudio.buttonClick();
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-arcade text-[10px] font-bold tracking-wider transition-all shadow-[0_0_12px_rgba(6,182,212,0.5)] cursor-pointer"
                            >
                              <span>PLAY</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[9px] font-arcade text-gray-500">
                              IN PRODUCTION
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
