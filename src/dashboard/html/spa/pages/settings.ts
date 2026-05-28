export const pgSettings = `async function pgSettings() {
      const d = await api('/api/settings');
      const inst=d.instance||{}, feat=d.features||{}, urls=d.urls||{};
      const cfgRow = (k,v) => '<div class="config-row"><span class="config-key">'+esc(k)+'</span><span class="config-val">'+esc(String(v??'--'))+'</span></div>';

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Settings</div>'+
          '<div class="page-sub">Instance configuration and feature flags.</div></div>'+
        '<div class="two-col">'+
          '<div>'+
            '<div class="card" style="margin-bottom:14px">'+
              '<div class="card-head"><span class="card-title">Instance</span></div>'+
              '<div class="card-body">'+
                cfgRow('Name', inst.name)+
                cfgRow('Version', inst.version)+
                cfgRow('Dashboard auth', inst.dashboard_auth_enabled)+
                cfgRow('Collector API key', d.api_key_hint)+
              '</div>'+
            '</div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Service URLs</span></div>'+
              '<div class="card-body">'+
                Object.entries(urls).map(([k,v])=>cfgRow(k.replaceAll('_',' '),v)).join('')+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div>'+
            '<div class="card">'+
              '<div class="card-head"><span class="card-title">Feature Flags</span></div>'+
              '<div class="card-body">'+
                '<div class="flags-grid">'+
                  Object.entries(feat).map(([k,v])=>
                    '<div class="flag-card">'+
                      '<span class="flag-name">'+esc(k.replaceAll('_',' '))+'</span>'+
                      '<span class="'+(v?'flag-on':'flag-off')+'">'+(v?'ON':'OFF')+'</span>'+
                    '</div>'
                  ).join('')+
                '</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>'+
        '<div class="danger-zone">'+
          '<div class="danger-zone-title">&#9888; Danger Zone</div>'+
          '<div class="danger-zone-body">'+
            '<div>'+
              '<div class="danger-zone-label">Reset all data</div>'+
              '<div class="danger-zone-desc">Permanently deletes all events, AI insights, actions, feedback, and memory vectors. AI config and notification settings are preserved.</div>'+
            '</div>'+
            '<button id="reset-btn" class="btn btn-danger">Reset data</button>'+
          '</div>'+
          '<div id="reset-msg" style="font-size:12px;margin-top:8px"></div>'+
        '</div>'+
      '</div>';
    }`;
