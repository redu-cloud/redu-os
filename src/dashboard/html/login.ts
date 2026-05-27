import { TOPNAV_CSS, TOPNAV, GH_ICON, GITHUB_URL, DEPLOY_URL } from "./shared.js";

export const loginHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>reduOS – Sign In</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%236366f1'/><text x='16' y='22' font-size='18' font-family='monospace' font-weight='bold' text-anchor='middle' fill='white'>r</text></svg>" />
  <!-- UMAMI_SCRIPT -->
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #f1f5f9;
      --panel: #fff;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --indigo: #6366f1;
      --indigo-dark: #4f46e5;
      --red: #dc2626;
    }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }

    ${TOPNAV_CSS}

    /* ── Page layout ── */
    .page {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      gap: 32px;
    }

    /* ── Hero ── */
    .hero {
      text-align: center;
      max-width: 480px;
    }
    .hero h1 {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.6px;
      color: var(--ink);
      margin-bottom: 10px;
    }
    .hero p {
      font-size: 15px;
      color: var(--muted);
      line-height: 1.65;
      margin-bottom: 22px;
    }
    .hero-flow {
      font-size: 13px;
      font-weight: 600;
      color: var(--indigo);
      letter-spacing: 0.1px;
      margin-bottom: 18px;
      font-family: ui-monospace, monospace;
    }
    .hero-pills {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 22px;
      font-size: 12px;
      color: var(--muted);
    }
    .hero-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 10px;
      background: var(--panel);
    }
    .hero-ctas {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .cta-gh {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 38px;
      padding: 0 16px;
      background: var(--ink);
      color: #fff;
      border: 1px solid var(--ink);
      border-radius: 7px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .cta-gh:hover { opacity: 0.82; }
    .cta-deploy {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 38px;
      padding: 0 18px;
      background: var(--indigo);
      color: #fff;
      border: 1px solid var(--indigo);
      border-radius: 7px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
    }
    .cta-deploy:hover { background: var(--indigo-dark); border-color: var(--indigo-dark); }

    /* ── Login card ── */
    .login-card {
      width: min(380px, 100%);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(15,23,42,.06), 0 4px 16px rgba(15,23,42,.04);
      overflow: hidden;
    }
    .card-header {
      padding: 22px 24px 0;
    }
    .card-header h2 {
      font-size: 17px;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 4px;
    }
    .card-header p {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 20px;
    }
    .card-body { padding: 0 24px 24px; }
    .field { margin-bottom: 14px; }
    label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--muted);
      margin-bottom: 5px;
    }
    input[type="email"],
    input[type="password"] {
      width: 100%;
      height: 40px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      padding: 0 12px;
      font: inherit;
      font-size: 14px;
      color: var(--ink);
      background: #fff;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus {
      border-color: var(--indigo);
      box-shadow: 0 0 0 3px rgba(99,102,241,.12);
    }
    .submit-btn {
      width: 100%;
      height: 40px;
      margin-top: 6px;
      background: var(--ink);
      color: #fff;
      border: none;
      border-radius: 7px;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .submit-btn:disabled { opacity: 0.55; cursor: wait; }
    .submit-btn:hover:not(:disabled) { opacity: 0.84; }
    .error-msg {
      min-height: 18px;
      margin-top: 10px;
      color: var(--red);
      font-size: 13px;
    }

    /* ── Footer ── */
    footer {
      text-align: center;
      padding: 18px 24px;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid var(--line);
    }
    footer a { color: #94a3b8; text-decoration: underline; text-underline-offset: 2px; }
    footer a:hover { color: var(--muted); }

    @media (max-width: 480px) {
      .hero h1 { font-size: 24px; }
      .oss-badge { display: none; }
    }

    /* ── Dark theme ── */
    [data-theme="dark"] {
      --bg: #0d1117;
      --panel: #161b22;
      --ink: #e6edf3;
      --muted: #8b949e;
      --line: #21262d;
    }
    [data-theme="dark"] body { background: var(--bg); color: var(--ink); }
    [data-theme="dark"] .login-card { background: var(--panel); border-color: var(--line); }
    [data-theme="dark"] .card-header h2 { color: var(--ink); }
    [data-theme="dark"] .card-header p { color: var(--muted); }
    [data-theme="dark"] input[type="email"],
    [data-theme="dark"] input[type="password"] {
      background: #0d1117; color: var(--ink);
      border-color: #30363d;
    }
    [data-theme="dark"] input:focus { border-color: var(--indigo); box-shadow: 0 0 0 3px rgba(99,102,241,.2); }
    [data-theme="dark"] .hero-pill { background: var(--panel); border-color: var(--line); }
    [data-theme="dark"] footer { border-color: var(--line); color: #6e7681; }
    [data-theme="dark"] footer a { color: #6e7681; }
    [data-theme="dark"] .cta-gh {
      background: #2d3748;
      border-color: #4a5568;
      color: #e6edf3;
    }
    [data-theme="dark"] .cta-gh:hover { opacity: 1; background: #374151; }
    [data-theme="dark"] .submit-btn { background: #21262d; border-color: #30363d; }
    [data-theme="dark"] .submit-btn:hover:not(:disabled) { background: #30363d; }
  </style>
</head>
<body>
  ${TOPNAV}

  <div class="page">
    <div class="hero">
      <h1>The AI operative system.</h1>
      <p>Connect events, memory, AI reasoning, automation, and feedback<br>
         into one self-hosted operational loop.</p>

      <div class="hero-flow">
        Events &rarr; Memory &rarr; AI &rarr; Automation &rarr; Feedback
      </div>

      <div class="hero-pills">
        <span class="hero-pill">Self-hosted</span>
        <span class="hero-pill">Apache License 2.0</span>
        <span class="hero-pill">Modular stack</span>
      </div>

      <div class="hero-ctas">
        <a href="${GITHUB_URL}" class="cta-gh" target="_blank" rel="noreferrer">
          ${GH_ICON}
          Star on GitHub
        </a>
        <a href="${DEPLOY_URL}" class="cta-deploy" target="_blank" rel="noreferrer">
          Deploy on redu.cloud
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h7M6.5 3l3 3-3 3"/></svg>
        </a>
      </div>
    </div>

    <div class="login-card">
      <div class="card-header">
        <h2>Sign in to your instance</h2>
        <p>Use the credentials configured during setup.</p>
      </div>
      <div class="card-body">
        <form id="login-form">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="username" required autofocus />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="submit-btn" id="submit" type="submit">Sign In</button>
          <div class="error-msg" id="error-msg"></div>
        </form>
      </div>
    </div>
  </div>

  <footer>
    Open source &middot; Apache 2.0 &middot;
    <a href="${GITHUB_URL}" target="_blank" rel="noreferrer">GitHub</a> &middot;
    <a href="${DEPLOY_URL}" target="_blank" rel="noreferrer">redu.cloud</a>
  </footer>

  <script>
    /* ── Theme toggle (same logic as dashboard) ── */
    (function() {
      const saved = localStorage.getItem('reduos-theme') || 'light';
      if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    })();
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('reduos-theme', next);
    });

    const form = document.getElementById("login-form");
    const btn  = document.getElementById("submit");
    const err  = document.getElementById("error-msg");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      btn.disabled = true;
      err.textContent = "";
      try {
        const res  = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email:    document.getElementById("email").value,
            password: document.getElementById("password").value
          })
        });
        const body = await res.json();
        if (!res.ok || body.ok === false) throw new Error(body.error || "Login failed.");
        window.location.href = "/";
      } catch (ex) {
        err.textContent = ex.message;
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
