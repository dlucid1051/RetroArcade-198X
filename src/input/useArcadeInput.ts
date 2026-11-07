import { useEffect, useRef, useState, useCallback } from 'react';

export interface ArcadeControlsState {
  rotateLeft: boolean;
  rotateRight: boolean;
  thrust: boolean;
  fire: boolean;
  hyperspace: boolean;
  pause: boolean;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export function useArcadeInput(onCoinInsert?: () => void, onTogglePause?: () => void) {
  const controlsRef = useRef<ArcadeControlsState>({
    rotateLeft: false,
    rotateRight: false,
    thrust: false,
    fire: false,
    hyperspace: false,
    pause: false,
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const onCoinInsertRef = useRef(onCoinInsert);
  const onTogglePauseRef = useRef(onTogglePause);

  useEffect(() => {
    onCoinInsertRef.current = onCoinInsert;
    onTogglePauseRef.current = onTogglePause;
  }, [onCoinInsert, onTogglePause]);

  const [hasGamepad, setHasGamepad] = useState(false);
  const [gamepadName, setGamepadName] = useState<string>('');
  const lastGamepadButtons = useRef<{ [btn: number]: boolean }>({});

  // Keyboard handlers (mounted once)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling when using arrow keys / space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          controlsRef.current.rotateLeft = true;
          controlsRef.current.left = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          controlsRef.current.rotateRight = true;
          controlsRef.current.right = true;
          break;
        case 'ArrowUp':
        case 'KeyW':
          controlsRef.current.thrust = true;
          controlsRef.current.up = true;
          break;
        case 'Space':
        case 'KeyJ':
          controlsRef.current.fire = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyK':
          controlsRef.current.hyperspace = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          controlsRef.current.hyperspace = true;
          controlsRef.current.down = true;
          break;
        case 'KeyP':
        case 'Escape':
          onTogglePauseRef.current?.();
          break;
        case 'KeyC':
        case 'Digit5':
          onCoinInsertRef.current?.();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          controlsRef.current.rotateLeft = false;
          controlsRef.current.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          controlsRef.current.rotateRight = false;
          controlsRef.current.right = false;
          break;
        case 'ArrowUp':
        case 'KeyW':
          controlsRef.current.thrust = false;
          controlsRef.current.up = false;
          break;
        case 'Space':
        case 'KeyJ':
          controlsRef.current.fire = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyK':
          controlsRef.current.hyperspace = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          controlsRef.current.hyperspace = false;
          controlsRef.current.down = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Gamepad API polling loop (mounted once)
  useEffect(() => {
    let animationFrameId: number;

    const onGamepadConnected = (e: GamepadEvent) => {
      setHasGamepad(true);
      setGamepadName(e.gamepad.id || 'Arcade Controller');
    };

    const onGamepadDisconnected = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const anyPad = Array.from(pads).some(p => p !== null && p.connected);
      setHasGamepad(anyPad);
      if (!anyPad) setGamepadName('');
    };

    window.addEventListener('gamepadconnected', onGamepadConnected);
    window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

    const pollGamepads = () => {
      if (typeof navigator.getGamepads === 'function') {
        const gamepads = navigator.getGamepads();
        const pad = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];

        if (pad && pad.connected) {
          // D-Pad and Left Stick
          const axisX = pad.axes[0] ?? 0;
          const axisY = pad.axes[1] ?? 0;
          const dpadLeft = pad.buttons[14]?.pressed ?? false;
          const dpadRight = pad.buttons[15]?.pressed ?? false;
          const dpadUp = pad.buttons[12]?.pressed ?? false;

          // Rotate / Left-Right
          controlsRef.current.rotateLeft = axisX < -0.3 || dpadLeft;
          controlsRef.current.rotateRight = axisX > 0.3 || dpadRight;
          controlsRef.current.left = controlsRef.current.rotateLeft;
          controlsRef.current.right = controlsRef.current.rotateRight;

          // Thrust / Up (Up or Right Trigger or Button A/B)
          const rtPressed = (pad.buttons[7]?.value ?? 0) > 0.2;
          const r1Pressed = pad.buttons[5]?.pressed ?? false;
          controlsRef.current.thrust = axisY < -0.3 || dpadUp || rtPressed || r1Pressed;
          controlsRef.current.up = controlsRef.current.thrust;

          // Fire (Button 0 = A / Cross, Button 2 = X / Square)
          controlsRef.current.fire = (pad.buttons[0]?.pressed || pad.buttons[2]?.pressed) ?? false;

          // Hyperspace / Down (Button 1 = B / Circle, Button 3 = Y / Triangle, or D-pad Down / Stick Down)
          const dpadDown = pad.buttons[13]?.pressed ?? false;
          controlsRef.current.hyperspace = (pad.buttons[1]?.pressed || pad.buttons[3]?.pressed) ?? false;
          controlsRef.current.down = controlsRef.current.hyperspace || axisY > 0.3 || dpadDown;

          // Start button (Button 9) -> Pause toggle
          if (pad.buttons[9]?.pressed && !lastGamepadButtons.current[9]) {
            onTogglePauseRef.current?.();
          }
          lastGamepadButtons.current[9] = pad.buttons[9]?.pressed ?? false;

          // Back / Select button (Button 8) -> Insert coin
          if (pad.buttons[8]?.pressed && !lastGamepadButtons.current[8]) {
            onCoinInsertRef.current?.();
          }
          lastGamepadButtons.current[8] = pad.buttons[8]?.pressed ?? false;
        }
      }

      animationFrameId = requestAnimationFrame(pollGamepads);
    };

    animationFrameId = requestAnimationFrame(pollGamepads);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
    };
  }, []);

  // Virtual touch controls helpers
  const setTouchControl = useCallback((control: keyof ArcadeControlsState, value: boolean) => {
    controlsRef.current[control] = value;
    if (value && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    controlsRef,
    hasGamepad,
    gamepadName,
    setTouchControl,
  };
}
