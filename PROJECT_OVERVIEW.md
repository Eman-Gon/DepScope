# DepScope — Project Overview & Product Strategy

## What Is DepScope?

DepScope is an **autonomous multi-agent system for open-source dependency due diligence**. It answers a question every engineering team asks but rarely investigates thoroughly: *"Should we actually trust this dependency?"*

Before a developer runs `npm install <package>`, DepScope dispatches three coordinated AI agents to research the package's GitHub repository health, known security vulnerabilities, community sentiment, and viable alternatives — then synthesizes everything into a letter grade (A–F) with severity-ranked findings, a radar chart of five risk dimensions, and an opinionated verdict.

If critical vulnerabilities are found, DepScope can call the developer's phone with a spoken briefing.

**Elevator pitch:** *"Before you npm install, we tell you if you're going to regret it."*

---

## The Problem It Solves

### Why This Matters

Modern applications depend on hundreds of open-source packages. The average Node.js project has **700+ transitive dependencies**. Teams routinely adopt packages without checking:

- **Is it still maintained?** (40% of npm packages haven't had a commit in 2+ years)
- **Does it have known CVEs?** (Most developers never check the NVD database)
- **Is there a single maintainer?** (Bus factor of 1 = supply chain time bomb)
- **Has the community flagged problems?** (Reddit/HN threads often surface issues months before formal advisories)
- **Are there better alternatives?** (moment.js → date-fns/dayjs migration saved thousands of bundle bytes)

The consequences of ignoring these signals are real: the **left-pad incident** broke the internet, **event-stream** injected cryptocurrency-stealing malware, **colors.js** self-sabotaged to protest open-source economics, and **Log4Shell** cost billions in remediation.

### Current State of the Art

| Tool | What It Does | What It Misses |
|------|-------------|----------------|
| `npm audit` | Checks known CVEs in your lockfile | No maintenance health, no community signals, no alternatives |
| Snyk / Dependabot | Automated CVE scanning + PRs | No bus factor analysis, no sentiment, no opinionated verdict |
| Socket.dev | Supply chain attack detection | Focused on malicious code, not general dependency health |
| Libraries.io | Package metadata aggregation | No risk scoring, no AI synthesis, no actionable recommendations |

**DepScope fills the gap**: it combines security scanning, maintenance health analysis, community intelligence, and AI-powered risk synthesis into a single, opinionated assessment — before you install, not after.

---

## What Has Been Built

### Architecture

```
User Input (npm package / GitHub URL / owner/repo)
        │
        ▼
┌─────────────────────────────────┐
│     Composio Orchestrator       │
│  (fallback: Promise.allSettled) │
└──────┬──────────────┬───────────┘
       │              │
       ▼              ▼
┌─────────────┐ ┌──────────────┐
│  Agent 1    │ │  Agent 2     │     ← run in parallel
│  Repo Health│ │  External    │
│  (GitHub)   │ │  Research    │
│             │ │  (You.com)   │
└──────┬──────┘ └──────┬───────┘
       │               │
       └───────┬───────┘
               ▼
       ┌──────────────┐
       │   Agent 3    │              ← depends on Agents 1 & 2
       │  Risk Scorer │
       │  (Gemini AI) │
       └──────┬───────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
┌──────────┐    ┌───────────┐
│ Dashboard│    │   Plivo   │
│ (React)  │    │ Voice Call│
└──────────┘    └───────────┘
```

Three sequential AI agents orchestrated via Composio (with graceful fallback to direct execution):

1. **Agent 1 — Repo Health Analyzer** queries the GitHub API for stars, forks, commit frequency, contributor distribution, bus factor, issue close rate, stale issue count, release cadence, archived/deprecated status, and license.

2. **Agent 2 — External Researcher** queries the You.com Search API in three parallel threads: CVE database search (with regex-based CVE-ID extraction and severity classification), community sentiment analysis (Reddit, Hacker News, Stack Overflow), and alternative library discovery.

3. **Agent 3 — Risk Scorer** feeds everything into Google's Gemini model and produces: a 5-dimension score (maintenance, security, stability, community, documentation), a weighted letter grade (A–F), severity-ranked findings with recommendations, vetted alternative packages with migration difficulty ratings, and a 2–3 sentence executive verdict.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express 5 |
| AI Orchestration | Composio SDK |
| LLM | Google Gemini (flash models with fallback chain) |
| Search API | You.com Search |
| Repository Data | GitHub REST API |
| Voice Alerts | Plivo (voice + SMS) |
| Frontend | React 18 + TypeScript + Vite |
| UI Components | shadcn/ui (Radix primitives) |
| Charts | Recharts (radar visualization) |
| Animations | Framer Motion |
| State | React Query + SSE streaming |
| Styling | Tailwind CSS with custom theme |

### Features Complete

**Core Analysis Pipeline**
- Accepts GitHub URLs, `owner/repo` format, or bare npm package names (resolved via npm registry)
- Parallel agent execution: Agents 1 & 2 run concurrently, Agent 3 runs after both complete
- Retry logic with linear backoff (2 retries per agent)
- Three-tier fallback: Composio → direct execution → pre-cached demo data

**Risk Scoring Algorithm**
- Weighted 5-dimension scoring: Security (30%), Maintenance (25%), Stability (20%), Community (15%), Documentation (10%)
- Grade thresholds: A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, F < 35
- Auto-downgrades: unpatched CRITICAL CVE caps at C, single maintainer + 90 days stale caps at D, archived/deprecated repo = automatic F

**Real-Time Streaming UI**
- Server-Sent Events (SSE) stream agent progress live to the browser
- Agent status cards show waiting → analyzing → complete/error transitions
- Framer Motion animations for result reveal
- Radar chart for visual dimension comparison
- Color-coded severity findings (CRITICAL → red, HIGH → orange, MEDIUM → yellow, LOW → blue)
- Alternatives table with migration difficulty assessment
- Cross-analysis pattern insights (aggregate stats across multiple analyses)

**Voice Alerts (Plivo)**
- Automatic phone call on CRITICAL findings
- Spoken briefing with grade, top finding, and recommendation
- DTMF handler: press 1 to receive SMS report link, press 2 to dismiss

**Resilience**
- Gemini model fallback chain (gemini-3-flash-preview → gemini-2.5-flash)
- Pre-cached analyses for lodash, moment, and express as demo fallback
- Graceful degradation at every layer — the system always returns something useful

### Codebase Size

~2,100 lines of application code (1,360 backend + 740 frontend), 13 API endpoints, 5 integration test files.

---

## Scoring Methodology — Why It Works

DepScope's scoring isn't a simple formula applied to numbers. The architecture is deliberately designed so that **hard data feeds into AI judgment**:

1. **Agent 1** provides objective, quantitative signals (commit frequency, bus factor, issue velocity)
2. **Agent 2** provides qualitative, external signals (CVE records, community complaints, known alternatives)
3. **Agent 3** receives both and applies contextual reasoning — a package with 50K stars but no commits in 2 years is rated differently than a stable utility that simply doesn't need updates

The auto-downgrade rules encode **non-negotiable security posture**: no amount of community goodwill overrides an unpatched critical CVE or a single-maintainer abandoned project.

---

## How to Make This a Top Product

### 1. Expand Ecosystem Coverage

**Current state:** npm packages only (via GitHub + npm registry lookup).

**Target state:**
- **PyPI** (Python): Massive ecosystem, same dependency health problems. Adapt Agent 1 to query PyPI metadata + GitHub.
- **crates.io** (Rust): Growing fast, community cares deeply about quality signals.
- **Go modules**: `go.sum` and proxy.golang.org provide rich metadata.
- **Maven Central** (Java): Enterprise customers would pay for this.

Each ecosystem shares the same core architecture — the agents just need different data adapters. This is a horizontal scaling play with low marginal cost per ecosystem.

### 2. Integrate Into Developer Workflow

The standalone dashboard is a demo. The product becomes indispensable when it's embedded:

- **CLI tool** (`npx depscope lodash`): Run analysis from terminal before installing. This is the highest-leverage integration — it meets developers where they already are.
- **CI/CD gate**: GitHub Action / GitLab CI step that blocks PRs adding dependencies below a configurable grade threshold (e.g., "no D or F packages").
- **IDE extension** (VS Code): Hover over a `package.json` dependency to see the grade inline. Red underline for F-graded packages.
- **PR comment bot**: When a PR adds/updates a dependency, DepScope posts a comment with the grade and key findings. Similar to how Codecov comments on coverage changes.
- **Slack/Teams bot**: `/depscope express` in a channel returns the grade card.

### 3. Persistent Storage & Historical Tracking

**Current state:** All data is in-memory. Analyses are lost on server restart.

**Target state:**
- **PostgreSQL or MongoDB** for analysis results, enabling: historical grade tracking per package (is lodash getting better or worse?), organizational dependency inventory (what's your portfolio's average grade?), and trend alerts (a package you depend on dropped from B to D).
- **Redis cache** for GitHub API responses (respect rate limits, reduce latency for popular packages).
- **User accounts**: Save watched packages, configure alert thresholds, team dashboards.

### 4. Deeper Security Analysis

The You.com CVE search is a good starting point but has limitations:

- **Integrate OSV.dev** (Google's Open Source Vulnerability database): Structured, machine-readable CVE data with affected version ranges. Much more reliable than regex-parsing search results.
- **SBOM generation**: Parse `package-lock.json` / `yarn.lock` to analyze the entire transitive dependency tree, not just direct dependencies.
- **License compliance**: Flag GPL dependencies in proprietary projects, detect license changes between versions.
- **Typosquatting detection**: Check if the requested package name is suspiciously close to a popular package (e.g., `lodas` vs `lodash`).

### 5. Monetization Strategy

| Tier | Audience | Features | Price |
|------|----------|----------|-------|
| **Free** | Individual developers | 10 analyses/month, CLI tool, public packages only | $0 |
| **Pro** | Teams (5-20 devs) | Unlimited analyses, CI/CD integration, historical tracking, Slack bot | $29/seat/month |
| **Enterprise** | Large orgs (50+ devs) | Private repo analysis, SBOM scanning, license compliance, SSO, SLA | Custom pricing |

The CI/CD gate is the wedge product for paid conversion. Once a team configures "block PRs with F-grade dependencies," they can't turn it off without feeling exposed.

### 6. Build a Package Intelligence Database

Every analysis DepScope runs generates structured intelligence about the open-source ecosystem. Over time, this becomes a defensible asset:

- **Pre-computed grades** for the top 10K npm packages (updated weekly)
- **Grade history timelines** showing maintenance trajectory
- **"Packages at risk" watchlist** — packages whose signals are deteriorating
- **Migration guides**: When a package gets an F, auto-generate a migration path to the top-rated alternative

This data layer transforms DepScope from a point-in-time tool into a **continuous intelligence platform**.

### 7. Improve the AI Synthesis

- **Fine-tune on expert assessments**: Collect ground-truth ratings from security researchers and senior engineers. Use them to calibrate Gemini's scoring (or train a dedicated model).
- **Multi-model consensus**: Run the synthesis through both Gemini and Claude, flag disagreements for human review, improve reliability.
- **Explain the grade**: Instead of just "Grade: C," generate a natural-language narrative: "lodash receives a C primarily due to its stale maintenance (last commit 8 months ago) and bus factor concerns (67% of contributions from one person), despite its massive community adoption and zero known CVEs."
- **Confidence intervals**: Some analyses have more data than others. Report confidence alongside the grade.

### 8. Technical Hardening for Production

- **Replace in-memory storage** with a proper database (this is the single biggest production blocker)
- **Add authentication** (API keys for CI/CD, OAuth for dashboard)
- **Rate limiting** per client to prevent abuse
- **Background job queue** (Bull/BullMQ with Redis) instead of synchronous request handling — analyses can take 10-30 seconds and shouldn't block Express workers
- **Structured logging** (pino/winston) instead of console.log — essential for debugging production issues
- **OpenTelemetry tracing** across the three-agent pipeline for performance monitoring
- **Automated tests in CI** — the test files exist but aren't wired into GitHub Actions
- **TypeScript migration** for the backend — the frontend is already TypeScript, the backend should match

### 9. Community & Growth Strategy

- **Public grade badges**: `![DepScope Grade](depscope.dev/badge/lodash)` — embed in READMEs like coverage badges. This is viral: every README that displays the badge drives awareness.
- **"State of npm Dependencies" annual report**: Analyze the top 1000 packages, publish findings. Great for press/SEO.
- **Open-source the scoring algorithm**: Let the community audit and improve it. Keep the data platform and integrations proprietary.
- **Package author notifications**: When a package drops below C, notify the maintainer with specific improvement suggestions. Turns DepScope from a consumer tool into a contributor tool.

---

## Competitive Positioning

DepScope occupies a unique position in the developer tools landscape:

```
                    Automated ←──────────────────→ Manual
                        │                           │
         Narrow         │   npm audit               │
         (CVEs only)    │   Snyk                    │   Security audit
                        │   Dependabot              │   firms
                        │                           │
                        │                           │
                        │                           │
         Broad          │   ★ DepScope ★            │   Internal tech
         (holistic      │                           │   review boards
          health)       │   Socket.dev              │
                        │   (supply chain focus)    │
                        │                           │
```

DepScope is the **only tool that combines automated CVE scanning, maintenance health analysis, community intelligence, and AI-powered risk synthesis** into a single grade. The closest competitors each cover one dimension; DepScope covers all four and synthesizes them.

---

## Summary

DepScope has a functional three-agent analysis pipeline with real-time streaming, a React dashboard, voice alerting, and resilient fallback chains. The core technical architecture is sound and the scoring methodology is defensible.

The path to a top product is:
1. **CLI-first distribution** (meet developers where they are)
2. **CI/CD integration** (make the grade a quality gate — this drives paid conversion)
3. **Persistent storage + historical tracking** (make it a platform, not a point tool)
4. **Ecosystem expansion** (Python, Rust, Go, Java)
5. **Package intelligence database** (defensible data moat from every analysis run)

The core insight is correct: dependency due diligence is a real, under-served problem that affects every software team. The multi-agent architecture is the right approach for combining heterogeneous data sources into a coherent assessment. The product needs to move from "impressive hackathon demo" to "thing I can't uninstall from my CI pipeline."
