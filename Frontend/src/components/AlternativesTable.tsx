import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Alternative } from '@/data/mockData';

interface AlternativesTableProps {
  alternatives: Alternative[];
}

const AlternativesTable = ({ alternatives }: AlternativesTableProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
      className="space-y-4 h-full"
    >
      <h2 className="text-lg font-semibold text-foreground tracking-wide uppercase flex items-center gap-2">
        <ArrowRight className="w-5 h-5 text-primary" />
        Alternatives
      </h2>
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
              <TableHead className="text-foreground font-semibold text-xs uppercase tracking-wider">Package</TableHead>
              <TableHead className="text-foreground font-semibold text-xs uppercase tracking-wider">Migration</TableHead>
              <TableHead className="text-foreground font-semibold text-xs uppercase tracking-wider">Maintenance</TableHead>
              <TableHead className="text-foreground font-semibold text-xs uppercase tracking-wider">Why Switch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alternatives.map((alt, index) => (
              <TableRow
                key={index}
                className="hover:bg-primary/5 transition-colors duration-200 cursor-pointer border-b border-border/20"
              >
                <TableCell className="font-mono font-semibold text-primary">
                  {alt.name}
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    alt.migrationDifficulty === 'easy' ? 'bg-green-500/15 text-green-400' :
                    alt.migrationDifficulty === 'moderate' ? 'bg-yellow-500/15 text-yellow-400' :
                    'bg-red-500/15 text-red-400'
                  )}>
                    {alt.migrationDifficulty}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-muted-foreground text-sm">{alt.maintenance}</span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-md">
                  {alt.reason}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
};

export default AlternativesTable;
