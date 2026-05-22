# Gotchas

## Trust Order

Prefer code first, then this skill, then older root docs. Some repo docs describe earlier stages of the project and can drift behind the implementation.

## Integration Gotchas

- `src/services/composioService.js` stringifies repo health and research into `repoHealthJson` and `researchJson` before Agent 3. That workaround is intentional; do not simplify it without re-testing the Composio flow.
- `/debug` reports remaining integration status from `src/routes/statusRoutes.js`; Tavily uses `TAVILY_API_KEY`, while OSV.dev, GitHub public advisories, and npm registry do not require separate keys.
- Read provider secrets through `src/config.js`, not `process.env` directly. Production platforms pass env values literally, so `config.js` trims whitespace and matching wrapper quotes before services use keys.
- `src/services/githubService.js` still uses placeholder-style values for `avgIssueResponseHours` and `dependencyCount`. Treat those as known gaps, not finished metrics.
- Tavily is contextual web research, not the source of truth for security. OSV.dev and GitHub Security Advisories should drive vulnerability findings.

## State and Persistence Gotchas

- `analyses`, `sseClients`, `analysisHistory`, `watchlist`, and `scanHistory` all reset on process restart.
- Pattern insights only become meaningful after multiple completed analyses because they are computed from in-memory `analysisHistory`.
- Watchlist cron state is also in-memory. A restart silently stops scheduled scanning.

## Frontend Contract Gotchas

- `Frontend/src/lib/api.ts` and `Frontend/src/hooks/useAnalysis.ts` assume the current SSE payload shape. If you rename agents or change event fields, update both sides together.
- `Frontend/src/pages/Recommendations.tsx` is advisory UI logic built from analysis results; it is not authoritative backend scoring.
- In production, frontend API calls default to same-origin. In Vite dev, `Frontend/vite.config.ts` proxies `/api`, `/health`, and `/debug` to the backend.

## Documentation Gotchas

- Keep `AGENTS.md`, `claude.md`, and this skill aligned when architecture, services, endpoints, env vars, or model choices change.
- Treat `ROADMAP.md` as intent, not as a precise implementation ledger.
- Treat `PROJECT_OVERVIEW.md` as product rationale, but still verify low-level behavior in code.
