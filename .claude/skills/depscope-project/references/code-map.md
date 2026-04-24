# Code Map

## Backend Composition Root

- `src/server.js`: Express app setup, request logging, in-memory stores, input parsing, package-to-GitHub resolution, SSE helpers, pattern aggregation, analysis routes, report routes, Plivo routes, watchlist routes, health/debug endpoints, and startup registration for Composio tools

## Backend Services

- `src/config.js`: canonical environment variable names and `BASE_URL` derivation
- `src/services/composioService.js`: Composio tool registration and orchestration path; owns the custom-tool contract and the Agent 3 JSON-string handoff
- `src/services/githubService.js`: GitHub repository metrics, write-access check, and commit of `DEPSCOPE.md`
- `src/services/youService.js`: You.com search wrapper plus CVE, sentiment, and alternatives extraction helpers
- `src/services/geminiService.js`: Gemini prompt, model fallback, weighted score calculation, and grade auto-downgrades
- `src/services/reportService.js`: markdown report generation for export and publish flows
- `src/services/watchlistService.js`: watchlist CRUD, scan history, cron control, F-grade alert report generation, and detailed SMS report generation
- `src/services/plivoService.js`: low-level Plivo call and SMS integration
- `src/services/demoCache.js`: cached fallback data for lodash, moment, and express

## Frontend Entry Points

- `Frontend/src/App.tsx`: route table and provider setup
- `Frontend/src/main.tsx`: browser entrypoint
- `Frontend/src/lib/api.ts`: typed fetch helpers for analysis, SSE result fetch, patterns, reporting, watchlist, and alert configuration
- `Frontend/src/hooks/useAnalysis.ts`: analysis lifecycle on the client, including SSE event handling and result hydration
- `Frontend/src/contexts/AnalysisContext.tsx`: in-session storage for completed analyses and active selection

## Frontend Pages

- `Frontend/src/pages/Index.tsx`: analysis entry flow and primary result presentation
- `Frontend/src/pages/Recommendations.tsx`: recommendation/fix exploration built from existing analysis state
- `Frontend/src/pages/Watchlist.tsx`: watchlist CRUD, manual scans, scan history, and alert phone configuration
- `Frontend/src/pages/NotFound.tsx`: catch-all route

## UI Components Worth Knowing

- `Frontend/src/components/AgentStatusCard.tsx`: live progress cards for the three agents
- `Frontend/src/components/ReportActions.tsx`: report export and publish UI
- `Frontend/src/components/PatternInsights.tsx`: cross-analysis summary UI for `GET /api/patterns`
- `Frontend/src/components/RadarChart.tsx`: score visualization

## Product and Design Docs

- `PROJECT_OVERVIEW.md`: best high-level product rationale and architecture explanation
- `workflow.md`: implementation notes and Composio friction context
- `ROADMAP.md`: future intent and architecture tradeoff summary, but not a source of truth for current implementation status
- `CHANGELOG.md`: history of the Composio-first architecture shift
- `claude.md`: concise repo summary that should stay aligned with the current architecture