import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wrench, Eye, EyeOff, TrendingUp, ArrowRight, CheckCircle2, ChevronDown, Shield, AlertTriangle, Info, Zap } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import type { Finding, Alternative } from '@/data/mockData';

interface Scores {
  maintenance: number;
  security: number;
  community: number;
  documentation: number;
  stability: number;
}

interface Fix {
  action: string;
  detail: string;
  impact: string;
  category: keyof Scores;
  boost: number;
  severity: Finding['severity'];
  why: string;
  steps: string[];
  effort: 'Quick' | 'Moderate' | 'Significant';
  findingDetail: string;
}

function guessCategoryFromFinding(f: Finding): keyof Scores {
  const text = (f.title + ' ' + f.detail + ' ' + f.recommendation).toLowerCase();
  if (text.includes('cve') || text.includes('vulnerab') || text.includes('security') || text.includes('patch')) return 'security';
  if (text.includes('maintain') || text.includes('commit') || text.includes('abandon') || text.includes('stale')) return 'maintenance';
  if (text.includes('bus factor') || text.includes('contributor') || text.includes('community')) return 'community';
  if (text.includes('bundle') || text.includes('stability') || text.includes('deprecat')) return 'stability';
  return 'maintenance';
}

function generateSteps(f: Finding, cat: keyof Scores): string[] {
  const text = (f.title + ' ' + f.detail + ' ' + f.recommendation).toLowerCase();
  if (text.includes('cve') || text.includes('vulnerab') || text.includes('patch')) {
    return [
      `Run \`npm audit\` to identify all affected versions`,
      `Update to the patched version specified in the advisory`,
      `Verify lockfile pins the safe version: \`npm ls <package>\``,
      `Run your test suite to confirm nothing broke after the update`,
    ];
  }
  if (text.includes('abandon') || text.includes('unmaintain') || text.includes('stale') || text.includes('commit')) {
    return [
      `Check the repository for any recent activity or forks that are actively maintained`,
      `Evaluate alternative packages that cover your use cases`,
      `Create an internal wrapper/abstraction to isolate the dependency`,
      `Plan a phased migration to reduce risk of breaking changes`,
    ];
  }
  if (text.includes('bus factor') || text.includes('single maintainer') || text.includes('contributor')) {
    return [
      `Assess how critical this package is to your application`,
      `Check if the maintainer has published a succession plan or is seeking co-maintainers`,
      `Consider forking the repo internally as a contingency`,
      `Identify alternative packages with healthier contributor diversity`,
    ];
  }
  if (text.includes('bundle') || text.includes('size') || text.includes('tree-shak')) {
    return [
      `Analyze your bundle with \`npx webpack-bundle-analyzer\` or similar`,
      `Switch to the ES module variant if available (e.g., lodash-es)`,
      `Replace full imports with individual function imports where possible`,
      `Consider lighter alternatives that cover your actual usage`,
    ];
  }
  if (cat === 'security') {
    return [
      `Review the security advisory in detail`,
      `Determine if your usage triggers the vulnerable code path`,
      `Apply the recommended patch or workaround`,
      `Add monitoring for future advisories on this package`,
    ];
  }
  return [
    `Review the finding details and assess impact on your project`,
    `Determine if this is blocking for production usage`,
    `Apply the recommended action from the analysis`,
    `Re-run DepScope to verify the improvement`,
  ];
}

function generateWhy(f: Finding, cat: keyof Scores): string {
  const text = (f.title + ' ' + f.detail).toLowerCase();
  if (text.includes('cve') || text.includes('vulnerab'))
    return 'Unpatched vulnerabilities are a direct security risk. Attackers actively scan for known CVEs in production dependencies.';
  if (text.includes('abandon') || text.includes('unmaintain'))
    return 'Unmaintained packages won\'t receive security patches, bug fixes, or compatibility updates. This creates growing technical debt and risk over time.';
  if (text.includes('bus factor') || text.includes('single maintainer'))
    return 'A single-maintainer project is a supply chain risk. If that person steps away, the package becomes effectively orphaned with no one to address issues.';
  if (text.includes('bundle') || text.includes('size'))
    return 'Oversized bundles directly impact page load time, user experience, and Core Web Vitals scores. Smaller alternatives often provide the same functionality.';
  if (cat === 'security')
    return 'Security issues can lead to data breaches, unauthorized access, or compromised supply chains. They should be addressed with highest priority.';
  if (cat === 'community')
    return 'A weak community signal means fewer people are vetting the code, finding bugs, or contributing improvements. This correlates with higher long-term risk.';
  return 'Addressing this finding will directly improve your dependency health score and reduce risk in your project.';
}

