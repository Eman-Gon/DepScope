export interface Finding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  recommendation: string;
}

export interface Alternative {
  name: string;
  migrationDifficulty: string;
  maintenance: string;
  reason: string;
}

export interface AnalysisResult {
  packageName: string;
  grade: string;
  gradeRationale: string;
  scores: {
    maintenance: number;
    security: number;
    community: number;
    documentation: number;
    stability: number;
  };
  findings: Finding[];
  alternatives: Alternative[];
  verdict: string;
  patternInsights: {
    totalAnalyzed: number;
    insights: string[];
  };
}

export const mockAnalysisResult: AnalysisResult = {
  packageName: "lodash",
  grade: "D",
  gradeRationale: "Effectively unmaintained since 2024 with a single active contributor.",
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
      title: "Repository effectively abandoned", 
      detail: "Last meaningful commit was over 100 days ago.", 
      recommendation: "Migrate to es-toolkit." 
    },
    { 
      severity: "HIGH", 
      title: "Critical bus factor: single maintainer", 
      detail: "72% of all commits from one contributor.", 
      recommendation: "Supply-chain risk." 
    },
    { 
      severity: "MEDIUM", 
      title: "Historical CVEs (patched)", 
      detail: "CVE-2021-23337 patched in 4.17.21.", 
      recommendation: "Verify lockfile." 
    },
    { 
      severity: "LOW", 
      title: "Bundle size concerns", 
      detail: "Full lodash adds ~70KB.", 
      recommendation: "Use lodash-es or migrate." 
    }
  ],
  alternatives: [
    { 
      name: "es-toolkit", 
      migrationDifficulty: "Easy", 
      maintenance: "Active", 
      reason: "Drop-in replacement, 97% smaller. Same API, dramatically better performance." 
    },
    { 
      name: "remeda", 
      migrationDifficulty: "Moderate", 
      maintenance: "Active (weekly)", 
      reason: "TypeScript-first utility library. 90% smaller bundle." 
    },
    { 
      name: "radash", 
      migrationDifficulty: "Moderate", 
      maintenance: "Active", 
      reason: "Zero dependencies. Strong TypeScript support." 
    }
  ],
  verdict: "Lodash is a legacy dependency that should be actively migrated away from. It's effectively unmaintained, carries bundle bloat, and has multiple modern replacements that are smaller, faster, and actively maintained. Start migration to es-toolkit immediately.",
  patternInsights: {
    totalAnalyzed: 5,
    insights: [
      "60% had at least one unpatched CVE",
      "Single-maintainer repos scored 40% lower on average",
      "Most common risk: outdated transitive dependencies"
    ]
  }
};
