# DepScope

Autonomous multi-agent AI system for open-source dependency due diligence. DepScope answers a critical question before you `npm install`: **should you actually trust this package?**

**Live demo:** [devscope-xsjm.onrender.com](https://devscope-xsjm.onrender.com/)

## What It Does

DepScope runs a three-agent pipeline to analyze npm packages and produces:

- **Letter grades (A–F)** based on weighted risk dimensions (security, maintenance, stability, community, documentation)
- **Severity-ranked findings** with actionable recommendations
- **Alternative packages** with migration difficulty ratings
- **Voice alerts** via Plivo when CRITICAL vulnerabilities are detected
- **Real-time streaming UI** showing agent progress as it happens

### The Three Agents

| Agent | Role | Data Sources |
|-------|------|-------------|
| **Repo Health Analyzer** | Evaluates repository vitals — stars, contributors, commit frequency, bus factor, issue close rate, release cadence | GitHub REST API |
| **External Researcher** | Searches for CVEs, community sentiment, and alternative libraries | You.com Search API |
| **Risk Scorer** | Synthesizes both agents' data into a weighted score with findings and recommendations | Google Gemini |

Agents 1 and 2 run in parallel. Agent 3 synthesizes their results into a final assessment.

### Scoring

Five dimensions, weighted:

| Dimension | Weight |
|-----------|--------|
| Security | 30% |
| Maintenance | 25% |
| Stability | 20% |
| Community | 15% |
| Documentation | 10% |

**Auto-downgrades:** Unpatched CRITICAL CVE caps grade at C. Single maintainer + 90 days stale caps at D. Archived repo is an automatic F.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express 5 |
| AI/LLM | Google Gemini (flash models with fallback chain) |
| AI Orchestration | Composio SDK (with direct-execution fallback) |
| Web Research | You.com Search API |
| Repository Data | GitHub REST API |
| Voice Alerts | Plivo (calls + SMS) |
| Frontend | React 18 + TypeScript + Vite |
| UI Components | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| Animations | Framer Motion |
| Streaming | Server-Sent Events (SSE) |

## Project Structure

```
DepScope/
├── src/                        # Backend
│   ├── server.js               # Express app, API routes, pipeline orchestration
│   ├── config.js               # Environment config
│   └── services/
│       ├── githubService.js    # GitHub API queries
│       ├── youService.js       # You.com search (CVEs, sentiment, alternatives)
│       ├── geminiService.js    # Gemini AI risk synthesis
│       ├── composioService.js  # Composio agent orchestration
│       ├── plivoService.js     # Voice/SMS alerts
│       ├── watchlistService.js # Background monitoring with cron
│       ├── reportService.js    # DEPSCOPE.md report generation
│       └── demoCache.js        # Cached fallback data for demos
├── Frontend/                   # React/Vite frontend
│   └── src/
│       ├── pages/              # Index, Recommendations, Watchlist
│       ├── components/         # AgentStatusCard, GradeDisplay, RadarChart, etc.
│       ├── contexts/           # AnalysisContext
│       └── hooks/              # Custom React hooks
├── Documentation/              # Project docs, roadmap, changelogs
└── test*.js                    # Integration tests
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Clone the repo

```bash
git clone https://github.com/Eman-Gon/DepScope.git
cd DepScope
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```env
PORT=3000
GITHUB_TOKEN=           # https://github.com/settings/tokens
GEMINI_API_KEY=          # https://aistudio.google.com/apikey
YOU_API_KEY=             # https://you.com/api
COMPOSIO_API_KEY=        # Optional — falls back to direct execution
PLIVO_AUTH_ID=           # Optional — for voice/SMS alerts
PLIVO_AUTH_TOKEN=        # Optional
PLIVO_PHONE_NUMBER=      # Optional
```

### 3. Install and run the backend

```bash
npm install
npm run dev    # Starts on http://localhost:3000
```

### 4. Install and run the frontend

```bash
cd Frontend
npm install
npm run dev    # Starts on http://localhost:8080
```

## API Endpoints

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Start analysis (`{ "input": "lodash" }`) |
| GET | `/api/analyze/:id/stream` | SSE stream of agent progress |
| GET | `/api/analyze/:id/result` | Full analysis result |
| POST | `/api/analyze/:id/generate-report` | Generate DEPSCOPE.md report |

### Watchlist
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/watchlist` | List watched packages |
| POST | `/api/watchlist` | Add package to watchlist |
| DELETE | `/api/watchlist/:id` | Remove from watchlist |
| POST | `/api/watchlist/scan` | Trigger immediate scan |

### Patterns & Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patterns` | Aggregated insights across analyses |
| GET | `/health` | Health check |

## Resilience & Fallbacks

DepScope is designed to degrade gracefully:

1. **Composio orchestration** — if the API key is present, agents are coordinated through Composio. If unavailable, falls back to direct parallel execution.
2. **Gemini model chain** — tries `gemini-3-flash-preview`, falls back to `gemini-2.5-flash`.
3. **Demo cache** — pre-cached analyses for lodash, moment, and express ensure the app works even without API keys.

## License

ISC
