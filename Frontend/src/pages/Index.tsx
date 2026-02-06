import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, ArrowRight, Shield, Search, BarChart3, Plus, History } from 'lucide-react';
import Header from '@/components/Header';
import SearchInput from '@/components/SearchInput';
import AgentStatusCard from '@/components/AgentStatusCard';
import GradeDisplay from '@/components/GradeDisplay';
import RadarChartComponent from '@/components/RadarChart';
import FindingsList from '@/components/FindingsList';
import AlternativesTable from '@/components/AlternativesTable';
import PatternInsights from '@/components/PatternInsights';
import VerdictBox from '@/components/VerdictBox';
import ReportActions from '@/components/ReportActions';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const {
    agents,
    result,
    analysisId,
    isAnalyzing,
    showResults,
    showMainContent,
    error,
    analyze,
    history,
    restoreAnalysis,
    resetForNew,
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

        {/* Onboarding — visible until the user kicks off an analysis */}
        <AnimatePresence>
          {!showResults && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="space-y-10 mb-12"
            >
              {/* Example repos */}
              <div className="text-center space-y-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Try an example</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    { url: 'https://github.com/facebook/react', label: 'React' },
                    { url: 'https://github.com/font/pacman', label: 'Pacman' },
                    { url: 'https://github.com/torvalds/linux', label: 'Linux' },
                    { url: 'https://github.com/Homebrew/homebrew-core', label: 'Homebrew' },
                    { url: 'https://github.com/openclaw/openclaw', label: 'OpenClaw' },
                    { url: 'https://github.com/Eman-Gon/DepScope', label: 'DepScope' },
                  ].map((ex) => (
                    <button
                      key={ex.url}
                      onClick={() => analyze(ex.url)}
                      className="px-4 py-2 rounded-xl bg-muted/30 border border-border/50 text-sm text-muted-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all duration-200"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: <Shield className="w-6 h-6 text-primary" />,
                    title: 'Security Scan',
                    desc: 'We check public vulnerability databases (CVEs) to see if the package has any known security issues — things like prototype pollution, remote code execution, or supply-chain attacks that could put your app at risk.',
                  },
                  {
                    icon: <Search className="w-6 h-6 text-primary" />,
                    title: 'Community Intel',
                    desc: 'We look at what developers are saying on Reddit and Hacker News, check how actively the project is maintained on GitHub, and flag "bus factor" risk — whether the project depends on a single maintainer.',
                  },
                  {
                    icon: <BarChart3 className="w-6 h-6 text-primary" />,
                    title: 'Risk Grade & Report',
                    desc: 'Everything gets combined into a simple A-F letter grade. You can export the full breakdown as a DEPSCOPE.md report and commit it directly to your repo so your whole team can see it.',
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="p-6 rounded-2xl bg-card/80 border border-border/60 shadow-lg shadow-black/20 backdrop-blur-sm text-center space-y-3"
                  >
                    <div className="mx-auto w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                      {card.icon}
                    </div>
                    <h3 className="text-foreground font-semibold">{card.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showResults && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {/* New Analysis + History */}
              {showMainContent && result && (
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={resetForNew}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Analyze New Repo
                  </button>
                  {history.length > 1 && (
                    <>
                      <span className="text-muted-foreground/50 text-xs">|</span>
                      <History className="w-3.5 h-3.5 text-muted-foreground/50" />
                      {history.filter(h => h.id !== analysisId).map(h => (
                        <button
                          key={h.id}
                          onClick={() => restoreAnalysis(h.id)}
                          className="px-3 py-1.5 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                        >
                          {h.result.packageName} ({h.result.grade})
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

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

                    {/* Report Actions (disable via VITE_DEPSCOPE_ENABLED=false) */}
                    {analysisId && import.meta.env.VITE_DEPSCOPE_ENABLED !== 'false' && (
                      <ReportActions
                        analysisId={analysisId}
                        packageName={result.packageName}
                        grade={result.grade}
                      />
                    )}

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
