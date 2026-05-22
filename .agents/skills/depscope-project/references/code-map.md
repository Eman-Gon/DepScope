# Code Map

## Backend Composition

- `src/server.js`: startup, listener, Composio registration
- `src/app.js`: Express setup, middleware, route registration, static frontend serving
- `src/pipeline/runPipeline.js`: Composio/direct/cached orchestration path
- `src/state.js`: shared in-memory analyses and analysis history
- `src/realtime/sse.js`: SSE client registration, broadcast, and close helpers
- `src/lib/input.js`: input parsing and npm package-to-GitHub resolution
- `src/lib/patterns.js`: cross-analysis pattern aggregation

## Routes

- `src/routes/analysisRoutes.js`: analysis lifecycle, SSE route, result fetch, report generation/publishing, patterns
- `src/routes/watchlistRoutes.js`: watchlist CRUD, scan, cron, scan history
- `src/routes/statusRoutes.js`: health, debug, Composio status

## Backend Services

- `src/config.js`: canonical environment variable names and `BASE_URL` derivation
- `src/services/composioService.js`: Composio tool registration and orchestration path
- `src/services/githubService.js`: GitHub repository metrics, write-access check, and commit of `DEPSCOPE.md`
- `src/services/researchService.js`: OSV.dev, GitHub Security Advisory, npm metadata, and Tavily research normalization
- `src/services/geminiService.js`: Gemini prompt, model fallback, weighted score calculation, and grade auto-downgrades
- `src/services/reportService.js`: markdown report generation for export and publish flows
- `src/services/watchlistService.js`: watchlist CRUD, scan history, and cron control
- `src/services/demoCache.js`: cached fallback data for lodash, moment, and express

## Frontend Entry Points

- `Frontend/src/App.tsx`: route table and provider setup
- `Frontend/src/main.tsx`: browser entrypoint
- `Frontend/src/lib/api.ts`: typed fetch helpers for analysis, SSE result fetch, patterns, reporting, and watchlist
- `Frontend/src/hooks/useAnalysis.ts`: analysis lifecycle on the client, including SSE event handling and result hydration
- `Frontend/src/contexts/AnalysisContext.tsx`: in-session storage for completed analyses and active selection

## Frontend Pages

- `Frontend/src/pages/Index.tsx`: analysis entry flow and primary result presentation
- `Frontend/src/pages/Recommendations.tsx`: recommendation/fix exploration built from existing analysis state
- `Frontend/src/pages/Watchlist.tsx`: watchlist CRUD, manual scans, and scan history
- `Frontend/src/pages/NotFound.tsx`: catch-all route

## Product and Design Docs

- `AGENTS.md` and `claude.md`: concise current repo summary
- `PROJECT_OVERVIEW.md`: high-level product rationale, but verify low-level behavior in code
- `docs/integrations.md`: current external integrations and env vars
- `ROADMAP.md`: future intent and architecture tradeoff summary
