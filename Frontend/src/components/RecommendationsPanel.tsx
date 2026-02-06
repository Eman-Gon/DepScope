import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, ArrowRight, ChevronRight, Eye, EyeOff, TrendingUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Finding, Alternative } from '@/data/mockData';

interface Scores {
  maintenance: number;
  security: number;
  community: number;
  documentation: number;
  stability: number;
}

interface RecommendationsPanelProps {
  grade: string;
  scores: Scores;
  findings: Finding[];
  alternatives: Alternative[];
}

interface Fix {
  action: string;
  detail: string;
  impact: string;
  category: keyof Scores;
  boost: number;
  severity: Finding['severity'];
}

function buildFixes(findings: Finding[], alternatives: Alternative[]): Fix[] {
  const fixes: Fix[] = [];

  for (const f of findings) {
    if (f.severity === 'CRITICAL' || f.severity === 'HIGH') {
      const cat = guessCategoryFromFinding(f);
      fixes.push({
        action: f.recommendation,
        detail: f.title,
        impact: f.severity === 'CRITICAL' ? '+25 pts' : '+15 pts',
        category: cat,
        boost: f.severity === 'CRITICAL' ? 25 : 15,
        severity: f.severity,
      });
    } else if (f.severity === 'MEDIUM') {
      const cat = guessCategoryFromFinding(f);
      fixes.push({
        action: f.recommendation,
        detail: f.title,
        impact: '+10 pts',
        category: cat,
        boost: 10,
        severity: f.severity,
      });
    }
  }

  if (alternatives.length > 0) {
    const best = alternatives.find(a =>
      a.migrationDifficulty.toLowerCase() === 'easy'
    ) || alternatives[0];
    const alreadyMentioned = fixes.some(f =>
      f.action.toLowerCase().includes(best.name.toLowerCase())
    );
    if (!alreadyMentioned) {
      fixes.push({
        action: `Consider migrating to ${best.name}`,
        detail: best.reason,
        impact: '+20 pts',
        category: 'maintenance',
        boost: 20,
        severity: 'HIGH',
      });
    }
  }

  return fixes;
}

function guessCategoryFromFinding(f: Finding): keyof Scores {
  const text = (f.title + ' ' + f.detail + ' ' + f.recommendation).toLowerCase();
  if (text.includes('cve') || text.includes('vulnerab') || text.includes('security') || text.includes('patch')) return 'security';
  if (text.includes('maintain') || text.includes('commit') || text.includes('abandon') || text.includes('stale')) return 'maintenance';
  if (text.includes('bus factor') || text.includes('contributor') || text.includes('community')) return 'community';
  if (text.includes('bundle') || text.includes('stability') || text.includes('deprecat')) return 'stability';
  return 'maintenance';
}

function projectScores(scores: Scores, fixes: Fix[]): Scores {
  const projected = { ...scores };
  for (const fix of fixes) {
    projected[fix.category] = Math.min(100, projected[fix.category] + fix.boost);
  }
  return projected;
}

function scoreToGrade(scores: Scores): string {
  const weighted =
    scores.security * 0.30 +
    scores.maintenance * 0.25 +
    scores.stability * 0.20 +
    scores.community * 0.15 +
    scores.documentation * 0.10;
  if (weighted >= 80) return 'A';
  if (weighted >= 65) return 'B';
  if (weighted >= 50) return 'C';
  if (weighted >= 35) return 'D';
  return 'F';
}

const gradeColors: Record<string, string> = {
  A: 'text-green-400',
  B: 'text-blue-400',
  C: 'text-yellow-400',
  D: 'text-orange-400',
  F: 'text-red-400',
};

const severityColors: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const RecommendationsPanel = ({ grade, scores, findings, alternatives }: RecommendationsPanelProps) => {
  const [showAfter, setShowAfter] = useState(false);
  const fixes = buildFixes(findings, alternatives);
  const projectedScores = projectScores(scores, fixes);
  const projectedGrade = scoreToGrade(projectedScores);

  const currentWeighted = Math.round(
    scores.security * 0.30 +
    scores.maintenance * 0.25 +
    scores.stability * 0.20 +
    scores.community * 0.15 +
    scores.documentation * 0.10
  );

  const projectedWeighted = Math.round(
    projectedScores.security * 0.30 +
    projectedScores.maintenance * 0.25 +
    projectedScores.stability * 0.20 +
    projectedScores.community * 0.15 +
    projectedScores.documentation * 0.10
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="space-y-6"
    >
      {/* Header with before/after toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground tracking-wide uppercase flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" />
          Recommended Fixes
        </h2>
        <button
          onClick={() => setShowAfter(!showAfter)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border",
            showAfter
              ? "bg-primary/15 border-primary/40 text-primary hover:bg-primary/25"
              : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          {showAfter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showAfter ? 'Show Current' : 'Preview After Fixes'}
        </button>
      </div>

      {/* Before / After Score Comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cn(
          "p-4 rounded-xl border transition-all duration-300",
          !showAfter ? "bg-muted/30 border-border/60" : "bg-muted/10 border-border/20 opacity-50"
        )}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Current</p>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold", gradeColors[grade])}>{grade}</span>
            <span className="text-muted-foreground text-sm">({currentWeighted}/100)</span>
          </div>
        </div>
        <div className={cn(
          "p-4 rounded-xl border transition-all duration-300",
          showAfter ? "bg-primary/10 border-primary/30" : "bg-muted/10 border-border/20 opacity-50"
        )}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">After Fixes</p>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold", gradeColors[projectedGrade])}>{projectedGrade}</span>
            <span className="text-muted-foreground text-sm">({projectedWeighted}/100)</span>
            <TrendingUp className="w-4 h-4 text-green-400 ml-1" />
          </div>
        </div>
      </div>

      {/* Score breakdown before/after */}
      <AnimatePresence mode="wait">
        {showAfter && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 p-4 rounded-xl bg-muted/10 border border-border/30">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Projected Score Breakdown</p>
              {(Object.keys(scores) as (keyof Scores)[]).map((key) => {
                const before = scores[key];
                const after = projectedScores[key];
                const improved = after > before;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-28 capitalize">{key}</span>
                    <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: `${before}%` }}
                        animate={{ width: `${after}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={cn(
                          "h-full rounded-full",
                          improved ? "bg-primary" : "bg-muted-foreground/40"
                        )}
                      />
                    </div>
                    <span className="text-sm w-20 text-right">
                      <span className="text-muted-foreground">{before}</span>
                      {improved && (
                        <>
                          <ArrowRight className="w-3 h-3 inline mx-1 text-green-400" />
                          <span className="text-green-400 font-medium">{after}</span>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fix list */}
      <div className="space-y-3">
        {fixes.map((fix, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.7 + index * 0.1 }}
            className="group flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border/40 hover:border-primary/30 hover:bg-muted/30 transition-all duration-200 cursor-pointer"
          >
            <div className="mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary transition-colors duration-200" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                  severityColors[fix.severity]
                )}>
                  {fix.severity}
                </span>
                <span className="text-xs text-green-400 font-medium">{fix.impact}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{fix.action}</p>
              <p className="text-xs text-muted-foreground mt-1">{fix.detail}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary mt-1 transition-colors duration-200" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default RecommendationsPanel;
