require('dotenv').config();
const { analyzeRepo } = require('./src/services/githubService');

// Hardcoded demo data — bypass You.com and Gemini until keys work
const MOCK_RESEARCH = {
  cves: [
    {
      id: "CVE-2021-23337",
      severity: "HIGH",
      description: "Command injection via template function",
      affectedVersions: "<4.17.21",
      patched: true,
      patchVersion: "4.17.21"
    },
    {
      id: "CVE-2020-28500",
      severity: "MEDIUM",
      description: "Regular expression denial of service (ReDoS) in lodash",
      affectedVersions: "<4.17.21",
      patched: true,
      patchVersion: "4.17.21"
    }
  ],
  sentiment: {
    overall: "mixed",
    positiveSignals: ["Ubiquitous", "Well-tested", "Familiar API"],
    negativeSignals: ["Effectively unmaintained", "Bloated bundle size", "Modern JS makes most functions unnecessary"],
    sources: ["Reddit r/javascript", "Hacker News", "dev.to"]
  },
  alternatives: [
    {
      name: "es-toolkit",
      reason: "Drop-in lodash replacement by Toss team",
      migrationDifficulty: "easy",
      comparison: "Designed as a direct lodash replacement. 97% smaller, 2x faster."
    },
    {
      name: "remeda",
      reason: "Modern, tree-shakeable, TypeScript-first utility library",
      migrationDifficulty: "moderate",
      comparison: "Similar API surface but 90% smaller bundle. Actively maintained with weekly releases."
    },
    {
      name: "radash",
      reason: "Modern lodash alternative with zero dependencies",
      migrationDifficulty: "moderate",
      comparison: "Different API naming but covers most lodash use cases. Strong TypeScript support."
    }
  ]
};

const MOCK_ASSESSMENT = {
  grade: "D",
  gradeRationale: "Effectively unmaintained since 2024 with a single active contributor and severely declining commit activity.",
  scores: {
    maintenance: 15,
    security: 65,
    community: 70,
    documentation: 80,
    stability: 45
  },
  findings: [
    {
      severity: "CRITICAL",
      category: "maintenance",
      title: "Repository effectively abandoned",
      detail: "Last meaningful commit was over 100 days ago. Release frequency has dropped dramatically. Hundreds of stale issues with no response.",
      recommendation: "Migrate to es-toolkit (drop-in replacement) or remeda."
    },
    {
      severity: "HIGH",
      category: "maintenance",
      title: "Critical bus factor: single maintainer",
      detail: "72% of all commits come from one contributor. No other active maintainers in the last 90 days.",
      recommendation: "This is a supply-chain risk. Any key-person event leaves the package orphaned."
    },
    {
      severity: "MEDIUM",
      category: "security",
      title: "Historical CVEs (patched)",
      detail: "CVE-2021-23337 (command injection) and CVE-2020-28500 (ReDoS) were patched in 4.17.21.",
      recommendation: "Verify your lockfile pins >= 4.17.21."
    },
    {
      severity: "LOW",
      category: "stability",
      title: "Bundle size concerns",
      detail: "Full lodash import adds ~70KB to bundle. Tree-shaking is limited due to CommonJS format.",
      recommendation: "Use lodash-es for tree-shaking, or migrate to a modern alternative."
    }
  ],
  alternatives: MOCK_RESEARCH.alternatives,
  verdict: "Lodash is a legacy dependency that should be actively migrated away from. It's effectively unmaintained, carries bundle bloat, and has multiple modern replacements that are smaller, faster, and actively maintained. Start migration to es-toolkit immediately.",
  weightedScore: 47
};

async function testWithMockData(repoUrl) {
  console.log('=== DEPSCOPE FULL ANALYSIS (with cached research data) ===\n');

  console.log('Step 1: Analyzing repo health (LIVE from GitHub)...');
  const repoHealth = await analyzeRepo(repoUrl);
  console.log(`✓ ${repoHealth.name} - ${repoHealth.stars} stars, bus factor: ${repoHealth.busFactorScore}\n`);

  console.log('Step 2: Loading research data (CACHED)...');
  const research = MOCK_RESEARCH;
  console.log(`✓ ${research.cves.length} CVEs, ${research.alternatives.length} alternatives\n`);

  console.log('Step 3: Loading risk assessment (CACHED)...');
  const assessment = MOCK_ASSESSMENT;
  console.log(`✓ Grade: ${assessment.grade}\n`);

  // Build the full result object matching the data model
  const fullResult = {
    id: "demo-" + Date.now(),
    input: repoUrl,
    packageName: repoHealth.name,
    timestamp: new Date().toISOString(),
    status: "complete",
    repoHealth,
    research,
    ...assessment
  };

  console.log('=== FINAL RESULT ===');
  console.log(JSON.stringify(fullResult, null, 2));

  return fullResult;
}

testWithMockData('https://github.com/lodash/lodash')
  .catch(err => console.error('Error:', err.message));