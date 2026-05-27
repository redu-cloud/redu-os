export const pgInsights = `async function pgInsights() {
      const pri = fv('ins-pri');
      const qs  = new URLSearchParams({limit:'50'});
      if(pri) qs.set('priority',pri);
      const d = await api('/api/insights?'+qs);
      const items = d.items||[];

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Insights</div>'+
          '<div class="page-sub">What AI concluded &mdash; from event context to recommended action.</div></div>'+
        '<div class="filter-bar">'+
          '<select class="filter-select" data-filter="ins-pri" onchange="go(&apos;insights&apos;)">'+
            '<option value="">All priorities</option>'+
            ['critical','high','medium','low'].map(p=>'<option value="'+p+'"'+(pri===p?' selected':'')+'>'+p+'</option>').join('')+
          '</select>'+
          '<span style="font-size:13px;color:var(--muted)">'+items.length+' insights</span>'+
        '</div>'+
        (items.length ?
          items.map(i=>{
            const ev=i.startup_events||{};
            return '<div class="card" style="margin-bottom:10px"><div style="padding:14px 16px">'+
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">'+
                '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">'+badge(i.priority)+badge(i.category,'default')+(i.sentiment?'<span style="font-size:12px;color:var(--muted)">'+esc(i.sentiment)+'</span>':'')+'</div>'+
                '<span style="font-size:11px;color:var(--muted-2);white-space:nowrap;flex-shrink:0">'+esc(fmtDate(i.created_at))+'</span>'+
              '</div>'+
              '<div style="font-size:14px;color:var(--ink-2);line-height:1.55;margin-bottom:10px">'+esc(i.summary)+'</div>'+
              '<div style="font-size:12px;color:var(--muted);margin-bottom:8px"><strong>Recommended:</strong> '+esc(i.recommended_action||'--')+'</div>'+
              '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--muted-2)">'+
                (i.ai_model?'<span>Model: '+esc(i.ai_model)+'</span>':'')+
                (ev.type?'<span>From: '+esc(ev.type)+' &middot; '+esc(ev.source)+'</span>':'')+
              '</div>'+
            '</div></div>';
          }).join('') :
          '<div class="card">'+empty('&#129504;','No insights yet','AI insights are generated automatically when events are processed. Send an event or run the demo to see insights here.')+'</div>'
        )+
      '</div>';
    }`;
