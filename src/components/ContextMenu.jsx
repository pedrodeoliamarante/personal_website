import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useWindowManager } from '../context/WindowManagerContext';

export default function ContextMenu({ appId, x, y, onClose }) {
  const { restore, minimize, toggleMaximize, close } = useWindowManager();
  const ref = useRef(null);

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onEsc(e) {
      if (e.key === 'Escape') onClose();
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onOutside, { once: true });
      document.addEventListener('touchstart', onOutside, { once: true });
      document.addEventListener('keydown', onEsc, { once: true });
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  const act = (fn) => {
    fn(appId);
    onClose();
  };

  return createPortal(
    <div
      ref={ref}
      className="wm-context"
      style={{ position: 'fixed', left: x, top: y, zIndex: 99999 }}
    >
      <button onClick={() => act(restore)}>Restore</button>
      <button onClick={() => act(minimize)}>Minimize</button>
      <button onClick={() => act(toggleMaximize)}>Maximize</button>
      <hr />
      <button className="danger" onClick={() => act(close)}>Close</button>
    </div>,
    document.body
  );
}
