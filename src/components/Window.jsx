import { useRef, useEffect, useCallback } from 'react';
import { useWindowManager } from '../context/WindowManagerContext';

export default function Window({ id, title, icon, children, className = '' }) {
  const { state, close, minimize, toggleMaximize, focus, updateGeometry } = useWindowManager();
  const win = state.windows[id];
  const elRef = useRef(null);
  const dragging = useRef(false);

  // Compute styles
  const isHidden = !win || !win.open || win.minimized;

  const style = {};
  if (win) {
    style.zIndex = win.zIndex;
    if (win.maximized) {
      const root = getComputedStyle(document.documentElement);
      const tbH = root.getPropertyValue('--tb-h').trim() || '34px';
      const safeB = root.getPropertyValue('--safe-b').trim() || '0px';
      style.top = '8px';
      style.left = '8px';
      style.width = 'calc(100vw - 16px)';
      style.height = `calc(100vh - ${tbH} - ${safeB} - 16px)`;
    } else {
      if (win.geometry.top) style.top = win.geometry.top;
      if (win.geometry.left) style.left = win.geometry.left;
      if (win.geometry.width) style.width = win.geometry.width;
      if (win.geometry.height) style.height = win.geometry.height;
    }
  }

  // ---- Drag ----
  const startDrag = useCallback((e) => {
    if (e.target.closest('.title-bar-controls')) return;
    if (win?.maximized) return;
    if (window.innerWidth <= 600) return;

    const el = elRef.current;
    if (!el) return;

    dragging.current = true;

    const getXY = (ev) => {
      if (ev.touches?.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      return { x: ev.clientX, y: ev.clientY };
    };

    const { x: startX, y: startY } = getXY(e);
    const startLeft = parseInt(el.style.left || '0', 10);
    const startTop = parseInt(el.style.top || '0', 10);

    document.body.style.userSelect = 'none';
    focus(id);

    const onMove = (ev) => {
      if (!dragging.current) return;
      const { x, y } = getXY(ev);
      const dx = x - startX;
      const dy = y - startY;
      const taskbarH = document.querySelector('.taskbar')?.offsetHeight || 34;
      const pad = 8;
      const maxL = window.innerWidth - pad - 50;
      const maxT = window.innerHeight - taskbarH - pad - 30;
      const newL = Math.max(pad, Math.min(startLeft + dx, maxL));
      const newT = Math.max(pad, Math.min(startTop + dy, maxT));
      // Direct DOM mutation for performance during drag
      el.style.left = `${newL}px`;
      el.style.top = `${newT}px`;
      if (ev.cancelable) ev.preventDefault();
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
      document.body.style.userSelect = '';
      // Commit final position to state
      if (el) {
        updateGeometry(id, { top: el.style.top, left: el.style.left });
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);
    e.preventDefault();
  }, [id, win?.maximized, focus, updateGeometry]);

  // Auto-maximize on phones
  useEffect(() => {
    if (win && win.open && !win.minimized && !win.maximized && window.innerWidth <= 600) {
      toggleMaximize(id);
    }
  }, [win?.open, win?.minimized]);

  if (!win || !win.open) return null;

  return (
    <div
      ref={elRef}
      className={`window app ${className} ${isHidden ? 'is-hidden' : ''}`}
      data-app={id}
      style={style}
      onMouseDown={() => focus(id)}
      onTouchStart={() => focus(id)}
    >
      <div
        className="title-bar"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        <div className="title-bar-text">{title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={() => minimize(id)} />
          <button aria-label="Maximize" onClick={() => toggleMaximize(id)} />
          <button aria-label="Close" onClick={() => close(id)} />
        </div>
      </div>
      {children}
    </div>
  );
}
