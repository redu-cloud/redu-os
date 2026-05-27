export const pgOverview = `async function pgOverview() {
      const d = await api('/api/summary');
      const sv = d.services||{};
      const ev = d.events||[], ins = d.insights||[], act = d.actions||[], fb = d.feedback||[];
      const failed = act.filter(a=>a.status==='failed');
      const pending = act.filter(a=>a.status==='pending_approval');
      const downSvcs = Object.entries(sv).filter(([,ok])=>!ok);
      const svcOk = Object.values(sv).filter(Boolean).length;

      const attention = [
        ...failed.map(a=>({ico:'&#10060;', txt:'Failed action: '+esc(a.action_type), sub:esc(a.target||'')})),
        ...pending.map(a=>({ico:'&#9203;',  txt:'Pending approval: '+esc(a.action_type), sub:'needs manual review'})),
        ...downSvcs.map(([n])=>({ico:'&#128308;', txt:'Service down: '+esc(n), sub:'check integrations'})),
      ].slice(0,6);

      const timeline = [
        ...ev.slice(0,4).map(x=>({...x,_k:'event'})),
        ...ins.slice(0,3).map(x=>({...x,_k:'insight'})),
        ...act.slice(0,3).map(x=>({...x,_k:'action'})),
        ...fb.slice(0,2).map(x=>({...x,_k:'feedback'})),
      ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,10);

      const c = d.counts||{};
      return '<div class="page-wrap">'+
        '<div class="overview-hero">'+
          '<div class="hero-status"><span class="dot dot-ok dot-lg"></span><h1>Your operative loop is running</h1></div>'+
          '<div class="loop-viz">Events &rarr; Memory &rarr; AI &rarr; Automation &rarr; Feedback</div>'+
        '</div>'+
        '<div class="metrics-grid">'+
          mkMetric('Events', c.events??'--','processed total')+
          mkMetric('Insights', c.insights??'--','AI generated')+
          mkMetric('Actions', c.actions??'--','automations')+
          mkMetric('Pending', pending.length,'needs approval')+
          mkMetric('Feedback', c.feedback??'--','outcomes')+
          mkMetric('Services', svcOk+'/'+Object.keys(sv).length,'connected')+
        '</div>'+
        '<div class="two-col">'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Recent Activity</span><button class="btn btn-sm" id="ov-refresh">Refresh</button></div>'+
              '<div style="padding:0 16px">'+
                (timeline.length ?
                  '<div class="timeline">'+
                  timeline.map(t=>{
                    const tlLabel =
                      t._k==='action'
                        ? esc(trunc((t.action_type||'action')+(t.target?' → '+t.target:''),100))
                        : esc(trunc(t.message||t.summary||(typeof t.result==='string'?t.result:'')||t.feedback_type||t._k,100));
                    return '<div class="tl-item">'+
                      '<span class="tl-dot tl-'+esc(t._k)+'"></span>'+
                      '<div><div style="font-size:13px;color:var(--ink-2)">'+badge(t._k)+' &nbsp;'+tlLabel+'</div>'+
                      '<div class="tl-meta">'+esc(fmtDate(t.created_at))+' &middot; '+esc(t.source||t.category||t.action_type||t.feedback_type||'')+'</div></div>'+
                    '</div>';
                  }).join('')+
                  '</div>' :
                  empty('&#127744;','No activity yet','Send events using Quick Actions below.')
                )+
              '</div>'+
            '</div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Quick Actions</span><span style="font-size:12px;color:var(--muted)">Send sample events to test the loop</span></div>'+
              '<div class="card-body">'+
                '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">'+
                  '<button class="btn" data-event="support">&#128223; Demo Support Ticket</button>'+
                  '<button class="btn" data-event="reliability">&#128293; Demo Incident</button>'+
                  '<button class="btn" data-event="growth">&#128200; Demo Trial Signup</button>'+
                  '<button class="btn" data-event="product">&#128172; Demo Product Feedback</button>'+
                  '<button class="btn btn-primary" id="ov-demo-full">&#9654; Run Full Demo Loop</button>'+
                  '<button class="btn" onclick="go(&apos;memory&apos;)">&#128269; Search Memory</button>'+
                '</div>'+
                '<div class="log-box" id="ov-log" style="min-height:56px">Ready.</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Needs Attention</span>'+
                (attention.length ? badge(attention.length,'failed') : badge('All clear','completed'))+
              '</div>'+
              '<div style="padding:0 16px">'+
                (attention.length ?
                  attention.map(a=>'<div class="att-item"><span>'+a.ico+'</span><div><div>'+a.txt+'</div><div class="tl-meta">'+a.sub+'</div></div></div>').join('') :
                  empty('&#9989;','All clear','No failed actions or pending approvals.')
                )+
              '</div>'+
            '</div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Core Services</span></div>'+
              '<div style="padding:0 12px">'+
                Object.entries(sv).map(([name,ok])=>
                  '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--line);font-size:13px">'+
                    '<span style="font-weight:600;color:var(--ink-2)">'+esc(name)+'</span>'+
                    '<span style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:'+(ok?'var(--green)':'var(--red)')+'">'+dot(ok)+(ok?'OK':'DOWN')+'</span>'+
                  '</div>'
                ).join('')+
              '</div>'+
            '</div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Open</span></div>'+
              '<div class="card-body" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">'+
                Object.entries(d.links||{}).map(([n,url])=>
                  '<a href="'+esc(url)+'" target="_blank" rel="noreferrer" class="btn btn-sm">'+esc(n.replaceAll('_',' '))+'</a>'
                ).join('')+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }`;
