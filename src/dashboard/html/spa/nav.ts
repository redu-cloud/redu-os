import { TOPNAV } from "../shared.js";

export const spaNav = `
  ${TOPNAV}

  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-section">
        <span class="sidebar-label">reduOS</span>
        <button class="nav-item active" data-page="overview">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
          Overview
        </button>
        <button class="nav-item" data-page="events">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v3.75L10.5 10"/></svg>
          Events
        </button>
        <button class="nav-item" data-page="insights">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="7" r="4.5"/><path d="M6.5 11.5 8 15l1.5-3.5M5 9.5l-2.5 2M11 9.5l2.5 2"/></svg>
          Insights
        </button>
        <button class="nav-item" data-page="actions">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8l10-5-5 10-1.5-4.5L3 8z"/></svg>
          Actions
        </button>
        <button class="nav-item" data-page="memory">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="8" cy="5" rx="5.5" ry="2.5"/><path d="M2.5 5v3c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5V5"/><path d="M2.5 8v3c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5V8"/></svg>
          Memory
        </button>
        <button class="nav-item" data-page="agents">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="12" height="9" rx="2"/><path d="M5 5V4a3 3 0 0 1 6 0v1M6 10h.01M10 10h.01"/></svg>
          Agents
        </button>
        <button class="nav-item" data-page="integrations">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3.5 13 8l-4 4.5M7 3.5 3 8l4 4.5"/></svg>
          Integrations
        </button>
        <button class="nav-item" data-page="ai-config">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
          AI Config
        </button>
        <button class="nav-item" data-page="notifications">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1a5 5 0 0 1 5 5v2.5l1.5 2H1.5L3 8.5V6a5 5 0 0 1 5-5zM6.5 13a1.5 1.5 0 0 0 3 0"/></svg>
          Notifications
        </button>
        <button class="nav-item" data-page="feedback">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 10V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5l-3 3V10z"/></svg>
          Feedback
        </button>
        <button class="nav-item" data-page="settings">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06"/></svg>
          Settings
        </button>
        <button class="nav-item" data-page="logs">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 5.5h6M5 8h6M5 10.5h4"/></svg>
          Logs
        </button>
      </div>
      <div class="sidebar-footer">
        <button class="sign-out-btn" id="sidebar-signout">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3m3-11 4 4-4 4m4-4H6"/></svg>
          Sign Out
        </button>
      </div>
    </aside>

    <!-- Content -->
    <main class="main-content">
      <div id="page-content" class="page-loading">
        <div class="spin"></div> Loading&hellip;
      </div>
    </main>
  </div>`;

export const spaRouter = `
    /* ─── router ─────────────────────────────────────────── */
    const VALID = new Set(['overview','events','insights','actions','memory','agents','integrations','ai-config','notifications','feedback','settings','logs']);
    let CUR = 'overview';

    // Filter state — snapshot before renderPage clears the DOM so page
    // functions can still read the selected values via fv(key).
    let _filters = {};
    function fv(key) { return _filters[key] || ''; }
    window.fv = fv;

    function go(page) {
      if (!VALID.has(page)) page='overview';
      // Snapshot current filter values BEFORE clearing the DOM
      document.querySelectorAll('[data-filter]').forEach(e => { _filters[e.dataset.filter] = e.value; });
      CUR = page;
      window.history.pushState(null,'','#'+page);
      activate(page);
      renderPage(page);
      if(window.umami) window.umami.track('pageview',{url:'/#'+page,title:page});
    }
    window.go = go;

    function activate(page) {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page===page));
    }

    async function renderPage(page) {
      const el = $('page-content');
      // logs page takes full viewport height — skip the page-loading wrapper
      el.className = page === 'logs' ? '' : 'page-loading';
      el.innerHTML = page === 'logs' ? '' : '<div class="spin"></div> Loading…';
      // main-content: overflow hidden for logs, auto for everything else
      document.querySelector('.main-content').style.overflow = page === 'logs' ? 'hidden' : '';
      try {
        const html = await PAGES[page]();
        el.className = '';
        el.innerHTML = html;
        BIND[page]&&BIND[page]();
      } catch(e) {
        el.className = 'page-wrap';
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Error loading page</div><div class="empty-desc">'+esc(e.message)+'</div><button class="btn btn-sm" style="margin-top:12px" onclick="renderPage(&apos;'+page+'&apos;)">Retry</button></div>';
      }
    }`;
