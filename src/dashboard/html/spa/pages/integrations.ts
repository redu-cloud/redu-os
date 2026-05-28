export const pgIntegrations = `async function pgIntegrations() {
      const [d, ob] = await Promise.all([api('/api/summary'), api('/api/onboarding').catch(()=>({services:[],collector_url:'',collector_api_key:'',umami_url:null,umami_website_id:null,glitchtip_dsn:null}))]);
      const sv   = d.services||{};
      const cUrl = ob.collector_url || d.links?.collector || 'http://127.0.0.1:3005';
      const apiKey = ob.collector_api_key || 'YOUR_API_KEY';
      const dUrl = window.location.origin;

      const obSvc = {};
      (ob.services||[]).forEach(s => { obSvc[s.id] = s; });

      /* ── Tab-switch for multi-language snippets ── */
      window.msSwitch = function(id, lang) {
        const el = document.querySelector('[data-ms-id="'+id+'"]');
        if (!el) return;
        el.querySelectorAll('.ms-tab').forEach(function(t) {
          t.classList.toggle('ms-active', t.getAttribute('data-ms-lang') === lang);
        });
        el.querySelectorAll('.ms-pane').forEach(function(p) {
          p.style.display = p.getAttribute('data-lang') === lang ? '' : 'none';
        });
      };

      /* ── Generic reveal / copy for masked credential cards ── */
      window.revealSecret = function(id, secret) {
        const el  = document.getElementById(id+'-val');
        const btn = document.getElementById(id+'-reveal');
        if (!el || !btn) return;
        const hidden = el.getAttribute('data-hidden') === '1';
        if (hidden) {
          el.textContent = secret;
          el.setAttribute('data-hidden', '0');
          btn.textContent = 'Hide';
        } else {
          el.textContent = '\\u2022'.repeat(Math.min(secret.length, 40));
          el.setAttribute('data-hidden', '1');
          btn.textContent = 'Reveal';
        }
      };
      window.copySecret = function(id, secret) {
        navigator.clipboard.writeText(secret).catch(function(){});
        const btn = document.getElementById(id+'-copy');
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = '\\u2713 Copied';
        btn.style.color = 'var(--green)';
        setTimeout(function(){ btn.textContent = orig; btn.style.color = ''; }, 2000);
      };
      /* Legacy single-key helpers kept for backward compat */
      window.revealKey = function() { window.revealSecret('apik', apiKey); };
      window.copyKey   = function() { window.copySecret('apik', apiKey); };

      function secretCard(id, label, note, secret) {
        const masked = '\\u2022'.repeat(Math.min(secret.length, 40));
        return '<div class="int-key-card">'+
          '<div class="int-key-card-info">'+
            '<div class="int-key-card-label">'+esc(label)+'</div>'+
            '<div class="int-key-card-note">'+note+'</div>'+
          '</div>'+
          '<div class="int-key-card-row">'+
            '<code class="int-key-val" id="'+id+'-val" data-hidden="1">'+esc(masked)+'</code>'+
            '<button class="btn btn-sm" id="'+id+'-reveal" onclick="revealSecret(&apos;'+id+'&apos;,&apos;'+esc(secret)+'&apos;)">Reveal</button>'+
            '<button class="btn btn-sm" id="'+id+'-copy"  onclick="copySecret(&apos;'+id+'&apos;,&apos;'+esc(secret)+'&apos;)">Copy</button>'+
          '</div>'+
        '</div>';
      }

      /* ── Single-language snippet ── */
      function snippet(lang, code) {
        return '<div class="int-snippet">'+
          '<div class="int-snippet-lang">'+lang+'</div>'+
          '<pre class="int-snippet-code">'+esc(code)+'</pre>'+
          '<button class="btn btn-sm int-copy" data-code="'+esc(code)+'">Copy</button>'+
        '</div>';
      }

      /* ── Webhook URL snippet ── */
      function webhookSnippet(path) {
        const url = cUrl + path;
        return '<div class="int-snippet">'+
          '<div class="int-snippet-lang">Webhook URL <span class="int-header-hint">&#8212; requires X-API-Key header</span></div>'+
          '<pre class="int-snippet-code int-url-code">'+esc(url)+'</pre>'+
          '<button class="btn btn-sm int-copy" data-code="'+esc(url)+'">Copy URL</button>'+
        '</div>';
      }

      /* ── Multi-language tabbed snippet ── */
      let _msId = 0;
      function multiSnippet(variants) {
        const id = 'ms' + (++_msId);
        let tabs = '', panes = '';
        variants.forEach(function(v, i) {
          const active = i === 0;
          tabs += '<button class="ms-tab'+(active?' ms-active':'')+
            '" data-ms-lang="'+esc(v.lang)+
            '" onclick="msSwitch(&apos;'+id+'&apos;,&apos;'+esc(v.lang)+'&apos;)">'+esc(v.label||v.lang)+'</button>';
          panes += '<div class="ms-pane" data-lang="'+esc(v.lang)+'" style="'+(active?'':'display:none')+'">'+
            '<pre class="int-snippet-code">'+esc(v.code)+'</pre>'+
            '<button class="btn btn-sm int-copy" data-code="'+esc(v.code)+'">Copy</button>'+
          '</div>';
        });
        return '<div class="multi-snippet" data-ms-id="'+id+'">'+
          '<div class="ms-tabs">'+tabs+'</div>'+
          '<div class="ms-panes">'+panes+'</div>'+
        '</div>';
      }

      /* ── Section divider (label is plain text, no HTML entities) ── */
      function snippetSection(label) {
        return '<div class="int-snippet-section">'+label+'</div>';
      }

      const umamiSrc  = ob.umami_url        || '';
      const umamiId   = ob.umami_website_id  || 'YOUR_WEBSITE_ID';
      const gtDsn     = ob.glitchtip_dsn    || 'http://KEY@your-glitchtip-host/PROJECT_ID';

      /* Docs link rendered next to service name */
      function docsLink(url, label) {
        return ' <a href="'+esc(url)+'" target="_blank" rel="noreferrer" class="int-docs-link">'+esc(label)+' &#8599;</a>';
      }

      /* Key-note: shows header name + silent copy button, never displays key in plain text */
      function keyNote(text) {
        return '<div class="int-key-note">&#128273; '+text+
          ' <code>X-API-Key: &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</code>'+
          ' <button class="btn btn-sm int-copy int-key-copy" data-code="'+esc(apiKey)+'">Copy key</button>'+
          '</div>';
      }

      const SRCS = [
        { key:'glitchtip',  id:'glitchtip',   name:'GlitchTip',
          docs: docsLink('https://glitchtip.com/documentation', 'Docs'),
          badge:'Error tracking',
          desc:'Forward error notifications from GlitchTip via webhook, and track errors from your app with the Sentry-compatible SDK.',
          setup:
            webhookSnippet('/v1/events/glitchtip') +
            keyNote('Add as Webhook in GlitchTip &#8594; Settings &#8594; Webhooks. Set custom header:') +
            snippetSection('Track errors from your app →') +
            multiSnippet([
              { lang: 'browser', label: 'Browser (JS)', code:
                'import * as Sentry from "@sentry/browser";\\n\\n' +
                'Sentry.init({\\n' +
                '  dsn: "'+gtDsn+'",\\n' +
                '  tracesSampleRate: 0,\\n' +
                '});'
              },
              { lang: 'node', label: 'Node.js', code:
                'const Sentry = require("@sentry/node");\\n\\n' +
                'Sentry.init({\\n' +
                '  dsn: "'+gtDsn+'",\\n' +
                '});'
              },
              { lang: 'python', label: 'Python', code:
                'import sentry_sdk\\n\\n' +
                'sentry_sdk.init(\\n' +
                '    dsn="'+gtDsn+'",\\n' +
                '    traces_sample_rate=0,\\n' +
                ')'
              },
              { lang: 'go', label: 'Go', code:
                'import "github.com/getsentry/sentry-go"\\n\\n' +
                'sentry.Init(sentry.ClientOptions{\\n' +
                '    Dsn: "'+gtDsn+'",\\n' +
                '})'
              }
            ])
        },

        { key:'zammad',     id:'zammad',      name:'Zammad',
          docs: docsLink('https://docs.zammad.org/en/latest/api/intro.html', 'API Docs'),
          badge:'Support tickets',
          desc:'Receive ticket events from Zammad via webhook, and let visitors submit support requests from any website.',
          setup:
            webhookSnippet('/v1/events/zammad') +
            keyNote('Add as Webhook in Zammad: Admin &#8594; Webhooks &#8594; New. Under &ldquo;Custom Payload Headers&rdquo; add:') +
            snippetSection('Create tickets from your website →') +
            multiSnippet([
              { lang: 'curl', label: 'cURL', code:
                'curl -X POST "'+dUrl+'/api/zammad/contact"\\n' +
                '  -H "Content-Type: application/json"\\n' +
                '  -d \\\'{"name":"Jane Doe","email":"jane@example.com","subject":"Question","message":"Hello!"}\\\''
              },
              { lang: 'fetch', label: 'Fetch', code:
                'fetch("'+dUrl+'/api/zammad/contact", {\\n' +
                '  method: "POST",\\n' +
                '  headers: { "Content-Type": "application/json" },\\n' +
                '  body: JSON.stringify({\\n' +
                '    name:    name,      // string\\n' +
                '    email:   email,     // string, required\\n' +
                '    subject: subject,   // string (optional)\\n' +
                '    message: message    // string, required\\n' +
                '  })\\n' +
                '});'
              },
              { lang: 'axios', label: 'Axios', code:
                'axios.post("'+dUrl+'/api/zammad/contact", {\\n' +
                '  name:    name,\\n' +
                '  email:   email,\\n' +
                '  subject: subject,\\n' +
                '  message: message\\n' +
                '});'
              },
              { lang: 'python', label: 'Python', code:
                'import requests\\n\\n' +
                'requests.post("'+dUrl+'/api/zammad/contact", json={\\n' +
                '    "name":    "Jane Doe",\\n' +
                '    "email":   "jane@example.com",\\n' +
                '    "subject": "Question",\\n' +
                '    "message": "Hello!"\\n' +
                '})'
              },
              { lang: 'go', label: 'Go', code:
                'import (\\n' +
                '    "bytes"; "encoding/json"; "net/http"\\n' +
                ')\\n\\n' +
                'body, _ := json.Marshal(map[string]string{\\n' +
                '    "name":    "Jane Doe",\\n' +
                '    "email":   "jane@example.com",\\n' +
                '    "subject": "Question",\\n' +
                '    "message": "Hello!",\\n' +
                '})\\n' +
                'http.Post("'+dUrl+'/api/zammad/contact", "application/json", bytes.NewReader(body))'
              }
            ])
        },

        { key:'uptime-kuma',id:'uptime_kuma', name:'Uptime Kuma',
          docs: docsLink('https://github.com/louislam/uptime-kuma/wiki', 'Wiki'),
          badge:'Uptime alerts',
          desc:'Forward monitor alerts from Uptime Kuma. Open your monitor &#8594; Edit &#8594; Notifications &#8594; Add Notification (Webhook type).',
          setup:
            webhookSnippet('/v1/events/uptime-kuma') +
            keyNote('In Uptime Kuma set the Webhook URL above. Under &ldquo;Additional Headers&rdquo; add:') +
            snippetSection('Add a monitor from here →') +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:4px">'+
              '<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Name</div>'+
                '<input id="uk-name" class="lg-input" style="width:160px" placeholder="My Homepage"/></div>'+
              '<div style="flex:1;min-width:180px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">URL</div>'+
                '<input id="uk-url" class="lg-input" placeholder="https://example.com"/></div>'+
              '<div><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Check every</div>'+
                '<select id="uk-interval" class="lg-select" style="width:120px">'+
                  '<option value="30">30 seconds</option>'+
                  '<option value="60" selected>1 minute</option>'+
                  '<option value="300">5 minutes</option>'+
                  '<option value="600">10 minutes</option>'+
                '</select></div>'+
              '<button id="uk-add" class="btn btn-primary btn-sm" style="height:36px;white-space:nowrap">Add Monitor</button>'+
            '</div>'+
            '<div id="uk-msg" style="font-size:12px;margin-top:6px"></div>'
        },

        { key:'umami',      id:'umami',       name:'Umami',
          docs: docsLink('https://umami.is/docs', 'Docs'),
          badge:'Analytics',
          desc:'Track website visitors and custom events. Paste the script into your &lt;head&gt;, then call <code>umami.track()</code> for important user actions.',
          setup: (umamiSrc
            ? multiSnippet([
                { lang: 'script', label: 'HTML Script', code:
                  '<script async defer\\n  src="'+umamiSrc+'/script.js"\\n  data-website-id="'+umamiId+'"\\n><\\/script>'
                },
                { lang: 'events', label: 'Track Events', code:
                  '// Track a custom event (call after the script loads)\\n' +
                  'umami.track(\\'signup\\', { plan: \\'free\\' });\\n\\n' +
                  '// Track a button click\\n' +
                  'umami.track(\\'cta-click\\', { page: location.pathname });\\n\\n' +
                  '// Track a form submission\\n' +
                  'umami.track(\\'contact-form\\', { status: \\'submitted\\' });\\n\\n' +
                  '// Track a purchase\\n' +
                  'umami.track(\\'purchase\\', { amount: 49, plan: \\'pro\\' });\\n\\n' +
                  '// Manual pageview (single-page apps)\\n' +
                  'umami.track();'
                }
              ])
            : '<div style="font-size:12px;color:var(--muted);padding:6px 0">Umami URL not configured in .env</div>')
        },

        { key:'collector',  id:'website',     name:'Custom App / Website',
          docs: docsLink('https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API', 'Fetch API'),
          badge:'Custom events',
          desc:'Send any event from your app or website. The /api/track endpoint is CORS-open &#8212; no API key needed in the browser.',
          setup: multiSnippet([
            { lang: 'curl', label: 'cURL', code:
              'curl -X POST "'+dUrl+'/api/track"\\n' +
              '  -H "Content-Type: application/json"\\n' +
              '  -d \\\'{"source":"website","type":"pageview","message":"Home","metadata":{"url":"https://example.com"}}\\\''
            },
            { lang: 'fetch', label: 'Fetch', code:
              'fetch("'+dUrl+'/api/track", {\\n' +
              '  method: "POST",\\n' +
              '  headers: { "Content-Type": "application/json" },\\n' +
              '  body: JSON.stringify({\\n' +
              '    source: "website",\\n' +
              '    type:   "pageview",   // or "signup", "purchase", ...\\n' +
              '    message: document.title,\\n' +
              '    metadata: { url: location.href }\\n' +
              '  })\\n' +
              '});'
            },
            { lang: 'axios', label: 'Axios', code:
              'axios.post("'+dUrl+'/api/track", {\\n' +
              '  source: "website",\\n' +
              '  type:   "pageview",\\n' +
              '  message: document.title,\\n' +
              '  metadata: { url: location.href }\\n' +
              '});'
            },
            { lang: 'python', label: 'Python', code:
              'import requests\\n\\n' +
              'requests.post("'+dUrl+'/api/track", json={\\n' +
              '    "source":  "website",\\n' +
              '    "type":    "pageview",\\n' +
              '    "message": "Page Title",\\n' +
              '    "metadata": {"url": "https://example.com"}\\n' +
              '})'
            },
            { lang: 'go', label: 'Go', code:
              'import (\\n' +
              '    "bytes"; "encoding/json"; "net/http"\\n' +
              ')\\n\\n' +
              'body, _ := json.Marshal(map[string]any{\\n' +
              '    "source":   "website",\\n' +
              '    "type":     "pageview",\\n' +
              '    "message":  "Page Title",\\n' +
              '    "metadata": map[string]string{"url": "https://example.com"},\\n' +
              '})\\n' +
              'http.Post("'+dUrl+'/api/track", "application/json", bytes.NewReader(body))'
            }
          ])
        },

        { key:'listmonk',   id:'listmonk',    name:'Listmonk',
          docs: docsLink('https://listmonk.app/docs/', 'Docs'),
          badge:'Email list',
          desc:'Receive subscriber events from Listmonk via webhook, and let visitors subscribe to your beta list from any website.',
          setup:
            webhookSnippet('/v1/events/listmonk') +
            keyNote('Add as Webhook in Listmonk: Settings &#8594; Webhooks. Add header:') +
            snippetSection('Subscribe users from your website →') +
            multiSnippet([
              { lang: 'curl', label: 'cURL', code:
                'curl -X POST "'+dUrl+'/api/listmonk/subscribe"\\n' +
                '  -H "Content-Type: application/json"\\n' +
                '  -d \\\'{"name":"Jane Doe","email":"jane@example.com"}\\\''
              },
              { lang: 'fetch', label: 'Fetch', code:
                'fetch("'+dUrl+'/api/listmonk/subscribe", {\\n' +
                '  method: "POST",\\n' +
                '  headers: { "Content-Type": "application/json" },\\n' +
                '  body: JSON.stringify({\\n' +
                '    name:  name,   // string (optional)\\n' +
                '    email: email   // string, required\\n' +
                '  })\\n' +
                '});'
              },
              { lang: 'axios', label: 'Axios', code:
                'axios.post("'+dUrl+'/api/listmonk/subscribe", {\\n' +
                '  name:  name,\\n' +
                '  email: email\\n' +
                '});'
              },
              { lang: 'python', label: 'Python', code:
                'import requests\\n\\n' +
                'requests.post("'+dUrl+'/api/listmonk/subscribe", json={\\n' +
                '    "name":  "Jane Doe",\\n' +
                '    "email": "jane@example.com"\\n' +
                '})'
              },
              { lang: 'go', label: 'Go', code:
                'import (\\n' +
                '    "bytes"; "encoding/json"; "net/http"\\n' +
                ')\\n\\n' +
                'body, _ := json.Marshal(map[string]string{\\n' +
                '    "name":  "Jane Doe",\\n' +
                '    "email": "jane@example.com",\\n' +
                '})\\n' +
                'http.Post("'+dUrl+'/api/listmonk/subscribe", "application/json", bytes.NewReader(body))'
              }
            ])
        },
      ];

      const OTHERS = [
        { cat:'AI / ML',  name:'Ollama',       key:'ollama',       url:d.links?.ollama||'http://127.0.0.1:11435', docs:'https://ollama.com/library',               desc:'Local LLM host. deepseek-r1:1.5b for chat, nomic-embed-text for embeddings.' },
        { cat:'AI / ML',  name:'LiteLLM',      key:'litellm',      url:'http://127.0.0.1:4000',                   docs:'https://docs.litellm.ai/',                 desc:'AI gateway &#8212; routes requests to OpenAI, Anthropic, Groq, and other providers.' },
        { cat:'AI / ML',  name:'Langfuse',      key:'langfuse',     url:'http://127.0.0.1:3003',                   docs:'https://langfuse.com/docs',               desc:'LLM observability. View every prompt, completion, latency, and cost.' },
        { cat:'Storage',  name:'Supabase',      key:'supabase',     url:d.links?.supabase_api||'http://127.0.0.1:8000', docs:'https://supabase.com/docs',          desc:'Postgres + REST API. Stores events, insights, actions, and feedback.' },
        { cat:'Storage',  name:'Qdrant',        key:'qdrant',       url:d.links?.qdrant||'http://127.0.0.1:6333',  docs:'https://qdrant.tech/documentation/',      desc:'Vector memory. Stores embeddings for semantic similarity search.' },
        { cat:'Automation',name:'Activepieces', key:'activepieces', url:d.links?.activepieces||'http://127.0.0.1:8080', docs:'https://www.activepieces.com/docs',  desc:'No-code automation. Receives webhook triggers from reduOS actions.' },
      ];

      let html = '<div class="page-wrap"><div class="page-head"><div class="page-title">Integrations</div>'+
        '<div class="page-sub">Connect your tools, copy setup snippets, and verify service health.</div></div>';

      /* ── Credential cards ── */
      html += secretCard('apik', 'Collector API Key',
        'Authenticates webhooks and internal service calls. Use as <code>X-API-Key</code> header.',
        apiKey);
      if (gtDsn && gtDsn !== 'http://KEY@your-glitchtip-host/PROJECT_ID') {
        html += secretCard('gtdsn', 'GlitchTip DSN',
          'Paste into <code>Sentry.init({ dsn: &quot;…&quot; })</code> in your app. Includes the public key and project ID.',
          gtDsn);
      }

      html += '<h3 class="int-section-title">Event Sources</h3>';
      html += '<div class="int-src-grid">';

      SRCS.forEach(function(it) {
        const ok        = sv[it.key] === true;
        const obEntry   = obSvc[it.id];
        const evCount   = obEntry ? obEntry.events : 0;
        const hasEvents = evCount > 0;

        const statusBadge = hasEvents
          ? '<span class="badge badge-connected">&#10003; '+evCount+' event'+(evCount===1?'':'s')+' received</span>'
          : ok
            ? badge('Service up','connected')
            : sv[it.key] === false
              ? badge('Down','down')
              : badge(it.badge,'optional');

        html += '<div class="int-card int-src-card">'+
          '<div class="int-head">'+
            '<span class="int-name">'+esc(it.name)+'</span>'+
            (it.docs||'')+
            statusBadge+
          '</div>'+
          '<div class="int-desc">'+it.desc+'</div>'+
          it.setup+
        '</div>';
      });

      html += '</div>';

      const otherCats = [...new Set(OTHERS.map(o=>o.cat))];
      otherCats.forEach(function(cat) {
        html += '<h3 class="int-section-title">'+esc(cat)+'</h3><div class="int-grid" style="margin-bottom:24px">';
        OTHERS.filter(o=>o.cat===cat).forEach(function(it) {
          const ok   = sv[it.key] === true;
          const down = sv[it.key] === false;
          html += '<div class="int-card">'+
            '<div class="int-head">'+
              '<span class="int-name">'+esc(it.name)+'</span>'+
              '<a href="'+esc(it.docs)+'" target="_blank" rel="noreferrer" class="int-docs-link">Docs &#8599;</a>'+
              (ok?badge('OK','connected'):down?badge('Down','down'):badge('No status','disabled'))+
            '</div>'+
            '<div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:8px">'+it.desc+'</div>'+
            '<div class="int-footer"><a href="'+esc(it.url)+'" target="_blank" rel="noreferrer" class="btn btn-sm">Open &nearr;</a></div>'+
          '</div>';
        });
        html += '</div>';
      });

      return html+'</div>';
    }`;
