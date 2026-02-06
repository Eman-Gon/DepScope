DepScope — Repo Due Diligence Agent
Hackathon Spec | Continual Learning Hackathon | Feb 6, 2026

Elevator Pitch (memorize this)
"Before you npm install, we tell you if you're going to regret it. DepScope is an autonomous multi-agent system that researches any open-source dependency — its maintenance health, security vulnerabilities, community sentiment, and viable alternatives — then calls you when something critical needs your attention."

Prize Targets
Sponsor Tool
How We Use It
Prize
Composio
Multi-agent orchestration (3 agents coordinated)
$1,000 cash
You.com
External research (CVEs, sentiment, alternatives)
$50/person + $200 credits
Plivo
Voice alert for critical findings
$250 GC + $250 credits
Render
Hosts backend + API
$1,000 credits (1st)
Lovable
Dashboard frontend
— (visible sponsor use)
Composio Friction Log
Document bugs/rough edges as we build
AirPods

Total possible winnings: $1,000 + $200 + $500 + $1,000 credits + AirPods

Architecture Overview
┌─────────────────────────────────────────────────────────┐
│                    USER INPUT                           │
│         GitHub URL / npm package name / PyPI name       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              COMPOSIO ORCHESTRATOR                       │
│         Coordinates all 3 agents in parallel             │
│         Manages state, retries, aggregation              │
└──────┬──────────────────┬───────────────────┬───────────┘
       │                  │                   │
       ▼                  ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│   AGENT 1    │  │   AGENT 2    │  │     AGENT 3      │
│  Repo Health │  │  External    │  │   Risk Scorer    │
│  Analyzer    │  │  Researcher  │  │   + Advisor      │
├──────────────┤  ├──────────────┤  ├──────────────────┤
│ GitHub API:  │  │ You.com API: │  │ Gemini:          │
│ • Stars/forks│  │ • CVE search │  │ • Synthesizes    │
│ • Commit freq│  │ • Sentiment  │  │   all data       │
│ • Issue resp │  │   (Reddit,HN)│  │ • Letter grade   │
│   time       │  │ • Deprecation│  │   A-F            │
│ • Bus factor │  │   notices    │  │ • Severity tags   │
│ • License    │  │ • Alternative│  │ • Recommendations│
│ • Dep tree   │  │   libraries  │  │ • Verdict text   │
└──────────────┘  └──────────────┘  └──────────────────┘
       │                  │                   │
       └──────────────────┴───────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   RESULTS AGGREGATOR  │
              │   Merge + Deduplicate │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
   ┌────────────────┐     ┌──────────────────┐
   │    LOVABLE      │     │     PLIVO         │
   │   DASHBOARD     │     │   VOICE ALERT     │
   │                 │     │                   │
   │ • Live agent    │     │ If CRITICAL:      │
   │   status        │     │ Call user with    │
   │ • Risk radar    │     │ spoken briefing   │
   │ • Severity list │     │ of findings       │
   │ • Alternatives  │     │                   │
   │ • Pattern stats │     │ "Press 1 to get   │
   │                 │     │  report texted"   │
   └────────────────┘     └──────────────────┘
              │
              ▼
        ┌───────────┐
        │   RENDER   │
        │  Hosts all │
        └───────────┘



Team Assignments
Person 1 (P1): Composio Pipeline + GitHub Integration
Owner of: Backend orchestration — the spine of the project
Responsibilities:
Set up the Composio account and configure 3 agent tools
Build the GitHub API integration (repo stats extraction)
Wire up the orchestration: trigger all 3 agents, collect results, pass to aggregator
Handle error states and retries
Key deliverables:
/api/analyze endpoint that accepts a GitHub URL or package name
Composio workflow with 3 registered tools
GitHub data extraction returning structured JSON
SSE (Server-Sent Events) endpoint for real-time agent status updates to frontend
Tech:
Node.js + Express (or FastAPI if more comfortable with Python)
Composio SDK
GitHub REST API (no auth needed for public repos, but bring a PAT for rate limits)
SSE for streaming agent status
API endpoints to build:
POST /api/analyze
  Body: { "input": "<https://github.com/user/repo>" OR "lodash" }
  Returns: { "analysisId": "uuid" }

