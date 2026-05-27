export const pgNotifications = `async function pgNotifications() {
      const d = await api('/api/notifications');

      const editNote = '<p style="margin-top:10px;font-size:11px;color:var(--muted-2)">&#9432; In-memory — resets on restart. Update <code>.env</code> to persist.</p>';
      const saveCancel = sec =>
        '<div style="display:flex;gap:8px;align-items:center;margin-top:12px">'+
          '<button class="btn btn-sm btn-primary notif-save-btn" data-section="'+sec+'">Save</button>'+
          '<button class="btn btn-sm notif-cancel-btn" data-section="'+sec+'">Cancel</button>'+
          '<button class="btn btn-sm notif-test-btn" data-section="'+sec+'" style="margin-left:4px">Test</button>'+
          '<span class="notif-msg" id="'+sec+'-msg" style="font-size:12px"></span>'+
        '</div>';
      const field = (id, label, type, placeholder) =>
        '<div style="margin-bottom:10px">'+
          '<label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">'+esc(label)+'</label>'+
          '<input id="'+id+'" type="'+type+'" class="filter-select" style="width:100%;font-family:inherit" placeholder="'+esc(placeholder)+'"/>'+
        '</div>';

      const discordCard =
        '<div class="card" style="margin-bottom:14px">'+
          '<div class="card-head">'+
            '<span style="font-size:16px;margin-right:8px">💬</span>'+
            '<span class="card-title">Discord</span>'+
            badge(d.discord.configured?'Configured':'Not configured', d.discord.configured?'completed':'disabled')+
            '<button class="btn btn-sm notif-edit-btn" data-section="discord" style="margin-left:auto">Edit</button>'+
          '</div>'+
          '<div id="discord-display" class="card-body">'+
            '<div class="config-row"><span class="config-key">Webhook URL</span>'+
              '<span class="config-val">'+esc(d.discord.url_hint||'not set')+'</span></div>'+
            '<div style="font-size:12px;color:var(--muted);margin-top:8px">'+
              'Create a webhook in Discord: Server Settings → Integrations → Webhooks → New Webhook. Copy the URL.'+
            '</div>'+
          '</div>'+
          '<div id="discord-form" class="card-body" style="display:none">'+
            field('discord-url','Webhook URL','url','https://discord.com/api/webhooks/...')+
            saveCancel('discord')+
            editNote+
          '</div>'+
        '</div>';

      const slackCard =
        '<div class="card" style="margin-bottom:14px">'+
          '<div class="card-head">'+
            '<span style="font-size:16px;margin-right:8px">🔷</span>'+
            '<span class="card-title">Slack</span>'+
            badge(d.slack.configured?'Configured':'Not configured', d.slack.configured?'completed':'disabled')+
            '<button class="btn btn-sm notif-edit-btn" data-section="slack" style="margin-left:auto">Edit</button>'+
          '</div>'+
          '<div id="slack-display" class="card-body">'+
            '<div class="config-row"><span class="config-key">Webhook URL</span>'+
              '<span class="config-val">'+esc(d.slack.url_hint||'not set')+'</span></div>'+
            '<div style="font-size:12px;color:var(--muted);margin-top:8px">'+
              'Create an Incoming Webhook in Slack: App Directory → Incoming Webhooks → Add to Slack. Copy the webhook URL.'+
            '</div>'+
          '</div>'+
          '<div id="slack-form" class="card-body" style="display:none">'+
            field('slack-url','Webhook URL','url','https://hooks.slack.com/services/...')+
            saveCancel('slack')+
            editNote+
          '</div>'+
        '</div>';

      const telegramCard =
        '<div class="card" style="margin-bottom:14px">'+
          '<div class="card-head">'+
            '<span style="font-size:16px;margin-right:8px">✈️</span>'+
            '<span class="card-title">Telegram</span>'+
            badge(d.telegram.configured?'Configured':'Not configured', d.telegram.configured?'completed':'disabled')+
            '<button class="btn btn-sm notif-edit-btn" data-section="telegram" style="margin-left:auto">Edit</button>'+
          '</div>'+
          '<div id="telegram-display" class="card-body">'+
            '<div class="config-row"><span class="config-key">Bot token</span>'+
              '<span class="config-val">'+esc(d.telegram.token_hint||'not set')+'</span></div>'+
            '<div class="config-row"><span class="config-key">Chat ID</span>'+
              '<span class="config-val">'+esc(d.telegram.chat_id||'not set')+'</span></div>'+
            '<div style="font-size:12px;color:var(--muted);margin-top:8px">'+
              'Create a bot via @BotFather and get the token. Get your chat ID by messaging @userinfobot or via the Telegram API.'+
            '</div>'+
          '</div>'+
          '<div id="telegram-form" class="card-body" style="display:none">'+
            field('telegram-token','Bot Token','password','1234567890:ABCDEf...')+
            field('telegram-chat','Chat ID','text','-100123456789 or @channel_name')+
            saveCancel('telegram')+
            editNote+
          '</div>'+
        '</div>';

      const howCard =
        '<div class="card">'+
          '<div class="card-head"><span class="card-title">How It Works</span></div>'+
          '<div class="card-body">'+
            '<p class="card-desc" style="margin-bottom:12px">When reduOS processes an event, it sends a notification to every configured channel:</p>'+
            '<ol style="padding-left:16px;font-size:13px;color:var(--muted);line-height:2">'+
              '<li>Event arrives at the collector and is analysed by AI</li>'+
              '<li>Insight is generated (priority, category, sentiment, action)</li>'+
              '<li>Notification is dispatched to Discord, Slack, and/or Telegram</li>'+
              '<li>Message includes priority, summary, and recommended action</li>'+
            '</ol>'+
            '<p class="card-desc" style="margin-top:12px">Notifications are <strong>independent</strong> of Activepieces automation — they fire on every event regardless of action status.</p>'+
          '</div>'+
        '</div>';

      return '<div class="page-wrap">'+
        '<div class="page-head"><div class="page-title">Notifications</div>'+
          '<div class="page-sub">Send alerts to Discord, Slack, or Telegram when events are processed.</div></div>'+
        '<div class="two-col">'+
          '<div>'+discordCard+slackCard+telegramCard+'</div>'+
          '<div>'+howCard+'</div>'+
        '</div>'+
      '</div>';
    }`;
