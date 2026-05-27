export const pgMemory = `async function pgMemory() {
      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Memory</div>'+
          '<div class="page-sub">Memory helps reduOS use previous events and outcomes when making future recommendations.</div></div>'+
        '<div class="two-col">'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Search Operational Memory</span></div>'+
              '<div class="card-body">'+
                '<div class="search-row">'+
                  '<input class="search-input" id="mem-q" placeholder="Search operational memory..." value="customers blocked during onboarding"/>'+
                  '<button class="btn btn-primary" id="mem-go">Search</button>'+
                '</div>'+
                '<div class="example-queries">'+
                  ['Show similar incidents to API outage','What happened last time payment failed?','Which support issues repeat most?','Find onboarding drop-off events'].map(q=>
                    '<span class="example-q" data-q="'+esc(q)+'">'+esc(q)+'</span>'
                  ).join('')+
                '</div>'+
                '<div id="mem-results">'+empty('&#128190;','Memory is ready','Send events or run a demo to build context. Then search across past events, outcomes, and patterns.')+'</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">About Memory</span></div>'+
              '<div class="card-body">'+
                '<p class="card-desc" style="margin-bottom:12px">reduOS stores every processed event as a vector in Qdrant. When a new event arrives, the AI retrieves the most similar past events to provide context for its reasoning.</p>'+
                '<p class="card-desc" style="margin-bottom:12px">This lets the system reason: <em>"Last time this happened, we did X and it worked."</em></p>'+
                '<div style="font-size:12px;color:var(--muted-2);display:grid;gap:6px;margin-top:12px;font-family:ui-monospace,monospace">'+
                  '<div>Collection: redu_os_events</div>'+
                  '<div>Embedding: nomic-embed-text (768-dim)</div>'+
                  '<div>Similarity: cosine</div>'+
                '</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }

    async function doMemSearch(q) {
      const el=$('mem-results');
      el.innerHTML='<div class="page-loading" style="min-height:80px"><div class="spin"></div> Searching…</div>';
      try {
        const d=await api('/api/memory/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q,limit:6})});
        const items=d.items||[];
        if(!items.length){el.innerHTML=empty('&#128270;','No matches','No similar events found. Try a different query.');return;}
        el.innerHTML=items.map(it=>
          '<div class="mem-result">'+
            '<div class="mem-score">Score '+Math.round((it.score||0)*100)+'%</div>'+
            '<div style="font-size:13px;color:var(--ink-2);margin-bottom:3px">'+esc(trunc(it.event?.message||it.event?.type||'event',200))+'</div>'+
            '<div style="font-size:11px;color:var(--muted-2)">'+esc(it.event?.source||'')+' &middot; '+esc(fmtDate(it.event?.created_at))+'</div>'+
          '</div>'
        ).join('');
      } catch(e){el.innerHTML='<div style="color:var(--red);font-size:13px">'+esc(e.message)+'</div>';}
    }`;
