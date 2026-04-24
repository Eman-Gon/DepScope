---
name: depscope-project
description: Live project guide for the DepScope repository. Use when changing this codebase's dependency-analysis pipeline, Composio orchestration, Gemini scoring, You.com research, Plivo alerts, React frontend, report generation, watchlist monitoring, or repo docs. Captures the current implementation, code ownership, rationale, and gotchas so work stays aligned with how DepScope actually behaves.
---

# DepScope Project

## Overview

Treat this skill as the repo's live institutional memory. Prefer this skill and the code over older root docs when they disagree.

## Start Here

1. Read `references/architecture.md` before changing backend flow, scoring, alerts, environment variables, or deployment behavior.
2. Read `references/code-map.md` to jump to the owning file for the surface you are touching.
3. Read `references/gotchas.md` before changing Composio orchestration, docs, watchlist behavior, or the frontend/backend contract.
4. Update this skill in the same change whenever you add, remove, or rename services, routes, models, env vars, or design constraints.

## Working Rules

- Treat `src/server.js` as the backend composition root. It owns input parsing, analysis lifecycle routes, SSE, report endpoints, Plivo endpoints, watchlist routes, and fallback selection.
- Treat service files as narrow experts. Keep cross-service orchestration in `src/server.js` or `src/services/composioService.js` instead of scattering it through unrelated services or frontend code.
- Treat the frontend as a real client, not a mock demo. `Frontend/src/lib/api.ts` and `Frontend/src/hooks/useAnalysis.ts` define the contract the UI expects.
- Preserve accepted analysis inputs: GitHub URL, `owner/repo`, or bare package name resolved through the npm registry when possible.
- Preserve the fallback ladder: Composio orchestration first when configured, direct parallel execution second, cached demo data last.
- Preserve the SSE event shape used by the frontend: `{ agent, status, progress?, error?, result? }`.
- Preserve `DEPSCOPE.md` generation and publishing as part of the product, not as an internal-only debugging feature.
- Assume backend state is ephemeral unless you are intentionally introducing persistence. Analyses, pattern history, watchlist entries, scan history, and alert phone configuration currently reset on process restart.

## Routing By Change Type

### Backend pipeline work

Read `references/architecture.md` first, then follow the owning files in `references/code-map.md`. Keep Agent 1 and Agent 2 parallel, and keep Agent 3 dependent on both data sets.

### Frontend work

Start in `Frontend/src/lib/api.ts`, `Frontend/src/hooks/useAnalysis.ts`, and the relevant page under `Frontend/src/pages/`. Change backend payloads and frontend assumptions together.

### Reporting or publishing work

Start in `src/services/reportService.js` for markdown shape and `src/services/githubService.js` for GitHub write behavior. Keep section toggles aligned between the backend and the UI.

### Watchlist and alerting work

Start in `src/services/watchlistService.js` and the watchlist routes in `src/server.js`. Remember that watchlist scans reuse the same repo-health, research, and synthesis stack as one-off analyses.

### Documentation work

Update this skill when repo truth changes. Update `claude.md` when the top-level summary changes. Treat `PROJECT_OVERVIEW.md` as the best product rationale doc, but verify implementation details in code.

## Validation

- Backend smoke tests: `node test.js`, `node test-you.js`, `node test-demo.js`, `node test-full.js`
- Frontend checks: `cd Frontend && npm run lint`, `cd Frontend && npm run test`, `cd Frontend && npm run build`
- Skill validation and packaging: `python3 .claude/skills/skill-creator/scripts/package_skill.py .claude/skills/depscope-project`

## Default Biases

- Prefer fixing root-cause contract mismatches over patching UI-only symptoms.
- Prefer code-backed facts over roadmap checkboxes or older summaries.
- Prefer minimal documentation drift: if you change architecture, env vars, routes, or ownership boundaries, update this skill before you stop.
