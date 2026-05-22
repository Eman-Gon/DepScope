# DepScope

Autonomous dependency due diligence for npm packages. DepScope analyzes repository health, structured security advisories, package metadata, community context, and alternatives before you `npm install`.

Project skill: `.agents/skills/depscope-project`

## Architecture

Node.js + Express backend with a Composio-first three-agent pipeline. `src/server.js` starts the process, `src/app.js` builds the Express app, route modules own HTTP surfaces, and `src/pipeline/runPipeline.js` owns orchestration. Agents 1 and 2 run in parallel, then Agent 3 synthesizes the result. If Composio is unavailable or fails, the server falls back to direct execution and then cached demo data when possible.

1. **Repo Health Analyzer** (`src/services/githubService.js`) — GitHub REST API for repo health, releases, bus factor, archived/deprecated status, and publishing
2. **External Researcher** (`src/services/researchService.js`) — OSV.dev, GitHub Security Advisories, npm registry metadata, and Tavily web context
3. **Risk Scorer** (`src/services/geminiService.js`) — Gemini fallback chain for grade, weighted score, findings, alternatives, and verdict

Additional services:
- `src/services/composioService.js` — custom Composio tools + orchestration
- `src/services/reportService.js` — `DEPSCOPE.md` generation
- `src/services/watchlistService.js` — in-memory watchlist scans and cron scheduling
- `src/services/demoCache.js` — cached fallback data for lodash, moment, and express

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

`GET /` serves the React app in production/container builds.

## Setup

```bash
cp .env.example .env
# Fill in: GITHUB_TOKEN, GEMINI_API_KEY, TAVILY_API_KEY, optional COMPOSIO_API_KEY
npm install
npm run dev
cd Frontend && npm install
```

For a single Render container:

```bash
docker build -t depscope-render .
docker run --rm -p 3000:3000 --env-file .env depscope-render
```

## Key Design Decisions

- CommonJS backend modules
- In-memory runtime state
- Composio-first orchestration with direct/cached fallback
- OSV.dev and GitHub Security Advisories are authoritative vulnerability sources
- Tavily supplies contextual web research for sentiment, alternatives, and supplemental security evidence
- Express serves the built Vite app and backend API from one process for Render deployment
