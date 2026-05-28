export const pgActions = `async function pgActions() {
      const st = fv('act-st');
      const qs = new URLSearchParams({limit:'50'});
      if(st) qs.set('status',st);
      const d = await api('/api/actions?'+qs);
      const items = d.items||[];

      function actDetail(a) {
        const ev  = a.startup_events||{};
        const ins = Array.isArray(a.ai_insights) ? (a.ai_insights[0]||null) : (a.ai_insights||null);
        return '<div class="fb-detail">'+
          '<div style="display:flex;gap:24px;flex-wrap:wrap">'+
            (ev.message||ev.type ?
              '<div style="min-width:220px;flex:2">'+
                '<div class="fb-section-label">Event</div>'+
                (ev.type    ? '<div class="fb-kv"><span class="fb-dk">type</span><span class="fb-dv">'+esc(ev.type)+'</span></div>' : '')+
                (ev.source  ? '<div class="fb-kv"><span class="fb-dk">source</span><span class="fb-dv">'+esc(ev.source)+'</span></div>' : '')+
                (ev.severity? '<div class="fb-kv"><span class="fb-dk">severity</span><span class="fb-dv">'+esc(ev.severity)+'</span></div>' : '')+
                (ev.message ? '<div class="fb-msg">'+esc(trunc(ev.message,400))+'</div>' : '')+
              '</div>' : '')+
            (ins ?
              '<div style="min-width:220px;flex:2">'+
                '<div class="fb-section-label">AI Assessment</div>'+
                (ins.category ? '<div class="fb-kv"><span class="fb-dk">category</span><span class="fb-dv">'+esc(ins.category)+'</span></div>' : '')+
                (ins.priority ? '<div class="fb-kv"><span class="fb-dk">priority</span><span class="fb-dv">'+esc(ins.priority)+'</span></div>' : '')+
                (ins.summary  ? '<div class="fb-msg" style="margin-top:8px">'+esc(ins.summary)+'</div>' : '')+
                (ins.recommended_action ? '<div class="fb-kv" style="margin-top:8px"><span class="fb-dk">do</span><span class="fb-dv" style="color:var(--ink)">'+esc(ins.recommended_action)+'</span></div>' : '')+
              '</div>' : '')+
            '<div style="min-width:140px;flex:0">'+
              '<div class="fb-section-label">Automation</div>'+
              '<div class="fb-kv"><span class="fb-dk">target</span><span class="fb-dv">'+esc(a.target||'--')+'</span></div>'+
              '<div class="fb-kv"><span class="fb-dk">status</span>'+badge(a.status)+'</div>'+
              (a.completed_at ? '<div class="fb-kv"><span class="fb-dk">done</span><span class="fb-dv">'+esc(fmtDate(a.completed_at))+'</span></div>' : '')+
            '</div>'+
          '</div>'+
        '</div>';
      }

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Actions</div>'+
          '<div class="page-sub">Connect tools, remember what happened, reason over context, and automate the next step.</div></div>'+
        '<div class="filter-bar">'+
          '<select class="filter-select" data-filter="act-st" onchange="go(&apos;actions&apos;)">'+
            '<option value="">All statuses</option>'+
            ['suggested','pending_approval','approved','triggered','completed','failed','rejected'].map(s=>'<option value="'+s+'"'+(st===s?' selected':'')+'>'+s+'</option>').join('')+
          '</select>'+
          '<span style="font-size:13px;color:var(--muted)">'+items.length+' actions</span>'+
        '</div>'+
        (items.length ?
          '<div class="card"><table><thead><tr>'+
            '<th style="width:130px">Time</th>'+
            '<th style="width:150px">Status</th>'+
            '<th style="width:190px">Event</th>'+
            '<th>AI summary</th>'+
            '<th style="width:170px">Controls</th>'+
            '<th style="width:80px"></th>'+
          '</tr></thead><tbody>'+
          items.map(a=>{
            const ev  = a.startup_events||{};
            const ins = Array.isArray(a.ai_insights) ? (a.ai_insights[0]||null) : (a.ai_insights||null);
            const canApprove  = a.status==='pending_approval'||a.status==='suggested';
            const canComplete = a.status==='approved'||a.status==='triggered';
            const sevColor = {critical:'var(--red)',high:'var(--red)',medium:'var(--amber)',low:'var(--amber)'}[ev.severity]||'';
            return '<tr>'+
              '<td class="td-muted">'+esc(fmtDate(a.created_at))+'</td>'+
              '<td>'+badge(a.status)+'</td>'+
              '<td>'+
                (ev.type ? '<div style="font-size:12px;font-weight:600;color:var(--ink-2)">'+esc(trunc(ev.type,40))+'</div>' : '')+
                (ev.source ? '<div style="font-size:11px;color:var(--muted)">'+esc(ev.source)+(ev.severity&&sevColor?' &middot; <span style="color:'+sevColor+';font-weight:700">'+esc(ev.severity.toUpperCase())+'</span>':'')+'</div>' : '')+
              '</td>'+
              '<td class="td-muted">'+esc(trunc(ins&&ins.summary ? ins.summary : ev.message||'--', 120))+'</td>'+
              '<td>'+
                (canApprove ?
                  '<button class="btn btn-sm btn-success act-approve" data-id="'+esc(a.id)+'" style="margin-right:4px">&#10003; Approve</button>'+
                  '<button class="btn btn-sm btn-danger act-reject" data-id="'+esc(a.id)+'">&#10007; Reject</button>' :
                  canComplete ?
                  '<button class="btn btn-sm act-complete" data-id="'+esc(a.id)+'">&#10003; Mark done</button>' :
                  '<span style="font-size:12px;color:var(--muted-2)">'+(a.completed_at?fmtDate(a.completed_at):'--')+'</span>'
                )+
              '</td>'+
              '<td><button class="btn btn-sm act-det-btn" data-id="'+esc(a.id)+'">Details</button></td>'+
            '</tr>'+
            '<tr class="act-detail-row" id="actd-'+esc(a.id)+'" style="display:none">'+
              '<td colspan="6" style="padding:0">'+actDetail(a)+'</td>'+
            '</tr>';
          }).join('')+
          '</tbody></table></div>' :
          '<div class="card"><div style="padding:24px">'+empty('&#9654;','No actions yet','Actions are created when events are processed. Send events or run the demo.')+'</div></div>'
        )+
      '</div>';
    }`;
