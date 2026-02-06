import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface VerdictBoxProps {
  verdict: string;
  grade: string;
}

const getVerdictStyle = (grade: string) => {
  switch (grade.toUpperCase()) {
    case 'A':
    case 'B':
      return 'bg-green-500/10 border-green-500/30';
    case 'C':
      return 'bg-yellow-500/10 border-yellow-500/30';
    case 'D':
      return 'bg-orange-500/10 border-orange-500/30';
    case 'F':
      return 'bg-red-500/10 border-red-500/30';
    default:
      return 'bg-muted border-border';
  }
};

const VerdictBox = ({ verdict, grade }: VerdictBoxProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.9 }}
      className="space-y-4"
    >
      <h2 className="text-lg font-semibold text-foreground tracking-wide uppercase flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        Verdict
      </h2>
      <div className={`p-6 rounded-lg border-2 ${getVerdictStyle(grade)}`}>
        <p className="text-foreground leading-relaxed text-lg font-medium">
          {verdict}
        </p>
      </div>
    </motion.div>
  );
};

export default VerdictBox;
