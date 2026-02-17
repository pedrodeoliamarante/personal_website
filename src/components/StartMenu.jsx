import { useEffect, useRef } from 'react';
import { useWindowManager } from '../context/WindowManagerContext';
import { startMenuApps, startMenuLinks, apps } from '../data/apps';

export default function StartMenu({ isOpen, onClose, onShutdown }) {
  const { open } = useWindowManager();
  const menuRef = useRef(null);

  // Close on outside click/touch
  useEffect(() => {
    if (!isOpen) return;

    function onOutside(e) {
      if (menuRef.current?.contains(e.target)) return;
      if (e.target.closest('.start-button')) return;
      onClose();
    }

    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [isOpen, onClose]);

  const launchApp = (id) => {
    const app = apps.find(a => a.id === id);
    open(id, app?.defaultPos);
    onClose();
  };

  return (
    <div ref={menuRef} className={`start-menu ${isOpen ? 'is-open' : ''}`} role="menu" aria-label="Start Menu">
      <div className="xp-start">
        <div className="xp-start-header">
          <div className="user-badge">user</div>
        </div>

        <div className="xp-start-body">
          <div className="xp-left">
            {startMenuApps.map((item) => (
              <button key={item.id} className="button start-item" onClick={() => launchApp(item.id)}>
                <img src={item.icon} width="16" height="16" alt="" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="xp-right">
            {startMenuLinks.map((link) => (
              <a key={link.label} className="start-link">
                <img src={link.icon} width="16" height="16" alt="" />
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="xp-start-footer">
          <button className="button ghost">
            <img src="assets/0031 - Start Find.ico" width="16" height="16" alt="" />
            Search
          </button>
          <button className="button danger" onClick={onShutdown}>
            <img src="assets/0032 - Shutdown.ico" width="16" height="16" alt="" />
            Shut Down...
          </button>
        </div>
      </div>
    </div>
  );
}