GET /api/analyze/:id/stream
  SSE stream of agent status updates:
  data: { "agent": "repo-health", "status": "running", "progress": "Fetching commit history..." }
  data: { "agent": "researcher", "status": "running", "progress": "Searching CVE databases..." }
  data: { "agent": "risk-scorer", "status": "complete", "result": { ... } }

GET /api/analyze/:id/result
  Returns: full analysis result JSON (see Data Model below)

GET /api/patterns
  Returns: aggregated pattern insights from all analyses this session


GitHub data to extract (no auth needed for public repos):
// These are all available via GitHub REST API without authentication
// (though auth raises rate limit from 60 to 5000 req/hr)

const repoHealth = {
  name: "repo-name",
  owner: "owner",
  stars: 45000,
  forks: 3200,
  openIssues: 342,
  license: "MIT",
  lastCommitDate: "2026-01-28T...",
  createdAt: "2019-03-15T...",
  language: "TypeScript",
  topics: ["framework", "react", "frontend"],

  // Computed from /contributors endpoint
  contributorCount: 156,
  topContributorPct: 0.35,        // % of commits from top contributor
  busFactorScore: "healthy",      // healthy (>5 active) / warning (2-5) / critical (1)

  // Computed from /commits endpoint (last 90 days)
  commitFrequency: 12.5,          // commits per week (last 90 days)
  lastCommitDaysAgo: 3,

  // Computed from /issues endpoint
  avgIssueResponseHours: 18,      // median time to first response
  issueCloseRate: 0.72,           // closed / total (last 90 days)
  staleIssueCount: 45,            // open issues with no activity >30 days

  // From /contents (package.json or requirements.txt)
  dependencyCount: 23,
  hasLockFile: true,

  // From /releases
  lastReleaseDate: "2026-01-15T...",
  releaseFrequency: 2.1,          // releases per month (last 6 months)
}



Person 2 (P2): You.com Research Layer + Gemini Risk Synthesis
Owner of: The intelligence layer — research + analysis
Responsibilities:
Integrate You.com Search API for external research
Build 3 research queries per analysis: CVEs, community sentiment, alternatives
Integrate Gemini API for risk synthesis
Design the scoring algorithm and verdict generation
Key deliverables:
You.com research function that returns structured findings
Gemini prompt that synthesizes repo health + research into a risk profile
Scoring algorithm (A-F grade + radar dimensions)
Pattern aggregation logic (tracks insights across multiple analyses)
You.com Integration:
// You.com Search API - 3 queries per analysis

// Query 1: Security vulnerabilities
const cveQuery = `${packageName} CVE vulnerability security advisory 2025 2026`;
// Parse results for: CVE IDs, severity, affected versions, patch status

// Query 2: Community sentiment
const sentimentQuery = `${packageName} review opinions problems issues reddit hackernews`;
// Parse results for: positive/negative signals, common complaints, praise

// Query 3: Alternatives
const alternativesQuery = `${packageName} alternative replacement better library comparison`;
// Parse results for: alternative package names, comparison points, migration difficulty


You.com API call structure:
// You.com Search API
const response = await fetch('<https://api.you.com/search>', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${YOU_COM_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "lodash CVE vulnerability security advisory",
    num_results: 5
  })
});


Gemini Risk Synthesis Prompt:
You are a senior software engineer evaluating an open-source dependency for production use.

Given the following data about a package, produce a structured risk assessment.

## Repository Health Data
{repoHealthJSON}

## Security Research (from web search)
{cveResearchJSON}

## Community Sentiment (from web search)
{sentimentResearchJSON}

## Alternatives Found (from web search)
{alternativesResearchJSON}

