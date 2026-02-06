import { motion } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
      className="space-y-4"
    >
      <h2 className="text-lg font-semibold text-foreground tracking-wide uppercase">
        Alternatives
      </h2>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-foreground font-semibold">Package</TableHead>
              <TableHead className="text-foreground font-semibold">Migration</TableHead>
              <TableHead className="text-foreground font-semibold">Maintenance</TableHead>
              <TableHead className="text-foreground font-semibold">Why Switch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alternatives.map((alt, index) => (
              <TableRow 
                key={index}
                className="hover:bg-muted/30 transition-colors"
              >
                <TableCell className="font-mono font-semibold text-primary">
                  {alt.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {alt.migrationDifficulty}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{alt.maintenance}</span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-md">
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
