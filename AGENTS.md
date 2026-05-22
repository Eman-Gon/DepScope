# DepScope

Autonomous dependency due diligence for npm packages. DepScope analyzes repository health, security advisories, package metadata, community context, and alternatives before you `npm install`.

Project skill: `.agents/skills/depscope-project`

## Architecture

Node.js + Express backend with a Composio-first three-agent pipeline. `src/server.js` starts the process, `src/app.js` builds the Express app, route modules own HTTP surfaces, and `src/pipeline/runPipeline.js` owns orchestration. Agents 1 and 2 run in parallel, then Agent 3 synthesizes the result. If Composio is unavailable or fails, the server falls back to direct execution and then cached demo data when possible.

1. **Repo Health Analyzer** (`src/services/githubService.js`) — GitHub REST API for stars, forks, commit cadence, bus factor, releases, archived/deprecated status, and repo metadata
2. **External Researcher** (`src/services/researchService.js`) — OSV.dev, GitHub Security Advisories, npm registry metadata, and Tavily web context for vulnerabilities, sentiment, and alternatives
3. **Risk Scorer** (`src/services/geminiService.js`) — Gemini flash-model fallback chain synthesizes all data into a letter grade (A-F), weighted scores, severity-ranked findings, alternatives, and an opinionated verdict

Additional services:
- `src/services/composioService.js` — Registers custom Composio tools and orchestrates the three-agent flow
- `src/services/reportService.js` — Generates `DEPSCOPE.md` markdown for export or publish
- `src/services/watchlistService.js` — In-memory watchlist scans and cron scheduling
- `src/services/demoCache.js` — Pre-cached analysis results for lodash, moment, and express

## Project Structure

```
src/
  app.js                 # Express app, middleware, routes, static frontend serving
  server.js              # Startup, Composio registration, listener
  config.js              # Environment variable loader
  state.js               # In-memory analysis history
  lib/                   # Input parsing, retry, pattern aggregation, version metadata
  realtime/sse.js        # SSE client registration and broadcasting
  pipeline/runPipeline.js # Composio/direct/cached analysis flow
  routes/                # Analysis/report, watchlist, status/debug/composio routes
  services/              # GitHub, research, Gemini, reports, watchlist, demo cache
Frontend/                # React + TypeScript dashboard, watchlist UI, report actions
Dockerfile               # Single-container Render deployment
```

## API Endpoints

```
POST /api/analyze
GET  /api/analyze/:id/stream
GET  /api/analyze/:id/result
POST /api/analyze/:id/generate-report
POST /api/analyze/:id/publish-report
GET  /api/patterns
GET  /api/composio/status
GET  /api/watchlist
POST /api/watchlist
DELETE /api/watchlist/:id
POST /api/watchlist/scan
POST /api/watchlist/cron
GET  /api/watchlist/scans
GET  /health
GET  /debug
```

In production/container builds, `GET /` serves the built React app from `Frontend/dist`.

## Setup

```bash
cp .env.example .env
# Fill in: GITHUB_TOKEN, GEMINI_API_KEY, TAVILY_API_KEY, optional COMPOSIO_API_KEY
npm install
npm run dev
cd Frontend && npm install
```

For Render container deployment:

```bash
docker build -t depscope-render .
docker run --rm -p 3000:3000 --env-file .env depscope-render
```

## Key Design Decisions

- **CommonJS modules** (`"type": "commonjs"` in package.json)
- **In-memory storage** for analyses, SSE clients, pattern history, watchlist entries, and scan history
- **Composio-first orchestration** with direct execution fallback
- **Authoritative vulnerability sources first** — OSV.dev and GitHub Security Advisories are source-of-truth security data; Tavily supplies web context
- **SSE for real-time updates** — frontend listens to `/api/analyze/:id/stream`
- **One Render container** — Express serves both API and built frontend
- **Report publishing as product behavior** — completed analyses can generate or publish `DEPSCOPE.md`

## Testing

```bash
npm test
node test.js
node test-demo.js
node test-full.js
cd Frontend && npm run lint && npm run test && npm run build
```