Respond with ONLY valid JSON in this exact format:
{
  "grade": "A" | "B" | "C" | "D" | "F",
  "gradeRationale": "One sentence explaining the grade",

  "scores": {
    "maintenance": 0-100,
    "security": 0-100,
    "community": 0-100,
    "documentation": 0-100,
    "stability": 0-100
  },

  "findings": [
    {
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "security" | "maintenance" | "community" | "stability",
      "title": "Short title",
      "detail": "Explanation with evidence",
      "recommendation": "What to do about it"
    }
  ],

  "alternatives": [
    {
      "name": "package-name",
      "reason": "Why this is a viable alternative",
      "migrationDifficulty": "easy" | "moderate" | "hard",
      "comparison": "Brief comparison to the evaluated package"
    }
  ],

  "verdict": "2-3 sentence executive summary. Be opinionated."
}


Scoring Algorithm:
Overall Grade Calculation:
  A = weighted average >= 80
  B = weighted average >= 65
  C = weighted average >= 50
  D = weighted average >= 35
  F = weighted average < 35

Weights:
  security:      30%  (most important)
  maintenance:   25%
  stability:     20%
  community:     15%
  documentation: 10%

Auto-downgrades (override):
  - Any known unpatched CRITICAL CVE → max grade C
  - Single maintainer + no commits in 90 days → max grade D
  - Archived/deprecated repo → automatic F


Pattern Aggregation (self-improving angle):
// Store results in memory (no DB needed for hackathon)
const analysisHistory = [];

function getPatternInsights() {
  if (analysisHistory.length < 2) return null;

  return {
    totalAnalyzed: analysisHistory.length,
    avgGrade: calculateAvgGrade(),

    // "After analyzing N repos, we've learned..."
    patterns: [
      {
        insight: "Single-maintainer projects have a 73% chance of going unmaintained within 12 months",
        basedOn: `${singleMaintainerCount} of ${total} repos analyzed`,
        confidence: singleMaintainerCount / total
      },
      {
        insight: "Repos with >100 open issues and declining commit frequency are 2x more likely to have unpatched CVEs",
        basedOn: "...",
        confidence: 0.0
      }
    ],

    riskFactors: getMostCommonRiskFactors(),  // sorted by frequency
    safestCategories: getSafestCategories(),
  };
}



Person 3 (P3): Lovable Frontend Dashboard
Owner of: Everything the judges see
Responsibilities:
Build the dashboard UI in Lovable
Real-time agent status display (connected to SSE stream)
Risk radar chart visualization
Findings list with severity color-coding
Alternatives comparison table
Pattern insights panel
Key deliverables:
Input form (GitHub URL or package name)
Live agent status panel (3 agents with status indicators)
Risk radar chart (5 dimensions)
Letter grade display (big, bold, colored)
Severity-ranked findings list
Alternatives comparison table
Pattern insights section
Dashboard Layout:
┌─────────────────────────────────────────────────────┐
│  DepScope                              [Analyze]    │
│  ┌───────────────────────────────────────────────┐  │
│  │  Enter GitHub URL or package name...          │  │
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  AGENT STATUS (live)                                │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────┐  │
│  │ ◉ Repo      │ │ ◉ Research  │ │ ◉ Risk       │  │
│  │   Health    │ │   Engine    │ │   Scorer     │  │
│  │             │ │             │ │              │  │
│  │ Fetching    │ │ Searching   │ │ Waiting...   │  │
│  │ commits...  │ │ CVEs...     │ │              │  │
│  └─────────────┘ └─────────────┘ └──────────────┘  │
│                                                     │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│   ┌──────────┐       │  FINDINGS                    │
│   │          │       │                              │
│   │    B+    │       │  🔴 CRITICAL                 │
│   │          │       │  CVE-2026-1234: Prototype    │
│   └──────────┘       │  pollution in v3.2.1         │
│                      │  → Upgrade to v3.2.2         │
│   ┌──────────────┐   │                              │
│   │  Radar Chart │   │  🟡 HIGH                     │
│   │  (5 axes)    │   │  Bus factor: 1 active        │
│   │              │   │  maintainer (last 90 days)   │
│   │  maintenance │   │  → Consider alternatives     │
│   │  security    │   │                              │
│   │  community   │   │  🟢 MEDIUM                   │
│   │  docs        │   │  12 stale issues (>30 days)  │
│   │  stability   │   │                              │
│   └──────────────┘   │  🔵 LOW                      │
│                      │  No TypeScript types          │
│                      │                              │
├──────────────────────┴──────────────────────────────┤
│                                                     │
│  ALTERNATIVES                                       │
│  ┌──────────┬────────────┬──────────┬────────────┐  │
│  │ Package  │ Migration  │ Maint.   │ Why        │  │
│  ├──────────┼────────────┼──────────┼────────────┤  │
│  │ remeda   │ Easy       │ Active   │ Smaller,   │  │
│  │          │            │ (weekly) │ tree-shake │  │
│  ├──────────┼────────────┼──────────┼────────────┤  │
│  │ radash   │ Moderate   │ Active   │ Modern API │  │
│  │          │            │ (biweek) │ TS-first   │  │
│  └──────────┴────────────┴──────────┴────────────┘  │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  PATTERN INSIGHTS (self-improving)                  │
│  After analyzing 5 packages:                        │
│  • 60% had at least one unpatched CVE               │
│  • Single-maintainer repos scored 40% lower on avg  │
│  • Most common risk: outdated transitive deps       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  VERDICT                                            │
│  "Usable but risky. Active community masks a thin   │
│   maintainer base. The unpatched prototype          │
│   pollution CVE is a blocker for production.         │
│   Consider remeda as a drop-in replacement."        │
│                                                     │
└─────────────────────────────────────────────────────┘


