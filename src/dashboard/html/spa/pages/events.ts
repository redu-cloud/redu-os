export const pgEvents = `async function pgEvents() {
      const src = fv('ev-src');
      const sev = fv('ev-sev');
      const qs = new URLSearchParams({limit:'50'});
      if(src) qs.set('source',src);
      if(sev) qs.set('severity',sev);
      const d = await api('/api/events?'+qs);
      const items = d.items||[];

      const SRCS = ['glitchtip','zammad','uptime-kuma','umami','listmonk','dashboard','custom'];
      const SEVS = ['critical','high','medium','low','info','debug'];

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Events</div>'+
          '<div class="page-sub">Unified event timeline across all sources. Review events, insights, actions, and feedback from one place.</div></div>'+
        '<div class="filter-bar">'+
          '<select class="filter-select" data-filter="ev-src" onchange="go(&apos;events&apos;)">'+
            '<option value="">All sources</option>'+
            SRCS.map(s=>'<option value="'+s+'"'+(src===s?' selected':'')+'>'+s+'</option>').join('')+
          '</select>'+
          '<select class="filter-select" data-filter="ev-sev" onchange="go(&apos;events&apos;)">'+
            '<option value="">All severities</option>'+
            SEVS.map(s=>'<option value="'+s+'"'+(sev===s?' selected':'')+'>'+s+'</option>').join('')+
          '</select>'+
          '<span style="font-size:13px;color:var(--muted)">'+items.length+' events</span>'+
        '</div>'+
        '<div class="card"><table><thead><tr>'+
          '<th style="width:130px">Time</th>'+
          '<th style="width:115px">Source</th>'+
          '<th style="width:85px">Severity</th>'+
          '<th style="width:180px">Type</th>'+
          '<th>Message</th>'+
          '<th style="width:70px">Loop</th>'+
        '</tr></thead><tbody>'+
        (items.length ?
          items.map(e=>'<tr>'+
            '<td class="td-muted">'+esc(fmtDate(e.created_at))+'</td>'+
            '<td>'+badge(e.source,'default')+'</td>'+
            '<td>'+badge(e.severity)+'</td>'+
            '<td class="td-mono">'+esc(trunc(e.type,40))+'</td>'+
            '<td>'+esc(trunc(e.message,120))+'</td>'+
            '<td><button class="btn btn-sm btn-ghost ev-btn" data-id="'+esc(e.id)+'">View</button></td>'+
          '</tr>'+
          '<tr class="ev-detail-row" id="evd-'+esc(e.id)+'" style="display:none"><td colspan="6" style="padding:0"><div class="event-loop" id="evdb-'+esc(e.id)+'"><div class="page-loading" style="min-height:80px"><div class="spin"></div> Loading…</div></div></td></tr>'
          ).join('') :
          '<tr><td colspan="6">'+empty('&#128225;','No events yet','Send an event from Quick Actions or configure a source integration.')+'</td></tr>'
        )+
        '</tbody></table></div></div>';
    }

    async function loadEvtDetail(id) {
      const el = $('evdb-'+id); if(!el) return;
      try {
        const d = await api('/api/events/'+id);
        const e=d.event||{}, ins=d.insights||[], acts=d.actions||[], fb=d.feedback||[];
        const step = (n,label,body) => '<div class="loop-step"><div class="loop-num">'+n+'</div><div style="flex:1"><div class="loop-label">'+label+'</div>'+body+'</div></div>';
        el.innerHTML =
          step(1,'Event','<div class="loop-body">'+badge(e.severity)+' '+badge(e.source,'default')+' <strong>'+esc(e.type)+'</strong><br>'+esc(e.message)+'</div>')+
          step(2,'Memory / Context','<div class="loop-empty">Context retrieved from Qdrant at processing time.</div>')+
          step(3,'AI Insight',ins.length ?
            ins.map(i=>'<div class="loop-body">'+badge(i.priority)+' '+badge(i.category,'default')+'<br><em>'+esc(trunc(i.summary,200))+'</em><br><small style="color:var(--muted)">Action: '+esc(trunc(i.recommended_action,120))+'</small></div>').join('') :
            '<div class="loop-empty">No AI insight generated yet.</div>')+
          step(4,'Recommended / Triggered Action',acts.length ?
            acts.map(a=>'<div class="loop-body">'+badge(a.status)+' <strong>'+esc(a.action_type)+'</strong>'+(a.target?' &rarr; '+esc(a.target):'')+'</div>').join('') :
            '<div class="loop-empty">No action triggered.</div>')+
          step(5,'Feedback / Outcome',fb.length ?
            fb.map(f=>'<div class="loop-body">'+badge(f.feedback_type,'default')+' score: '+(f.score??'--')+' &middot; '+esc(f.result||'--')+'</div>').join('') :
            '<div class="loop-empty">No feedback recorded.</div>');
      } catch(e) { el.innerHTML='<div style="color:var(--red);font-size:13px;padding:8px">'+esc(e.message)+'</div>'; }
    }`;
