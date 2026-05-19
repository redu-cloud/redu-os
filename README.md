# reduOS

**reduOS** — Open-source AI operating system for startup teams.

Run your startup from one command center. Connect your stack, get daily AI insights, and take action.

---

## What is reduOS?

reduOS is a demo product for [redu.cloud](https://redu.cloud). It's a **private command center** that connects your startup infrastructure into one unified dashboard:

- **AI Insights**: Get a daily briefing of what happened in your startup
- **Real-Time Metrics**: See users, support tickets, errors, uptime, and more
- **Smart Recommendations**: AI suggests actions to improve your product
- **Event Stream**: Watch events flow in from all your tools
- **AI Operator**: Ask questions and get answers about your startup

## What It Demonstrates

reduOS shows how to build an **AI-native startup operating system** using open-source tools:

| Component | Tool | Purpose |
|-----------|------|---------|
| **Waitlist** | Listmonk | Track signups and send newsletters |
| **AI** | Ollama + DeepSeek | Local private LLM |
| **Automation** | Activepieces | No-code workflows |
| **Support** | Zammad | AI support ticketing |
| **Analytics** | Umami | Privacy-focused product analytics |
| **Monitoring** | Uptime Kuma | Infrastructure uptime tracking |
| **RAG Database** | Qdrant | Vector database for semantic search |
| **Web Crawler** | Firecrawl | Index docs for RAG |
| **RAG Builder** | Flowise | Build AI agents visually |
| **LLM Observability** | Langfuse | Monitor and debug AI workflows |
| **Backend** | Appwrite | Backend-as-a-service |
| **Error Tracking** | GlitchTip | Catch and fix errors |

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repo
git clone https://github.com/redu-cloud/reduos.git
cd reduos

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and explore the demo.

## Project Structure

```
reduos/
├── app/
│   ├── dashboard/          # Command center
│   ├── operator/           # AI operator chat
│   ├── stack/              # Integration showcase
│   ├── events/             # Event stream
│   ├── actions/            # Recommended actions
│   ├── api/
│   │   ├── pulse/          # GET daily briefing
│   │   ├── operator/       # POST ask AI
│   │   ├── events/         # GET startup events
│   │   ├── actions/        # GET recommended actions
│   │   └── webhooks/event/ # POST receive external events
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # Landing page
├── components/             # React components
├── lib/                    # Utilities and mock data
├── types.ts                # TypeScript types
├── .env.example            # Environment variables
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

## Configuration

### Environment Variables

All integrations are configured via `.env.local`. Copy `.env.example` and fill in your credentials:

```bash
cp .env.example .env.local
```

**Key variables:**

```env
# reduOS
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Local AI (optional)
OLLAMA_BRIDGE_URL=http://localhost:11434
AI_API_KEY=your-key
AI_MODEL=deepseek-r1:1.5b

# Webhook security
REDUOS_WEBHOOK_KEY=demo-key

# Integrations (add as needed)
LISTMONK_URL=http://localhost:9000
ZAMMAD_API_URL=http://localhost/api/v1
UMAMI_WEBSITE_ID=your-id
```

For all available variables, see `.env.example`.

## Pages

### Landing Page (`/`)

Hero, problem, how it works, startup stack showcase, and CTA buttons.

### Dashboard (`/dashboard`)

Main command center. Shows:
- Daily startup pulse (AI briefing)
- Key metrics (users, uptime, errors, etc.)
- Recent events
- Status overview
- Integration health

### AI Operator (`/operator`)

Chat interface. Ask your AI:
- "What happened today?"
- "What should I fix first?"
- "Summarize support issues."
- "Why are users not converting?"
- "Create a weekly founder update."

AI responses are currently mocked for v1. Configure `OLLAMA_BRIDGE_URL` to use real LLMs.

### Stack (`/stack`)

Shows all supported integrations:
- AI & RAG (Ollama, Qdrant, Firecrawl, Flowise)
- Analytics (Umami)
- Support (Zammad)
- Monitoring (Uptime Kuma)
- Automation (Activepieces)
- Backend (Appwrite)
- Error Tracking (GlitchTip)
- Newsletter (Listmonk)

### Events (`/events`)

Real-time event stream. Shows:
- New signups
- Support tickets
- Errors
- Uptime alerts
- AI workflows completed
- RAG documents indexed
- Automations triggered

### Actions (`/actions`)

AI-recommended actions. Shows:
- Suggested actions
- In-progress work
- Completed tasks

## API Routes

### `GET /api/pulse`

Returns daily AI briefing.

```json
{
  "summary": "Your startup had a great day...",
  "keyEvents": ["24 new users", "156 waitlist signups", ...],
  "topIssue": "SSH setup confusion",
  "recommendation": "Improve documentation",
  "nextAction": "Add visual guide to SSH setup"
}
```

### `POST /api/operator`

Ask your AI operator a question.

```bash
curl -X POST http://localhost:3000/api/operator \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What happened today?"}'
```

Response:

```json
{
  "response": "Today your startup gained 24 new users...",
  "timestamp": "2026-05-19T10:00:00Z"
}
```

### `GET /api/events`

Get all startup events.

```bash
curl http://localhost:3000/api/events
```

### `GET /api/actions`

Get recommended actions.

```bash
curl http://localhost:3000/api/actions
```

### `POST /api/webhooks/event`

Receive external events from your tools.

```bash
curl -X POST http://localhost:3000/api/webhooks/event \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key" \
  -d '{
    "type": "support",
    "source": "zammad",
    "title": "User cannot create instance",
    "message": "SSH key configuration is confusing",
    "priority": "high",
    "metadata": {
      "user": "alex_kim",
      "email": "alex@example.com"
    }
  }'
