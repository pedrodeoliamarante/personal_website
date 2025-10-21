/* js/apps/index.js
 * App registry: About, Notepad, Work Experience (email-style)
 * Requires: windowManager.js (WM)
 */

(function () {
  'use strict';

  if (!window.WM) {
    console.error('[apps] WM not found. Load js/core/windowManager.js first.');
    return;
  }

  // ---------- About ----------
  WM.registerApp({
    id: 'about',
    title: 'About Me',
    icon: 'assets/0047 - Text Document.ico',
    template: '#tpl-about',
    onOpen(rootEl) {
      rootEl.querySelector('a,button,[tabindex],input,textarea,select')?.focus();
    }
  });

  // ---------- Notepad ----------
  WM.registerApp({
    id: 'notepad',
    title: 'Notepad',
    icon: 'assets/0199 - Notepad.ico',
    template: '#tpl-notepad',
    init(rootEl) {
      const ta = rootEl.querySelector('textarea');
      const KEY = 'app:notepad:value';
      if (ta) {
        ta.value = localStorage.getItem(KEY) || ta.value || '';
        ta.addEventListener('input', () => localStorage.setItem(KEY, ta.value));
      }
    },
    onOpen(rootEl) { rootEl.querySelector('textarea')?.focus(); }
  });

  // ---------- Work (email-style client) ----------
  WM.registerApp({
    id: 'work',
    title: 'Work Experience',
    icon: 'assets/0096 - Mail.ico',
    template: '#tpl-work',
    init(rootEl) {
      // === Data from resume + upcoming roles ===
      const threads = [
        // New / upcoming roles at the top like unread emails
        {
          id: 'w-rivian',
          company: 'Rivian & Volkswagen Group Technologies, LLC',
          role: 'Software Engineer (Embedded Systems / Firmware)',
          period: 'Starting Nov 2025 • Palo Alto, CA (upcoming)',
          unread: true,
          tags: ['upcoming'],
          bullets: [
            'Offer accepted; role start planned for November 2025.',
          ]
        },
     
        // Resume ground truth (reverse-chronological)
        {
          id: 'w-metalenz',
          company: 'Metalenz Inc.',
          role: 'Embedded Systems Engineer',
          period: 'Jun 2024 – Present • Boston, MA',
          location: 'Boston, MA',
          bullets: [
            'Led embedded development for Polar-ID, a polarization-based biometric system on AOSP.',
            'Brought up polarization sensor, VCSEL, and ToF driver via MIPI-CSI and Linux drivers.',
            'Integrated biometric pipelines into CamX; optimized inference on DSP with SIMD/parallelism.',
            'Validated the optical stack with scopes, logic analyzers, ADC probes, and kernel tooling.',
            'Built eBPF tracing to track latency and drops; tuned power, clocks, and sensor states.',
            'Extended SM8550 BSP; enabled secure boot and TrustZone binaries (QTEE).',
            'Implemented AOSP Biometrics HAL and TEE apps to manage secure keys and data.',
          ]
        },
        {
          id: 'w-remotelab',
          company: 'Remote Hub Lab',
          role: 'Research Assistant',
          period: 'Mar 2023 – Jun 2024 • Seattle, WA',
          bullets: [
            'Built hardware-in-the-loop simulation platform for remote electronics labs.',
            'Developed FreeRTOS C++ for RP2040 to emulate circuits with FPGA interfaces.',
            'Delivered secure multi-user experiments with low-latency camera streaming.',
            'Created modular remote SDR lab using Pi 4 and ADALM-PLUTO with GNU Radio.',
          ]
        },
        {
          id: 'w-uwta',
          company: 'Paul G. Allen School, UW',
          role: 'Teaching Assistant',
          period: 'Dec 2022 – Jun 2024 • Seattle, WA',
          bullets: [
            'Led systems programming labs (C/C++, memory, OS, concurrency).',
            'Assisted embedded systems (RTOS, microcontrollers) and digital logic courses.',
            'Supported students with tooling, debugging workflows, and labs.',
          ]
        }
      ];

      // Render mail UI inside the Work window
      renderMailUI(rootEl, threads);
      wireMailUI(rootEl);
    }
  });

  // ================= Mail UI (Work app) =================

  function renderMailUI(root, threads) {
    // Clear the Work template’s old layout and rebuild as “mail client”
    const body = root.querySelector('.window-body');
    if (!body) return;
    body.innerHTML = `
      <div class="mail-toolbar">
        <div class="mail-title">Inbox — Work Experience</div>
        <div class="mail-actions">
          <button class="btn ghost" data-act="mark-read">Mark as read</button>
          <button class="btn ghost" data-act="mark-unread">Mark as unread</button>
        </div>
      </div>
      <div class="mail-layout">
        <aside class="mail-list" aria-label="Thread list"></aside>
        <section class="mail-pane" aria-label="Reader"></section>
      </div>
    `;

    const listEl = body.querySelector('.mail-list');
    const paneEl = body.querySelector('.mail-pane');

    // Build list
    listEl.innerHTML = threads.map((t, idx) => mailItemHTML(t, idx === 0)).join('');

    // Build initial pane for first item
    const first = threads[0];
    paneEl.innerHTML = mailPaneHTML(first);

    // Keep data on the element for interactions
    body._threads = threads;
  }

  function mailItemHTML(t, selected) {
    const preview = (t.bullets?.[0] || '').slice(0, 110);
    const unreadClass = t.unread ? 'is-unread' : '';
    const selClass = selected ? 'is-selected' : '';
    const tags = (t.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');
    return `
      <article class="mail-item ${unreadClass} ${selClass}" tabindex="0" data-id="${t.id}">
        <div class="mail-item-top">
          <span class="mail-from">${escapeHtml(t.company)}</span>
          <span class="mail-date">${escapeHtml(t.period)}</span>
        </div>
        <div class="mail-subject">${escapeHtml(t.role)}</div>
        <div class="mail-snippet">${escapeHtml(preview)}${t.bullets?.[0]?.length > 110 ? '…' : ''}</div>
        <div class="mail-tags">${tags}</div>
      </article>
    `;
  }

  function mailPaneHTML(t) {
    const bullets = (t.bullets || []).map(s => `<li>${escapeHtml(s)}</li>`).join('');
    return `
      <header class="mail-header">
        <div class="mail-subject-lg">${escapeHtml(t.role)}</div>
        <div class="mail-meta">
          <div><strong>From:</strong> ${escapeHtml(t.company)}</div>
          <div><strong>Date:</strong> ${escapeHtml(t.period)}</div>
        </div>
      </header>
      <div class="mail-content">
        ${bullets ? `<ul class="mail-bullets">${bullets}</ul>` : '<p>No details yet.</p>'}
      </div>
    `;
  }

  function wireMailUI(root) {
    const body = root.querySelector('.window-body');
    const listEl = body.querySelector('.mail-list');
    const paneEl = body.querySelector('.mail-pane');
    const threads = body._threads || [];

    // Click/keyboard selection
    listEl.addEventListener('click', (e) => {
      const item = e.target.closest('.mail-item');
      if (!item) return;
      selectItem(item.dataset.id);
    });
    listEl.addEventListener('keydown', (e) => {
      const items = Array.from(listEl.querySelectorAll('.mail-item'));
      const idx = items.findIndex(i => i.classList.contains('is-selected'));
      if (e.key === 'ArrowDown' && idx < items.length - 1) {
        items[idx + 1]?.focus(); items[idx + 1]?.click(); e.preventDefault();
      }
      if (e.key === 'ArrowUp' && idx > 0) {
        items[idx - 1]?.focus(); items[idx - 1]?.click(); e.preventDefault();
      }
    });

    function selectItem(id) {
      const item = listEl.querySelector(`.mail-item[data-id="${id}"]`);
      if (!item) return;
      listEl.querySelectorAll('.mail-item').forEach(i => i.classList.remove('is-selected'));
      item.classList.add('is-selected');

      const t = threads.find(x => x.id === id);
      if (t) {
        paneEl.innerHTML = mailPaneHTML(t);
        // mark read
        item.classList.remove('is-unread');
        t.unread = false;
      }
    }

    // Toolbar actions
    root.querySelector('[data-act="mark-read"]')?.addEventListener('click', () => {
      listEl.querySelectorAll('.mail-item.is-selected, .mail-item:focus').forEach(i => i.classList.remove('is-unread'));
      threads.forEach(t => { if (isSelected(t.id)) t.unread = false; });
    });
    root.querySelector('[data-act="mark-unread"]')?.addEventListener('click', () => {
      listEl.querySelectorAll('.mail-item.is-selected, .mail-item:focus').forEach(i => i.classList.add('is-unread'));
      threads.forEach(t => { if (isSelected(t.id)) t.unread = true; });
    });

    function isSelected(id) {
      return listEl.querySelector(`.mail-item[data-id="${id}"]`)?.classList.contains('is-selected');
    }
  }

  // ================= utils =================
  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

})();
