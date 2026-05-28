export const spaOnboarding = `
    /* ─── Onboarding widget ──────────────────────────── */
    const OB_KEY        = 'reduos-onboarding-v1';
    const OB_SKIP_NOTIF = 'reduos-ob-skip-notif';

    function obDismissed() {
      return localStorage.getItem(OB_KEY) === 'dismissed';
    }

    function dismissOnboarding() {
      localStorage.setItem(OB_KEY, 'dismissed');
      var el = document.getElementById('ob-widget');
      if (!el) return;
      el.style.transition   = 'opacity .22s ease,transform .22s ease';
      el.style.opacity      = '0';
      el.style.transform    = 'translateY(12px)';
      setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 240);
    }
    window.dismissOnboarding = dismissOnboarding;

    function skipNotifications() {
      localStorage.setItem(OB_SKIP_NOTIF, '1');
      var el = document.getElementById('ob-widget');
      if (el) el.remove();
      initOnboarding();
    }
    window.skipNotifications = skipNotifications;

    function skipService(id) {
      localStorage.setItem('reduos-ob-skip-' + id, '1');
      var el = document.getElementById('ob-widget');
      if (el) el.remove();
      initOnboarding();
    }
    window.skipService = skipService;

    function isServiceSkipped(id) {
      return !!localStorage.getItem('reduos-ob-skip-' + id);
    }

    /* Build one step row — text stacked above actions so buttons never crowd the title */
    function obStep(isDone, ico, title, desc, actions) {
      return '<div class="ob-step' + (isDone ? ' ob-done' : '') + '">' +
        '<span class="ob-chk' + (isDone ? ' ob-chk-ok' : '') + '">' + (isDone ? '&#10003;' : '') + '</span>' +
        '<span class="ob-ico">' + ico + '</span>' +
        '<div class="ob-step-main">' +
          '<div class="ob-step-body">' +
            '<div class="ob-step-title">' + title + '</div>' +
            '<div class="ob-step-desc">' + desc + '</div>' +
          '</div>' +
          (!isDone ? '<div class="ob-actions">' + actions + '</div>' : '') +
        '</div>' +
      '</div>';
    }

    async function initOnboarding() {
      if (obDismissed()) return;

      var host = document.getElementById('ob-widget');
      if (!host) {
        host = document.createElement('div');
        host.id = 'ob-widget';
        document.body.appendChild(host);
      }

      var ob = {};
      try { ob = await api('/api/onboarding'); } catch { return; }

      var steps    = ob.steps    || {};
      var services = ob.services || [];
      var notifSkipped = !!localStorage.getItem(OB_SKIP_NOTIF);

      /* Count completed steps */
      var coreIds  = ['ai','notifications','first_event','first_insight'];
      var coreDone = coreIds.filter(function(k){
        if (k === 'notifications' && notifSkipped) return true;
        return !!steps[k];
      }).length;

      /* Services: done only when user explicitly skipped via button */
      var svcDone = services.filter(function(s){ return isServiceSkipped(s.id); }).length;

      var total = coreIds.length + services.length;
      var done  = coreDone + svcDone;
      var pct   = Math.round(done / Math.max(total,1) * 100);

      /* ── All done ── */
      if (done === total) {
        host.innerHTML =
          '<div class="ob-card ob-card-done">' +
            '<div class="ob-inner">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
                '<div>' +
                  '<div class="ob-title">&#127881; You&apos;re all set!</div>' +
                  '<div class="ob-sub">All setup steps complete.</div>' +
                '</div>' +
                '<button class="btn btn-sm btn-primary" onclick="dismissOnboarding()">Dismiss</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        return;
      }

      /* ── Core steps ── */
      var html = '';

      // AI step — two buttons when not done
      html += obStep(
        !!steps.ai,
        '&#129302;', 'Configure AI',
        steps.ai ? 'AI provider is active.' : 'Choose a provider to start analysing events.',
        '<button class="btn btn-sm ob-go" onclick="go(&apos;ai-config&apos;)">Local (Ollama) &rarr;</button>' +
        '<button class="btn btn-sm ob-go" onclick="go(&apos;ai-config&apos;)">Cloud (LiteLLM) &rarr;</button>'
      );

      // Notifications step — with per-step skip
      var notifDone = !!steps.notifications || notifSkipped;
      html += obStep(
        notifDone,
        '&#128276;', 'Set up notifications',
        notifDone ? 'Notification channel active.' : 'Connect Discord, Slack, or Telegram.',
        '<button class="btn btn-sm ob-go" onclick="go(&apos;notifications&apos;)">Configure &rarr;</button>' +
        '<button class="btn btn-sm btn-ghost ob-go" onclick="skipNotifications()">Skip</button>'
      );

      // First event
      html += obStep(
        !!steps.first_event,
        '&#128268;', 'Send your first event',
        steps.first_event ? 'Events are flowing in.' : 'Run the demo or send a real event from your app.',
        '<button class="btn btn-sm ob-go" onclick="go(&apos;overview&apos;)">Try demo &rarr;</button>'
      );

      // First insight
      html += obStep(
        !!steps.first_insight,
        '&#128161;', 'Review an AI insight',
        steps.first_insight ? 'AI insights are being generated.' : 'Appears after your first event is processed.',
        '<button class="btn btn-sm ob-go" onclick="go(&apos;insights&apos;)">View &rarr;</button>'
      );

      /* ── Per-service steps ── */
      services.forEach(function(svc) {
        var skipped = isServiceSkipped(svc.id);
        var evLabel = svc.events === 1 ? '1 event' : svc.events + ' events';
        var descDone = skipped
          ? 'Skipped.'
          : svc.name + ' connected (' + evLabel + ' received).';
        var descTodo = 'Connect ' + svc.name + ' to start receiving events.';
        var evHint   = (!skipped && svc.events > 0)
          ? ' <span style="color:var(--green);font-size:10px">&#10003; ' + evLabel + ' received</span>'
          : '';
        html += obStep(
          skipped,
          '&#128279;', 'Connect ' + svc.name,
          (skipped ? descDone : descTodo) + evHint,
          '<button class="btn btn-sm ob-go" onclick="go(&apos;integrations&apos;)">Set up &rarr;</button>' +
          '<button class="btn btn-sm btn-ghost ob-go" onclick="skipService(&apos;' + svc.id + '&apos;)">Skip</button>'
        );
      });

      host.innerHTML =
        '<div class="ob-card">' +
          '<div class="ob-inner">' +
            '<div class="ob-head">' +
              '<div>' +
                '<div class="ob-title">Set up reduOS</div>' +
                '<div class="ob-sub">Get your operative loop running</div>' +
              '</div>' +
              '<div class="ob-pill">' + done + '&thinsp;/&thinsp;' + total + '</div>' +
            '</div>' +
            '<div class="ob-bar-wrap"><div class="ob-bar" style="width:' + pct + '%"></div></div>' +
            '<div class="ob-steps">' + html + '</div>' +
            '<div class="ob-footer">' +
              '<button class="btn btn-ghost btn-sm" onclick="dismissOnboarding()">Skip for now</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
`;
