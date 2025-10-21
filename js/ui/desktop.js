/* js/ui/desktop.js
 * Desktop glue: desktop icons + live clock
 * Requires: WM (windowManager.js)
 */
(function () {
  'use strict';
  if (!window.WM) return;

  // Desktop icons: <a class="icon" data-launch="appId">
  document.querySelectorAll('.icon[data-launch]').forEach((icon) => {
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      const id = icon.dataset.launch;
      if (id) WM.open(id);
      // close start menu if open
      const toggle = document.getElementById('start-toggle');
      if (toggle) toggle.checked = false;
    });
  });

  // Live clock in taskbar: <time class="clock">
  const clock = document.querySelector('.clock');
  function fmt(d) {
    // 24h HH:MM
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  function tick() {
    if (clock) clock.textContent = fmt(new Date());
  }
  tick();
  setInterval(tick, 30_000);
})();
