export const pgAiConfig = `async function pgAiConfig() {
      const d = await api('/api/ai-config');
      const cfgRow = (k,v) => '<div class="config-row"><span class="config-key">'+esc(k)+'</span><span class="config-val">'+esc(String(v??'--'))+'</span></div>';
      const cur = (d.ai_provider||'').toLowerCase();

      const sel = (id,label,placeholder) =>
        '<div style="margin-bottom:10px">'+
          '<label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">'+esc(label)+'</label>'+
          '<select id="'+id+'" class="filter-select" style="width:100%;font-family:inherit">'+
            '<option value="">'+esc(placeholder)+'</option>'+
          '</select>'+
        '</div>';

      const apiKeyField =
        '<div style="margin-bottom:10px">'+
          '<label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">API Key</label>'+
          '<input id="litellm-api-key" type="password" class="filter-select" style="width:100%;font-family:inherit"'+
            ' placeholder="'+esc(d.litellm?.api_key_set?'configured — leave blank to keep':'not set')+'"/>'+
        '</div>';

      const editNote = '<p style="margin-top:10px;font-size:11px;color:var(--muted-2)">&#9432; In-memory — resets on restart. Update <code>.env</code> to persist.</p>';

      const saveCancel = sec =>
        '<div style="display:flex;gap:8px;align-items:center;margin-top:4px">'+
          '<button class="btn btn-sm btn-primary ai-save-btn" data-section="'+sec+'">Save</button>'+
          '<button class="btn btn-sm ai-cancel-btn" data-section="'+sec+'">Cancel</button>'+
          '<span class="ai-form-msg" id="'+sec+'-msg" style="font-size:12px"></span>'+
        '</div>';

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">AI Config</div>'+
          '<div class="page-sub">reduOS can run fully local or route model calls through LiteLLM.</div></div>'+
        '<div class="two-col">'+
          '<div>'+
            '<div class="card" style="margin-bottom:14px">'+
              '<div class="card-head"><span class="card-title">Active Configuration</span>'+
                badge(d.ai_enabled?'AI Enabled':'AI Disabled', d.ai_enabled?'completed':'disabled')+
              '</div>'+
              '<div class="card-body">'+
                '<div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">'+
                  '<span style="font-size:12px;color:var(--muted);margin-right:4px">Provider:</span>'+
                  ['litellm','ollama'].map(p=>
                    '<button class="btn btn-sm prov-switch'+(cur===p?' btn-primary':'')+'" data-prov="'+p+'" style="min-width:80px">'+
                      (cur===p?'&#9679; ':'')+p+
                    '</button>'
                  ).join('')+
                  '<span id="prov-msg" style="font-size:12px;color:var(--muted);margin-left:4px"></span>'+
                '</div>'+
                cfgRow('AI enabled', d.ai_enabled)+
                cfgRow('Qdrant memory', d.qdrant_enabled)+
                cfgRow('Langfuse tracing', d.langfuse_enabled)+
              '</div>'+
            '</div>'+

            '<div class="card" style="margin-bottom:14px">'+
              '<div class="card-head">'+
                '<span class="card-title">Ollama</span>'+
                badge(cur==='ollama'?'Active':'Standby', cur==='ollama'?'completed':'disabled')+
                '<button class="btn btn-sm ai-edit-btn" data-section="ollama" style="margin-left:auto">Edit</button>'+
              '</div>'+
              '<div id="ollama-display" class="card-body">'+
                cfgRow('URL', d.ollama?.url)+
                cfgRow('Chat model', d.ollama?.chat_model)+
                cfgRow('Embedding model', d.ollama?.embed_model)+
              '</div>'+
              '<div id="ollama-form" class="card-body" style="display:none">'+
                sel('ollama-chat-model','Chat model','Loading…')+
                sel('ollama-embed-model','Embedding model','Loading…')+
                saveCancel('ollama')+
                editNote+
              '</div>'+
            '</div>'+

            '<div class="card" style="margin-bottom:14px">'+
              '<div class="card-head">'+
                '<span class="card-title">LiteLLM</span>'+
                badge(cur==='litellm'?'Active':'Standby', cur==='litellm'?'completed':'disabled')+
                '<button class="btn btn-sm ai-edit-btn" data-section="litellm" style="margin-left:auto">Edit</button>'+
              '</div>'+
              '<div id="litellm-display" class="card-body">'+
                cfgRow('Base URL', d.litellm?.base_url)+
                cfgRow('Model', d.litellm?.model)+
                cfgRow('API key', d.litellm?.api_key_set?'configured (hidden)':'not set')+
              '</div>'+
              '<div id="litellm-form" class="card-body" style="display:none">'+
                sel('litellm-model','Model','Loading…')+
                apiKeyField+
                saveCancel('litellm')+
                editNote+
              '</div>'+
            '</div>'+

            (d.langfuse_enabled ?
              '<div class="card">'+
                '<div class="card-head"><span class="card-title">Langfuse Tracing</span>'+badge('Enabled','completed')+'</div>'+
                '<div class="card-body">'+
                  cfgRow('Host', d.langfuse_host)+
                  cfgRow('Public key', d.langfuse_public_key||'not set')+
                '</div>'+
              '</div>' : '')+
          '</div>'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">How It Works</span></div>'+
              '<div class="card-body">'+
                '<p class="card-desc" style="margin-bottom:12px">When an event arrives, reduOS:</p>'+
                '<ol style="padding-left:16px;font-size:13px;color:var(--muted);line-height:2">'+
                  '<li>Embeds the event with <strong>'+esc(d.ollama?.embed_model||'nomic-embed-text')+'</strong></li>'+
                  '<li>Retrieves similar past events from <strong>Qdrant</strong></li>'+
                  '<li>Sends context to <strong>'+esc(d.litellm?.model||d.ollama?.chat_model||'the configured model')+'</strong></li>'+
                  '<li>Parses the insight: priority, category, recommended action</li>'+
                  '<li>Triggers automation via <strong>Activepieces</strong> webhook</li>'+
                '</ol>'+
                '<p class="card-desc" style="margin-top:12px">If <strong>LiteLLM</strong> is active, all model calls route through it, enabling cloud models (OpenAI, Anthropic, Groq) without changing any application code.</p>'+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }`;
