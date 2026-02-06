# DepScope — Spec Gap Analysis

**Spec:** `DepScope — Repo Due Diligence Agent` (921-line hackathon spec)  
**Date:** Feb 6, 2026 · 7:57 PM EST

---

## ✅ Fully Implemented

### Architecture (spec lines 30-88)
- [x] Composio orchestrator coordinates 3 agents in parallel
- [x] Agent 1: Repo Health Analyzer (GitHub API)
- [x] Agent 2: External Researcher (You.com API)
- [x] Agent 3: Risk Scorer + Advisor (Gemini API)
- [x] Results aggregator merges + deduplicates
- [x] Plivo voice alert on CRITICAL findings
- [x] Fallback to direct execution if Composio fails

### API Endpoints (spec lines 115-133)
- [x] `POST /api/analyze` — accepts GitHub URL or package name
- [x] `GET /api/analyze/:id/stream` — SSE stream of agent status
- [x] `GET /api/analyze/:id/result` — full analysis result JSON
- [x] `GET /api/patterns` — aggregated pattern insights

### GitHub Data Extraction (spec lines 136-175)
- [x] name, owner, stars, forks, openIssues, license, language, createdAt
- [x] topics (added beyond original server.js)
- [x] contributorCount, topContributorPct, busFactorScore
- [x] commitFrequencyPerWeek, lastCommitDaysAgo
- [x] issueCloseRate, staleIssueCount
- [x] lastReleaseDate, releaseFrequencyPerMonth
- [x] isArchived, isDeprecated (auto-F grade)

### You.com Integration (spec lines 194-227)
- [x] Query 1: CVE search with severity parsing
- [x] Query 2: Community sentiment analysis (positive/negative/mixed/neutral)
- [x] Query 3: Alternative library discovery
- [x] Correct API endpoint (`ydc-index.io/v1/search` with `X-API-Key`)

### Gemini Risk Synthesis (spec lines 229-282)
- [x] Structured JSON output with grade, scores, findings, alternatives, verdict
- [x] 5-dimension scores: maintenance, security, community, documentation, stability
- [x] Severity-ranked findings with category, title, detail, recommendation
- [x] Opinionated verdict text

### Scoring Algorithm (spec lines 284-305)
- [x] Weighted average: security 30%, maintenance 25%, stability 20%, community 15%, docs 10%
- [x] Grade thresholds: A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, F < 35
- [x] Auto-downgrade: CRITICAL CVE → max C
- [x] Auto-downgrade: single maintainer + 90 days stale → max D
- [x] Auto-downgrade: archived/deprecated repo → F

### Pattern Aggregation (spec lines 307-337)
- [x] totalAnalyzed count
- [x] avgGrade calculation
- [x] Pattern insights with confidence scores
- [x] riskFactors (most common risk factors)
- [x] safestCategories (category scores)

### Plivo Voice Alerts (spec lines 486-566)
- [x] `POST /api/alert/configure` — register phone number
- [x] `GET /api/plivo/voice-xml/:analysisId` — Speak + GetDigits XML
- [x] `POST /api/plivo/handle-input/:analysisId` — DTMF handler (1=SMS, 2=dismiss)
- [x] triggerVoiceAlert() fires automatically on CRITICAL findings
- [x] sendSMS() sends report link

### Composio Orchestration (spec lines 94-113)
- [x] Composio SDK integrated (`@composio/core` v0.6.3)
- [x] 3 custom tools registered: DEPSCOPE_REPO_HEALTH, DEPSCOPE_RESEARCH, DEPSCOPE_RISK_SYNTHESIS
- [x] Agents 1 & 2 execute in parallel via Composio
- [x] Graceful fallback to direct execution if Composio fails
- [x] `/api/composio/status` endpoint shows orchestration state

### Backup Plans (spec lines 872-888)
- [x] Composio breaks → Promise.allSettled fallback (implemented as automatic fallback)
- [x] You.com API slow/down → pre-cached data for lodash, moment, express
- [x] Gemini rate-limits → model fallback chain + cached synthesis data
- [x] Pre-cached demo results for 3 packages

