import { useState, useEffect, useRef, useCallback } from 'react';
import { useWindowManager } from '../context/WindowManagerContext';
import { conversation, AV_CONTACT, AV_ME } from '../data/bioConversation';

export default function BioApp({ appId }) {
  const { focus } = useWindowManager();
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('online');
  const [isNudged, setIsNudged] = useState(false);
  const chatRef = useRef(null);
  const cursorRef = useRef(0);
  const playingRef = useRef(false);
  const timersRef = useRef([]);
  const mountedRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(id => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const appendMessage = useCallback((msg) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { ...msg, time }]);
  }, []);

  const scheduleNext = useCallback(() => {
    if (cursorRef.current >= conversation.length) {
      playingRef.current = false;
      return;
    }
    const msg = conversation[cursorRef.current];
    const delay = Math.max(0, msg.t);
    const timer = setTimeout(() => {
      appendMessage(msg);
      cursorRef.current++;
      scheduleNext();
    }, delay);
    timersRef.current.push(timer);
  }, [appendMessage]);

  const play = useCallback(() => {
    if (playingRef.current) return;
    playingRef.current = true;
    scheduleNext();
  }, [scheduleNext]);

  const pause = useCallback(() => {
    playingRef.current = false;
    clearTimers();
  }, [clearTimers]);

  const replay = useCallback(() => {
    clearTimers();
    cursorRef.current = 0;
    playingRef.current = false;
    setMessages([]);
    // Delay play to let state settle
    setTimeout(() => play(), 50);
  }, [clearTimers, play]);

  // Auto-play on mount (guard for StrictMode)
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    play();
    return () => {
      clearTimers();
      playingRef.current = false;
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNudge = () => {
    setIsNudged(false);
    // Force reflow via requestAnimationFrame
    requestAnimationFrame(() => {
      setIsNudged(true);
      focus(appId);
      setTimeout(() => setIsNudged(false), 400);
    });
  };

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
  };

  // Apply nudge class to the parent window element
  useEffect(() => {
    if (isNudged) {
      const winEl = document.querySelector(`.window.app[data-app="${appId}"]`);
      if (winEl) {
        winEl.classList.add('is-nudged');
        const timer = setTimeout(() => winEl.classList.remove('is-nudged'), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [isNudged, appId]);

  const bannerShadow = (status === 'away' || status === 'busy')
    ? '0 0 0 2px rgba(241,196,15,.25) inset'
    : 'none';

  return (
    <div className="window-body msn-body">
      <div className="msn-toolbar" role="toolbar" aria-label="MSN actions">
        <div className="msn-toolbar-group">
          <button className="msn-tbtn" title="Invite">Invite</button>
          <button className="msn-tbtn" title="Send Files">Send Files</button>
          <button className="msn-tbtn" title="Webcam">Webcam</button>
          <button className="msn-tbtn" title="Audio">Audio</button>
          <button className="msn-tbtn" title="Activities">Activities</button>
          <button className="msn-tbtn" title="Games">Games</button>
        </div>
        <div className="msn-presence">
          <span className={`dot ${status}`} aria-hidden="true" />
          <select className="msn-status" aria-label="Status" value={status} onChange={handleStatusChange}>
            <option value="online">Online</option>
            <option value="away">Away</option>
            <option value="busy">Busy</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      <div className="msn-to" style={{ boxShadow: bannerShadow }}>
        <label>To:</label>
        <input className="msn-to-input" value="Pedro Amarante" readOnly />
      </div>

      <div className="msn-layout">
        <section className="msn-chat" aria-live="polite" aria-label="Conversation" ref={chatRef}>
          {messages.map((msg, i) => (
            <div key={i} className="msn-line" style={msg.who === 'me' ? { justifyContent: 'flex-end' } : undefined}>
              {msg.who !== 'me' && (
                <div className="avatar">
                  <img src={AV_CONTACT} alt="Contact" />
                </div>
              )}
              <div>
                <div className={`msn-msg ${msg.who === 'me' ? 'me' : ''}`}>{msg.text}</div>
                <div className="msn-meta">{msg.time}</div>
              </div>
              {msg.who === 'me' && (
                <div className="avatar">
                  <img src={AV_ME} alt="Pedro" />
                </div>
              )}
            </div>
          ))}
        </section>

        <aside className="msn-avatars" aria-label="Display pictures">
          <div className="msn-avatar">
            <img src={AV_CONTACT} alt="Contact avatar" />
          </div>
          <div className="msn-avatar">
            <img
              src="assets/avatar_pedro.jpg"
              alt="Pedro avatar"
              onError={(e) => { e.target.src = AV_ME; }}
            />
          </div>
        </aside>
      </div>

      <div className="msn-compose">
        <div className="msn-formatbar">
          <button className="fmt">A</button>
        </div>
        <textarea className="msn-input" placeholder="" />
        <div className="msn-sendcol">
          <button className="msn-send" disabled>Send</button>
          <button className="msn-nudge" title="Nudge" onClick={handleNudge}>Nudge</button>
        </div>
      </div>

      <div className="msn-footer">
        <div className="left">Never give out your password or credit card number in an instant message conversation.</div>
        <div className="right">
          <button className="msn-ctrl" onClick={play}>Play</button>
          <button className="msn-ctrl" onClick={pause}>Pause</button>
          <button className="msn-ctrl" onClick={replay}>Replay</button>
        </div>
      </div>
    </div>
  );
}
