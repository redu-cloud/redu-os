# v1 Readiness And Roadmap

This document separates the publishable v1 baseline from the next planned work.

## v1 Baseline

The current repo is ready to present as a small, self-hosted reduOS v1 baseline.

Implemented:

- Collector API for generic events and use-case webhooks.
- Supabase schema and local Supabase bootstrap.
- Qdrant semantic memory with collector memory search.
- Local Ollama/DeepSeek analysis with fallback behavior.
- LiteLLM as an optional OpenAI-compatible model gateway.
- LangGraph as an optional multi-step agent workflow service.
- Langfuse as optional AI observability.
- Activepieces automation setup.
- Optional modules for Uptime Kuma, Umami, GlitchTip, Listmonk, and Zammad.
- Local dashboard with Supabase Auth.
- Same-machine modular stack and split-VM documentation.
- Demo scripts, smoke tests, status/log/reset commands, and fresh-clone verification.

The v1 story:

```text
Event -> Collector -> Supabase -> Qdrant memory -> AI insight -> optional LangGraph workflow -> optional automation -> feedback
```

Default small tier:

```text
Collector
Dashboard
Supabase
Qdrant
Ollama + DeepSeek
```

Optional v1 modules:

```text
LiteLLM
LangGraph
Langfuse
Activepieces
Uptime Kuma
Umami
GlitchTip
Listmonk
Zammad
```

Before publishing, run:

```bash
npm run check
npm run lint:scripts
npm run verify:fresh
```

For a local end-to-end demo:

```bash
npm run modular:local:up
npm run modular:litellm:up
npm run modular:langgraph:up
npm run demo:full
npm run demo:memory
npm run demo:langgraph
```

## Next Step: Dashboard LangGraph Controls

The next feature should make LangGraph usable from the dashboard instead of only through curl.

Add a dashboard panel for:

- LangGraph health and configured AI provider.
- Agent mode selector: support, incident, onboarding, product signal.
- Event input form with severity, message, user, and metadata.
- Toggles for `record_to_collector` and `trigger_automation`.
- Similar memory results used by the workflow.
- Final insight and recommended action.
- Human approval status.
- Raw warnings when the workflow had to repair or fallback.

This turns the current backend capability into a visible product workflow.

## Next Step: Human Approval Loop

After LangGraph is visible in the dashboard, add an approval loop.

Flow:

```text
LangGraph recommends an action
-> dashboard shows pending approval
-> user approves or rejects
-> collector records ai_actions and ai_feedback
-> approved actions can trigger automation
```

Expected additions:

- Dashboard list of pending actions.
- Approve/reject buttons.
- Feedback note field.
- Collector action/feedback examples for approved and rejected outcomes.
- Optional webhook trigger only after approval.

## Next Step: Agent-To-Automation Execution

Once approvals exist, wire LangGraph recommendations into Activepieces safely.

Flow:

```text
Approved LangGraph action -> Activepieces webhook -> external tool action -> collector records result
```

Start with low-risk actions:

- Create a support follow-up task.
- Send a Discord notification.
- Add a Listmonk tag.
- Create a Zammad internal note.

Keep high-risk actions behind human approval.

## Next Step: Publishing Polish

Before a public release, do a documentation and packaging pass.

Checklist:

- Add screenshots or terminal recordings for the local stack, dashboard, LiteLLM, LangGraph, and Langfuse.
- Add a short `docs/quickstart.md` if the README becomes too long.
- Add release notes for `v0.1.0`.
- Confirm `.env`, `.local/`, generated secrets, logs, and runtime volumes are not tracked.
- Run a fresh clone test on a clean machine.
- Decide which optional modules are marked experimental.

## Later

Good later work, after the dashboard and approval loop:

- LangGraph workflow templates per use case.
- Tenant/project separation.
- More production deployment examples.
- Backup/restore scripts.
- Better model evaluation examples using Langfuse traces.
- Hosted-provider examples through LiteLLM.
- Kubernetes or systemd deployment templates.
