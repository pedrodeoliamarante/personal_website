import { useState, useEffect, useRef } from 'react';

const KEY = 'app:notepad:value';

export default function NotepadApp() {
  const [value, setValue] = useState(() => localStorage.getItem(KEY) || 'Hello from XP Notepad!');
  const taRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(KEY, value);
  }, [value]);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  return (
    <div className="window-body">
      <textarea
        ref={taRef}
        style={{ width: '100%', height: '220px' }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
