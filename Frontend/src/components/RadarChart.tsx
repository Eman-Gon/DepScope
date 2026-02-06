import { motion } from 'framer-motion';
import {
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

interface RadarChartProps {
  scores: {
    maintenance: number;
    security: number;
    community: number;
    documentation: number;
    stability: number;
  };
}

const RadarChartComponent = ({ scores }: RadarChartProps) => {
  const data = [
    { subject: 'Maintenance', value: scores.maintenance, fullMark: 100 },
    { subject: 'Security', value: scores.security, fullMark: 100 },
    { subject: 'Community', value: scores.community, fullMark: 100 },
    { subject: 'Documentation', value: scores.documentation, fullMark: 100 },
    { subject: 'Stability', value: scores.stability, fullMark: 100 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="w-full h-[300px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid 
            stroke="hsl(0 0% 20%)" 
            strokeDasharray="3 3"
          />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: 'hsl(0 0% 64%)', fontSize: 12 }}
            tickLine={false}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }}
            tickCount={5}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="hsl(217 91% 60%)"
            fill="hsl(217 91% 60%)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default RadarChartComponent;
