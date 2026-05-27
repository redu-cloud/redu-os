export const pgIntegrations = `async function pgIntegrations() {
      const d = await api('/api/summary');
      const sv = d.services||{};
      const cUrl = d.links?.collector||'http://127.0.0.1:3005';

      const INTS = [
        {cat:'Event Sources', name:'GlitchTip',  key:'glitchtip',   wh:cUrl+'/v1/events/glitchtip',   docs:'Error tracking. Configure webhook in GlitchTip project settings.', optional:false},
        {cat:'Event Sources', name:'Zammad',      key:'zammad',      wh:cUrl+'/v1/events/zammad',       docs:'Support tickets. Configure in Zammad Webhooks > Ticket created.',  optional:false},
        {cat:'Event Sources', name:'Uptime Kuma', key:'uptime-kuma', wh:cUrl+'/v1/events/uptime-kuma',  docs:'Uptime alerts. Configure in Uptime Kuma monitor > Notification.',  optional:false},
        {cat:'Event Sources', name:'Umami',       key:'umami',       wh:cUrl+'/v1/events/umami',        docs:'Analytics events. Use Umami > Send Data integration.',              optional:false},
        {cat:'Event Sources', name:'Listmonk',    key:'listmonk',    wh:cUrl+'/v1/events/listmonk',     docs:'Email list events. Configure in Listmonk webhook settings.',         optional:true},
        {cat:'Event Sources', name:'Custom App',  key:'collector',   wh:cUrl+'/v1/events',             docs:'Send any JSON event directly to the collector API with X-API-Key.',  optional:true},
        {cat:'AI / ML',       name:'Ollama',      key:'ollama',      wh:d.links?.ollama||'http://127.0.0.1:11435', docs:'Local LLM host. deepseek-r1:1.5b for reasoning, nomic-embed-text for embeddings.', optional:false},
        {cat:'AI / ML',       name:'LiteLLM',     key:'litellm',     wh:'http://127.0.0.1:4000',        docs:'AI gateway for routing to local or cloud models (OpenAI, Anthropic, Groq).', optional:true},
        {cat:'AI / ML',       name:'Langfuse',    key:'langfuse',    wh:'http://127.0.0.1:3003',        docs:'LLM observability and tracing. View prompts, completions, and latencies.', optional:true},
        {cat:'Storage',       name:'Supabase',    key:'supabase',    wh:d.links?.supabase_api||'http://127.0.0.1:8000', docs:'Postgres + REST API. Stores events, insights, actions, and feedback.', optional:false},
        {cat:'Storage',       name:'Qdrant',      key:'qdrant',      wh:d.links?.qdrant||'http://127.0.0.1:6333', docs:'Vector memory. Stores event embeddings for similarity search.', optional:false},
        {cat:'Automation',    name:'Activepieces', key:'activepieces', wh:d.links?.activepieces||'http://127.0.0.1:8080', docs:'No-code automation. Receives webhook triggers from reduOS actions.', optional:false},
      ];

      const cats = [...new Set(INTS.map(i=>i.cat))];
      const isEventSrc = cat => cat==='Event Sources';

      let html = '<div class="page-wrap"><div class="page-head"><div class="page-title">Integrations</div>'+
        '<div class="page-sub">Connect tools, configure webhooks, and verify service health.</div></div>';

      cats.forEach(cat=>{
        const items=INTS.filter(i=>i.cat===cat);
        html+='<h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin:0 0 10px">'+esc(cat)+'</h3>';
        html+='<div class="int-grid" style="margin-bottom:24px">';
        items.forEach(it=>{
          const ok=sv[it.key]===true, down=sv[it.key]===false;
          html+='<div class="int-card">'+
            '<div class="int-head">'+
              '<span class="int-name">'+esc(it.name)+'</span>'+
              (it.optional?badge('Optional','optional'):ok?badge('Connected','connected'):down?badge('Down','down'):badge('No status','disabled'))+
            '</div>'+
            '<div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:8px">'+esc(it.docs)+'</div>'+
            (isEventSrc(cat)?
              '<div class="int-webhook">'+esc(it.wh)+'</div>'+
              '<div class="int-footer"><button class="btn btn-sm copy-url" data-url="'+esc(it.wh)+'">Copy URL</button></div>' :
              '<div class="int-footer"><a href="'+esc(it.wh)+'" target="_blank" rel="noreferrer" class="btn btn-sm">Open &nearr;</a></div>'
            )+
          '</div>';
        });
        html+='</div>';
      });

      return html+'</div>';
    }`;
