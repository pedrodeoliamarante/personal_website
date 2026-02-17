import { useEffect, useRef } from 'react';

export default function AboutApp() {
  const bodyRef = useRef(null);

  useEffect(() => {
    bodyRef.current?.querySelector('a,button,[tabindex],input,textarea,select')?.focus();
  }, []);

  return (
    <div className="window-body" ref={bodyRef}>
      <p>Hi! I'm Pedro Amarante,</p>
      <p>Welcome to my desktop!</p>
    </div>
  );
}
