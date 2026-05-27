export const pgLogs = `async function pgLogs() {
      const d = await api('/api/containers');
      const containers = d.items || [];

      // Group by service family — only project containers arrive from the API
      const FAMILIES = [
        { key:'reduOS',   label:'reduOS',   prefixes:['redu-os-'],                        stripRe:/^redu-os-/ },
        { key:'Supabase', label:'Supabase', prefixes:['supabase-','realtime-'],            stripRe:/^(supabase-|realtime-dev\.)/ },
        { key:'Zammad',   label:'Zammad',   prefixes:['zammad_'],                          stripRe:/^zammad_zammad-|^zammad_/ },
      ];
      const groups = {};
      for (const c of containers) {
        const fam = FAMILIES.find(f => f.prefixes.some(p => c.name.startsWith(p)));
        const key = fam ? fam.key : null;
        if (!key) continue;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ ...c, _label: c.name.replace(fam.stripRe,'') });
      }

      const listHtml = FAMILIES.filter(f => groups[f.key]?.length).map(f =>
        '<span class="cgroup-label">'+esc(f.label)+'</span>'+
        groups[f.key].map(c =>
          '<div class="citem" data-cname="'+esc(c.name)+'">'+
            '<div style="overflow:hidden">'+
              '<div class="citem-name" title="'+esc(c.name)+'">'+esc(c._label)+'</div>'+
              '<div class="citem-img">'+esc(c.image)+'</div>'+
            '</div>'+
            '<span class="badge badge-'+(c.state==='running'?'completed':'failed')+'" style="flex-shrink:0;margin-left:4px">'+esc(c.state)+'</span>'+
          '</div>'
        ).join('')
      ).join('');

      return '<div class="logs-shell">'+
        '<div class="log-sidebar">'+
          '<div class="log-sidebar-head">'+containers.length+' containers</div>'+
          '<div class="log-sidebar-body" id="clist">'+listHtml+'</div>'+
        '</div>'+
        '<div class="log-main">'+
          '<div class="log-topbar">'+
            '<span class="log-title" id="log-title">Select a container</span>'+
            '<input id="log-filter" class="log-input" type="text" placeholder="Filter…" />'+
            '<select id="log-tail" class="log-select">'+
              '<option value="50">50 lines</option>'+
              '<option value="100">100 lines</option>'+
              '<option value="200" selected>200 lines</option>'+
              '<option value="500">500 lines</option>'+
              '<option value="1000">1000 lines</option>'+
            '</select>'+
            '<button id="log-refresh" class="log-btn">&#8635; Refresh</button>'+
          '</div>'+
          '<div class="log-body" id="log-body"><div class="log-empty">Select a container from the list</div></div>'+
        '</div>'+
      '</div>';
    }`;