Tech notes for Lovable build:
Use Lovable's AI builder — describe the layout above in natural language
Connect to the backend SSE endpoint for live agent status
Use a charting library (Recharts or Chart.js) for the radar chart — Lovable should handle this
Color-code severity: CRITICAL = red, HIGH = orange, MEDIUM = yellow, LOW = blue
Grade display: A = green, B = blue, C = yellow, D = orange, F = red
Make it responsive but prioritize desktop (judges will see it on a projector)
Lovable prompt to start with:
Build a dashboard for "DepScope" - a dependency risk analysis tool.

Header: Logo text "DepScope" on the left, dark theme.

Input: Large search bar at top. Placeholder: "Paste a GitHub URL or npm package name..."
with an "Analyze" button.

Agent Status: 3 cards in a row showing real-time status of parallel agents:
- "Repo Health" (icon: database)
- "Research Engine" (icon: search)
- "Risk Scorer" (icon: shield)
Each card shows: agent name, status (idle/running/complete), and a progress message.
Use pulsing animation when running.

Main content (2 columns):
Left column:
- Large letter grade (A-F) in a circle, color coded
- Radar/spider chart with 5 axes: Maintenance, Security, Community, Docs, Stability

Right column:
- Findings list, each with severity badge (CRITICAL red, HIGH orange, MEDIUM yellow, LOW blue),
  title, detail, and recommendation

Below main content:
- Alternatives comparison table: Package name, Migration difficulty, Maintenance status, Why switch
- Pattern Insights panel: Stats from multiple analyses
- Verdict: 2-3 sentence bold summary

Dark theme. Professional. Think "Bloomberg terminal meets GitHub."



Person 4 (P4): Plivo Voice Alerts + Render Deployment + Friction Log
Owner of: The demo wow-factor + deployment + the free AirPods
Responsibilities:
Integrate Plivo to call users when CRITICAL findings are detected
Deploy everything to Render
Maintain the Composio friction log throughout the day
Prepare the demo script and rehearse
Plivo Voice Alert Integration:
// Plivo setup
const plivo = require('plivo');
const client = new plivo.Client(AUTH_ID, AUTH_TOKEN);

