document.addEventListener("DOMContentLoaded", () => {
  const apps = new Map();
  const taskbar = document.getElementById("taskbar-apps");
  const openQueue = []; // queue-like order for taskbar
  let activeAppId = null;

  // Register all windows
  document.querySelectorAll(".window.app[data-app]").forEach((win) => {
    const id = win.dataset.app;
    const title = win.querySelector(".title-bar-text").textContent;
    const btnMin = win.querySelector('[aria-label="Minimize"]');
    const btnMax = win.querySelector('[aria-label="Maximize"]');
    const btnClose = win.querySelector('[aria-label="Close"]');
    const titleBar = win.querySelector(".title-bar");

    apps.set(id, { id, win, title, btnMin, btnMax, btnClose, titleBar, taskBtn: null });
    win.classList.add("is-hidden");

    win.addEventListener("mousedown", () => {
      bringToFront(win);
      activeAppId = id;
    });

    btnMin.addEventListener("click", () => minimize(id));
    btnClose.addEventListener("click", () => closeApp(id));
    btnMax.addEventListener("click", () => toggleMaximize(win));

    enableDrag(win, titleBar, () => {
      bringToFront(win);
      activeAppId = id;
    });
  });

  // Launchers
  document.querySelectorAll(".icon[data-launch]").forEach(icon => {
    icon.addEventListener("click", e => {
      e.preventDefault();
      openApp(icon.dataset.launch);
    });
  });

  // Keypress X closes active
  document.addEventListener("keydown", e => {
    if ((e.key === "x" || e.key === "X") && activeAppId) closeApp(activeAppId);
  });

  // ore 
  function openApp(id) {
    const app = apps.get(id);
    if (!app) return;

    // If already open, just bring front
    if (openQueue.includes(id)) {
      show(id);
      bringToFront(app.win);
      return;
    }

    // create task button
    const btn = document.createElement("button");
    btn.className = "button task-btn";
    btn.textContent = app.title;
    btn.addEventListener("click", () => toggle(id));
    taskbar.appendChild(btn);
    app.taskBtn = btn;
    openQueue.push(id);

    show(id);
    bringToFront(app.win);
    activeAppId = id;
  }

  function minimize(id) {
    const app = apps.get(id);
    if (!app) return;
    app.win.classList.add("is-hidden");
  }

  function closeApp(id) {
    const app = apps.get(id);
    if (!app) return;
    app.win.classList.add("is-hidden");
    if (app.taskBtn) {
      taskbar.removeChild(app.taskBtn);
      app.taskBtn = null;
    }
    const idx = openQueue.indexOf(id);
    if (idx !== -1) openQueue.splice(idx, 1);
    if (activeAppId === id) activeAppId = null;
  }

  function toggle(id) {
    const app = apps.get(id);
    if (!app) return;
    app.win.classList.contains("is-hidden") ? show(id) : minimize(id);
    activeAppId = id;
  }

  function show(id) {
    const app = apps.get(id);
    if (!app) return;
    app.win.classList.remove("is-hidden");
    bringToFront(app.win);
  }

  function bringToFront(win) {
    const maxZ = Math.max(
      0,
      ...Array.from(document.querySelectorAll(".window.app")).map(
        w => parseInt(getComputedStyle(w).zIndex || 0, 10)
      )
    );
    win.style.zIndex = maxZ + 1;
  }

  function toggleMaximize(win) {
    if (win.dataset.maximized === "1") {
      win.style.top = win.dataset.top;
      win.style.left = win.dataset.left;
      win.style.width = win.dataset.width;
      win.style.height = win.dataset.height;
      win.dataset.maximized = "0";
    } else {
      win.dataset.top = win.style.top;
      win.dataset.left = win.style.left;
      win.dataset.width = win.style.width;
      win.dataset.height = win.style.height;
      win.style.top = "8px";
      win.style.left = "8px";
      win.style.width = "calc(100vw - 16px)";
      win.style.height = "calc(100vh - 42px)";
      win.dataset.maximized = "1";
    }
  }

  function enableDrag(win, handle, onStartFocus) {
    let offsetX = 0, offsetY = 0, dragging = false;
    handle.addEventListener("mousedown", e => {
      if (e.target.closest(".title-bar-controls")) return;
      dragging = true;
      onStartFocus?.();
      offsetX = e.clientX - win.offsetLeft;
      offsetY = e.clientY - win.offsetTop;
      document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", e => {
      if (!dragging) return;
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
});
