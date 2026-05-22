# DepScope Roadmap

> Autonomous multi-agent system for open-source dependency due diligence.

## Current State

DepScope analyzes npm packages through a 3-agent pipeline (GitHub health, structured research, AI synthesis) and produces letter-graded risk reports with actionable findings. The backend API, Composio orchestration, Render container deployment path, and React frontend are built.

---

## Phase 1 — Ship It (Immediate)

- [ ] **Deploy single container to Render** — set env vars, verify frontend/API share one public URL
- [x] **Connect frontend to live API** — real `fetch()` calls and SSE streaming are wired
- [x] **Remove phone alerts** — watchlist failures are reported in dashboard/API scan history
- [ ] **Fix GitHub data gaps** — compute real `avgIssueResponseHours` from issue comments, parse `dependencyCount` from package.json, check `hasLockFile`

## Phase 2 — Make It Useful

- [ ] **CLI tool** — `npx depscope lodash` for terminal-first users; highest-leverage distribution channel
- [ ] **Persistent storage** — PostgreSQL or MongoDB to survive restarts; enables historical grade tracking and user accounts
- [ ] **Authentication & rate limiting** — API keys, basic auth, and per-IP rate limits to prevent abuse
- [x] **OSV.dev integration** — machine-readable advisory lookup replaces generic CVE search parsing
- [ ] **Improve alternatives extraction** — reduce Tavily noise; add npmjs.com download comparison

## Phase 3 — Expand Reach

- [ ] **Multi-ecosystem support** — PyPI (Python), crates.io (Rust), Go modules, Maven Central (Java)
- [ ] **CI/CD integration** — GitHub Action that gates PRs on dependency grades (fail if any dep < C)
- [ ] **IDE extension** — VS Code extension showing grades inline next to `import` / `require` statements
- [ ] **Slack / Discord bot** — `/depscope lodash` in team channels
- [ ] **PR comment bot** — auto-comment on PRs that add new dependencies with grade + findings

## Phase 4 — Intelligence Layer

- [ ] **Package intelligence database** — pre-compute and cache grades for top 10K npm packages; update weekly
- [ ] **Grade badges** — `![DepScope Grade](depscope.dev/badge/lodash)` for README files
- [ ] **Watchlist with cron** — monitor your dependencies and alert on grade changes (partially built)
- [ ] **Historical trends** — show how a package's grade has changed over time
- [ ] **SBOM generation** — full transitive dependency tree analysis with recursive grading

## Phase 5 — Harden & Scale

- [ ] **Structured logging** — replace `console.log` with pino/winston; add request IDs
- [ ] **Observability** — OpenTelemetry traces for the full agent pipeline
- [ ] **Multi-model consensus** — run synthesis through Claude + Gemini and compare for reliability
- [ ] **Job queue** — Bull/BullMQ for background analysis processing instead of in-memory
- [ ] **License compliance** — detect GPL in proprietary projects, flag license conflicts
- [ ] **Typosquatting detection** — flag packages with suspiciously similar names to popular ones

## Architecture Decisions

| Decision | Current | Why |
|---|---|---|
| Orchestration | Composio (with direct-call fallback) | Parallel agent execution + graceful degradation when API key is missing |
| AI Synthesis | Gemini 2.0 Flash | Fast, cost-effective; fallback chain to gemini-1.5-flash and pro |
| Research | OSV.dev + GitHub Security Advisories + npm registry + Tavily | Structured security data first, contextual web research second |
| Alerts | Dashboard/API scan history | Keeps watchlist useful without phone/SMS infrastructure |
| Frontend | React + Vite + shadcn/ui | Component library with SSE streaming support |
| Storage | In-memory (for now) | No database dependency during prototyping; migrate to PostgreSQL in Phase 2 |

## Contributing

This project is open source. If you're interested in contributing to any of these items, open an issue to discuss the approach first.
