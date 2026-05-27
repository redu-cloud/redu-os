export const pgAgents = `async function pgAgents() {
      let lgOk = false;
      try { const h=await api('/api/langgraph/health'); lgOk=h.ok===true; } catch{}

      const AGENTS = [
        {id:'incident',  emoji:'&#128293;', name:'Incident Responder',  desc:'Handles uptime alerts, error spikes, and production incidents. Retrieves similar past incidents from memory and recommends immediate response actions.', events:'uptime-kuma, GlitchTip, generic', approval:'auto',   memory:'yes', automation:'yes'},
        {id:'support',   emoji:'&#128223;', name:'Support Operator',    desc:'Processes support tickets from Zammad and in-app messages. Identifies repeat issues and surfaces resolution paths from past outcomes.', events:'Zammad, dashboard', approval:'auto',   memory:'yes', automation:'yes'},
        {id:'onboarding',emoji:'&#128640;', name:'Onboarding Agent',    desc:'Tracks user onboarding events from Umami and Listmonk. Flags stuck users and recommends outreach or product improvements.', events:'Umami, Listmonk', approval:'review', memory:'yes', automation:'optional'},
        {id:'product-signal',emoji:'&#128200;', name:'Product Signal Agent', desc:'Aggregates product feedback and usage patterns. Surfaces recurring themes and connects them to growth or retention signals.', events:'Umami, generic', approval:'auto',   memory:'yes', automation:'optional'},
      ];

      return '<div class="page-wrap">'+
        '<div class="page-head">'+
          '<div style="display:flex;align-items:center;justify-content:space-between">'+
            '<div><div class="page-title">Agents</div><div class="page-sub">AI workflows that turn events into actions. Powered by LangGraph.</div></div>'+
            '<span style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:5px 10px;border-radius:6px;background:'+(lgOk?'var(--green-bg)':'var(--red-bg)')+';color:'+(lgOk?'var(--green-text)':'var(--red-text)')+'">'+dot(lgOk)+'LangGraph '+(lgOk?'connected':'offline')+'</span>'+
          '</div>'+
        '</div>'+
        '<div class="agents-grid" style="margin-bottom:20px">'+
          AGENTS.map(a=>'<div class="agent-card">'+
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">'+
              '<span style="font-size:22px">'+a.emoji+'</span>'+
              badge(lgOk?'Active':'Offline', lgOk?'active':'offline')+
            '</div>'+
            '<div class="agent-name">'+esc(a.name)+'</div>'+
            '<div class="agent-desc">'+esc(a.desc)+'</div>'+
            '<div>'+
              '<div class="agent-row"><span>Event sources</span><span class="agent-val">'+esc(a.events)+'</span></div>'+
              '<div class="agent-row"><span>Approval mode</span><span class="agent-val">'+esc(a.approval)+'</span></div>'+
              '<div class="agent-row"><span>Memory</span><span class="agent-val">'+esc(a.memory)+'</span></div>'+
              '<div class="agent-row"><span>Automation</span><span class="agent-val">'+esc(a.automation)+'</span></div>'+
            '</div>'+
            '<button class="btn btn-sm btn-indigo agent-run" data-mode="'+esc(a.id)+'" style="margin-top:12px;width:100%">Invoke agent &rarr;</button>'+
          '</div>').join('')+
        '</div>'+
        '<div class="card">'+
          '<div class="card-head"><span class="card-title">Invoke Agent</span><span style="font-size:12px;color:var(--muted)">Ctrl+Enter to run</span></div>'+
          '<div class="card-body">'+
            '<div class="lg-grid">'+
              '<div class="lg-field"><div class="field-label">Agent</div>'+
                '<select id="lg-mode" class="lg-select"><option value="support">Support Operator</option><option value="incident">Incident Responder</option><option value="onboarding">Onboarding Agent</option><option value="product-signal">Product Signal Agent</option></select>'+
              '</div>'+
              '<div class="lg-field"><div class="field-label">Severity</div>'+
                '<select id="lg-severity" class="lg-select"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="critical">Critical</option></select>'+
              '</div>'+
            '</div>'+
            '<div class="lg-field"><div class="field-label">Message</div><textarea id="lg-message" class="lg-textarea" placeholder="Describe the event or situation..."></textarea></div>'+
            '<div class="lg-field"><div class="field-label">User Email <span style="opacity:.5;font-weight:400;text-transform:none">(optional)</span></div><input id="lg-email" class="lg-input" type="email" placeholder="user@example.com"/></div>'+
            '<div class="lg-toggles">'+
              '<label class="lg-toggle"><input type="checkbox" id="lg-record"/> Record to collector</label>'+
              '<label class="lg-toggle"><input type="checkbox" id="lg-automate"/> Trigger automation</label>'+
            '</div>'+
            '<button id="lg-run" class="btn btn-indigo" style="width:100%">Run Agent</button>'+
            '<div id="lg-results" style="margin-top:12px"></div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }

    function runLg() {
      const msg=$('lg-message')?.value?.trim();
      if(!msg){$('lg-results').innerHTML='<div style="color:var(--muted-2);font-size:13px">Enter a message first.</div>';return;}
      const btn=$('lg-run'); btn.disabled=true;
      $('lg-results').innerHTML='<div class="page-loading" style="min-height:80px"><div class="spin"></div> Running agent workflow…</div>';
      api('/api/langgraph/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        mode:$('lg-mode')?.value, severity:$('lg-severity')?.value,
        message:msg, user_email:$('lg-email')?.value||undefined,
        record_to_collector:$('lg-record')?.checked, trigger_automation:$('lg-automate')?.checked
      })}).then(r=>{
        const i=r.insight||{}, a=r.action||{}, w=r.warnings||[];
        let h='<div style="display:grid;gap:8px">';
        h+='<div style="border:1px solid var(--line);border-radius:8px;padding:10px 12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px">Memory</div>';
        h+='<div style="font-size:13px;color:var(--muted)">'+(r.similar_context?.length||0)+' similar event(s) retrieved from Qdrant</div></div>';
        h+='<div style="border:1px solid var(--line);border-radius:8px;padding:10px 12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px">Insight</div>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">'+badge(i.priority||'--')+badge(i.category||'--','default')+(i.sentiment?'<span style="font-size:12px;color:var(--muted)">'+esc(i.sentiment)+'</span>':'')+'</div>';
        if(i.summary) h+='<div style="font-size:13px;line-height:1.55;margin-bottom:5px">'+esc(i.summary)+'</div>';
        if(i.recommended_action) h+='<div style="font-size:12px;color:var(--muted)"><strong>Action:</strong> '+esc(i.recommended_action)+'</div>';
        h+='</div>';
        h+='<div style="border:1px solid var(--line);border-radius:8px;padding:10px 12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px">Action</div>';
        h+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px">'+badge(a.status||'--')+(a.requires_human_approval?'<span style="font-size:12px;color:var(--amber);font-weight:700">&#9888; Needs Approval</span>':'')+'</div>';
        if(a.action_type) h+='<div style="font-size:12px;color:var(--muted)">'+esc(a.action_type)+(a.target?' &rarr; '+esc(a.target):'')+'</div>';
        h+='</div>';
        if(w.length) h+='<div style="border:1px solid #fcd34d;border-radius:8px;background:#fffbeb;padding:10px 12px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px">Warnings</div>'+w.map(x=>'<div style="font-size:12px;color:var(--amber)">'+esc(String(x))+'</div>').join('')+'</div>';
        h+='</div>';
        $('lg-results').innerHTML=h;
      }).catch(e=>{ $('lg-results').innerHTML='<div style="color:var(--red);font-size:13px">'+esc(e.message)+'</div>'; })
      .finally(()=>{btn.disabled=false;});
    }`;
