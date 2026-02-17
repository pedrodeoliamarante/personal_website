/* js/ui/startMenu.js
 * Start menu: close on outside click/touch and launch apps
 */
(function () {
  'use strict';

  const toggle = document.getElementById('start-toggle');
  const menu = document.querySelector('.start-menu');
  if (!toggle || !menu) return;

  // Close start menu when clicking/touching outside
  function onOutside(e) {
    if (!toggle.checked) return;
    if (menu.contains(e.target)) return;
    // Don't close if clicking the start button label itself
    if (e.target.closest('.start-button')) return;
    toggle.checked = false;
  }

  document.addEventListener('mousedown', onOutside);
  document.addEventListener('touchstart', onOutside);

  // Launch apps from start menu items
  menu.querySelectorAll('[data-launch]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const id = item.dataset.launch;
      if (id && window.WM) WM.open(id);
      toggle.checked = false;
    });
  });
})();
