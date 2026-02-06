// Pre-cached demo data for fallback when APIs are unavailable
const DEMO_CACHE = {
  'lodash': {
    repoHealth: {
      name: 'lodash', owner: 'lodash', url: 'https://github.com/lodash/lodash',
      stars: 58400, forks: 6900, openIssues: 342, license: 'MIT',
      language: 'JavaScript', createdAt: '2012-04-28T00:00:00Z',
      lastCommitDate: '2025-09-15T00:00:00Z', lastCommitDaysAgo: 144,
      contributorCount: 356, topContributorPct: 0.72, busFactorScore: 'critical',
      commitFrequencyPerWeek: 0.3, avgIssueResponseHours: 720,
      issueCloseRate: 0.12, staleIssueCount: 287, dependencyCount: 0,
      lastReleaseDate: '2024-02-20T00:00:00Z', releaseFrequencyPerMonth: 0.08,
    },
    research: {
      cves: [
        { id: 'CVE-2021-23337', severity: 'HIGH', description: 'Command injection via template function', source: 'https://nvd.nist.gov' },
        { id: 'CVE-2020-28500', severity: 'MEDIUM', description: 'Regular expression denial of service (ReDoS)', source: 'https://nvd.nist.gov' },
      ],
      sentiment: {
        overall: 'mixed',
        positiveSignals: ['Ubiquitous', 'Well-tested', 'Familiar API'],
        negativeSignals: ['Effectively unmaintained', 'Bloated bundle size', 'Modern JS replaces most functions'],
        sources: ['reddit.com', 'news.ycombinator.com', 'dev.to'],
      },
      alternatives: [
        { name: 'es-toolkit', source: 'https://github.com/toss/es-toolkit', context: 'Drop-in lodash replacement by Toss team, 97% smaller, 2x faster.' },
        { name: 'remeda', source: 'https://github.com/remeda/remeda', context: 'Modern, tree-shakeable, TypeScript-first utility library.' },
        { name: 'radash', source: 'https://github.com/rayepps/radash', context: 'Modern lodash alternative with zero dependencies.' },
      ],
    },
    assessment: {
      grade: 'D',
      gradeRationale: 'Effectively unmaintained since 2024 with a single active contributor and severely declining commit activity.',
      scores: { maintenance: 15, security: 65, community: 70, documentation: 80, stability: 45 },
      findings: [
        { severity: 'CRITICAL', category: 'maintenance', title: 'Repository effectively abandoned', detail: 'Last meaningful commit was 144 days ago. Release frequency has dropped to 0.08/month. 287 stale issues with no response.', recommendation: 'Migrate to es-toolkit (drop-in replacement) or remeda.' },
        { severity: 'HIGH', category: 'maintenance', title: 'Critical bus factor: single maintainer', detail: '72% of all commits come from one contributor. No other active maintainers in the last 90 days.', recommendation: 'This is a supply-chain risk. Any key-person event leaves the package orphaned.' },
        { severity: 'MEDIUM', category: 'security', title: 'Historical CVEs (patched)', detail: 'CVE-2021-23337 and CVE-2020-28500 were patched in 4.17.21.', recommendation: 'Verify your lockfile pins >= 4.17.21.' },
        { severity: 'LOW', category: 'stability', title: 'Bundle size concerns', detail: 'Full lodash import adds ~70KB to bundle. Tree-shaking is limited due to CommonJS format.', recommendation: 'Use lodash-es for tree-shaking, or migrate to a modern alternative.' },
      ],
      alternatives: [
        { name: 'es-toolkit', reason: 'Drop-in lodash replacement, 97% smaller', migrationDifficulty: 'easy', comparison: 'Same API, dramatically better performance.' },
        { name: 'remeda', reason: 'Modern, tree-shakeable, TypeScript-first', migrationDifficulty: 'moderate', comparison: 'Similar API surface but 90% smaller bundle.' },
      ],
      verdict: 'Lodash is a legacy dependency that should be actively migrated away from. It\'s effectively unmaintained, carries bundle bloat, and has multiple modern replacements. Start migration to es-toolkit immediately.',
      weightedScore: 47,
    },
  },
  'moment': {
    repoHealth: {
      name: 'moment', owner: 'moment', url: 'https://github.com/moment/moment',
      stars: 47900, forks: 7200, openIssues: 250, license: 'MIT',
      language: 'JavaScript', createdAt: '2011-03-01T00:00:00Z',
      lastCommitDate: '2023-01-01T00:00:00Z', lastCommitDaysAgo: 1130,
      contributorCount: 550, topContributorPct: 0.45, busFactorScore: 'warning',
      commitFrequencyPerWeek: 0.0, avgIssueResponseHours: 2160,
      issueCloseRate: 0.08, staleIssueCount: 200, dependencyCount: 0,
      lastReleaseDate: '2022-10-01T00:00:00Z', releaseFrequencyPerMonth: 0.0,
    },
    research: {
      cves: [],
      sentiment: {
        overall: 'negative',
        positiveSignals: ['Widely documented', 'Huge ecosystem'],
        negativeSignals: ['Officially in maintenance mode', 'Mutable by default', 'Massive bundle size'],
        sources: ['reddit.com', 'news.ycombinator.com'],
      },
      alternatives: [
        { name: 'date-fns', source: 'https://github.com/date-fns/date-fns', context: 'Modern, modular date utility library.' },
        { name: 'dayjs', source: 'https://github.com/iamkun/dayjs', context: '2KB drop-in replacement for Moment.js.' },
        { name: 'luxon', source: 'https://github.com/moment/luxon', context: 'By the Moment team, built on Intl API.' },
      ],
    },
    assessment: {
      grade: 'F',
      gradeRationale: 'Officially deprecated by its maintainers. No new features or patches will be released.',
      scores: { maintenance: 5, security: 50, community: 60, documentation: 85, stability: 30 },
      findings: [
        { severity: 'CRITICAL', category: 'maintenance', title: 'Project officially deprecated', detail: 'Moment.js team has declared the project in maintenance mode. No new features or patches.', recommendation: 'Migrate to dayjs (drop-in) or date-fns (modular).' },
        { severity: 'HIGH', category: 'stability', title: 'Massive bundle size (330KB)', detail: 'Moment.js with locale data is 330KB. Tree-shaking is impossible due to architecture.', recommendation: 'Use dayjs (2KB) as a drop-in replacement.' },
      ],
      alternatives: [
        { name: 'dayjs', reason: '2KB drop-in Moment replacement', migrationDifficulty: 'easy', comparison: 'Same API, 99% smaller.' },
        { name: 'date-fns', reason: 'Modular, tree-shakeable date functions', migrationDifficulty: 'moderate', comparison: 'Different API but more modern and efficient.' },
      ],
      verdict: 'Moment.js is officially deprecated. Stop using it immediately. Dayjs is a 2KB drop-in replacement with the same API.',
      weightedScore: 32,
    },
  },
  'express': {
    repoHealth: {
      name: 'express', owner: 'expressjs', url: 'https://github.com/expressjs/express',
      stars: 65000, forks: 15800, openIssues: 180, license: 'MIT',
      language: 'JavaScript', createdAt: '2009-06-26T00:00:00Z',
      lastCommitDate: '2026-01-20T00:00:00Z', lastCommitDaysAgo: 17,
      contributorCount: 320, topContributorPct: 0.28, busFactorScore: 'healthy',
      commitFrequencyPerWeek: 4.2, avgIssueResponseHours: 48,
      issueCloseRate: 0.68, staleIssueCount: 35, dependencyCount: 30,
      lastReleaseDate: '2026-01-10T00:00:00Z', releaseFrequencyPerMonth: 1.5,
    },
    research: {
      cves: [],
      sentiment: {
        overall: 'positive',
        positiveSignals: ['Industry standard', 'Massive ecosystem', 'Express 5 released'],
        negativeSignals: ['Minimal by design', 'Callback-heavy legacy API'],
        sources: ['reddit.com', 'stackoverflow.com'],
      },
      alternatives: [
        { name: 'fastify', source: 'https://github.com/fastify/fastify', context: 'High-performance Node.js web framework.' },
        { name: 'hono', source: 'https://github.com/honojs/hono', context: 'Ultrafast web framework for edge computing.' },
      ],
    },
    assessment: {
      grade: 'B',
      gradeRationale: 'Actively maintained with Express 5 release, strong community, but large dependency tree.',
      scores: { maintenance: 75, security: 80, community: 90, documentation: 85, stability: 70 },
      findings: [
        { severity: 'MEDIUM', category: 'stability', title: 'Large dependency tree', detail: 'Express has 30 direct dependencies, increasing supply chain attack surface.', recommendation: 'Audit transitive dependencies regularly.' },
        { severity: 'LOW', category: 'maintenance', title: 'Legacy callback patterns', detail: 'Core API still uses callback patterns despite async/await being standard.', recommendation: 'Use express-async-errors or migrate to Fastify for native async support.' },
      ],
      alternatives: [
        { name: 'fastify', reason: 'High performance, schema-based validation', migrationDifficulty: 'moderate', comparison: '2x faster, native async/await, built-in validation.' },
        { name: 'hono', reason: 'Edge-first, ultrafast, tiny bundle', migrationDifficulty: 'moderate', comparison: 'Best for serverless/edge, minimal footprint.' },
      ],
      verdict: 'Express remains a solid choice for Node.js web servers, especially with Express 5. The ecosystem is unmatched, but consider Fastify for new projects requiring high performance.',
      weightedScore: 79,
    },
  },
};

function getCachedData(packageName) {
  const key = packageName.toLowerCase();
  return DEMO_CACHE[key] || null;
}

function hasCachedData(packageName) {
  return packageName.toLowerCase() in DEMO_CACHE;
}

module.exports = { getCachedData, hasCachedData, DEMO_CACHE };
