export const pgFeedback = `async function pgFeedback() {
      const d = await api('/api/feedback');
      const items = d.items||[];

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Feedback</div>'+
          '<div class="page-sub">Record what worked and what did not. Feedback helps the system learn and prioritise future actions.</div></div>'+
        (items.length ?
          '<div class="card" style="margin-bottom:16px"><table><thead><tr>'+
            '<th style="width:130px">Time</th>'+
            '<th style="width:150px">Type</th>'+
            '<th style="width:65px">Score</th>'+
            '<th>Event</th>'+
            '<th>Result</th>'+
          '</tr></thead><tbody>'+
          items.map(f=>{
            const ev=f.startup_events||{};
            return '<tr>'+
              '<td class="td-muted">'+esc(fmtDate(f.created_at))+'</td>'+
              '<td>'+badge(f.feedback_type,'default')+'</td>'+
              '<td style="font-weight:700;color:var(--ink-2)">'+(f.score!=null?f.score:'--')+'</td>'+
              '<td class="td-muted">'+esc(trunc(ev.type||'--',60))+'</td>'+
              '<td class="td-muted">'+esc(trunc(f.result||JSON.stringify(f.metadata||{}),120))+'</td>'+
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