// When analysis finds CRITICAL severity findings, trigger a call
async function triggerVoiceAlert(phoneNumber, analysisResult) {
  const criticalFindings = analysisResult.findings
    .filter(f => f.severity === 'CRITICAL');

  if (criticalFindings.length === 0) return;

  // Create the spoken message
  const spokenMessage = buildSpokenBriefing(analysisResult, criticalFindings);

  // Make the call
  const call = await client.calls.create(
    PLIVO_PHONE_NUMBER,     // from (your Plivo number)
    phoneNumber,             // to (user's phone)
    `${BASE_URL}/api/plivo/voice-xml/${analysisResult.id}`,  // answer_url
    {
      answerMethod: 'GET',
    }
  );

  return call;
}

// Plivo fetches this XML when call connects
// GET /api/plivo/voice-xml/:analysisId
function generateVoiceXml(analysisResult, criticalFindings) {
  const packageName = analysisResult.repoHealth.name;
  const grade = analysisResult.grade;
  const topFinding = criticalFindings[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Speak voice="Polly.Matthew" language="en-US">
      DepScope alert for ${packageName}.
      Overall risk grade: ${grade}.
      Critical finding: ${topFinding.title}.
      ${topFinding.detail}.
      Our recommendation: ${topFinding.recommendation}.
      ${criticalFindings.length > 1
        ? `There are ${criticalFindings.length - 1} additional critical findings.`
        : ''
      }
      Press 1 to receive the full report via text message.
      Press 2 to dismiss.
    </Speak>
    <GetDigits action="${BASE_URL}/api/plivo/handle-input/${analysisResult.id}"
               method="POST" timeout="10" numDigits="1">
      <Speak>Please press 1 or 2.</Speak>
    </GetDigits>
  </Response>`;
}

// Handle keypress
// POST /api/plivo/handle-input/:analysisId
function handleInput(digits, analysisId, userPhone) {
  if (digits === '1') {
    // Send SMS with report link
    client.messages.create({
      src: PLIVO_PHONE_NUMBER,
      dst: userPhone,
      text: `DepScope Report: ${BASE_URL}/report/${analysisId}`
    });
    return `<Response><Speak>Report sent. Goodbye.</Speak></Response>`;
  }
  return `<Response><Speak>Dismissed. Goodbye.</Speak></Response>`;
}


Plivo endpoints to register:
GET  /api/plivo/voice-xml/:analysisId     → returns TwiML-style XML for call
POST /api/plivo/handle-input/:analysisId  → handles DTMF keypress (1=send SMS, 2=dismiss)
POST /api/alert/configure                  → { phone: "+1234567890" } - register phone for alerts


Render Deployment Checklist:
1. Create Render account (free tier works)
2. Connect GitHub repo
3. Create Web Service:
   - Build command: npm install
   - Start command: node server.js (or python -m uvicorn main:app)
   - Environment variables:
     - COMPOSIO_API_KEY
     - YOU_COM_API_KEY
     - GEMINI_API_KEY
     - PLIVO_AUTH_ID
     - PLIVO_AUTH_TOKEN
     - PLIVO_PHONE_NUMBER
     - GITHUB_TOKEN (optional, for higher rate limits)
4. Note the public URL (*.onrender.com)
5. Update Plivo webhook URLs to use the Render URL
6. Test end-to-end

IMPORTANT: Render free tier has cold starts (~30s).
If demo freezes, have a backup: pre-cache one analysis result.


Composio Friction Log (START THIS IMMEDIATELY):
Keep a running Google Doc / Notion page. Every time anyone on the team hits a Composio issue, log it:
Format:
[TIMESTAMP] [WHO] [SEVERITY: blocker/annoying/minor]
What I was trying to do:
What happened:
What I expected:
Workaround (if any):
Screenshot (if applicable):


Example entries:

[9:15 AM] Kevin [annoying]
Trying to: Register a custom tool in Composio
What happened: Docs show v2 API but SDK is still v1, function signature mismatch
Expected: Docs and SDK to match
Workaround: Used v1 pattern from GitHub examples instead

[10:30 AM] P2 [blocker]
Trying to: Pass structured JSON between agents
What happened: Agent output gets stringified and re-parsed, losing nested objects
Expected: Clean JSON passthrough
Workaround: Base64-encoded the JSON payload


This log is literally free AirPods. Don't forget it.

Data Model
Analysis Result (complete JSON structure)
{
  "id": "uuid-v4",
  "input": "<https://github.com/lodash/lodash>",
  "packageName": "lodash",
  "timestamp": "2026-02-06T12:34:56Z",
  "status": "complete",

  "repoHealth": {
    "name": "lodash",
    "owner": "lodash",
    "url": "<https://github.com/lodash/lodash>",
    "stars": 58400,
    "forks": 6900,
    "openIssues": 342,
    "license": "MIT",
    "language": "JavaScript",
    "createdAt": "2012-04-28T...",
    "lastCommitDate": "2025-09-15T...",
    "lastCommitDaysAgo": 144,
    "contributorCount": 356,
    "topContributorPct": 0.72,
    "busFactorScore": "critical",
    "commitFrequencyPerWeek": 0.3,
    "avgIssueResponseHours": 720,
    "issueCloseRate": 0.12,
    "staleIssueCount": 287,
    "dependencyCount": 0,
    "lastReleaseDate": "2024-02-20T...",
    "releaseFrequencyPerMonth": 0.08
  },

  "research": {
    "cves": [
      {
        "id": "CVE-2021-23337",
        "severity": "HIGH",
        "description": "Command injection via template function",
        "affectedVersions": "<4.17.21",
        "patched": true,
        "patchVersion": "4.17.21"
      }
    ],
    "sentiment": {
      "overall": "mixed",
      "positiveSignals": ["Ubiquitous", "Well-tested", "Familiar API"],
      "negativeSignals": ["Effectively unmaintained", "Bloated bundle size", "Modern JS makes most functions unnecessary"],
      "sources": ["Reddit r/javascript", "Hacker News", "dev.to"]
    },
    "alternatives": [
      {
        "name": "remeda",
        "reason": "Modern, tree-shakeable, TypeScript-first utility library",
        "migrationDifficulty": "moderate",
        "comparison": "Similar API surface but 90% smaller bundle. Actively maintained with weekly releases."
      },
      {
        "name": "radash",
        "reason": "Modern lodash alternative with zero dependencies",
        "migrationDifficulty": "moderate",
        "comparison": "Different API naming but covers most lodash use cases. Strong TypeScript support."
      },
      {
        "name": "es-toolkit",
        "reason": "Drop-in lodash replacement by Toss team",
        "migrationDifficulty": "easy",
        "comparison": "Designed as a direct lodash replacement. 97% smaller, 2x faster."
      }
    ]
  },

  "scores": {
    "maintenance": 15,
    "security": 65,
    "community": 70,
    "documentation": 80,
    "stability": 45
  },

  "grade": "D",
  "gradeRationale": "Effectively unmaintained since 2024 with a single active contributor and severely declining commit activity.",

  "findings": [
    {
      "severity": "CRITICAL",
      "category": "maintenance",
      "title": "Repository effectively abandoned",
      "detail": "Last meaningful commit was 144 days ago. Release frequency has dropped to 0.08/month. 287 stale issues with no response.",
      "recommendation": "Migrate to es-toolkit (drop-in replacement) or remeda."
    },
    {
      "severity": "HIGH",
      "category": "maintenance",
      "title": "Critical bus factor: single maintainer",
      "detail": "72% of all commits come from one contributor. No other active maintainers in the last 90 days.",
      "recommendation": "This is a supply-chain risk. Any key-person event leaves the package orphaned."
    },
    {
      "severity": "MEDIUM",
      "category": "security",
      "title": "Historical CVE (patched)",
      "detail": "CVE-2021-23337 (command injection) was patched in 4.17.21. Ensure you're on latest version.",
      "recommendation": "Verify your lockfile pins >= 4.17.21."
    },
    {
      "severity": "LOW",
      "category": "stability",
      "title": "Bundle size concerns",
      "detail": "Full lodash import adds ~70KB to bundle. Tree-shaking is limited due to CommonJS format.",
      "recommendation": "Use lodash-es for tree-shaking, or migrate to a modern alternative."
    }
  ],

  "alternatives": [
    {
      "name": "es-toolkit",
      "reason": "Drop-in lodash replacement, 97% smaller",
      "migrationDifficulty": "easy",
      "comparison": "Designed as a direct replacement. Same API, dramatically better performance."
    }
  ],

  "verdict": "Lodash is a legacy dependency that should be actively migrated away from. It's effectively unmaintained, carries bundle bloat, and has multiple modern replacements that are smaller, faster, and actively maintained. Start migration to es-toolkit immediately."
}



Implementation Timeline
9:30 AM  — Doors open, set up laptops, get WiFi
9:45 AM  — Keynote (listen for sponsor-specific tips)
10:00 AM — Get ALL API keys:
            □ Composio (sign up + get key)
            □ You.com (sign up + get key)
            □ Plivo (sign up + buy a phone number)
            □ Gemini (Google AI Studio key)
            □ GitHub PAT (settings → developer settings → personal access tokens)
            □ Render account created
            □ Lovable credits activated (code: CREATORSLOVABLE)
10:15 AM — Repo setup:
            □ GitHub repo created, all 4 people have access
            □ .env.example with all key names
            □ Basic Express/FastAPI server running locally
            □ Start Composio friction log doc

--- CODING STARTS AT 11:00 AM ---

11:00-12:00 (Hour 1 — Foundations, work in parallel)
  P1: Composio SDK setup + basic orchestration skeleton + GitHub API data extraction
  P2: You.com API integration + test queries returning results
  P3: Lovable dashboard shell — input form, agent status cards, layout scaffolding
  P4: Plivo account setup + test call working + Render deployment pipeline

  MILESTONE @ 12:00: Each person can demo their piece independently.

12:00-1:00 (Hour 2 — Integration)
  P1: Connect Composio orchestration to P2's research functions
  P2: Build Gemini synthesis prompt + scoring algorithm
  P3: Connect dashboard to backend SSE stream (agent status updates live)
  P4: Build voice XML generation + wire Plivo to trigger on CRITICAL findings

  MILESTONE @ 1:00: End-to-end flow works for 1 hardcoded repo.

1:00-1:30 — LUNCH (eat fast, talk through demo script)

1:30-2:30 (Hour 3 — Polish + Real Data)
  P1: Error handling, retries, input parsing (handle npm names AND GitHub URLs)
  P2: Pattern aggregation logic, test with 3-4 different repos
  P3: Radar chart, findings list, alternatives table, pattern insights panel
  P4: Test Plivo call end-to-end on Render URL, prepare demo phone

  MILESTONE @ 2:30: Can analyze any public repo end-to-end.

2:30-3:30 (Hour 4 — Hardening + Demo Prep)
  P1: Pre-cache 2-3 demo analyses in case of API failures during demo
  P2: Tune Gemini prompt — make verdicts more opinionated and punchy
  P3: Visual polish — animations, colors, make it look like a real product
  P4: Write + rehearse demo script, test Plivo call timing

  MILESTONE @ 3:30: Full demo rehearsal #1.

3:30-4:15 (Final 45 min — Demo polish)
  ALL: Run through demo 2-3 times
  ALL: Fix any bugs that surfaced
  P3: Final UI tweaks based on demo rehearsal
  P4: Record 3-minute demo video (Devpost requirement)

4:15-4:30 — Submit to Devpost
  □ Project name: DepScope
  □ Demo video uploaded
  □ Description + tech stack written
  □ All sponsor tools listed
  □ Screenshots attached
  □ GitHub repo linked

4:30 PM — SUBMISSION DEADLINE

4:30-5:00 — Prep for live presentation
  P4: Submit Composio friction log



3-Minute Demo Script
[0:00-0:20] The Hook "Raise your hand if you've ever npm installed a package, only to find out 6 months later it's abandoned, has an unpatched CVE, or is maintained by one person who lost interest. [pause] That's every developer. DepScope fixes this."
[0:20-0:50] Show the Input "Let's check lodash — one of the most popular packages on npm." → Paste https://github.com/lodash/lodash into the search bar → Hit Analyze
[0:50-1:30] Watch the Agents Work (live) "You can see our three agents working in parallel, orchestrated by Composio:" → Point to agent status cards lighting up "Agent 1 is pulling repo health from GitHub. Agent 2 is using You.com to research CVEs and community sentiment. Agent 3 is synthesizing everything into a risk score with Gemini." → Results populate
[1:30-2:10] Show the Results "Lodash gets a D. Here's why:" → Point to radar chart (low maintenance, decent security) → Show CRITICAL finding: "Effectively abandoned — last commit 144 days ago" → Show the alternatives table: "es-toolkit is a drop-in replacement, 97% smaller" → Show the verdict
[2:10-2:40] The Phone Call (the moment) "And when we find something critical..." → Phone rings on the table → Pick up on speaker: "DepScope alert for lodash. Overall risk grade: D. Critical finding: Repository effectively abandoned..." → Press 1 → SMS arrives with report link "Your dependencies don't just get a report — they get a phone call."
[2:40-3:00] Self-Improvement + Close "And DepScope gets smarter. After analyzing 5 packages today, it's already learned that single-maintainer repos score 40% lower on average. Every scan makes the next one more accurate." → Show pattern insights panel "DepScope: know what you're installing before you regret it. Thank you."

Backup Plans
If Composio breaks:
Replace orchestration with simple Promise.all() running 3 async functions in parallel. You lose the Composio prize but keep everything else working.
If You.com API is slow/down:
Pre-cache research results for 3 demo packages (lodash, moment, express). Fall back to cached data if API times out after 10 seconds.
If Plivo call doesn't connect during demo:
Have a pre-recorded video of the call working as backup. Play it and say "here's what happens when we detect a critical finding."
If Render cold start kills the demo:
Hit the endpoint 5 minutes before your demo slot to warm it up. Or run locally and demo from localhost (less impressive but functional).
If Gemini rate-limits:
Cache synthesis results. Alternatively, swap to a free Claude or GPT endpoint.

Devpost Submission Template
Project Name: DepScope
Tagline: Before you npm install, we tell you if you're going to regret it.
Inspiration: Every developer has been burned by a bad dependency — an abandoned package, an unpatched CVE discovered in production, a single-maintainer project that silently dies. Current tools like GitHub's Dependabot only catch known CVEs after you've already installed the package. We built DepScope to shift that evaluation left — before the dependency enters your codebase.
What it does: DepScope is an autonomous multi-agent system that performs comprehensive due diligence on any open-source dependency. Paste a GitHub URL or package name, and three specialized agents work in parallel: one analyzes repository health (commit frequency, bus factor, issue response time), one researches external signals (CVEs, community sentiment, alternatives), and one synthesizes everything into a letter-grade risk assessment with severity-ranked findings and migration recommendations. When critical risks are detected, DepScope calls you via phone with a spoken briefing.
How we built it:
Composio orchestrates our 3-agent pipeline (Repo Health Analyzer, External Researcher, Risk Scorer)
You.com Search API powers our external research: CVE lookups, community sentiment analysis, and alternative discovery
Gemini synthesizes all signals into structured risk assessments with opinionated verdicts
Plivo delivers voice alerts when critical findings are detected, with SMS follow-up
Lovable for the real-time dashboard
Render for deployment
Challenges we ran into: [Fill in honestly during the hackathon — real challenges are more compelling than generic ones]
What we learned: [Fill in during the hackathon]
Built with: composio, you.com, plivo, render, lovable, gemini, github-api, node.js, express
