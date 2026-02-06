# DepScope

Autonomous multi-agent system for open-source dependency due diligence. Analyzes package health, security vulnerabilities, community sentiment, and alternatives before you `npm install`.

## Architecture

Node.js + Express backend with three sequential agents orchestrated in `src/server.js`:

1. **Repo Health Analyzer** (`src/services/githubService.js`) — GitHub REST API for stars, forks, commit frequency, bus factor, issue response times, license, dependency count
2. **External Researcher** (`src/services/youService.js`) — You.com Search API for CVE lookups, community sentiment (Reddit/HN), and alternative package discovery
3. **Risk Scorer** (`src/services/geminiService.js`) — Gemini 2.0 Flash synthesizes all data into a letter grade (A-F), severity-ranked findings, alternatives, and an opinionated verdict

Additional services:
- `src/services/plivoService.js` — Plivo voice call + SMS alerts when CRITICAL findings are detected
- `src/services/demoCache.js` — Pre-cached analysis results for lodash, moment, and express (fallback when APIs are unavailable)

## Project Structure

```
src/
  config.js              # Environment variable loader (dotenv)
  server.js              # Express API server, SSE streaming, analysis pipeline, pattern aggregation
  services/
    githubService.js     # GitHub API: repo stats, commit frequency, bus factor, issues
    youService.js        # You.com Search: CVEs, sentiment, alternatives
    geminiService.js     # Gemini AI: risk synthesis, scoring, grade assignment
    plivoService.js      # Plivo: voice alerts, SMS
    demoCache.js         # Hardcoded fallback data for 3 packages
test.js                  # GitHub service test
test-you.js              # You.com API test
test-demo.js             # Full pipeline with cached research data
test-full.js             # End-to-end pipeline test (all 3 APIs)
```

## API Endpoints

```
POST /api/analyze                          # Start analysis (body: { input: "lodash" | "https://github.com/user/repo" })
GET  /api/analyze/:id/stream               # SSE stream of agent progress
GET  /api/analyze/:id/result               # Full analysis result JSON
GET  /api/patterns                         # Aggregated insights across analyses
POST /api/alert/configure                  # Register phone for voice alerts (body: { phone: "+1..." })
GET  /api/plivo/voice-xml/:analysisId      # Plivo answer URL (XML for voice call)
POST /api/plivo/handle-input/:analysisId   # Plivo DTMF handler (1=send SMS, 2=dismiss)
GET  /                                     # Health check
GET  /health                               # Health check
```

## Setup

```bash
cp .env.example .env
# Fill in API keys: GITHUB_TOKEN, YOU_COM_API_KEY, GEMINI_API_KEY, PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_PHONE_NUMBER
npm install
npm run dev    # nodemon with auto-reload
npm start      # production
```

## Environment Variables

All loaded in `src/config.js` via dotenv. See `.env.example` for the full list. The server runs without any keys — GitHub works unauthenticated (60 req/hr limit), and missing API keys trigger fallback to cached demo data.

## Key Design Decisions

- **CommonJS modules** (`"type": "commonjs"` in package.json) — all files use `require`/`module.exports`
- **In-memory storage** — analyses, SSE clients, and history are stored in plain objects/arrays (no database)
- **Sequential pipeline with fallback** — agents run sequentially (repo health → research → synthesis), each step falls back to `demoCache.js` if the API call fails
- **SSE for real-time updates** — the frontend connects to `/api/analyze/:id/stream` for live agent status
- **Retry with backoff** — `withRetry()` helper wraps each agent call (2 retries, linear backoff)

## Scoring Algorithm

Weighted average of 5 dimensions (0-100 each):
- Security: 30%
- Maintenance: 25%
- Stability: 20%
- Community: 15%
- Documentation: 10%

Grade thresholds: A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, F < 35

Auto-downgrades: unpatched CRITICAL CVE → max C, single maintainer + 90 days stale → max D, archived repo → F

## Testing

```bash
node test.js        # Test GitHub service only (needs GITHUB_TOKEN for reliability)
node test-you.js    # Test You.com search (needs YOU_COM_API_KEY)
node test-demo.js   # Full pipeline using cached research (needs GEMINI_API_KEY)
node test-full.js   # Full end-to-end (needs all API keys)
```

## Outstanding Work

See `thingstofix.md` for the current task list. Key items: Lovable dashboard frontend, Composio orchestration integration, Render deployment, Plivo end-to-end testing, demo video recording.
