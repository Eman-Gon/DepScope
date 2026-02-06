import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface PatternInsightsProps {
  totalAnalyzed: number;
  insights: string[];
}

const PatternInsights = ({ totalAnalyzed, insights }: PatternInsightsProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className="space-y-4"
    >
      <h2 className="text-lg font-semibold text-foreground tracking-wide uppercase flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Pattern Insights
      </h2>
      <div className="p-6 rounded-lg bg-muted/30 border border-border">
        <p className="text-muted-foreground mb-4">
          After analyzing <span className="text-foreground font-semibold">{totalAnalyzed} packages</span>:
        </p>
        <ul className="space-y-2">
          {insights.map((insight, index) => (
            <li 
              key={index}
              className="flex items-start gap-2 text-muted-foreground"
            >
              <span className="text-primary">•</span>
              {insight}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

export default PatternInsights;
