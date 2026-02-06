import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import SearchInput from '@/components/SearchInput';
import AgentStatusCard from '@/components/AgentStatusCard';
import GradeDisplay from '@/components/GradeDisplay';
import RadarChartComponent from '@/components/RadarChart';
import FindingsList from '@/components/FindingsList';
import AlternativesTable from '@/components/AlternativesTable';
import PatternInsights from '@/components/PatternInsights';
import VerdictBox from '@/components/VerdictBox';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const {
    agents,
    result,
    isAnalyzing,
    showResults,
    showMainContent,
    error,
    analyze,
  } = useAnalysis();

  const { toast } = useToast();

  useEffect(() => {
    if (error) {
      toast({ title: 'Analysis Error', description: error, variant: 'destructive' });
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-12">
        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Analyze Dependency Risk
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Get instant insights into package health, security vulnerabilities, and maintenance status.
          </p>
          <SearchInput onAnalyze={analyze} isLoading={isAnalyzing} />
        </motion.div>

        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {/* Agent Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {agents.map((agent, index) => (
                  <AgentStatusCard
                    key={agent.title}
                    title={agent.title}
                    icon={agent.icon}
                    status={agent.status}
                    progress={agent.progress}
                    isComplete={agent.isComplete}
                    delay={index * 0.15}
                  />
                ))}
              </div>

              {/* Error Display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6 rounded-lg bg-red-500/10 border border-red-500/30 text-center"
                >
                  <p className="text-red-400 font-medium">{error}</p>
                  <p className="text-muted-foreground text-sm mt-2">
                    Please try again or check that the backend is running on port 3000.
                  </p>
                </motion.div>
              )}

              {/* Main Content */}
              <AnimatePresence>
                {showMainContent && result && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-12"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Column - Grade & Chart */}
                      <div className="space-y-8 p-6 rounded-xl bg-card border border-border">
                        <GradeDisplay
                          grade={result.grade}
                          rationale={result.gradeRationale}
                        />
                        <RadarChartComponent scores={result.scores} />
                      </div>

                      {/* Right Column - Findings */}
                      <div className="p-6 rounded-xl bg-card border border-border">
                        <FindingsList findings={result.findings} />
                      </div>
                    </div>

                    {/* Alternatives Table */}
                    <AlternativesTable alternatives={result.alternatives} />

                    {/* Pattern Insights - only if data available */}
                    {result.patternInsights.insights.length > 0 && (
                      <PatternInsights
                        totalAnalyzed={result.patternInsights.totalAnalyzed}
                        insights={result.patternInsights.insights}
                      />
                    )}

                    {/* Verdict */}
                    <VerdictBox
                      verdict={result.verdict}
                      grade={result.grade}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
