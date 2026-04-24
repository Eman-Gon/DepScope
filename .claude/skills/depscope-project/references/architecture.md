# Current Architecture

## System Shape

- Backend: CommonJS Node.js + Express 5 in `src/`
- Frontend: separate React 18 + TypeScript + Vite app in `Frontend/`
- Core input forms: GitHub URL, `owner/repo`, or bare package name
- Runtime state: in-memory analyses, SSE clients, analysis history, watchlist entries, scan history, and alert phone configuration

## Analysis Lifecycle

1. `POST /api/analyze` creates an analysis id and returns immediately.
2. `src/server.js` normalizes input with `parseInput()`.
3. Bare package names go through `resolvePackageToGitHub()`, which tries the npm registry first and falls back to `https://github.com/<package>/<package>`.
4. `runPipeline()` chooses orchestration mode:
   - Composio first when `COMPOSIO_API_KEY` exists
   - direct execution second
   - cached demo data when an upstream step fails and `demoCache` has an entry
5. Agent 1 and Agent 2 run in parallel because GitHub analysis and You.com research are independent network-bound work.
6. Agent 3 runs after both complete because Gemini needs both data sets to synthesize the grade, findings, alternatives, and verdict.
7. Results are stored in memory, streamed over SSE, and appended to `analysisHistory` for pattern aggregation.

## Why the Pipeline Looks Like This

- Parallelize the first two agents to keep interactive latency low enough for the live dashboard.
- Keep Composio optional so local development and demos still work without a Composio API key.
- Keep cached demo data so the app can still complete an analysis when GitHub, You.com, or Gemini is unavailable.
- Keep final synthesis in Gemini so the product can combine hard metrics with contextual judgment instead of relying on a rigid rule engine alone.

## Service Responsibilities

- `src/services/githubService.js`: fetch repository health metrics and handle GitHub write operations for publishing `DEPSCOPE.md`
- `src/services/youService.js`: extract CVEs, community sentiment, and alternatives from You.com search results
- `src/services/geminiService.js`: call Gemini, compute weighted score, and apply hard auto-downgrade rules
- `src/services/composioService.js`: register custom tools and orchestrate the three-agent flow when Composio is enabled
- `src/services/reportService.js`: generate the markdown report with section toggles
- `src/services/watchlistService.js`: rescan watched packages, generate alert summaries, and prepare Plivo call/SMS content
- `src/services/demoCache.js`: provide cached repo health, research, and assessment data for demo packages
- `src/services/plivoService.js`: place calls, send SMS, and trigger voice alerts

## Scoring and Risk Policy

- Weighted categories: security 30, maintenance 25, stability 20, community 15, documentation 10
- Current Gemini fallback chain: `gemini-3-flash-preview`, then `gemini-2.5-flash`
- Auto-downgrades:
  - critical security finding caps the grade at `C`
  - single maintainer plus more than 90 days stale caps the grade at `D`
  - archived or deprecated repos become `F`

This split is deliberate: services gather evidence, Gemini synthesizes the narrative, and explicit downgrade rules enforce non-negotiable risk posture.

## Report and Publish Flow

- `POST /api/analyze/:id/generate-report` returns markdown only
- `POST /api/analyze/:id/publish-report` verifies GitHub push access and commits `DEPSCOPE.md` into the analyzed repository
- `src/services/reportService.js` supports section toggles for scores, repo health, findings, alternatives, and verdict

## Watchlist and Alerts

- Watchlist routes live in `src/server.js`; watchlist state lives in `src/services/watchlistService.js`
- Scan cycles reuse the same repo analysis, research, and synthesis services as one-off analyses
- F-grade watchlist results generate both a short voice script and a longer SMS-ready report
- Plivo callback URLs depend on a correct `BASE_URL` or `RENDER_EXTERNAL_URL`

## Frontend Contract

- `Frontend/src/lib/api.ts` is the frontend contract source for the backend
- `Frontend/src/hooks/useAnalysis.ts` owns start-analysis, SSE subscription, result fetch, pattern fetch, and in-session history restore
- Current routes: `/`, `/recommendations`, `/watchlist`
- The frontend is already wired to live backend endpoints and SSE; it is not a placeholder mock shell