import { useState, useCallback } from 'react';
import { useWindowManager } from '../context/WindowManagerContext';
import { useClock } from '../hooks/useClock';
import { apps } from '../data/apps';
import ContextMenu from './ContextMenu';
import StartMenu from './StartMenu';

export default function Taskbar({ onShutdown }) {
  const { state, toggle, close } = useWindowManager();
  const time = useClock();
  const [startOpen, setStartOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);

  const openWindows = Object.entries(state.windows)
    .filter(([, w]) => w.open)
    .sort(([, a], [, b]) => a.zIndex - b.zIndex);

  const handleContext = useCallback((e, id) => {
    e.preventDefault();
    setCtxMenu({ id, x: e.clientX, y: e.clientY });
  }, []);

  return (
    <>
      <div className="taskbar">
        <button
          className={`start-button ${startOpen ? 'is-active' : ''}`}
          onClick={() => setStartOpen(v => !v)}
        >
          <span className="visually-hidden">Start</span>
        </button>

        <div className="task-buttons">
          {openWindows.map(([id, win]) => {
            const app = apps.find(a => a.id === id);
            const isActive = state.activeId === id && !win.minimized;
            return (
              <button
                key={id}
                className={`button task-btn ${isActive ? 'active' : ''}`}
                title={app?.title || id}
                onClick={() => toggle(id)}
                onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); close(id); } }}
                onContextMenu={(e) => handleContext(e, id)}
              >
                {app?.icon && <img src={app.icon} width="16" height="16" alt="" />}
                <span className="task-text"> {app?.title || id}</span>
              </button>
            );
          })}
        </div>

        <div className="tray">
          <img src="assets/0037 - Network Computer.ico" width="16" height="16" alt="Network" />
          <img src="assets/0173 - Volume.ico" width="16" height="16" alt="Volume" />
          <time className="clock">{time}</time>
        </div>
      </div>

      <StartMenu isOpen={startOpen} onClose={() => setStartOpen(false)} onShutdown={onShutdown} />

      {ctxMenu && (
        <ContextMenu
          appId={ctxMenu.id}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}
