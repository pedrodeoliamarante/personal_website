/* js/apps/bio.js
 * MSN-style Bio chat (fake, conversational)
 * Plugs into existing WM. No network; timed messages with controls.
 */
(function () {
  'use strict';
  if (!window.WM) {
    console.error('[bio] WM not found. Load windowManager.js first.');
    return;
  }

  // -------- Conversation script (edit freely) --------
  const convo = [
    { who: 'them', text: "Hey Pedro! Mind if I ask a few quick questions?", t: 0 },
    { who: 'me',   text: "Sure, fire away ", t: 1000 },
    { who: 'them', text: "Where are you from?", t: 1500 },
    { who: 'me',   text: "I'm originally from Brazil, but have been on the US for the past  5 years.", t: 1600 },
    { who: 'them', text: "Where are you based?", t: 1600 },
    { who: 'me',   text: "Based in Palo Alto.", t: 1600 },
    { who: 'them', text: "What do you enjoy outside work?", t: 1600 },
    { who: 'me',   text: "I like sports like surfing and snowboarding. I also like to work on personal projects like this.", t: 1600 },
    { who: 'them', text: "Best way to reach you?", t: 1600 },
    { who: 'me',   text: "My email is ppedrolia@gmail.com", t: 1600 },
  ];

  // Optional assets
  const AV_CONTACT = 'assets/msn_butterfly.png';
  const AV_ME = 'assets/Windows HD User Account Picture Pack 1.5/Windows XP/dog.jpg';

  WM.registerApp({
    id: 'bio',
    title: 'Bio (MSN)',
    icon: AV_CONTACT,
    template: '#tpl-bio',
    init(rootEl) {
      const chat = rootEl.querySelector('.msn-chat');
      const statusSel = rootEl.querySelector('.msn-status');
      const dot = rootEl.querySelector('.msn-presence .dot');
      const playBtn = rootEl.querySelector('[data-act="play"]');
      const pauseBtn = rootEl.querySelector('[data-act="pause"]');
      const replayBtn = rootEl.querySelector('[data-act="replay"]');
      const nudgeBtn = rootEl.querySelector('.msn-nudge');

      // Replace avatars if missing assets
      rootEl.querySelectorAll('.msn-avatar img').forEach((img, i) => {
        img.addEventListener('error', () => { img.src = i === 0 ? AV_CONTACT : AV_ME; });
      });

      // Status dropdown → dot color
      statusSel.addEventListener('change', () => {
        dot.className = `dot ${statusSel.value}`;
        // Banner line like MSN warning for Away/Busy
        const banner = rootEl.querySelector('.msn-to');
        banner.style.boxShadow = (statusSel.value === 'away' || statusSel.value === 'busy')
          ? '0 0 0 2px rgba(241,196,15,.25) inset'
          : 'none';
      });

      // --- Transcript controls ---
      let timers = [];
      let cursor = 0;
      let playing = false;

      function clearTimers() {
        timers.forEach(id => clearTimeout(id));
        timers = [];
      }
      function reset() {
        clearTimers();
        cursor = 0;
        chat.innerHTML = '';
        playing = false;
      }

      function scheduleNext() {
        if (cursor >= convo.length) { playing = false; return; }
        const { who, text, t } = convo[cursor];
        const delay = Math.max(0, t);
        const id = setTimeout(() => {
          appendLine(who, text);
          cursor++;
          // auto-scroll
          chat.scrollTop = chat.scrollHeight;
          scheduleNext();
        }, delay);
        timers.push(id);
      }

      function appendLine(who, text) {
        const line = document.createElement('div');
        line.className = 'msn-line';
        const av = document.createElement('div');
        av.className = 'avatar';
        const img = document.createElement('img');
        img.src = (who === 'me') ? AV_ME : AV_CONTACT;
        img.alt = (who === 'me') ? 'Pedro' : 'Contact';
        av.appendChild(img);

        const msg = document.createElement('div');
        msg.className = 'msn-msg' + (who === 'me' ? ' me' : '');
        msg.textContent = text;

        const meta = document.createElement('div');
        meta.className = 'msn-meta';
        const now = new Date();
        meta.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const bubble = document.createElement('div');
        bubble.appendChild(msg);
        bubble.appendChild(meta);

        if (who === 'me') {
          // Align to right-ish by reversing order
          line.style.justifyContent = 'flex-end';
          line.appendChild(bubble);
          line.appendChild(av);
        } else {
          line.appendChild(av);
          line.appendChild(bubble);
        }
        chat.appendChild(line);
      }

      function play() {
        if (playing) return;
        playing = true;
        scheduleNext();
      }
      function pause() {
        playing = false;
        clearTimers();
      }
      function replay() {
        reset();
        play();
      }

      playBtn.addEventListener('click', play);
      pauseBtn.addEventListener('click', pause);
      replayBtn.addEventListener('click', replay);

      // Start automatically once opened
      play();

      // Nudge → shake window
      nudgeBtn.addEventListener('click', () => {
        rootEl.classList.remove('is-nudged');
        // force reflow to retrigger animation
        void rootEl.offsetWidth;
        rootEl.classList.add('is-nudged');
        // bring to front
        WM.bringToFront('bio');
      });

      // Cleanup on close
      WM.on('wm:close', ({ id }) => {
        if (id === 'bio') clearTimers();
      });
    },
    onOpen(rootEl) {
      // focus controls for a11y
      rootEl.querySelector('[data-act="pause"]')?.focus();
    }
  });

})();