```

Response:

```json
{
  "success": true,
  "received": true,
  "id": "1234567890-0.123"
}
```

## Setting Up Integrations

### 1. Listmonk (Waitlist)

```bash
# Start Listmonk (or use existing instance)
docker run -p 9000:9000 listmonk/listmonk:latest

# Configure in .env.local
LISTMONK_URL=http://localhost:9000
LISTMONK_API_USER=admin
LISTMONK_API_TOKEN=your-token

# Send events to reduOS webhook
```

### 2. Ollama + DeepSeek (Local AI)

```bash
# Install Ollama from https://ollama.ai
# Pull DeepSeek model
ollama pull deepseek-r1:1.5b

# Run Ollama
ollama serve

# Configure in .env.local
OLLAMA_BRIDGE_URL=http://localhost:11434
AI_MODEL=deepseek-r1:1.5b
```

### 3. Zammad (Support)

```bash
# Start Zammad (or use existing instance)
docker run -p 3000:3000 zammad/zammad:latest

# Create API token in Zammad UI
# Configure in .env.local
ZAMMAD_API_URL=http://localhost:3000/api/v1
ZAMMAD_API_TOKEN=your-token

# Configure webhook to POST to /api/webhooks/event
```

### 4. Umami (Analytics)

```bash
# Start Umami or use cloud version
# Create a website in Umami UI

# Configure in .env.local
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://umami.example.com/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id
```

### 5. Uptime Kuma (Monitoring)

```bash
# Start Uptime Kuma
docker run -p 3001:3001 louislam/uptime-kuma:latest

# Create monitors and notifications
# Configure webhook to POST to /api/webhooks/event
```

## Development

### Tech Stack

- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: React 19

### Running Locally

```bash
npm run dev
```

Server starts at [http://localhost:3000](http://localhost:3000).

### Building

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Deployment

### Deploy to redu.cloud

```bash
# Install redu CLI
npm install -g @redu/cli

# Login
redu login

# Deploy
redu deploy
```

### Deploy to Vercel

```bash
vercel
```

### Deploy to Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## Mock Data

For v1, reduOS uses mock data. Files in `lib/`:

- `mock-metrics.ts` — Dashboard metrics
- `mock-events.ts` — Startup events
- `mock-actions.ts` — Recommended actions
- `mock-integrations.ts` — Integration status
- `mock-operator.ts` — AI operator responses

To switch to real data:
1. Replace mock data loaders with API calls
2. Implement database models
3. Add real AI prompts
4. Connect actual integrations

## Roadmap

- [ ] Database integration (Appwrite or Postgres)
- [ ] Real AI responses (configure Ollama/external LLM)
- [ ] User authentication
- [ ] Multi-user teams
- [ ] Real integration webhooks
- [ ] Custom dashboard widgets
- [ ] Scheduled reports
- [ ] Slack/Discord notifications
- [ ] API rate limiting

## Contributing

Contributions welcome! Fork the repo, make changes, and submit a PR.

## License

MIT — Open source, free to use and modify.

## Built with redu.cloud

reduOS is part of the [redu.cloud](https://redu.cloud) **"Building an AI Startup Operating System"** video series.

Learn more at [redu.cloud/ai-os](https://redu.cloud).

---

**Questions?** Open an issue or reach out to the team.

**Ready to run your startup smarter?** [Launch reduOS →](http://localhost:3000)
