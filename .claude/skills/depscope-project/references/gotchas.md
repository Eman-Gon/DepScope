# Gotchas

## Trust Order

Prefer code first, then this skill, then older root docs. Some repo docs describe earlier stages of the project and can drift behind the implementation.

## Integration Gotchas

- `src/services/composioService.js` stringifies repo health and research into `repoHealthJson` and `researchJson` before Agent 3. That workaround is intentional; do not simplify it without re-testing the Composio flow.
- `src/server.js` exposes `/debug`, but it currently reports `youConfigured` from `YOU_API_KEY`. The actual configured variable is `YOU_COM_API_KEY` in `src/config.js` and `src/services/youService.js`.
- `src/services/githubService.js` still uses placeholder-style values for `avgIssueResponseHours` and `dependencyCount`. Treat those as known gaps, not finished metrics.
- `src/config.js` derives `BASE_URL` from `BASE_URL`, then `RENDER_EXTERNAL_URL`, then localhost. Plivo callback bugs usually trace back to this value.

## State and Persistence Gotchas

- `analyses`, `sseClients`, `analysisHistory`, `watchlist`, `scanHistory`, and `alertPhone` all reset on process restart.
- Pattern insights only become meaningful after multiple completed analyses because they are computed from in-memory `analysisHistory`.
- Watchlist cron state is also in-memory. A restart silently stops scheduled scanning.

## Frontend Contract Gotchas

- `Frontend/src/lib/api.ts` and `Frontend/src/hooks/useAnalysis.ts` assume the current SSE payload shape. If you rename agents or change event fields, update both sides together.
- `Frontend/src/pages/Recommendations.tsx` is advisory UI logic built from analysis results; it is not authoritative backend scoring.
- The frontend already calls real API endpoints and SSE. Do not reintroduce mock-data assumptions into product docs.

## Documentation Gotchas

- Keep `claude.md` aligned with the project skill when architecture, services, endpoints, or model choices change.
- Treat `ROADMAP.md` as intent, not as a precise implementation ledger.
- Treat `PROJECT_OVERVIEW.md` as the best explanation of product rationale, but still verify low-level behavior in code.

## Validation Habit

Package the skill after editing it:

`python3 .claude/skills/skill-creator/scripts/package_skill.py .claude/skills/depscope-project`