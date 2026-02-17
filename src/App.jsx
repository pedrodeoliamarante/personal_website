import { useState } from 'react';
import { WindowManagerProvider } from './context/WindowManagerContext';
import Desktop from './components/Desktop';

export default function App() {
  const [shutdown, setShutdown] = useState(false);

  if (shutdown) {
    return (
      <div className="wm-shutdown">
        Windows is shutting down...
      </div>
    );
  }

  return (
    <WindowManagerProvider>
      <Desktop onShutdown={() => setShutdown(true)} />
    </WindowManagerProvider>
  );
}
