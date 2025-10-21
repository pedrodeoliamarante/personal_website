/* js/ui/taskbar.js
 * Taskbar UI that mirrors WindowManager state.
 * - Requires global WM (windowManager.js) to be loaded first.
 * - Looks for #taskbar-apps container; creates one if missing.
 */

(function () {
  'use strict';

  if (!window.WM) {
    console.error('[Taskbar] WM not found. Load windowManager.js first.');
    return;
  }

  // ------- host container -------
  let host = document.getElementById('taskbar-apps');
  if (!host) {
    // fallback: create a simple host at the end of body
    host = document.createElement('div');
    host.id = 'taskbar-apps';
    host.className = 'task-buttons';
    document.body.appendChild(host);
  }

  // id -> button element
  const buttons = new Map();

  function createButton({ id, title, icon }) {
    if (buttons.has(id)) return buttons.get(id);

    const btn = document.createElement('button');
    btn.className = 'button task-btn';
    btn.dataset.appId = id;
    btn.title = title || id;

    if (icon) {
      const img = document.createElement('img');
      img.width = 16; img.height = 16;
      img.alt = '';
      img.src = icon;
      btn.appendChild(img);
    }
    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = ' ' + (title || id);
    btn.appendChild(text);

    // Left click -> toggle minimize/restore
    btn.addEventListener('click', () => {
      WM.toggle(id);
    });

    // Middle click -> close
    btn.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        WM.close(id);
      }
    });

    // Context menu: close / minimize / maximize
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, id);
    });

    host.appendChild(btn);
    buttons.set(id, btn);
    return btn;
  }

  function removeButton(id) {
    const btn = buttons.get(id);
    if (!btn) return;
    btn.remove();
    buttons.delete(id);
  }

  function setActive(id, isActive) {
    const btn = buttons.get(id);
    if (!btn) return;
    btn.classList.toggle('active', !!isActive);
  }

  function updateMeta(id, { title, icon }) {
    const btn = buttons.get(id);
    if (!btn) return;

    if (title) {
      btn.title = title;
      const span = btn.querySelector('.task-text');
      if (span) span.textContent = ' ' + title;
    }
    if (icon) {
      let img = btn.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.width = 16; img.height = 16; img.alt = '';
        btn.insertBefore(img, btn.firstChild);
      }
      img.src = icon;
    }
  }

  // ------- tiny context menu -------
  let ctxMenu = null;
  function showContextMenu(x, y, id) {
    hideContextMenu();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'wm-context';
    ctxMenu.style.position = 'fixed';
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
    ctxMenu.style.zIndex = '9999';
    ctxMenu.innerHTML = `
      <button data-act="restore">Restore</button>
      <button data-act="minimize">Minimize</button>
      <button data-act="maximize">Maximize</button>
      <hr />
      <button data-act="close" class="danger">Close</button>
    `;
    ctxMenu.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'restore') WM.restore(id);
      if (act === 'minimize') WM.minimize(id);
      if (act === 'maximize') WM.toggleMaximize(id);
      if (act === 'close') WM.close(id);
      hideContextMenu();
    });
    document.body.appendChild(ctxMenu);

    // close on any outside click or Escape
    const onDocDown = (ev) => {
      if (!ctxMenu.contains(ev.target)) hideContextMenu();
    };
    const onEsc = (ev) => { if (ev.key === 'Escape') hideContextMenu(); };
    setTimeout(() => {
      document.addEventListener('mousedown', onDocDown, { once: true });
      document.addEventListener('keydown', onEsc, { once: true });
    }, 0);
  }

  function hideContextMenu() {
    if (ctxMenu) {
      ctxMenu.remove();
      ctxMenu = null;
    }
  }

  // ------- subscribe to WM events -------
  WM.on('wm:open', ({ id, title, icon }) => {
    const btn = createButton({ id, title, icon });
    // mark active when opened
    setActive(id, true);
    // deactivate others
    buttons.forEach((b, key) => { if (key !== id) b.classList.remove('active'); });
  });

  WM.on('wm:focus', ({ id }) => {
    buttons.forEach((b, key) => b.classList.toggle('active', key === id));
  });

  WM.on('wm:minimize', ({ id }) => {
    setActive(id, false);
  });

  WM.on('wm:restore', ({ id }) => {
    setActive(id, true);
    buttons.forEach((b, key) => { if (key !== id) b.classList.remove('active'); });
  });

  WM.on('wm:close', ({ id }) => {
    removeButton(id);
  });

  WM.on('wm:state', (payload) => {
    const { id, title, icon } = payload || {};
    if (!id) return;
    updateMeta(id, { title, icon });
  });

  // ------- boot sync (if WM restored windows before us) -------
  (function hydrateFromWM() {
    const { open, activeId } = WM.getState();
    open.forEach((id) => {
      // We don’t have title/icon here (they're in templates),
      // create a minimal button; meta will update on next state event
      createButton({ id, title: id, icon: null });
      setActive(id, id === activeId);
    });
  })();

})();
