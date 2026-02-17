import { useRef, useEffect } from 'react';
import { useWindowManager } from '../context/WindowManagerContext';

export default function DoomApp({ appId }) {
  const { state } = useWindowManager();
  const containerRef = useRef(null);
  const ciRef = useRef(null);
  const initRef = useRef(false);

  const win = state.windows[appId];

  // Mount emulator
  useEffect(() => {
    if (initRef.current) return;
    if (!containerRef.current) return;
    if (typeof window.Dos === 'undefined') {
      console.warn('[DoomApp] js-dos not loaded yet');
      return;
    }

    initRef.current = true;

    window.Dos(containerRef.current, {
      url: 'assets/games/doom/doom.jsdos',
      pathPrefix: 'emu/emulators/',
      autoStart: true,
      onEvent: (ev, ci) => {
        if (ev === 'ci-ready') ciRef.current = ci;
      },
    });

    return () => {
      ciRef.current?.exit?.();
    };
  }, []);

  // Pause/resume on minimize/restore
  useEffect(() => {
    if (!ciRef.current) return;
    if (win?.minimized) {
      ciRef.current.pause?.();
    } else {
      ciRef.current.resume?.();
    }
  }, [win?.minimized]);

  return (
    <div className="window-body">
      <div className="emu-frame" style={{ background: '#000', border: '1px solid #bfcde0', borderRadius: '6px', overflow: 'hidden' }}>
        <div className="doom-container" ref={containerRef} />
      </div>
      <div className="status-bar">
        <p className="status-bar-field">Click window to capture keyboard • ESC to release</p>
        <p className="status-bar-field">Shareware episode (DOOM1.WAD)</p>
      </div>
    </div>
  );
}