function getEffort(severity: Finding['severity']): 'Quick' | 'Moderate' | 'Significant' {
  if (severity === 'LOW') return 'Quick';
  if (severity === 'MEDIUM') return 'Moderate';
  return 'Significant';
}

function buildFixes(findings: Finding[], alternatives: Alternative[]): Fix[] {
  const fixes: Fix[] = [];
  for (const f of findings) {
    if (f.severity === 'CRITICAL' || f.severity === 'HIGH' || f.severity === 'MEDIUM') {
      const cat = guessCategoryFromFinding(f);
      fixes.push({
        action: f.recommendation,
        detail: f.title,
        findingDetail: f.detail,
        impact: f.severity === 'CRITICAL' ? '+25 pts' : f.severity === 'HIGH' ? '+15 pts' : '+10 pts',
        category: cat,
        boost: f.severity === 'CRITICAL' ? 25 : f.severity === 'HIGH' ? 15 : 10,
        severity: f.severity,
        why: generateWhy(f, cat),
        steps: generateSteps(f, cat),
        effort: getEffort(f.severity),
      });
    }
  }
  if (alternatives.length > 0) {
    const best = alternatives.find(a => a.migrationDifficulty.toLowerCase() === 'easy') || alternatives[0];
    const alreadyMentioned = fixes.some(f => f.action.toLowerCase().includes(best.name.toLowerCase()));
    if (!alreadyMentioned) {
      fixes.push({
        action: `Consider migrating to ${best.name}`,
        detail: best.reason,
        findingDetail: `${best.name} — ${best.reason}`,
        impact: '+20 pts',
        category: 'maintenance',
        boost: 20,
        severity: 'HIGH',
        why: `Migrating to an actively maintained alternative eliminates multiple risk factors at once: better security patching, active community, and ongoing development.`,
        steps: [
          `Compare API surfaces between your current package and ${best.name}`,
          `Set up ${best.name} in a feature branch and run your test suite`,
          `Migrate usage incrementally — start with the most critical code paths`,
          `Remove the old dependency once all usage is migrated and tests pass`,
        ],
        effort: best.migrationDifficulty.toLowerCase() === 'easy' ? 'Quick' : 'Moderate',
      });
    }
  }
  return fixes;
}

function projectScores(scores: Scores, fixes: Fix[]): Scores {
  const projected = { ...scores };
  for (const fix of fixes) {
    projected[fix.category] = Math.min(100, projected[fix.category] + fix.boost);
  }
  return projected;
}

function calcWeighted(s: Scores): number {
  return Math.round(s.security * 0.30 + s.maintenance * 0.25 + s.stability * 0.20 + s.community * 0.15 + s.documentation * 0.10);
}

function scoreToGrade(scores: Scores): string {
  const w = calcWeighted(scores);
  if (w >= 80) return 'A';
  if (w >= 65) return 'B';
  if (w >= 50) return 'C';
  if (w >= 35) return 'D';
  return 'F';
}

