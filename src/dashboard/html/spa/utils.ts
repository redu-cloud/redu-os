export const spaUtils = `
    /* ─── utils ──────────────────────────────────────────── */
    const $ = id => document.getElementById(id);
    const esc = v => String(v??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const trunc = (v, n=160) => { const s=String(v??''); return s.length>n ? s.slice(0,n-1)+'...' : s; };
    const fmtDate = v => v ? new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '--';
    const badge = (v, cls) => { const n = String(v??'').toLowerCase().replace(/[^a-z0-9_-]/g,'-'); return '<span class="badge badge-'+(cls||n)+'">'+esc(v??'--')+'</span>'; };
    const dot   = ok => '<span class="dot '+(ok?'dot-ok':'dot-bad')+'"></span>';
    const mkMetric = (label,value,desc) => '<div class="metric-card"><div class="metric-label">'+esc(label)+'</div><div class="metric-value">'+esc(String(value))+'</div><div class="metric-desc">'+esc(desc)+'</div></div>';
    const empty = (icon,title,desc) => '<div class="empty-state"><div class="empty-icon">'+icon+'</div><div class="empty-title">'+esc(title)+'</div><div class="empty-desc">'+esc(desc)+'</div></div>';

    /* ─── api ────────────────────────────────────────────── */
    async function api(path, opts) {
      const r = await fetch(path, opts||{});
      if (r.status===401) { window.location.href='/login'; throw new Error('auth'); }
      const j = await r.json();
      if (!r.ok||j.ok===false) throw new Error(j.error||'Request failed');
      return j;
    }

    /* ─── SSE live-event manager ──────────────────────────
       One EventSource shared across page navigations.
       Dispatches live events to the current page via
       direct DOM manipulation (no full re-render).
    ─────────────────────────────────────────────────────── */
    let _sse = null;
    let _sseNewCount = 0; // new events while Events page is mounted

    function connectSse() {
      if (_sse) { try { _sse.close(); } catch {} }
      const es = new EventSource('/api/events/stream');
      _sse = es;

      es.onopen = () => {
        document.getElementById('sse-live-dot')?.classList.add('visible');
      };

      es.onmessage = e => {
        try {
          const d = JSON.parse(e.data);
          if (d.type !== 'events' || !d.events?.length) return;
          d.events.forEach(evt => _sseDispatch(evt));
        } catch {}
      };

      es.onerror = () => {
        document.getElementById('sse-live-dot')?.classList.remove('visible');
        es.close();
        _sse = null;
        // Reconnect after 5 s
        setTimeout(() => { if (!_sse) connectSse(); }, 5000);
      };
    }

    function _sseDispatch(evt) {
      /* ── Overview: prepend to Recent Activity timeline ── */
      if (CUR === 'overview') {
        const tl = document.querySelector('#page-content .timeline');
        if (tl) {
          const row =
            '<div class="tl-item tl-flash">'+
              '<span class="tl-dot tl-event"></span>'+
              '<div>'+
                '<div style="font-size:13px;color:var(--ink-2)">'+
                  badge('event')+'&nbsp;'+esc(trunc(evt.message||evt.type||'',100))+
                '</div>'+
                '<div class="tl-meta">'+esc(fmtDate(evt.created_at))+'&nbsp;&middot;&nbsp;'+esc(evt.source||'')+'</div>'+
              '</div>'+
            '</div>';
          tl.insertAdjacentHTML('afterbegin', row);
          // Cap at 10 items
          const items = tl.querySelectorAll('.tl-item');
          if (items.length > 10) items[items.length-1].remove();
        }
        // Bump the Events metric counter
        const metrics = document.querySelectorAll('.metric-card');
        if (metrics[0]) {
          const vEl = metrics[0].querySelector('.metric-value');
          if (vEl) { const n = parseInt(vEl.textContent||'0')||0; vEl.textContent = String(n+1); }
        }
      }

      /* ── Events page: show "N new events" banner ── */
      if (CUR === 'events') {
        _sseNewCount++;
        let banner = document.getElementById('sse-events-banner');
        if (!banner) {
          const wrap = document.querySelector('#page-content .page-wrap');
          if (wrap) {
            wrap.insertAdjacentHTML('afterbegin',
              '<div class="sse-banner" id="sse-events-banner">'+
                '<span class="sse-banner-dot"></span>'+
                '<span id="sse-events-count">1</span>&nbsp;new event — '+
                '<button class="btn btn-sm btn-indigo" style="margin-left:4px" '+
                  'onclick="go(&apos;events&apos;)">Reload</button>'+
              '</div>');
          }
        } else {
          const c = document.getElementById('sse-events-count');
          if (c) c.textContent = String(_sseNewCount);
        }
      }
    }

    // Reset banner count whenever the events page is freshly rendered
    function _sseResetBanner() { _sseNewCount = 0; }`;
