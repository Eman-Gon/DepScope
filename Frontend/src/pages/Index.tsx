import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, ArrowRight } from 'lucide-react';
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
  const navigate = useNavigate();
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
                    className="space-y-6"
                  >
                    {/* Top Row: Grade + Radar | Findings */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-6 p-6 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm hover:border-primary/30 hover:shadow-primary/5 hover:shadow-xl transition-all duration-300 cursor-default">
                        <GradeDisplay
                          grade={result.grade}
                          rationale={result.gradeRationale}
                        />
                        <div className="border-t border-border/40 pt-6">
                          <RadarChartComponent scores={result.scores} />
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm hover:border-primary/30 hover:shadow-primary/5 hover:shadow-xl transition-all duration-300 cursor-default">
                        <FindingsList findings={result.findings} />
                      </div>
                    </div>

                    {/* Recommendations CTA - shows for grades C, D, F */}
                    {['C', 'D', 'F'].includes(result.grade.toUpperCase()) && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.6 }}
                        onClick={() => navigate('/recommendations', {
                          state: {
                            packageName: result.packageName,
                            grade: result.grade,
                            scores: result.scores,
                            findings: result.findings,
                            alternatives: result.alternatives,
                          },
                        })}
                        className="w-full group p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-card/80 to-primary/10 border border-primary/30 shadow-lg shadow-black/20 backdrop-blur-sm hover:border-primary/50 hover:shadow-primary/10 hover:shadow-xl transition-all duration-300 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/15 group-hover:bg-primary/25 transition-colors duration-300">
                              <Wrench className="w-5 h-5 text-primary" />
                            </div>
                            <div className="text-left">
                              <p className="text-foreground font-semibold">View Recommended Fixes</p>
                              <p className="text-sm text-muted-foreground">See how to improve your grade with actionable steps and a before/after preview</p>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-primary/50 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                        </div>
                      </motion.button>
                    )}

                    {/* Bottom Row: Alternatives | Verdict */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="p-6 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm hover:border-primary/30 hover:shadow-primary/5 hover:shadow-xl transition-all duration-300 cursor-default">
                        <AlternativesTable alternatives={result.alternatives} />
                      </div>

                      <div className="p-6 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm hover:border-primary/30 hover:shadow-primary/5 hover:shadow-xl transition-all duration-300 cursor-default">
                        <VerdictBox
                          verdict={result.verdict}
                          grade={result.grade}
                        />
                      </div>
                    </div>

                    {/* Pattern Insights - full width */}
                    {result.patternInsights.insights.length > 0 && (
                      <div className="p-6 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm hover:border-primary/30 hover:shadow-primary/5 hover:shadow-xl transition-all duration-300 cursor-default">
                        <PatternInsights
                          totalAnalyzed={result.patternInsights.totalAnalyzed}
                          insights={result.patternInsights.insights}
                        />
                      </div>
                    )}
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
