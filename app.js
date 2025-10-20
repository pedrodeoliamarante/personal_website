// app.js — XP-style window manager (reusable, draggable, taskbar queue)

document.addEventListener("DOMContentLoaded", () => {
  const apps = new Map();           // id -> { win, title, taskBtn, ... }
  const taskbar = document.getElementById("taskbar-apps");
  const openQueue = [];             // taskbar order (queue-like)
  const startToggle = document.getElementById("start-toggle");
  let activeAppId = null;

  // -------- Register windows --------
  document.querySelectorAll(".window.app[data-app]").forEach((win) => {
    const id = win.dataset.app;
    const title = (win.querySelector(".title-bar-text")?.textContent || id).trim();
    const btnMin = win.querySelector('[aria-label="Minimize"]');
    const btnMax = win.querySelector('[aria-label="Maximize"]');
    const btnClose = win.querySelector('[aria-label="Close"]');
    const titleBar = win.querySelector(".title-bar");

    apps.set(id, { id, win, title, btnMin, btnMax, btnClose, titleBar, taskBtn: null });

    // Focus / active tracking
    win.addEventListener("mousedown", () => { bringToFront(win); activeAppId = id; });

    // Window controls
    btnMin?.addEventListener("click", () => minimize(id));
    btnClose?.addEventListener("click", () => closeApp(id));
    btnMax?.addEventListener("click", () => toggleMaximize(win));

    // Dragging by title bar (ignore clicks on control buttons)
    enableDrag(win, titleBar, () => { bringToFront(win); activeAppId = id; });
  });

  // If any windows start visible, ensure they get taskbar entries
  apps.forEach((app) => {
    if (!app.win.classList.contains("is-hidden")) {
      openApp(app.id);
    }
  });

  // -------- Desktop launchers --------
  document.querySelectorAll('.icon[data-launch]').forEach((icon) => {
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      const id = icon.dataset.launch;
      openApp(id);
      closeStartMenu();
    });
  });

  // -------- Start menu items (optional) --------
  document.querySelectorAll('.start-item[data-launch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openApp(btn.dataset.launch);
      closeStartMenu();
    });
  });

  // Clicking outside start menu closes it
  document.addEventListener('mousedown', (e) => {
    if (!startToggle) return;
    const within = e.target.closest('.start-menu') || e.target.closest('.start-button');
    if (!within) startToggle.checked = false;
  });

  // -------- Keyboard shortcuts --------
  document.addEventListener("keydown", (e) => {
    // ignore when typing
    const t = e.target;
    if (t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName))) return;

    // Close active with X
    if ((e.key === "x" || e.key === "X") && activeAppId) {
      closeApp(activeAppId);
      return;
    }
    // Minimize active with Escape
    if (e.key === "Escape" && activeAppId) {
      minimize(activeAppId);
      return;
    }
    // Start key: open/close start menu with Meta (Win key)
    if (e.key === "Meta" && startToggle) {
      startToggle.checked = !startToggle.checked;
    }
  });

  // ================= Core window ops =================
  function openApp(id) {
    const app = apps.get(id);
    if (!app) return;

    // Already open? just show & focus
    if (openQueue.includes(id)) {
      show(id);
      bringToFront(app.win);
      activeAppId = id;
      return;
    }

    // Create taskbar button (queue append)
    app.taskBtn = createTaskbarButton(app);
    openQueue.push(id);

    show(id);
    bringToFront(app.win);
    activeAppId = id;
  }

  function minimize(id) {
    const app = apps.get(id);
    if (!app) return;
    app.win.classList.add("is-hidden");
    setTaskActive(app, false);
  }

  function closeApp(id) {
    const app = apps.get(id);
    if (!app) return;

    // Hide window
    app.win.classList.add("is-hidden");
    setTaskActive(app, false);

    // Remove taskbar entry
    if (app.taskBtn) {
      taskbar.removeChild(app.taskBtn);
      app.taskBtn = null;
    }

    // Remove from queue
    const idx = openQueue.indexOf(id);
    if (idx !== -1) openQueue.splice(idx, 1);

    if (activeAppId === id) activeAppId = null;
  }

  function toggleFromTaskbar(id) {
    const app = apps.get(id);
    if (!app) return;
    if (app.win.classList.contains("is-hidden")) show(id);
    else minimize(id);
    activeAppId = id;
  }

  function show(id) {
    const app = apps.get(id);
    if (!app) return;
    app.win.classList.remove("is-hidden");
    setTaskActive(app, true);
    bringToFront(app.win);
  }

  function setTaskActive(app, isActive) {
    if (!app.taskBtn) return;
    app.taskBtn.classList.toggle("active", isActive && !app.win.classList.contains("is-hidden"));
  }

  function bringToFront(win) {
    const maxZ = Math.max(
      0,
      ...Array.from(document.querySelectorAll(".window.app"))
        .map(w => parseInt(getComputedStyle(w).zIndex || 0, 10))
    );
    win.style.zIndex = String(maxZ + 1);
  }

  function toggleMaximize(win) {
    if (win.dataset.maximized === "1") {
      win.style.top = win.dataset.top;
      win.style.left = win.dataset.left;
      win.style.width = win.dataset.width;
      win.style.height = win.dataset.height;
      win.dataset.maximized = "0";
    } else {
      // Save current rect
      win.dataset.top = win.style.top;
      win.dataset.left = win.style.left;
      win.dataset.width = win.style.width;
      win.dataset.height = win.style.height;
      // Fill screen (minus taskbar)
      win.style.top = "8px";
      win.style.left = "8px";
      win.style.width = "calc(100vw - 16px)";
      win.style.height = "calc(100vh - 42px)";
      win.dataset.maximized = "1";
    }
  }

  function createTaskbarButton(app) {
  const btn = document.createElement("button");
  btn.className = "button task-btn";
  btn.title = app.title;

  // Prefer icon from the window's data-icon
  let iconPath = app.win.dataset.icon;

  // Fallback: use matching desktop launcher icon if present
  if (!iconPath) {
    const launcher = document.querySelector(`.icon[data-launch="${app.id}"] img`);
    if (launcher) iconPath = launcher.getAttribute("src");
  }

  if (iconPath) {
    const img = document.createElement("img");
    img.src = iconPath;
    img.width = 16; img.height = 16;
    btn.appendChild(img);
  }

  btn.appendChild(document.createTextNode(" " + app.title));
  btn.addEventListener("click", () => toggleFromTaskbar(app.id));
  taskbar.appendChild(btn);
  return btn;
}

  function closeStartMenu() {
    if (startToggle) startToggle.checked = false;
  }

  // ================= Dragging =================
  function enableDrag(win, handle, onStartFocus) {
    if (!handle) return;

    let offsetX = 0, offsetY = 0, dragging = false;

    handle.addEventListener("mousedown", (e) => {
      // ignore control buttons
      if (e.target.closest(".title-bar-controls")) return;
      dragging = true;
      onStartFocus?.();
      offsetX = e.clientX - win.offsetLeft;
      offsetY = e.clientY - win.offsetTop;
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      // prevent selecting text while dragging
      e.preventDefault();
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      win.style.left = Math.max(0, Math.min(x, window.innerWidth - 50)) + "px";
      win.style.top  = Math.max(0, Math.min(y, window.innerHeight - 60)) + "px";
    });

    document.addEventListener("mouseup", () => {
      dragging = false;
      document.body.style.userSelect = "";
    });
  }

  // Expose a tiny API to the console (handy for testing)
  window.XP = {
    open: openApp,
    close: closeApp,
    minimize,
    show,
    apps: () => Array.from(apps.keys()),
    queue: () => [...openQueue],
  };
});
