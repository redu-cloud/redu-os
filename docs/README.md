# reduOS Docs

Start here:

- [Local Stack and Use Cases](./local-stack-and-use-cases.md)
- [Deployment Modes](./deployment-modes.md)
- [Modular VM Walkthrough](./modular-vm-walkthrough.md)
- [Production Deployment](./production-deployment.md)
- [v1 Readiness And Roadmap](./roadmap.md)
- [Integration Webhooks](./integration-webhooks.md)
- [Activepieces Automation](./activepieces.md)
- [Uptime Kuma Monitoring](./uptime-kuma.md)
- [Umami Analytics](./umami.md)
- [GlitchTip Errors](./glitchtip.md)
- [Listmonk Audience](./listmonk.md)
- [Zammad Support](./zammad.md)
- [Langfuse AI Observability](./langfuse.md)
- [LiteLLM AI Gateway](./litellm.md)
- [LangGraph Agents](./langgraph.md)
- [AI Provider Modes](./ai-provider-modes.md)

The local stack guide covers Supabase, Qdrant, Ollama/DeepSeek, the collector API, curl examples, data inspection, and troubleshooting. The deployment modes guide explains the smallest complete tier and modular split-VM tier. The modular walkthrough gives runnable per-VM commands. The production guide covers DNS, reverse proxying, secrets, backups, upgrades, and smoke tests. The roadmap marks the current stack as the v1 baseline and lists the next dashboard, approval, and automation work. The integration guide shows how real apps post into the collector and how the collector posts to Activepieces. The Langfuse guide shows how to trace collector prompts and model output. The LiteLLM and AI provider guides show how to keep local AI by default while allowing hosted or OpenAI-compatible model providers. The LangGraph guide shows how to run multi-step agent workflows on top of the collector, memory, and model gateway.
