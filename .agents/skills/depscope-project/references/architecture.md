# Current Architecture

## System Shape

- Backend: CommonJS Node.js + Express 5 in `src/`
- Frontend: React 18 + TypeScript + Vite in `Frontend/`
- Deployment: one Render-ready Docker container, with Express serving `Frontend/dist`
- Core input forms: GitHub URL, `owner/repo`, or bare package name
- Runtime state: in-memory analyses, SSE clients, analysis history, watchlist entries, and scan history

## Analysis Lifecycle

1. `POST /api/analyze` creates an analysis id and returns immediately.
2. `src/routes/analysisRoutes.js` normalizes input with `parseInput()` from `src/lib/input.js`.
3. Bare package names go through `resolvePackageToGitHub()`, which tries the npm registry first and falls back to `https://github.com/<package>/<package>`.
4. `src/pipeline/runPipeline.js` chooses orchestration mode:
   - Composio first when `COMPOSIO_API_KEY` exists
   - direct execution second
   - cached demo data when an upstream step fails and `demoCache` has an entry
5. Agent 1 and Agent 2 run in parallel because GitHub analysis and external research are independent network-bound work.
6. Agent 3 runs after both complete because Gemini needs both data sets to synthesize the grade, findings, alternatives, and verdict.
7. Results are stored in memory, streamed over SSE, and appended to `analysisHistory` for pattern aggregation.

## Research Stack

- `src/services/researchService.js` combines OSV.dev, GitHub Security Advisories, npm registry metadata, and Tavily search.
- OSV.dev and GitHub Security Advisories are authoritative security data.
- Tavily supplies contextual web research for sentiment, alternatives, and supplemental security evidence.
- npm registry metadata supplies package health facts such as latest version, deprecation, maintainers, repository URL, and dist-tags.

## Service Responsibilities

- `src/services/githubService.js`: fetch repository health metrics and handle GitHub write operations for publishing `DEPSCOPE.md`
- `src/services/researchService.js`: normalize OSV.dev, GitHub Advisory, npm metadata, and Tavily research
- `src/services/geminiService.js`: call Gemini, compute weighted score, and apply hard auto-downgrade rules
- `src/services/composioService.js`: register custom tools and orchestrate the three-agent flow when Composio is enabled
- `src/services/reportService.js`: generate the markdown report with section toggles
- `src/services/watchlistService.js`: rescan watched packages and keep in-memory scan history
- `src/services/demoCache.js`: provide cached repo health, research, and assessment data for demo packages

## Scoring and Risk Policy

- Weighted categories: security 30, maintenance 25, stability 20, community 15, documentation 10
- Current Gemini fallback chain: `gemini-3-flash-preview`, then `gemini-2.5-flash`
- Auto-downgrades:
  - critical security finding caps the grade at `C`
  - single maintainer plus more than 90 days stale caps the grade at `D`
  - archived or deprecated repos become `F`

## Report and Publish Flow

- `POST /api/analyze/:id/generate-report` returns markdown only
- `POST /api/analyze/:id/publish-report` verifies GitHub push access and commits `DEPSCOPE.md` into the analyzed repository
- `src/services/reportService.js` supports section toggles for scores, repo health, findings, alternatives, and verdict

## Watchlist

- Watchlist routes live in `src/routes/watchlistRoutes.js`; watchlist state lives in `src/services/watchlistService.js`
- Scan cycles reuse the same repo analysis, research, and synthesis services as one-off analyses
- F-grade watchlist results are surfaced in scan history and dashboard UI

## Frontend Contract

- `Frontend/src/lib/api.ts` is the frontend contract source for the backend
- `Frontend/src/hooks/useAnalysis.ts` owns start-analysis, SSE subscription, result fetch, pattern fetch, and in-session history restore
- Current routes: `/`, `/recommendations`, `/watchlist`
- In a container build, Express serves the built React app and API from the same origin
