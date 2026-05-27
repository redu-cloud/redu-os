import { TOPNAV_CSS } from "../shared.js";

export const spaStyles = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#f1f5f9;--panel:#fff;--ink:#0f172a;--ink-2:#1e293b;
      --muted:#64748b;--muted-2:#94a3b8;--line:#e2e8f0;
      --indigo:#6366f1;--indigo-dark:#4f46e5;--indigo-light:#eef2ff;
      --green:#16a34a;--green-bg:#dcfce7;--green-text:#166534;
      --red:#dc2626;--red-bg:#fee2e2;--red-text:#991b1b;
      --amber:#d97706;--amber-bg:#fef3c7;--amber-text:#92400e;
      --blue-bg:#dbeafe;--blue-text:#1e40af;
      --violet-bg:#ede9fe;--violet-text:#5b21b6;
      --shadow-xs:0 1px 2px rgba(15,23,42,.05);
      --shadow-sm:0 1px 3px rgba(15,23,42,.08),0 1px 2px rgba(15,23,42,.05);
      --nav-w:220px;--topnav-h:54px;
    }
    html,body{height:100%}
    body{background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.5}

    ${TOPNAV_CSS}

    /* APP SHELL */
    .app-shell{display:flex;height:calc(100vh - var(--topnav-h))}

    /* SIDEBAR */
    .sidebar{width:var(--nav-w);flex-shrink:0;background:#0f172a;border-right:1px solid #1e293b;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;position:sticky;top:var(--topnav-h);height:calc(100vh - var(--topnav-h))}
    .sidebar-section{padding:16px 10px 6px}
    .sidebar-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#475569;padding:0 6px 6px;display:block}
    .nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;margin-bottom:1px;color:#94a3b8;font-size:13px;font-weight:500;text-decoration:none;cursor:pointer;transition:background .1s,color .1s;border:none;background:transparent;width:100%;text-align:left}
    .nav-item:hover{background:#1e293b;color:#e2e8f0}
    .nav-item.active{background:#1e3a5f;color:#fff;font-weight:600}
    .nav-item.active .nav-icon{color:var(--indigo)}
    .nav-icon{width:15px;height:15px;flex-shrink:0;color:#475569}
    .sidebar-footer{margin-top:auto;padding:12px 10px;border-top:1px solid #1e293b}
    .sign-out-btn{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;color:#64748b;font-size:13px;font-weight:500;cursor:pointer;border:none;background:transparent;width:100%;transition:background .1s,color .1s}
    .sign-out-btn:hover{background:#1e293b;color:#e2e8f0}

    /* MAIN */
    .main-content{flex:1;overflow-y:auto;overflow-x:hidden;min-height:0}
    .page-wrap{padding:24px 28px 48px;max-width:1280px}
    .page-head{margin-bottom:20px}
    .page-title{font-size:20px;font-weight:700;letter-spacing:-.3px;color:var(--ink)}
    .page-sub{font-size:13px;color:var(--muted);margin-top:3px;line-height:1.5}

    /* BUTTONS */
    .btn{display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 13px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--ink-2);font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .12s,border-color .12s}
    .btn:hover{background:var(--bg);border-color:#cbd5e1}
    .btn:disabled{opacity:.5;cursor:wait}
    .btn-sm{height:28px;padding:0 10px;font-size:12px}
    .btn-primary{background:var(--ink);border-color:var(--ink);color:#fff}
    .btn-primary:hover{opacity:.84;background:var(--ink)}
    .btn-indigo{background:var(--indigo);border-color:var(--indigo);color:#fff}
    .btn-indigo:hover{background:var(--indigo-dark);border-color:var(--indigo-dark)}
    .btn-ghost{background:transparent;border-color:transparent;color:var(--muted)}
    .btn-ghost:hover{background:var(--bg);border-color:var(--line);color:var(--ink)}
    .btn-danger{background:#fff;border-color:#fca5a5;color:var(--red)}
    .btn-danger:hover{background:var(--red-bg)}
    .btn-success{background:#fff;border-color:#86efac;color:var(--green)}
    .btn-success:hover{background:var(--green-bg)}

    /* CARDS */
    .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow-xs);overflow:hidden}
    .card+.card{margin-top:14px}
    .card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;border-bottom:1px solid var(--line);background:#fafbfd}
    .card-title{font-size:12px;font-weight:700;color:var(--ink-2);text-transform:uppercase;letter-spacing:.4px}
    .card-actions{display:flex;align-items:center;gap:6px}
    .card-body{padding:16px}
    .card-desc{font-size:13px;color:var(--muted);line-height:1.6}

    /* METRICS */
    .metrics-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:20px}
    .metric-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;box-shadow:var(--shadow-xs)}
    .metric-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:7px}
    .metric-value{font-size:28px;font-weight:800;letter-spacing:-.6px;color:var(--ink);line-height:1}
    .metric-desc{font-size:11px;color:var(--muted-2);margin-top:4px}

    /* BADGES */
    .badge{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
    .badge-default{background:var(--indigo-light);color:#3730a3}
    .badge-critical,.badge-high{background:var(--red-bg);color:var(--red-text)}
    .badge-medium{background:var(--amber-bg);color:var(--amber-text)}
    .badge-low,.badge-info,.badge-debug{background:var(--green-bg);color:var(--green-text)}
    .badge-completed,.badge-ready_for_automation,.badge-ok{background:var(--green-bg);color:var(--green-text)}
    .badge-failed,.badge-down,.badge-error{background:var(--red-bg);color:var(--red-text)}
    .badge-pending_approval,.badge-pending{background:var(--amber-bg);color:var(--amber-text)}
    .badge-recommended,.badge-suggested,.badge-active{background:var(--indigo-light);color:#3730a3}
    .badge-approved{background:var(--blue-bg);color:var(--blue-text)}
    .badge-rejected,.badge-disabled,.badge-offline{background:#f3f4f6;color:#6b7280}
    .badge-optional{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
    .badge-connected{background:var(--green-bg);color:var(--green-text)}

    /* DOT */
    .dot{display:inline-block;width:7px;height:7px;border-radius:50%}
    .dot-ok{background:var(--green)}
    .dot-bad{background:var(--red)}
    .dot-warn{background:var(--amber)}
    .dot-lg{width:10px;height:10px}

    /* TABLES */
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);background:#fafbfd;white-space:nowrap}
    td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;overflow-wrap:anywhere}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#fafbfd}
    .td-muted{color:var(--muted);font-size:12px}
    .td-mono{font-family:ui-monospace,monospace;font-size:11px}
    .td-fw{font-weight:600}

    /* TIMELINE */
    .timeline{display:grid;gap:0}
    .tl-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
    .tl-item:last-child{border-bottom:none}
    .tl-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}
    .tl-event{background:#6366f1}
    .tl-insight{background:#0ea5e9}
    .tl-action{background:#16a34a}
    .tl-feedback{background:#d97706}
    .tl-meta{font-size:11px;color:var(--muted-2);margin-top:2px}

    /* EMPTY STATE */
    .empty-state{padding:40px 20px;text-align:center;color:var(--muted);font-size:13px}
    .empty-icon{font-size:28px;margin-bottom:12px}
    .empty-title{font-weight:700;color:var(--ink-2);font-size:15px;margin-bottom:6px}
    .empty-desc{color:var(--muted);line-height:1.6;max-width:340px;margin:0 auto}

    /* LOADING */
    .page-loading{display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--muted);font-size:13px;gap:8px}
    .spin{width:16px;height:16px;border:2px solid var(--line);border-top-color:var(--indigo);border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
    @keyframes spin{to{transform:rotate(360deg)}}

    /* OVERVIEW */
    .overview-hero{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-shadow:var(--shadow-xs)}
    .hero-status{display:flex;align-items:center;gap:10px}
    .hero-status h1{font-size:16px;font-weight:700;color:var(--ink)}
    .loop-viz{font-family:ui-monospace,monospace;font-size:12px;font-weight:700;color:var(--indigo);letter-spacing:.1px;white-space:nowrap}

    /* TWO-COL */
    .two-col{display:grid;grid-template-columns:minmax(0,1.4fr) 320px;gap:16px;align-items:start}

    /* ATTENTION */
    .att-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13px}
    .att-item:last-child{border-bottom:none}

    /* EVENT LOOP DETAIL */
    .event-loop{background:#f8fafc;border-left:3px solid var(--indigo);padding:14px 16px}
    .loop-step{display:flex;gap:10px;align-items:flex-start;margin-bottom:10px}
    .loop-step:last-child{margin-bottom:0}
    .loop-num{width:20px;height:20px;border-radius:50%;background:var(--indigo);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
    .loop-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:2px}
    .loop-body{font-size:13px;color:var(--ink-2);line-height:1.5}
    .loop-empty{font-size:12px;color:var(--muted-2);font-style:italic}

    /* AGENTS */
    .agents-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .agent-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px;box-shadow:var(--shadow-xs)}
    .agent-name{font-size:14px;font-weight:700;color:var(--ink);margin-bottom:4px}
    .agent-desc{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px}
    .agent-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);padding:3px 0}
    .agent-val{font-weight:600;color:var(--ink-2)}

    /* INTEGRATIONS */
    .int-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:24px}
    .int-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;box-shadow:var(--shadow-xs)}
    .int-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .int-name{font-size:13px;font-weight:700;color:var(--ink)}
    .int-webhook{font-family:ui-monospace,monospace;font-size:11px;color:var(--muted);background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:4px 8px;margin:6px 0;word-break:break-all}
    .int-footer{display:flex;gap:6px;margin-top:8px}

    /* CONFIG */
    .config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .config-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;gap:12px}
    .config-row:last-child{border-bottom:none}
    .config-key{color:var(--muted);flex-shrink:0}
    .config-val{font-weight:600;color:var(--ink-2);font-family:ui-monospace,monospace;font-size:12px;text-align:right;word-break:break-all}

    /* FILTERS */
    .filter-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
    .filter-select{height:32px;padding:0 10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:13px;background:#fff;color:var(--ink);outline:none}
    .filter-select:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(99,102,241,.12)}

    /* MEMORY */
    .search-row{display:flex;gap:8px;margin-bottom:12px}
    .search-input{flex:1;height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;font:inherit;font-size:13px;color:var(--ink);outline:none}
    .search-input:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(99,102,241,.12)}
    .example-queries{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
    .example-q{padding:4px 10px;border:1px solid var(--line);border-radius:999px;font-size:12px;color:var(--muted);cursor:pointer;background:var(--panel);transition:background .1s,border-color .1s,color .1s}
    .example-q:hover{background:var(--indigo-light);border-color:var(--indigo);color:var(--indigo-dark)}
    .mem-result{border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin-bottom:8px}
    .mem-score{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}

    /* LANGGRAPH FORM */
    .lg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
    .lg-field{display:grid;gap:4px;margin-bottom:10px}
    .field-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted)}
    .lg-select{height:36px;padding:0 10px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:13px;background:#fff;color:var(--ink);outline:none}
    .lg-select:focus{border-color:var(--indigo)}
    .lg-input{height:36px;padding:0 11px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:13px;color:var(--ink);outline:none}
    .lg-input:focus{border-color:var(--indigo)}
    .lg-textarea{width:100%;min-height:72px;padding:8px 11px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-size:13px;color:var(--ink);resize:vertical;outline:none}
    .lg-textarea:focus{border-color:var(--indigo)}
    .lg-toggles{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px}
    .lg-toggle{display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;user-select:none}

    /* FLAGS */
    .flags-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .flag-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between}
    .flag-name{font-size:13px;font-weight:600;color:var(--ink-2)}
    .flag-on{color:var(--green);font-size:11px;font-weight:700}
    .flag-off{color:var(--muted-2);font-size:11px;font-weight:700}

    /* LOG */
    .log-box{background:#0f172a;color:#94a3b8;border-radius:8px;padding:12px 14px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;max-height:280px;overflow:auto;border:1px solid #1e293b}

    /* RESPONSIVE */
    @media(max-width:1100px){.two-col{grid-template-columns:1fr}.int-grid{grid-template-columns:repeat(2,1fr)}.agents-grid{grid-template-columns:1fr}.metrics-grid{grid-template-columns:repeat(3,1fr)}.config-grid{grid-template-columns:1fr}}
    @media(max-width:768px){:root{--nav-w:0px}.sidebar{display:none}.metrics-grid{grid-template-columns:repeat(2,1fr)}.int-grid{grid-template-columns:1fr}.flags-grid{grid-template-columns:1fr}.page-wrap{padding:16px}.loop-viz{display:none}}

    /* ── DARK THEME ── */
    [data-theme="dark"] {
      --bg:#0d1117;--panel:#161b22;--ink:#e6edf3;--ink-2:#f0f6fc;
      --muted:#8b949e;--muted-2:#6e7681;--line:#21262d;
      --shadow-xs:0 1px 2px rgba(0,0,0,.4);
      --shadow-sm:0 1px 3px rgba(0,0,0,.5),0 1px 2px rgba(0,0,0,.4);
      --indigo-light:#1e2060;
      --green-bg:#0d2618;--green-text:#3fb950;
      --red-bg:#2d1117;--red-text:#f85149;
      --amber-bg:#2d1b00;--amber-text:#e3b341;
      --blue-bg:#051d4d;--blue-text:#79c0ff;
      --violet-bg:#1e1245;--violet-text:#d2a8ff;
    }
    /* ── Dark sidebar + topnav (strip the blue tint) ── */
    [data-theme="dark"] .topnav {
      background:#111111;
      border-bottom-color:#1f1f1f;
    }
    [data-theme="dark"] .sidebar {
      background:#111111;
      border-right-color:#1f1f1f;
    }
    [data-theme="dark"] .sidebar-footer { border-top-color:#1f1f1f; }
    [data-theme="dark"] .sidebar-label  { color:#3a3a3a; }
    [data-theme="dark"] .nav-item       { color:#6b7280; }
    [data-theme="dark"] .nav-item:hover { background:#1a1a1a; color:#e5e7eb; }
    /* Active: neutral dark bg + indigo left accent (VS Code style) */
    [data-theme="dark"] .nav-item.active {
      background:#1a1a1a;
      color:#fff;
      border-left:3px solid #6366f1;
      padding-left:7px;
      font-weight:600;
    }
    [data-theme="dark"] .nav-item.active .nav-icon { color:#6366f1; }
    [data-theme="dark"] .nav-icon        { color:#4b5563; }
    [data-theme="dark"] .sign-out-btn    { color:#4b5563; }
    [data-theme="dark"] .sign-out-btn:hover { background:#1a1a1a; color:#e5e7eb; }

    /* Regular btn in dark */
    [data-theme="dark"] .btn                      { background:var(--panel);border-color:#30363d;color:var(--ink-2); }
    [data-theme="dark"] .btn:hover                { background:#1c2128;border-color:#484f58; }
    /* ── btn-primary in dark: use indigo (declared AFTER .btn so it wins for .btn.btn-primary) ── */
    [data-theme="dark"] .btn-primary              { background:var(--indigo);border-color:var(--indigo);color:#fff; }
    [data-theme="dark"] .btn-primary:hover        { background:var(--indigo-dark);border-color:var(--indigo-dark);opacity:1; }

    /* Hardcoded-white elements that need dark overrides */
    [data-theme="dark"] .card-head,[data-theme="dark"] th { background:#1c2128; }
    [data-theme="dark"] tr:hover td { background:#1c2128; }
    [data-theme="dark"] td { border-bottom-color:var(--line); }
    [data-theme="dark"] .filter-select,
    [data-theme="dark"] .lg-select,
    [data-theme="dark"] .search-input,
    [data-theme="dark"] .lg-input,
    [data-theme="dark"] .lg-textarea { background:var(--panel);color:var(--ink);border-color:#30363d; }
    [data-theme="dark"] .filter-select:focus,
    [data-theme="dark"] .search-input:focus,
    [data-theme="dark"] .lg-input:focus,
    [data-theme="dark"] .lg-textarea:focus { border-color:var(--indigo);box-shadow:0 0 0 3px rgba(99,102,241,.2); }
    [data-theme="dark"] .event-loop { background:#1c2128; }
    [data-theme="dark"] .badge-default { background:#1e2060;color:#a5b4fc; }
    [data-theme="dark"] .example-q { background:var(--panel);border-color:var(--line);color:var(--muted); }
    [data-theme="dark"] .example-q:hover { background:#1e2060;border-color:var(--indigo);color:#a5b4fc; }
    [data-theme="dark"] .int-webhook { background:#0d1117;border-color:var(--line); }
    [data-theme="dark"] .mem-result { border-color:var(--line); }
    [data-theme="dark"] .citem:hover { background:#1c2128;border-color:var(--line); }
    [data-theme="dark"] .citem.active { background:#1e2060;border-color:#3730a3; }
    [data-theme="dark"] .log-sidebar,[data-theme="dark"] .log-sidebar-head { background:#0d1117;border-color:#21262d; }

    /* ── TIMELINE FLASH — new live event ── */
    @keyframes tl-flash {
      0%  { background:rgba(99,102,241,.18); }
      100%{ background:transparent; }
    }
    .tl-flash { animation:tl-flash 1.6s ease-out forwards; border-radius:6px; }

    /* ── EVENTS PAGE — new-event banner ── */
    .sse-banner {
      display:flex;align-items:center;gap:10px;
      padding:9px 16px;margin-bottom:12px;
      background:var(--indigo-light);border:1px solid var(--indigo);
      border-radius:8px;font-size:13px;font-weight:600;color:var(--indigo-dark);
      animation:fadeIn .3s ease;
    }
    [data-theme="dark"] .sse-banner { background:#1e2060;border-color:#4338ca;color:#a5b4fc; }
    .sse-banner-dot { width:7px;height:7px;background:#6366f1;border-radius:50%;animation:livepulse 1.5s infinite;flex-shrink:0; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }

    /* LOG VIEWER */
    .logs-shell{display:flex;height:calc(100vh - var(--topnav-h));overflow:hidden}
    .log-sidebar{width:240px;flex-shrink:0;background:var(--panel);border-right:1px solid var(--line);display:flex;flex-direction:column;overflow:hidden}
    .log-sidebar-head{padding:12px 14px;border-bottom:1px solid var(--line);font-size:12px;font-weight:700;color:var(--ink-2)}
    .log-sidebar-body{flex:1;overflow-y:auto;padding:10px 8px}
    .cgroup-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);padding:8px 6px 4px;display:block}
    .citem{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;cursor:pointer;border:1px solid transparent;margin-bottom:1px}
    .citem:hover{background:var(--bg);border-color:var(--line)}
    .citem.active{background:var(--indigo-light);border-color:#c7d2fe}
    .citem-name{font-size:12px;font-weight:600;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
    .citem-img{font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
    .log-main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#0d1117}
    .log-topbar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#161b22;border-bottom:1px solid #30363d;flex-shrink:0}
    .log-title{font-size:13px;font-weight:700;color:#e6edf3;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .log-input{background:#0d1117;border:1px solid #30363d;border-radius:5px;padding:4px 9px;color:#e6edf3;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;width:200px}
    .log-input::placeholder{color:#484f58}
    .log-select{background:#0d1117;border:1px solid #30363d;border-radius:5px;padding:4px 8px;color:#8b949e;font-size:12px}
    .log-btn{background:#21262d;border:1px solid #30363d;border-radius:5px;padding:4px 10px;color:#8b949e;font-size:12px;cursor:pointer}
    .log-btn:hover{background:#30363d;color:#e6edf3}
    .log-body{flex:1;overflow-y:auto;padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.55}
    .log-line{white-space:pre-wrap;word-break:break-all;padding:1px 0;color:#8b949e}
    .log-line.stderr{color:#ff7b72}
    .log-line.stdout{color:#e6edf3}
    .log-empty{padding:32px;text-align:center;color:#484f58;font-style:italic;font-size:13px}`;
