import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GradeDisplayProps {
  grade: string;
  rationale: string;
}

const getGradeColor = (grade: string) => {
  switch (grade.toUpperCase()) {
    case 'A':
      return 'bg-grade-a text-white';
    case 'B':
      return 'bg-grade-b text-white';
    case 'C':
      return 'bg-grade-c text-black';
    case 'D':
      return 'bg-grade-d text-white';
    case 'F':
      return 'bg-grade-f text-white';
    default:
      return 'bg-muted text-foreground';
  }
};

const getGradeShadow = (grade: string) => {
  switch (grade.toUpperCase()) {
    case 'A':
    case 'B':
      return '0 0 40px hsl(142 76% 36% / 0.4), 0 0 80px hsl(142 76% 36% / 0.2)';
    case 'C':
      return '0 0 40px hsl(45 93% 47% / 0.4), 0 0 80px hsl(45 93% 47% / 0.2)';
    case 'D':
      return '0 0 40px hsl(25 95% 53% / 0.4), 0 0 80px hsl(25 95% 53% / 0.2)';
    case 'F':
      return '0 0 40px hsl(0 72% 51% / 0.4), 0 0 80px hsl(0 72% 51% / 0.2)';
    default:
      return 'none';
  }
};

const GradeDisplay = ({ grade, rationale }: GradeDisplayProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="flex flex-col items-center"
    >
      <div
        className={cn(
          "grade-circle",
          getGradeColor(grade)
        )}
        style={{ boxShadow: getGradeShadow(grade) }}
      >
        {grade}
      </div>
      <h3 className="mt-6 text-lg font-semibold text-foreground">Grade Rationale</h3>
      <p className="mt-2 text-center text-muted-foreground max-w-sm">
        {rationale}
      </p>
    </motion.div>
  );
};

export default GradeDisplay;
