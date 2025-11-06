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
          role: 'Software Engineer (Infotainment Audio)',
          period: 'Nov 2025 - Current',
          unread: true,
          bullets: [
            'Working on the Infotainment Audio team, developing everything related to Audio in the different RW vehicles',

          ]
        },
     
        // Resume ground truth (reverse-chronological)
        {
          id: 'w-metalenz',
          company: 'Metalenz Inc.',
          role: 'Embedded Systems Engineer',
          period: 'Jun 2024 – October 2025 • Boston, MA',
          location: 'Boston, MA',
          bullets: [
            'Led embedded development for Polar-ID, a polarization-based biometric system on AOSP.',
            'Brought up polarization sensor, VCSEL, and other drivers Linux drivers.',
            'Integrated polarized based imaging pipelines into CamX; optimized inference on DSP with SIMD/parallelism.',
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
  // ---------- Contact (card + quick actions) ----------
WM.registerApp({
  id: 'contact',
  title: 'Contact',
  icon: 'assets/address_book.png', // fallback icon below if you don't have this
  template: '#tpl-contact',
  init(rootEl) {
    // --- Your contact data (fill what you have; blanks are auto-hidden) ---
    const info = {
      name: 'Pedro Amarante',
      title: 'Software Engineer — Infotainment Audio',
      company: 'Rivian & Volkswagen Group Technologies, LLC',
      email: 'ppedrolia@gmail.com',
      location: 'Palo Alto, CA',
      website: 'https://pedroamarante.com',
      linkedin: 'https://www.linkedin.com/in/pedro-amarante-8910b4240/',

                        
    };

    // Wire values into the UI; hide empty rows/links
    function fill(sel, value, formatter = (v)=>v) {
      const el = rootEl.querySelector(sel);
      if (!el) return;
      if (!value) { el.closest('[data-hide-if-empty]')?.remove(); return; }
      el.textContent = formatter(value);
      if (el.tagName === 'A') el.href = value;
    }

    fill('[data-f="name"]', info.name);
    fill('[data-f="title"]', info.title);
    fill('[data-f="company"]', info.company);
    fill('[data-f="email"]', info.email);
    fill('[data-f="phone"]', info.phone);
    fill('[data-f="loc"]', info.location);
    fill('[data-f="site"]', info.website, v => (rootEl.querySelector('[data-f="site"]').href = v, new URL(v).host));
    fill('[data-f="li"]', info.linkedin, v => (rootEl.querySelector('[data-f="li"]').href = v, 'LinkedIn'));
    fill('[data-f="gh"]', info.github, v => (rootEl.querySelector('[data-f="gh"]').href = v, 'GitHub'));
    fill('[data-f="note"]', info.note);

    // Mailto button
    rootEl.querySelector('[data-act="email"]')?.addEventListener('click', () => {
      if (info.email) location.href = `mailto:${encodeURIComponent(info.email)}?subject=${encodeURIComponent('Hello Pedro')}`;
    });

    // Copy helpers
    function copy(text) {
      if (!text) return;
      navigator.clipboard?.writeText(text).then(() => {
        flash('Copied!');
      }).catch(() => {
        flash('Copy failed');
      });
    }
    rootEl.querySelector('[data-act="copy-email"]')?.addEventListener('click', () => copy(info.email));
    rootEl.querySelector('[data-act="copy-phone"]')?.addEventListener('click', () => copy(info.phone));

    // vCard download
    rootEl.querySelector('[data-act="vcard"]')?.addEventListener('click', () => {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${info.name || ''}`,
        `ORG:${info.company || ''}`,
        `TITLE:${info.title || ''}`,
        info.email ? `EMAIL;TYPE=INTERNET:${info.email}` : '',
        info.phone ? `TEL;TYPE=CELL:${info.phone}` : '',
        info.location ? `ADR;TYPE=HOME:;;${info.location.replace(/,/g,';')}` : '',
        info.website ? `URL:${info.website}` : '',
        info.linkedin ? `X-SOCIALPROFILE;type=linkedin:${info.linkedin}` : '',
        info.github ? `X-SOCIALPROFILE;type=github:${info.github}` : '',
        info.note ? `NOTE:${info.note}` : '',
        'END:VCARD'
      ].filter(Boolean).join('\r\n');

      const blob = new Blob([lines], { type: 'text/vcard' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (info.name || 'contact') + '.vcf';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    });

    // Tiny toast
    function flash(text) {
      let t = rootEl.querySelector('.contact-toast');
      if (!t) {
        t = document.createElement('div');
        t.className = 'contact-toast';
        rootEl.appendChild(t);
      }
      t.textContent = text;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 1200);
    }

    // Fallback icon if missing
    const meta = rootEl.closest('.window.app');
    if (meta && !meta.dataset.icon) meta.dataset.icon = 'assets/0096 - Mail.ico';
  }
});

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
