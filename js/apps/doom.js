// js/apps/doom.js
(function () {
  'use strict';
  if (!window.WM) return console.error('[doom] WM not found.');

  WM.registerApp({
    id: 'doom',
    title: 'DOOM',
    icon: 'assets/doom.png',
    template: '#tpl-doom',
    init(rootEl) {
      const mount = rootEl.querySelector('.doom-container');

      // IMPORTANT: pathPrefix must point to the folder that contains emulators.js
      Dos(mount, {
        url: 'assets/games/doom/doom.jsdos',
        pathPrefix: 'js/emu/emulators/',   // <-- changed
        autoStart: true,
        onEvent: (ev, ci) => { if (ev === 'ci-ready') rootEl._ci = ci; }
      });

      WM.on('wm:minimize', ({ id }) => { if (id === 'doom') rootEl._ci?.pause?.(); });
      WM.on('wm:restore',  ({ id }) => { if (id === 'doom') rootEl._ci?.resume?.(); });
      WM.on('wm:close',    ({ id }) => { if (id === 'doom') rootEl._ci?.exit?.(); });
    }
  });
})();
