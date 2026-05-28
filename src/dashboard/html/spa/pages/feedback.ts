export const pgFeedback = `async function pgFeedback() {
      const d = await api('/api/feedback');
      const items = d.items||[];

      function fbDetail(f) {
        const ev  = f.startup_events||{};
        const act = f.ai_actions||{};
        const meta = f.metadata||{};
        const scoreReason =
          f.feedback_type==='automation_result' ? (f.score>=1 ? 'Automation flow ran successfully to completion.' : 'Automation flow failed to execute.')
        : f.feedback_type==='auto_recovery'     ? 'Service recovered — automation is credited as effective.'
        : f.feedback_type==='action_rejected'   ? 'User manually rejected this automation — negative signal for the AI loop.'
        : f.score>0 ? 'Positive outcome recorded manually.'
        : f.score<0 ? 'Negative outcome recorded manually.'
        : 'Neutral outcome recorded manually.';

        const kv = (k,v) =>
          '<div class="fb-kv">'+
            '<span class="fb-dk">'+esc(k.replace(/_/g,' '))+'</span>'+
            '<span class="fb-dv">'+esc(String(v??'--'))+'</span>'+
          '</div>';
        const metaEntries = Object.entries(meta);

        return '<div class="fb-detail">'+
          '<div style="display:flex;gap:24px;flex-wrap:wrap">'+
            (ev.type||ev.message ?
              '<div style="min-width:200px;flex:2">'+
                '<div class="fb-section-label">Event</div>'+
                (ev.type     ? kv('type',     ev.type)     : '')+
                (ev.source   ? kv('source',   ev.source)   : '')+
                (ev.severity ? kv('severity', ev.severity) : '')+
                (ev.message  ? '<div class="fb-msg">'+esc(trunc(ev.message,300))+'</div>' : '')+
              '</div>' : '')+
            (metaEntries.length ?
              '<div style="min-width:180px;flex:2">'+
                '<div class="fb-section-label">Details</div>'+
                metaEntries.map(([k,v])=>kv(k,v)).join('')+
              '</div>' : '')+
            '<div style="min-width:140px;flex:1">'+
              '<div class="fb-section-label">Score</div>'+
              '<div style="font-size:28px;font-weight:800;color:'+(f.score>0?'var(--green)':f.score<0?'var(--red)':'var(--muted)')+';line-height:1;margin-bottom:8px">'+
                (f.score!=null?(f.score>0?'+':'')+f.score:'--')+
              '</div>'+
              '<div style="font-size:12px;color:var(--muted);line-height:1.5">'+esc(scoreReason)+'</div>'+
            '</div>'+
          '</div>'+
        '</div>';
      }

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Feedback</div>'+
          '<div class="page-sub">Record what worked and what did not. Feedback helps the system learn and prioritise future actions.</div></div>'+
        (items.length ?
          '<div class="card" style="margin-bottom:16px"><table><thead><tr>'+
            '<th style="width:130px">Time</th>'+
            '<th style="width:170px">Type</th>'+
            '<th style="width:60px">Score</th>'+
            '<th>Event</th>'+
            '<th style="width:110px">Result</th>'+
            '<th style="width:80px"></th>'+
          '</tr></thead><tbody>'+
          items.map(f=>{
            const ev=f.startup_events||{};
            const scoreColor = f.score>0?'var(--green)':f.score<0?'var(--red)':'var(--muted)';
            const scoreLabel = f.score!=null?(f.score>0?'+':'')+f.score:'--';
            return '<tr>'+
              '<td class="td-muted">'+esc(fmtDate(f.created_at))+'</td>'+
              '<td>'+badge(f.feedback_type,'default')+'</td>'+
              '<td style="font-weight:800;color:'+scoreColor+'">'+esc(scoreLabel)+'</td>'+
              '<td class="td-muted">'+esc(trunc(ev.type||'--',60))+'</td>'+
              '<td class="td-muted">'+esc(trunc(f.result||'--',40))+'</td>'+
              '<td><button class="btn btn-sm fb-exp-btn" data-id="'+esc(f.id)+'">Details</button></td>'+
            '</tr>'+
            '<tr class="fb-detail-row" id="fbd-'+esc(f.id)+'" style="display:none">'+
              '<td colspan="6" style="padding:0">'+fbDetail(f)+'</td>'+
            '</tr>';
          }).join('')+
          '</tbody></table></div>' :
          '<div class="card" style="margin-bottom:16px">'+empty('&#128077;','No feedback yet','Feedback is recorded when automations complete. You can also submit it manually below.')+'</div>'
        )+
        '<div class="card">'+
          '<div class="card-head"><span class="card-title">Submit Feedback</span></div>'+
          '<div class="card-body">'+
            '<div style="display:grid;gap:10px;max-width:480px">'+
              '<div class="lg-field"><div class="field-label">Event ID</div><input id="fb-eid" class="lg-input" placeholder="Paste event UUID..."/></div>'+
              '<div class="lg-field"><div class="field-label">Feedback Type</div>'+
                '<select id="fb-type" class="lg-select">'+
                  '<option value="helpful">Helpful</option>'+
                  '<option value="not_helpful">Not Helpful</option>'+
                  '<option value="correct_priority">Correct Priority</option>'+
                  '<option value="wrong_priority">Wrong Priority</option>'+
                  '<option value="automate_next">Automate Next Time</option>'+
                  '<option value="keep_manual">Keep Manual</option>'+
                '</select>'+
              '</div>'+
              '<div class="lg-field"><div class="field-label">Score (0&ndash;1, optional)</div><input id="fb-score" class="lg-input" type="number" min="0" max="1" step="0.1" placeholder="0.8"/></div>'+
              '<div class="lg-field"><div class="field-label">Notes</div><input id="fb-notes" class="lg-input" placeholder="What happened?"/></div>'+
              '<button id="fb-submit" class="btn btn-primary">Submit Feedback</button>'+
              '<div id="fb-msg" style="font-size:13px"></div>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }`;
