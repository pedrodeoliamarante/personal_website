/* js/core/windowManager.js
 * Data-driven Window Manager
 * - registerApp({ id, title, icon, template, init, onOpen, onClose })
 * - open(id), close(id), minimize(id), restore(id), toggle(id), toggleMaximize(id)
 * - bringToFront(id)
 * - events: wm:register, wm:open, wm:close, wm:minimize, wm:restore, wm:focus, wm:maximize, wm:state
 * - persistence: top/left/width/height/maximized per window + open set + active id
 * - basic dragging via title bar ('.title-bar'), ignoring '.title-bar-controls'
 */

(function (global) {
  'use strict';

  // --------- tiny event bus ----------
  const listeners = new Map(); // event -> Set<fn>
  function on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
  }
  function off(evt, fn) {
    listeners.get(evt)?.delete(fn);
  }
  function emit(evt, payload) {
    listeners.get(evt)?.forEach(fn => {
      try { fn(payload); } catch (e) { console.error('[WM] listener error', e); }
    });
  }

  // --------- state ----------
  const registry = new Map();   // id -> appDef
  const instances = new Map();  // id -> { el, mounted, state, controls, titleBar }
  let activeId = null;
  let zCounter = 100; // base z-index for windows

  // desktop container (fallback to body)
  const desktop = document.querySelector('.desktop') || document.body;

  // --------- persistence ----------
  const LS_KEYS = {
    window: (id) => `wm:window:${id}`,           // per-window geometry/max state
    openSet: 'wm:openSet',                       // array of open app ids
    active: 'wm:active',                         // currently focused id
    zCounter: 'wm:zCounter'                      // next z
  };

  function saveWindowState(id) {
    const inst = instances.get(id);
    if (!inst) return;
    const rect = {
      top: inst.el.style.top || '',
      left: inst.el.style.left || '',
      width: inst.el.style.width || '',
      height: inst.el.style.height || '',
      maximized: inst.el.dataset.maximized === '1' ? 1 : 0
    };
    try { localStorage.setItem(LS_KEYS.window(id), JSON.stringify(rect)); }
    catch (_) {}
    emit('wm:state', { id, rect });
  }

  function loadWindowState(id) {
    try {
      const raw = localStorage.getItem(LS_KEYS.window(id));
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function saveOpenSet() {
    try {
      const openIds = Array.from(instances.entries())
        .filter(([, inst]) => !inst.el.classList.contains('is-hidden'))
        .map(([id]) => id);
      localStorage.setItem(LS_KEYS.openSet, JSON.stringify(openIds));
    } catch (_) {}
  }

  function loadOpenSet() {
    try {
      const raw = localStorage.getItem(LS_KEYS.openSet);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }

  function saveActive() {
    try { localStorage.setItem(LS_KEYS.active, activeId || ''); } catch (_) {}
  }

  function loadActive() {
    try { return localStorage.getItem(LS_KEYS.active) || null; } catch (_) { return null; }
  }

  function saveZ() {
    try { localStorage.setItem(LS_KEYS.zCounter, String(zCounter)); } catch (_) {}
  }

  function loadZ() {
    const n = parseInt(localStorage.getItem(LS_KEYS.zCounter) || '100', 10);
    if (!Number.isNaN(n)) zCounter = n;
  }

  // --------- utilities ----------
  function qs(el, sel) { return el.querySelector(sel); }
  function createFromTemplate(tpl) {
    if (typeof tpl === 'string') {
      const t = document.querySelector(tpl);
      if (!t || !(t instanceof HTMLTemplateElement)) {
        console.warn('[WM] template not found or not a <template>:', tpl);
        return null;
      }
      return t.content.cloneNode(true);
    }
    if (tpl instanceof HTMLTemplateElement) {
      return tpl.content.cloneNode(true);
    }
    if (tpl instanceof HTMLElement) {
      // treat as an existing node to clone
      return tpl.cloneNode(true);
    }
    return null;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // Attach minimal dragging on title bar (mouse + touch)
  function enableDrag(winEl) {
    const bar = winEl.querySelector('.title-bar');
    if (!bar) return;

    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    function getXY(e) {
      if (e.touches && e.touches.length) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    const onMove = (e) => {
      if (!dragging) return;
      const { x, y } = getXY(e);
      const dx = x - startX;
      const dy = y - startY;
      const taskbarH = document.querySelector('.taskbar')?.offsetHeight || 34;
      const pad = 8;
      const maxL = window.innerWidth - pad - 50;
      const maxT = window.innerHeight - taskbarH - pad - 30;
      const newL = Math.max(pad, Math.min(startLeft + dx, maxL));
      const newT = Math.max(pad, Math.min(startTop  + dy, maxT));
      winEl.style.left = `${newL}px`;
      winEl.style.top  = `${newT}px`;
      if (e.cancelable) e.preventDefault();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
      document.body.style.userSelect = '';
      saveWindowState(winEl.dataset.appId);
    };

    function startDrag(e) {
      if (e.target.closest('.title-bar-controls')) return;
      if (winEl.dataset.maximized === '1') return;
      // Skip drag on phones (auto-maximized)
      if (window.innerWidth <= 600) return;
      dragging = true;
      const { x, y } = getXY(e);
      startX = x;
      startY = y;
      startLeft = parseInt(winEl.style.left || '0', 10);
      startTop  = parseInt(winEl.style.top  || '0', 10);
      document.body.style.userSelect = 'none';
      bringToFrontInternal(winEl);
      setActiveInternal(winEl.dataset.appId);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
      document.addEventListener('touchcancel', onUp);
      e.preventDefault();
    }

    bar.addEventListener('mousedown', startDrag);
    bar.addEventListener('touchstart', startDrag, { passive: false });
  }


  function applySavedGeometry(id, winEl) {
    const s = loadWindowState(id);
    if (!s) return;
    if (s.maximized) {
      // set stored base geom so restore knows where to go
      if (s.top)    winEl.dataset.top    = s.top;
      if (s.left)   winEl.dataset.left   = s.left;
      if (s.width)  winEl.dataset.width  = s.width;
      if (s.height) winEl.dataset.height = s.height;
      maximizeInternal(winEl, /*emitEvt*/ false);
    } else {
      if (s.top)    winEl.style.top    = s.top;
      if (s.left)   winEl.style.left   = s.left;
      if (s.width)  winEl.style.width  = s.width;
      if (s.height) winEl.style.height = s.height;
      winEl.dataset.maximized = '0';
    }
  }

  // --------- core lifecycle ----------
  function mountWindow(appDef) {
    // Create DOM
    const frag = createFromTemplate(appDef.template);
    if (!frag) {
      console.error('[WM] Cannot mount app; bad template:', appDef.id);
      return null;
    }

    // Expect a .window.app as root in the template
    // If not present, wrap the first element
    let winEl = frag.querySelector('.window.app');
    if (!winEl) {
      const first = frag.firstElementChild || document.createElement('div');
      const wrapper = document.createElement('div');
      wrapper.className = 'window app';
      wrapper.appendChild(first);
      winEl = wrapper;
    }

    // annotate
    winEl.dataset.appId = appDef.id;
    if (!winEl.style.position) winEl.style.position = 'absolute';
    winEl.classList.remove('is-hidden');

    // Controls (optional)
    const btnMin = winEl.querySelector('[aria-label="Minimize"]');
    const btnMax = winEl.querySelector('[aria-label="Maximize"]');
    const btnClose = winEl.querySelector('[aria-label="Close"]');

    btnMin?.addEventListener('click', () => minimize(appDef.id));
    btnClose?.addEventListener('click', () => close(appDef.id));
    btnMax?.addEventListener('click', () => toggleMaximize(appDef.id));

    function focusWindow() {
      bringToFrontInternal(winEl);
      setActiveInternal(appDef.id);
    }
    winEl.addEventListener('mousedown', focusWindow);
    winEl.addEventListener('touchstart', focusWindow);

    // inject into desktop
    desktop.appendChild(frag); // append the entire fragment (contains winEl)
    // obtain the live element (if we wrapped, it’s wrapper; else re-query)
    const attachedWin = desktop.querySelector(`.window.app[data-app-id="${appDef.id}"]`) || winEl;

    // Ensure z & drag
    attachedWin.style.zIndex = String(++zCounter);
    saveZ();
    enableDrag(attachedWin);

    // Remember reference
    const inst = {
      el: attachedWin,
      mounted: true,
      state: { minimized: false },
      controls: { btnMin, btnMax, btnClose },
      titleBar: attachedWin.querySelector('.title-bar')
    };
    instances.set(appDef.id, inst);

    // Default geometry if none saved
    if (!loadWindowState(appDef.id)) {
      // scatter a bit to avoid perfect overlap
      const baseLeft = 120 + (registry.size * 24) % 240;
      const baseTop  = 100 + (registry.size * 18) % 180;
      attachedWin.style.left = attachedWin.style.left || `${baseLeft}px`;
      attachedWin.style.top  = attachedWin.style.top  || `${baseTop}px`;
    }

    // Apply persistence
    applySavedGeometry(appDef.id, attachedWin);

    // init once
    appDef.init?.(attachedWin, api);

    return inst;
  }

  function showInternal(id, emitOpenEvent = true) {
    const app = registry.get(id);
    if (!app) return;

    let inst = instances.get(id);
    if (!inst?.mounted) {
      inst = mountWindow(app);
    }

    if (!inst) return;

    inst.el.classList.remove('is-hidden');
    inst.state.minimized = false;
    bringToFrontInternal(inst.el);
    setActiveInternal(id);

    // Auto-maximize on phones
    if (window.innerWidth <= 600 && inst.el.dataset.maximized !== '1') {
      maximizeInternal(inst.el, false);
    }

    if (emitOpenEvent) emit('wm:open', { id, title: app.title, icon: app.icon, el: inst.el });
    app.onOpen?.(inst.el, api);

    saveOpenSet();
    saveWindowState(id); // update minimized/maximized flag
  }

  function hideInternal(id) {
    const inst = instances.get(id);
    if (!inst) return;
    inst.el.classList.add('is-hidden');
    inst.state.minimized = true;
  }

  function bringToFrontInternal(winEl) {
    const z = ++zCounter;
    winEl.style.zIndex = String(z);
    saveZ();
  }

  function setActiveInternal(id) {
    activeId = id;
    saveActive();
    emit('wm:focus', { id });
    // Update URL hash to reflect active app (B1)
    if (id) {
      history.replaceState(null, '', '#' + id);
    } else {
      history.replaceState(null, '', location.pathname);
    }
  }

  function maximizeInternal(winEl, emitEvt = true) {
    if (winEl.dataset.maximized === '1') return;
    // store current rect for restore
    winEl.dataset.top = winEl.style.top;
    winEl.dataset.left = winEl.style.left;
    winEl.dataset.width = winEl.style.width;
    winEl.dataset.height = winEl.style.height;

    // fill viewport (minus taskbar, using CSS vars for dynamic height)
    const root = getComputedStyle(document.documentElement);
    const tbH = root.getPropertyValue('--tb-h').trim() || '34px';
    const safeB = root.getPropertyValue('--safe-b').trim() || '0px';
    winEl.style.top = '8px';
    winEl.style.left = '8px';
    winEl.style.width = 'calc(100vw - 16px)';
    winEl.style.height = `calc(100vh - ${tbH} - ${safeB} - 16px)`;
    winEl.dataset.maximized = '1';
    if (emitEvt) emit('wm:maximize', { id: winEl.dataset.appId });
    saveWindowState(winEl.dataset.appId);
  }

  function restoreFromMax(winEl) {
    if (winEl.dataset.maximized !== '1') return;
    winEl.style.top = winEl.dataset.top || '80px';
    winEl.style.left = winEl.dataset.left || '120px';
    winEl.style.width = winEl.dataset.width || '';
    winEl.style.height = winEl.dataset.height || '';
    winEl.dataset.maximized = '0';
    saveWindowState(winEl.dataset.appId);
  }

  // --------- public API ----------
  function registerApp(def) {
    const {
      id, title, icon, template, init, onOpen, onClose
    } = def || {};
    if (!id || !template) {
      console.error('[WM] registerApp requires { id, template }');
      return;
    }
    const appDef = { id, title: title || id, icon: icon || '', template, init, onOpen, onClose };
    registry.set(id, appDef);
    emit('wm:register', { id, title: appDef.title, icon: appDef.icon });

    // Optionally auto-open if marked in URL hash (#work etc.)
    if (location.hash.replace('#', '') === id) {
      // delayed to allow other modules to subscribe
      queueMicrotask(() => open(id));
    }
  }

  function open(id) {
    showInternal(id, /*emitOpenEvent*/ true);
  }

  function close(id) {
    const app = registry.get(id);
    const inst = instances.get(id);
    if (!inst) return;

    // run app-specific close hook
    try { app?.onClose?.(inst.el, api); } catch (e) { console.error(e); }

    // remove DOM
    inst.el.remove();
    instances.delete(id);
    emit('wm:close', { id });

    // update focus
    if (activeId === id) {
      activeId = null;
      saveActive();
    }

    // Clear hash when all windows are closed (B2)
    if (instances.size === 0) {
      history.replaceState(null, '', location.pathname);
    }

    // persist open set
    saveOpenSet();
  }

  function minimize(id) {
    const inst = instances.get(id);
    if (!inst) return;
    inst.el.classList.add('is-hidden');
    inst.state.minimized = true;
    emit('wm:minimize', { id });
    saveOpenSet();
    saveWindowState(id);
  }

  function restore(id) {
    const inst = instances.get(id);
    if (!inst) { open(id); return; }
    showInternal(id, /*emitOpenEvent*/ false);
    emit('wm:restore', { id });
  }

  function toggle(id) {
    const inst = instances.get(id);
    if (!inst || inst.el.classList.contains('is-hidden')) {
      restore(id);
    } else {
      minimize(id);
    }
  }

  function bringToFront(id) {
    const inst = instances.get(id);
    if (!inst) return;
    bringToFrontInternal(inst.el);
    setActiveInternal(id);
  }

  function toggleMaximize(id) {
    const inst = instances.get(id);
    if (!inst) return;
    if (inst.el.dataset.maximized === '1') {
      restoreFromMax(inst.el);
    } else {
      maximizeInternal(inst.el);
    }
  }

  function setTitle(id, nextTitle) {
    const inst = instances.get(id);
    if (!inst) return;
    const t = qs(inst.el, '.title-bar .title-bar-text');
    if (t) t.textContent = nextTitle;
    emit('wm:state', { id, title: nextTitle });
  }

  function setIcon(id, iconUrl) {
    emit('wm:state', { id, icon: iconUrl });
  }

  function getState() {
    const open = Array.from(instances.keys());
    return {
      open,
      activeId,
      registry: Array.from(registry.keys())
    };
  }

  // --------- global keyboard shortcuts ----------
  function handleKeydown(e) {
    const target = e.target;
    if (target && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName))) return;

    if (e.key === 'Escape' && activeId) {
      minimize(activeId);
      return;
    }
    if ((e.key === 'x' || e.key === 'X') && activeId) {
      close(activeId);
      return;
    }

    // Alt+Tab (cycle open windows by z)
    if (e.key === 'Tab' && e.altKey) {
      e.preventDefault();
      const list = Array.from(instances.values())
        .filter(inst => !inst.el.classList.contains('is-hidden'))
        .sort((a, b) => parseInt(a.el.style.zIndex || '0', 10) - parseInt(b.el.style.zIndex || '0', 10));
      if (list.length === 0) return;
      const currIdx = list.findIndex(inst => inst.el.dataset.appId === activeId);
      const next = list[(currIdx + 1) % list.length];
      bringToFrontInternal(next.el);
      setActiveInternal(next.el.dataset.appId);
    }
  }
  document.addEventListener('keydown', handleKeydown, { passive: false });

  // --------- hashchange listener (B3) ----------
  window.addEventListener('hashchange', () => {
    const id = location.hash.replace('#', '');
    if (id && registry.has(id)) {
      open(id);
    }
  });

  // --------- boot restore ----------
  function restoreSession() {
    loadZ();
    const toOpen = loadOpenSet();
    const prevActive = loadActive();

    // Defer until all apps had a chance to register
    window.addEventListener('load', () => {
      toOpen.forEach(id => {
        if (registry.has(id)) open(id);
      });
      if (prevActive && instances.has(prevActive)) {
        bringToFront(prevActive);
      }
    });
  }
  restoreSession();

  // --------- public API export ----------
  const api = {
    // lifecycle
    registerApp,
    open, close, minimize, restore, toggle, toggleMaximize, bringToFront,
    // metadata
    setTitle, setIcon,
    // events
    on, off,
    // debug
    getState
  };

  // expose globally
  global.WM = api;

})(window);
