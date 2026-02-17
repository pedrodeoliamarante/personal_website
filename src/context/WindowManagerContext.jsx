import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';

const WindowManagerContext = createContext(null);

// ---- localStorage helpers ----
const LS = {
  window: (id) => `wm:window:${id}`,
  openSet: 'wm:openSet',
  active: 'wm:active',
  zCounter: 'wm:zCounter',
};

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ---- initial state from localStorage ----
function buildInitialState() {
  const openSet = lsGet(LS.openSet, []);
  const activeId = lsGet(LS.active, null);
  const zCounter = parseInt(localStorage.getItem(LS.zCounter) || '100', 10) || 100;

  const windows = {};
  for (const id of openSet) {
    const saved = lsGet(LS.window(id), null);
    windows[id] = {
      open: true,
      minimized: false,
      maximized: saved?.maximized ? true : false,
      zIndex: zCounter,
      geometry: {
        top: saved?.top || '',
        left: saved?.left || '',
        width: saved?.width || '',
        height: saved?.height || '',
      },
    };
  }

  return { windows, activeId, zCounter };
}

// ---- reducer ----
function reducer(state, action) {
  switch (action.type) {
    case 'OPEN': {
      const { id, defaultPos } = action;
      const existing = state.windows[id];
      if (existing?.open && !existing.minimized) {
        // Already open and visible — just bring to front
        const zCounter = state.zCounter + 1;
        return {
          ...state,
          zCounter,
          activeId: id,
          windows: {
            ...state.windows,
            [id]: { ...existing, zIndex: zCounter },
          },
        };
      }
      if (existing?.open && existing.minimized) {
        // Restore from minimized
        const zCounter = state.zCounter + 1;
        return {
          ...state,
          zCounter,
          activeId: id,
          windows: {
            ...state.windows,
            [id]: { ...existing, minimized: false, zIndex: zCounter },
          },
        };
      }
      // New window
      const zCounter = state.zCounter + 1;
      const saved = lsGet(LS.window(id), null);
      return {
        ...state,
        zCounter,
        activeId: id,
        windows: {
          ...state.windows,
          [id]: {
            open: true,
            minimized: false,
            maximized: saved?.maximized ? true : false,
            zIndex: zCounter,
            geometry: saved ? {
              top: saved.top || '',
              left: saved.left || '',
              width: saved.width || '',
              height: saved.height || '',
            } : {
              top: defaultPos?.top ? `${defaultPos.top}px` : '100px',
              left: defaultPos?.left ? `${defaultPos.left}px` : '120px',
              width: '',
              height: '',
            },
          },
        },
      };
    }

    case 'CLOSE': {
      const { id } = action;
      const { [id]: _, ...rest } = state.windows;
      const newActiveId = state.activeId === id ? null : state.activeId;
      return { ...state, windows: rest, activeId: newActiveId };
    }

    case 'MINIMIZE': {
      const { id } = action;
      const win = state.windows[id];
      if (!win) return state;
      return {
        ...state,
        activeId: state.activeId === id ? null : state.activeId,
        windows: {
          ...state.windows,
          [id]: { ...win, minimized: true },
        },
      };
    }

    case 'RESTORE': {
      const { id } = action;
      const win = state.windows[id];
      if (!win) return state;
      const zCounter = state.zCounter + 1;
      return {
        ...state,
        zCounter,
        activeId: id,
        windows: {
          ...state.windows,
          [id]: { ...win, minimized: false, zIndex: zCounter },
        },
      };
    }

    case 'FOCUS': {
      const { id } = action;
      const win = state.windows[id];
      if (!win) return state;
      const zCounter = state.zCounter + 1;
      return {
        ...state,
        zCounter,
        activeId: id,
        windows: {
          ...state.windows,
          [id]: { ...win, zIndex: zCounter },
        },
      };
    }

    case 'TOGGLE_MAXIMIZE': {
      const { id } = action;
      const win = state.windows[id];
      if (!win) return state;
      return {
        ...state,
        windows: {
          ...state.windows,
          [id]: { ...win, maximized: !win.maximized },
        },
      };
    }

    case 'UPDATE_GEOMETRY': {
      const { id, geometry } = action;
      const win = state.windows[id];
      if (!win) return state;
      return {
        ...state,
        windows: {
          ...state.windows,
          [id]: { ...win, geometry: { ...win.geometry, ...geometry } },
        },
      };
    }

    default:
      return state;
  }
}

