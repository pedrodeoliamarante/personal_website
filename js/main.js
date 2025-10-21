/* js/main.js
 * Optional boot behavior
 * - Auto-open an app on first visit
 * - Hash deep-links (#work) if you want to force-open
 */
(function () {
  'use strict';
  if (!window.WM) return;

  // Deep-link: if hash is present, windowManager will auto-open on register.
  // If you want to force-open About on first ever visit:
  const FIRST_KEY = 'site:firstVisit';
  const first = localStorage.getItem(FIRST_KEY);
  if (!first && !location.hash) {
    // open About after apps register
    window.addEventListener('load', () => WM.open('about'));
  }
  localStorage.setItem(FIRST_KEY, '1');
})();
