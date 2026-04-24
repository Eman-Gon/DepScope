# DepScope

Autonomous multi-agent system for open-source dependency due diligence. Analyzes package health, security vulnerabilities, community sentiment, and alternatives before you `npm install`.

Project skill: `.claude/skills/depscope-project`

## Architecture

Node.js + Express backend with a Composio-first three-agent pipeline orchestrated in `src/server.js`. Agents 1 and 2 run in parallel, then Agent 3 synthesizes the result. If Composio is unavailable or fails, the server falls back to direct execution and then cached demo data when possible.

1. **Repo Health Analyzer** (`src/services/githubService.js`) — GitHub REST API for stars, forks, commit cadence, bus factor, releases, archived/deprecated status, and repo metadata
2. **External Researcher** (`src/services/youService.js`) — You.com Search API for CVE lookups, community sentiment, and alternative package discovery
3. **Risk Scorer** (`src/services/geminiService.js`) — Gemini flash-model fallback chain synthesizes all data into a letter grade (A-F), weighted scores, severity-ranked findings, alternatives, and an opinionated verdict

Additional services:
- `src/services/composioService.js` — Registers custom Composio tools and orchestrates the three-agent flow
- `src/services/reportService.js` — Generates `DEPSCOPE.md` markdown for export or publish
- `src/services/watchlistService.js` — In-memory watchlist scans, cron scheduling, and F-grade alert report generation
- `src/services/plivoService.js` — Plivo voice call + SMS alerts when CRITICAL findings are detected
- `src/services/demoCache.js` — Pre-cached analysis results for lodash, moment, and express (fallback when APIs are unavailable)

## Project Structure

```
src/
  config.js              # Environment variable loader (dotenv)
  server.js              # Express API server, SSE streaming, orchestration selection, reports, alerts, watchlist
  services/
    composioService.js   # Composio custom tools + orchestration
    githubService.js     # GitHub API: repo stats, bus factor, releases, write access, report publishing
    youService.js        # You.com Search: CVEs, sentiment, alternatives
    geminiService.js     # Gemini AI: risk synthesis, weighted score, grade assignment
    reportService.js     # DEPSCOPE.md generation
    watchlistService.js  # Watchlist scans, cron, alert summaries
    plivoService.js      # Plivo: voice alerts, SMS
    demoCache.js         # Hardcoded fallback data for 3 packages
test.js                  # GitHub service test
test-you.js              # You.com API test
test-demo.js             # Full pipeline with cached research data
test-full.js             # End-to-end pipeline test (all 3 APIs)
Frontend/                # React + TypeScript dashboard, watchlist UI, report actions
```

## API Endpoints

```
POST /api/analyze                          # Start analysis (body: { input: "lodash" | "https://github.com/user/repo" })
GET  /api/analyze/:id/stream               # SSE stream of agent progress
GET  /api/analyze/:id/result               # Full analysis result JSON
POST /api/analyze/:id/generate-report      # Generate DEPSCOPE.md markdown
POST /api/analyze/:id/publish-report       # Commit DEPSCOPE.md to analyzed repo
GET  /api/patterns                         # Aggregated insights across analyses
POST /api/alert/configure                  # Register phone for voice alerts (body: { phone: "+1..." })
GET  /api/composio/status                  # Show orchestration mode and registered tools
GET  /api/plivo/voice-xml/:analysisId      # Plivo answer URL (XML for voice call)
POST /api/plivo/handle-input/:analysisId   # Plivo DTMF handler (1=send SMS, 2=dismiss)
GET  /api/watchlist                        # List watched repos
POST /api/watchlist                        # Add a watched repo
DELETE /api/watchlist/:id                  # Remove a watched repo
POST /api/watchlist/scan                   # Trigger immediate watchlist scan
POST /api/watchlist/cron                   # Start or stop scheduled scans
GET  /api/watchlist/scans                  # Watchlist scan history
GET  /api/watchlist/voice-xml/:scanId      # Plivo voice XML for watchlist alerts
POST /api/watchlist/handle-input/:scanId   # DTMF handler for watchlist alerts
GET  /                                     # Health check
GET  /health                               # Health check
GET  /debug                                # Runtime config/debug info
```

## Setup

```bash
cp .env.example .env
# Fill in API keys: GITHUB_TOKEN, YOU_COM_API_KEY, GEMINI_API_KEY, COMPOSIO_API_KEY, PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_PHONE_NUMBER
npm install
npm run dev    # nodemon with auto-reload
npm start      # production
cd Frontend && npm install
```

## Environment Variables

All loaded in `src/config.js` via dotenv. See `.env.example` for the full list. The server can still run with missing keys, but behavior degrades: GitHub falls back to unauthenticated limits, missing Composio disables orchestration, and missing upstream APIs rely on cached demo data where available.

## Key Design Decisions

- **CommonJS modules** (`"type": "commonjs"` in package.json) — all files use `require`/`module.exports`
- **In-memory storage** — analyses, SSE clients, and history are stored in plain objects/arrays (no database)
- **Composio-first orchestration** — custom tools orchestrate the three-agent flow when configured; direct execution is the fallback path
- **Parallel first-stage agents** — repo health and external research run concurrently because they are independent network calls
- **SSE for real-time updates** — the frontend connects to `/api/analyze/:id/stream` for live agent status
- **Report publishing as product behavior** — completed analyses can generate or publish `DEPSCOPE.md` back to the analyzed repository
- **Watchlist alerts reuse the same scoring stack** — scheduled scans share the repo analysis, research, and synthesis services instead of using a separate alert pipeline
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

See `ROADMAP.md` and `thingstofix.md` for future work. Trust `.claude/skills/depscope-project` plus the code for current architecture details.
