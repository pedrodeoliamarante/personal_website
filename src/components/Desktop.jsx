import { useEffect } from 'react';
import { useWindowManager } from '../context/WindowManagerContext';
import { apps } from '../data/apps';
import DesktopIcon from './DesktopIcon';
import Window from './Window';
import Taskbar from './Taskbar';
import AboutApp from '../apps/AboutApp';
import NotepadApp from '../apps/NotepadApp';
import WorkApp from '../apps/WorkApp';
import BioApp from '../apps/BioApp';
import ContactApp from '../apps/ContactApp';
import PcmApp from '../apps/PcmApp';
import DoomApp from '../apps/DoomApp';

const appComponents = {
  about: { component: AboutApp, className: '' },
  notepad: { component: NotepadApp, className: '' },
  work: { component: WorkApp, className: '' },
  bio: { component: BioApp, className: 'msn-win' },
  contact: { component: ContactApp, className: 'contact-win' },
  pcm: { component: PcmApp, className: '' },
  doom: { component: DoomApp, className: '' },
};

export default function Desktop({ onShutdown }) {
  const { state, open } = useWindowManager();

  // Mobile: set --vh for real viewport height
  useEffect(() => {
    const root = document.documentElement;

    function setVH() {
      const vh = window.innerHeight * 0.01;
      root.style.setProperty('--vh', `${vh}px`);
    }
    setVH();

    function setMobileFlag() {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      root.classList.toggle('is-mobile', isMobile);
    }
    setMobileFlag();

    window.addEventListener('resize', setVH);
    window.addEventListener('resize', setMobileFlag);
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('resize', setMobileFlag);
    };
  }, []);

  // First visit: auto-open About
  useEffect(() => {
    const FIRST_KEY = 'site:firstVisit';
    const first = localStorage.getItem(FIRST_KEY);
    if (!first && !location.hash) {
      const aboutApp = apps.find(a => a.id === 'about');
      open('about', aboutApp?.defaultPos);
    }
    localStorage.setItem(FIRST_KEY, '1');
  }, [open]);

  const openWindows = Object.entries(state.windows)
    .filter(([, w]) => w.open);

  return (
    <div className="desktop">
      {apps.map((app) => (
        <DesktopIcon key={app.id} appId={app.id} />
      ))}

      {openWindows.map(([id]) => {
        const app = apps.find(a => a.id === id);
        const appConfig = appComponents[id];
        if (!app || !appConfig) return null;
        const AppComponent = appConfig.component;

        return (
          <Window key={id} id={id} title={app.title} icon={app.icon} className={appConfig.className}>
            <AppComponent appId={id} />
          </Window>
        );
      })}

      <Taskbar onShutdown={onShutdown} />
    </div>
  );
}