### Data Model (spec lines 626-753)
- [x] Analysis result matches spec structure: id, input, packageName, timestamp, status
- [x] repoHealth object with all required fields
- [x] research object with cves, sentiment, alternatives
- [x] scores, grade, gradeRationale, findings, alternatives, verdict

---

## ⚠️ Partially Implemented

### GitHub Data — Minor Gaps
- [ ] `avgIssueResponseHours` — hardcoded to 24 (spec wants median time to first response; requires paginating through issue comments which is expensive)
- [ ] `dependencyCount` — hardcoded to 0 (spec wants count from package.json; requires fetching repo contents)
- [ ] `hasLockFile` — not implemented (spec wants to check for lockfile existence)

### You.com Alternatives Extraction
- [x] Regex-based extraction works but returns noise for some packages
- [x] Gemini's alternatives (in the synthesis) are much more reliable
- [ ] Could improve by adding known-package-name validation or cross-referencing npm registry

### Plivo End-to-End
- [x] All code is written and endpoints work
- [ ] Not tested with a real phone call (need to configure a valid `to` number)
- [ ] BASE_URL in .env is `http://localhost:3000` — needs to be updated to Render URL for Plivo webhooks to work in production

---

## ❌ Not Yet Implemented

### Render Deployment (spec lines 568-589)
- [ ] Not deployed to Render yet
- [ ] Need to create Web Service, set env vars, note public URL
- [ ] Need to update BASE_URL and Plivo webhooks to use Render URL

### Lovable Frontend Dashboard (spec lines 342-472)
- [ ] No frontend dashboard built yet
- [ ] Spec defines a full layout with agent status cards, radar chart, findings list, alternatives table, pattern insights, verdict display
- [ ] Would connect to backend SSE stream + result endpoints

### Composio Friction Log (spec lines 592-622)
- [ ] No formal friction log document created
- [ ] We encountered real issues that should be logged:
  - `inputParams` vs `inputParameters` naming inconsistency in SDK
  - `z.record(z.any())` causes internal `_zod` error — had to use `z.string()` with JSON.stringify workaround
  - Documentation shows v2 patterns but SDK uses v1 signatures in some places

### Demo Video (spec line 816)
- [ ] 3-minute demo video not recorded (required for Devpost)

### Devpost Submission (spec lines 892-919)
- [ ] Not submitted yet
- [ ] Template is in the spec — needs project name, tagline, description, video, screenshots

---

## Spec Features vs Implementation — Quick Reference

| Spec Feature | Status | File |
|---|---|---|
| GitHub repo analysis | ✅ Complete | `githubService.js` |
| You.com CVE search | ✅ Complete | `youService.js` |
| You.com sentiment | ✅ Complete | `youService.js` |
| You.com alternatives | ⚠️ Noisy | `youService.js` |
| Gemini risk synthesis | ✅ Complete | `geminiService.js` |
| Gemini model fallback | ✅ Complete | `geminiService.js` |
| Composio orchestration | ✅ Complete | `composioService.js` |
| Composio status endpoint | ✅ Complete | `server.js` |
| SSE streaming | ✅ Complete | `server.js` |
| Pattern aggregation | ✅ Complete | `server.js` |
| Plivo voice XML | ✅ Complete | `plivoService.js` + `server.js` |
| Plivo DTMF handler | ✅ Complete | `server.js` |
| Plivo real call test | ❌ Not tested | — |
| Demo cache fallback | ✅ Complete | `demoCache.js` |
| Input parsing (URL/name/owner-repo) | ✅ Complete | `server.js` |
| npm registry lookup | ✅ Complete | `server.js` |
| Error handling + retries | ✅ Complete | `server.js` |
| Render deployment | ❌ Not done | — |
| Lovable dashboard | ❌ Not done | — |
| Composio friction log | ❌ Not done | — |
| Demo video | ❌ Not done | — |
| Devpost submission | ❌ Not done | — |
