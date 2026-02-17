import { useState, useEffect } from 'react';

function fmt(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function useClock() {
  const [time, setTime] = useState(() => fmt(new Date()));

  useEffect(() => {
    const id = setInterval(() => setTime(fmt(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return time;
}