// ---- Provider ----
export function WindowManagerProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---- Persistence ----
  useEffect(() => {
    const s = state;
    // Save open set
    const openIds = Object.entries(s.windows)
      .filter(([, w]) => w.open && !w.minimized)
      .map(([id]) => id);
    lsSet(LS.openSet, openIds);

    // Save active
    localStorage.setItem(LS.active, s.activeId || '');

    // Save zCounter
    localStorage.setItem(LS.zCounter, String(s.zCounter));

    // Save per-window state
    for (const [id, win] of Object.entries(s.windows)) {
      lsSet(LS.window(id), {
        top: win.geometry.top,
        left: win.geometry.left,
        width: win.geometry.width,
        height: win.geometry.height,
        maximized: win.maximized ? 1 : 0,
      });
    }
  }, [state]);

  // ---- Actions ----
  const open = useCallback((id, defaultPos) => {
    dispatch({ type: 'OPEN', id, defaultPos });
  }, []);

  const close = useCallback((id) => {
    // Clean up localStorage for the window
    try { localStorage.removeItem(LS.window(id)); } catch {}
    dispatch({ type: 'CLOSE', id });
  }, []);

  const minimize = useCallback((id) => {
    dispatch({ type: 'MINIMIZE', id });
  }, []);

  const restore = useCallback((id) => {
    dispatch({ type: 'RESTORE', id });
  }, []);

  const toggle = useCallback((id) => {
    const win = stateRef.current.windows[id];
    if (!win || win.minimized) {
      dispatch({ type: 'RESTORE', id });
    } else {
      dispatch({ type: 'MINIMIZE', id });
    }
  }, []);

  const toggleMaximize = useCallback((id) => {
    dispatch({ type: 'TOGGLE_MAXIMIZE', id });
  }, []);

  const focus = useCallback((id) => {
    dispatch({ type: 'FOCUS', id });
  }, []);

  const updateGeometry = useCallback((id, geometry) => {
    dispatch({ type: 'UPDATE_GEOMETRY', id, geometry });
  }, []);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKeydown(e) {
      const target = e.target;
      if (target && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName))) return;

      const s = stateRef.current;

      if (e.key === 'Escape' && s.activeId) {
        minimize(s.activeId);
        return;
      }
      if ((e.key === 'x' || e.key === 'X') && s.activeId) {
        close(s.activeId);
        return;
      }

      // Alt+Tab: cycle windows
      if (e.key === 'Tab' && e.altKey) {
        e.preventDefault();
        const visible = Object.entries(s.windows)
          .filter(([, w]) => w.open && !w.minimized)
          .sort(([, a], [, b]) => a.zIndex - b.zIndex);
        if (visible.length === 0) return;
        const currIdx = visible.findIndex(([id]) => id === s.activeId);
        const nextId = visible[(currIdx + 1) % visible.length][0];
        dispatch({ type: 'FOCUS', id: nextId });
      }
    }

    document.addEventListener('keydown', handleKeydown, { passive: false });
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [minimize, close]);

  // ---- Hash routing ----
  useEffect(() => {
    if (state.activeId) {
      history.replaceState(null, '', '#' + state.activeId);
    } else if (Object.keys(state.windows).length === 0) {
      history.replaceState(null, '', location.pathname);
    }
  }, [state.activeId, state.windows]);

  useEffect(() => {
    function onHashChange() {
      const id = location.hash.replace('#', '');
      if (id) {
        open(id);
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [open]);

  // Open from hash on mount
  useEffect(() => {
    const id = location.hash.replace('#', '');
    if (id) {
      open(id);
    }
  }, [open]);

  const value = {
    state,
    open,
    close,
    minimize,
    restore,
    toggle,
    toggleMaximize,
    focus,
    updateGeometry,
  };

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error('useWindowManager must be used within WindowManagerProvider');
  return ctx;
}
