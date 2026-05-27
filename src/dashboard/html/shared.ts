export const GITHUB_URL = "https://github.com/redu-cloud/redu-os";
export const DEPLOY_URL = "https://redu.cloud";

export const GH_ICON = String.raw`<svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

export const TOPNAV_CSS = `
    /* ── Top nav ── */
    .topnav {
      height: 54px;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 9px;
      text-decoration: none;
      flex-shrink: 0;
    }
    .brand-mark {
      width: 28px;
      height: 28px;
      background: #6366f1;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 800;
      color: #fff;
      flex-shrink: 0;
      font-family: ui-monospace, monospace;
    }
    .brand-name {
      font-size: 15px;
      font-weight: 700;
      color: #f1f5f9;
      letter-spacing: -0.3px;
    }
    .oss-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      border: 1px solid #334155;
      border-radius: 4px;
      padding: 2px 6px;
    }
    /* Live SSE indicator */
    .live-dot {
      display: none;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.4px;
      color: #22c55e;
      text-transform: uppercase;
    }
    .live-dot.visible { display: flex; }
    .live-dot::before {
      content: '';
      width: 6px;
      height: 6px;
      background: #22c55e;
      border-radius: 50%;
      animation: livepulse 2s cubic-bezier(.4,0,.6,1) infinite;
      flex-shrink: 0;
    }
    @keyframes livepulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    .nav-ctas {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    /* Theme toggle button */
    .theme-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: transparent;
      border: 1px solid #334155;
      border-radius: 7px;
      cursor: pointer;
      color: #94a3b8;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
      padding: 0;
    }
    .theme-btn:hover { background: #1e293b; color: #e2e8f0; }
    /* sun = shown in dark mode; moon = shown in light mode */
    .icon-sun { display: none; }
    .icon-moon { display: block; }
    [data-theme="dark"] .icon-sun { display: block; }
    [data-theme="dark"] .icon-moon { display: none; }
    .gh-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      background: #21262d;
      color: #e6edf3;
      border: 1px solid #30363d;
      border-radius: 6px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .gh-btn:hover { background: #30363d; border-color: #484f58; }
    .deploy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 14px;
      background: #6366f1;
      color: #fff;
      border: 1px solid #6366f1;
      border-radius: 6px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .deploy-btn:hover { background: #4f46e5; border-color: #4f46e5; }`;

export const TOPNAV = `
  <nav class="topnav">
    <a href="/" class="brand">
      <div class="brand-mark">r</div>
      <span class="brand-name">reduOS</span>
      <span class="oss-badge">open source</span>
      <span class="live-dot" id="sse-live-dot">Live</span>
    </a>
    <div class="nav-ctas">
      <button class="theme-btn" id="theme-toggle" aria-label="Toggle dark mode" title="Toggle dark mode">
        <svg class="icon-moon" viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
        </svg>
        <svg class="icon-sun" viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
          <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
        </svg>
      </button>
      <a href="${GITHUB_URL}" class="gh-btn" target="_blank" rel="noreferrer">
        ${GH_ICON}
        Star on GitHub
      </a>
      <a href="${DEPLOY_URL}" class="deploy-btn" target="_blank" rel="noreferrer">
        Deploy on redu.cloud
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h7M6.5 3l3 3-3 3"/></svg>
      </a>
    </div>
  </nav>`;
