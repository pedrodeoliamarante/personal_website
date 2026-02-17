import { useWindowManager } from '../context/WindowManagerContext';
import { apps } from '../data/apps';

export default function DesktopIcon({ appId }) {
  const { open } = useWindowManager();
  const app = apps.find(a => a.id === appId);
  if (!app) return null;

  const handleClick = (e) => {
    e.preventDefault();
    open(appId, app.defaultPos);
  };

  return (
    <a
      className="icon"
      href="#"
      style={{ left: app.desktopPos.left, top: app.desktopPos.top }}
      onClick={handleClick}
    >
      <img src={app.icon} alt={app.title} />
      <span>{app.title}</span>
    </a>
  );
}
