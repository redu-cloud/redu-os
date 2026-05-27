export const pgActions = `async function pgActions() {
      const st = fv('act-st');
      const qs = new URLSearchParams({limit:'50'});
      if(st) qs.set('status',st);
      const d = await api('/api/actions?'+qs);
      const items = d.items||[];

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
        '<div class="card"><table><thead><tr>'+
          '<th style="width:130px">Time</th>'+
          '<th style="width:170px">Action Type</th>'+
          '<th style="width:110px">Status</th>'+
          '<th style="width:140px">Target</th>'+
          '<th>Event</th>'+
          '<th style="width:170px">Controls</th>'+
        '</tr></thead><tbody>'+
        (items.length ?
          items.map(a=>{
            const ev=a.startup_events||{};
            const canApprove = a.status==='pending_approval'||a.status==='suggested';
            const canComplete = a.status==='approved'||a.status==='triggered';
            return '<tr>'+
              '<td class="td-muted">'+esc(fmtDate(a.created_at))+'</td>'+
              '<td class="td-fw">'+esc(a.action_type)+'</td>'+
              '<td>'+badge(a.status)+'</td>'+
              '<td class="td-muted">'+esc(a.target||'--')+'</td>'+
              '<td class="td-muted">'+esc(trunc(ev.type||ev.message||'--',80))+'</td>'+
              '<td>'+
                (canApprove ?
                  '<button class="btn btn-sm btn-success act-approve" data-id="'+esc(a.id)+'" style="margin-right:4px">&#10003; Approve</button>'+
                  '<button class="btn btn-sm btn-danger act-reject" data-id="'+esc(a.id)+'">&#10007; Reject</button>' :
                  canComplete ?
                  '<button class="btn btn-sm act-complete" data-id="'+esc(a.id)+'">&#10003; Mark done</button>' :
                  '<span style="font-size:12px;color:var(--muted-2)">'+esc(a.completed_at?fmtDate(a.completed_at):'--')+'</span>'
                )+
              '</td>'+
            '</tr>';
          }).join('') :
          '<tr><td colspan="6">'+empty('&#9654;','No actions yet','Actions are created when events are processed. Send events or run the demo.')+'</td></tr>'
        )+
        '</tbody></table></div></div>';
    }`;
