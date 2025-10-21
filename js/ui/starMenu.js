/* js/ui/startMenu.js
 * XP-style Start Menu controller
 * - Requires WM (windowManager.js)
 * - Expects a checkbox#start-toggle, .start-button, and .start-menu in DOM
 * - Handles outside-click and Escape closing
 * - Launches apps via data-launch attributes
 */

(function () {
  'use strict';

  if (!window.WM) {
    console.error('[StartMenu] WM not found. Load windowManager.js first.');
    return;
  }

  const toggle = document.getElementById('start-toggle');
  const startBtn = document.querySelector('.start-button');
  const menu = document.querySelector('.start-menu');
  if (!toggle || !menu || !startBtn) {
    console.warn('[StartMenu] missing structure (expected #start-toggle, .start-button, .start-menu)');
    return;
  }

  // -------- toggle logic --------
  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggle.checked = !toggle.checked;
    if (toggle.checked) positionMenu();
  });

  function positionMenu() {
    // Keep pinned to bottom-left edge of viewport
    menu.style.left = '0px';
    menu.style.bottom = `${document.querySelector('.taskbar')?.offsetHeight || 34}px`;
  }

  // -------- app launchers --------
  menu.querySelectorAll('[data-launch]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.launch;
      if (id) WM.open(id);
      closeMenu();
    });
  });

  // -------- outside click closes menu --------
  document.addEventListener('mousedown', (e) => {
    const within = e.target.closest('.start-menu') || e.target.closest('.start-button');
    if (!within) closeMenu();
  });

  // -------- Esc key closes menu --------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  function closeMenu() {
    toggle.checked = false;
  }

  // -------- shutdown button behavior (optional) --------
  const shutBtn = menu.querySelector('[data-shutdown]');
  if (shutBtn) {
    shutBtn.addEventListener('click', () => {
      closeMenu();
      fakeShutdown();
    });
  }

  function fakeShutdown() {
    // Fun fake “shutdown” overlay
    let overlay = document.createElement('div');
    overlay.className = 'wm-shutdown';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: '#000',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Tahoma, sans-serif',
      fontSize: '20px',
      zIndex: '999999',
    });
    overlay.textContent = 'Shutting down...';
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.textContent = 'Goodbye!';
    }, 1200);
    setTimeout(() => {
      overlay.remove();
    }, 2500);
  }

  // -------- startup positioning --------
  window.addEventListener('resize', positionMenu);
  positionMenu();

})();
