---
name: depscope-project
description: Live project guide for the DepScope repository. Use when changing this codebase's dependency-analysis pipeline, Composio orchestration, Gemini scoring, OSV/GitHub/Tavily/npm research, React frontend, report generation, watchlist monitoring, Docker/Render deployment, or repo docs.
---

# DepScope Project

## Overview

Treat this skill as the repo's live institutional memory. Prefer this skill and the code over older root docs when they disagree.

## Start Here

1. Read `references/architecture.md` before changing backend flow, scoring, research sources, environment variables, or deployment behavior.
2. Read `references/code-map.md` to jump to the owning file for the surface you are touching.
3. Read `references/gotchas.md` before changing Composio orchestration, docs, watchlist behavior, or the frontend/backend contract.
4. Update this skill in the same change whenever you add, remove, or rename services, routes, models, env vars, or design constraints.

## Working Rules

- Treat `src/server.js` as startup only. `src/app.js` owns Express app setup, route modules own HTTP surfaces, and `src/pipeline/runPipeline.js` owns analysis fallback selection.
- Treat service files as narrow experts. Keep cross-service orchestration in `src/pipeline/runPipeline.js` or `src/services/composioService.js`.
- Treat the frontend as a real client. `Frontend/src/lib/api.ts` and `Frontend/src/hooks/useAnalysis.ts` define the contract the UI expects.
- Preserve accepted analysis inputs: GitHub URL, `owner/repo`, or bare package name resolved through the npm registry when possible.
- Preserve the fallback ladder: Composio orchestration first when configured, direct parallel execution second, cached demo data last.
- Preserve the SSE event shape used by the frontend: `{ agent, status, progress?, error?, result? }`.
- Preserve `DEPSCOPE.md` generation and publishing as product behavior.
- Assume backend state is ephemeral unless intentionally introducing persistence. Analyses, pattern history, watchlist entries, and scan history currently reset on process restart.

## Routing By Change Type

### Backend pipeline work

Start in `src/pipeline/runPipeline.js` and the owning route/service files. Keep Agent 1 and Agent 2 parallel, and keep Agent 3 dependent on both data sets.

### Research source work

Start in `src/services/researchService.js`. OSV.dev and GitHub Security Advisories are authoritative vulnerability data; Tavily is contextual web research for sentiment, alternatives, and supplemental evidence.

### Frontend work

Start in `Frontend/src/lib/api.ts`, `Frontend/src/hooks/useAnalysis.ts`, and the relevant page under `Frontend/src/pages/`. Change backend payloads and frontend assumptions together.

### Reporting or publishing work

Start in `src/services/reportService.js` for markdown shape and `src/services/githubService.js` for GitHub write behavior. Keep section toggles aligned between the backend and the UI.

### Watchlist work

Start in `src/services/watchlistService.js` and `src/routes/watchlistRoutes.js`. Watchlist scans reuse the same repo analysis, research, and synthesis services as one-off analyses.

### Documentation work

Update this skill when repo truth changes. Update `AGENTS.md` and `claude.md` when the top-level summary changes.

## Validation

- Backend smoke tests: `npm test`, `node test.js`, `node test-demo.js`, `node test-full.js`, `npm run test:integrations`
- Frontend checks: `cd Frontend && npm run lint`, `cd Frontend && npm run test`, `cd Frontend && npm run build`
- Docker check: `docker build -t depscope-render .`

## Default Biases

- Prefer fixing root-cause contract mismatches over patching UI-only symptoms.
- Prefer code-backed facts over roadmap checkboxes or older summaries.
- Prefer minimal documentation drift: if you change architecture, env vars, routes, or ownership boundaries, update this skill before you stop.
