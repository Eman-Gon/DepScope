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
      <p className="text-muted-foreground mb-4">
        After analyzing <span className="text-foreground font-semibold">{totalAnalyzed} packages</span>:
      </p>
      <ul className="space-y-3">
        {insights.map((insight, index) => (
          <li
            key={index}
            className="flex items-start gap-3 text-muted-foreground p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors duration-200"
          >
            <span className="text-primary mt-0.5">•</span>
            {insight}
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

export default PatternInsights;