const gradeColors: Record<string, string> = { A: 'text-green-400', B: 'text-blue-400', C: 'text-yellow-400', D: 'text-orange-400', F: 'text-red-400' };
const gradeBgColors: Record<string, string> = { A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-yellow-500', D: 'bg-orange-500', F: 'bg-red-500' };
const gradeShadows: Record<string, string> = {
  A: '0 0 40px hsl(142 76% 36% / 0.4)',
  B: '0 0 40px hsl(217 91% 60% / 0.4)',
  C: '0 0 40px hsl(45 93% 47% / 0.4)',
  D: '0 0 40px hsl(25 95% 53% / 0.4)',
  F: '0 0 40px hsl(0 72% 51% / 0.4)',
};
const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const Recommendations = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showAfter, setShowAfter] = useState(false);
  const [expandedFix, setExpandedFix] = useState<number | null>(null);

  const state = location.state as {
    packageName: string;
    grade: string;
    scores: Scores;
    findings: Finding[];
    alternatives: Alternative[];
  } | null;

  if (!state) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground text-lg">No analysis data found.</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Go Back to Analysis
          </button>
        </div>
      </div>
    );
  }

  const { packageName, grade, scores, findings, alternatives } = state;
  const fixes = buildFixes(findings, alternatives);
  const projectedScores = projectScores(scores, fixes);
  const projectedGrade = scoreToGrade(projectedScores);
  const currentWeighted = calcWeighted(scores);
  const projectedWeighted = calcWeighted(projectedScores);

  const activeScores = showAfter ? projectedScores : scores;
  const activeGrade = showAfter ? projectedGrade : grade;

  const radarData = [
    { subject: 'Maintenance', value: activeScores.maintenance, fullMark: 100 },
    { subject: 'Security', value: activeScores.security, fullMark: 100 },
    { subject: 'Community', value: activeScores.community, fullMark: 100 },
    { subject: 'Documentation', value: activeScores.documentation, fullMark: 100 },
    { subject: 'Stability', value: activeScores.stability, fullMark: 100 },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div className="p-2 rounded-lg bg-primary/10 glow-blue">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  <span className="text-foreground">Dep</span>
                  <span className="text-primary">Scope</span>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Recommended Fixes for <span className="text-foreground font-medium">{packageName}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAfter(!showAfter)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border",
                showAfter
                  ? "bg-primary/15 border-primary/40 text-primary hover:bg-primary/25"
                  : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {showAfter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showAfter ? 'Show Current' : 'Preview After Fixes'}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Grade Before/After + Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Before Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
              "p-6 rounded-2xl border shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-500",
              !showAfter ? "bg-card/80 border-border/60 scale-100" : "bg-card/40 border-border/20 scale-95 opacity-60"
            )}
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4 font-semibold">Current State</p>
            <div className="flex flex-col items-center">
              <div
                className={cn("w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black text-white", gradeBgColors[grade])}
                style={{ boxShadow: !showAfter ? gradeShadows[grade] : 'none' }}
              >
                {grade}
              </div>
              <p className="mt-3 text-2xl font-bold text-muted-foreground">{currentWeighted}<span className="text-sm font-normal">/100</span></p>
            </div>
          </motion.div>

          {/* Radar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="p-6 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold text-center">
              {showAfter ? 'Projected Scores' : 'Current Scores'}
            </p>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsRadar cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="hsl(0 0% 20%)" strokeDasharray="3 3" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(0 0% 64%)', fontSize: 11 }} tickLine={false} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }} tickCount={5} axisLine={false} />
                  <Radar
                    name="Score"
                    dataKey="value"
                    stroke={showAfter ? 'hsl(142 76% 46%)' : 'hsl(217 91% 60%)'}
                    fill={showAfter ? 'hsl(142 76% 46%)' : 'hsl(217 91% 60%)'}
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RechartsRadar>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* After Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className={cn(
              "p-6 rounded-2xl border shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-500",
              showAfter ? "bg-card/80 border-primary/30 scale-100" : "bg-card/40 border-border/20 scale-95 opacity-60"
            )}
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4 font-semibold flex items-center gap-2">
              After Fixes <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            </p>
            <div className="flex flex-col items-center">
              <div
                className={cn("w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black text-white", gradeBgColors[projectedGrade])}
                style={{ boxShadow: showAfter ? gradeShadows[projectedGrade] : 'none' }}
              >
                {projectedGrade}
              </div>
              <p className="mt-3 text-2xl font-bold text-muted-foreground">{projectedWeighted}<span className="text-sm font-normal">/100</span></p>
              <p className="mt-1 text-sm text-green-400 font-medium">+{projectedWeighted - currentWeighted} points</p>
            </div>
          </motion.div>
        </div>

        {/* Score Breakdown Bars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="p-6 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm"
        >
          <h2 className="text-lg font-semibold text-foreground tracking-wide uppercase flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" />
            Score Breakdown
          </h2>
          <div className="space-y-4">
            {(Object.keys(scores) as (keyof Scores)[]).map((key) => {
              const before = scores[key];
              const after = projectedScores[key];
              const improved = after > before;
              const active = showAfter ? after : before;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground capitalize font-medium">{key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{before}</span>
                      {improved && (
                        <>
                          <ArrowRight className="w-3 h-3 text-green-400" />
                          <span className={cn("text-sm font-medium", showAfter ? "text-green-400" : "text-muted-foreground/50")}>{after}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: `${before}%` }}
                      animate={{ width: `${active}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={cn(
                        "h-full rounded-full transition-colors duration-500",
                        showAfter && improved ? "bg-green-500" : "bg-primary"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Fix List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="p-6 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm"
        >
          <h2 className="text-lg font-semibold text-foreground tracking-wide uppercase flex items-center gap-2 mb-6">
            <Wrench className="w-5 h-5 text-primary" />
            Action Items ({fixes.length})
          </h2>
          <div className="space-y-4">
            {fixes.map((fix, index) => {
              const isExpanded = expandedFix === index;
              const scoreBefore = scores[fix.category];
              const scoreAfter = Math.min(100, scoreBefore + fix.boost);
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + index * 0.08 }}
                  className={cn(
                    "rounded-xl border transition-all duration-300 overflow-hidden",
                    isExpanded
                      ? "bg-muted/30 border-primary/30 shadow-md shadow-primary/5"
                      : "bg-muted/20 border-border/40 hover:border-primary/20 hover:bg-muted/25"
                  )}
                >
                  {/* Clickable header */}
                  <button
                    onClick={() => setExpandedFix(isExpanded ? null : index)}
                    className="w-full flex items-start gap-4 p-5 cursor-pointer text-left"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200",
                        isExpanded ? "bg-primary/15" : "bg-muted/30"
                      )}>
                        <CheckCircle2 className={cn(
                          "w-4 h-4 transition-colors duration-200",
                          isExpanded ? "text-primary" : "text-muted-foreground/40"
                        )} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          severityColors[fix.severity]
                        )}>
                          {fix.severity}
                        </span>
                        <span className="text-xs text-green-400 font-semibold bg-green-500/10 px-2 py-0.5 rounded-full">{fix.impact}</span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          fix.effort === 'Quick' ? 'bg-green-500/10 text-green-400' :
                          fix.effort === 'Moderate' ? 'bg-yellow-500/10 text-yellow-400' :
                          'bg-red-500/10 text-red-400'
                        )}>
                          {fix.effort} fix
                        </span>
                        <span className="text-xs text-muted-foreground/50 capitalize">{fix.category}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{fix.action}</p>
                      <p className="text-sm text-muted-foreground mt-1">{fix.detail}</p>
                    </div>
                    <ChevronDown className={cn(
                      "w-5 h-5 text-muted-foreground/30 mt-2 transition-all duration-300 flex-shrink-0",
                      isExpanded ? "rotate-180 text-primary" : ""
                    )} />
                  </button>

                  {/* Expanded detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 space-y-5 border-t border-border/30 pt-5 ml-[52px]">
                          {/* Finding detail */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Info className="w-4 h-4 text-primary" />
                              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Details</p>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{fix.findingDetail}</p>
                          </div>

                          {/* Why it matters */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-orange-400" />
                              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Why It Matters</p>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{fix.why}</p>
                          </div>

                          {/* Steps */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4 text-yellow-400" />
                              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Steps to Resolve</p>
                            </div>
                            <ol className="space-y-2">
                              {fix.steps.map((step, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                                    {i + 1}
                                  </span>
                                  <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
                                </li>
                              ))}
                            </ol>
                          </div>

                          {/* Category score impact */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-green-400" />
                              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                Impact on <span className="capitalize">{fix.category}</span> Score
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground w-8 text-right">{scoreBefore}</span>
                              <div className="flex-1 h-3 bg-muted/30 rounded-full overflow-hidden relative">
                                <div
                                  className="absolute inset-y-0 left-0 bg-muted-foreground/20 rounded-full"
                                  style={{ width: `${scoreBefore}%` }}
                                />
                                <motion.div
                                  initial={{ width: `${scoreBefore}%` }}
                                  animate={{ width: `${scoreAfter}%` }}
                                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                                  className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
                                />
                              </div>
                              <span className="text-sm text-green-400 font-medium w-8">{scoreAfter}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Back button */}
        <div className="flex justify-center pb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-muted/30 border border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Analysis
          </button>
        </div>
      </main>
    </div>
  );
};

export default Recommendations;
