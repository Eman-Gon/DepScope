# DepScope — API Test Results

**Date:** Feb 6, 2026 · 7:57 PM EST  
**Branch:** `copilot-enhancements`  
**Server:** `localhost:3098`  
**All API keys:** Live (GitHub PAT, You.com, Gemini paid, Plivo, Composio)

---

## Test Summary

| # | Endpoint | Status | Notes |
|---|----------|--------|-------|
| 1 | `GET /` | ✅ PASS | `{"service":"DepScope API","status":"ok"}` |
| 2 | `GET /health` | ✅ PASS | `{"status":"ok"}` |
| 3 | `GET /api/composio/status` | ✅ PASS | Shows 3 registered tools, orchestration mode |
| 4 | `POST /api/analyze` (GitHub URL) | ✅ PASS | Returns `{"analysisId":"uuid"}` |
| 5 | `POST /api/analyze` (npm name) | ✅ PASS | Resolves `express` → `expressjs/express` via npm registry |
| 6 | `POST /api/analyze` (owner/repo) | ✅ PASS | `moment/moment` parsed correctly |
| 7 | `GET /api/analyze/:id/stream` (SSE) | ✅ PASS | 7 events: agent start × 2, complete × 3, system complete |
| 8 | `GET /api/analyze/:id/result` | ✅ PASS | Full JSON with all spec fields |
| 9 | `GET /api/patterns` | ✅ PASS | Pattern insights, riskFactors, safestCategories |
| 10 | `POST /api/alert/configure` | ✅ PASS | `{"message":"Alert phone configured"}` |
| 11 | `GET /api/plivo/voice-xml/:id` | ✅ PASS | Valid Plivo XML with Speak + GetDigits |
| 12 | Error: empty input | ✅ PASS | `{"error":"Missing input field"}` |
| 13 | Error: bad analysis ID | ✅ PASS | `{"error":"Analysis not found"}` |

---

## Individual API Test Results

### GitHub API (Agent 1: Repo Health Analyzer)
- **Status:** ✅ Fully working
- **Auth:** Using GITHUB_TOKEN (5000 req/hr)
- **Fields returned:** name, owner, url, stars, forks, openIssues, license, language, createdAt, lastCommitDate, lastCommitDaysAgo, contributorCount, topContributorPct, busFactorScore, commitFrequencyPerWeek, avgIssueResponseHours, issueCloseRate, staleIssueCount, dependencyCount, lastReleaseDate, releaseFrequencyPerMonth, isArchived, isDeprecated, topics, description

### You.com API (Agent 2: External Researcher)
- **Status:** ✅ Working
- **Endpoint:** `https://ydc-index.io/v1/search` with `X-API-Key` header
- **3 queries per package:** CVEs, sentiment, alternatives
- **CVE parsing:** Regex extracts CVE IDs + severity from search results
- **Sentiment:** Classifies as positive/negative/mixed/neutral from keyword frequency
- **Alternatives:** Regex-based extraction with stop-word filtering (fragile but functional)
- **Note:** Alternatives extraction returns noise for some packages; Gemini's alternatives are more reliable

### Gemini API (Agent 3: Risk Synthesizer)
- **Status:** ✅ Fully working (paid key)
- **Model fallback chain:** gemini-2.0-flash → gemini-2.0-flash-lite → gemini-2.5-flash
- **Output:** Structured JSON with grade, scores (5 dimensions), findings, alternatives, verdict
- **Auto-downgrades:** CRITICAL CVE → max C, single maintainer + stale → max D, archived → F

### Composio SDK (Orchestration Layer)
- **Status:** ✅ Working
- **SDK:** `@composio/core` v0.6.3
- **3 custom tools registered:**
  - `DEPSCOPE_REPO_HEALTH` — wraps githubService.analyzeRepo()
  - `DEPSCOPE_RESEARCH` — wraps youService.researchPackage()
  - `DEPSCOPE_RISK_SYNTHESIS` — wraps geminiService.synthesizeRiskAssessment()
- **Execution:** Agents 1 & 2 run in parallel via Composio, Agent 3 runs after
- **Fallback:** If Composio fails, falls back to direct Promise.allSettled execution

### Plivo API (Voice Alerts)
- **Status:** ⚠️ Code complete, not tested with real phone
- **Implementation:** REST API via axios (not plivo npm package)
- **Voice XML:** Generated correctly with Speak + GetDigits
- **SMS:** sendSMS() function implemented
- **Trigger:** Automatically fires when analysis has CRITICAL findings and phone is configured

---

## End-to-End Analysis Results

### lodash (via `https://github.com/lodash/lodash`)
```
Orchestration: composio
Grade: C | Weighted Score: 69
Stars: 61,603 | CVEs: 1 | Findings: 3 | Alternatives: 5
Scores: maintenance=50, security=65, community=90, documentation=80, stability=75
Verdict: "Lodash has a large and established community but suffers from
  infrequent releases and a known security vulnerability in older versions..."
```

### express (via npm name `express`)
```
Orchestration: composio
Grade: B | Weighted Score: 80
Stars: 68,671 | CVEs: 5 | Findings: 3 | Alternatives: 2
Scores: maintenance=80, security=65, community=90, documentation=95, stability=85
Verdict: "Express remains a viable choice for Node.js web application development
  due to its maturity, large community, and comprehensive documentation..."
```

### moment (via `moment/moment`)
```
Orchestration: composio
Grade: C | Weighted Score: 62
Stars: 48,075 | CVEs: 6 | Findings: 3 | Alternatives: 2
Scores: maintenance=30, security=60, community=85, documentation=90, stability=75
Verdict: "Due to the lack of active maintenance and the existence of viable
  alternatives, using Moment.js in production is not recommended..."
```

### axios (via npm name `axios` — NO CACHE, fully live)
```
Orchestration: composio
Grade: B | Weighted Score: 85
Stars: 108,569 | CVEs: 2 | Findings: 2 | Alternatives: 1 (Fetch API)
Scores: maintenance=90, security=75, community=85, documentation=95, stability=90
Verdict: "Axios is a widely used and generally reliable HTTP client. However,
  the existence of known vulnerabilities and some community concerns suggest
  a need for careful evaluation..."
```

### Pattern Insights (after 4 analyses)
```
Total Analyzed: 4 | Average Grade: C
Patterns: "100% of analyzed packages had at least one known CVE"
Most Common Severities: MEDIUM (4), LOW (3), HIGH (2)
Safest Categories: documentation (avg 88), community (avg 88), stability (avg 78)
```

---

## SSE Stream Example (axios analysis)
```
data: {"agent":"repo-health","status":"running","progress":"Fetching repository data from GitHub..."}
data: {"agent":"researcher","status":"running","progress":"Searching CVE databases and community forums..."}
data: {"agent":"repo-health","status":"complete","progress":"Analyzed axios — 108569 stars"}
data: {"agent":"researcher","status":"complete","progress":"Found 2 CVEs, 5 alternatives"}
data: {"agent":"risk-scorer","status":"running","progress":"Synthesizing risk assessment with Gemini..."}
data: {"agent":"risk-scorer","status":"complete","progress":"Grade: B"}
data: {"agent":"system","status":"complete","progress":"Analysis complete (Composio orchestration)"}
```
