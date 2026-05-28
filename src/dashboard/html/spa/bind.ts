export const spaBind = `
    /* ─── page dispatch ─────────────────────────────── */
    const PAGES = {
      overview:       pgOverview,
      events:         pgEvents,
      insights:       pgInsights,
      actions:        pgActions,
      memory:         pgMemory,
      agents:         pgAgents,
      integrations:   pgIntegrations,
      'ai-config':    pgAiConfig,
      notifications:  pgNotifications,
      feedback:       pgFeedback,
      settings:       pgSettings,
      logs:           pgLogs,
    };

    /* ─── after-render bindings ─────────────────────────── */
    const BIND = {
      overview() {
        $('ov-refresh')?.addEventListener('click', ()=>renderPage('overview'));
        $('ov-demo-full')?.addEventListener('click', async function(){
          this.disabled=true; const lb=$('ov-log');
          lb.textContent='Running full demo loop...';
          try { const r=await api('/api/demo/full',{method:'POST'}); lb.textContent=[r.stdout,r.stderr].filter(Boolean).join('\\n'); setTimeout(()=>renderPage('overview'),600); }
          catch(e){lb.textContent=e.message;} finally{this.disabled=false;}
        });
        document.querySelectorAll('[data-event]').forEach(btn=>btn.addEventListener('click',async function(){
          this.disabled=true; const lb=$('ov-log');
          lb.textContent='Sending '+this.dataset.event+' event...';
          try { const r=await api('/api/event/'+this.dataset.event,{method:'POST'}); lb.textContent=JSON.stringify(r,null,2); setTimeout(()=>renderPage('overview'),600); }
          catch(e){lb.textContent=e.message;} finally{this.disabled=false;}
        }));
      },
      events() {
        _sseResetBanner();
        document.querySelectorAll('.ev-btn').forEach(btn=>btn.addEventListener('click',async function(e){
          e.stopPropagation();
          const id=this.dataset.id;
          const row=$('evd-'+id);
          if(!row) return;
          const isOpen=row.style.display==='table-row';
          document.querySelectorAll('.ev-detail-row').forEach(r=>r.style.display='none');
          if(!isOpen){ row.style.display='table-row'; await loadEvtDetail(id); }
        }));
      },
      actions() {
        async function updAct(id,status,btn){
          btn.disabled=true;
          try { await api('/api/actions/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}); renderPage('actions'); }
          catch(e){alert(e.message);btn.disabled=false;}
        }
        document.querySelectorAll('.act-approve').forEach(b=>b.addEventListener('click',()=>updAct(b.dataset.id,'approved',b)));
        document.querySelectorAll('.act-reject').forEach(b=>b.addEventListener('click',()=>updAct(b.dataset.id,'rejected',b)));
        document.querySelectorAll('.act-complete').forEach(b=>b.addEventListener('click',()=>updAct(b.dataset.id,'completed',b)));
      },
      memory() {
        const run=()=>doMemSearch($('mem-q').value);
        $('mem-go')?.addEventListener('click',run);
        $('mem-q')?.addEventListener('keydown',e=>{if(e.key==='Enter')run();});
        document.querySelectorAll('.example-q').forEach(el=>el.addEventListener('click',()=>{$('mem-q').value=el.dataset.q;run();}));
        setTimeout(run,100);
      },
      agents() {
        document.querySelectorAll('.agent-run').forEach(btn=>btn.addEventListener('click',()=>{
          const m=$('lg-mode'); if(m) m.value=btn.dataset.mode;
          $('lg-message')?.focus();
        }));
        $('lg-run')?.addEventListener('click',runLg);
        $('lg-message')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey))runLg();});
      },
      'ai-config'() {
        // Provider toggle
        document.querySelectorAll('.prov-switch').forEach(btn=>btn.addEventListener('click',async function(){
          const prov=this.dataset.prov;
          const msg=$('prov-msg');
          document.querySelectorAll('.prov-switch').forEach(b=>{b.disabled=true;});
          if(msg){msg.textContent='Switching…';msg.style.color='var(--muted)';}
          try {
            await api('/api/ai-config/provider',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:prov})});
            if(msg){msg.textContent='Switched to '+prov;msg.style.color='var(--green)';}
            setTimeout(()=>renderPage('ai-config'),600);
          } catch(e) {
            if(msg){msg.textContent=e.message;msg.style.color='var(--red)';}
            document.querySelectorAll('.prov-switch').forEach(b=>{b.disabled=false;});
          }
        }));

        function populateSel(sel, models, current) {
          sel.innerHTML='';
          models.forEach(m=>{
            const o=document.createElement('option');
            o.value=m; o.textContent=m;
            if(m===current) o.selected=true;
            sel.appendChild(o);
          });
          if(!sel.value && models.length) sel.value=models[0];
        }
        function populateGroupedSel(sel, groups, current) {
          sel.innerHTML='';
          groups.forEach(g=>{
            const og=document.createElement('optgroup');
            og.label=g.label;
            g.models.forEach(m=>{
              const o=document.createElement('option');
              o.value=m; o.textContent=m;
              if(m===current) o.selected=true;
              og.appendChild(o);
            });
            sel.appendChild(og);
          });
          if(!sel.value&&groups.length&&groups[0].models.length) sel.value=groups[0].models[0];
        }

        // Edit toggles
        document.querySelectorAll('.ai-edit-btn').forEach(btn=>btn.addEventListener('click',async function(){
          const sec=this.dataset.section;
          $(sec+'-display').style.display='none';
          $(sec+'-form').style.display='';
          this.style.display='none';

          if(sec==='ollama'){
            const chatSel=$('ollama-chat-model'), embedSel=$('ollama-embed-model');
            chatSel.innerHTML='<option>Loading…</option>';
            embedSel.innerHTML='<option>Loading…</option>';
            try {
              const r=await api('/api/ai-config/ollama-models');
              // Read current displayed values
              const rows=$(sec+'-display').querySelectorAll('.config-val');
              const curChat=rows[1]?.textContent||'';
              const curEmbed=rows[2]?.textContent||'';
              populateSel(chatSel, r.chat||[], curChat);
              populateSel(embedSel, r.embed||[], curEmbed);
            } catch(e){
              chatSel.innerHTML='<option>Error loading models</option>';
              embedSel.innerHTML='<option>Error loading models</option>';
            }
          } else if(sec==='litellm'){
            const modelSel=$('litellm-model');
            modelSel.innerHTML='<option>Loading…</option>';
            try {
              const r=await api('/api/ai-config/litellm-models');
              const rows=$(sec+'-display').querySelectorAll('.config-val');
              const curModel=rows[1]?.textContent||'';
              populateGroupedSel(modelSel, r.groups||[], curModel);
            } catch(e){
              modelSel.innerHTML='<option>Error loading models</option>';
            }
          }
        }));

        // Cancel
        document.querySelectorAll('.ai-cancel-btn').forEach(btn=>btn.addEventListener('click',function(){
          const sec=this.dataset.section;
          $(sec+'-display').style.display='';
          $(sec+'-form').style.display='none';
          document.querySelector('.ai-edit-btn[data-section="'+sec+'"]').style.display='';
          const msg=$(sec+'-msg'); if(msg) msg.textContent='';
        }));

        // Save
        document.querySelectorAll('.ai-save-btn').forEach(btn=>btn.addEventListener('click',async function(){
          const sec=this.dataset.section;
          const msg=$(sec+'-msg');
          this.disabled=true;
          if(msg){msg.textContent='Saving…';msg.style.color='var(--muted)';}
          try {
            let body={};
            if(sec==='litellm'){
              const key=$('litellm-api-key').value;
              body={
                ai_chat_model:$('litellm-model').value,
                ...(key?{ai_chat_api_key:key}:{})
              };
            } else if(sec==='ollama'){
              body={
                ollama_model:$('ollama-chat-model').value,
                ollama_embed_model:$('ollama-embed-model').value
              };
            }
            await api('/api/ai-config',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
            if(msg){msg.textContent='Saved';msg.style.color='var(--green)';}
            setTimeout(()=>renderPage('ai-config'),700);
          } catch(e){
            if(msg){msg.textContent=e.message;msg.style.color='var(--red)';}
            this.disabled=false;
          }
        }));
      },
      notifications() {
        // Edit toggle
        document.querySelectorAll('.notif-edit-btn').forEach(btn=>btn.addEventListener('click',function(){
          const sec=this.dataset.section;
          $(sec+'-display').style.display='none';
          $(sec+'-form').style.display='';
          this.style.display='none';
        }));
        // Cancel
        document.querySelectorAll('.notif-cancel-btn').forEach(btn=>btn.addEventListener('click',function(){
          const sec=this.dataset.section;
          $(sec+'-display').style.display='';
          $(sec+'-form').style.display='none';
          document.querySelector('.notif-edit-btn[data-section="'+sec+'"]').style.display='';
          const msg=$(sec+'-msg'); if(msg) msg.textContent='';
        }));
        // Save
        document.querySelectorAll('.notif-save-btn').forEach(btn=>btn.addEventListener('click',async function(){
          const sec=this.dataset.section;
          const msg=$(sec+'-msg');
          this.disabled=true;
          if(msg){msg.textContent='Saving…';msg.style.color='var(--muted)';}
          try {
            let body={};
            if(sec==='discord')  body={discord_webhook_url:$('discord-url').value};
            if(sec==='slack')    body={slack_webhook_url:$('slack-url').value};
            if(sec==='telegram') body={telegram_bot_token:$('telegram-token').value,telegram_chat_id:$('telegram-chat').value};
            await api('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
            if(msg){msg.textContent='Saved';msg.style.color='var(--green)';}
            setTimeout(()=>renderPage('notifications'),700);
          } catch(e){
            if(msg){msg.textContent=e.message;msg.style.color='var(--red)';}
            this.disabled=false;
          }
        }));
        // Test
        document.querySelectorAll('.notif-test-btn').forEach(btn=>btn.addEventListener('click',async function(){
          const sec=this.dataset.section;
          const msg=$(sec+'-msg');
          this.disabled=true;
          if(msg){msg.textContent='Sending test…';msg.style.color='var(--muted)';}
          try {
            await api('/api/notifications/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:sec})});
            if(msg){msg.textContent='Test sent! Check your '+sec+'.';msg.style.color='var(--green)';}
          } catch(e){
            if(msg){msg.textContent=e.message;msg.style.color='var(--red)';}
          } finally{this.disabled=false;}
        }));
      },
      integrations() {
        // Legacy copy-url buttons (kept for backward compat)
        document.querySelectorAll('.copy-url').forEach(btn=>btn.addEventListener('click',async function(){
          await navigator.clipboard.writeText(this.dataset.url).catch(()=>{});
          const o=this.textContent; this.textContent='Copied!';
          setTimeout(()=>this.textContent=o,1500);
        }));
        // Snippet copy buttons (single + multi-pane)
        document.querySelectorAll('.int-copy').forEach(btn=>btn.addEventListener('click',async function(){
          await navigator.clipboard.writeText(this.dataset.code).catch(()=>{});
          const o=this.textContent; this.textContent='Copied!'; this.style.color='var(--green)';
          setTimeout(()=>{this.textContent=o;this.style.color='';},2000);
        }));
      },
      settings() {
        $('reset-btn')?.addEventListener('click',async function(){
          const confirmed = window.confirm(
            'This will permanently delete ALL events, AI insights, actions, feedback, and memory vectors.\\n\\n' +
            'AI configuration and notification settings are NOT affected.\\n\\n' +
            'This cannot be undone. Continue?'
          );
          if(!confirmed) return;
          const btn=this, msg=$('reset-msg');
          btn.disabled=true; btn.textContent='Resetting…';
          if(msg){msg.textContent='';msg.style.color='';}
          try {
            const r = await api('/api/reset',{method:'POST'});
            if(msg){msg.textContent='✓ All data cleared successfully.';msg.style.color='var(--green)';}
            // Re-show onboarding widget (first-event / first-insight steps are now unmet again)
            localStorage.removeItem('reduos-onboarding-v1');
            localStorage.removeItem('reduos-ob-skip-notif');
            var obEl=document.getElementById('ob-widget'); if(obEl) obEl.remove();
            initOnboarding();
            // Refresh current page after a moment
            setTimeout(()=>renderPage('settings'),1200);
          } catch(e){
            if(msg){msg.textContent=e.message;msg.style.color='var(--red)';}
            btn.disabled=false; btn.textContent='Reset data';
          }
        });
      },
      feedback() {
        $('fb-submit')?.addEventListener('click',async function(){
          const eid=$('fb-eid')?.value?.trim(), msg=$('fb-msg');
          if(!eid){msg.textContent='Event ID is required.';msg.style.color='var(--red)';return;}
          this.disabled=true;
          try {
            await api('/api/feedback/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
              startup_event_id:eid, feedback_type:$('fb-type')?.value,
              score:$('fb-score')?.value?Number($('fb-score').value):undefined,
              result:$('fb-notes')?.value||undefined
            })});
            msg.textContent='Feedback submitted.'; msg.style.color='var(--green)';
            setTimeout(()=>renderPage('feedback'),500);
          } catch(e){msg.textContent=e.message;msg.style.color='var(--red)';this.disabled=false;}
        });
      },
      logs() {
        let current = null;

        async function loadLogs(name) {
          current = name;
          const tail = $('log-tail')?.value || '200';
          const filter = ($('log-filter')?.value || '').toLowerCase();
          const body = $('log-body');
          const title = $('log-title');
          if (!body) return;
          body.innerHTML = '<div class="log-empty">Loading…</div>';
          if (title) title.textContent = name;
          try {
            const d = await api('/api/containers/'+encodeURIComponent(name)+'/logs?tail='+tail);
            const lines = (d.lines || []).filter(l => !filter || l.text.toLowerCase().includes(filter));
            if (!lines.length) {
              body.innerHTML = '<div class="log-empty">'+(filter ? 'No lines match filter' : 'No logs')+'</div>';
              return;
            }
            body.innerHTML = lines.map(l =>
              '<div class="log-line '+l.stream+'">'+esc(l.text)+'</div>'
            ).join('');
            body.scrollTop = body.scrollHeight;
          } catch(e) {
            body.innerHTML = '<div class="log-empty" style="color:#ff7b72">'+esc(e.message)+'</div>';
          }
        }

        document.querySelectorAll('.citem').forEach(el => el.addEventListener('click', function() {
          document.querySelectorAll('.citem').forEach(x => x.classList.remove('active'));
          this.classList.add('active');
          loadLogs(this.dataset.cname);
        }));
        $('log-refresh')?.addEventListener('click', () => { if (current) loadLogs(current); });
        $('log-tail')?.addEventListener('change', () => { if (current) loadLogs(current); });
        $('log-filter')?.addEventListener('input', () => { if (current) loadLogs(current); });

        // Auto-select first container
        const first = document.querySelector('.citem');
        if (first) { first.classList.add('active'); loadLogs(first.dataset.cname); }
      }
    };

    /* ─── nav wiring ────────────────────────────────────── */
    document.querySelectorAll('.nav-item').forEach(el=>
      el.addEventListener('click',e=>{e.preventDefault(); go(el.dataset.page);})
    );
    $('sidebar-signout')?.addEventListener('click',async()=>{
      await fetch('/api/auth/logout',{method:'POST'});
      window.location.href='/login';
    });
    window.addEventListener('popstate',()=>{
      const pg=(window.location.hash.slice(1)||'overview').replace(/[^a-z0-9-]/g,'');
      const p=VALID.has(pg)?pg:'overview';
      CUR=p; activate(p); renderPage(p);
    });

    /* ─── theme toggle ──────────────────────────────────── */
    (function initTheme() {
      const saved = localStorage.getItem('reduos-theme') || 'light';
      if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    })();
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('reduos-theme', next);
    });

    /* ─── SSE live feed ─────────────────────────────────── */
    connectSse();

    /* ─── init ──────────────────────────────────────────── */
    (function(){
      const pg=(window.location.hash.slice(1)||'overview').replace(/[^a-z0-9-]/g,'');
      const p=VALID.has(pg)?pg:'overview';
      CUR=p; activate(p); renderPage(p);
      initOnboarding();
    })();`;
