import { motion } from 'framer-motion';
import { Database, Search, Shield, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentStatusCardProps {
  title: string;
  icon: 'database' | 'search' | 'shield';
  status: string;
  progress: string;
  isComplete: boolean;
  delay: number;
}

const iconMap = {
  database: Database,
  search: Search,
  shield: Shield,
};

const AgentStatusCard = ({ title, icon, status, progress, isComplete, delay }: AgentStatusCardProps) => {
  const Icon = iconMap[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "relative p-6 rounded-2xl border bg-card/80 backdrop-blur-sm shadow-lg shadow-black/20 transition-all duration-500 hover:shadow-xl cursor-default",
        isComplete
          ? "border-primary/50 glow-blue hover:border-primary/70"
          : "border-border/60 pulse-glow hover:border-border"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-lg transition-colors duration-500",
            isComplete ? "bg-primary/20" : "bg-muted"
          )}>
            <Icon className={cn(
              "w-5 h-5 transition-colors duration-500",
              isComplete ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <div className="flex items-center gap-2 mt-1">
              {isComplete && <CheckCircle2 className="w-4 h-4 text-primary" />}
              <span className={cn(
                "text-sm",
                isComplete ? "text-primary" : "text-muted-foreground"
              )}>
                {status}
              </span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground font-mono">{progress}</p>
    </motion.div>
  );
};

export default AgentStatusCard;
