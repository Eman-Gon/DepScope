import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { Finding } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface FindingsListProps {
  findings: Finding[];
}

const severityConfig = {
  CRITICAL: {
    bg: 'bg-severity-critical',
    text: 'text-white',
    emoji: '🔴',
  },
  HIGH: {
    bg: 'bg-severity-high',
    text: 'text-white',
    emoji: '🟡',
  },
  MEDIUM: {
    bg: 'bg-severity-medium',
    text: 'text-black',
    emoji: '🟢',
  },
  LOW: {
    bg: 'bg-severity-low',
    text: 'text-white',
    emoji: '🔵',
  },
};

const FindingsList = ({ findings }: FindingsListProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="space-y-4"
    >
      <h2 className="text-lg font-semibold text-foreground tracking-wide uppercase">
        Findings
      </h2>
      <div className="space-y-3">
        {findings.map((finding, index) => {
          const config = severityConfig[finding.severity];
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
              className="p-4 rounded-xl bg-muted/20 border border-border/40 hover:border-primary/30 hover:bg-muted/40 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide shrink-0",
                    config.bg,
                    config.text
                  )}
                >
                  {finding.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{finding.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{finding.detail}</p>
                  <p className="mt-2 text-sm text-primary italic flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />
                    {finding.recommendation}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default FindingsList;
